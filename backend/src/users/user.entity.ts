import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { AdminRole, UserStatus } from '@wavehub/shared-types';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ default: 'buyer' })
  role: 'buyer' | 'seller';

  @Column({ type: 'varchar', default: UserStatus.PendingVerification })
  status: UserStatus;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  // Buyer-spendable balance. Never write to this column directly — every change must go through
  // WalletService so a matching wallet_ledger_entries row is written in the same transaction. See
  // backend/src/wallet/CLAUDE.md.
  @Column({ type: 'integer', default: 0 })
  wavecoinBalance: number;

  // Seller-level rating aggregate — meaningless for a user with no listings, only ever populated
  // for sellers in practice. Lives here as a pragmatic stopgap (there's no `seller_profiles` table
  // yet — see build-plan schema notes); move it there if/when that table gets built rather than
  // adding a second copy. Recomputed by ReviewsService, never edited directly.
  @Column({ type: 'numeric', precision: 3, scale: 2, nullable: true })
  sellerRatingAvg: string | null;

  @Column({ type: 'integer', default: 0 })
  sellerRatingCount: number;

  // Null for every ordinary buyer/seller — only set for staff accounts. Lives directly on `User`
  // as a pragmatic stopgap (same precedent as `wavecoinBalance`/`sellerRatingAvg` above), not a
  // separate `staff` table — SPECIFICATION.md §5.13.7 flagged the separate-table question as
  // genuinely open (unanswered by the client) rather than silently resolving it; revisit if staff
  // accounts ever need fields that don't make sense on a buyer/seller row. Never write to this
  // directly outside an admin-account-management flow (none exists yet — there's no way to grant
  // this role via the API today, only a direct DB update).
  @Column({ type: 'varchar', nullable: true })
  adminRole: AdminRole | null;
}
