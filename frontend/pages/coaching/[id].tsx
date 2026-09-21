import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicCoachDetail } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const DURATION_OPTIONS = [30, 60, 90, 120]

export default function CoachProfile() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me, refresh } = useAuth()

  const [coach, setCoach] = useState<PublicCoachDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [buyerMessage, setBuyerMessage] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [booking, setBooking] = useState(false)

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
                {coach.profileBadge && <span className="badge-pill" style={{ marginLeft: 8 }}>★ {coach.profileBadge}</span>}
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

            <Link href={`/u/${coach.username}`} className="seller-card">
              <div className="seller-avatar">{coach.firstName[0]}</div>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {coach.firstName} {coach.lastName}
                </div>
                <div className="note" style={{ margin: 0 }}>
                  @{coach.username}
                </div>
              </div>
            </Link>

            {me ? (
              <form
                className="detail-section"
                style={{ marginTop: 0 }}
                onSubmit={async (event: FormEvent) => {
                  event.preventDefault()
                  setBookingError('')
                  if (!scheduledDate || !scheduledTime) {
                    setBookingError('აირჩიეთ თარიღი და დრო.')
                    return
                  }
                  const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)
                  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
                    setBookingError('თარიღი უნდა იყოს მომავალში.')
                    return
                  }
                  setBooking(true)
                  try {
                    const session = await api.requestCoachingSession(coach.id, {
                      scheduledAt: scheduledAt.toISOString(),
                      durationMinutes,
                      buyerMessage: buyerMessage.trim() || undefined,
                    })
                    // Booking debits the buyer's WaveCoin balance immediately — refresh the
                    // cached user (topbar balance display) before navigating away, same pattern
                    // as login.tsx/wallet.tsx, or the header would keep showing the pre-booking
                    // balance until a hard reload.
                    await refresh()
                    router.push(`/coaching-sessions/${session.id}`)
                  } catch (err) {
                    setBookingError(err instanceof ApiError ? err.message : 'სესიის დაჯავშნა ვერ მოხერხდა.')
                  } finally {
                    setBooking(false)
                  }
                }}
              >
                <div className="form-group">
                  <label htmlFor="scheduledDate">თარიღი</label>
                  <input
                    id="scheduledDate"
                    className="input"
                    type="date"
                    value={scheduledDate}
                    onChange={(event) => setScheduledDate(event.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="scheduledTime">დრო</label>
                  <input
                    id="scheduledTime"
                    className="input"
                    type="time"
                    value={scheduledTime}
                    onChange={(event) => setScheduledTime(event.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="durationMinutes">ხანგრძლივობა</label>
                  <select
                    id="durationMinutes"
                    className="input"
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(Number(event.target.value))}
                  >
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} წუთი — {Math.round((coach.hourlyRateWaveCoin * minutes) / 60)} WC
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="buyerMessage">შეტყობინება მწვრთნელს (არასავალდებულო)</label>
                  <textarea
                    id="buyerMessage"
                    className="input"
                    maxLength={1000}
                    value={buyerMessage}
                    onChange={(event) => setBuyerMessage(event.target.value)}
                  />
                </div>
                {bookingError && <div className="status-text status-error">{bookingError}</div>}
                <button className="detail-buy-button" type="submit" disabled={booking}>
                  {booking ? 'იჯავშნება…' : `სესიის დაჯავშნა — ${Math.round((coach.hourlyRateWaveCoin * durationMinutes) / 60)} WC`}
                </button>
              </form>
            ) : (
              <button
                className="detail-buy-button"
                type="button"
                onClick={() => router.push(`/login?next=/coaching/${coach.id}`)}
              >
                სესიის დასაჯავშნად გაიარეთ ავტორიზაცია
              </button>
            )}

            <div className="detail-protection">
              <strong>WaveHub Protection</strong>
              <span>სესიის თანხა ინახება escrow-ში მანამ, სანამ სესია არ დასრულდება — მწვრთნელი ვერიფიცირებულია WaveHub-ის მიერ.</span>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  )
}
