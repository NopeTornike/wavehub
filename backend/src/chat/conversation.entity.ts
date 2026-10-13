import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ConversationType } from '@wavehub/shared-types';
import { Order } from '../orders/order.entity';

// Two conversation shapes share this one table. `type: Order` rows: `orderId` is set and unique
// (one conversation per order), auto-created by OrdersService.purchase, `buyerId`/`sellerId` are
// the order's real buyer/seller. `type: Direct` rows (2026-09-16): `orderId` is null — see
// ChatService#getOrCreateDirectConversation — and `buyerId`/`sellerId` just record who started the
// conversation vs. who they messaged; they are NOT semantic roles for a Direct row (don't read
// "buyerId" as "the buyer" outside an Order context) — always resolve "the other participant"
// relative to the viewer instead, never assume one column is "me". A partial unique index
// (`UQ_direct_conversation_pair`, see the EnableDirectConversations migration) enforces at most one
// Direct conversation per unordered user pair, keyed on `LEAST`/`GREATEST(buyerId, sellerId)`.
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', default: ConversationType.Order })
  type: ConversationType;

  @Column({ type: 'uuid', nullable: true, unique: true })
  orderId: string | null;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;

  @Column()
  buyerId: string;

  @Column()
  sellerId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
