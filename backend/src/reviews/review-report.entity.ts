import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Review } from './review.entity';
import { User } from '../users/user.entity';

@Entity('review_reports')
export class ReviewReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reviewId: string;

  @ManyToOne(() => Review, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewId' })
  review: Review;

  @Column()
  reportedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reportedBy' })
  reporter: User;

  @Column({ type: 'varchar' })
  reason: 'spam' | 'fake' | 'abusive' | 'other';

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'actioned' | 'dismissed';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
