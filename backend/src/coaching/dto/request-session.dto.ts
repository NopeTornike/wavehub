import { IsDateString, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

const ALLOWED_DURATIONS = [30, 60, 90, 120];

// Either an hourly booking (`durationMinutes`) or one of the coach's packages (`packageId`, whose
// own duration and price apply). `answers` are checked against the coach's booking questions.
export class RequestSessionDto {
  @IsDateString()
  scheduledAt: string;

  @ValidateIf((o: RequestSessionDto) => !o.packageId)
  @IsIn(ALLOWED_DURATIONS)
  durationMinutes?: number;

  @IsOptional()
  @IsUUID()
  packageId?: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  buyerMessage?: string;
}
