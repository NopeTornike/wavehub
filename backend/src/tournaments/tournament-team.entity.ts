import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Unique } from 'typeorm';
import { TournamentTeamStatus } from '@wavehub/shared-types';
import { Tournament } from './tournament.entity';
import { User } from '../users/user.entity';
import { TournamentTeamMember } from './tournament-team-member.entity';

// Every tournament registration is a team (the design's Teams tab). A solo tournament's team is the
// one registering player, auto-verified; a squad team is registered by its captain with the
// members' WaveHub accounts + in-game names and starts Pending until tournament staff verify it. The captain's
// `tournament_registrations` row points here (ON DELETE CASCADE), so "my tournaments" stays one query.
@Entity('tournament_teams')
@Unique(['tournamentId', 'captainUserId'])
export class TournamentTeam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tournamentId: string;

  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  @Column()
  captainUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'captainUserId' })
  captain: User;

  @Column({ length: 30 })
  name: string;

  @Column({ type: 'varchar', length: 6, nullable: true })
  tag: string | null;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  coachName: string | null;

  // Discord invite link or username (client feedback #6) — staff and the team only.
  @Column({ type: 'varchar', length: 120, nullable: true })
  discord: string | null;

  // In-game names in roster order (kept alongside `roster` for match stats and the player count).
  @Column({ type: 'jsonb', default: [] })
  members: string[];

  // The linked WaveHub accounts (registrations since 2026-10-01; older squads have names only).
  @OneToMany(() => TournamentTeamMember, (member) => member.team)
  roster?: TournamentTeamMember[];

  @Column({ type: 'varchar', default: TournamentTeamStatus.Pending })
  status: TournamentTeamStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
