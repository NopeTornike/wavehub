import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// A staff edit of one UI string (translations/CLAUDE.md). `key` is the Georgian source text exactly
// as the app renders it (template strings use {0}, {1}… like lib/i18n-ka-en.app.json).
@Entity('ui_translations')
export class UiTranslation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  key: string;

  @Column({ type: 'text', nullable: true })
  en: string | null;

  @Column({ type: 'text', nullable: true })
  ka: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
