import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min, ValidateNested } from 'class-validator';
import { IsItemAttributes } from './item-attributes.validator';
import { ListingType } from '@wavehub/shared-types';

// A question the buyer answers when ordering a service (validated at order time by
// orders/requirements-validator.ts). Bounded so a listing can't carry an unbounded form.
export class RequirementFieldDto {
  @IsString()
  @Matches(/^[a-z0-9_]{1,40}$/, { message: 'requirement key must be 1–40 lowercase letters, digits or _' })
  key: string;

  @IsString()
  @Length(1, 80)
  label: string;

  @IsIn(['text', 'dropdown', 'number', 'textarea'])
  type: 'text' | 'dropdown' | 'number' | 'textarea';

  @IsBoolean()
  required: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  options?: string[];
}

export class FaqEntryDto {
  @IsString()
  @Length(3, 200)
  q: string;

  @IsString()
  @Length(3, 1000)
  a: string;
}

// Cross-field rules (item listings need priceWaveCoin, service listings need requirementsSchema,
// etc.) are enforced imperatively in ListingsService.createDraft, not here with @ValidateIf — with
// two listing types sharing one DTO, decorator-based conditional validation gets hard to read
// quickly; a straight-line check in the service is clearer for a two-way branch like this one.
export class CreateListingDto {
  @IsIn([ListingType.Service, ListingType.Item, ListingType.DigitalKey])
  type: ListingType;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsString()
  @Length(5, 100)
  title: string;

  @IsString()
  @Length(50, 5000)
  description: string;

  // Item-type only
  @IsOptional()
  @IsInt()
  @Min(1)
  priceWaveCoin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  stockQuantity?: number;

  @IsOptional()
  @IsBoolean()
  isUnique?: boolean;

  // DigitalKey-type only — must be exactly `true` (checked imperatively in
  // ListingsService#createDraft, same reasoning as the rest of this DTO's cross-field validation).
  // The seller's confirmation of legal resale rights, per LAUNCH_PLAN.md §2d.
  @IsOptional()
  @IsBoolean()
  resaleRightsAttested?: boolean;

  // Item-type only — the seller-entered account/skin details (see IsItemAttributes for the limits).
  @IsOptional()
  @IsItemAttributes()
  attributes?: Record<string, string | number | boolean>;

  // Service-type only
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RequirementFieldDto)
  requirementsSchema?: RequirementFieldDto[];

  // Service-type only
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FaqEntryDto)
  faq?: FaqEntryDto[];
}
