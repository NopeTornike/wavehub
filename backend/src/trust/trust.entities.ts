import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { ReportReason, ReportStatus, ReportTargetType } from '@wavehub/shared-types';
import { User } from '../users/user.entity';

// A user's report of another user / listing / coach / review / direct message (trust/CLAUDE.md).
@Entity('user_reports')
export class UserReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @Column({ type: 'varchar', length: 20 })
  targetType: ReportTargetType;

  @Column({ type: 'uuid' })
  targetId: string;

  // The account behind the target (listing seller, coach, review author, message sender).
  @Column({ type: 'uuid', nullable: true })
  targetUserId: string | null;

  @Column({ type: 'varchar', length: 20 })
  reason: ReportReason;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  details: string | null;

  // Copy of the reported text (message / review) at report time.
  @Column({ type: 'varchar', length: 2000, nullable: true })
  evidence: string | null;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: ReportStatus;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  staffNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  handledBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  handledAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

// Staff timeline on an account: internal notes, warnings sent, watchlist on/off.
@Entity('user_staff_notes')
export class UserStaffNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'varchar', length: 10 })
  kind: 'note' | 'warning' | 'flag' | 'unflag';

  @Column({ type: 'varchar', length: 1000 })
  body: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

// Login history for multi-account detection. Only keyed hashes of the IP and user agent are
// stored (HMAC — see trust/login-hash.ts), never the raw values; rows older than 90 days are
// deleted by TrustService's daily cleanup.
@Entity('login_events')
@Index('IDX_login_events_user', ['userId', 'createdAt'])
@Index('IDX_login_events_ip', ['ipHash', 'createdAt'])
export class LoginEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  ipHash: string;

  @Column({ type: 'varchar', length: 64 })
  uaHash: string;

  @Column({ type: 'boolean' })
  success: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
