import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DisputeStatus, DisputeResolution } from '@wavehub/shared-types';
import { Order } from '../orders/order.entity';

// One dispute per order — enforced by the UNIQUE constraint on `orderId` (see the migration), not
// just app-layer checks, same discipline as backend/src/reviews/review.entity.ts's orderId
// constraint. `buyerId`/`sellerId` are denormalized from the order at open time purely so
// dispute-list queries don't need to join through orders — never a second source of truth.
@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  buyerId: string;

  @Column()
  sellerId: string;

  // Whoever opened it — either the buyer or the seller, never a third party.
  @Column()
  openedBy: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', default: DisputeStatus.Open })
  status: DisputeStatus;

  // Set together at resolution time — see disputes.service.ts#resolve. All three stay null until
  // then.
  @Column({ type: 'varchar', nullable: true })
  resolution: DisputeResolution | null;

  @Column({ type: 'text', nullable: true })
  resolutionNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
