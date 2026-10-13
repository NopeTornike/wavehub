import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Listing } from './listing.entity';

@Entity('listing_images')
export class ListingImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  listingId: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  @Column()
  url: string;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  // Moderation is out of scope until the admin panel (Phase 11) — every uploaded image starts and
  // stays 'approved' for now. The column exists so that phase doesn't need a migration of its own.
  @Column({ type: 'varchar', default: 'approved' })
  moderationStatus: 'pending' | 'approved' | 'rejected';
}
