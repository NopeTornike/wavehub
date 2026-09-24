import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MyTournamentEntry, PublicTournamentMatch, TournamentTeamRef } from '@wavehub/shared-types'
import { TournamentMatchStage, TournamentMatchStatus, TournamentStatus, TournamentTeamStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useShell } from '../../lib/shell'
import { formatDay, matchWinner, STAGE_LABEL, TeamMark, TIcon, tournamentCover, tournamentFormat } from '../../lib/tournaments'

// docs/design-mockups/10-tournament-hub.jpg, for the signed-in user: the selected registration
// (status: pending verification / verified / rejected), four stats (active registrations, upcoming
// matches, wins, win rate — all from recorded matches of the user's teams), the next match with a
// live countdown to its scheduled time, and the bracket for the selected tournament: group tables
// (W-L from completed group matches) plus semi-final and final slots from the recorded playoff
// matches ("TBD" until staff record them).

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [target])
  if (!target) return null
  const ms = Math.max(0, new Date(target).getTime() - now)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return { h, m, s, done: ms === 0 }
}

type Standing = { team: TournamentTeamRef; wins: number; losses: number }

function groupTables(matches: PublicTournamentMatch[]): Array<[string, Standing[]]> {
  const groups = new Map<string, Map<string, Standing>>()
  for (const m of matches.filter((x) => x.stage === TournamentMatchStage.Group)) {
    const key = m.groupName || 'A'
    const table = groups.get(key) ?? new Map<string, Standing>()
    groups.set(key, table)
    for (const team of [m.teamA, m.teamB]) if (team && !table.has(team.id)) table.set(team.id, { team, wins: 0, losses: 0 })
    const winner = matchWinner(m)
    if (winner && m.teamA && m.teamB) {
      const [w, l] = winner === 'a' ? [m.teamA, m.teamB] : [m.teamB, m.teamA]
      table.get(w.id)!.wins += 1
      table.get(l.id)!.losses += 1
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, table]) => [name, [...table.values()].sort((x, y) => y.wins - x.wins || x.losses - y.losses || x.team.name.localeCompare(y.team.name))])
}

function Slot({ team }: { team: TournamentTeamRef | null }) {
  return (
    <span className="wt-slot">
      <TeamMark team={team} />
      {team?.name ?? 'TBD'}
    </span>
  )
}

