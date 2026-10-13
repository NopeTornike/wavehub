import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { BadgeKey } from '@wavehub/shared-types';
import { User } from '../users/user.entity';

// One badge a user holds. Unique per (user, badge): the spec's "no duplicates" rule. `source` says
// what granted it — a system trigger, a staff member, or the user's coach — and `grantedById` who.
@Entity('user_badges')
@Unique('UQ_user_badges_user_key', ['userId', 'badgeKey'])
export class UserBadge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 40 })
  badgeKey: BadgeKey;

  @Column({ type: 'varchar', length: 10 })
  source: 'system' | 'admin' | 'coach';

  @Column({ type: 'uuid', nullable: true })
  grantedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'grantedById' })
  grantedBy: User | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  grantedAt: Date;
}
