import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Min } from 'class-validator';
import { SubscriptionAudience } from '@wavehub/shared-types';

export class CreatePlanDto {
  @IsIn([SubscriptionAudience.Buyer, SubscriptionAudience.SellerCoach])
  audience: SubscriptionAudience;

  @IsString()
  @Length(2, 40)
  tier: string;

  @IsString()
  @Length(3, 80)
  name: string;

  @IsString()
  @Length(10, 2000)
  description: string;

  @IsInt()
  @Min(1)
  priceGel: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  billingPeriodDays?: number;

  // Validated as a plain object here (the four known keys are documented in
  // @wavehub/shared-types' SubscriptionPerks, not enforced field-by-field in this DTO — a jsonb
  // bag that needs a matching DTO update for every new perk key would defeat the point of §3b's
  // "no migration for a new perk" design).
  @IsOptional()
  @IsObject()
  perks?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
