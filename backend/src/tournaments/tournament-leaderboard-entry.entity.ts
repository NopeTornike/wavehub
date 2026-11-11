import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { TournamentLeaderboardKind } from '@wavehub/shared-types';
import { Game } from '../listings/game.entity';
import { User } from '../users/user.entity';

// One row of the hand-entered tournament leaderboard (owner 2026-11-10, mockup round-6/10).
// A player row links a WaveHub account (`userId`, typed as @username); a team row is a name + logo.
@Entity('tournament_leaderboard_entries')
export class TournamentLeaderboardEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  kind: TournamentLeaderboardKind;

  @Column({ type: 'uuid', nullable: true })
  gameId: string | null;

  @ManyToOne(() => Game, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'gameId' })
  game: Game | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ length: 40 })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'integer', default: 0 })
  wins: number;

  @Column({ type: 'integer', default: 0 })
  kills: number;

  @Column({ type: 'integer', default: 0 })
  points: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
