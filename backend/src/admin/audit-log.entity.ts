import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

// One row per admin mutation — the non-negotiable rule from SPECIFICATION.md §4.3. `adminRole` is
// a snapshot of the role at the time of the action (not a live join to `users.adminRole`) so a
// later role change never rewrites history. `action` is a short dotted string ("listing.approve",
// "review.hide", "dispute.resolve") — see admin-audit.service.ts for the values actually in use.
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  adminId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'adminId' })
  admin: User;

  @Column()
  adminRole: string;

  @Column()
  action: string;

  @Column()
  entityType: string;

  @Column()
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
