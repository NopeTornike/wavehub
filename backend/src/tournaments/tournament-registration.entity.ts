import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Tournament } from './tournament.entity';
import { User } from '../users/user.entity';
import { TournamentTeam } from './tournament-team.entity';

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

  // The team this user registered (as captain, or as the solo player). Deleting the team removes
  // the registration.
  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => TournamentTeam, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'teamId' })
  team: TournamentTeam | null;

  @CreateDateColumn({ type: 'timestamptz' })
  registeredAt: Date;
}
