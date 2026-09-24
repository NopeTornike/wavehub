import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

// One user following another (docs/design-mockups/12's Followers / Following / Follow button).
@Entity('user_follows')
export class UserFollow {
  @PrimaryColumn('uuid')
  followerId: string;

  @PrimaryColumn('uuid')
  followeeId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
