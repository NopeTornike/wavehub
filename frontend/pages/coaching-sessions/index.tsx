import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicCoachingSession } from '@wavehub/shared-types'
import { CoachingSessionStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const STATUS_LABELS: Record<CoachingSessionStatus, string> = {
  [CoachingSessionStatus.Scheduled]: 'დაგეგმილია',
  [CoachingSessionStatus.Completed]: 'დასრულებულია',
  [CoachingSessionStatus.Cancelled]: 'გაუქმებულია',
}

// Mirrors orders/index.tsx's structure exactly — same .orders-page-head/.orders-tabs/.order-card
// design, since coaching sessions are conceptually a sibling of orders (a paid, escrowed
// transaction) with no static-prototype page of its own to port from.
export default function CoachingSessions() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const [tab, setTab] = useState<'buyer' | 'coach'>('buyer')
  const [sessions, setSessions] = useState<PublicCoachingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (checked && !user) {
      router.push('/login?next=/coaching-sessions')
    }
  }, [checked, user, router])

  useEffect(() => {
    if (!user) return
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
  }, [tab, user])

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
            <small>{tab === 'buyer' ? `${totalPrice} WC` : ''}</small>
          </article>
          <article>
            <span>ჩემი, როგორც მწვრთნელის სესიები</span>
            <strong>{tab === 'coach' ? sessions.length : '—'}</strong>
            <small>{tab === 'coach' ? `${totalPrice} WC` : ''}</small>
          </article>
        </div>

        <div className="orders-tabs" role="tablist">
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
          <div className="orders-list">
            {sessions.map((session) => {
              const counterpart = tab === 'buyer' ? session.coachUsername : session.buyerUsername
              return (
                <Link key={session.id} href={`/coaching-sessions/${session.id}`} className="order-card">
                  <span className="order-thumb" aria-hidden="true">
                    {counterpart.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="order-copy">
                    <div>
                      <span className="order-status">{STATUS_LABELS[session.status]}</span>
                    </div>
                    <h2>
                      {session.durationMinutes} წუთიანი სესია — {session.coachFirstName} {session.coachLastName}
                    </h2>
                    <p>{new Date(session.scheduledAt).toLocaleString('ka-GE')}</p>
                    <span>{tab === 'buyer' ? 'მწვრთნელი' : 'მყიდველი'}: @{counterpart}</span>
                  </div>
                  <div className="order-side">
                    <strong>{session.priceWaveCoin} WC</strong>
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
