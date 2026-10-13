import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';

// Every field required: the Super Admin sends the whole Support permission set at once.
export class SupportPermissionsDto {
  @IsBoolean()
  walletAdjust: boolean;

  // Largest single WaveCoin adjustment (either direction) Support may make.
  @IsInt()
  @Min(1)
  @Max(100000)
  walletAdjustMax: number;

  @IsBoolean()
  suspendUsers: boolean;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  platformFeePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  coachingFeePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minWithdrawalWaveCoin?: number;

  // Auto-accept windows in hours (1 hour – 30 days).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  orderAutoCompleteHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  sessionAutoConfirmHours?: number;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SupportPermissionsDto)
  supportPermissions?: SupportPermissionsDto;
}
