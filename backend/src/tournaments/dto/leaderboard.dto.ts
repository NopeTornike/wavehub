import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

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

  @IsInt()
  @Min(0)
  @Max(1000000)
  wins: number;

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

export class LeaderboardVisibilityDto {
  @IsBoolean()
  visible: boolean;
}
