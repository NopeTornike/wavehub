/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import type { PublicCoachingSession } from '@wavehub/shared-types'
import { BADGE_CATALOG, BadgeKey, CoachingSessionStatus, badgeIcon } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { SESSION_STATUS_LABELS } from '../../lib/labels'
import SessionReview from '../../components/SessionReview'
import SessionDisputePanel from '../../components/SessionDisputePanel'
import Avatar from '../../components/Avatar'
import VerifiedMark from '../../components/VerifiedMark'

// One coaching session, lifecycle v2 (backend/src/coaching/CLAUDE.md "Lifecycle v2"):
//   booked → both confirm the start (from 15 min before until 60 min after; reminders every 10 min,
//   otherwise auto-cancel + refund) → coach marks done → student confirms (or 48h auto-confirm) →
//   coach paid → student reviews. The page polls so each side sees the other's confirmation.

const S = CoachingSessionStatus
const START_EARLY_MS = 15 * 60_000
const STEPS: Array<[string, string]> = [
  ['დაჯავშნილია', 'თანხა დაცულია'],
  ['დაწყება', 'ორივე ადასტურებს'],
  ['დასრულება', 'ქოუჩი ნიშნავს'],
  ['დადასტურება', 'სტუდენტი ადასტურებს'],
]

const MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი']

// "3 ოქტომბერი, 12:00" in Tbilisi time (UTC+4) — not toLocaleString('ka-GE'): browsers without
// Georgian locale data printed English dates.
function when(value: string | null | undefined): string {
  if (!value) return ''
  const t = new Date(new Date(value).getTime() + 4 * 3600_000)
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}, ${t.toISOString().slice(11, 16)}`
}

// Server clock minus this device's clock (0 when the response has no server time).
function skewOf(session: PublicCoachingSession): number {
  return session.serverNow ? new Date(session.serverNow).getTime() - Date.now() : 0
}

function untilText(ms: number): string {
  if (ms <= 0) return 'ახლა'
  const m = Math.round(ms / 60_000)
  if (m < 60) return `${m} წუთში`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} საათში`
  return `${Math.round(h / 24)} დღეში`
}

