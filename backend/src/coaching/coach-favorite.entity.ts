import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

// A user's saved coach (the coach profile's "Add to Wishlist").
@Entity('coach_favorites')
@Unique(['userId', 'coachId'])
export class CoachFavorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  coachId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
