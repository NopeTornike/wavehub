import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ConversationType } from '@wavehub/shared-types';
import { Order } from '../orders/order.entity';

// Order-scoped chat only for now (build-plan Phase 6's "narrow scope first") — `orderId` is
// required and unique (one conversation per order), auto-created by OrdersService.purchase.
// `ConversationType.Direct` exists in the shared enum for a future non-order chat feature; nothing
// creates one yet, so don't assume `orderId` can be null anywhere in this module.
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', default: ConversationType.Order })
  type: ConversationType;

  @Column({ unique: true })
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  buyerId: string;

  @Column()
  sellerId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
