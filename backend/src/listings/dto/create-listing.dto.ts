import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min, ValidateNested } from 'class-validator';
import { ListingType } from '@wavehub/shared-types';

export class RequirementFieldDto {
  @IsString()
  key: string;

  @IsString()
  label: string;

  @IsIn(['text', 'dropdown', 'number', 'textarea'])
  type: 'text' | 'dropdown' | 'number' | 'textarea';

  @IsBoolean()
  required: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

// Cross-field rules (item listings need priceWaveCoin, service listings need requirementsSchema,
// etc.) are enforced imperatively in ListingsService.createDraft, not here with @ValidateIf — with
// two listing types sharing one DTO, decorator-based conditional validation gets hard to read
// quickly; a straight-line check in the service is clearer for a two-way branch like this one.
export class CreateListingDto {
  @IsIn([ListingType.Service, ListingType.Item])
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

  // Service-type only
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequirementFieldDto)
  requirementsSchema?: RequirementFieldDto[];
}
