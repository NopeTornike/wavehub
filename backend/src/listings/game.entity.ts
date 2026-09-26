import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// The game catalogue. Seeded by migrations (CreateListingsSchema, CommunityShellAndGameCatalogue);
// staff add/rename/hide games and upload their art via /admin/games (games.service.ts). The slug is
// immutable once created — the frontend keys bundled artwork and routes on it.
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

  // Uploaded marketplace/listing cover and home-grid tile (GameArtwork migration).
  @Column({ type: 'varchar', length: 500, nullable: true })
  coverUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  tileUrl: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;
}
