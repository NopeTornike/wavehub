import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicCoachingSession } from '@wavehub/shared-types'
import { CoachingSessionStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const STATUS_LABELS: Record<CoachingSessionStatus, string> = {
  [CoachingSessionStatus.Scheduled]: 'დაგეგმილია',
  [CoachingSessionStatus.Completed]: 'დასრულებულია',
  [CoachingSessionStatus.Cancelled]: 'გაუქმებულია',
}

export default function CoachingSessionDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me, refresh } = useAuth()

  const [session, setSession] = useState<PublicCoachingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    if (!id) return
    setLoading(true)
    setError('')
    api
      .getCoachingSession(id)
      .then(setSession)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'სესია ვერ მოიძებნა.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (error || !session) {
    return (
      <Layout>
        <div className="detail-page">
          <div className="marketplace-empty">{error || 'სესია ვერ მოიძებნა.'}</div>
        </div>
      </Layout>
    )
  }

  const isCoach = me?.username === session.coachUsername
  const isBuyer = me?.username === session.buyerUsername
  const canAct = session.status === CoachingSessionStatus.Scheduled && (isCoach || isBuyer)

  const runAction = async (action: 'complete' | 'cancel') => {
    setActionError('')
    setBusy(true)
    try {
      const updated = action === 'complete' ? await api.completeCoachingSession(session.id) : await api.cancelCoachingSession(session.id)
      setSession(updated)
      // Completing releases escrow to the coach; cancelling refunds the buyer — either way, the
      // actor's own balance may just have changed (see runAction's own no-op case: a coach
      // cancelling doesn't touch their own balance, but refresh() is still cheap and correct).
      await refresh()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'მოქმედება ვერ შესრულდა.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      {/* No static-prototype reference for a session-detail page — mirrors orders/[id].tsx's
          .detail-page/.detail-section shell, without the chat/dispute panels orders have (no
          dispute path for sessions yet, see backend/src/coaching/CLAUDE.md). */}
      <div className="detail-page">
        <Link className="detail-back-link" href="/coaching-sessions">
          ← სესიების სიაში დაბრუნება
        </Link>

        <div className="detail-title-block">
          <p className="section-kicker">კოუჩინგის სესია</p>
          <h1>
            {session.durationMinutes} წუთიანი სესია — {session.coachFirstName} {session.coachLastName}
          </h1>
          <span className="order-status">{STATUS_LABELS[session.status]}</span>
        </div>

        <section className="detail-section detail-summary-card">
          <h2>დეტალები</h2>
          <p>თარიღი და დრო: {new Date(session.scheduledAt).toLocaleString('ka-GE')}</p>
          <p>ხანგრძლივობა: {session.durationMinutes} წუთი</p>
          <p>ფასი: {session.priceWaveCoin} WC</p>
          <p>
            მწვრთნელი:{' '}
            <Link href={`/u/${session.coachUsername}`}>@{session.coachUsername}</Link>
          </p>
          <p>
            მყიდველი:{' '}
            <Link href={`/u/${session.buyerUsername}`}>@{session.buyerUsername}</Link>
          </p>
          {session.buyerMessage && (
            <>
              <h2>შეტყობინება მწვრთნელს</h2>
              <p>{session.buyerMessage}</p>
            </>
          )}
        </section>

        {canAct && (
          <section className="detail-section detail-summary-card">
            <h2>მოქმედებები</h2>
            {actionError && <div className="status-text status-error">{actionError}</div>}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {isCoach && (
                <button className="detail-buy-button" type="button" disabled={busy} onClick={() => runAction('complete')}>
                  {busy ? 'მიმდინარეობს…' : 'სესია დასრულებულია'}
                </button>
              )}
              <button className="button" type="button" disabled={busy} onClick={() => runAction('cancel')}>
                {busy ? 'მიმდინარეობს…' : 'სესიის გაუქმება'}
              </button>
            </div>
            <p className="note">
              {isCoach
                ? 'სესიის დასრულების შემდეგ თანხა გირიცხებათ 7 დღიან დაცვის პერიოდთან ერთად.'
                : 'გაუქმების შემთხვევაში თანხა სრულად დაგიბრუნდებათ.'}
            </p>
          </section>
        )}
      </div>
    </Layout>
  )
}
