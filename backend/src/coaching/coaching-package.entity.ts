import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// The platform's coaching packages (owner spec "WaveHubX Coaching Packages", 2026-10-02): Starter /
// Growth / Elite, the same for every coach and editable by staff only. Booking one schedules
// `sessionsCount` sessions of `durationMinutes` and splits `priceWaveCoin` over them; the session
// snapshots the package name, so editing a package never rewrites history.
@Entity('coaching_packages')
export class CoachingPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Stable identifier (starter | growth | elite) — the card's accent and icon follow it.
  @Column({ type: 'varchar', length: 30, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'integer' })
  sessionsCount: number;

  @Column({ type: 'integer' })
  durationMinutes: number;

  // Whole GEL (= WaveCoin); "₾" is UI formatting.
  @Column({ type: 'integer' })
  priceWaveCoin: number;

  // The bold question line at the top of the description.
  @Column({ type: 'varchar', length: 300 })
  tagline: string;

  @Column({ type: 'varchar', length: 600 })
  description: string;

  // "რას მოიცავს" bullets, in order.
  @Column({ type: 'jsonb', default: [] })
  features: string[];

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
