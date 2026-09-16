import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { TournamentStatus } from '@wavehub/shared-types';

export class CreateTournamentDto {
  @IsUUID()
  gameId: string;

  @IsString()
  @Length(3, 70)
  name: string;

  @IsString()
  @Length(10, 3000)
  description: string;

  @IsString()
  @Length(1, 60)
  prize: string;

  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @IsDateString()
  startDate: string;

  @IsInt()
  @Min(2)
  maxPlayers: number;
}
