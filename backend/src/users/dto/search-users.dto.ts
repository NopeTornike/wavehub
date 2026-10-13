import { IsString, Length } from 'class-validator';

// GET users/search?q= — public username search (topbar / marketplace search).
export class SearchUsersDto {
  @IsString()
  @Length(2, 40)
  q: string;
}
