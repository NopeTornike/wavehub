import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transform } from 'class-transformer';
import { IsInt, IsUrl, Min } from 'class-validator';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { BogPaymentsService } from './bog-payments.service';
import { BogTopupIntent } from './bog-topup-intent.entity';
import { verifyBogCallbackSignature } from './bog-signature.util';
import { isSameOriginAsFrontend } from './same-origin.util';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';

const CREATE_ORDER_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

class CreateBogOrderDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  amountGel: number;

  @IsUrl({ require_tld: false })
  successUrl: string;

  @IsUrl({ require_tld: false })
  failUrl: string;
}

function assertSameOriginAsFrontend(url: string, fieldName: string): void {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  if (!isSameOriginAsFrontend(url, frontendUrl)) {
    throw new BadRequestException(`${fieldName} must be on the same origin as ${frontendUrl}`);
  }
}

@Controller('payments/bog')
export class BogPaymentsController {
  private readonly logger = new Logger(BogPaymentsController.name);

  constructor(
    private readonly bogPayments: BogPaymentsService,
    private readonly usersService: UsersService,
    private readonly wallet: WalletService,
    @InjectRepository(BogTopupIntent) private readonly intents: Repository<BogTopupIntent>,
  ) {}

  // Guarded, and the WaveCoin amount is derived server-side from amountGel at a fixed 1:1 rate —
  // never accept a client-supplied wavecoin count independent of the amount actually being
  // charged (that was the shape of the bug this replaced: a client could ask to be credited any
  // number of WaveCoin regardless of amountGel). See bog-topup-intent.entity.ts / CLAUDE.md.
  @Post('create-order')
  @UseGuards(AuthGuard)
  @Throttle(CREATE_ORDER_THROTTLE)
  async createOrder(@CurrentUserId() userId: string, @Body() body: CreateBogOrderDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new HttpException({ ok: false, error: 'User not found' }, HttpStatus.NOT_FOUND);
    }

    assertSameOriginAsFrontend(body.successUrl, 'successUrl');
    assertSameOriginAsFrontend(body.failUrl, 'failUrl');

    const transactionId = randomUUID();
    const wavecoins = body.amountGel; // fixed 1 GEL : 1 WaveCoin

    const intent = this.intents.create({
      id: transactionId,
      userId: user.id,
      amountGel: body.amountGel,
      wavecoins,
      status: 'pending',
    });
    await this.intents.save(intent);

    const callbackUrl = `${process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000'}/payments/bog/callback`;

    try {
      const order = await this.bogPayments.createWavecoinOrder({
        amountGel: body.amountGel,
        wavecoins,
        username: user.username,
        transactionId,
        successUrl: body.successUrl,
        failUrl: body.failUrl,
        callbackUrl,
      });
      await this.intents.update(transactionId, { bogOrderId: order.orderId });
      return { ok: true, ...order };
    } catch (err: any) {
      await this.intents.update(transactionId, { status: 'failed' });
      // Log the real upstream error server-side, but don't forward it to the client — BOG's raw
      // error text could describe internal request shape/credentials-adjacent detail that's only
      // useful for our own debugging, not something to hand back over the API.
      this.logger.error(`BOG create-order failed for user ${userId}`, err as Error);
      const status = err.status && err.status < 500 ? err.status : HttpStatus.BAD_GATEWAY;
      throw new HttpException({ ok: false, error: 'BOG checkout could not be created.' }, status);
    }
  }

  // Verifies the signature, then re-fetches the order's authoritative status from BOG's API
  // (getOrderDetails) rather than trusting fields inside the callback body itself — the signature
  // only proves BOG sent *a* notification about this order_id, not that the body's own status
  // field is what we should act on. Always returns 200 (even for unknown/invalid callbacks) so BOG
  // doesn't retry a request we've already permanently rejected; only successful, verified,
  // completed payments actually credit anything, and recordTopup is idempotent regardless.
  // Exempt from the global IP-based rate limit: this is server-to-server traffic from BOG (likely
  // a small, shared set of source IPs across every user's transactions), it's already gated by
  // cryptographic signature verification rather than by throughput, and dropping a legitimate
  // payment confirmation under load is a worse failure mode than any flood risk here.
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  async callback(@Req() req: Request, @Headers('callback-signature') signature: string | undefined) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    if (!rawBody || !verifyBogCallbackSignature(rawBody, signature || '')) {
      this.logger.warn('Rejected BOG callback with invalid or missing signature.');
      return { ok: true };
    }

    const bogOrderId: string | undefined = (req.body as any)?.body?.order_id;
    if (!bogOrderId) {
      this.logger.warn('BOG callback missing body.order_id.');
      return { ok: true };
    }

    let details: { orderStatus: string; externalOrderId: string | undefined };
    try {
      details = await this.bogPayments.getOrderDetails(bogOrderId);
    } catch (err) {
      this.logger.error(`Failed to fetch BOG order details for ${bogOrderId}`, err as Error);
      return { ok: true };
    }

    const transactionId = details.externalOrderId;
    if (!transactionId) {
      this.logger.warn(`BOG order ${bogOrderId} has no external_order_id.`);
      return { ok: true };
    }

    const intent = await this.intents.findOne({ where: { id: transactionId } });
    if (!intent) {
      this.logger.warn(`No topup intent found for transactionId ${transactionId}.`);
      return { ok: true };
    }

    if (details.orderStatus === 'completed') {
      if (intent.status !== 'completed') {
        await this.wallet.recordTopup(intent.userId, intent.wavecoins, intent.id);
        await this.intents.update(intent.id, { status: 'completed' });
      }
    } else if (['rejected', 'refunded', 'refunded_partially'].includes(details.orderStatus)) {
      if (intent.status === 'pending') {
        await this.intents.update(intent.id, { status: 'failed' });
      }
    }

    return { ok: true };
  }
}
