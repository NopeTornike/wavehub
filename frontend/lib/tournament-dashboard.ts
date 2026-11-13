import type { PublicTournamentMatch, PublicTournamentSummary, PublicTournamentTeam, TournamentTeamRef } from '@wavehub/shared-types'
import { brBracket, TournamentMatchStage, TournamentMatchStatus, TournamentStatus } from '@wavehub/shared-types'
import { groupStandings, matchWinner } from './tournaments'

// The Tournament Dashboard's data (owner 2026-11-14, Gio; docs/design-mockups/round-7/31, 34-38),
// one shape for both formats:
//   - battle royale (PUBG): group tables, a semifinal table and a final table, all from placement +
//     kills results (shared-types brBracket);
//   - versus (CS2): group tables from A-vs-B group matches, then the knockout matches as they are
//     (quarter/semi as match lists), the final match, champion = its winner.
// Nothing is invented: a stage without matches/teams shows "TBD" slots or an empty note.

export type DashRow = { team: TournamentTeamRef; wins: number; losses: number; points: number }
export type DashStage = { rows: DashRow[]; played: number; total: number; live: boolean; done: boolean; next: string | null }
export type DashGroup = DashStage & { name: string }
export type DashKnockout = DashStage & { stage: TournamentMatchStage; matches: PublicTournamentMatch[] }

export type Dashboard = {
  format: 'versus' | 'battle_royale'
  teamCount: number
  groups: DashGroup[]
  groupAdvance: number
  groupDone: boolean
  // Battle royale: the semifinal table. Versus: the quarter/semi knockout rounds that have matches.
  semifinal: DashStage
  semifinalAdvance: number
  knockouts: DashKnockout[]
  final: DashStage & { teams: TournamentTeamRef[]; slots: number; match: PublicTournamentMatch | null }
  champion: TournamentTeamRef | null
  standings: DashRow[]
  groupPlace: Record<string, { group: string; place: number }>
  phase: 'group' | 'semifinal' | 'final' | 'completed'
}

const done = (m: PublicTournamentMatch) => m.status === TournamentMatchStatus.Completed
function stageInfo(list: PublicTournamentMatch[]) {
  const next = list
    .filter((m) => !done(m) && m.scheduledAt)
    .map((m) => m.scheduledAt!)
    .sort()[0]
  return {
    played: list.filter(done).length,
    total: list.length,
    live: list.some((m) => m.status === TournamentMatchStatus.Live),
    done: list.length > 0 && list.every(done),
    next: next ?? null,
  }
}

