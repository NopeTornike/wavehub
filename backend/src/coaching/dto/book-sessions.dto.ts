import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsObject, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, ValidateIf } from 'class-validator';

// POST coaches/:id/bookings — the 6-step booking flow (frontend /coaching/[id]/book). A single
// session (durationMinutes at the hourly rate) or a coach package (its sessionsCount slots).
export class BookSessionsDto {
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @ValidateIf((o: BookSessionsDto) => !o.packageId)
  @IsIn([30, 60, 90, 120])
  durationMinutes?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsDateString({}, { each: true })
  slots: string[];

  // Step 3: what the student wants from the sessions (required) …
  @IsString()
  @Length(5, 500)
  goal: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  challenges?: string;

  // … and the Discord username the coach adds them with (where the session takes place).
  @IsString()
  @Length(2, 40)
  @Matches(/^[\w.#-]+$/u, { message: 'Discord username may contain letters, digits, ., _, -, #' })
  discord: string;

  // Answers to the coach's own pre-booking questions.
  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
}
