import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Listing } from './listing.entity';

// 1:1 extension of `listings` where `type = 'item'`. Deliberately a flexible jsonb attribute bag
// (`attributes`) rather than normalized columns — item listings (accounts/skins/currency bundles)
// vary wildly in what's relevant (rank, skin list, level, server...) and there's no fixed spec for
// this listing type yet (unlike service listings' well-specified requirements form). Don't
// over-normalize this ahead of a real product decision on what item listings actually need.
@Entity('item_details')
export class ItemDetails {
  @PrimaryColumn()
  listingId: string;

  @OneToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  @Column({ type: 'jsonb', default: {} })
  attributes: Record<string, unknown>;

  // true = buying this listing decrements/removes it from availability (typical for a one-of-a-kind
  // account/skin sale); false = a restockable/quantity-based item, governed by
  // `listings.stockQuantity` instead.
  @Column({ default: true })
  isUnique: boolean;
}
