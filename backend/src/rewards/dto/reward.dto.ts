import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { REWARD_TRIGGERS } from '@wavehub/shared-types';
import type { RewardPeriod, RewardTrigger } from '@wavehub/shared-types';

export class RewardTaskDto {
  @IsString()
  @Length(2, 80)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null;

  @IsIn(REWARD_TRIGGERS)
  trigger!: RewardTrigger;

  // A count, or GEL for the amount triggers (topup_amount, spend_amount).
  @IsInt()
  @Min(1)
  @Max(100000)
  target!: number;

  @IsInt()
  @Min(1)
  @Max(100000)
  xp!: number;

  @IsIn(['daily', 'once'])
  period!: RewardPeriod;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class RewardPrizeDto {
  @IsString()
  @MaxLength(80)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;
}

export class RewardSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  streakBonusXp?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class RewardVisitDto {
  @IsIn(['marketplace', 'services', 'steam', 'tournaments', 'coaching'])
  page!: string;
}

export class RewardDeliveredDto {
  @IsBoolean()
  delivered!: boolean;
}

export class RewardFinalizeDto {
  // Monday of the week to settle, YYYY-MM-DD (Tbilisi).
  @IsString()
  @Length(10, 10)
  weekStart!: string;
}
