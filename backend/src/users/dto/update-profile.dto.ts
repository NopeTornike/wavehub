import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

// PATCH /me/profile — the prototype's Settings form. Username is not editable (it's the public
// handle and the login name).
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  // "Main games — choose at most 2" (ids from GET /games).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsUUID('4', { each: true })
  mainGameIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  preferredRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  achievement?: string;
}
