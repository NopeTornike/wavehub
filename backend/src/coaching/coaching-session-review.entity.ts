import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CoachingSession } from './coaching-session.entity';
import { Coach } from './coach.entity';
import { User } from '../users/user.entity';

// A buyer's review of one completed coaching session (one per session). Feeds Coach.ratingAvg /
// ratingCount and the coach profile's "Student Review" tab.
@Entity('coaching_session_reviews')
export class CoachingSessionReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  sessionId: string;

  @ManyToOne(() => CoachingSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: CoachingSession;

  @Column()
  coachId: string;

  @ManyToOne(() => Coach, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coachId' })
  coach: Coach;

  @Column()
  buyerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @Column({ type: 'integer' })
  rating: number;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  body: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
