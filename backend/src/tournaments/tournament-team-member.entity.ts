import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { TournamentTeam } from './tournament-team.entity';
import { Tournament } from './tournament.entity';
import { User } from '../users/user.entity';

// One row per player on a team, linked to a real WaveHub account (the captain adds teammates by
// username or account id). `(tournamentId, userId)` is unique: a player is on at most one team per
// tournament — the DB backstop for the service-level check. `inGameId` is only shown to tournament
// staff and the team itself, never on the public Teams tab.
@Entity('tournament_team_members')
@Unique('UQ_tournament_team_members_user', ['tournamentId', 'userId'])
export class TournamentTeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  teamId: string;

  @ManyToOne(() => TournamentTeam, (team) => team.roster, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team: TournamentTeam;

  @Column()
  tournamentId: string;

  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 30 })
  inGameName: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  inGameId: string | null;

  @Column({ type: 'int', default: 0 })
  position: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
