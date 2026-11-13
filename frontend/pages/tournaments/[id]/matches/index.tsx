import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import type { MyTournamentEntry, PublicTournamentMatch, PublicTournamentSummary, PublicTournamentTeam } from '@wavehub/shared-types'
import { TournamentMatchStage, TournamentMatchStatus } from '@wavehub/shared-types'
import Layout from '../../../../components/Layout'
import { api, errorMessage } from '../../../../lib/api'
import { useAuth } from '../../../../lib/auth'
import { useShell } from '../../../../lib/shell'
import {
  formatDateTime,
  matchWinner,
  MATCH_STATUS_LABEL,
  STAGE_LABEL,
  TeamMark,
  TIcon,
  TOURNAMENT_BADGE,
  tournamentCover,
  tournamentDates,
  tournamentFormat,
} from '../../../../lib/tournaments'

// docs/design-mockups/08-tournament-match-history.jpg: the tournament header (cover, status, dates,
// server, format, "Your Team"), then Match History as round-6/04 cards (owner 2026-11-10) — stage +
// round, date, the two teams with the score between them, win / loss from the viewed team's side,
// map / format / result and Details. Matches are what
// tournament staff recorded. The viewed team is ?team=… (from the Teams tab), else the viewer's own.

type Filter = 'all' | 'group' | 'playoffs'

