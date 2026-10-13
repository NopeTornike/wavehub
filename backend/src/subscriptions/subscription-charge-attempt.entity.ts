import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

// Mirrors backend/src/payments/bog-topup-intent.entity.ts's role exactly: created before BOG
// confirms anything, keyed by the transactionId we generate and send as `external_order_id`, so
// the callback (which only carries `external_order_id`) can map back to what it's actually for.
// One table covers both attempt kinds rather than two, since they share every column except which
// of `planId`/`subscriptionId` is set:
// - `kind: 'checkout'` — the buyer's first payment for a plan (no UserSubscription exists yet;
//   `planId` is set, `subscriptionId` is null). On a confirmed-completed callback,
//   SubscriptionsService creates the UserSubscription and saves the card.
// - `kind: 'recharge'` — a background renewal charge against an existing subscription's saved
//   card (`subscriptionId` is set, `planId` is null). On a confirmed-completed callback,
//   SubscriptionsService extends `currentPeriodEnd`.
@Entity('subscription_charge_attempts')
export class SubscriptionChargeAttempt {
  // The transactionId we generate and send to BOG as external_order_id — also our primary key.
  @PrimaryColumn()
  id: string;

  @Column({ type: 'varchar' })
  kind: 'checkout' | 'recharge';

  @Column()
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  planId: string | null;

  @Column({ type: 'uuid', nullable: true })
  subscriptionId: string | null;

  @Column({ type: 'integer' })
  amountGel: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'completed' | 'failed';

  // The bogOrderId BOG returns from order creation / the recharge call — useful for manual
  // reconciliation/support, and is what `saveCard` (checkout only) is called against.
  @Column({ type: 'varchar', nullable: true })
  bogOrderId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
