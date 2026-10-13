import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { ReviewStatus } from '@wavehub/shared-types';

export class ListAdminReviewsDto {
  @IsOptional()
  @IsIn(['product', 'coach'])
  kind?: 'product' | 'coach';

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;
}

// Super Admin edit of a review. `null` clears the text / the seller's reply (product reviews only).
export class AdminEditReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Length(1, 1000)
  body?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Length(1, 1000)
  sellerReply?: string | null;
}
