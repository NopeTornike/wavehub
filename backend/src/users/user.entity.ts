import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { UserStatus } from '@wavehub/shared-types';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ default: 'buyer' })
  role: 'buyer' | 'seller';

  @Column({ type: 'varchar', default: UserStatus.PendingVerification })
  status: UserStatus;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;
}
