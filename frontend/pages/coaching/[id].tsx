/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicCoachDetail, PublicCoachReview } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { gameIcon } from '../../lib/games'

// docs/design-mockups/14-coach-profile.jpg on the prototype's coach-profile classes: portrait with
// the real online pill, verified mark, badges (rank, plan badge, Fast Responder / Top Rated when
// earned, Verified Coach, languages), specialty and bio, Wave Score + Rating cards, the four
// metrics, Overview / Student Review tabs, intro video + quote, coaching style, games, languages,
// and the Book / Message / Wishlist bar with the real booking form. Every value is real: the coach
// wrote the profile content; students / sessions / success rate come from sessions, response time
// from their chats (median, shown after 3 answered messages), Wave Score from their Wave rank,
// ratings from buyers' session reviews. Anything the coach hasn't filled in is left out.

const DURATION_OPTIONS = [30, 60, 90, 120]
const LANGUAGES: Record<string, [label: string, flag?: string]> = {
  en: ['English', '/assets/united-kingdom-flag.png'],
  ka: ['ქართული', '/assets/georgian-flag-icon.png'],
  ru: ['Русский'],
  tr: ['Türkçe'],
  de: ['Deutsch'],
  uk: ['Українська'],
}
const VIDEO_URL = /^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\/\S+$/

// The video's own YouTube thumbnail (for the preview card), when it's a YouTube link.
function youtubeThumb(url: string): string | null {
  const m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(url)
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value)
  return (
    <div className="coach-stars" aria-label={`${value.toFixed(1)} / 5`}>
      {'★'.repeat(full)}
      <span style={{ opacity: 0.3 }}>{'★'.repeat(5 - full)}</span>
    </div>
  )
}

