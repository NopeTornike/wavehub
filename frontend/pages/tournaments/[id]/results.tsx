import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MatchTeamResult, PublicTournamentMatch, PublicTournamentSummary, PublicTournamentTeam } from '@wavehub/shared-types'
import { BR_PLACEMENT_POINTS, TournamentMatchStage, TournamentMatchStatus } from '@wavehub/shared-types'
import Layout from '../../../components/Layout'
import { StatusPill, dayMonth, tbilisiTime, TournamentBanner } from '../../../components/tournaments/TournamentStages'
import { api, errorMessage } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { useShell } from '../../../lib/shell'
import { TeamMark, TIcon, tournamentCover } from '../../../lib/tournaments'

// Match Results (owner 2026-11-19, the "Match Results — Group A • Match 4/5" screen): a battle-royale
// lobby match's table — place, team, players, kills, placement points, total — and, under it, the
// player stats of the team the viewer taps (kills, damage, assists, survival). Reached from the
// Tournament Dashboard's "Matches & Results" button; versus (CS2) tournaments keep their Team X vs
// Team Y match pages. Every number is what staff entered in Admin → Tournaments.

const STAGE_ORDER: Record<string, number> = { group: 0, round: 1, quarterfinal: 2, semifinal: 3, final: 4 }
const STAGE_EN: Partial<Record<TournamentMatchStage, string>> = {
  [TournamentMatchStage.Group]: 'Group Stage',
  [TournamentMatchStage.QuarterFinal]: 'Quarterfinal',
  [TournamentMatchStage.SemiFinal]: 'Semifinal',
  [TournamentMatchStage.Final]: 'Final',
}
const SHORT: Partial<Record<TournamentMatchStage, string>> = {
  [TournamentMatchStage.QuarterFinal]: 'QF',
  [TournamentMatchStage.SemiFinal]: 'SF',
  [TournamentMatchStage.Final]: 'Final',
}

const where = (m: PublicTournamentMatch) => (m.stage === TournamentMatchStage.Group && m.groupName ? `Group ${m.groupName}` : (STAGE_EN[m.stage] ?? m.stage))
const roundNo = (m: PublicTournamentMatch) => Number(/(\d+)/.exec(m.roundLabel ?? '')?.[1] ?? 0)
const placePoints = (r: MatchTeamResult) => (r.placement && r.placement > 0 ? (BR_PLACEMENT_POINTS[r.placement - 1] ?? 0) : 0)
const survival = (s: number | null) => (s === null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)
const n = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-US'))

