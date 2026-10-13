import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Length, Matches, MaxLength, ValidateNested } from 'class-validator';

// In-game player ids: letters, digits and the separators games use (#, -, _, ., :, space — e.g.
// Riot "Name#TAG", Steam "STEAM_0:1:4242").
const IN_GAME_ID = /^[\p{L}\p{N}#_.:\- ]+$/u;

// What every registration asks for each player: their in-game name and in-game player id.
export class PlayerFieldsDto {
  @IsString()
  @Length(1, 30)
  inGameName: string;

  @IsString()
  @Length(2, 40)
  @Matches(IN_GAME_ID, { message: 'In-game ID may contain letters, digits, #, -, _, ., : and spaces' })
  inGameId: string;
}

// A Discord contact: an invite link (discord.gg/…, discord.com/invite/…) or a Discord username.
export const DISCORD_CONTACT = /^(https:\/\/(discord\.gg|(www\.)?discord\.com\/invite)\/[A-Za-z0-9-]{2,40}|[a-z0-9_.]{2,32})$/;

// Solo tournaments (teamSize 1).
export class RegisterSoloDto extends PlayerFieldsDto {
  // Client feedback #6: staff reach registrants on Discord.
  @IsString()
  @Matches(DISCORD_CONTACT, { message: 'Enter a Discord invite link (https://discord.gg/…) or a Discord username' })
  discord: string;
}

// One teammate: a WaveHub account (username or account id) plus their in-game fields.
export class TeamPlayerDto extends PlayerFieldsDto {
  @IsString()
  @Length(2, 60)
  player: string;
}

// A squad registration by its captain: exactly `teamSize` players, the captain included (the
// service checks the count, that every account exists and is active, and that nobody is on
// another team in this tournament).
export class RegisterTeamDto {
  @IsString()
  @Length(2, 30)
  name: string;

  // The team's Discord (invite link or the captain's username) — client feedback #6.
  @IsString()
  @Matches(DISCORD_CONTACT, { message: 'Enter a Discord invite link (https://discord.gg/…) or a Discord username' })
  discord: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{1,6}$/, { message: 'Tag must be 1–6 letters or digits' })
  tag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  coachName?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TeamPlayerDto)
  players: TeamPlayerDto[];
}
