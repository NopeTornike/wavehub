import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { NotificationType, TournamentMatchStage, TournamentMatchStatus, TournamentTeamStatus } from '@wavehub/shared-types';
import { NotificationsService } from '../notifications/notifications.service';
import type { TournamentMatch } from './tournament-match.entity';
import type { Tournament } from './tournament.entity';

// Tournament notifications for the players on a team (owner 2026-11-10: "check every tournament
// notification — start, reminders, win, loss; on a loss show Lost – Winner"). Every method is
// best-effort: a failed notification is logged and never fails the staff action that caused it.
// The reminders and the result go out once per match (stamps on tournament_matches).

const TBILISI = 'Asia/Tbilisi';

function when(at: Date): string {
  return new Intl.DateTimeFormat('ka-GE', { timeZone: TBILISI, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
}

type MatchRow = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  scheduledAt: Date | null;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string | null;
  teamBName: string | null;
  stage: string;
  scoreA: number | null;
  scoreB: number | null;
  pointsPerWin: number;
  format: string;
  groupName: string | null;
  roundLabel: string | null;
};

// Who plays a battle-royale match (its results, else the group's / qualified teams) — answered by
// TournamentsService, which owns the bracket (registered there to avoid a circular injection).
export type BrTeamsResolver = (matchId: string) => Promise<string[]>;

const STAGE_LABEL: Record<string, string> = {
  group: 'Group Stage',
  semifinal: 'Semifinal',
  final: 'Final',
  quarterfinal: 'Quarterfinal',
  round: 'Round',
};

// "Group A · Match 2/5" / "ნახევარფინალი · Match 1/3".
function brLabel(m: Pick<MatchRow, 'stage' | 'groupName' | 'roundLabel'>): string {
  const stage = m.stage === 'group' && m.groupName ? `Group ${m.groupName}` : (STAGE_LABEL[m.stage] ?? m.stage);
  return m.roundLabel ? `${stage} · ${m.roundLabel}` : stage;
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}

@Injectable()
export class TournamentNotifier {
  private readonly logger = new Logger(TournamentNotifier.name);
  private brTeams: BrTeamsResolver | null = null;

  setBrTeamsResolver(resolver: BrTeamsResolver) {
    this.brTeams = resolver;
  }

  private async brPlayers(matchId: string): Promise<string[]> {
    const teamIds = this.brTeams ? await this.brTeams(matchId) : [];
    return [...(await this.playersByTeam(teamIds)).values()].flat();
  }

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  // Every account on each team: linked roster rows plus the captain (older squads only link the captain).
  async playersByTeam(teamIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (teamIds.length === 0) return out;
    const rows: Array<{ teamId: string; userId: string }> = await this.dataSource.query(
      `SELECT "teamId", "userId" FROM "tournament_team_members" WHERE "teamId" = ANY($1::uuid[])
       UNION SELECT "id" AS "teamId", "captainUserId" AS "userId" FROM "tournament_teams" WHERE "id" = ANY($1::uuid[]) AND "captainUserId" IS NOT NULL`,
      [teamIds],
    );
    for (const r of rows) out.set(r.teamId, [...(out.get(r.teamId) ?? []), r.userId]);
    return out;
  }

  private async send(userIds: string[], type: NotificationType, title: string, body: string, metadata: Record<string, string>) {
    for (const id of new Set(userIds)) await this.notifications.tryEmit(id, type, title, body, metadata);
  }

  private async safely(label: string, run: () => Promise<void>) {
    try {
      await run();
    } catch (err) {
      this.logger.error(`Tournament notification failed (${label})`, err as Error);
    }
  }

  private async matchRow(matchId: string): Promise<MatchRow | null> {
    const [row] = await this.dataSource.query(
      `SELECT m."id", m."tournamentId", t."name" AS "tournamentName", m."scheduledAt", m."teamAId", m."teamBId",
              a."name" AS "teamAName", b."name" AS "teamBName", m."stage", m."scoreA", m."scoreB", t."pointsPerWin",
              t."format", m."groupName", m."roundLabel"
       FROM "tournament_matches" m JOIN "tournaments" t ON t."id" = m."tournamentId"
       LEFT JOIN "tournament_teams" a ON a."id" = m."teamAId" LEFT JOIN "tournament_teams" b ON b."id" = m."teamBId"
       WHERE m."id" = $1 AND t."status" <> 'draft'`,
      [matchId],
    );
    return row ?? null;
  }

  private hubLink(tournamentId: string) {
    return `/tournaments/hub?t=${tournamentId}`;
  }

  async teamStatus(tournament: Pick<Tournament, 'id' | 'name' | 'status'>, teamId: string, teamName: string, status: TournamentTeamStatus) {
    if (tournament.status === 'draft' || (status !== TournamentTeamStatus.Verified && status !== TournamentTeamStatus.Rejected)) return;
    await this.safely('team status', async () => {
      const players = (await this.playersByTeam([teamId])).get(teamId) ?? [];
      const verified = status === TournamentTeamStatus.Verified;
      await this.send(
        players,
        verified ? NotificationType.TournamentTeamVerified : NotificationType.TournamentTeamRejected,
        verified ? 'გუნდი დადასტურდა ✅' : 'გუნდის რეგისტრაცია უარყოფილია',
        verified
          ? `„${teamName}“ დადასტურებულია ტურნირზე „${tournament.name}“. მატჩების განრიგი ჰაბში გამოჩნდება.`
          : `„${teamName}“-ის რეგისტრაცია ტურნირზე „${tournament.name}“ უარყოფილია. დეტალებისთვის მიმართე მხარდაჭერას.`,
        { tournamentId: tournament.id, teamId, link: verified ? this.hubLink(tournament.id) : `/tournaments/${tournament.id}` },
      );
    });
  }

  // A match got both teams and a time (new, or staff changed teams / time).
  async matchScheduled(matchId: string) {
    await this.safely('match scheduled', async () => {
      const m = await this.matchRow(matchId);
      if (!m || !m.scheduledAt) return;
      if (m.format === 'battle_royale') {
        // A semifinal / final lobby with nobody qualified yet notifies no one; the reminders reach
        // the qualified teams later.
        const ids = await this.brPlayers(m.id);
        await this.send(ids, NotificationType.TournamentMatchScheduled, 'მატჩი დაინიშნა 📅', `${brLabel(m)} · ${when(new Date(m.scheduledAt))} · „${m.tournamentName}“`, {
          tournamentId: m.tournamentId,
          matchId: m.id,
          link: this.hubLink(m.tournamentId),
        });
        return;
      }
      if (!m.teamAId || !m.teamBId) return;
      const players = await this.playersByTeam([m.teamAId, m.teamBId]);
      const body = `${m.teamAName} vs ${m.teamBName} · ${when(new Date(m.scheduledAt))} · „${m.tournamentName}“`;
      const meta = { tournamentId: m.tournamentId, matchId: m.id, link: this.hubLink(m.tournamentId) };
      await this.send([...(players.get(m.teamAId) ?? []), ...(players.get(m.teamBId) ?? [])], NotificationType.TournamentMatchScheduled, 'მატჩი დაინიშნა 📅', body, meta);
    });
  }

  // Staff opened a team's game room (closed → open with details).
  async roomOpened(matchId: string, sides: Array<'a' | 'b'>) {
    if (sides.length === 0) return;
    await this.safely('room open', async () => {
      const m = await this.matchRow(matchId);
      if (!m) return;
      if (m.format === 'battle_royale') {
        if (!sides.includes('a')) return;
        await this.send(
          await this.brPlayers(m.id),
          NotificationType.TournamentRoomOpen,
          'თამაშის ოთახი გაიხსნა 🔓',
          `Room ID, პაროლი და შენი ადგილი უკვე ხელმისაწვდომია — ${brLabel(m)}.`,
          { tournamentId: m.tournamentId, matchId: m.id, link: this.hubLink(m.tournamentId) },
        );
        return;
      }
      const teamIds = sides.map((s) => (s === 'a' ? m.teamAId : m.teamBId)).filter((x): x is string => !!x);
      const players = await this.playersByTeam(teamIds);
      const meta = { tournamentId: m.tournamentId, matchId: m.id, link: this.hubLink(m.tournamentId) };
      await this.send(
        teamIds.flatMap((id) => players.get(id) ?? []),
        NotificationType.TournamentRoomOpen,
        'თამაშის ოთახი გაიხსნა 🔓',
        `Room ID, პაროლი და შენი ადგილი უკვე ხელმისაწვდომია — ${m.teamAName ?? 'TBD'} vs ${m.teamBName ?? 'TBD'}.`,
        meta,
      );
    });
  }

  // The recorded result, once per match: winners "won", losers "lost — winner: X".
  async result(match: Pick<TournamentMatch, 'id' | 'status' | 'scoreA' | 'scoreB' | 'resultNotifiedAt'>) {
    if (match.status !== TournamentMatchStatus.Completed || match.resultNotifiedAt) return;
    if (match.scoreA === null && match.scoreB === null) return this.brResult(match.id);
    if (match.scoreA === null || match.scoreB === null || match.scoreA === match.scoreB) return;
    await this.safely('match result', async () => {
      // Claim the result first so two quick saves can't both notify.
      // TypeORM answers an UPDATE … RETURNING with [rows, rowCount].
      const [claimed] = await this.dataSource.query(
        `UPDATE "tournament_matches" SET "resultNotifiedAt" = now() WHERE "id" = $1 AND "resultNotifiedAt" IS NULL RETURNING "id"`,
        [match.id],
      );
      if (!Array.isArray(claimed) || claimed.length === 0) return;
      const m = await this.matchRow(match.id);
      if (!m || !m.teamAId || !m.teamBId || m.scoreA === null || m.scoreB === null) return;
      const aWon = m.scoreA > m.scoreB;
      const [winId, loseId] = aWon ? [m.teamAId, m.teamBId] : [m.teamBId, m.teamAId];
      const winner = (aWon ? m.teamAName : m.teamBName) ?? 'TBD';
      const score = `${m.teamAName} ${m.scoreA}:${m.scoreB} ${m.teamBName}`;
      const points = m.stage === TournamentMatchStage.Group && m.pointsPerWin > 0 ? ` · +${m.pointsPerWin} ქულა` : '';
      const players = await this.playersByTeam([winId, loseId]);
      const meta = { tournamentId: m.tournamentId, matchId: m.id, link: `/tournaments/${m.tournamentId}/matches/${m.id}` };
      await this.send(players.get(winId) ?? [], NotificationType.TournamentMatchWon, 'გილოცავთ, გაიმარჯვეთ! 🏆', `${score}${points}`, meta);
      await this.send(players.get(loseId) ?? [], NotificationType.TournamentMatchLost, `წააგეთ — გამარჯვებული: ${winner}`, score, meta);
    });
  }

  // Battle royale, once per match when it is completed: every team with a result gets its place,
  // kills and points; 1st place is a win (TournamentMatchWon), the rest TournamentMatchResult.
  async brResult(matchId: string) {
    await this.safely('battle royale result', async () => {
      const m = await this.matchRow(matchId);
      if (!m || m.format !== 'battle_royale') return;
      const results: Array<{ teamId: string; placement: number | null; kills: number; points: number }> = await this.dataSource.query(
        `SELECT r."teamId", r."placement", r."kills", r."points" FROM "tournament_match_results" r
         JOIN "tournament_matches" m ON m."id" = r."matchId" WHERE r."matchId" = $1 AND m."status" = 'completed'`,
        [matchId],
      );
      if (results.length === 0) return;
      const [claimed] = await this.dataSource.query(
        `UPDATE "tournament_matches" SET "resultNotifiedAt" = now() WHERE "id" = $1 AND "resultNotifiedAt" IS NULL RETURNING "id"`,
        [matchId],
      );
      if (!Array.isArray(claimed) || claimed.length === 0) return;
      const players = await this.playersByTeam(results.map((r) => r.teamId));
      const meta = { tournamentId: m.tournamentId, matchId: m.id, link: `/tournaments/${m.tournamentId}/matches/${m.id}` };
      for (const r of results) {
        const place = r.placement ? `${ordinal(r.placement)} ადგილი` : 'ადგილი არ არის';
        const body = `${brLabel(m)} · ${place} · ${r.kills} kills · +${r.points} ქულა · „${m.tournamentName}“`;
        const won = r.placement === 1;
        await this.send(
          players.get(r.teamId) ?? [],
          won ? NotificationType.TournamentMatchWon : NotificationType.TournamentMatchResult,
          won ? 'გილოცავთ, 1-ლი ადგილი! 🏆' : `მატჩის შედეგი: ${place}`,
          body,
          meta,
        );
      }
    });
  }

  // Staff moved the tournament to "in progress": every non-rejected team's players.
  async tournamentStarted(tournament: Pick<Tournament, 'id' | 'name'>) {
    await this.safely('tournament started', async () => {
      const teams: Array<{ id: string }> = await this.dataSource.query(
        `SELECT "id" FROM "tournament_teams" WHERE "tournamentId" = $1 AND "status" <> 'rejected'`,
        [tournament.id],
      );
      const players = await this.playersByTeam(teams.map((t) => t.id));
      await this.send(
        [...players.values()].flat(),
        NotificationType.TournamentStarted,
        'ტურნირი დაიწყო 🔥',
        `„${tournament.name}“ დაიწყო — მატჩები, ოთახი და ცხრილი ჰაბშია.`,
        { tournamentId: tournament.id, link: this.hubLink(tournament.id) },
      );
    });
  }

  // Every 5 minutes: the 1-hour reminder (stamps both, so a late-scheduled match gets one message),
  // then the 24-hour one. Claimed with UPDATE … RETURNING so a reminder can't go out twice.
  @Cron('*/5 * * * *')
  async sweepReminders(): Promise<number> {
    let sent = 0;
    try {
      const base = `FROM "tournaments" t WHERE t."id" = m."tournamentId" AND t."status" NOT IN ('draft', 'completed')
        AND m."status" = 'scheduled' AND m."scheduledAt" > now()
        AND ((m."teamAId" IS NOT NULL AND m."teamBId" IS NOT NULL) OR t."format" = 'battle_royale')`;
      const hour: Array<{ id: string }> = (
        await this.dataSource.query(
          `UPDATE "tournament_matches" m SET "remindedHourAt" = now(), "remindedDayAt" = coalesce(m."remindedDayAt", now())
           ${base} AND m."remindedHourAt" IS NULL AND m."scheduledAt" <= now() + interval '1 hour' RETURNING m."id"`,
        )
      )[0];
      for (const r of hour ?? []) sent += await this.remind(r.id, 'hour');
      const day: Array<{ id: string }> = (
        await this.dataSource.query(
          `UPDATE "tournament_matches" m SET "remindedDayAt" = now()
           ${base} AND m."remindedDayAt" IS NULL AND m."scheduledAt" <= now() + interval '24 hours' RETURNING m."id"`,
        )
      )[0];
      for (const r of day ?? []) sent += await this.remind(r.id, 'day');
    } catch (err) {
      this.logger.error('Tournament reminder sweep failed', err as Error);
    }
    return sent;
  }

  private async remind(matchId: string, kind: 'hour' | 'day'): Promise<number> {
    let count = 0;
    await this.safely('reminder', async () => {
      const m = await this.matchRow(matchId);
      if (!m || !m.scheduledAt) return;
      const br = m.format === 'battle_royale';
      let ids: string[];
      if (br) {
        ids = await this.brPlayers(m.id);
        // Nobody plays it yet (groups not assigned / semifinal not decided): give the stamp back so
        // a later sweep can remind the teams once they are known.
        if (ids.length === 0) {
          await this.dataSource.query(`UPDATE "tournament_matches" SET "${kind === 'hour' ? 'remindedHourAt' : 'remindedDayAt'}" = NULL WHERE "id" = $1`, [m.id]);
          return;
        }
      } else {
        if (!m.teamAId || !m.teamBId) return;
        const players = await this.playersByTeam([m.teamAId, m.teamBId]);
        ids = [...(players.get(m.teamAId) ?? []), ...(players.get(m.teamBId) ?? [])];
      }
      count = new Set(ids).size;
      await this.send(
        ids,
        NotificationType.TournamentMatchReminder,
        kind === 'hour' ? 'მატჩი 1 საათში იწყება ⏰' : 'მატჩამდე 24 საათია ⏳',
        `${br ? brLabel(m) : `${m.teamAName} vs ${m.teamBName}`} · ${when(new Date(m.scheduledAt))}. Room ID და პაროლი გამოჩნდება, როცა ადმინისტრაცია ოთახს გახსნის.`,
        { tournamentId: m.tournamentId, matchId: m.id, link: this.hubLink(m.tournamentId) },
      );
    });
    return count;
  }
}
