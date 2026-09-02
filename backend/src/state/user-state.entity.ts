import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_state')
@Index(['scope', 'key'], { unique: true })
export class UserState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  scope: string;

  @Column()
  key: string;

  @Column({ type: 'jsonb', default: () => "'null'::jsonb" })
  value: unknown;

  @UpdateDateColumn()
  updatedAt: Date;
}
