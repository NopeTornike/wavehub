import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// Fixed taxonomy seeded by migration (see CreateListingsSchema) — the 5 games from the source spec.
@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  iconUrl: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;
}
