import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicTournamentSummary } from '@wavehub/shared-types'
import { TournamentStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'

const STATUS_LABELS: Record<TournamentStatus, string> = {
  [TournamentStatus.Open]: 'Registration Open',
  [TournamentStatus.Upcoming]: 'Upcoming',
  [TournamentStatus.Completed]: 'Completed',
}

// Real markup pulled from tournaments.html/tournaments.js (see LAUNCH_PLAN.md §2b) — the CSS for
// .tournaments-*/.tournament-card* was appended to global.css alongside this page since it didn't
// exist when global.css was first copied (Tornike added Tournaments to the prototype afterward).
// Deliberately does NOT include the static page's inline "Create Tournament" admin panel — every
// other admin feature in this app gets its own /admin/* page instead (see admin/tournaments.tsx).
export default function Tournaments() {
  const [items, setItems] = useState<PublicTournamentSummary[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .browseTournaments({ status: statusFilter || undefined, limit: 50 })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'ტურნირების ჩატვირთვა ვერ მოხერხდა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [statusFilter])

  return (
    <Layout>
      <section className="tournaments-page">
        <header className="tournaments-hero">
          <span className="tournaments-hero-icon" aria-hidden="true">
            <img src="/assets/tournaments-icon.svg" alt="" />
          </span>
          <div>
            <h1>All Tournaments</h1>
            <p>Discover every active, upcoming, and completed tournament on WaveHub.</p>
          </div>
        </header>

        <section className="tournament-toolbar" aria-label="Tournament filters">
          <div className="tournament-status-tabs" aria-label="Quick status filter">
            <button type="button" className={statusFilter === '' ? 'active' : ''} onClick={() => setStatusFilter('')}>
              All
            </button>
            <button type="button" className={statusFilter === TournamentStatus.Open ? 'active' : ''} onClick={() => setStatusFilter(TournamentStatus.Open)}>
              <i /> Open
            </button>
            <button type="button" className={statusFilter === TournamentStatus.Upcoming ? 'active' : ''} onClick={() => setStatusFilter(TournamentStatus.Upcoming)}>
              <i /> Upcoming
            </button>
            <button type="button" className={statusFilter === TournamentStatus.Completed ? 'active' : ''} onClick={() => setStatusFilter(TournamentStatus.Completed)}>
              <i /> Completed
            </button>
          </div>
        </section>

        <section className="tournaments-list-section" aria-labelledby="tournamentsListTitle">
          <div className="tournaments-list-heading">
            <h2 id="tournamentsListTitle">Available Tournaments</h2>
            <strong className="tournament-count">{total} tournament{total === 1 ? '' : 's'}</strong>
          </div>

          {error && <div className="status-text status-error">{error}</div>}

          {loading ? (
            <div className="marketplace-empty">იტვირთება…</div>
          ) : items.length === 0 ? (
            <div className="marketplace-empty tournaments-empty">
              <strong>No tournaments yet</strong>
              <p>New championships added by the WaveHub admin will appear here.</p>
            </div>
          ) : (
            <div className="tournaments-grid">
              {items.map((tournament) => {
                const progress = Math.round((tournament.registeredCount / tournament.maxPlayers) * 100)
                return (
                  <article key={tournament.id} className="tournament-card">
                    <div
                      className="tournament-card-cover"
                      style={tournament.coverImageUrl ? { backgroundImage: `url(${tournament.coverImageUrl})` } : undefined}
                    >
                      <span className="tournament-game">{tournament.gameName}</span>
                      <div className="tournament-card-title">
                        <h3>{tournament.name}</h3>
                        <span className={`tournament-card-status ${tournament.status}`}>
                          <i />
                          {STATUS_LABELS[tournament.status]}
                        </span>
                      </div>
                    </div>
                    <div className="tournament-card-copy">
                      <p className="tournament-card-description">{tournament.description}</p>
                      <div className="tournament-card-facts">
                        <span>
                          <b aria-hidden="true">▣</b>
                          <strong>{new Date(tournament.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                          <small>Start Date</small>
                        </span>
                        <span>
                          <b aria-hidden="true">♛</b>
                          <strong>{tournament.prize}</strong>
                          <small>Prize Pool</small>
                        </span>
                        <span>
                          <b aria-hidden="true">♙</b>
                          <strong>
                            {tournament.registeredCount} / {tournament.maxPlayers}
                          </strong>
                          <small>Players</small>
                        </span>
                      </div>
                      <div className="tournament-progress">
                        <span>
                          <small>Registration Progress</small>
                          <strong>{progress}% Filled</strong>
                        </span>
                        <i>
                          <b style={{ width: `${progress}%` }} />
                        </i>
                      </div>
                      <Link className="tournament-view-button" href={`/tournaments/${tournament.id}`}>
                        View Tournament <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </section>
    </Layout>
  )
}
