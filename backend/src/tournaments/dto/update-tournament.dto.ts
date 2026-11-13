import { Type } from 'class-transformer';
import { IsIn, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import type { TournamentFormat } from '@wavehub/shared-types';
import { TOURNAMENT_FORMATS, TournamentStatus } from '@wavehub/shared-types';
import { IsItemAttributes } from '../../listings/dto/item-attributes.validator';
import { PrizesDto } from './prizes.dto';

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

  // Players per team (1 = solo).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  teamSize?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PrizesDto)
  prizes?: PrizesDto;

  // Group points (owner 2026-11-10): per recorded group win / loss, and the group-exit threshold.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  pointsPerWin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  pointsPerLoss?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  qualifyPoints?: number | null;

  // Owner 2026-11-14: versus (CS2) or battle_royale (PUBG). Omitted on create = from the game
  // (PUBG Mobile / Free Fire / Fortnite are battle royale).
  @IsOptional()
  @IsIn(TOURNAMENT_FORMATS)
  format?: TournamentFormat;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16)
  groupAdvance?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32)
  semifinalAdvance?: number;
}