export function buildDashboard(t: PublicTournamentSummary, matches: PublicTournamentMatch[], teams: PublicTournamentTeam[]): Dashboard {
  const by = (stage: TournamentMatchStage) => matches.filter((m) => m.stage === stage)
  const groupMatches = by(TournamentMatchStage.Group)
  const semiMatches = by(TournamentMatchStage.SemiFinal)
  const finalMatches = by(TournamentMatchStage.Final)
  const completed = t.status === TournamentStatus.Completed

  if (t.format === 'battle_royale') {
    const b = brBracket(matches, teams, { groupAdvance: t.groupAdvance, semifinalAdvance: t.semifinalAdvance, completed })
    const groups = b.groups.map((g) => ({ ...g, ...stageInfo(groupMatches.filter((m) => m.groupName === g.name)), rows: g.rows }))
    return {
      format: 'battle_royale',
      teamCount: teams.length,
      groups,
      groupAdvance: t.groupAdvance,
      groupDone: b.groupDone,
      semifinal: { rows: b.semifinal.rows, ...stageInfo(semiMatches) },
      semifinalAdvance: t.semifinalAdvance,
      knockouts: [],
      final: {
        rows: b.final.rows,
        ...stageInfo(finalMatches),
        teams: b.final.rows.map((r) => r.team),
        slots: Math.max(t.semifinalAdvance, b.final.rows.length),
        match: finalMatches[0] ?? null,
      },
      champion: b.champion,
      standings: b.final.rows,
      groupPlace: b.groupPlace,
      phase: b.phase,
    }
  }

  // Versus: group tables from A-vs-B results, with the staff-assigned group teams that haven't played yet.
  const tables = new Map(groupStandings(matches, t.pointsPerWin, t.pointsPerLoss))
  for (const team of teams) {
    if (!team.groupName) continue
    const rows = tables.get(team.groupName) ?? []
    if (!rows.some((r) => r.team.id === team.id)) rows.push({ team: { id: team.id, name: team.name, tag: team.tag, logoUrl: team.logoUrl }, wins: 0, losses: 0, points: 0 })
    tables.set(team.groupName, rows)
  }
  const groups: DashGroup[] = [...tables.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, rows]) => ({ name, rows, ...stageInfo(groupMatches.filter((m) => (m.groupName || 'A') === name)) }))
  const groupPlace: Record<string, { group: string; place: number }> = {}
  for (const g of groups) g.rows.forEach((r, i) => (groupPlace[r.team.id] ??= { group: g.name, place: i + 1 }))

  // Every completed match counts for W-L; points stay the group table's.
  const record = new Map<string, DashRow>()
  const rowOf = (team: TournamentTeamRef) => {
    const row = record.get(team.id) ?? { team, wins: 0, losses: 0, points: 0 }
    record.set(team.id, row)
    return row
  }
  for (const m of matches) {
    const w = matchWinner(m)
    if (!w || !m.teamA || !m.teamB) continue
    rowOf(w === 'a' ? m.teamA : m.teamB).wins += 1
    rowOf(w === 'a' ? m.teamB : m.teamA).losses += 1
  }
  for (const g of groups) for (const r of g.rows) rowOf(r.team).points = r.points

  const knockouts: DashKnockout[] = [TournamentMatchStage.QuarterFinal, TournamentMatchStage.SemiFinal]
    .map((stage) => {
      const list = by(stage)
      const seen = new Map<string, TournamentTeamRef>()
      for (const m of list) for (const team of [m.teamA, m.teamB]) if (team) seen.set(team.id, team)
      const rows = [...seen.values()].map((team) => rowOf(team))
      return { stage, matches: list, rows, ...stageInfo(list) }
    })
    .filter((k) => k.matches.length > 0)

  const final = finalMatches[0] ?? null
  const finalTeams = final ? ([final.teamA, final.teamB].filter(Boolean) as TournamentTeamRef[]) : []
  const winner = final ? matchWinner(final) : null
  const champion = winner === 'a' ? final!.teamA : winner === 'b' ? final!.teamB : null

  // Final standings: champion, runner-up, then the semifinal losers (by points).
  const standings: DashRow[] = []
  if (champion && final) {
    standings.push(rowOf(champion))
    const runnerUp = winner === 'a' ? final.teamB : final.teamA
    if (runnerUp) standings.push(rowOf(runnerUp))
    const semiLosers = semiMatches
      .map((m) => {
        const w = matchWinner(m)
        return w === 'a' ? m.teamB : w === 'b' ? m.teamA : null
      })
      .filter((x): x is TournamentTeamRef => !!x && !standings.some((s) => s.team.id === x.id))
      .map(rowOf)
      .sort((a, b) => b.points - a.points || b.wins - a.wins)
    standings.push(...semiLosers)
  }

  const groupDone = groupMatches.length > 0 && groupMatches.every(done)
  const semiStage = knockouts.find((k) => k.stage === TournamentMatchStage.SemiFinal)
  return {
    format: 'versus',
    teamCount: teams.length,
    groups,
    groupAdvance: t.groupAdvance,
    groupDone,
    semifinal: semiStage ?? { rows: [], ...stageInfo([]) },
    semifinalAdvance: 2,
    knockouts,
    final: { rows: finalTeams.map(rowOf), ...stageInfo(finalMatches), teams: finalTeams, slots: 2, match: final },
    champion,
    standings,
    groupPlace,
    phase: champion ? 'completed' : finalMatches.length ? 'final' : knockouts.length || groupDone ? 'semifinal' : 'group',
  }
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${s}`
}
