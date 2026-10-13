import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsObject, Min } from 'class-validator';
import { WithdrawMethod } from '@wavehub/shared-types';

export class CreateWithdrawRequestDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  amountWaveCoin: number;

  @IsEnum(WithdrawMethod)
  method: WithdrawMethod;

  // Not validated field-by-field against `method` (PayPal email vs bank IBAN/SWIFT shape) —
  // deliberately loose for now, same tradeoff as the entity's own comment; tighten if bad payout
  // data becomes a real support burden.
  @IsObject()
  payoutDetails: Record<string, string>;
}
