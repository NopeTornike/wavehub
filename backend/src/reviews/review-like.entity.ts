import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

// One user's 👍 on a review ('review') or on the seller's reply to it ('reply').
@Entity('review_likes')
@Unique('UQ_review_likes', ['reviewId', 'userId', 'target'])
export class ReviewLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reviewId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 6 })
  target: 'review' | 'reply';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
