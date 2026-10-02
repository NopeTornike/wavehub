import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CoachingSessionStatus } from '@wavehub/shared-types';
import { Coach } from './coach.entity';
import { User } from '../users/user.entity';

// A booked, paid coaching session — see coaching-session-lifecycle.ts for the status graph and
// coaching/CLAUDE.md ("Lifecycle v2") for the start/finish confirmations and the reminder sweep.
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

  // Set when booked from one of the coach's packages (name snapshotted; the id is cleared if the
  // coach later removes the package).
  @Column({ type: 'uuid', nullable: true })
  packageId: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  packageName: string | null;

  // The buyer's answers to the coach's pre-booking questions (participants only).
  @Column({ type: 'jsonb', nullable: true })
  answers: Record<string, string> | null;

  // The booking (6-step flow) this session belongs to — a multi-session package books several.
  @Column({ type: 'uuid', nullable: true })
  bookingGroupId: string | null;

  // What the student wrote in step 3 (participants only). Discord is how the session happens.
  @Column({ type: 'varchar', length: 500, nullable: true })
  goal: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  challenges: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  discord: string | null;

  // Lifecycle v2 (coaching-session-lifecycle.ts): both sides confirm the start, the coach marks it
  // done, the student confirms the end (or it auto-confirms) — only then is the coach paid.
  @Column({ type: 'timestamptz', nullable: true })
  coachStartConfirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  buyerStartConfirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  coachCompletedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastReminderAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  remindersSent: number;

  @Column({ type: 'varchar', default: CoachingSessionStatus.Scheduled })
  status: CoachingSessionStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
