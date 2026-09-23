import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicTournamentSummary } from '@wavehub/shared-types'
import { TournamentStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { CalendarGlyph, PlayersGlyph } from '../../components/TournamentStatIcons'
import { api, errorMessage } from '../../lib/api'

const STATUS_LABELS: Record<TournamentStatus, string> = {
  [TournamentStatus.Open]: 'რეგისტრაცია ღიაა',
  [TournamentStatus.Upcoming]: 'მალე იწყება',
  [TournamentStatus.Completed]: 'დასრულებულია',
}

const FILTERS: { value: TournamentStatus | ''; label: string }[] = [
  { value: '', label: 'ყველა' },
  { value: TournamentStatus.Open, label: 'ღია' },
  { value: TournamentStatus.Upcoming, label: 'მოახლოებული' },
  { value: TournamentStatus.Completed, label: 'დასრულებული' },
]

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
        setItems([])
        setTotal(0)
        setError(errorMessage(err, 'ტურნირების ჩატვირთვა ვერ მოხერხდა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [statusFilter])

  return (
    <Layout
      title="ტურნირები"
      description="WaveHub-ის ყველა აქტიური, მოახლოებული და დასრულებული ტურნირი — დარეგისტრირდით და ითამაშეთ პრიზებისთვის."
    >
      <section className="tournaments-page">
        <header className="tournaments-hero">
          <span className="tournaments-hero-icon" aria-hidden="true">
            <Image src="/assets/tournaments-icon.svg" alt="" width={43} height={43} unoptimized />
          </span>
          <div>
            <h1>ყველა ტურნირი</h1>
            <p>აღმოაჩინეთ WaveHub-ის ყველა აქტიური, მოახლოებული და დასრულებული ტურნირი.</p>
          </div>
        </header>

        <section className="tournament-toolbar" aria-label="ტურნირების ფილტრი">
          <div className="tournament-status-tabs" role="group" aria-label="სტატუსის ფილტრი">
            {FILTERS.map((filter) => (
              <button
                key={filter.value || 'all'}
                type="button"
                className={statusFilter === filter.value ? 'active' : ''}
                aria-pressed={statusFilter === filter.value}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.value !== '' && <i aria-hidden="true" />} {filter.label}
              </button>
            ))}
          </div>
        </section>

        <section className="tournaments-list-section" aria-labelledby="tournamentsListTitle">
          <div className="tournaments-list-heading">
            <h2 id="tournamentsListTitle">ხელმისაწვდომი ტურნირები</h2>
            <strong className="tournament-count" aria-live="polite">
              {total} ტურნირი
            </strong>
          </div>

          {error && (
            <div className="status-text status-error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="marketplace-empty">იტვირთება…</div>
          ) : items.length === 0 ? (
            <div className="marketplace-empty tournaments-empty">
              <strong>ტურნირები ჯერ არ არის</strong>
              <p>ადმინისტრაციის მიერ დამატებული ახალი ტურნირები აქ გამოჩნდება.</p>
            </div>
          ) : (
            <div className="tournaments-grid">
              {items.map((tournament) => {
                const progress = Math.min(100, Math.round((tournament.registeredCount / tournament.maxPlayers) * 100))
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
                          <i aria-hidden="true" />
                          {STATUS_LABELS[tournament.status]}
                        </span>
                      </div>
                    </div>
                    <div className="tournament-card-copy">
                      <p className="tournament-card-description">{tournament.description}</p>
                      <div className="tournament-card-facts">
                        <span>
                          <b aria-hidden="true">
                            <CalendarGlyph />
                          </b>
                          <strong>{new Date(tournament.startDate).toLocaleDateString('ka-GE', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                          <small>დაწყება</small>
                        </span>
                        <span>
                          <b aria-hidden="true">★</b>
                          <strong>{tournament.prize}</strong>
                          <small>პრიზი</small>
                        </span>
                        <span>
                          <b aria-hidden="true">
                            <PlayersGlyph />
                          </b>
                          <strong>
                            {tournament.registeredCount} / {tournament.maxPlayers}
                          </strong>
                          <small>მოთამაშე</small>
                        </span>
                      </div>
                      <div className="tournament-progress">
                        <span>
                          <small>რეგისტრაციის სისავსე</small>
                          <strong>{progress}%</strong>
                        </span>
                        <i role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="რეგისტრაციის სისავსე">
                          <b style={{ width: `${progress}%` }} />
                        </i>
                      </div>
                      <Link className="tournament-view-button" href={`/tournaments/${tournament.id}`}>
                        ტურნირის ნახვა <span aria-hidden="true">→</span>
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
