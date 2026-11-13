import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MyTournamentEntry, PublicTournamentMatch, PublicTournamentTeam } from '@wavehub/shared-types'
import { TournamentMatchStage, TournamentMatchStatus, TournamentStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import GameRoomCard from '../../components/GameRoomCard'
import { kaDate, kaTime } from '../../lib/dates'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useShell } from '../../lib/shell'
import { buildDashboard, ordinal } from '../../lib/tournament-dashboard'
import type { Dashboard, DashRow } from '../../lib/tournament-dashboard'
import { STAGE_LABEL, TeamMark, TIcon, tournamentCover } from '../../lib/tournaments'
import { MyTeamStatusCard, TeamMembersCard } from '../../components/tournaments/MyTeamCards'
import type { BrTeamSummary } from '../../components/tournaments/MyTeamCards'
import { ClockBoxes, dayMonth, StatusPill, tbilisiTime, TournamentBanner } from '../../components/tournaments/TournamentStages'

// My Tournament (owner 2026-11-14, Gio; docs/design-mockups/round-7/33): the selected
// registration's game banner, "My Tournament Hub", then
//   - battle royale (PUBG): the NEXT MATCH card (stage, group • match k/N, countdown, date | time)
//     and the last "Match Completed" card (place, match points, stage total);
//   - versus (CS2): the next-match panel as it was, moved to the top;
// then the match's game room, the "my team" status card and the members card. The tournament
// card (round-7/32) and the bracket left this page — the bracket lives on the Tournament
// Dashboard (/tournaments/[id]/dashboard).

const STAGE_EN: Partial<Record<TournamentMatchStage, string>> = {
  [TournamentMatchStage.Group]: 'Group Stage',
  [TournamentMatchStage.QuarterFinal]: 'Quarterfinals',
  [TournamentMatchStage.SemiFinal]: 'Semifinals',
  [TournamentMatchStage.Final]: 'Final',
}

// The team's row in the latest stage it plays (final, else semifinal, else its group).
function currentRow(dash: Dashboard, teamId: string): { row: DashRow; place: number } | null {
  const stages: DashRow[][] = [dash.final.rows, dash.semifinal.rows, ...dash.groups.map((g) => g.rows)]
  for (const rows of stages) {
    const i = rows.findIndex((r) => r.team.id === teamId)
    if (i >= 0) return { row: rows[i], place: i + 1 }
  }
  return null
}

