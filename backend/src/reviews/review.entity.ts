import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ReviewStatus } from '@wavehub/shared-types';
import { Order } from '../orders/order.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';

// One review per completed order — enforced by the UNIQUE constraint on orderId at the DB level
// (see the migration), not just app-layer checks, per ReviewsService's own convention of trusting
// the database for invariants that money/integrity depend on.
@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  // Denormalized from the order at review time, purely so per-listing review queries don't need to
  // join through orders — never a second source of truth, always copied from order.listingId.
  @Column()
  listingId: string;

  @ManyToOne(() => Listing)
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  @Column()
  buyerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @Column()
  sellerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'varchar', default: ReviewStatus.Published })
  status: ReviewStatus;

  // Exactly one reply per review, set once — see ReviewsService.reply.
  @Column({ type: 'text', nullable: true })
  sellerReply: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sellerRepliedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
