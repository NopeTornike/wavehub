import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// A homepage banner (marketing/CLAUDE.md): image + title, optional subtitle and button link (an
// internal path or an https URL), shown while active and inside its optional date window.
@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subtitle: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  linkUrl: string | null;

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
