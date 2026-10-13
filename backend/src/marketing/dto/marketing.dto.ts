import { Transform } from 'class-transformer';
import { BannerPlacement } from '@wavehub/shared-types';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
// An internal path ("/coaching") or an https URL — nothing else may become a banner link.
export const BANNER_LINK = /^(\/(?!\/)[\w\-/?=&.%#~]*|https:\/\/[\w.-]+(\/\S*)?)$/;

export class RedeemPromoDto {
  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z0-9_-]{3,30}$/, { message: 'Invalid code' })
  code: string;
}

export class CreatePromoCodeDto {
  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z0-9_-]{3,30}$/, { message: 'Code: 3–30 letters, digits, - or _' })
  code: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  amountWaveCoin: number;

  @IsInt()
  @Min(1)
  @Max(100000)
  maxRedemptions: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

export class UpdatePromoCodeDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  amountWaveCoin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  maxRedemptions?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

export class BannerDto {
  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;

  // Optional since 2026-10-07: an empty title (with no subtitle / button text) shows the photo alone.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  subtitle?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(300)
  @Matches(BANNER_LINK, { message: 'Link: a site path like /coaching or an https:// address' })
  linkUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(30)
  buttonLabel?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

// GET banners?placement= — the public list for one spot on the site.
export class PublicBannersQueryDto {
  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;
}

export class CreateBannerDto extends BannerDto {}
