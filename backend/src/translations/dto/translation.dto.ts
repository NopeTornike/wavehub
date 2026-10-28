import { IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

export class UpsertTranslationDto {
  @IsString()
  @Length(1, 2000)
  key: string;

  // null / '' = use the built-in text for that language.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(4000)
  en?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(4000)
  ka?: string | null;
}
