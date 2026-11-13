import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TournamentMatch } from './tournament-match.entity';
import { TournamentTeam } from './tournament-team.entity';

// One team's result in a battle-royale match (owner 2026-11-14): placement, kills and the points
// they earn (brMatchPoints — computed server-side, never typed by staff).
@Entity('tournament_match_results')
@Unique('UQ_tournament_match_results_match_team', ['matchId', 'teamId'])
export class TournamentMatchResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  matchId: string;

  @ManyToOne(() => TournamentMatch, (m) => m.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matchId' })
  match: TournamentMatch;

  @Column({ type: 'uuid' })
  teamId: string;

  @ManyToOne(() => TournamentTeam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team: TournamentTeam;

  @Column({ type: 'integer', nullable: true })
  placement: number | null;

  @Column({ type: 'integer', default: 0 })
  kills: number;

  @Column({ type: 'integer', default: 0 })
  points: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
