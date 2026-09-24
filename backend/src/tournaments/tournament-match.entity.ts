import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TournamentMatchStage, TournamentMatchStatus } from '@wavehub/shared-types';
import type { MatchTeamStats } from '@wavehub/shared-types';
import { Tournament } from './tournament.entity';
import { TournamentTeam } from './tournament-team.entity';

// Admin-entered match (match history, match details, hub bracket). Nothing is simulated: scores and
// per-player stats are whatever tournament staff record after the match is played.
@Entity('tournament_matches')
export class TournamentMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tournamentId: string;

  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  @Column({ type: 'varchar', default: TournamentMatchStage.Group })
  stage: TournamentMatchStage;

  @Column({ type: 'varchar', length: 10, nullable: true })
  groupName: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  roundLabel: string | null;

  @Column({ type: 'uuid', nullable: true })
  teamAId: string | null;

  @ManyToOne(() => TournamentTeam, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'teamAId' })
  teamA: TournamentTeam | null;

  @Column({ type: 'uuid', nullable: true })
  teamBId: string | null;

  @ManyToOne(() => TournamentTeam, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'teamBId' })
  teamB: TournamentTeam | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  map: string | null;

  @Column({ type: 'integer', default: 1 })
  bestOf: number;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'varchar', default: TournamentMatchStatus.Scheduled })
  status: TournamentMatchStatus;

  @Column({ type: 'integer', nullable: true })
  scoreA: number | null;

  @Column({ type: 'integer', nullable: true })
  scoreB: number | null;

  @Column({ type: 'jsonb', default: {} })
  stats: { a?: MatchTeamStats | null; b?: MatchTeamStats | null };

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
