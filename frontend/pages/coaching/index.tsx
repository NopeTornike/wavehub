import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicCoachSummary, PublicGame } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'

const PAGE_SIZE = 20

export default function CoachingDirectory() {
  const [games, setGames] = useState<PublicGame[]>([])
  const [gameId, setGameId] = useState('')
  const [items, setItems] = useState<PublicCoachSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)

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
        setError(errorMessage(err, 'მწვრთნელების ჩატვირთვა ვერ მოხერხდა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [gameId])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const res = await api.browseCoaches({ gameId: gameId || undefined, limit: PAGE_SIZE, offset: items.length })
      setItems((prev) => [...prev, ...res.items])
      setTotal(res.total)
    } catch (err) {
      setError(errorMessage(err, 'მწვრთნელების ჩატვირთვა ვერ მოხერხდა.'))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <Layout
      title="მწვრთნელების ძებნა"
      description="ვერიფიცირებული გეიმინგ მწვრთნელები WaveHub-ზე — დაჯავშნეთ სესია PUBG Mobile, COD Mobile, Free Fire და სხვა თამაშებისთვის."
    >
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
                ვერიფიცირებული მწვრთნელები — <Link href="/coaching/apply">გახდი მწვრთნელი</Link> ·{' '}
                <Link href="/coaching-sessions">ჩემი სესიები</Link>
              </p>
            </div>
          </div>

          <div className="coach-game-tabs" role="group" aria-label="თამაშის ფილტრი">
            <button type="button" className={gameId === '' ? 'active' : ''} aria-pressed={gameId === ''} onClick={() => setGameId('')}>
              ყველა თამაში
            </button>
            {games.map((g) => (
              <button key={g.id} type="button" className={gameId === g.id ? 'active' : ''} aria-pressed={gameId === g.id} onClick={() => setGameId(g.id)}>
                {g.name}
              </button>
            ))}
          </div>

          <div className="coach-result-row">
            <span />
            <strong>{total} მწვრთნელი ნაპოვნია</strong>
          </div>

          {error && (
            <div className="status-text status-error" role="alert">
              {error}
            </div>
          )}

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
                      <span aria-hidden="true">{coach.firstName[0]}{coach.lastName[0]}</span>
                      <i />
                    </div>
                    <div className="coach-card-copy">
                      <h2>{coach.firstName} {coach.lastName}{coach.profileBadge && <span className="badge-pill" style={{ marginLeft: 8 }}>★ {coach.profileBadge}</span>}</h2>
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

          {!loading && items.length < total && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <button type="button" className="button" style={{ width: 'auto' }} disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? 'იტვირთება…' : 'მეტის ჩვენება'}
              </button>
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
