import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SubscriptionAudience, SubscriptionStatus } from '@wavehub/shared-types';
import { User } from '../users/user.entity';
import { SubscriptionPlan } from './subscription-plan.entity';

// A user's subscription to one plan. `audience` is snapshotted from the plan at creation time
// (not re-derived via a join) purely so the partial unique index below can enforce "at most one
// active subscription per user per audience" without a join in the index expression — same
// snapshot-don't-re-derive principle Order/CoachingSession already use for price/fee, just applied
// to a non-money field here. See the EnableSubscriptions migration for the actual index.
//
// `bogParentOrderId` is the BOG order id whose card was saved (via BogPaymentsService#saveCard) at
// checkout time — every later recharge for this subscription re-charges that same saved card via
// BOG's background/offline-payment endpoint. See backend/src/subscriptions/CLAUDE.md for the full
// BOG API shape this was researched against.
@Entity('user_subscriptions')
export class UserSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  planId: string;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;

  @Column({ type: 'varchar' })
  audience: SubscriptionAudience;

  @Column({ type: 'varchar', default: SubscriptionStatus.Active })
  status: SubscriptionStatus;

  @Column({ type: 'timestamptz' })
  currentPeriodEnd: Date;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  // NULL for a manual admin grant (no saved card): the sweep never recharges it, only expires it.
  @Column({ type: 'varchar', nullable: true })
  bogParentOrderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  grantedByAdminId: string | null;

  // Set once the "about to expire" notice went out for the current period (de-dupes the hourly sweep).
  @Column({ type: 'timestamptz', nullable: true })
  expiryNoticeSentAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
