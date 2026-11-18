import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateIf } from 'class-validator';

// A hand-entered leaderboard row. `player` rows name a WaveHub account (@username or account id);
// `team` rows a display name. Numbers are what staff count off-platform.
export class LeaderboardEntryDto {
  @IsIn(['player', 'team'])
  kind: 'player' | 'team';

  @IsOptional()
  @IsUUID()
  gameId?: string | null;

  // player: the account (@username / id); team: the team name.
  @IsString()
  @Length(1, 40)
  name: string;

  // "The Tiger" — shown in quotes under the name; empty clears it.
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  @Length(1, 40)
  nickname?: string | null;

  // ISO 3166-1 alpha-2 country code ("GE"); empty clears it.
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @Matches(/^[A-Za-z]{2}$/, { message: 'Country: a 2-letter code like GE' })
  country?: string | null;

  @IsInt()
  @Min(0)
  @Max(1000000)
  wins: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  losses?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  draws?: number;

  @IsInt()
  @Min(0)
  @Max(10000000)
  kills: number;

  @IsInt()
  @Min(0)
  @Max(100000000)
  points: number;
}

export class LeaderboardQueryDto {
  @IsOptional()
  @IsUUID()
  gameId?: string;
}

// GET tournaments/ranking — the Top 10 page, one kind at a time.
export class RankingQueryDto {
  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsIn(['player', 'team'])
  kind: 'player' | 'team';
}

export class LeaderboardVisibilityDto {
  @IsBoolean()
  visible: boolean;
}
