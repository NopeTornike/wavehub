import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  platformFeePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minWithdrawalWaveCoin?: number;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;
}
