import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicCoachDetail } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'

export default function CoachProfile() {
  const router = useRouter()
  const { id } = router.query as { id?: string }

  const [coach, setCoach] = useState<PublicCoachDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api
      .getCoach(id)
      .then((data) => {
        if (!cancelled) setCoach(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'მწვრთნელი ვერ მოიძებნა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <Layout>
      <div className="page">
        <div className="page-inner">
          {loading ? (
            <div className="empty-state">იტვირთება…</div>
          ) : error || !coach ? (
            <div className="status-text status-error">{error || 'მწვრთნელი ვერ მოიძებნა.'}</div>
          ) : (
            <div className="detail-layout">
              <div>
                <h1 className="page-title">{coach.specialty}</h1>
                <p className="page-subtitle">
                  {coach.firstName} {coach.lastName} · @{coach.username}
                  {coach.gameName ? ` · ${coach.gameName}` : ''}
                </p>

                <div className="detail-section">
                  <h2>ბიოგრაფია</h2>
                  <p>{coach.bio}</p>
                </div>

                {coach.languages.length > 0 && (
                  <div className="detail-section">
                    <h2>ენები</h2>
                    <p>{coach.languages.join(', ')}</p>
                  </div>
                )}
              </div>

              <div className="seller-card">
                <div className="price-tag">
                  {coach.hourlyRateWaveCoin} WC<small>/სთ</small>
                </div>
                {coach.ratingAvg && (
                  <span className="rating-pill">
                    ★ {coach.ratingAvg} ({coach.ratingCount})
                  </span>
                )}
                <button className="button" type="button" disabled title="სესიის დაჯავშნა მალე დაემატება">
                  სესიის დაჯავშნა (მალე)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
