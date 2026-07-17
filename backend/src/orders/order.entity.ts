import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ListingType, OrderStatus } from '@wavehub/shared-types';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { Package } from '../listings/package.entity';

// The structural core everything else (reviews, disputes, seller payouts) hangs off. Every field
// that reflects "what was agreed at purchase time" is a snapshot, taken once at creation and never
// re-derived from the live listing/package afterward — see CLAUDE.md for why (a seller editing
// their price tomorrow must not change what a buyer already paid today).
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Human-facing id, e.g. "WH-000123" — generated from a DB sequence in OrdersService, not this
  // entity (TypeORM default value expressions don't compose well with formatted-string sequences).
  @Column({ unique: true })
  orderNumber: string;

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

  @Column()
  listingId: string;

  @ManyToOne(() => Listing)
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  // Null for item-type orders — item listings don't have packages.
  @Column({ type: 'uuid', nullable: true })
  packageId: string | null;

  @ManyToOne(() => Package, { nullable: true })
  @JoinColumn({ name: 'packageId' })
  package: Package | null;

  // Snapshot of `listing.type` at purchase time — the listing itself can't change type after
  // orders exist against it, but snapshotting keeps this order's meaning fixed regardless.
  @Column({ type: 'varchar' })
  listingType: ListingType;

  @Column({ type: 'varchar' })
  status: OrderStatus;

  // Buyer's filled requirements form (service orders only) — a snapshot of their answers against
  // the listing's `requirementsSchema` at the time of purchase, not a live reference.
  @Column({ type: 'jsonb', nullable: true })
  requirementsAnswers: Record<string, unknown> | null;

  // --- Price/fee snapshots — never re-read from the live listing/package after creation ---
  @Column({ type: 'integer' })
  priceWaveCoin: number;

  @Column({ type: 'integer' })
  platformFeePercentSnapshot: number;

  @Column({ type: 'integer' })
  platformFeeWaveCoin: number;

  @Column({ type: 'integer' })
  sellerPayoutWaveCoin: number;

  // --- Lifecycle timestamps ---
  // Null for item orders (no delivery SLA — see listings/CLAUDE.md on service vs item listings).
  @Column({ type: 'timestamptz', nullable: true })
  deliveryDueAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  // deliveredAt + 72h — the auto-complete cron looks for rows where this has passed and status is
  // still Delivered. Cleared (set back to null) if the buyer requests a revision.
  @Column({ type: 'timestamptz', nullable: true })
  autoCompleteAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  // Latest revision request reason only — not a full history. A full per-revision log belongs to
  // Order Chat (build-plan Phase 6) once it exists; don't build a parallel history mechanism here.
  @Column({ type: 'text', nullable: true })
  revisionReason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