export default function TournamentHub() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const { games } = useShell()
  const userId = user?.id
  const [entries, setEntries] = useState<MyTournamentEntry[] | null>(null)
  const [myMatches, setMyMatches] = useState<PublicTournamentMatch[]>([])
  const [all, setAll] = useState<{ id: string; matches: PublicTournamentMatch[]; teams: PublicTournamentTeam[] } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (checked && !user) router.replace('/login?next=/tournaments/hub')
  }, [checked, user, router])

  const load = useCallback(() => {
    if (!userId) return
    Promise.all([api.listMyTournaments(), api.listMyTournamentMatches()])
      .then(([rows, matches]) => {
        setEntries(rows)
        setMyMatches(matches)
        setError('')
        setSelected((current) => {
          const wanted = typeof router.query.t === 'string' ? router.query.t : current
          if (wanted && rows.some((r) => r.tournament.id === wanted)) return wanted
          return (rows.find((r) => r.tournament.status !== TournamentStatus.Completed) ?? rows[0])?.tournament.id ?? null
        })
      })
      .catch((err) => {
        setEntries([])
        setError(errorMessage(err, 'ჰაბის ჩატვირთვა ვერ მოხერხდა.'))
      })
      .finally(() => setRefreshing(false))
  }, [userId, router.query.t])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selected) return
    let alive = true
    Promise.all([api.listTournamentMatches(selected), api.listTournamentTeams(selected).catch(() => [] as PublicTournamentTeam[])])
      .then(([matches, teams]) => alive && setAll({ id: selected, matches, teams }))
      .catch(() => alive && setAll({ id: selected, matches: [], teams: [] }))
    return () => {
      alive = false
    }
  }, [selected, entries])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const slugById = useMemo(() => new Map(games.map((g) => [g.gameId, g.slug])), [games])
  const entry = entries?.find((e) => e.tournament.id === selected) ?? null
  const tournament = entry?.tournament ?? null
  const teamId = entry?.team.id ?? null
  const bracket = all && all.id === selected ? all.matches : []
  const dash = tournament && all && all.id === tournament.id ? buildDashboard(tournament, all.matches, all.teams) : null
  const br = tournament?.format === 'battle_royale'

  // This tournament's matches of my team; the next one = soonest not finished (or started < 1h ago).
  const mine = myMatches.filter((m) => m.tournamentId === selected)
  const next =
    mine
      .filter((m) => m.status !== TournamentMatchStatus.Completed && m.scheduledAt && new Date(m.scheduledAt).getTime() > now - 3_600_000)
      .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))[0] ?? null

  // Battle royale: my last finished match and my standing.
  const lastDone = br && teamId
    ? (bracket
        .filter((m) => m.status === TournamentMatchStatus.Completed && m.results.some((r) => r.team.id === teamId))
        .sort((a, b) => (b.scheduledAt ?? b.id).localeCompare(a.scheduledAt ?? a.id))[0] ?? null)
    : null
  const lastResult = lastDone?.results.find((r) => r.team.id === teamId) ?? null
  const standing = br && dash && teamId ? currentRow(dash, teamId) : null
  const lastStageTotal =
    lastDone && dash && teamId
      ? ((lastDone.stage === TournamentMatchStage.Final ? dash.final.rows : lastDone.stage === TournamentMatchStage.SemiFinal ? dash.semifinal.rows : dash.groups.find((g) => g.name === lastDone.groupName)?.rows) ?? []).find((r) => r.team.id === teamId)?.points ?? null
      : null
  const brSummary: BrTeamSummary | null =
    br && teamId
      ? {
          points: standing?.row.points ?? 0,
          wins: standing?.row.wins ?? 0,
          losses: standing?.row.losses ?? 0,
          place: standing?.place ?? null,
          last: lastResult && lastDone ? { placement: lastResult.placement, points: lastResult.points, label: matchLabel(lastDone) } : null,
        }
      : null

  const dashboardHref = tournament ? `/tournaments/${tournament.id}/dashboard` : '/tournaments'

  return (
    <Layout title="My Tournament" noIndex>
      <section className="wt-page wt-hub td-page">
        {error && (
          <p className="seller-status error" role="alert">
            {error}
          </p>
        )}

        {entries === null ? (
          <div className="marketplace-empty">იტვირთება…</div>
        ) : entries.length === 0 ? (
          <div className="wt-empty">
            <TIcon name="trophy" />
            <strong>ჯერ არცერთ ტურნირზე არ ხარ დარეგისტრირებული</strong>
            <p>
              <Link href="/tournaments">აირჩიე ტურნირი</Link> და დაარეგისტრირე გუნდი — აქ გამოჩნდება მატჩები, შედეგები და პროგრესი.
            </p>
          </div>
        ) : (
          <>
            {entries.length > 1 && (
              <div className="wt-seg wt-hub-switch" aria-label="ტურნირის არჩევა">
                {entries.map((e) => (
                  <button key={e.tournament.id} type="button" className={e.tournament.id === selected ? 'active' : undefined} onClick={() => setSelected(e.tournament.id)}>
                    {e.tournament.name}
                  </button>
                ))}
              </div>
            )}

            {tournament && <TournamentBanner tournament={tournament} cover={tournamentCover(tournament, slugById)} href={`/tournaments/${tournament.id}`} />}

            <header className="td-hub-title">
              <TIcon name="users" className="td-hub-icon" />
              <span>
                <h1>My Tournament Hub</h1>
                <p>Track your matches, results and progress.</p>
              </span>
              <span className="td-hub-actions">
                {tournament && (
                  <Link className="td-dash-link" href={dashboardHref}>
                    <TIcon name="bracket" /> Tournament Dashboard
                  </Link>
                )}
                <button
                  type="button"
                  className="td-icon-btn"
                  aria-label="განახლება"
                  title="განახლება"
                  onClick={() => {
                    setRefreshing(true)
                    load()
                  }}
                  disabled={refreshing}
                >
                  <TIcon name="refresh" />
                </button>
              </span>
            </header>

            {br ? (
              <>
                <BrNextMatch match={next} now={now} cover={tournament ? tournamentCover(tournament, slugById) : null} />
                {lastDone && lastResult && (
                  <section className="td-done" aria-label="Match Completed">
                    <div className="td-done-top">
                      <TIcon name="flag" className="td-done-flag" />
                      <span>
                        <strong>Match Completed</strong>
                        <small>{lastResult.placement ? `Your team finished ${ordinal(lastResult.placement)} in the match.` : 'Your team’s result is recorded.'}</small>
                      </span>
                      <span className="td-place">
                        Place: <b>{lastResult.placement ? ordinal(lastResult.placement) : '—'}</b>
                      </span>
                    </div>
                    <div className="td-done-bottom">
                      <span>
                        <TIcon name="bars" /> Match Points: <b>+{lastResult.points}</b>
                      </span>
                      <span>
                        <TIcon name="layers" /> Total Points: <b>{lastStageTotal ?? lastResult.points}</b>
                      </span>
                    </div>
                  </section>
                )}
              </>
            ) : (
              <VersusNext entry={entry} next={next} teamId={teamId} />
            )}

            {/* The match's game room for its players (owner 2026-10-28). */}
            {next && <GameRoomCard key={next.id} matchId={next.id} />}

            {entry && <MyTeamStatusCard entry={entry} matches={bracket.length ? bracket : mine} br={brSummary} dashboardHref={dashboardHref} />}
            {entry && <TeamMembersCard entry={entry} myUsername={user?.username} onTeamChange={load} />}
          </>
        )}

        <p className="wt-hub-help">
          კითხვები გაქვს? <Link href="/support/chat">დაუკავშირდი მხარდაჭერას</Link>.
        </p>
      </section>
    </Layout>
  )
}

