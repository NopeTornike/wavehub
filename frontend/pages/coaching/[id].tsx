import Link from 'next/link'
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

  if (loading) {
    return (
      <Layout>
        <div className="detail-page">
          <div className="marketplace-empty">იტვირთება…</div>
        </div>
      </Layout>
    )
  }

  if (error || !coach) {
    return (
      <Layout>
        <div className="detail-page">
          <div className="marketplace-empty">{error || 'მწვრთნელი ვერ მოიძებნა.'}</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* No coach-profile page exists in the static prototype (coach-book-session.html is a
          large booking-flow mock for a feature this app doesn't have yet — see
          backend/src/coaching/CLAUDE.md's "no session booking" gap) — reuses listing detail's
          real .detail-* design language instead of inventing new classes. */}
      <div className="detail-page">
        <Link className="detail-back-link" href="/coaching">
          ← მწვრთნელების სიაში დაბრუნება
        </Link>

        <div className="detail-layout">
          <div className="detail-main">
            <nav className="detail-breadcrumb">
              კოუჩინგი{coach.gameName ? ` / ${coach.gameName}` : ''} / {coach.specialty}
            </nav>

            <div className="detail-title-block">
              <p className="section-kicker">მწვრთნელის პროფილი</p>
              <h1>
                {coach.firstName} {coach.lastName}
              </h1>
              {coach.ratingAvg && (
                <span className="rating-pill">
                  ★ {coach.ratingAvg} ({coach.ratingCount})
                </span>
              )}
            </div>

            <section className="detail-section detail-summary-card">
              <h2>ბიოგრაფია</h2>
              <p>{coach.bio}</p>
            </section>

            {coach.languages.length > 0 && (
              <section className="detail-section detail-included-card">
                <h2>ენები</h2>
                <ul>
                  {coach.languages.map((language) => (
                    <li key={language}>{language}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="detail-buy-panel">
            <div className="detail-buy-head">
              <strong>{coach.hourlyRateWaveCoin} WC/სთ</strong>
            </div>

            <div className="detail-buy-tags">
              <span className="service-tag">{coach.specialty}</span>
              {coach.gameName && <span className="detail-delivery-chip">{coach.gameName}</span>}
            </div>

            <div className="seller-card">
              <div className="seller-avatar">{coach.firstName[0]}</div>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {coach.firstName} {coach.lastName}
                </div>
                <div className="note" style={{ margin: 0 }}>
                  @{coach.username}
                </div>
              </div>
            </div>

            <button className="detail-buy-button" type="button" disabled title="სესიის დაჯავშნა მალე დაემატება">
              სესიის დაჯავშნა (მალე)
            </button>

            <div className="detail-protection">
              <strong>WaveHub Protection</strong>
              <span>სესიის დაჯავშნა და გადახდა მალე დაემატება — მწვრთნელი ვერიფიცირებულია WaveHub-ის მიერ.</span>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  )
}
