import { IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class ApplyCoachDto {
  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsString()
  @Length(3, 200)
  specialty: string;

  @IsString()
  @Length(20, 3000)
  bio: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsInt()
  @Min(1)
  hourlyRateWaveCoin: number;
}
