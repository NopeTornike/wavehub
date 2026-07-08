import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { BogPaymentsService } from './bog-payments.service';

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
export class BogPaymentsController {
  constructor(private bogPayments: BogPaymentsService) {}

  @Post('create-order')
  async createOrder(@Body() body: CreateBogOrderDto) {
    try {
      const order = await this.bogPayments.createWavecoinOrder(body);
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
