import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

// A squad registration by its captain. `members` are the players' in-game names (the captain's
// included); the service checks there are exactly `teamSize` of them.
export class RegisterTeamDto {
  @IsString()
  @Length(2, 30)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{1,6}$/, { message: 'Tag must be 1–6 letters or digits' })
  tag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  coachName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 30, { each: true })
  members: string[];
}