export default function CoachingSessionDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me, checked, refresh } = useAuth()

  const [session, setSession] = useState<PublicCoachingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [clock, setClock] = useState(() => Date.now())
  // Server clock minus device clock: the start window is timed on the server's clock (a phone set to
  // the wrong time used to show a Start button the server then refused).
  const [skew, setSkew] = useState(0)
  const now = clock + skew
  // Question labels for the stored answers (answers are keyed by question key).
  const [labels, setLabels] = useState<Record<string, string>>({})
  const coachId = session?.coachId
  const hasAnswers = Boolean(session?.answers && Object.keys(session.answers).length)
  useEffect(() => {
    if (!coachId || !hasAnswers) return
    let cancelled = false
    api
      .getCoach(coachId)
      .then((c) => {
        if (!cancelled) setLabels(Object.fromEntries(c.bookingQuestions.map((q) => [q.key, q.label])))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [coachId, hasAnswers])

  useEffect(() => {
    if (checked && !me && id) {
      router.push(`/login?next=${encodeURIComponent(`/coaching-sessions/${id}`)}`)
    }
  }, [checked, me, id, router])

  const load = useCallback(
    (quiet = false) => {
      if (!id) return
      if (!quiet) setLoading(true)
      api
        .getCoachingSession(id)
        .then((s) => {
          setSession(s)
          setSkew(skewOf(s))
          setClock(Date.now())
          setError('')
        })
        .catch((err) => {
          if (!quiet) setError(errorMessage(err, 'სესია ვერ მოიძებნა.'))
        })
        .finally(() => setLoading(false))
    },
    [id],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Live: the other side's confirmation, the reminder sweep and the clock all move this page.
  const active = session && (session.status === S.Scheduled || session.status === S.InProgress || session.status === S.AwaitingConfirmation || session.status === S.Disputed)
  useEffect(() => {
    if (!active) return
    const poll = window.setInterval(() => load(true), 20_000)
    const tick = window.setInterval(() => setClock(Date.now()), 15_000)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(tick)
    }
  }, [active, load])

  if (loading || (checked && !me)) {
    return (
      <Layout title="სესია" noIndex>
        <div className="detail-page">
          <div className="marketplace-empty">იტვირთება…</div>
        </div>
      </Layout>
    )
  }

  if (error || !session) {
    return (
      <Layout title="სესია" noIndex>
        <div className="detail-page">
          <div className="marketplace-empty">{error || 'სესია ვერ მოიძებნა.'}</div>
        </div>
      </Layout>
    )
  }

  const isCoach = me?.username === session.coachUsername
  const isBuyer = me?.username === session.buyerUsername
  const start = new Date(session.scheduledAt).getTime()
  const deadline = new Date(session.startDeadline).getTime()
  const canConfirmWindow = now >= start - START_EARLY_MS && now <= deadline
  const myStartConfirmed = isCoach ? Boolean(session.coachStartConfirmedAt) : Boolean(session.buyerStartConfirmedAt)
  const otherStartConfirmed = isCoach ? Boolean(session.buyerStartConfirmedAt) : Boolean(session.coachStartConfirmedAt)
  const stepIndex =
    session.status === S.Scheduled ? (session.coachStartConfirmedAt || session.buyerStartConfirmedAt ? 1 : 0) : session.status === S.InProgress ? 2 : session.status === S.AwaitingConfirmation || session.status === S.Disputed ? 3 : 4

  const act = async (fn: () => Promise<PublicCoachingSession>, question?: string) => {
    if (question && !window.confirm(question)) return
    setActionError('')
    setBusy(true)
    try {
      const next = await fn()
      setSession(next)
      setSkew(skewOf(next))
      // Completing pays the coach, cancelling refunds the student — keep the topbar balance fresh.
      await refresh()
    } catch (err) {
      setActionError(errorMessage(err, 'მოქმედება ვერ შესრულდა.'))
    } finally {
      setBusy(false)
    }
  }

  const messageOtherParty = async () => {
    const otherUserId = isCoach ? session.buyerId : session.coachUserId
    setActionError('')
    setBusy(true)
    try {
      const conversation = await api.startDirectConversation(otherUserId)
      router.push(`/messages?conversation=${conversation.id}`)
    } catch (err) {
      setActionError(errorMessage(err, 'საუბრის დაწყება ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  // What this viewer should do now (one clear card).
  let action: { title: string; text: string; button?: { label: string; run: () => void; primary?: boolean }; secondary?: { label: string; run: () => void } } | null = null
  if (isCoach || isBuyer) {
    if (session.status === S.Scheduled) {
      if (!canConfirmWindow && now < start) {
        action = {
          title: `სესია იწყება ${untilText(start - now)}`,
          text: `დაწყების დადასტურება შესაძლებელი იქნება სესიამდე 15 წუთით ადრე. შეხსენებას მიიღებ შეტყობინებებში.${isBuyer ? ' სესიამდე შეგიძლია გააუქმო — თანხა სრულად დაგიბრუნდება.' : ''}`,
          secondary: { label: 'სესიის გაუქმება', run: () => void act(() => api.cancelCoachingSession(session.id), 'ნამდვილად გსურს სესიის გაუქმება? სტუდენტს თანხა სრულად დაუბრუნდება.') },
        }
      } else if (!myStartConfirmed) {
        action = {
          title: 'დაადასტურე, რომ სესია დაიწყო',
          text: `${otherStartConfirmed ? (isCoach ? 'სტუდენტმა უკვე დაადასტურა.' : 'ქოუჩმა უკვე დაადასტურა.') : 'ორივე მხარემ უნდა დაადასტუროს.'} თუ ${when(session.startDeadline)}-მდე ორივე არ დაადასტურებს, სესია გაუქმდება და თანხა სტუდენტს დაუბრუნდება.`,
          button: { label: 'სესია დაიწყო', primary: true, run: () => void act(() => api.confirmCoachingSessionStart(session.id)) },
          secondary: { label: 'სესიის გაუქმება', run: () => void act(() => api.cancelCoachingSession(session.id), 'ნამდვილად გსურს სესიის გაუქმება? სტუდენტს თანხა სრულად დაუბრუნდება.') },
        }
      } else {
        action = {
          title: isCoach ? 'ველოდებით სტუდენტის დადასტურებას' : 'ველოდებით ქოუჩის დადასტურებას',
          text: `შენ დაადასტურე დაწყება. მეორე მხარე ${when(session.startDeadline)}-მდე უნდა დაადასტუროს — შეხსენებები ყოველ 10 წუთში ეგზავნება.`,
        }
      }
    } else if (session.status === S.InProgress) {
      action = isCoach
        ? {
            title: 'სესია მიმდინარეობს',
            text: 'როცა სესია დასრულდება, მონიშნე დასრულებულად. თანხა ჩაგერიცხება სტუდენტის დადასტურების შემდეგ (ან ავტომატურად 48 საათში).',
            button: { label: 'სესია დასრულდა', primary: true, run: () => void act(() => api.completeCoachingSession(session.id), 'სესია დასრულდა? სტუდენტს გაეგზავნება დადასტურების მოთხოვნა.') },
            secondary: { label: 'სესიის გაუქმება (თანხის დაბრუნება)', run: () => void act(() => api.cancelCoachingSession(session.id), 'სესიის გაუქმებისას სტუდენტს თანხა სრულად უბრუნდება. გავაუქმოთ?') },
          }
        : { title: 'სესია მიმდინარეობს', text: 'წარმატებები! როცა ქოუჩი სესიას დასრულებულად მონიშნავს, აქ დაგჭირდება დადასტურება.' }
    } else if (session.status === S.AwaitingConfirmation) {
      action = isBuyer
        ? {
            title: 'დაადასტურე სესიის დასრულება',
            text: `ქოუჩმა სესია დასრულებულად მონიშნა. თუ სესია შედგა, დაადასტურე — ${session.autoConfirmAt ? `${when(session.autoConfirmAt)}-ზე ` : ''}ავტომატურად დადასტურდება. თუ სესია არ შედგა, გახსენი დავა ქვემოთ.`,
            button: { label: 'დიახ, სესია შედგა', primary: true, run: () => void act(() => api.confirmCoachingSessionComplete(session.id)) },
          }
        : {
            title: 'ველოდებით სტუდენტის დადასტურებას',
            text: `${session.coachPayoutWaveCoin} GEL ჩაგერიცხება დადასტურებისთანავე${session.autoConfirmAt ? ` (არაუგვიანეს ${when(session.autoConfirmAt)})` : ''}.`,
          }
    } else if (session.status === S.Disputed) {
      action = {
        title: 'დავა განიხილება',
        text: 'თანხა გაყინულია. WaveHub-ის გუნდი გადახედავს ორივე მხარის ახსნას და მტკიცებულებებს და მიიღებს გადაწყვეტილებას — შედეგს შეტყობინებით მიიღებ.',
      }
    }
  }

  const coachName = [session.coachFirstName, session.coachLastName].filter(Boolean).join(' ') || session.coachUsername
  const studentName = [session.buyerFirstName, session.buyerLastName].filter(Boolean).join(' ') || session.buyerUsername
  // The 3-step stepper (design): start → run the session → confirm it.
  const bigStep = stepIndex <= 1 ? 0 : stepIndex === 2 ? 1 : stepIndex === 3 ? 2 : 3
  const BIG_STEPS: Array<[string, string]> = [
    ['დაიწყე', stepIndex === 0 ? 'დაგეგმილია' : 'დაწყების დადასტურება'],
    ['ჩაატარე სესია', 'ქოუჩი იწყებს'],
    ['დაადასტურე', 'სესიის დასრულება'],
  ]
  const startLocked = session.status === S.Scheduled && !canConfirmWindow && now < start

  return (
    <Layout title={`სესია — ${isCoach ? studentName : coachName}`} noIndex>
      <div className="ss-page">
        <Link className="ss-back" href="/coaching-sessions">
          <span aria-hidden="true">←</span> ჩემი სესიები
        </Link>

        <header className="ss-head">
          <div>
            <p className="ss-kicker">
              ქოუჩინგის სესია{session.packageName ? ` • ${/[Ⴀ-ჿ]/.test(session.packageName) ? session.packageName : session.packageName.toUpperCase()}` : ''}
            </p>
            <h1>{isCoach ? studentName : coachName}</h1>
            <p className="ss-when">{`${when(session.scheduledAt)} · ${session.durationMinutes} წუთი`}</p>
          </div>
          <span className={`ss-status s-${session.status}`}>
            <img src="/assets/ui/calendar.png" alt="" aria-hidden="true" />
            {SESSION_STATUS_LABELS[session.status]}
          </span>
        </header>

        {session.status !== S.Cancelled && (
          <>
            <ol className="ss-stepper" aria-label="სესიის ეტაპები">
              {BIG_STEPS.map(([title, sub], i) => (
                <li key={title} className={i < bigStep ? 'done' : i === bigStep ? 'current' : ''}>
                  <b>{i < bigStep ? '✓' : i + 1}</b>
                  <strong>{title}</strong>
                  <small>{sub}</small>
                </li>
              ))}
            </ol>
            <ol className="ss-stages">
              {STEPS.map(([title, sub], i) => (
                <li key={title} className={i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''}>
                  <b>{i < stepIndex ? '✓' : i + 1}</b>
                  <span>
                    <strong>{title}</strong>
                    <small>{sub}</small>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}

        {action && (
          <section className="ss-action">
            <h2>
              <img src="/assets/ui/clock.png" alt="" aria-hidden="true" />
              {action.title}
            </h2>
            <p>{action.text}</p>
            {session.status === S.Scheduled && (canConfirmWindow || myStartConfirmed) && (
              <div className="cs-confirms">
                <span className={session.coachStartConfirmedAt ? 'ok' : ''}>{session.coachStartConfirmedAt ? '✓' : '○'} ქოუჩი</span>
                <span className={session.buyerStartConfirmedAt ? 'ok' : ''}>{session.buyerStartConfirmedAt ? '✓' : '○'} სტუდენტი</span>
              </div>
            )}
            {actionError && (
              <p className="seller-status error" role="alert">
                {actionError}
              </p>
            )}
            {action.button ? (
              <button type="button" className="ss-primary" disabled={busy} onClick={action.button.run}>
                <span aria-hidden="true">▶</span>
                {busy ? 'მიმდინარეობს…' : action.button.label}
              </button>
            ) : (
              startLocked && (
                <button type="button" className="ss-primary" disabled title="დაწყება შესაძლებელია სესიამდე 15 წუთით ადრე">
                  <span aria-hidden="true">▶</span>
                  სესიის გაშვება
                </button>
              )
            )}
            <div className="ss-secondary-row">
              {action.secondary && (
                <button type="button" className="ss-link" disabled={busy} onClick={action.secondary.run}>
                  {action.secondary.label.includes('გაუქმება') && <img className="ss-link-icon" src="/assets/ui/x-circle.png" alt="" aria-hidden="true" />}
                  {action.secondary.label}
                </button>
              )}
              {session.status === S.AwaitingConfirmation && isBuyer && (
                <Link className="ss-link" href="/support">
                  პრობლემის შეტყობინება
                </Link>
              )}
            </div>
          </section>
        )}

        {session.status === S.Cancelled && <p className="le-note warn">სესია გაუქმდა — {session.priceWaveCoin} GEL დაუბრუნდა სტუდენტის ბალანსს.</p>}


        <section className="ss-card">
          <h2>დეტალები</h2>
          {[
            { role: 'ქოუჩი', name: coachName, username: session.coachUsername, photo: session.coachAvatarUrl, verified: session.coachVerified, badge: '👑' },
            { role: 'სტუდენტი', name: studentName, username: session.buyerUsername, photo: session.buyerAvatarUrl, verified: false, badge: '👤' },
          ].map((p) => (
            <Link key={p.role} href={`/u/${p.username}`} className="ss-person">
              <span className="ss-person-photo">
                <Avatar name={p.name} src={p.photo} size={64} />
                <i aria-hidden="true">{p.badge}</i>
              </span>
              <span className="ss-person-copy">
                <small>{p.role}</small>
                <strong>
                  {p.name}
                  {p.verified && <VerifiedMark size={16} />}
                </strong>
                <em>@{p.username}</em>
              </span>
              <img className="ss-chevron" src="/assets/ui/chevron.png" alt="" aria-hidden="true" />
            </Link>
          ))}
          <dl className="ss-facts">
            <div>
              <dt>
                <span>
                  <img src="/assets/ui/calendar.png" alt="" aria-hidden="true" />
                </span>
                დრო
              </dt>
              <dd>{when(session.scheduledAt)}</dd>
            </div>
            <div>
              <dt>
                <span>
                  <img src="/assets/ui/clock.png" alt="" aria-hidden="true" />
                </span>
                ხანგრძლივობა
              </dt>
              <dd>{session.durationMinutes} წუთი</dd>
            </div>
            {session.discord && (
              <div>
                <dt>
                  <span className="discord">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="currentColor" d="M18.8 5.7A16 16 0 0 0 15 4.5l-.5 1a13.5 13.5 0 0 0-5 0l-.5-1a16 16 0 0 0-3.8 1.2C3.6 8.1 2.8 10.8 2.6 14c1.8 2 3.6 3.1 5.4 3.8l1.3-1.7a11 11 0 0 1-2-1c3 1.4 6.4 1.4 9.4 0-.6.4-1.3.7-2 1l1.3 1.7c1.8-.7 3.6-1.8 5.4-3.8-.2-3.2-1-5.9-2.6-8.3ZM9 13.4c-.7 0-1.3-.7-1.3-1.6s.6-1.6 1.3-1.6 1.3.7 1.3 1.6-.6 1.6-1.3 1.6Zm6 0c-.7 0-1.3-.7-1.3-1.6s.6-1.6 1.3-1.6 1.3.7 1.3 1.6-.6 1.6-1.3 1.6Z" />
                    </svg>
                  </span>
                  Discord
                </dt>
                <dd>{session.discord}</dd>
              </div>
            )}
          </dl>
          {(isCoach || isBuyer) && (
            <button type="button" className="ss-contact" disabled={busy} onClick={messageOtherParty}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
              </svg>
              {isCoach ? 'მიწერე სტუდენტს' : 'მიერთე ქოუჩს'}
              <span aria-hidden="true">›</span>
            </button>
          )}
        </section>

        {isCoach && session.status === S.Completed && <StudentBadges studentId={session.buyerId} studentName={studentName} />}

        <section className="ss-card">
          <h2 className="ss-card-title">
            <span>
              <img src="/assets/ui/wallet.png" alt="" aria-hidden="true" />
            </span>
            გადახდა
          </h2>
          <div className="ss-price-row">
            <span>სესიის ფასი</span>
            <b>{session.priceWaveCoin} GEL</b>
          </div>
          {isCoach && (
            <dl className="ss-fee">
              <div>
                <dt>{`პლატფორმის საკომისიო (${session.platformFeePercent}%)`}</dt>
                <dd>{`−${session.platformFeeWaveCoin} GEL`}</dd>
              </div>
              <div className="total">
                <dt>შენ მიიღებ</dt>
                <dd>{session.coachPayoutWaveCoin} GEL</dd>
              </div>
            </dl>
          )}
          <p className="ss-safe">
            <img src="/assets/ui/check-circle-green.png" alt="" aria-hidden="true" />
            {isCoach
              ? 'თანხა ჩაგერიცხება სტუდენტის დადასტურების შემდეგ და გასატანად ხელმისაწვდომი იქნება 7 დღეში.'
              : 'თანხა გადახდილია WaveHub-ზე და ქოუჩს გადაეცემა მხოლოდ მას შემდეგ, რაც დაადასტურებ, რომ სესია შედგა.'}
          </p>
        </section>

        {(session.goal || session.buyerMessage || hasAnswers) && (
          <section className="ss-card">
            <h2 className="ss-card-title">
              <span>
                <img src="/assets/ui/wallet-notify.png" alt="" aria-hidden="true" />
              </span>
              სტუდენტის მიზანი
            </h2>
            {session.goal && (
              <div className="ss-brief">
                <span className="ss-brief-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                  </svg>
                </span>
                <span>
                  <small>მიზანი</small>
                  <p>{session.goal}</p>
                </span>
              </div>
            )}
            {session.buyerMessage && (
              <div className="ss-brief">
                <span className="ss-brief-icon">
                  <img src="/assets/ui/chat-notify.png" alt="" aria-hidden="true" />
                </span>
                <span>
                  <small>შეტყობინება</small>
                  <p>{session.buyerMessage}</p>
                </span>
              </div>
            )}
            {hasAnswers && (
              <dl className="cs-answers">
                {Object.entries(session.answers ?? {}).map(([key, value]) => (
                  <div key={key}>
                    <dt>{labels[key] ?? key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}

        {session.challenges && (
          <section className="ss-card">
            <h2 className="ss-card-title">
              <img className="bare" src="/assets/ui/warning.png" alt="" aria-hidden="true" />
              სირთულეები
            </h2>
            <div className="ss-brief warn">
              <span className="ss-brief-icon">
                <img src="/assets/ui/warning.png" alt="" aria-hidden="true" />
              </span>
              <span>
                <small>სირთულეები</small>
                <p>{session.challenges}</p>
              </span>
            </div>
          </section>
        )}

        {(isBuyer || isCoach) && <SessionDisputePanel session={session} onChanged={() => load(true)} />}
        {session.status === S.Completed && (isBuyer || isCoach) && <SessionReview sessionId={session.id} canReview={isBuyer} />}
      </div>
    </Layout>
  )
}

// A coach's student badges (badges/ spec): "Strongest student" and "Coach's chosen student" for a
// student with a completed session. The server checks ownership; one chosen student per coach.
function StudentBadges({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [held, setHeld] = useState<BadgeKey[] | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let cancelled = false
    api
      .listMyStudents()
      .then((rows) => {
        if (!cancelled) setHeld(rows.find((r) => r.userId === studentId)?.badges ?? [])
      })
      .catch(() => {
        if (!cancelled) setHeld([])
      })
    return () => {
      cancelled = true
    }
  }, [studentId])
  const toggle = async (key: BadgeKey) => {
    if (!held) return
    setBusy(true)
    setStatus('')
    try {
      if (held.includes(key)) {
        await api.coachRevokeBadge(studentId, key)
        setHeld(held.filter((k) => k !== key))
      } else {
        await api.coachGrantBadge(studentId, key)
        setHeld([...held, key])
        setStatus(`ბეიჯი „${BADGE_CATALOG[key].label}“ მიენიჭა.`)
      }
    } catch (err) {
      setStatus(errorMessage(err, 'ოპერაცია ვერ შესრულდა.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="ss-card ss-badges">
      <h2>{`ბეიჯი სტუდენტს — ${studentName}`}</h2>
      <p>აღნიშნე შენი სტუდენტის წარმატება — ბეიჯი გამოჩნდება მის პროფილზე.</p>
      <div>
        {[BadgeKey.StrongestStudent, BadgeKey.CoachChosenStudent].map((key) => {
          const on = held?.includes(key) ?? false
          return (
            <button key={key} type="button" className={on ? 'on' : undefined} aria-pressed={on} disabled={busy || held === null} onClick={() => void toggle(key)}>
              <img src={badgeIcon(key)} alt="" aria-hidden="true" />
              <span>
                <strong>{BADGE_CATALOG[key].label}</strong>
                <small>{on ? 'მინიჭებულია — დააჭირე მოსახსნელად' : 'მინიჭება'}</small>
              </span>
            </button>
          )
        })}
      </div>
      {status && <p className="ss-badge-status">{status}</p>}
    </section>
  )
}
