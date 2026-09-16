import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { TournamentStatus } from '@wavehub/shared-types';

// All fields optional (a partial update) — same convention as
// backend/src/settings/dto/update-platform-settings.dto.ts.
export class UpdateTournamentDto {
  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsOptional()
  @IsString()
  @Length(3, 70)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(10, 3000)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  prize?: string;

  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  maxPlayers?: number;
}
