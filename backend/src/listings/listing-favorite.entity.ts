import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Listing } from './listing.entity';
import { User } from '../users/user.entity';

// A user's saved listing (the prototype's ♡ / "Favorites"). Composite primary key = one row per
// (user, listing), so saving twice is idempotent at the database level. Both sides cascade: a
// deleted account or listing takes its favourites with it.
@Entity('listing_favorites')
@Index('IDX_listing_favorites_listing', ['listingId'])
export class ListingFavorite {
  @PrimaryColumn('uuid')
  userId: string;

  @PrimaryColumn('uuid')
  listingId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
