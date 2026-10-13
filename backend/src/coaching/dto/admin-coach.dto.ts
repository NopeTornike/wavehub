import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

// POST admin/coaches — staff make an existing WaveHub account a verified coach (or verify the
// account's pending/rejected application with these details).
export class AdminCreateCoachDto {
  @IsString()
  @Length(2, 60)
  username: string;

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
  @ArrayMaxSize(6)
  @Matches(/^[a-z]{2}$/, { each: true, message: 'Languages must be two-letter codes' })
  languages?: string[];

  @IsInt()
  @Min(1)
  @Max(100000)
  hourlyRateWaveCoin: number;
}
