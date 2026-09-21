import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Min } from 'class-validator';
import { SubscriptionAudience } from '@wavehub/shared-types';

export class UpdatePlanDto {
  @IsOptional()
  @IsIn([SubscriptionAudience.Buyer, SubscriptionAudience.SellerCoach])
  audience?: SubscriptionAudience;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  tier?: string;

  @IsOptional()
  @IsString()
  @Length(3, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(10, 2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceGel?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  billingPeriodDays?: number;

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
