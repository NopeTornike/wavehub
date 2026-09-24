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
// server, format, "Your Team"), then Match History — stage pill, the two teams, map / best-of /
// time, the result (WIN / LOSS from the viewed team's side) and View Details. Matches are what
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

  const shown = (matches ?? [])
    .filter((m) => !teamParam || m.teamA?.id === teamParam || m.teamB?.id === teamParam)
    .filter((m) => filter === 'all' || (filter === 'group' ? m.stage === TournamentMatchStage.Group : m.stage !== TournamentMatchStage.Group))

  const cover = tournament ? tournamentCover(tournament, slugById) : null

  return (
    <Layout title={tournament ? `${tournament.name} — მატჩები` : 'მატჩები'}>
      <section className="wt-page wt-history">
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
            <div>
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
            <div className="wt-table" role="table" aria-label="მატჩების ისტორია">
              <div className="wt-table-head wt-history-row" role="row">
                <span>ეტაპი</span>
                <span>გუნდები</span>
                <span>მატჩის ინფო</span>
                <span>შედეგი</span>
                <span>მოქმედება</span>
              </div>
              {shown.map((m) => {
                const winner = matchWinner(m)
                const focusSide = focusId ? (m.teamA?.id === focusId ? 'a' : m.teamB?.id === focusId ? 'b' : null) : null
                const outcome = winner && focusSide ? (winner === focusSide ? 'win' : 'loss') : null
                const score = m.scoreA !== null && m.scoreB !== null ? (focusSide === 'b' ? `${m.scoreB} - ${m.scoreA}` : `${m.scoreA} - ${m.scoreB}`) : null
                return (
                  <article key={m.id} className="wt-history-row" role="row">
                    <span className={`wt-stage ${m.stage}`}>
                      <TIcon name={m.stage === TournamentMatchStage.Group ? 'users' : 'trophy'} />
                      {m.stage === TournamentMatchStage.Group ? `${STAGE_LABEL[m.stage]}${m.groupName ? ` ${m.groupName}` : ''}` : m.roundLabel || STAGE_LABEL[m.stage]}
                    </span>
                    <span className="wt-vs">
                      <span className="wt-vs-team">
                        <TeamMark team={m.teamA} />
                        <strong>{m.teamA?.name ?? 'TBD'}</strong>
                      </span>
                      <em>vs</em>
                      <span className="wt-vs-team">
                        <TeamMark team={m.teamB} />
                        <strong>{m.teamB?.name ?? 'TBD'}</strong>
                      </span>
                    </span>
                    <span className="wt-match-info">
                      <span>
                        <TIcon name="pin" />
                        {m.map || '—'}
                      </span>
                      <span>
                        <TIcon name="layers" />
                        Best of {m.bestOf}
                      </span>
                      <span>
                        <TIcon name="calendar" />
                        {formatDateTime(m.scheduledAt) || 'დრო დაზუსტდება'}
                      </span>
                    </span>
                    <span className={`wt-result ${outcome ?? (m.status === TournamentMatchStatus.Completed ? 'done' : 'pending')}`}>
                      {outcome ? <b>{outcome === 'win' ? 'WIN' : 'LOSS'}</b> : m.status !== TournamentMatchStatus.Completed && <b>{MATCH_STATUS_LABEL[m.status]}</b>}
                      {score && <span>{score}</span>}
                    </span>
                    <Link className="wt-outline-btn" href={`/tournaments/${m.tournamentId}/matches/${m.id}`}>
                      დეტალები <TIcon name="arrow" />
                    </Link>
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
