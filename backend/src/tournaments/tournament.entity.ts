import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TournamentStatus } from '@wavehub/shared-types';
import { Game } from '../listings/game.entity';

// Admin-managed tournament announcements — see CLAUDE.md for the deliberate scope cut (no
// automated bracket/matchmaking/prize-payout, just post + register).
@Entity('tournaments')
export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  gameId: string;

  @ManyToOne(() => Game)
  @JoinColumn({ name: 'gameId' })
  game: Game;

  @Column({ length: 70 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  // Free text, not a structured amount — matches the static prototype's own flexible "5,000 GEL"
  // field. WaveHub doesn't automate tournament prize payouts (see Status); an admin who wants to
  // actually pay a winner does it through the existing withdrawal/admin-adjustment tooling.
  @Column({ length: 60 })
  prize: string;

  @Column({ type: 'varchar', default: TournamentStatus.Upcoming })
  status: TournamentStatus;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'integer', default: 64 })
  maxPlayers: number;

  @Column({ type: 'varchar', nullable: true })
  coverImageUrl: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
