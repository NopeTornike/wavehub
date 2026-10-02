import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export const MAX_COACH_PACKAGES = 6;

export class CoachPackageDto {
  @IsString()
  @Length(2, 60)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  // Sessions in the package (each durationMinutes long). Defaults to 1.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  sessionsCount?: number;

  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes: number;

  @IsInt()
  @Min(1)
  @Max(100000)
  priceWaveCoin: number;
}

// PUT coaches/mine/packages (and the admin equivalent): replaces the whole list, in order.
export class SetCoachPackagesDto {
  @IsArray()
  @ArrayMaxSize(MAX_COACH_PACKAGES)
  @ValidateNested({ each: true })
  @Type(() => CoachPackageDto)
  packages: CoachPackageDto[];
}
