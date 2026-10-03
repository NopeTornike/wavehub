import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { SessionDisputeResolution } from '@wavehub/shared-types';
import { CoachingSession } from './coaching-session.entity';
import { User } from '../users/user.entity';

// A dispute on one coaching session (coaching/CLAUDE.md "Session disputes"). One per session; the
// session sits in `disputed` until a Super Admin refunds the student or pays the coach.
@Entity('coaching_session_disputes')
export class CoachingSessionDispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  sessionId: string;

  @ManyToOne(() => CoachingSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: CoachingSession;

  @Column()
  openedBy: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'openedBy' })
  opener: User;

  @Column({ type: 'varchar', length: 1000 })
  reason: string;

  @Column({ type: 'varchar', default: 'open' })
  status: 'open' | 'resolved';

  @Column({ type: 'varchar', nullable: true })
  resolution: SessionDisputeResolution | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  resolutionNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

// The dispute thread: participants and staff, text and/or one evidence file per message.
@Entity('coaching_session_dispute_messages')
export class CoachingSessionDisputeMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @ManyToOne(() => CoachingSessionDispute, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: CoachingSessionDispute;

  @Column()
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ type: 'boolean', default: false })
  isStaff: boolean;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  fileUrl: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fileType: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
