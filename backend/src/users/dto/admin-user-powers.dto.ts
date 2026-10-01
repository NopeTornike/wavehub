import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min, NotEquals, ValidateIf } from 'class-validator';
import { AdminRole } from '@wavehub/shared-types';

// POST admin/users/:id/wallet-adjustment — Super Admin only. Positive adds, negative removes.
export class WalletAdjustmentDto {
  @IsInt()
  @NotEquals(0)
  @Min(-100000)
  @Max(100000)
  amountWaveCoin: number;

  @IsString()
  @Length(5, 300)
  reason: string;
}

// POST admin/users/:id/role — Super Admin only. `adminRole: null` removes staff access.
export class SetAdminRoleDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsEnum(AdminRole)
  adminRole: AdminRole | null;

  @IsString()
  @Length(3, 300)
  reason: string;
}
