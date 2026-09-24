import { IsEnum } from 'class-validator';
import { TournamentTeamStatus } from '@wavehub/shared-types';

export class TeamStatusDto {
  @IsEnum(TournamentTeamStatus)
  status: TournamentTeamStatus;
}
