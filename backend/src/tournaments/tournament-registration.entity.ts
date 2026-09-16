import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Tournament } from './tournament.entity';
import { User } from '../users/user.entity';

// One row per user's registration for a tournament — free entry (no payment), so this is a plain
// join table, not something wallet.ts needs to know about.
@Entity('tournament_registrations')
@Unique(['tournamentId', 'userId'])
export class TournamentRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tournamentId: string;

  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  registeredAt: Date;
}
