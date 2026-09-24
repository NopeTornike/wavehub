import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';
import { TournamentStatus } from '@wavehub/shared-types';
import { IsItemAttributes } from '../../listings/dto/item-attributes.validator';

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

  // Keys from TOURNAMENT_DETAIL_KEYS (shared-types); flat short strings, validated like item attributes.
  @IsOptional()
  @IsItemAttributes()
  details?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  rules?: string;
}
