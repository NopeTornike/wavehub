import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { UserStatus } from '@wavehub/shared-types';

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
}
