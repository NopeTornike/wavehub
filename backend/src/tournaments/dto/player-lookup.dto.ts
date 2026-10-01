import { IsString, Length } from 'class-validator';

// GET tournaments/player-lookup?q= — a WaveHub username or account id.
export class PlayerLookupDto {
  @IsString()
  @Length(2, 60)
  q: string;
}
