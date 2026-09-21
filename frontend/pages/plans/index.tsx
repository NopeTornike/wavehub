import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { PublicSubscriptionPlan, PublicUserSubscription, SubscriptionPerks } from '@wavehub/shared-types'
import { SubscriptionAudience, SubscriptionStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const AUDIENCE_LABELS: Record<SubscriptionAudience, string> = {
  [SubscriptionAudience.Buyer]: 'მყიდველის წევრობა',
  [SubscriptionAudience.SellerCoach]: 'გამყიდველის / მწვრთნელის ხილვადობა',
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  [SubscriptionStatus.Active]: 'აქტიური',
  [SubscriptionStatus.PastDue]: 'გადახდა ვერ განხორციელდა',
  [SubscriptionStatus.Cancelled]: 'გაუქმებული',
  [SubscriptionStatus.Expired]: 'ვადაგასული',
}

function perkLines(perks: SubscriptionPerks): string[] {
  const lines: string[] = []
  if (perks.platformFeeDiscountPercent) lines.push(`პლატფორმის საკომისიო ${perks.platformFeeDiscountPercent}%-ით ნაკლები`)
  if (perks.featuredListings) lines.push('გამორჩეული განცხადებები / მწვრთნელის პროფილი')
  if (perks.prioritySupport) lines.push('პრიორიტეტული მხარდაჭერა')
  if (perks.profileBadge) lines.push(`პროფილის ბეჯი: ${perks.profileBadge}`)
  return lines
}

export default function Plans() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<PublicSubscriptionPlan[]>([])
  const [mine, setMine] = useState<PublicUserSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([api.listSubscriptionPlans(), user ? api.listMySubscriptions() : Promise.resolve([])])
      setPlans(p)
      setMine(m)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const live = (audience: SubscriptionAudience) =>
    mine.find((s) => s.plan.audience === audience && (s.status === SubscriptionStatus.Active || s.status === SubscriptionStatus.PastDue))

  const subscribe = async (planId: string) => {
    setError('')
    setBusyId(planId)
    try {
      const origin = window.location.origin
      const res = await api.checkoutSubscription({ planId, successUrl: `${origin}/plans?checkout=success`, failUrl: `${origin}/plans?checkout=fail` })
      // Full-page redirect to BOG's hosted checkout (same pattern as wallet.tsx's top-up).
      window.location.assign(res.redirectUrl)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'გადახდის დაწყება ვერ მოხერხდა.')
      setBusyId(null)
    }
  }

  const cancel = async (id: string) => {
    setError('')
    setBusyId(id)
    try {
      await api.cancelSubscription(id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'გაუქმება ვერ მოხერხდა.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Layout>
      <div className="detail-page">
        <h1 className="page-title">გამოწერები</h1>
        <p className="page-subtitle">აირჩიეთ გეგმა — გადახდა ავტომატურად განახლდება ყოველი პერიოდის ბოლოს, გაუქმებამდე.</p>
        {error && <div className="status-text status-error">{error}</div>}

        {mine.length > 0 && (
          <>
            <h2 style={{ fontSize: '1rem' }}>ჩემი გამოწერები</h2>
            <div className="order-list" style={{ marginBottom: 32 }}>
              {mine.map((s) => (
                <div key={s.id} className="admin-row">
                  <div className="admin-row-main">
                    <strong>{s.plan.name}</strong> <span className="note">({AUDIENCE_LABELS[s.plan.audience]})</span>
                    <div className="note" style={{ margin: 0 }}>
                      {STATUS_LABELS[s.status]} · {s.cancelAtPeriodEnd ? 'მოქმედებს' : 'განახლდება'}: {new Date(s.currentPeriodEnd).toLocaleDateString('ka-GE')}
                      {s.cancelAtPeriodEnd && ' (გაუქმდება პერიოდის ბოლოს)'}
                    </div>
                  </div>
                  {(s.status === SubscriptionStatus.Active || s.status === SubscriptionStatus.PastDue) && !s.cancelAtPeriodEnd && (
                    <div className="admin-row-actions">
                      <button type="button" className="button" disabled={busyId === s.id} onClick={() => cancel(s.id)}>
                        გაუქმება
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {loading ? (
          <div className="marketplace-empty">იტვირთება…</div>
        ) : plans.length === 0 ? (
          <div className="marketplace-empty">გეგმები ჯერ არ არის დამატებული.</div>
        ) : (
          [SubscriptionAudience.Buyer, SubscriptionAudience.SellerCoach].map((audience) => {
            const group = plans.filter((p) => p.audience === audience)
            if (group.length === 0) return null
            const current = live(audience)
            return (
              <section key={audience}>
                <h2 style={{ fontSize: '1rem' }}>{AUDIENCE_LABELS[audience]}</h2>
                <div className="plan-grid">
                  {group.map((plan) => (
                    <article key={plan.id} className="plan-card">
                      <h3 style={{ margin: 0 }}>{plan.name}</h3>
                      <strong>
                        {plan.priceGel} ₾ <span className="note">/ {plan.billingPeriodDays} დღე</span>
                      </strong>
                      <p className="note" style={{ margin: 0 }}>{plan.description}</p>
                      <ul>
                        {perkLines(plan.perks).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      {!user ? (
                        <Link className="button" href="/login" style={{ textAlign: 'center' }}>შესვლა გამოსაწერად</Link>
                      ) : current ? (
                        <button type="button" className="button" disabled>
                          {current.plan.id === plan.id ? 'აქტიურია' : 'ჯერ გააუქმეთ მიმდინარე გეგმა'}
                        </button>
                      ) : (
                        <button type="button" className="button" disabled={busyId === plan.id} onClick={() => subscribe(plan.id)}>
                          გამოწერა
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>
    </Layout>
  )
}
