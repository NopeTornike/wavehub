import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicCoachDetail } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const DURATION_OPTIONS = [30, 60, 90, 120]

// Same game→icon and language→flag maps the static prototype's coach-book-session.js uses for
// .coach-games-card / .coach-languages-card. Keys are lowercased names; a game/language with no
// asset falls back to initials (games) or plain text (languages), exactly like the prototype.
const GAME_ICONS: Record<string, string> = {
  'pubg mobile': '/assets/pubg-mobile-icon.png',
  'cod mobile': '/assets/cod-mobile-icon.png',
  'call of duty': '/assets/cod-mobile-icon.png',
  valorant: '/assets/valorant-icon.png',
  cs2: '/assets/cs2-popular-games-photo.png',
  'mobile legends': '/assets/mobile-legends-popular-games-photo.png',
  'free fire': '/assets/freefire-photo.jpeg',
  roblox: '/assets/roblox-popular-games-photo.png',
}

const LANGUAGE_FLAGS: Record<string, string> = {
  ქართული: '/assets/georgian-flag-icon.png',
  english: '/assets/united-kingdom-flag.png',
}

export default function CoachProfile() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me, refresh } = useAuth()

  const [coach, setCoach] = useState<PublicCoachDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Local-date `YYYY-MM-DD` for the date input's `min` (computed once, outside render).
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api
      .getCoach(id)
      .then((data) => {
        if (!cancelled) setCoach(data)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'მწვრთნელი ვერ მოიძებნა.'))
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
      <Layout title="მწვრთნელი">
        <div className="coaching-body">
          <div className="coach-profile-shell">
            <p className="coach-profile-empty">იტვირთება…</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !coach) {
    return (
      <Layout title="მწვრთნელი ვერ მოიძებნა" noIndex>
        <div className="coaching-body">
          <div className="coach-profile-shell">
            <p className="coach-profile-empty">{error || 'მწვრთნელი ვერ მოიძებნა.'}</p>
          </div>
        </div>
      </Layout>
    )
  }

  const isOwnProfile = me?.username === coach.username
  const sessionPrice = Math.round((coach.hourlyRateWaveCoin * durationMinutes) / 60)
  const notEnoughBalance = me !== null && me !== undefined && me.wavecoinBalance < sessionPrice
  const initials = `${coach.firstName[0] ?? ''}${coach.lastName[0] ?? ''}`.toUpperCase()
  const gameIcon = coach.gameName ? GAME_ICONS[coach.gameName.trim().toLowerCase()] : undefined
  // Info-grid card count drives the column override below — see `.coach-info-grid-auto`.
  const infoCards = (coach.gameName ? 1 : 0) + (coach.languages.length > 0 ? 1 : 0)

  return (
    <Layout
      title={`${coach.firstName} ${coach.lastName} — მწვრთნელი`}
      description={`${coach.specialty}${coach.gameName ? ` (${coach.gameName})` : ''}. ${coach.bio}`.slice(0, 160)}
    >
      {/* Ported from the static prototype's real coach-profile page (coach-book-session.html +
          coach-book-session.js, `<title>WaveHub - Coach Profile</title>`). That page GREW into a
          real profile since this app last mirrored it — frontend/CLAUDE.md used to record "no
          coach-profile page exists in the prototype at all", which is no longer true, so this page
          moved off the borrowed listing-detail `.detail-*` classes onto the prototype's own
          `.coach-profile-*` design system.

          `.coaching-body` scopes coaching.html's `--coach-*` CSS variables (same wrapper trick as
          coaching/index.tsx — the prototype puts them on <body>, we keep the shared app shell).

          Deliberately NOT using the prototype's `.coach-detail-body` body class: every rule in it
          is either a `display:none` for a section this page doesn't render anyway, or a layout
          tweak the base rules already provide — and it additionally hides `.coach-starting-price`,
          which here shows the coach's REAL hourly rate and must stay visible.

          Omitted per root CLAUDE.md rule #6 (no fabricated data) — every one of these needs a field
          the real Coach entity/PublicCoachDetail does not have:
          - `.coach-online-pill` (availability/presence): no online-status is tracked anywhere.
          - `.coach-score-card` "Wave Score": the prototype computes it client-side from mock data.
          - `.coach-profile-metrics` (Students / Completed Sessions / Success Rate / Avg. Response
            Time): no aggregate exists for any of the four.
          - `.coach-overview-top` (`.coach-video-card`, `.coach-quote-card`): no intro-video or
            quote field.
          - `.coach-style-card`, `.coach-expertise-card`, `.coach-session-card`,
            `.coach-achievements`: no coaching-style / expertise / achievement fields.
          - `.coach-profile-tabs` + `.coach-reviews-panel` + `.coach-feedback-form`: coaching
            sessions have no review model yet (Coach.ratingAvg is populated by a future one — see
            backend/src/coaching/CLAUDE.md), so there is no review list to tab to.
          - `.coach-time-row` / `.coach-time-groups` (availability calendar): no availability model;
            the real date/time form below replaces it.
          - `.coach-message-secondary` ("Message Coach"): Direct messaging is transacted-users-only
            (LAUNCH_PLAN.md §4) — a generic message button here would 403 for most visitors.
          - `.coach-book-secondary` ("Add to Wishlist"): no wishlist backend.
          - `.coach-similar-section`: would need a "related coaches" query this API doesn't expose.
          The reference page itself already hides several of these (about/expertise/achievements/
          calendar/protection-row/similar) via `.coach-detail-body`, so omitting them also matches
          what the live github.io reference actually renders. */}
      <div className="coaching-body">
        <div className="coach-profile-shell">
          <Link className="coach-profile-back" href="/coaching">
            <span aria-hidden="true">&lt;</span> მწვრთნელების სიაში დაბრუნება
          </Link>

          <section className="coach-profile-hero" aria-labelledby="coachProfileTitle">
            <div className="coach-profile-portrait-wrap">
              {/* No avatar/photo field on User or Coach — the prototype's own no-image branch
                  (initials, without `.has-image`) is what renders here. */}
              <div className="coach-profile-portrait">
                <span>{initials}</span>
              </div>
            </div>

            <div className="coach-profile-intro">
              <div className="coach-profile-title-row">
                <h1 id="coachProfileTitle">
                  {coach.firstName} {coach.lastName}
                </h1>
                {/* Real: the public directory/detail endpoints only ever return Verified coaches. */}
                <span className="coach-verified-mark" aria-label="ვერიფიცირებული მწვრთნელი" role="img" />
              </div>

              {coach.profileBadge && (
                <div className="coach-profile-badges">
                  {/* The single real badge this app has: the Seller/Coach plan's profileBadge perk.
                      The prototype's other badges (Conqueror / Diamond Coach / Fast Responder /
                      Top 1%) are mock tags with no backing field. */}
                  <span className="coach-profile-badge gold">{coach.profileBadge}</span>
                </div>
              )}

              <h2>{coach.specialty}</h2>
              <p>{coach.bio}</p>
            </div>

            {/* `.single` is the prototype's own one-card variant — used because the second card
                (Wave Score) is mock-only and omitted above. */}
            <div className="coach-score-panels single">
              {coach.ratingAvg ? (
                <article className="coach-score-card">
                  <span>რეიტინგი</span>
                  <strong>{coach.ratingAvg}</strong>
                  <div className="coach-stars" aria-hidden="true">
                    {'★'.repeat(Math.max(0, Math.min(5, Math.round(Number(coach.ratingAvg)))))}
                  </div>
                  <small>({coach.ratingCount} შეფასება)</small>
                </article>
              ) : (
                <article className="coach-score-card coach-score-card-empty">
                  <span>რეიტინგი</span>
                  <strong>—</strong>
                  <small>ჯერ არ აქვს შეფასება</small>
                </article>
              )}
            </div>
          </section>

          {infoCards > 0 && (
            <div className="coach-info-grid coach-info-grid-auto">
              {coach.gameName && (
                <article className="coach-info-card coach-games-card">
                  <h2>თამაშები</h2>
                  <div>
                    {/* One game only — Coach.gameId is a single FK, not the prototype's array. */}
                    <span className={gameIcon ? 'coach-game-item-with-image' : undefined}>
                      <b className={gameIcon ? 'coach-game-image-shell' : undefined}>
                        {gameIcon ? (
                          <Image src={gameIcon} alt="" aria-hidden="true" width={44} height={44} unoptimized />
                        ) : (
                          coach.gameName
                            .split(' ')
                            .map((part) => part[0])
                            .join('')
                            .slice(0, 4)
                        )}
                      </b>
                      {coach.gameName}
                      <small>ძირითადი თამაში</small>
                    </span>
                  </div>
                </article>
              )}

              {coach.languages.length > 0 && (
                <article className="coach-info-card coach-languages-card">
                  <h2>ენები</h2>
                  <div>
                    {coach.languages.map((language) => {
                      const key = language.trim().toLowerCase()
                      const flag = LANGUAGE_FLAGS[key]
                      const isGeorgian = key === 'ქართული'
                      return (
                        <span
                          key={language}
                          className={flag ? `coach-language-with-icon${isGeorgian ? ' coach-language-georgian' : ''}` : undefined}
                        >
                          {flag && (
                            <Image
                              className="coach-language-icon"
                              src={flag}
                              alt=""
                              aria-hidden="true"
                              width={22}
                              height={22}
                              unoptimized
                            />
                          )}
                          {language}
                        </span>
                      )
                    })}
                  </div>
                </article>
              )}
            </div>
          )}

          <section className="coach-booking-panel" aria-label="სესიის დაჯავშნა">
            <div className="coach-starting-price">
              <span>საათობრივი ფასი</span>
              <strong>
                {coach.hourlyRateWaveCoin} <small>WC/სთ</small>
              </strong>
            </div>

            {isOwnProfile ? (
              <p className="coach-booking-status">ეს თქვენი პროფილია — საკუთარი თავის დაჯავშნა შეუძლებელია.</p>
            ) : me ? (
              <form
                className="stack-form"
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
                    setBookingError(errorMessage(err, 'სესიის დაჯავშნა ვერ მოხერხდა.'))
                  } finally {
                    setBooking(false)
                  }
                }}
              >
                <label className="field">
                  თარიღი
                  <input
                    type="date"
                    min={todayIso}
                    value={scheduledDate}
                    onChange={(event) => setScheduledDate(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  დრო
                  <input type="time" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} required />
                </label>
                <label className="field">
                  ხანგრძლივობა
                  <select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} წუთი — {Math.round((coach.hourlyRateWaveCoin * minutes) / 60)} WC
                      </option>
                    ))}
                  </select>
                </label>
                {/* `.field-wide` makes this span the whole booking row — see the
                    `.coach-booking-panel .stack-form` block in global.css. */}
                <label className="field field-wide">
                  შეტყობინება მწვრთნელს (არასავალდებულო)
                  <textarea rows={3} maxLength={1000} value={buyerMessage} onChange={(event) => setBuyerMessage(event.target.value)} />
                </label>

                {bookingError && (
                  <p className="coach-booking-status" role="alert">
                    {bookingError}
                  </p>
                )}
                {notEnoughBalance && (
                  <p className="coach-booking-status">
                    თქვენი ბალანსია {me.wavecoinBalance} WC — ამ სესიისთვის არ გყოფნით.{' '}
                    <Link href="/wallet">შეავსეთ საფულე</Link>
                  </p>
                )}

                <button className="coach-book-primary" type="submit" disabled={booking}>
                  {booking ? 'იჯავშნება…' : `სესიის დაჯავშნა — ${sessionPrice} WC`}
                </button>
              </form>
            ) : (
              <button className="coach-book-primary" type="button" onClick={() => router.push(`/login?next=/coaching/${coach.id}`)}>
                სესიის დასაჯავშნად გაიარეთ ავტორიზაცია
              </button>
            )}

            {/* Real, material information about where the money goes — kept (as plain copy, not the
                prototype's mock `.coach-protection-row` fact grid) because it describes the actual
                escrow behaviour in backend/src/coaching/. */}
            <p className="coach-booking-status">
              სესიის თანხა ინახება escrow-ში მანამ, სანამ სესია არ დასრულდება — მწვრთნელი ვერიფიცირებულია WaveHub-ის მიერ.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  )
}
