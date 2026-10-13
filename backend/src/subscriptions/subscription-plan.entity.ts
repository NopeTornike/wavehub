import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { SubscriptionAudience, SubscriptionPerks } from '@wavehub/shared-types';

// Both subscription products (Buyer Membership, Seller/Coach Visibility) share this one table,
// distinguished by `audience` — see LAUNCH_PLAN.md §3a and backend/src/subscriptions/CLAUDE.md.
// `perks` is a jsonb bag (§3b) rather than one column per perk, so a new perk never needs a
// migration — see SubscriptionPerks in @wavehub/shared-types for the keys modules actually read.
@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  audience: SubscriptionAudience;

  // Free text, not an enum — "basic"/"pro"/"elite" today, but a new tier name shouldn't need a
  // migration either (only the enum-backed `audience` axis is structurally fixed).
  @Column()
  tier: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  // Integer GEL, same "always an integer, never a float" money discipline as WaveCoin amounts
  // elsewhere in this codebase (see backend/src/wallet/CLAUDE.md) — matches the existing BOG
  // top-up flow's own `amountGel: @IsInt()` convention (backend/src/payments/).
  @Column({ type: 'integer' })
  priceGel: number;

  // Almost always 30 (monthly), but not hardcoded — see backend/src/subscriptions/CLAUDE.md for
  // why this can't currently be changed on an existing subscriber's next renewal (BOG's
  // background-recharge call always recharges the parent order's original amount and this app
  // computes the next period purely by adding this many days, so changing it only affects
  // subscriptions created after the change).
  @Column({ type: 'integer', default: 30 })
  billingPeriodDays: number;

  @Column({ type: 'jsonb', default: {} })
  perks: SubscriptionPerks;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  // Soft-disable, not a delete — an inactive plan stops appearing in the public browse list and
  // can't be newly subscribed to, but existing UserSubscription rows referencing it keep working
  // (their perks keep applying until they cancel/expire) — same "don't strand active state on a
  // hard delete" principle as Listing's own draft/paused/active axis.
  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
