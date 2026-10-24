import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BannerPlacement } from '@wavehub/shared-types';

// A CMS banner (marketing/CLAUDE.md) shown at its `placement`: image + title, optional subtitle and button link (an
// internal path or an https URL), shown while active and inside its optional date window.
@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Where it shows — migration 1784383000000-BannerPlacements (CHECK-constrained).
  @Column({ type: 'varchar', length: 30, default: BannerPlacement.HomeStrip })
  placement: BannerPlacement;

  @Column({ type: 'varchar', length: 80 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subtitle: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  imageUrl: string | null;

  // A video banner (migration 1784386000000-BannerVideo). When set it replaces the photo.
  @Column({ type: 'varchar', length: 300, nullable: true })
  videoUrl: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  linkUrl: string | null;

  // Small label above the title, e.g. "WaveHubX coach interview" (migration 1784388000000).
  @Column({ type: 'varchar', length: 60, nullable: true })
  kicker: string | null;

  // A real coach featured on the banner (photo, name, game chip). ON DELETE SET NULL.
  @Column({ type: 'uuid', nullable: true })
  coachId: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  buttonLabel: string | null;

  @Column({ type: 'boolean', default: false })
  active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
