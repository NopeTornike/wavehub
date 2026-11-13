import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, NotEquals, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminRole, ProfileTitle } from '@wavehub/shared-types';

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

// POST admin/users/:id/wallet-zero — Super Admin only: set the spendable balance to 0.
export class WalletZeroDto {
  @IsString()
  @Length(5, 300)
  reason: string;
}

// A Game Manager's games (owner 2026-11-06), per area.
export class StaffGameScopesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  marketplaceGameIds: string[];

  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  tournamentGameIds: string[];
}

// POST admin/users/:id/role — Super Admin only. `adminRole: null` removes staff access.
// `staffScopes` is read only for the Game Manager role.
export class SetAdminRoleDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => StaffGameScopesDto)
  staffScopes?: StaffGameScopesDto;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsEnum(AdminRole)
  adminRole: AdminRole | null;

  @IsString()
  @Length(3, 300)
  reason: string;
}

// POST admin/users/:id/profile-title — any title (staff vouch for it), or null to hand the choice
// back to the user.
export class SetProfileTitleDto {
  @ValidateIf((_o, value) => value !== null)
  @IsEnum(ProfileTitle)
  title: ProfileTitle | null;
}