export default function MatchHistory() {
  const router = useRouter()
  const { id, team: teamParam } = router.query as { id?: string; team?: string }
  const { user } = useAuth()
  const { games } = useShell()
  const userId = user?.id
  const [tournament, setTournament] = useState<PublicTournamentSummary | null>(null)
  const [matches, setMatches] = useState<PublicTournamentMatch[] | null>(null)
  const [teams, setTeams] = useState<PublicTournamentTeam[]>([])
  const [mine, setMine] = useState<MyTournamentEntry | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([api.getTournament(id), api.listTournamentMatches(id), api.listTournamentTeams(id).catch(() => [])])
      .then(([t, m, teamRows]) => {
        setTournament(t)
        setMatches(m)
        setTeams(teamRows)
      })
      .catch((err) => {
        setMatches([])
        setError(errorMessage(err, 'მატჩების ჩატვირთვა ვერ მოხერხდა.'))
      })
  }, [id])

  useEffect(() => {
    if (!userId || !id) return
    api
      .listMyTournaments()
      .then((rows) => setMine(rows.find((row) => row.tournament.id === id) ?? null))
      .catch(() => undefined)
  }, [userId, id])

  const slugById = useMemo(() => new Map(games.map((g) => [g.gameId, g.slug])), [games])
  const focusTeam = teams.find((t) => t.id === teamParam) ?? mine?.team ?? null
  const focusId = focusTeam?.id ?? null

  const br = tournament?.format === 'battle_royale'
  const viewedTeam = teams.find((t) => t.id === teamParam) ?? null
  // Battle royale (owner 2026-11-14): a team plays the matches it has a result in, else its group's.
  const playsIn = (m: PublicTournamentMatch, teamId: string) =>
    m.teamA?.id === teamId ||
    m.teamB?.id === teamId ||
    m.results.some((r) => r.team.id === teamId) ||
    (br && !m.results.length && m.stage === TournamentMatchStage.Group && !!viewedTeam?.groupName && m.groupName === viewedTeam.groupName)
  const shown = (matches ?? [])
    .filter((m) => !teamParam || playsIn(m, teamParam))
    .filter((m) => filter === 'all' || (filter === 'group' ? m.stage === TournamentMatchStage.Group : m.stage !== TournamentMatchStage.Group))

  const cover = tournament ? tournamentCover(tournament, slugById) : null

  return (
    <Layout title={tournament ? `${tournament.name} — მატჩები` : 'მატჩები'}>
      <section className="wt-page wt-history">
        {id && (
          <span className="wt-info-links">
            <Link className="wt-tournament-info-link" href={`/tournaments/${id}/dashboard`}>
              Tournament Dashboard <TIcon name="chevron" />
            </Link>
            <Link className="wt-tournament-info-link" href={`/tournaments/${id}`}>
              ტურნირის სრული ინფოს ნახვა <TIcon name="chevron" />
            </Link>
          </span>
        )}
        <Link className="wt-back" href={mine ? '/tournaments/mine' : id ? `/tournaments/${id}` : '/tournaments'}>
          <TIcon name="back" /> {mine ? 'ჩემს ტურნირებზე დაბრუნება' : 'ტურნირზე დაბრუნება'}
        </Link>

        {tournament && (
          <header className="wt-history-head">
            <Link className="wt-history-cover" href={`/tournaments/${tournament.id}`} style={cover ? { backgroundImage: `url('${cover}')` } : undefined} aria-label={tournament.name}></Link>
            <div className="wt-history-copy">
              <span className={`wt-badge ${TOURNAMENT_BADGE[tournament.status][1]}`}>
                <i aria-hidden="true"></i>
                {TOURNAMENT_BADGE[tournament.status][0]}
              </span>
              <h1>{tournament.name}</h1>
              <p className="wt-card-meta">
                <span>
                  <TIcon name="calendar" />
                  {tournamentDates(tournament)}
                </span>
                <i aria-hidden="true"></i>
                <span>
                  <TIcon name="globe" />
                  {tournament.details?.region || tournament.gameName}
                </span>
                <i aria-hidden="true"></i>
                <span>
                  <TIcon name="users" />
                  {tournamentFormat(tournament)}
                </span>
              </p>
              {focusTeam && (
                <div className="wt-your-team">
                  <TeamMark team={focusTeam} />
                  <span>
                    <small>{teamParam ? 'გუნდი' : 'შენი გუნდი'}</small>
                    <strong>{focusTeam.name}</strong>
                  </span>
                </div>
              )}
            </div>
            <div className="wt-history-art" aria-hidden="true">
              <TIcon name="trophy" />
              <p>
                BIGGER BATTLES
                <br />
                GREATER VICTORIES
              </p>
              <span>W A V E H U B X</span>
            </div>
          </header>
        )}

        <section className="wt-panel">
          <header className="wt-panel-head">
            <div className="mh-title">
              <span className="mh-title-icon">
                <TIcon name="gamepad" />
              </span>
              <h2>მატჩების ისტორია</h2>
              <p>მატჩები ნაჩვენებია უახლესიდან უძველესისკენ.</p>
            </div>
            <div className="wt-seg">
              {(
                [
                  ['all', 'grid', 'ყველა მატჩი'],
                  ['group', 'users', 'ჯგუფური ეტაპი'],
                  ['playoffs', 'trophy', 'პლეიოფი'],
                ] as const
              ).map(([key, icon, label]) => (
                <button key={key} type="button" className={filter === key ? 'active' : undefined} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                  <TIcon name={icon} />
                  {label}
                </button>
              ))}
            </div>
          </header>

          {error && (
            <p className="seller-status error" role="alert">
              {error}
            </p>
          )}
          {matches === null ? (
            <div className="marketplace-empty">იტვირთება…</div>
          ) : shown.length === 0 ? (
            <p className="rules-pending">მატჩები ჯერ არ არის — განრიგს ტურნირის ადმინისტრაცია გამოაქვეყნებს.</p>
          ) : (
            <div className="mh-list" aria-label="მატჩების ისტორია">
              {shown.map((m) => {
                const winner = matchWinner(m)
                const focusSide = focusId ? (m.teamA?.id === focusId ? 'a' : m.teamB?.id === focusId ? 'b' : null) : null
                const outcome = winner && focusSide ? (winner === focusSide ? 'win' : 'loss') : null
                // Round-7/39: a score typed on a match that hasn't started isn't a result — VS until live / completed.
                const played = m.scoreA !== null && m.scoreB !== null && m.status !== TournamentMatchStatus.Scheduled
                const stageText = m.stage === TournamentMatchStage.Group ? `${STAGE_LABEL[m.stage]}${m.groupName ? ` ${m.groupName}` : ''}` : STAGE_LABEL[m.stage]
                // Docs round-6/04: the winner's side glows green, the loser's red; the winner's score is
                // green when it's the viewed team (or nobody is viewed), red when the viewed team lost.
                const tone = (side: 'a' | 'b') => (winner ? (winner === side ? 'won' : 'lost') : '')
                const scoreTone = (side: 'a' | 'b') => (winner === side ? (outcome === 'loss' ? 'red' : 'green') : '')
                return (
                  <article key={m.id} className="mh-card">
                    <header>
                      <span className="mh-stage">
                        <TIcon name="trophy" />
                        {stageText}
                        {m.roundLabel && (
                          <>
                            <i aria-hidden="true">•</i>
                            <b>{m.roundLabel}</b>
                          </>
                        )}
                      </span>
                      <span className="mh-when">
                        <TIcon name="calendar" />
                        {formatDateTime(m.scheduledAt) || 'დრო დაზუსტდება'}
                      </span>
                    </header>
                    {br ? (
                      <div className="mh-br">
                        {m.results.length === 0 ? (
                          <p>
                            {m.groupName ? `Group ${m.groupName}` : STAGE_LABEL[m.stage]} — შედეგები მატჩის შემდეგ გამოჩნდება.
                          </p>
                        ) : (
                          m.results.slice(0, 3).map((r) => (
                            <span key={r.team.id} className={focusId === r.team.id ? 'mine' : undefined}>
                              <b>{r.placement ? `#${r.placement}` : '—'}</b>
                              <TeamMark team={r.team} />
                              <strong>{r.team.name}</strong>
                              <em>
                                {r.kills} kills · +{r.points} Pts
                              </em>
                            </span>
                          ))
                        )}
                      </div>
                    ) : (
                    <div className="mh-versus">
                      <span className={`mh-team a ${tone('a')}`}>
                        <TeamMark team={m.teamA} className="mh-logo" />
                        <strong>{m.teamA?.name ?? 'TBD'}</strong>
                      </span>
                      <span className="mh-mid">
                        <span className="mh-score">
                          {played ? (
                            <>
                              <b className={scoreTone('a')}>{m.scoreA}</b>
                              <i>-</i>
                              <b className={scoreTone('b')}>{m.scoreB}</b>
                            </>
                          ) : (
                            <b className="vs">VS</b>
                          )}
                        </span>
                        <span className={`mh-outcome ${outcome ?? (m.status === TournamentMatchStatus.Completed ? 'done' : 'pending')}`}>
                          {outcome === 'win' ? 'მოგება' : outcome === 'loss' ? 'წაგება' : MATCH_STATUS_LABEL[m.status]}
                        </span>
                      </span>
                      <span className={`mh-team b ${tone('b')}`}>
                        <TeamMark team={m.teamB} className="mh-logo" />
                        <strong>{m.teamB?.name ?? 'TBD'}</strong>
                      </span>
                    </div>
                    )}
                    <footer>
                      <span>
                        <TIcon name="map" />
                        <small>რუკა:</small>
                        <b>{m.map || '—'}</b>
                      </span>
                      <span>
                        <TIcon name="layers" />
                        <small>ფორმატი:</small>
                        <b>{br ? 'Battle Royale' : `Best of ${m.bestOf}`}</b>
                      </span>
                      <span>
                        <TIcon name="target" />
                        <small>{br ? 'სტატუსი:' : 'შედეგი:'}</small>
                        <b>{br ? MATCH_STATUS_LABEL[m.status] : played ? `${m.scoreA} - ${m.scoreB}` : '—'}</b>
                      </span>
                      <Link className="mh-btn" href={`/tournaments/${m.tournamentId}/matches/${m.id}`}>
                        დეტალები <TIcon name="arrow" />
                      </Link>
                    </footer>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <footer className="wt-history-foot">
          <b>W</b> დიდი ბრძოლები. დიდი გამარჯვებები. <span>|</span> <em>WaveHubX</em>
          <small>PLAY · COMPETE · BELONG</small>
        </footer>
      </section>
    </Layout>
  )
}