function matchLabel(m: PublicTournamentMatch): string {
  const stage = m.stage === TournamentMatchStage.Group && m.groupName ? `Group ${m.groupName}` : (STAGE_EN[m.stage] ?? STAGE_LABEL[m.stage])
  return m.roundLabel ? `${stage} • ${m.roundLabel}` : stage
}

// Round-7/33: the NEXT MATCH card of a battle-royale team.
function BrNextMatch({ match, now, cover }: { match: PublicTournamentMatch | null; now: number; cover: string | null }) {
  const at = match?.scheduledAt ? new Date(match.scheduledAt).getTime() : null
  const live = match?.status === TournamentMatchStatus.Live || (at !== null && at <= now)
  return (
    <section className="td-next" aria-label="Next match">
      <span className="td-next-art" style={cover ? { backgroundImage: `url('${cover}')` } : undefined} aria-hidden="true"></span>
      <div className="td-next-top">
        <span className="td-next-stage">
          <i aria-hidden="true"></i>
          <TIcon name="trophy" />
          {match ? (STAGE_EN[match.stage] ?? STAGE_LABEL[match.stage]) : 'Next Match'}
          <i aria-hidden="true"></i>
        </span>
        {match && (live ? <StatusPill kind="live" /> : <StatusPill kind="upcoming" />)}
      </div>
      <h2 className="td-next-title">NEXT MATCH</h2>
      {match ? (
        <>
          <span className="td-next-label">
            {match.stage === TournamentMatchStage.Group && match.groupName ? `Group ${match.groupName}` : (STAGE_EN[match.stage] ?? STAGE_LABEL[match.stage])}
            {match.roundLabel && (
              <>
                <i aria-hidden="true">•</i>
                {match.roundLabel}
              </>
            )}
          </span>
          <p className="td-next-starts">{live ? 'Match started — join the room!' : 'Starts in'}</p>
          <ClockBoxes ms={at === null ? null : Math.max(0, at - now)} />
          <div className="td-when">
            <span>
              <TIcon name="calendar" />
              {match.scheduledAt ? dayMonth(match.scheduledAt) : 'TBA'}
            </span>
            <span>
              <TIcon name="clock" />
              {match.scheduledAt ? tbilisiTime(match.scheduledAt) : 'TBA'}
            </span>
          </div>
        </>
      ) : (
        <p className="td-next-starts">მომავალი მატჩი ჯერ არ არის დაგეგმილი — განრიგს ტურნირის ადმინისტრაცია გამოაქვეყნებს.</p>
      )}
    </section>
  )
}

// Versus (CS2): the next-match panel as it was before round 7, now at the top.
function VersusNext({ entry, next, teamId }: { entry: MyTournamentEntry | null; next: PublicTournamentMatch | null; teamId: string | null }) {
  const mineSide = next && next.teamB && next.teamB.id === teamId ? 'b' : 'a'
  const me = next ? (mineSide === 'a' ? next.teamA : next.teamB) : null
  const opponent = next ? (mineSide === 'a' ? next.teamB : next.teamA) : null
  return (
    <section className="wt-panel wt-next">
      <header className="wt-panel-head">
        <h2>მომავალი მატჩი</h2>
        {entry && (
          <Link className="wt-pink-link" href={`/tournaments/${entry.tournament.id}/matches?team=${entry.team.id}`}>
            ყველას ნახვა <TIcon name="arrow" />
          </Link>
        )}
      </header>
      {next ? (
        <div className="wt-next-body">
          <div className="wt-next-vs">
            <span className="wt-next-team">
              <TeamMark team={me} className="lg" />
              <span>
                <strong>{me?.name ?? 'TBD'}</strong>
                <b className="wt-you">შენი გუნდი</b>
              </span>
            </span>
            <span className="wt-next-mid">
              <strong>VS</strong>
              <small>{next.roundLabel || STAGE_LABEL[next.stage]}</small>
              <small>Best of {next.bestOf}</small>
            </span>
            <span className="wt-next-team right">
              <span>
                <strong>{opponent?.name ?? 'TBD'}</strong>
              </span>
              <TeamMark team={opponent} className="lg" />
            </span>
          </div>
          <p className="wt-next-meta">
            <span>
              <TIcon name="calendar" />
              {next.scheduledAt ? kaDate(next.scheduledAt) : '—'}
            </span>
            <span>
              <TIcon name="clock" />
              {next.scheduledAt ? kaTime(next.scheduledAt) : '—'}
            </span>
            <span>
              <TIcon name="pin" />
              {next.map || '—'}
            </span>
          </p>
        </div>
      ) : (
        <p className="rules-pending">დაგეგმილი მატჩი ჯერ არ არის — განრიგს ტურნირის ადმინისტრაცია გამოაქვეყნებს.</p>
      )}
    </section>
  )
}
