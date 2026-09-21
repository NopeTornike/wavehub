import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import type { PublicSubscriptionPlan, PublicUserSubscription, SubscriptionPerks } from '@wavehub/shared-types'
import { SubscriptionAudience, SubscriptionStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
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

// The date label depends on what actually happens at `currentPeriodEnd` for this state.
function stateLine(s: PublicUserSubscription): string {
  if (s.status === SubscriptionStatus.PastDue) return 'გადახდის ვადა'
  if (s.status === SubscriptionStatus.Cancelled) return 'გაუქმდა'
  if (s.status === SubscriptionStatus.Expired) return 'ამოიწურა'
  return s.cancelAtPeriodEnd || s.isGranted ? 'მოქმედებს' : 'განახლდება'
}
const isLive = (s: PublicUserSubscription) => s.status === SubscriptionStatus.Active || s.status === SubscriptionStatus.PastDue

export default function Plans() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const [plans, setPlans] = useState<PublicSubscriptionPlan[]>([])
  const [mine, setMine] = useState<PublicUserSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  // BOG redirects back here with ?checkout=success|fail (see `subscribe` below). Activation itself
  // happens later through the server-to-server callback, so "success" only means the visitor
  // finished paying — the subscription may take a moment to show up below.
  const checkoutResult = router.query.checkout

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([api.listSubscriptionPlans(), user ? api.listMySubscriptions() : Promise.resolve([])])
      setPlans(p)
      setMine(m)
      setError('')
    } catch (err) {
      setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!checked) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [checked, load])

  const live = (audience: SubscriptionAudience) => mine.find((s) => s.plan.audience === audience && isLive(s))

  const subscribe = async (planId: string) => {
    setError('')
    setBusyId(planId)
    try {
      const origin = window.location.origin
      const res = await api.checkoutSubscription({ planId, successUrl: `${origin}/plans?checkout=success`, failUrl: `${origin}/plans?checkout=fail` })
      // Full-page redirect to BOG's hosted checkout (same pattern as wallet.tsx's top-up).
      window.location.assign(res.redirectUrl)
    } catch (err) {
      setError(errorMessage(err, 'გადახდის დაწყება ვერ მოხერხდა.'))
      setBusyId(null)
    }
  }

  const cancel = async (subscription: PublicUserSubscription) => {
    if (!window.confirm(`გავაუქმოთ „${subscription.plan.name}“? გამოწერა მოქმედი დარჩება მიმდინარე პერიოდის ბოლომდე.`)) return
    setError('')
    setBusyId(subscription.id)
    try {
      await api.cancelSubscription(subscription.id)
      await load()
    } catch (err) {
      setError(errorMessage(err, 'გაუქმება ვერ მოხერხდა.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Layout
      title="გამოწერები"
      description="აირჩიეთ WaveHub-ის მყიდველის წევრობა ან გამყიდველის/მწვრთნელის ხილვადობის გეგმა — საკომისიოს ფასდაკლება, გამორჩეული განცხადებები და პრიორიტეტული მხარდაჭერა."
    >
      <div className="detail-page">
        <h1 className="page-title">გამოწერები</h1>
        <p className="page-subtitle">აირჩიეთ გეგმა — გადახდა ავტომატურად განახლდება ყოველი პერიოდის ბოლოს, გაუქმებამდე.</p>
        {checkoutResult === 'success' && (
          <div className="status-text status-success" role="status">
            გადახდა მიღებულია. გამოწერა რამდენიმე წუთში გააქტიურდება — თუ ქვემოთ ჯერ არ ჩანს, განაახლეთ გვერდი.
          </div>
        )}
        {checkoutResult === 'fail' && (
          <div className="status-text status-error" role="alert">
            გადახდა ვერ განხორციელდა. თანხა არ ჩამოგჭრიათ — სცადეთ თავიდან.
          </div>
        )}
        {error && (
          <div className="status-text status-error" role="alert">
            {error}
          </div>
        )}

        {mine.some((s) => s.status === SubscriptionStatus.PastDue) && (
          <div className="status-text status-error" role="alert">
            ბოლო გადახდა ვერ განხორციელდა. თქვენი პრივილეგიები ჯერ კიდევ მოქმედებს, მაგრამ თუ 7 დღის განმავლობაში გადახდა ვერ მოხერხდა, გამოწერა ამოიწურება. შეამოწმეთ ბარათზე თანხა — ავტომატურად ვცდით ხელახლა.
          </div>
        )}

        {mine.length > 0 && (
          <section aria-labelledby="mySubscriptionsTitle">
            <h2 id="mySubscriptionsTitle" style={{ fontSize: '1rem' }}>
              ჩემი გამოწერები
            </h2>
            <div className="order-list" style={{ marginBottom: 32 }}>
              {mine.map((s) => (
                <div key={s.id} className="admin-row">
                  <div className="admin-row-main">
                    <strong>{s.plan.name}</strong> <span className="note">({AUDIENCE_LABELS[s.plan.audience]})</span>
                    <div className="note" style={{ margin: 0 }}>
                      {STATUS_LABELS[s.status]} · {stateLine(s)}: {new Date(s.currentPeriodEnd).toLocaleDateString('ka-GE')}
                      {s.status === SubscriptionStatus.Active && s.cancelAtPeriodEnd && ' (გაუქმდება პერიოდის ბოლოს)'}
                      {s.status === SubscriptionStatus.Active && s.isGranted && !s.cancelAtPeriodEnd && ' (ავტომატურად არ განახლდება)'}
                    </div>
                  </div>
                  {isLive(s) && !s.cancelAtPeriodEnd && !s.isGranted && (
                    <div className="admin-row-actions">
                      <button type="button" className="button" disabled={busyId === s.id} onClick={() => cancel(s)}>
                        {busyId === s.id ? 'მიმდინარეობს…' : 'გაუქმება'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {loading ? (
          <div className="marketplace-empty">იტვირთება…</div>
        ) : plans.length === 0 ? (
          <div className="marketplace-empty">{error ? 'გეგმების ჩატვირთვა ვერ მოხერხდა.' : 'გეგმები ჯერ არ არის დამატებული.'}</div>
        ) : (
          [SubscriptionAudience.Buyer, SubscriptionAudience.SellerCoach].map((audience) => {
            const group = plans.filter((p) => p.audience === audience)
            if (group.length === 0) return null
            const current = live(audience)
            return (
              <section key={audience} aria-labelledby={`audience-${audience}`}>
                <h2 id={`audience-${audience}`} style={{ fontSize: '1rem' }}>
                  {AUDIENCE_LABELS[audience]}
                </h2>
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
                        <Link className="button" href="/login?next=/plans" style={{ textAlign: 'center' }}>შესვლა გამოსაწერად</Link>
                      ) : current ? (
                        <button type="button" className="button" disabled>
                          {current.plan.id === plan.id ? 'აქტიურია' : 'ჯერ გააუქმეთ მიმდინარე გეგმა'}
                        </button>
                      ) : (
                        <button type="button" className="button" disabled={busyId === plan.id} onClick={() => subscribe(plan.id)}>
                          {busyId === plan.id ? 'გადამისამართება…' : 'გამოწერა'}
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
