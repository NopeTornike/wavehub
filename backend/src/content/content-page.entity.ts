import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ContentPageStatus } from '@wavehub/shared-types';

// Scoped to what Footer.tsx actually links to today (About/Contact/Terms/Privacy/Refund) — the
// broader "Content Management" catalog in SPECIFICATION.md §5.13 (banners, news, categories,
// badges, tags, promo codes) is real future scope (build-plan Phase 11f), not modeled here.
@Entity('content_pages')
export class ContentPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  // Plain text/markdown, rendered as preformatted paragraphs on the public page — no rich-text
  // editor or HTML sanitization pipeline was worth building for a first pass at 5 static pages.
  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ type: 'varchar', default: ContentPageStatus.Draft })
  status: ContentPageStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
