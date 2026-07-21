import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { CoachStatus, VerificationStatus } from '@wavehub/shared-types';
import { User } from '../users/user.entity';
import { Game } from '../listings/game.entity';

// A Coach is a structurally separate concept from Seller, not a Listing variant — see
// SPECIFICATION.md §5.13.7 and backend/src/coaching/CLAUDE.md. 1:1 with User (a user applies once;
// re-applying after rejection reuses the same row, see CoachesService#apply).
@Entity('coaches')
export class Coach {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  // Single primary game for now — reuses the existing fixed Game taxonomy rather than inventing a
  // parallel one. Real coaches often teach several games (see the static prototype's mock
  // `coaches-data.js`, which has a `games: [...]` array) — deliberately not modeled yet, see
  // CLAUDE.md Status.
  @Column({ type: 'uuid', nullable: true })
  gameId: string | null;

  @ManyToOne(() => Game, { nullable: true })
  @JoinColumn({ name: 'gameId' })
  game: Game | null;

  @Column()
  specialty: string;

  @Column({ type: 'text' })
  bio: string;

  @Column({ type: 'text', array: true, default: '{}' })
  languages: string[];

  @Column({ type: 'integer' })
  hourlyRateWaveCoin: number;

  @Column({ type: 'varchar', default: VerificationStatus.Pending })
  verificationStatus: VerificationStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  // Independent of verificationStatus — a verified coach can still be temp-suspended
  // (SPECIFICATION.md §5.13.2/.3/.4's "temp suspend, restore coaching") without losing their
  // verification, unlike a listing's single-track status.
  @Column({ type: 'varchar', default: CoachStatus.Active })
  status: CoachStatus;

  // Populated once reviews exist for coaching sessions (not built yet, see CLAUDE.md) — same
  // "pragmatic stopgap, recomputed by whichever service owns the aggregate" precedent as
  // User.sellerRatingAvg/Listing.ratingAvg.
  @Column({ type: 'numeric', precision: 3, scale: 2, nullable: true })
  ratingAvg: string | null;

  @Column({ type: 'integer', default: 0 })
  ratingCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
