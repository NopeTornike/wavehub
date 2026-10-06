/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicCoachingSession } from '@wavehub/shared-types'
import { CoachingSessionStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { SESSION_STATUS_LABELS } from '../../lib/labels'
import { kaTime } from '../../lib/dates'
import VerifiedMark from '../../components/VerifiedMark'


// Mirrors orders/index.tsx's structure exactly — same .orders-page-head/.orders-tabs/.order-card
// design, since coaching sessions are conceptually a sibling of orders (a paid, escrowed
// transaction) with no static-prototype page of its own to port from.
// Status pill colour: green while booked/running/done, amber while waiting on a confirmation,
// red when cancelled or disputed.
function sessionTone(status: CoachingSessionStatus): 'ok' | 'wait' | 'bad' {
  if (status === CoachingSessionStatus.Cancelled || status === CoachingSessionStatus.Disputed) return 'bad'
  if (status === CoachingSessionStatus.AwaitingConfirmation) return 'wait'
  return 'ok'
}

// Package names in capitals like the design ("STARTER") — Latin only: upper-casing Georgian
// turns it into the Mtavruli capital script.
function latinUpper(value: string): string {
  return /[\u10A0-\u10FF]/.test(value) ? value : value.toUpperCase()
}

// "4.10.2026" (the design's short date), built by hand like lib/dates.
function numericDate(d: Date): string {
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`
}

const LIVE = [CoachingSessionStatus.Scheduled, CoachingSessionStatus.InProgress, CoachingSessionStatus.AwaitingConfirmation, CoachingSessionStatus.Disputed]

export default function CoachingSessions() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const [tab, setTab] = useState<'buyer' | 'coach'>('buyer')
  // A coach lands on their students' sessions (client bug #2: the page always opened on "my
  // bookings", so a coach's active sessions looked missing). Decided once, on the first load.
  const [tabChosen, setTabChosen] = useState(false)
  const userId = user?.id
  useEffect(() => {
    if (!userId || tabChosen) return
    Promise.all([api.listMySessionsAsCoach().catch(() => []), api.listMySessionsAsBuyer().catch(() => [])]).then(([asCoach, asBuyer]) => {
      const live = (list: PublicCoachingSession[]) => list.some((x) => LIVE.includes(x.status))
      if (asCoach.length > 0 && (live(asCoach) || !live(asBuyer))) setTab('coach')
      setTabChosen(true)
    })
  }, [userId, tabChosen])
  const [sessions, setSessions] = useState<PublicCoachingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (checked && !user) {
      router.push('/login?next=/coaching-sessions')
    }
  }, [checked, user, router])

  useEffect(() => {
    if (!user || !tabChosen) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    const call = tab === 'buyer' ? api.listMySessionsAsBuyer() : api.listMySessionsAsCoach()
    call
      .then((data) => {
        if (!cancelled) setSessions(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(errorMessage(err, 'სესიების ჩატვირთვა ვერ მოხერხდა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, user, tabChosen])

  const totalPrice = sessions.reduce((sum, session) => sum + session.priceWaveCoin, 0)

  return (
    <Layout title="ჩემი სესიები" noIndex>
      <section className="orders-page-head">
        <div>
          <p className="section-kicker">კოუჩინგის სესიები</p>
          <h1>ჩემი სესიები</h1>
          <p>ნახეთ და მართეთ თქვენი დაჯავშნილი და ჩატარებული სესიები.</p>
        </div>
        <div className="marketplace-total">
          <strong>{sessions.length}</strong>
          <span>სესია</span>
        </div>
      </section>

      <section className="orders-dashboard">
        <div className="orders-summary" aria-label="სესიების შეჯამება">
          <article>
            <span>დაჯავშნილი სესიები</span>
            <strong>{tab === 'buyer' ? sessions.length : '—'}</strong>
            <small>{tab === 'buyer' ? `${totalPrice} GEL` : ''}</small>
          </article>
          <article>
            <span>ჩემი, როგორც მწვრთნელის სესიები</span>
            <strong>{tab === 'coach' ? sessions.length : '—'}</strong>
            <small>{tab === 'coach' ? `${totalPrice} GEL` : ''}</small>
          </article>
        </div>

        <div className="oc-tabs" role="tablist">
          <button className={tab === 'buyer' ? 'active' : ''} type="button" role="tab" aria-selected={tab === 'buyer'} onClick={() => setTab('buyer')}>
            ჩემი დაჯავშნები
          </button>
          <button className={tab === 'coach' ? 'active' : ''} type="button" role="tab" aria-selected={tab === 'coach'} onClick={() => setTab('coach')}>
            მწვრთნელის სესიები
          </button>
        </div>

        {error && (
          <div className="status-text status-error" role="alert">
            {error}
          </div>
        )}

        {!checked || !user || loading ? (
          <div className="orders-empty">იტვირთება…</div>
        ) : sessions.length === 0 ? (
          <div className="orders-empty">
            <strong>სესიები ვერ მოიძებნა</strong>
            <p>თქვენი შესაბამისი სესიები აქ გამოჩნდება.</p>
          </div>
        ) : (
          // Session cards (design 2026-10-04, screenshot "sessions"): the other person by photo,
          // full name and @handle — the coach on "my bookings", the student on "coach sessions".
          <div className="sc-list">
            {sessions.map((session) => {
              const asBuyer = tab === 'buyer'
              const name = asBuyer
                ? [session.coachFirstName, session.coachLastName].filter(Boolean).join(' ') || session.coachUsername
                : [session.buyerFirstName, session.buyerLastName].filter(Boolean).join(' ') || session.buyerUsername
              const handle = asBuyer ? session.coachUsername : session.buyerUsername
              const photo = asBuyer ? session.coachAvatarUrl : session.buyerAvatarUrl
              const start = new Date(session.scheduledAt)
              const end = new Date(start.getTime() + session.durationMinutes * 60_000)
              return (
                <Link key={session.id} href={`/coaching-sessions/${session.id}`} className="sc-card">
                  <span className="sc-photo">{photo ? <img src={photo} alt="" /> : <span>{name.slice(0, 2).toUpperCase()}</span>}</span>
                  <div className="sc-body">
                    <span className={`sc-status ${sessionTone(session.status)}`}>
                      <i aria-hidden="true" />
                      {SESSION_STATUS_LABELS[session.status]}
                    </span>
                    <span className="sc-role">
                      <span aria-hidden="true">🎓</span>
                      {asBuyer ? 'მწვრთნელი' : 'მოსწავლე'}
                    </span>
                    <strong className="sc-name">
                      {name}
                      {asBuyer && session.coachVerified && <VerifiedMark size={17} />}
                    </strong>
                    <small className="sc-handle">@{handle}</small>
                    <b className="sc-package">{latinUpper(session.packageName ?? `${session.durationMinutes} წუთიანი სესია`)}</b>
                  </div>
                  <span className="sc-chevron" aria-hidden="true">
                    <img src="/assets/ui/chevron.png" alt="" />
                  </span>
                  <div className="sc-foot">
                    <span className="sc-when">
                      <img src="/assets/ui/calendar.png" alt="" aria-hidden="true" />
                      <span>
                        {numericDate(start)}
                        <small>{`${kaTime(start)} - ${kaTime(end)}`}</small>
                      </span>
                    </span>
                    <span className="sc-when">
                      <img src="/assets/ui/clock.png" alt="" aria-hidden="true" />
                      <span>
                        {`${session.durationMinutes} წთ`}
                        <small>ხანგრძლივობა</small>
                      </span>
                    </span>
                    <b className="sc-price">{session.priceWaveCoin} GEL</b>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </Layout>
  )
}
