import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

// Admin game catalogue (games.service.ts). The slug is set once: lowercase words joined by '-'.
export const GAME_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateGameDto {
  @IsString()
  @Length(2, 40)
  name: string;

  @IsString()
  @Length(2, 40)
  @Matches(GAME_SLUG, { message: 'slug must be lowercase letters/digits joined by hyphens' })
  slug: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class UpdateGameDto {
  @IsOptional()
  @IsString()
  @Length(2, 40)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  // "Open <game>" link for tournament players: https only; null / '' clears it.
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  @MaxLength(500)
  @Matches(/^https:\/\/[^\s<>"']+$/, { message: 'Launch link: an https:// address' })
  launchUrl?: string | null;
}
