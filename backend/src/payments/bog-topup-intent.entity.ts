import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

// Created when a user starts a WaveCoin top-up checkout, before BOG confirms anything. Exists
// because BOG's callback identifies the transaction by `external_order_id` only — without this
// table, the callback handler would have no way to know which user/how-many-WaveCoin a given
// order_id corresponds to. See backend/src/payments/CLAUDE.md.
@Entity('bog_topup_intents')
export class BogTopupIntent {
  // The transactionId we generate and send to BOG as external_order_id — also our primary key,
  // since it's already guaranteed unique per the controller's DTO validation.
  @PrimaryColumn()
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'integer' })
  amountGel: number;

  @Column({ type: 'integer' })
  wavecoins: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'completed' | 'failed';

  // The bogOrderId BOG returns from create-order — useful for manual reconciliation/support.
  @Column({ type: 'varchar', nullable: true })
  bogOrderId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
