import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

// Staff edit of one platform package (PATCH admin/coaching-packages/:id). Bounds mirror the DB CHECKs.
export class UpdateCoachingPackageDto {
  @IsOptional()
  @IsString()
  @Length(2, 60)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  sessionsCount?: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  priceWaveCoin?: number;

  @IsOptional()
  @IsString()
  @Length(2, 300)
  tagline?: string;

  @IsOptional()
  @IsString()
  @Length(2, 600)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(2, 200, { each: true })
  features?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