export default function TournamentHub() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const { games } = useShell()
  const userId = user?.id
  const [entries, setEntries] = useState<MyTournamentEntry[] | null>(null)
  const [myMatches, setMyMatches] = useState<PublicTournamentMatch[]>([])
  const [bracket, setBracket] = useState<PublicTournamentMatch[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [loadedAt, setLoadedAt] = useState(0)

  useEffect(() => {
    if (checked && !user) router.replace('/login?next=/tournaments/hub')
  }, [checked, user, router])

  const load = useCallback(() => {
    if (!userId) return
    Promise.all([api.listMyTournaments(), api.listMyTournamentMatches()])
      .then(([rows, matches]) => {
        setEntries(rows)
        setMyMatches(matches)
        setLoadedAt(Date.now())
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
    api
      .listTournamentMatches(selected)
      .then(setBracket)
      .catch(() => setBracket([]))
  }, [selected])

  const slugById = useMemo(() => new Map(games.map((g) => [g.gameId, g.slug])), [games])
  const entry = entries?.find((e) => e.tournament.id === selected) ?? null
  const myTeamIds = new Set((entries ?? []).map((e) => e.team.id))
  const completed = myMatches.filter((m) => matchWinner(m))
  const wins = completed.filter((m) => {
    const w = matchWinner(m)
    return (w === 'a' && m.teamA && myTeamIds.has(m.teamA.id)) || (w === 'b' && m.teamB && myTeamIds.has(m.teamB.id))
  }).length
  const upcoming = myMatches
    .filter((m) => m.status !== TournamentMatchStatus.Completed && m.scheduledAt && new Date(m.scheduledAt).getTime() > loadedAt - 3_600_000)
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
  const next = upcoming[0] ?? null
  const countdown = useCountdown(next?.scheduledAt ?? null)
  const activeCount = (entries ?? []).filter((e) => e.tournament.status !== TournamentStatus.Completed).length
  const winRate = completed.length ? Math.round((wins / completed.length) * 100) : null

  const nextMine = next && next.teamB && myTeamIds.has(next.teamB.id) ? 'b' : 'a'
  const me = next ? (nextMine === 'a' ? next.teamA : next.teamB) : null
  const opponent = next ? (nextMine === 'a' ? next.teamB : next.teamA) : null

  const tables = groupTables(bracket)
  const semis = bracket.filter((m) => m.stage === TournamentMatchStage.SemiFinal).slice(0, 2)
  const final = bracket.find((m) => m.stage === TournamentMatchStage.Final) ?? null
  const finalWinner = final ? matchWinner(final) : null
  const champion = finalWinner === 'a' ? final?.teamA : finalWinner === 'b' ? final?.teamB : null

  const regStatus = entry?.team.status
  const statusCopy =
    regStatus === TournamentTeamStatus.Verified
      ? ['დადასტურებული', 'verified', 'შენი გუნდი დადასტურებულია — მონაწილეობ ტურნირში.']
      : regStatus === TournamentTeamStatus.Rejected
        ? ['უარყოფილი', 'rejected', 'რეგისტრაცია უარყოფილია. დეტალებისთვის მიმართე მხარდაჭერას.']
        : ['დადასტურების მოლოდინში', 'pending', 'ჩვენი გუნდი გადაამოწმებს მონაცემებს და მალე დაადასტურებს მონაწილეობას.']

  return (
    <Layout title="ტურნირის ჰაბი" noIndex>
      <section className="wt-page wt-hub">
        <header className="wt-page-title row">
          <div>
            <h1>ტურნირის ჰაბი</h1>
            <p>შენი ტურნირების ყველა ინფორმაცია ერთ ადგილას.</p>
          </div>
          <button type="button" className="wt-outline-btn" onClick={() => {
              setRefreshing(true)
              load()
            }}
            disabled={refreshing}>
            <TIcon name="refresh" /> განახლება
          </button>
        </header>

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
              <Link href="/tournaments">აირჩიე ტურნირი</Link> და დაარეგისტრირე გუნდი — აქ გამოჩნდება მატჩები, სტატისტიკა და ბრეკეტი.
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

            {entry && (
              <section className="wt-hub-reg">
                <Link
                  className="wt-hub-cover"
                  href={`/tournaments/${entry.tournament.id}`}
                  style={(() => {
                    const c = tournamentCover(entry.tournament, slugById)
                    return c ? { backgroundImage: `url('${c}')` } : undefined
                  })()}
                  aria-label={entry.tournament.name}
                ></Link>
                <div className="wt-hub-reg-copy">
                  <span className="wt-badge upcoming">დარეგისტრირებული</span>
                  <h2>{entry.tournament.name}</h2>
                  <p className="wt-card-meta">
                    <span>
                      <TIcon name="users" />
                      {tournamentFormat(entry.tournament)}
                    </span>
                    <i aria-hidden="true"></i>
                    <span>
                      <TIcon name="globe" />
                      {entry.tournament.details?.region || entry.tournament.gameName}
                    </span>
                  </p>
                  <p className="wt-card-meta">
                    <span>
                      <TIcon name="calendar" />
                      {formatDay(entry.tournament.startDate)}
                    </span>
                    {entry.tournament.details?.startTime && (
                      <>
                        <i aria-hidden="true"></i>
                        <span>
                          <TIcon name="clock" />
                          {entry.tournament.details.startTime}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="wt-hub-status">
                  <small>რეგისტრაციის სტატუსი</small>
                  <strong className={statusCopy[1]}>
                    <TIcon name={statusCopy[1] === 'verified' ? 'shield' : 'clock'} />
                    {statusCopy[0]}
                  </strong>
                  <p>{statusCopy[2]}</p>
                  <Link className="wt-outline-btn" href={`/tournaments/${entry.tournament.id}`}>
                    დეტალების ნახვა
                  </Link>
                </div>
              </section>
            )}

            <section className="wt-stat-cards">
              {(
                [
                  ['trophy', 'ტურნირები', String(activeCount), 'აქტიური რეგისტრაცია', 'violet'],
                  ['calendar', 'მომავალი მატჩები', String(upcoming.length), next ? 'შემდეგი მატჩი' : 'განრიგი მალე', 'pink'],
                  ['chart', 'მოგებები', String(wins), 'სულ', 'green'],
                  ['trend', 'მოგების %', winRate === null ? '—' : `${winRate}%`, 'სულ', 'blue'],
                ] as const
              ).map(([icon, label, value, sub, tone]) => (
                <article key={label} className={`wt-stat-card ${tone}`}>
                  <TIcon name={icon} />
                  <span>
                    <small>{label}</small>
                    <strong>{value}</strong>
                    <em>{sub}</em>
                  </span>
                </article>
              ))}
            </section>

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
                        <b className="wt-you">შენ</b>
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
                      {next.scheduledAt ? new Date(next.scheduledAt).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                    <span>
                      <TIcon name="clock" />
                      {next.scheduledAt ? new Date(next.scheduledAt).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                    <span>
                      <TIcon name="pin" />
                      {next.map || '—'}
                    </span>
                  </p>
                  <div className="wt-countdown">
                    <small>მატჩი იწყება</small>
                    {countdown && (
                      <div>
                        {(
                          [
                            [countdown.h, 'სთ'],
                            [countdown.m, 'წთ'],
                            [countdown.s, 'წმ'],
                          ] as const
                        ).map(([value, unit], i) => (
                          <span key={unit}>
                            {i > 0 && <i>:</i>}
                            <span className="wt-cd">
                              <b>{String(value).padStart(2, '0')}</b>
                              <small>{unit}</small>
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                    <Link className="wt-primary-btn" href={`/tournaments/${next.tournamentId}/matches/${next.id}`}>
                      მატჩის დეტალები
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="rules-pending">დაგეგმილი მატჩი ჯერ არ არის — განრიგს ტურნირის ადმინისტრაცია გამოაქვეყნებს.</p>
              )}
            </section>

            <section className="wt-panel wt-bracket" id="bracket">
              <header className="wt-panel-head">
                <div>
                  <h2>ტურნირის ბრეკეტი</h2>
                  {entry && (
                    <p>
                      <TIcon name="shield" /> {entry.tournament.name}
                    </p>
                  )}
                </div>
                {entry && (
                  <Link className="wt-pink-link" href={`/tournaments/${entry.tournament.id}/matches`}>
                    ყველა მატჩი <TIcon name="arrow" />
                  </Link>
                )}
              </header>
              {bracket.length === 0 ? (
                <p className="rules-pending">ბრეკეტი გამოჩნდება, როცა ადმინისტრაცია მატჩებს დაამატებს.</p>
              ) : (
                <div className="wt-bracket-grid">
                  {tables.map(([name, rows]) => (
                    <div key={name} className="wt-group-table">
                      <header>
                        <strong>ჯგუფი {name}</strong>
                        <small>W - L</small>
                      </header>
                      {rows.map((row, i) => (
                        <p key={row.team.id} className={myTeamIds.has(row.team.id) ? 'mine' : undefined}>
                          <span>{i + 1}</span>
                          <TeamMark team={row.team} />
                          <strong>{row.team.name}</strong>
                          <b className={row.wins > row.losses ? 'up' : row.wins < row.losses ? 'down' : ''}>
                            {row.wins} - {row.losses}
                          </b>
                        </p>
                      ))}
                    </div>
                  ))}
                  <div className="wt-bracket-stage">
                    <strong>ნახევარფინალი</strong>
                    {(semis.length ? semis : [null, null]).map((m, i) => (
                      <div key={m?.id ?? i} className="wt-bracket-match">
                        <Slot team={m?.teamA ?? null} />
                        <Slot team={m?.teamB ?? null} />
                      </div>
                    ))}
                  </div>
                  <div className="wt-bracket-stage final">
                    <strong>ფინალი</strong>
                    <div className="wt-bracket-final">
                      <TIcon name="trophy" />
                      {champion ? <b>{champion.name}</b> : final ? <b>{`${final.teamA?.name ?? 'TBD'} vs ${final.teamB?.name ?? 'TBD'}`}</b> : <b>TBD</b>}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        <p className="wt-hub-help">
          კითხვები გაქვს? <Link href="/support">დაუკავშირდი მხარდაჭერას</Link>.
        </p>
      </section>
    </Layout>
  )
}
