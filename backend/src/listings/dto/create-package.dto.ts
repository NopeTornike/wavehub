import { IsArray, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreatePackageDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsInt()
  @Min(1)
  priceWaveCoin: number;

  @IsInt()
  @Min(1)
  deliveryTimeDays: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  revisionsIncluded?: number;
}
