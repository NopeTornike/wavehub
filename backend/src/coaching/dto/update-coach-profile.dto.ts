import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export const COACH_VIDEO_URL = /^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\/\S+$/;

// A verified (or pending) coach editing their own profile (docs/design-mockups/14). Every field is
// optional; `null` clears the nullable ones. Rate changes only affect sessions booked afterwards
// (a session snapshots its price).
export class UpdateCoachProfileDto {
  @IsOptional()
  @IsUUID()
  gameId?: string | null;

  @IsOptional()
  @IsString()
  @Length(3, 200)
  specialty?: string;

  @IsOptional()
  @IsString()
  @Length(20, 3000)
  bio?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @Matches(/^[a-z]{2}$/, { each: true, message: 'Languages must be two-letter codes' })
  languages?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  hourlyRateWaveCoin?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  rank?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(COACH_VIDEO_URL, { message: 'The video must be a YouTube or Vimeo link' })
  videoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  quote?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @Length(2, 60, { each: true })
  coachingStyle?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID('4', { each: true })
  extraGameIds?: string[];
}
