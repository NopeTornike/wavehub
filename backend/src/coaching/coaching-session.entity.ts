import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CoachingSessionStatus } from '@wavehub/shared-types';
import { Coach } from './coach.entity';
import { User } from '../users/user.entity';

// A booked, paid coaching session — see coaching-session-lifecycle.ts for the status graph and
// CLAUDE.md for why this is deliberately simpler than the static prototype's booking mock (no
// availability calendar, no coach accept/decline step).
@Entity('coaching_sessions')
export class CoachingSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  coachId: string;

  @ManyToOne(() => Coach)
  @JoinColumn({ name: 'coachId' })
  coach: Coach;

  @Column()
  buyerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @Column({ type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ type: 'integer' })
  durationMinutes: number;

  // Price/fee snapshots, same "never re-derive from a live rate" principle as Order — a later
  // change to the coach's hourlyRateWaveCoin or the platform fee percent never retroactively
  // changes an already-booked session's math.
  @Column({ type: 'integer' })
  priceWaveCoin: number;

  @Column({ type: 'integer' })
  platformFeePercentSnapshot: number;

  @Column({ type: 'integer' })
  platformFeeWaveCoin: number;

  @Column({ type: 'integer' })
  coachPayoutWaveCoin: number;

  @Column({ type: 'text', nullable: true })
  buyerMessage: string | null;

  @Column({ type: 'varchar', default: CoachingSessionStatus.Scheduled })
  status: CoachingSessionStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
