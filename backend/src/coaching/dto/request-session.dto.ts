import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const ALLOWED_DURATIONS = [30, 60, 90, 120];

export class RequestSessionDto {
  @IsDateString()
  scheduledAt: string;

  @IsIn(ALLOWED_DURATIONS)
  durationMinutes: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  buyerMessage?: string;
}
