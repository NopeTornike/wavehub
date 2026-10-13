import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { MatchPlayerStat, MatchTeamStats, PublicTournamentMatch, PublicTournamentSummary, TournamentTeamRef } from '@wavehub/shared-types'
import Layout from '../../../../components/Layout'
import { api, errorMessage } from '../../../../lib/api'
import { matchWinner, MATCH_STATUS_LABEL, STAGE_LABEL, TeamMark, TIcon, tournamentFormat } from '../../../../lib/tournaments'

// docs/design-mockups/07-match-details.jpg: scoreboard (teams, WINNER / DEFEATED, round, best-of,
// score), the match facts bar, each team's player table (kills, K/D, damage, rating, MVP, team total,
// coach) and Top Performers. Every number is what tournament staff recorded for this match; a stat
// nobody entered shows "—" and a performer card appears only when its stat exists.

type Line = MatchPlayerStat & { team: TournamentTeamRef | null }

const num = (value: number | null, digits = 0) => (value === null || value === undefined ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }))

function totals(stats: MatchTeamStats | null) {
  const players = stats?.players ?? []
  const sum = (key: 'kills' | 'damage') => {
    const values = players.map((p) => p[key]).filter((v): v is number => v !== null)
    return values.length ? values.reduce((a, b) => a + b, 0) : null
  }
  const avg = (key: 'kd' | 'rating') => {
    const values = players.map((p) => p[key]).filter((v): v is number => v !== null)
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  }
  return { kills: sum('kills'), damage: sum('damage'), kd: avg('kd'), rating: avg('rating') }
}

function TeamTable({ team, stats, side }: { team: TournamentTeamRef | null; stats: MatchTeamStats | null; side: 'a' | 'b' }) {
  const t = totals(stats)
  return (
    <section className={`wt-panel wt-team-stats side-${side}`}>
      <header>
        <TeamMark team={team} />
        <h2>{team?.name ?? 'TBD'}</h2>
        {stats?.coach && (
          <div className="wt-coach">
            <small>ქოუჩი</small>
            <strong>{stats.coach}</strong>
            <em>TEAM COACH</em>
          </div>
        )}
      </header>
      {!stats || stats.players.length === 0 ? (
        <p className="rules-pending">მოთამაშეების სტატისტიკა ჯერ არ გამოქვეყნებულა.</p>
      ) : (
        <div className="wt-stat-table" role="table">
          <div className="wt-stat-row head" role="row">
            <span>მოთამაშე</span>
            <span>Kills</span>
            <span>K/D</span>
            <span>Damage</span>
            <span>Rating</span>
          </div>
          {stats.players.map((p) => (
            <div key={p.name} className={`wt-stat-row${p.mvp ? ' mvp' : ''}`} role="row">
              <span className="wt-player">
                <i aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</i>
                <span>
                  {p.mvp && <b>★ MVP</b>}
                  <strong>{p.name}</strong>
                </span>
              </span>
              <span className="accent">{num(p.kills)}</span>
              <span>{num(p.kd, 2)}</span>
              <span>{num(p.damage)}</span>
              <span className="accent">{num(p.rating, 1)}</span>
            </div>
          ))}
          <div className="wt-stat-row total" role="row">
            <span>TEAM TOTAL</span>
            <span>{num(t.kills)}</span>
            <span>{num(t.kd, 2)}</span>
            <span>{num(t.damage)}</span>
            <span>{num(t.rating, 2)}</span>
          </div>
        </div>
      )}
    </section>
  )
}

