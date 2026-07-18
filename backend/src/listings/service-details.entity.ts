import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import type { RequirementField, FaqEntry } from '@wavehub/shared-types';
import { Listing } from './listing.entity';

export type { RequirementField, FaqEntry };

// 1:1 extension of `listings` where `type = 'service'`. Not created at all for item listings — see
// CLAUDE.md for why this is a separate table rather than nullable columns on `listings` itself.
@Entity('service_details')
export class ServiceDetails {
  @PrimaryColumn()
  listingId: string;

  @OneToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  @Column({ type: 'jsonb', default: [] })
  requirementsSchema: RequirementField[];

  @Column({ type: 'jsonb', default: [] })
  faq: FaqEntry[];
}
