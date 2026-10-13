import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class GrantSubscriptionDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  planId: string;

  // Defaults to the plan's own billingPeriodDays when omitted.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  periodDays?: number;

  @IsString()
  @Length(3, 500)
  reason: string;
}