export default function MatchResultsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { games } = useShell()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  const wanted = typeof router.query.match === 'string' ? router.query.match : ''
  const [tournament, setTournament] = useState<PublicTournamentSummary | null>(null)
  const [matches, setMatches] = useState<PublicTournamentMatch[] | null>(null)
  const [teams, setTeams] = useState<PublicTournamentTeam[]>([])
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [openTeam, setOpenTeam] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    Promise.all([api.getTournament(id), api.listTournamentMatches(id), api.listTournamentTeams(id).catch(() => [] as PublicTournamentTeam[])])
      .then(([t, list, ts]) => {
        if (!alive) return
        setTournament(t)
        setMatches(list)
        setTeams(ts)
      })
      .catch((err) => alive && setError(errorMessage(err, 'შედეგები ვერ ჩაიტვირთა.')))
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    if (!user?.id || !id) return
    let alive = true
    api
      .listMyTournaments()
      .then((rows) => alive && setMyTeamId(rows.find((r) => r.tournament.id === id)?.team.id ?? null))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [user?.id, id])

  const slugById = useMemo(() => new Map(games.map((g) => [g.gameId, g.slug])), [games])
  const sorted = useMemo(
    () =>
      [...(matches ?? [])].sort(
        (a, b) =>
          (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9) ||
          (a.groupName ?? '').localeCompare(b.groupName ?? '') ||
          roundNo(a) - roundNo(b) ||
          (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''),
      ),
    [matches],
  )
  // Default: the asked-for match, else the latest completed one, else the first.
  const match =
    sorted.find((m) => m.id === wanted) ??
    [...sorted].reverse().find((m) => m.status === TournamentMatchStatus.Completed && m.results.length > 0) ??
    sorted[0] ??
    null
  const rows = match ? [...match.results].sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999) || b.points - a.points) : []
  // The open team: the tapped one, else my team, else the winner.
  const shown = rows.find((r) => r.team.id === openTeam) ?? rows.find((r) => r.team.id === myTeamId) ?? rows[0] ?? null
  const rosterSize = (teamId: string) => teams.find((t) => t.id === teamId)?.players.length || tournament?.teamSize || 0

  const pick = (matchId: string) => {
    setOpenTeam(null)
    void router.replace({ pathname: `/tournaments/${id}/results`, query: { match: matchId } }, undefined, { shallow: true, scroll: false })
  }
  const openRow = (teamId: string) => {
    setOpenTeam(teamId)
    window.requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  if (error || !tournament || matches === null) {
    return (
      <Layout title="Match Results" noIndex={!!error}>
        <section className="wt-page td-page">
          {error ? (
            <div className="wt-empty">
              <strong>{error}</strong>
              <p>
                <Link href="/tournaments">ტურნირები</Link>
              </p>
            </div>
          ) : (
            <div className="marketplace-empty">იტვირთება…</div>
          )}
        </section>
      </Layout>
    )
  }

  const subtitle = match ? `${where(match)}${match.roundLabel ? ` • ${match.roundLabel}` : ''}` : ''
  const live = match?.status === TournamentMatchStatus.Live

  return (
    <Layout title={`Match Results — ${tournament.name}`} description={`${tournament.name}: battle-royale match results.`}>
      <section className="wt-page td-page mr-page">
        <TournamentBanner tournament={tournament} cover={tournamentCover(tournament, slugById)} href={`/tournaments/${tournament.id}`} />

        <header className="mr-title">
          <Link className="mr-back" href={`/tournaments/${tournament.id}/dashboard`} aria-label="Tournament Dashboard">
            <TIcon name="chevronLeft" />
          </Link>
          <span>
            <h1>Match Results</h1>
            {subtitle && <p>{subtitle}</p>}
          </span>
          {match && (live ? <StatusPill kind="live" /> : match.status === TournamentMatchStatus.Completed ? <StatusPill kind="done" /> : <StatusPill kind="upcoming" />)}
        </header>

        {sorted.length === 0 ? (
          <div className="wt-empty">
            <TIcon name="calendar" />
            <strong>მატჩები ჯერ არ არის დაგეგმილი</strong>
            <p>განრიგს და შედეგებს ტურნირის ადმინისტრაცია გამოაქვეყნებს.</p>
          </div>
        ) : (
          <>
            <nav className="mr-matches" aria-label="მატჩები">
              {sorted.map((m) => (
                <button key={m.id} type="button" className={`mr-chip ${m.status}${match?.id === m.id ? ' active' : ''}`} aria-current={match?.id === m.id ? 'true' : undefined} onClick={() => pick(m.id)}>
                  <i aria-hidden="true"></i>
                  {m.stage === TournamentMatchStage.Group && m.groupName ? m.groupName : (SHORT[m.stage] ?? m.stage)}
                  <span>{m.roundLabel?.replace(/^Match\s*/i, '') || '—'}</span>
                </button>
              ))}
            </nav>

            {match && (
              <div className="mr-facts">
                <span>
                  <TIcon name="calendar" />
                  {match.scheduledAt ? dayMonth(match.scheduledAt) : 'TBA'}
                </span>
                <span>
                  <TIcon name="clock" />
                  {match.scheduledAt ? tbilisiTime(match.scheduledAt) : 'TBA'}
                </span>
                <span>
                  <TIcon name="users" />
                  {where(match)}
                </span>
                <span>
                  <TIcon name="gamepad" />
                  {match.roundLabel || 'Match'}
                </span>
              </div>
            )}

            {match && rows.length === 0 ? (
              <div className="wt-empty mr-pending">
                <TIcon name="clock" />
                <strong>{live ? 'მატჩი მიმდინარეობს' : 'შედეგები ჯერ არ არის'}</strong>
                <p>შედეგები — ადგილი, Kills და ქულები — მატჩის შემდეგ გამოქვეყნდება.</p>
              </div>
            ) : (
              <section className="mr-card" aria-label="მატჩის შედეგები">
                <div className="mr-table" role="table">
                  <div className="mr-tr mr-th" role="row">
                    <span role="columnheader">#</span>
                    <span role="columnheader">Team</span>
                    <span role="columnheader" className="mr-col-players">
                      Players
                    </span>
                    <span role="columnheader">Kills</span>
                    <span role="columnheader">Place Pts</span>
                    <span role="columnheader">Total Pts</span>
                    <span aria-hidden="true"></span>
                  </div>
                  {rows.map((r) => {
                    const open = shown?.team.id === r.team.id
                    const medal = r.placement && r.placement <= 3 ? ` m${r.placement}` : ''
                    return (
                      <button
                        key={r.team.id}
                        type="button"
                        role="row"
                        className={`mr-tr${medal}${open ? ' open' : ''}${r.team.id === myTeamId ? ' mine' : ''}`}
                        aria-expanded={open}
                        aria-controls="mrPlayers"
                        onClick={() => openRow(r.team.id)}
                      >
                        <span role="cell" className="mr-rank">
                          <b>{r.placement ?? '—'}</b>
                        </span>
                        <span role="cell" className="mr-team">
                          <TeamMark team={r.team} />
                          <strong>{r.team.name}</strong>
                        </span>
                        <span role="cell" className="mr-col-players">
                          <TIcon name="users" />
                          {r.players.length || rosterSize(r.team.id) || '—'}
                        </span>
                        <span role="cell">{r.kills}</span>
                        <span role="cell">+{placePoints(r)}</span>
                        <span role="cell" className="mr-total">
                          {r.points}
                        </span>
                        <span role="cell" className="mr-chev" aria-hidden="true">
                          <TIcon name="chevron" />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {shown && (
              <section className="mr-card mr-players" id="mrPlayers" ref={panelRef} aria-label={`${shown.team.name} — Player Stats`}>
                <header className="mr-players-head">
                  <TeamMark team={shown.team} />
                  <h2>
                    {shown.team.name} <span>– Player Stats</span>
                  </h2>
                  <span className="mr-totals">
                    <span>
                      Total Kills: <b>{shown.kills}</b>
                    </span>
                    <i aria-hidden="true"></i>
                    <span>
                      Total Pts: <b>{shown.points}</b>
                    </span>
                  </span>
                </header>
                {shown.players.length === 0 ? (
                  <p className="td-empty">ამ გუნდის მოთამაშეების სტატისტიკა ამ მატჩზე არ შეყვანილა.</p>
                ) : (
                  <div className="mr-ptable" role="table">
                    <div className="mr-ptr mr-th" role="row">
                      <span role="columnheader">#</span>
                      <span role="columnheader">Player</span>
                      <span role="columnheader">Kills</span>
                      <span role="columnheader">Damage</span>
                      <span role="columnheader">Assists</span>
                      <span role="columnheader">Survival</span>
                    </div>
                    {[...shown.players]
                      .sort((a, b) => b.kills - a.kills || (b.damage ?? 0) - (a.damage ?? 0))
                      .map((p, i) => (
                        <div key={`${p.name}-${i}`} className="mr-ptr" role="row">
                          <span role="cell" className="mr-pno">
                            {i + 1}
                          </span>
                          <span role="cell" className="mr-player">
                            <i className={p.avatarUrl ? 'has-photo' : undefined} style={p.avatarUrl ? { backgroundImage: `url("${p.avatarUrl}")` } : undefined} aria-hidden="true">
                              {p.avatarUrl ? '' : p.name.slice(0, 1).toUpperCase()}
                            </i>
                            {p.username ? <Link href={`/u/${encodeURIComponent(p.username)}`}>{p.name}</Link> : <strong>{p.name}</strong>}
                          </span>
                          <span role="cell">{p.kills}</span>
                          <span role="cell">{n(p.damage)}</span>
                          <span role="cell">{n(p.assists)}</span>
                          <span role="cell">{survival(p.survival)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        <p className="mr-legend">
          <TIcon name="info" /> Total Pts = Place Pts (1st 10, 2nd 6, 3rd 5, 4th 4, 5th 3, 6th 2, 7th–8th 1) + 1 per Kill.
        </p>
      </section>
    </Layout>
  )
}