export default function CoachProfile() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me, refresh } = useAuth()
  const meId = me?.id

  const [coach, setCoach] = useState<PublicCoachDetail | null>(null)
  const [reviews, setReviews] = useState<PublicCoachReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'reviews'>('overview')
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState('')
  const [showBooking, setShowBooking] = useState(false)

  const [todayIso] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10))
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [buyerMessage, setBuyerMessage] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [booking, setBooking] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([api.getCoach(id), api.listCoachReviews(id).catch(() => [])])
      .then(([data, rows]) => {
        if (cancelled) return
        setCoach(data)
        setReviews(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'ქოუჩი ვერ მოიძებნა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!meId || !id) return
    api
      .listFavoriteCoachIds()
      .then((ids) => setSaved(ids.includes(id)))
      .catch(() => undefined)
  }, [meId, id])

  if (loading || error || !coach) {
    return (
      <Layout title="ქოუჩი" noIndex={!loading}>
        <div className="coaching-body">
          <div className="coach-profile-shell">
            <p className="coach-profile-empty">{loading ? 'იტვირთება…' : error || 'ქოუჩი ვერ მოიძებნა.'}</p>
          </div>
        </div>
      </Layout>
    )
  }

  const name = `${coach.firstName} ${coach.lastName}`.trim()
  const isOwnProfile = me?.username === coach.username
  const sessionPrice = Math.round((coach.hourlyRateWaveCoin * durationMinutes) / 60)
  const notEnoughBalance = !!me && me.wavecoinBalance < sessionPrice
  const initials = `${coach.firstName[0] ?? ''}${coach.lastName[0] ?? ''}`.toUpperCase()
  const rating = coach.ratingAvg ? Number(coach.ratingAvg) : null
  const fastResponder = coach.responseMinutes !== null && coach.responseMinutes <= 10
  const topRated = rating !== null && rating >= 4.8 && coach.ratingCount >= 5
  const video = coach.videoUrl && VIDEO_URL.test(coach.videoUrl) ? coach.videoUrl : null
  const responseText = coach.responseMinutes === null ? null : coach.responseMinutes < 60 ? `~${coach.responseMinutes} წთ` : `~${Math.round(coach.responseMinutes / 60)} სთ`
  const metrics: Array<[string, string | null, string]> = [
    ['ST', String(coach.stats.students), 'სტუდენტი'],
    ['SE', String(coach.stats.sessions), 'დასრულებული სესია'],
    ['SR', coach.stats.successRate === null ? null : `${coach.stats.successRate}%`, 'წარმატების მაჩვენებელი'],
    ['RT', responseText, 'საშ. პასუხის დრო'],
  ]

  const toggleSaved = async () => {
    if (!me) {
      router.push(`/login?next=/coaching/${coach.id}`)
      return
    }
    try {
      if (saved) await api.unfavoriteCoach(coach.id)
      else await api.favoriteCoach(coach.id)
      setSaved(!saved)
    } catch (err) {
      setStatus(errorMessage(err, 'შენახვა ვერ მოხერხდა.'))
    }
  }

  const messageCoach = async () => {
    if (!me) {
      router.push(`/login?next=/coaching/${coach.id}`)
      return
    }
    setStatus('')
    try {
      const conversation = await api.startDirectConversation(coach.userId)
      router.push(`/messages?conversation=${conversation.id}`)
    } catch (err) {
      setStatus(errorMessage(err, 'მიწერა შესაძლებელია პირველი სესიის დაჯავშნის შემდეგ.'))
    }
  }

  const book = async (event: FormEvent) => {
    event.preventDefault()
    setBookingError('')
    if (!scheduledDate || !scheduledTime) return setBookingError('აირჩიეთ თარიღი და დრო.')
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) return setBookingError('თარიღი უნდა იყოს მომავალში.')
    setBooking(true)
    try {
      const session = await api.requestCoachingSession(coach.id, { scheduledAt: scheduledAt.toISOString(), durationMinutes, buyerMessage: buyerMessage.trim() || undefined })
      // Booking debits the balance — refresh the topbar before leaving.
      await refresh()
      router.push(`/coaching-sessions/${session.id}`)
    } catch (err) {
      setBookingError(errorMessage(err, 'სესიის დაჯავშნა ვერ მოხერხდა.'))
      setBooking(false)
    }
  }

  return (
    <Layout title={`${name} — ქოუჩი`} description={`${coach.specialty}${coach.gameName ? ` (${coach.gameName})` : ''}. ${coach.bio}`.slice(0, 160)}>
      <div className="coaching-body">
        <div className="coach-profile-shell wc-profile">
          <Link className="coach-profile-back" href="/coaching">
            <span aria-hidden="true">&lt;</span> ქოუჩებზე დაბრუნება
          </Link>

          <section className="coach-profile-hero" aria-labelledby="coachProfileTitle">
            <div className="coach-profile-portrait-wrap">
              <div
                className={`coach-profile-portrait${coach.avatarUrl ? ' has-image' : ''}`}
                style={coach.avatarUrl ? { ['--coach-image' as string]: `url("${coach.avatarUrl}")` } : undefined}
              >
                {coach.avatarUrl ? null : <span>{initials}</span>}
              </div>
              {coach.online && (
                <span className="coach-online-pill">
                  <i aria-hidden="true"></i>ონლაინ
                </span>
              )}
            </div>

            <div className="coach-profile-intro">
              <div className="coach-profile-title-row">
                <h1 id="coachProfileTitle">{name}</h1>
                <span className="coach-verified-mark" aria-label="ვერიფიცირებული ქოუჩი" role="img" />
              </div>
              <div className="coach-profile-badges">
                {coach.rank && <span className="coach-profile-badge gold">{coach.rank}</span>}
                {coach.profileBadge && <span className="coach-profile-badge violet">{coach.profileBadge}</span>}
                {topRated && <span className="coach-profile-badge">Top Rated</span>}
                {fastResponder && <span className="coach-profile-badge green">Fast Responder</span>}
                <span className="coach-profile-badge violet">Verified Coach</span>
                {coach.languages.map((code) => (
                  <span key={code} className="coach-profile-badge">
                    {LANGUAGES[code]?.[1] && <img src={LANGUAGES[code][1]} alt="" width={16} height={16} />}
                    {LANGUAGES[code]?.[0] ?? code.toUpperCase()}
                  </span>
                ))}
              </div>
              <h2>{coach.specialty}</h2>
              <p>{coach.bio}</p>
            </div>

            <div className="coach-score-panels">
              <article className="coach-score-card">
                <span>Wave Score</span>
                <strong>
                  {coach.waveScore.score}
                  <small>/100</small>
                </strong>
                <em>{coach.waveScore.tier}</em>
                <i>
                  <b style={{ width: `${Math.min(100, coach.waveScore.score)}%` }}></b>
                </i>
              </article>
              {rating !== null ? (
                <article className="coach-score-card">
                  <span>რეიტინგი</span>
                  <strong>{rating.toFixed(1)}</strong>
                  <Stars value={rating} />
                  <small>({coach.ratingCount} შეფასება)</small>
                </article>
              ) : (
                <article className="coach-score-card coach-score-card-empty">
                  <span>რეიტინგი</span>
                  <strong>—</strong>
                  <small>შეფასებები ჯერ არ არის</small>
                </article>
              )}
            </div>
          </section>

          <section className="coach-profile-metrics" aria-label="ქოუჩის სტატისტიკა">
            {metrics.map(([icon, value, label]) => (
              <div key={label} className="coach-profile-metric">
                <span className={icon === 'SE' ? 'coach-profile-metric-icon-plain coach-profile-metric-icon-sessions' : 'coach-profile-metric-icon-plain'} aria-hidden="true">
                  {icon === 'SE' ? (
                    <img className="coach-highest-rank-icon" src="/assets/sessions-icon.png" alt="" />
                  ) : icon === 'ST' ? (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ff5bb3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  ) : icon === 'SR' ? (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#bd5cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12h4l2-7 4 14 2-7h2" />
                      <path d="M14 12c1.4-3.7 4.1-5.8 8-6-.1 4.9-2.1 8-6 9.2" />
                    </svg>
                  ) : (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ff5bb3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="13" r="8" />
                      <path d="M9 2h6M12 5V2m6 5 1.5-1.5M12 9v4l3-2" />
                    </svg>
                  )}
                </span>
                <strong>{value ?? '—'}</strong>
                <small>{label}</small>
              </div>
            ))}
          </section>

          <div className="coach-profile-tabs" role="tablist" aria-label="ქოუჩის განყოფილებები">
            <button className={tab === 'overview' ? 'active' : undefined} type="button" role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>
              მიმოხილვა
            </button>
            <button className={tab === 'reviews' ? 'active' : undefined} type="button" role="tab" aria-selected={tab === 'reviews'} onClick={() => setTab('reviews')}>
              სტუდენტების შეფასებები ({reviews.length})
            </button>
          </div>

          {tab === 'overview' ? (
            <section className="coach-profile-panel">
              {(video || coach.quote) && (
                <div className="coach-overview-top">
                  {video && (
                    <article className="coach-video-card">
                      <a
                        className="coach-video-preview"
                        href={video}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        style={(() => {
                          const thumb = youtubeThumb(video) ?? coach.avatarUrl
                          return thumb ? { ['--coach-image' as string]: `url("${thumb}")` } : undefined
                        })()}
                        aria-label="გაცნობითი ვიდეოს ნახვა"
                      >
                        <button type="button" tabIndex={-1} aria-hidden="true"></button>
                      </a>
                    </article>
                  )}
                  {coach.quote && (
                    <article className="coach-quote-card">
                      <h2>გაიცანი შენი ქოუჩი</h2>
                      <blockquote>“{coach.quote}”</blockquote>
                      <strong>— {coach.firstName}</strong>
                    </article>
                  )}
                </div>
              )}
              <div className="coach-info-grid coach-info-grid-auto">
                {coach.coachingStyle.length > 0 && (
                  <article className="coach-info-card coach-style-card">
                    <h2>ქოუჩინგის სტილი</h2>
                    <ul className="coach-check-list">
                      {coach.coachingStyle.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                )}
                {coach.games.length > 0 && (
                  <article className="coach-info-card coach-games-card">
                    <h2>თამაშები</h2>
                    <div>
                      {coach.games.map((game) => {
                        const icon = gameIcon(game.slug)
                        return (
                          <span key={game.id} className={icon ? 'coach-game-item-with-image' : undefined}>
                            <b className={icon ? 'coach-game-image-shell' : undefined}>{icon ? <img src={icon} alt="" width={44} height={44} /> : game.name.slice(0, 3)}</b>
                            {game.name}
                            {game.main && <small>ძირითადი თამაში</small>}
                          </span>
                        )
                      })}
                    </div>
                  </article>
                )}
                {coach.languages.length > 0 && (
                  <article className="coach-info-card coach-languages-card">
                    <h2>ენები</h2>
                    <div>
                      {coach.languages.map((code) => {
                        const [label, flag] = LANGUAGES[code] ?? [code.toUpperCase()]
                        return (
                          <span key={code} className={flag ? 'coach-language-with-icon' : undefined}>
                            {flag && <img className="coach-language-icon" src={flag} alt="" width={22} height={22} />}
                            {label}
                          </span>
                        )
                      })}
                    </div>
                  </article>
                )}
              </div>
            </section>
          ) : (
            <section className={`coach-profile-panel coach-reviews-panel${reviews.length ? '' : ' is-empty'}`}>
              {reviews.length === 0 ? (
                <p className="coach-profile-empty">შეფასებები ჯერ არ არის — შეფასებას ტოვებენ სტუდენტები დასრულებული სესიის შემდეგ.</p>
              ) : (
                reviews.map((review) => (
                  <article key={review.id}>
                    <strong>★ {review.rating.toFixed(1)}</strong>
                    {review.body && <p>{review.body}</p>}
                    <span>
                      @{review.buyerUsername} · {new Date(review.createdAt).toLocaleDateString('ka-GE')}
                    </span>
                  </article>
                ))
              )}
            </section>
          )}

          <section className="coach-booking-panel" aria-label="სესიის დაჯავშნა">
            <div className="coach-booking-main">
              <div className="coach-starting-price">
                <span>საათობრივი ფასი</span>
                <strong>
                  {coach.hourlyRateWaveCoin} <small>WC/სთ</small>
                </strong>
              </div>
              {isOwnProfile ? (
                <Link className="coach-book-primary" href="/coaching/profile">
                  პროფილის რედაქტირება
                </Link>
              ) : (
                <button
                  className="coach-book-primary"
                  type="button"
                  onClick={() => (me ? setShowBooking((v) => !v) : router.push(`/login?next=/coaching/${coach.id}`))}
                  aria-expanded={showBooking}
                >
                  სესიის დაჯავშნა
                </button>
              )}
              {!isOwnProfile && (
                <button className="coach-book-secondary coach-message-secondary" type="button" onClick={() => void messageCoach()}>
                  მიწერა ქოუჩს
                </button>
              )}
              <button className={`coach-book-secondary${saved ? ' is-saved' : ''}`} type="button" aria-pressed={saved} onClick={() => void toggleSaved()}>
                {saved ? 'სურვილებშია' : 'სურვილებში დამატება'}
              </button>
            </div>

            {showBooking && me && !isOwnProfile && (
              <form className="stack-form" onSubmit={book}>
                <label className="field">
                  თარიღი
                  <input type="date" min={todayIso} value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required />
                </label>
                <label className="field">
                  დრო
                  <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} required />
                </label>
                <label className="field">
                  ხანგრძლივობა
                  <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} წუთი — {Math.round((coach.hourlyRateWaveCoin * minutes) / 60)} WC
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field field-wide">
                  შეტყობინება ქოუჩს (არასავალდებულო)
                  <textarea rows={3} maxLength={1000} value={buyerMessage} onChange={(e) => setBuyerMessage(e.target.value)} />
                </label>
                {bookingError && (
                  <p className="coach-booking-status" role="alert">
                    {bookingError}
                  </p>
                )}
                {notEnoughBalance && (
                  <p className="coach-booking-status">
                    თქვენი ბალანსია {me.wavecoinBalance} WC — ამ სესიისთვის არ გყოფნით. <Link href="/wallet">შეავსეთ საფულე</Link>
                  </p>
                )}
                <button className="coach-book-primary" type="submit" disabled={booking}>
                  {booking ? 'იჯავშნება…' : `დადასტურება — ${sessionPrice} WC`}
                </button>
              </form>
            )}

            <p className="coach-booking-status" aria-live="polite">
              {status || 'სესიის თანხა ინახება escrow-ში მანამ, სანამ სესია არ დასრულდება — ქოუჩი ვერიფიცირებულია WaveHubX-ის მიერ.'}
            </p>
          </section>
        </div>
      </div>
    </Layout>
  )
}
