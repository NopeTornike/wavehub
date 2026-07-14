import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ListingStatus, ListingType } from '@wavehub/shared-types';
import { User } from '../users/user.entity';
import { Category } from './category.entity';
import { Game } from './game.entity';

// The shared base for both listing types (locked product decision — see root CLAUDE.md). A
// `service` listing prices via child `packages` rows; an `item` listing prices itself directly via
// `price`/`stockQuantity`. See CLAUDE.md in this directory for the full split and why it's modeled
// this way instead of two separate tables.
@Entity('listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sellerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column()
  categoryId: string;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  // Nullable: an item listing isn't necessarily tied to one specific game (e.g. a generic
  // currency bundle), though most listings will set this.
  @Column({ type: 'uuid', nullable: true })
  gameId: string | null;

  @ManyToOne(() => Game, { nullable: true })
  @JoinColumn({ name: 'gameId' })
  game: Game | null;

  @Column({ type: 'varchar' })
  type: ListingType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', default: ListingStatus.Draft })
  status: ListingStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'integer', default: 0 })
  viewsCount: number;

  @Column({ type: 'integer', default: 0 })
  ordersCount: number;

  @Column({ default: false })
  isFeatured: boolean;

  // Item-type pricing only — service-type listings price via `packages` and leave these null.
  @Column({ type: 'integer', nullable: true })
  priceWaveCoin: number | null;

  @Column({ type: 'integer', nullable: true })
  stockQuantity: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
