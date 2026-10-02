import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Coach } from './coach.entity';

// A fixed-price booking offer a coach sells next to their hourly rate (e.g. "VOD review — 45 min —
// 25 GEL"). Booking one snapshots its price, duration and name onto the session.
@Entity('coach_packages')
export class CoachPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  coachId: string;

  @ManyToOne(() => Coach, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coachId' })
  coach: Coach;

  @Column({ length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  // Sessions in the package (each `durationMinutes` long); booking it schedules this many.
  @Column({ type: 'integer', default: 1 })
  sessionsCount: number;

  @Column({ type: 'integer' })
  durationMinutes: number;

  @Column({ type: 'integer' })
  priceWaveCoin: number;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
