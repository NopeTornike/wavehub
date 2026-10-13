import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// Fixed taxonomy seeded by migration (see CreateListingsSchema) — currently just the 5 service
// categories from the source spec. Item-type categories (accounts/skins) don't exist in the spec
// and aren't seeded; add them via a future admin "manage categories" screen (Phase 11) rather than
// inventing them here ahead of a real product decision.
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'varchar', default: 'service' })
  type: 'service' | 'item' | 'both';

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;
}
