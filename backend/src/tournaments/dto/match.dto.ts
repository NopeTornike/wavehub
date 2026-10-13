import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TournamentMatchStage, TournamentMatchStatus } from '@wavehub/shared-types';

export class MatchPlayerStatDto {
  @IsString()
  @Length(1, 30)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  kills?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  kd?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  damage?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rating?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  assists?: number | null;

  @IsOptional()
  @IsBoolean()
  mvp?: boolean;
}

export class MatchTeamStatsDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  coach?: string | null;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MatchPlayerStatDto)
  players: MatchPlayerStatDto[];
}

export class MatchStatsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => MatchTeamStatsDto)
  a?: MatchTeamStatsDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => MatchTeamStatsDto)
  b?: MatchTeamStatsDto | null;
}

// Create and update share one shape; on update every field is optional (a partial update), and
// `null` clears a nullable field.
export class MatchDto {
  @IsOptional()
  @IsEnum(TournamentMatchStage)
  stage?: TournamentMatchStage;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  groupName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  roundLabel?: string | null;

  @IsOptional()
  @IsUUID()
  teamAId?: string | null;

  @IsOptional()
  @IsUUID()
  teamBId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  map?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  bestOf?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;

  @IsOptional()
  @IsEnum(TournamentMatchStatus)
  status?: TournamentMatchStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  scoreA?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  scoreB?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => MatchStatsDto)
  stats?: MatchStatsDto;
}
