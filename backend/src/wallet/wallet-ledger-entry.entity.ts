import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WalletLedgerStatus, WalletLedgerType } from '@wavehub/shared-types';
import { User } from '../users/user.entity';

// Single source of truth for all WaveCoin movement. Never mutate `users.wavecoinBalance` directly
// outside of WalletService — every balance change must produce a row here in the same transaction,
// or the balance and the audit trail will drift. See wallet.service.ts and CLAUDE.md in this
// directory for the invariants this table depends on.
@Entity('wallet_ledger_entries')
export class WalletLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Nullable + no FK yet: the `orders` table doesn't exist until build-plan Phase 5. Once it does,
  // add a real FK — don't leave this as a bare string forever.
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'varchar' })
  type: WalletLedgerType;

  // Signed integer — positive credits the user, negative debits. WaveCoin has no fractional unit
  // in the spec's examples, so this is a plain integer, not a decimal — don't switch to float.
  @Column({ type: 'integer' })
  amountWaveCoin: number;

  // Snapshot of the user's balance immediately after this entry was applied. Exists so historical
  // reconciliation doesn't depend solely on summing every prior row — a live SUM() should always
  // agree with the latest entry's balanceAfter for a given user; if it doesn't, something wrote to
  // wavecoinBalance outside of WalletService.
  @Column({ type: 'integer' })
  balanceAfter: number;

  @Column({ type: 'varchar', default: WalletLedgerStatus.Available })
  status: WalletLedgerStatus;

  // Set for seller-earnings entries subject to the holding period (see WalletService). Null for
  // entries that are immediately available (top-ups) or never available (debits, fees).
  @Column({ type: 'timestamptz', nullable: true })
  availableAt: Date | null;

  // External reference for reconciliation (e.g. the BOG transactionId for a topup). Unique when
  // present — this is what makes `recordTopup` safe to call twice with the same reference (BOG
  // retries callbacks; see bog-payments.CLAUDE.md).
  @Column({ type: 'varchar', unique: true, nullable: true })
  reference: string | null;

  // Set only for `admin_adjustment` entries — which admin made the adjustment.
  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
