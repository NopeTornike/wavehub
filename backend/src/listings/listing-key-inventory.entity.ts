import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { KeyInventoryStatus } from '@wavehub/shared-types';
import { Listing } from './listing.entity';
import { Order } from '../orders/order.entity';

// One row per Steam-key (or similar digital-activation-code) secret. `keyValueEncrypted` is
// AES-256-GCM ciphertext (see key-encryption.util.ts) — the plaintext is never stored, logged, or
// returned to anyone except the buyer who purchased it, exactly once, via
// OrdersService#getRevealedKey. `status`: `available` (unsold, claimable) / `sold` (claimed by
// `orderId`, permanent — a key is never released back to `available`) / `revoked` (seller removed
// it before sale — a soft delete, not a hard DELETE, so the row stays for audit). See
// backend/src/listings/CLAUDE.md for the `SELECT ... FOR UPDATE SKIP LOCKED` claim pattern
// `OrdersService#purchase` uses against this table.
@Entity('listing_key_inventory')
export class ListingKeyInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  listingId: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  @Column({ type: 'text' })
  keyValueEncrypted: string;

  @Column({ type: 'varchar', default: KeyInventoryStatus.Available })
  status: KeyInventoryStatus;

  @Column({ type: 'uuid', nullable: true, unique: true })
  orderId: string | null;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;

  @Column({ type: 'timestamptz', nullable: true })
  soldAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
