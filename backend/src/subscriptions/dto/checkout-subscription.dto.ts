import { IsUrl, IsUUID } from 'class-validator';

export class CheckoutSubscriptionDto {
  @IsUUID()
  planId: string;

  @IsUrl({ require_tld: false })
  successUrl: string;

  @IsUrl({ require_tld: false })
  failUrl: string;
}
