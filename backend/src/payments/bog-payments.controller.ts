import { Body, Controller, HttpException, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { BogPaymentsService } from './bog-payments.service';
import { AuthGuard } from '../auth/auth.guard';
import { StateService } from '../state/state.service';

class CreateBogOrderDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  amountGel: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  wavecoins: number;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @IsUrl({ require_tld: false })
  successUrl: string;

  @IsUrl({ require_tld: false })
  failUrl: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  callbackUrl?: string;
}

@Controller('payments/bog')
@UseGuards(AuthGuard)
export class BogPaymentsController {
  constructor(private bogPayments: BogPaymentsService, private state: StateService) {}

  @Post('create-order')
  async createOrder(@Body() body: CreateBogOrderDto, @Req() request: Request) {
    try {
      const user = (request as any).user;
      const order = await this.bogPayments.createWavecoinOrder({ ...body, username: user.username });
      await this.state.recordWalletTransaction(user.username, {
        id: body.transactionId,
        type: 'credit',
        method: 'BOG',
        status: 'redirecting',
        wavecoins: body.wavecoins,
        amountGel: body.amountGel,
        bogOrderId: order.orderId,
        createdAt: new Date().toISOString(),
      });
      return { ok: true, ...order };
    } catch (err: any) {
      const status = err.status || HttpStatus.BAD_GATEWAY;
      throw new HttpException(
        { ok: false, error: err.message || 'BOG checkout could not be created.' },
        status,
      );
    }
  }
}
