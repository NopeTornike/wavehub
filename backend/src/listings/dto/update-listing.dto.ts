import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Length, Min, ValidateNested } from 'class-validator';
import { IsItemAttributes } from './item-attributes.validator';
import { FaqEntryDto, RequirementFieldDto } from './create-listing.dto';

// Seller edit of their own listing (PATCH /listings/:id). Every field optional; same bounds as
// CreateListingDto. Type/category/game are deliberately not editable — changing what a listing IS
// should be a new listing. Editing an Active/Paused listing sends it back to review (see
// ListingsService#update).
export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @Length(5, 100)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(50, 5000)
  description?: string;

  // Items and digital keys only (services are priced by their packages).
  @IsOptional()
  @IsInt()
  @Min(1)
  priceWaveCoin?: number;

  // Items only — replaces the whole attribute bag.
  @IsOptional()
  @IsItemAttributes()
  attributes?: Record<string, string | number | boolean>;

  // Services only — each replaces the whole list.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RequirementFieldDto)
  requirementsSchema?: RequirementFieldDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FaqEntryDto)
  faq?: FaqEntryDto[];
}