export default function MatchDetails() {
  const router = useRouter()
  const { id, matchId } = router.query as { id?: string; matchId?: string }
  const [match, setMatch] = useState<PublicTournamentMatch | null>(null)
  const [tournament, setTournament] = useState<PublicTournamentSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id || !matchId) return
    Promise.all([api.getTournamentMatch(id, matchId), api.getTournament(id)])
      .then(([m, t]) => {
        setMatch(m)
        setTournament(t)
      })
      .catch((err) => setError(errorMessage(err, 'მატჩი ვერ მოიძებნა.')))
  }, [id, matchId])

  if (!match) {
    return (
      <Layout title="მატჩი" noIndex={!!error}>
        <section className="wt-page">{error ? <div className="wt-empty"><strong>{error}</strong><p><Link href="/tournaments">ტურნირები</Link></p></div> : <div className="marketplace-empty">იტვირთება…</div>}</section>
      </Layout>
    )
  }

  const winner = matchWinner(match)
  const lines: Line[] = [
    ...(match.stats.a?.players ?? []).map((p) => ({ ...p, team: match.teamA })),
    ...(match.stats.b?.players ?? []).map((p) => ({ ...p, team: match.teamB })),
  ]
  const best = (key: 'kills' | 'damage' | 'assists') =>
    lines.filter((l) => l[key] !== null).sort((x, y) => (y[key] ?? 0) - (x[key] ?? 0))[0] ?? null
  const mvp = lines.find((l) => l.mvp) ?? null
  const performers: Array<[key: string, label: string, icon: string, line: Line | null, value: string, unit: string]> = [
    ['most-kills', 'მეტი მკვლელობა', 'crosshair', best('kills'), num(best('kills')?.kills ?? null), 'KILLS'],
    ['mvp', 'MVP', 'star', mvp, num(mvp?.kd ?? null, 2), 'K/D'],
    ['most-damage', 'მეტი დაზიანება', 'burst', best('damage'), num(best('damage')?.damage ?? null), 'DAMAGE'],
    ['most-assists', 'მეტი ასისტი', 'hands', best('assists'), num(best('assists')?.assists ?? null), 'ASSISTS'],
  ]
  const winnerName = winner === 'a' ? match.teamA?.name : winner === 'b' ? match.teamB?.name : null

  return (
    <Layout title={`${match.teamA?.name ?? 'TBD'} vs ${match.teamB?.name ?? 'TBD'}`}>
      <section className="wt-page wt-match">
        <Link className="wt-back" href="/tournaments/hub">
          <TIcon name="back" /> ტურნირის ჰაბზე დაბრუნება
        </Link>
        <header className="wt-page-title">
          <h1>მატჩის დეტალები</h1>
          <p>
            {match.tournamentName} — მატჩის დეტალური მიმოხილვა.
          </p>
        </header>

        <section className="wt-scoreboard">
          <div className={`wt-score-team side-a${winner === 'a' ? ' won' : winner === 'b' ? ' lost' : ''}`}>
            <TeamMark team={match.teamA} className="lg" />
            <span>
              <strong>{match.teamA?.name ?? 'TBD'}</strong>
              {winner && <em>{winner === 'a' ? 'WINNER' : 'DEFEATED'}</em>}
            </span>
          </div>
          <div className="wt-score-center">
            <small>
              {match.roundLabel || STAGE_LABEL[match.stage]} • BEST OF {match.bestOf}
            </small>
            <div className="wt-score">
              <b className={winner === 'b' ? 'lost' : ''}>{match.scoreA ?? '–'}</b>
              <i>:</i>
              <b className={winner === 'a' ? 'lost' : ''}>{match.scoreB ?? '–'}</b>
            </div>
            <span className={`wt-score-pill ${match.status}`}>{winnerName ? `${winnerName} won` : MATCH_STATUS_LABEL[match.status]}</span>
          </div>
          <div className={`wt-score-team side-b${winner === 'b' ? ' won' : winner === 'a' ? ' lost' : ''}`}>
            <span>
              <strong>{match.teamB?.name ?? 'TBD'}</strong>
              {winner && <em>{winner === 'b' ? 'WINNER' : 'DEFEATED'}</em>}
            </span>
            <TeamMark team={match.teamB} className="lg" />
          </div>
        </section>

        <section className="wt-facts-bar">
          {(
            [
              ['target', 'რაუნდი', match.roundLabel || STAGE_LABEL[match.stage]],
              ['map', 'რუკა', match.map || '—'],
              ['calendar', 'თარიღი', match.scheduledAt ? new Date(match.scheduledAt).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
              ['clock', 'დრო', match.scheduledAt ? new Date(match.scheduledAt).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' }) : '—'],
              ['users', 'მატჩის ტიპი', tournament ? tournamentFormat(tournament) : '—'],
            ] as const
          ).map(([icon, label, value]) => (
            <div key={label}>
              <TIcon name={icon} />
              <span>
                <small>{label}</small>
                <strong>{value}</strong>
              </span>
            </div>
          ))}
        </section>

        <div className="wt-team-stats-grid">
          <TeamTable team={match.teamA} stats={match.stats.a} side="a" />
          <TeamTable team={match.teamB} stats={match.stats.b} side="b" />
        </div>

        {lines.length > 0 && (
          <section className="wt-panel wt-performers">
            <h2>საუკეთესო მოთამაშეები</h2>
            <div>
              {performers.map(([key, label, icon, line, value, unit]) =>
                line ? (
                  <article key={key} className={`wt-performer ${key}`}>
                    <small>
                      <TIcon name={icon} />
                      {label}
                    </small>
                    <i aria-hidden="true">{line.name.slice(0, 1).toUpperCase()}</i>
                    <span>
                      <strong>{line.name}</strong>
                      <em>{line.team?.name ?? ''}</em>
                    </span>
                    <b>
                      {value}
                      <small>{unit}</small>
                    </b>
                  </article>
                ) : null,
              )}
            </div>
          </section>
        )}

        <div className="wt-match-actions">
          <Link className="wt-outline-btn lg" href={`/tournaments/hub?t=${match.tournamentId}#bracket`}>
            <TIcon name="bracket" /> სრული ბრეკეტი
          </Link>
          <Link className="wt-primary-btn" href="/tournaments/hub">
            <TIcon name="back" /> ტურნირის ჰაბზე დაბრუნება
          </Link>
        </div>
      </section>
    </Layout>
  )
}
