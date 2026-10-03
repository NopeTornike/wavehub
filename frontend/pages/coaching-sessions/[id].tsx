import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import type { PublicCoachingSession } from '@wavehub/shared-types'
import { CoachingSessionStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { SESSION_STATUS_LABELS } from '../../lib/labels'
import SessionReview from '../../components/SessionReview'
import SessionDisputePanel from '../../components/SessionDisputePanel'

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

  return (
    <Layout title={`სესია — ${session.coachFirstName} ${session.coachLastName}`} noIndex>
      <div className="detail-page cs-page">
        <Link className="detail-back-link" href="/coaching-sessions">
          ← ჩემი სესიები
        </Link>

        <header className="cs-head">
          <div>
            <p className="section-kicker">ქოუჩინგის სესია{session.packageName ? ` · ${session.packageName}` : ''}</p>
            <h1>
              {session.coachFirstName} {session.coachLastName}
            </h1>
            <p className="cs-when">
              {when(session.scheduledAt)} · {session.durationMinutes} წუთი
            </p>
          </div>
          <span className={`cs-status s-${session.status}`}>{SESSION_STATUS_LABELS[session.status]}</span>
        </header>

        {session.status !== S.Cancelled && (
          <ol className="cs-steps" aria-label="სესიის ეტაპები">
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
        )}

        {action && (
          <section className="cs-action">
            <h2>{action.title}</h2>
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
            <div className="cs-action-buttons">
              {action.button && (
                <button type="button" className="detail-buy-button" disabled={busy} onClick={action.button.run}>
                  {busy ? 'მიმდინარეობს…' : action.button.label}
                </button>
              )}
              {action.secondary && (
                <button type="button" className="button ghost" disabled={busy} onClick={action.secondary.run}>
                  {action.secondary.label}
                </button>
              )}
              {session.status === S.AwaitingConfirmation && isBuyer && (
                <Link className="button ghost" href="/support">
                  პრობლემის შეტყობინება
                </Link>
              )}
            </div>
          </section>
        )}

        {session.status === S.Cancelled && <p className="le-note warn">სესია გაუქმდა — {session.priceWaveCoin} GEL დაუბრუნდა სტუდენტის ბალანსს.</p>}

        {(isBuyer || isCoach) && <SessionDisputePanel session={session} onChanged={() => load(true)} />}
        {session.status === S.Completed && (isBuyer || isCoach) && <SessionReview sessionId={session.id} canReview={isBuyer} />}

        <div className="cs-grid">
          <section className="detail-section cs-card">
            <h2>დეტალები</h2>
            <dl className="cs-facts">
              <div>
                <dt>დრო</dt>
                <dd>{when(session.scheduledAt)}</dd>
              </div>
              <div>
                <dt>ხანგრძლივობა</dt>
                <dd>{session.durationMinutes} წუთი</dd>
              </div>
              <div>
                <dt>ქოუჩი</dt>
                <dd>
                  <Link href={`/u/${session.coachUsername}`}>@{session.coachUsername}</Link>
                </dd>
              </div>
              <div>
                <dt>სტუდენტი</dt>
                <dd>
                  <Link href={`/u/${session.buyerUsername}`}>@{session.buyerUsername}</Link>
                </dd>
              </div>
              {session.discord && (
                <div>
                  <dt>Discord</dt>
                  <dd>
                    <code>{session.discord}</code>
                  </dd>
                </div>
              )}
            </dl>
            {(isCoach || isBuyer) && (
              <button type="button" className="button ghost" disabled={busy} onClick={messageOtherParty}>
                {isCoach ? 'მიწერე სტუდენტს' : 'მიწერე ქოუჩს'}
              </button>
            )}
          </section>

          <section className="detail-section cs-card">
            <h2>გადახდა</h2>
            <dl className="cs-facts">
              <div>
                <dt>სესიის ფასი</dt>
                <dd>{session.priceWaveCoin} GEL</dd>
              </div>
              {isCoach && (
                <>
                  <div>
                    <dt>პლატფორმის საკომისიო ({session.platformFeePercent}%)</dt>
                    <dd>−{session.platformFeeWaveCoin} GEL</dd>
                  </div>
                  <div className="cs-total">
                    <dt>შენ მიიღებ</dt>
                    <dd>{session.coachPayoutWaveCoin} GEL</dd>
                  </div>
                </>
              )}
            </dl>
            <p className="le-hint">
              {isCoach
                ? 'თანხა ჩაგერიცხება სტუდენტის დადასტურების შემდეგ და გასატანად ხელმისაწვდომი იქნება 7 დღეში.'
                : 'თანხა დაცულია WaveHub-ზე და ქოუჩს გადაეცემა მხოლოდ მას შემდეგ, რაც დაადასტურებ, რომ სესია შედგა.'}
            </p>
          </section>

          {(session.goal || session.challenges || session.buyerMessage || hasAnswers) && (
            <section className="detail-section cs-card cs-wide">
              <h2>სტუდენტის მიზანი</h2>
              {session.goal && <p className="cs-goal">{session.goal}</p>}
              {session.challenges && (
                <p>
                  <strong>სირთულეები:</strong> {session.challenges}
                </p>
              )}
              {session.buyerMessage && (
                <p>
                  <strong>შეტყობინება:</strong> {session.buyerMessage}
                </p>
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
        </div>
      </div>
    </Layout>
  )
}
