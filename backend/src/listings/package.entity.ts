import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Listing } from './listing.entity';

// Child of a `service`-type listing only (item listings price themselves directly, see
// listing.entity.ts). `tier` is free text, not a hard Basic/Standard/Premium enum — the spec shows
// that as the common pattern, not a rule; sellers can name packages however they want.
@Entity('packages')
export class Package {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  listingId: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  @Column()
  name: string;

  @Column({ type: 'integer' })
  priceWaveCoin: number;

  @Column({ type: 'integer' })
  deliveryTimeDays: number;

  @Column({ type: 'text', array: true, default: '{}' })
  features: string[];

  @Column({ type: 'integer', default: 0 })
  revisionsIncluded: number;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;
}
