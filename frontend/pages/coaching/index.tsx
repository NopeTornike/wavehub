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
      <div className="page">
        <div className="page-inner">
          <h1 className="page-title">კოუჩინგი</h1>
          <p className="page-subtitle">
            ვერიფიცირებული მწვრთნელები — {total} ნაპოვნი ·{' '}
            <Link href="/coaching/apply">გახდი მწვრთნელი</Link>
          </p>

          <div className="filter-bar">
            <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
              <option value="">ყველა თამაში</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="status-text status-error">{error}</div>}

          {loading ? (
            <div className="empty-state">იტვირთება…</div>
          ) : items.length === 0 ? (
            <div className="empty-state">მწვრთნელები ვერ მოიძებნა.</div>
          ) : (
            <div className="listing-grid">
              {items.map((coach) => (
                <Link key={coach.id} href={`/coaching/${coach.id}`} className="listing-card">
                  <div className="listing-card-body">
                    <div className="listing-card-meta">
                      {coach.gameName ?? 'ზოგადი'} · @{coach.username}
                    </div>
                    <div className="listing-card-title">{coach.specialty}</div>
                    <div className="listing-card-seller">
                      {coach.firstName} {coach.lastName}
                    </div>
                    <div className="listing-card-footer">
                      {coach.ratingAvg && (
                        <span className="rating-pill">
                          ★ {coach.ratingAvg} ({coach.ratingCount})
                        </span>
                      )}
                      <span className="price-tag">
                        {coach.hourlyRateWaveCoin} WC<small>/სთ</small>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
