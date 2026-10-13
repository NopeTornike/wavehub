import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { TournamentStatus } from '@wavehub/shared-types';
import { IsItemAttributes } from '../../listings/dto/item-attributes.validator';
import { PrizesDto } from './prizes.dto';

export class CreateTournamentDto {
  @IsUUID()
  gameId: string;

  @IsString()
  @Length(3, 70)
  name: string;

  @IsString()
  @Length(10, 3000)
  description: string;

  @IsString()
  @Length(1, 60)
  prize: string;

  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @IsDateString()
  startDate: string;

  @IsInt()
  @Min(2)
  maxPlayers: number;

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
}
