import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

// One tier of a service listing (e.g. Basic / Standard / Premium). A service has 1–5 of them —
// the count cap and the "back to review" rule live in ListingsService#addPackage.
export class CreatePackageDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  priceWaveCoin: number;

  @IsInt()
  @Min(1)
  @Max(90)
  deliveryTimeDays: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  features?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  revisionsIncluded?: number;
}
