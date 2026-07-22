import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicCoachSummary, PublicGame } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'

const PAGE_SIZE = 20

export default function CoachingDirectory() {
  const [games, setGames] = useState<PublicGame[]>([])
  const [gameId, setGameId] = useState('')
  const [items, setItems] = useState<PublicCoachSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.listGames().then(setGames).catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .browseCoaches({ gameId: gameId || undefined, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'მწვრთნელების ჩატვირთვა ვერ მოხერხდა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [gameId])

  return (
    <Layout>
      {/* .coaching-body scopes coaching.html's own --coach-* CSS variables (colors/lines) — that
          page uses a standalone shell outside .app-shell, but we keep the sidebar for nav
          consistency and just borrow its content classes, so the variables need this wrapper
          instead of living on <body>. */}
      <div className="coaching-body">
        <section className="coach-browse" aria-labelledby="coachBrowseTitle">
          <div className="coach-heading-row">
            <div>
              <h1 id="coachBrowseTitle">მწვრთნელების ძებნა</h1>
              <p>
                ვერიფიცირებული მწვრთნელები — <Link href="/coaching/apply">გახდი მწვრთნელი</Link>
              </p>
            </div>
          </div>

          <div className="coach-game-tabs" aria-label="თამაშის ფილტრი">
            <button type="button" className={gameId === '' ? 'active' : ''} onClick={() => setGameId('')}>
              ყველა თამაში
            </button>
            {games.map((g) => (
              <button key={g.id} type="button" className={gameId === g.id ? 'active' : ''} onClick={() => setGameId(g.id)}>
                {g.name}
              </button>
            ))}
          </div>

          <div className="coach-result-row">
            <span />
            <strong>{total} მწვრთნელი ნაპოვნია</strong>
          </div>

          {error && <div className="status-text status-error">{error}</div>}

          {loading ? (
            <div className="coach-empty">იტვირთება…</div>
          ) : items.length === 0 ? (
            <div className="coach-empty">მწვრთნელები ვერ მოიძებნა.</div>
          ) : (
            <div className="coach-grid">
              {items.map((coach) => (
                <article key={coach.id} className="coach-card">
                  <div className="coach-card-main">
                    <div className="coach-avatar-ring">
                      <span>{coach.firstName[0]}{coach.lastName[0]}</span>
                      <i />
                    </div>
                    <div className="coach-card-copy">
                      <h2>{coach.firstName} {coach.lastName}</h2>
                      <p className="coach-rating-line">
                        {coach.ratingAvg ? (
                          <>
                            <span aria-hidden="true">★</span> {coach.ratingAvg} ({coach.ratingCount})
                          </>
                        ) : (
                          'შეფასების გარეშე'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="coach-game-row">
                    <span className="coach-game-icon" aria-hidden="true">
                      {(coach.gameName ?? 'WH').slice(0, 2).toUpperCase()}
                    </span>
                    <strong>{coach.gameName ?? 'ზოგადი'}</strong>
                    <span className="coach-service-pill">{coach.specialty}</span>
                  </div>

                  <div className="coach-price-row">
                    <p>
                      <strong>{coach.hourlyRateWaveCoin} WC/სთ</strong>
                    </p>
                    <Link href={`/coaching/${coach.id}`} aria-label={`${coach.firstName} ${coach.lastName}-ის პროფილი`}>
                      პროფილი
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
