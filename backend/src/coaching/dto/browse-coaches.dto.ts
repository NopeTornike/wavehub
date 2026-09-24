import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsIn, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

export const COACH_SORTS = ['rating', 'price_asc', 'price_desc', 'reviews'] as const;
export type CoachSort = (typeof COACH_SORTS)[number];

export class BrowseCoachesDto {
  @IsOptional()
  @IsUUID()
  gameId?: string;

  // coaching.html's "Game" checkbox filter — any of these games (comma-separated in the query).
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  gameIds?: string[];

  // "Price Range" — hourly rate at most this many WaveCoin.
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxRate?: number;

  // "Language" — a two-letter code the coach listed (coaches store e.g. `ka`, `en`, `ru`).
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @Matches(/^[a-z]{2}$/)
  language?: string;

  @IsOptional()
  @IsIn(COACH_SORTS)
  sort?: CoachSort;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
