import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WithdrawMethod, WithdrawStatus } from '@wavehub/shared-types';
import { User } from '../users/user.entity';

// A seller's payout request. `amountWaveCoin` is debited from `users.wavecoinBalance` the moment
// this row (and its matching WalletService.holdForWithdrawal ledger entry) is created — see
// withdrawals.service.ts and wallet/CLAUDE.md — not deferred until an admin approves it.
@Entity('withdraw_requests')
export class WithdrawRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sellerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ type: 'integer' })
  amountWaveCoin: number;

  @Column({ type: 'varchar' })
  method: WithdrawMethod;

  // Free-form payout details matching `method` (PayPal email, Wise account, or bank account +
  // IBAN + SWIFT per SPECIFICATION.md §5.6) — not broken into typed columns since the shape
  // genuinely varies by method and there's no seller-profile payout-details table yet to source
  // this from instead; the seller supplies it fresh on each request for now.
  @Column({ type: 'jsonb' })
  payoutDetails: Record<string, string>;

  @Column({ type: 'varchar', default: WithdrawStatus.Pending })
  status: WithdrawStatus;

  // Required for a Rejected outcome per the source spec ("required reject reason") — also used
  // for a Completed note (e.g. a payout reference) though that's optional in practice.
  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  processedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
