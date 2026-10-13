import { IsIn, IsOptional } from 'class-validator';
import { SubscriptionAudience } from '@wavehub/shared-types';

export class ListPlansDto {
  @IsOptional()
  @IsIn([SubscriptionAudience.Buyer, SubscriptionAudience.SellerCoach])
  audience?: SubscriptionAudience;
}
