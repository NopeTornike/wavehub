import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';
import type { SupportPermissions } from '@wavehub/shared-types';

// Deliberately a singleton table — exactly one row, at a fixed well-known id (SINGLETON_ID below),
// seeded by the CreatePlatformSettings migration. Simpler than a key/value settings table for the
// small, fixed set of platform-wide numbers this repo actually needs so far; revisit only if the
// number of independently-configurable settings grows enough that a generic key/value store
// becomes worth the loss of typed columns.
export const PLATFORM_SETTINGS_SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryColumn('uuid')
  id: string;

  // Was DEFAULT_PLATFORM_FEE_PERCENT (hardcoded 10) in backend/src/orders/orders.service.ts —
  // every order still snapshots the rate that was live at purchase time
  // (Order.platformFeePercentSnapshot), so changing this never retroactively affects an existing
  // order's math.
  @Column({ type: 'integer', default: 10 })
  platformFeePercent: number;

  // The coaching-session fee (taken from the coach), separate from the marketplace fee
  // (client feedback #16, 2026-10-04). Snapshotted onto each session at booking.
  @Column({ type: 'integer', default: 10 })
  coachingFeePercent: number;

  // Auto-accept windows (hours, 1–720), owner 2026-10-07. Read when an order is delivered / a
  // session is marked done and stored on that row, so a change never moves an existing deadline.
  @Column({ type: 'integer', default: 24 })
  orderAutoCompleteHours: number;

  @Column({ type: 'integer', default: 48 })
  sessionAutoConfirmHours: number;

  // Was MIN_WITHDRAWAL_WAVECOIN (hardcoded 20) in backend/src/withdrawals/withdrawals.service.ts.
  @Column({ type: 'integer', default: 20 })
  minWithdrawalWaveCoin: number;

  // Stored but NOT YET ENFORCED anywhere — see settings/CLAUDE.md's Status section for why a
  // global maintenance-mode guard wasn't built in the same change that added this flag.
  @Column({ type: 'boolean', default: false })
  maintenanceMode: boolean;

  // What the Support Specialist role may do beyond its defaults — set by Super Admin only.
  @Column({ type: 'jsonb', default: { walletAdjust: false, walletAdjustMax: 100, suspendUsers: false } })
  supportPermissions: SupportPermissions;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
