/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import type { PublicSubscriptionPlan, PublicUserSubscription, SubscriptionPerks } from '@wavehub/shared-types'
import { SubscriptionAudience, SubscriptionStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'

// The owner's "WaveHubX PLUS" subscription screen, 1:1 (2026-11-06): hero with the PLUS card art,
// the plan's price card, its perks as rows (tap one to read what it does), the gradient checkout
// button and the payment / cancel / period facts. Every row is a real perk the backend applies
// (backend/src/subscriptions/CLAUDE.md). The mockup's "more platform features" and "exclusive
// offers" rows are not shown: no perk backs them (rule #6). The art is cropped from the owner's
// mockup (`/assets/plus-hero-art.webp`).

const AUDIENCE_LABELS: Record<SubscriptionAudience, string> = {
  [SubscriptionAudience.Buyer]: 'მყიდველი',
  [SubscriptionAudience.SellerCoach]: 'გამყიდველი / ქოუჩი',
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  [SubscriptionStatus.Active]: 'აქტიური',
  [SubscriptionStatus.PastDue]: 'გადახდა ვერ განხორციელდა',
  [SubscriptionStatus.Cancelled]: 'გაუქმებული',
  [SubscriptionStatus.Expired]: 'ვადაგასული',
}

type PerkTone = 'violet' | 'blue' | 'cyan' | 'gold'
type Perk = { key: string; tone: PerkTone; icon: JSX.Element; title: string; detail: string }

const ICONS = {
  percent: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.5 5.5 5.5 18.5" />
      <circle cx="7" cy="7" r="2.6" />
      <circle cx="17" cy="17" r="2.6" />
    </svg>
  ),
  diamond: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 4h11l4 5.5L12 21 2.5 9.5z" />
      <path d="M2.5 9.5h19M9 4l-1.5 5.5L12 21l4.5-11.5L15 4" />
    </svg>
  ),
  headset: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="13" width="4" height="6.5" rx="1.6" />
      <rect x="17" y="13" width="4" height="6.5" rx="1.6" />
      <path d="M19 19.5c0 1.2-1.6 2-4 2h-2" />
    </svg>
  ),
  crown: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 8.5 8 12l4-6.5 4 6.5 4.5-3.5L19 18H5z" />
      <path d="M5 21h14" />
    </svg>
  ),
}

// Only perks this plan really grants. The fee discount is a Seller / Coach perk (it lowers the fee
// on that member's own orders and sessions), so a buyer plan never advertises it.
function perksOf(plan: PublicSubscriptionPlan): Perk[] {
  const p: SubscriptionPerks = plan.perks
  const out: Perk[] = []
  if (plan.audience === SubscriptionAudience.SellerCoach && p.platformFeeDiscountPercent) {
    out.push({
      key: 'fee',
      tone: 'violet',
      icon: ICONS.percent,
      title: `${p.platformFeeDiscountPercent}%-ით შემცირებული საკომისიო გადახდებზე`,
      detail: `შენს შეკვეთებსა და ქოუჩინგის სესიებზე პლატფორმის საკომისიო ${p.platformFeeDiscountPercent} პროცენტული პუნქტით ნაკლებია, სანამ გამოწერა აქტიურია.`,
    })
  }
  if (p.featuredListings) {
    out.push({
      key: 'featured',
      tone: 'blue',
      icon: ICONS.diamond,
      title: plan.audience === SubscriptionAudience.SellerCoach ? 'გამორჩეული გამყიდველი / მენტორის პროფილი' : 'გამორჩეული პროფილი',
      detail: 'შენი განცხადებები და ქოუჩის პროფილი სიებში სხვებზე მაღლა ჩანს.',
    })
  }
  if (p.prioritySupport) {
    out.push({
      key: 'support',
      tone: 'cyan',
      icon: ICONS.headset,
      title: 'პრიორიტეტული მხარდაჭერა',
      detail: 'შენს მიმართვებს Support მაღალი პრიორიტეტით იღებს და პირველ რიგში განიხილავს.',
    })
  }
  // Every live subscription earns the "Subscription Member" badge (backend/src/badges).
  out.push({
    key: 'badge',
    tone: 'gold',
    icon: ICONS.crown,
    title: 'Subscription Member ბეჯი',
    detail: p.profileBadge
      ? `შენს პროფილზე გამოჩნდება Subscription Member ბეჯი და „${p.profileBadge}“ ნიშანი, სანამ გამოწერა აქტიურია.`
      : 'შენს პროფილზე გამოჩნდება Subscription Member ბეჯი, სანამ გამოწერა აქტიურია.',
  })
  return out
}

// "Best value" only when it is true: the cheapest per day among 2+ plans of the same audience.
function isBestValue(plan: PublicSubscriptionPlan, plans: PublicSubscriptionPlan[]): boolean {
  const group = plans.filter((p) => p.audience === plan.audience)
  if (group.length < 2) return false
  const perDay = (p: PublicSubscriptionPlan) => p.priceGel / Math.max(1, p.billingPeriodDays)
  return group.every((p) => p.id === plan.id || perDay(plan) < perDay(p))
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openPerk, setOpenPerk] = useState<string | null>(null)
  const [showAbout, setShowAbout] = useState(false)

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

  // Seller / Coach plans first (the owner's screen is that plan), then buyer plans, each by sortOrder.
  const ordered = [SubscriptionAudience.SellerCoach, SubscriptionAudience.Buyer].flatMap((a) => plans.filter((p) => p.audience === a))
  const liveIds = new Set(mine.filter(isLive).map((s) => s.plan.id))
  const plan = ordered.find((p) => p.id === selectedId) ?? ordered.find((p) => liveIds.has(p.id)) ?? ordered[0] ?? null

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

  const current = plan ? live(plan.audience) : undefined

  return (
    <Layout
      title="გამოწერა"
      description="WaveHubX PLUS — საკომისიოს ფასდაკლება, გამორჩეული პროფილი, პრიორიტეტული მხარდაჭერა და Subscription Member ბეჯი."
    >
      <div className="px-page">
        <header className="px-top">
          <button type="button" className="px-back" aria-label="უკან" onClick={() => (window.history.length > 1 ? router.back() : void router.push('/'))}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
          <h1>გამოწერა</h1>
        </header>

        <section className="px-hero" aria-label="WaveHubX PLUS">
          <img className="px-hero-art" src="/assets/plus-hero-art.webp" alt="" aria-hidden="true" />
          <div className="px-hero-copy">
            <span className="px-kicker" data-i18n-keep="">
              WAVEHUBX
            </span>
            <strong className="px-word" data-i18n-keep="">
              PLUS
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 8l4.6 3.6L12 4.5l4.4 7.1L21 8l-1.8 9.5H4.8z" />
                <path d="M4.8 20h14.4" />
              </svg>
            </strong>
            <p>მეტი შესაძლებლობა გაყიდვებისა და კავშირების განვითარებისთვის</p>
          </div>
        </section>

        {checkoutResult === 'success' && (
          <div className="px-note ok" role="status">
            გადახდა მიღებულია. გამოწერა რამდენიმე წუთში გააქტიურდება — თუ ქვემოთ ჯერ არ ჩანს, განაახლეთ გვერდი.
          </div>
        )}
        {checkoutResult === 'fail' && (
          <div className="px-note bad" role="alert">
            გადახდა ვერ განხორციელდა. თანხა არ ჩამოგჭრიათ — სცადეთ თავიდან.
          </div>
        )}
        {error && (
          <div className="px-note bad" role="alert">
            {error}
          </div>
        )}
        {mine.some((s) => s.status === SubscriptionStatus.PastDue) && (
          <div className="px-note bad" role="alert">
            ბოლო გადახდა ვერ განხორციელდა. თქვენი პრივილეგიები ჯერ კიდევ მოქმედებს, მაგრამ თუ 7 დღის განმავლობაში გადახდა ვერ მოხერხდა, გამოწერა ამოიწურება. შეამოწმეთ ბარათზე თანხა — ავტომატურად ვცდით ხელახლა.
          </div>
        )}

        {mine.length > 0 && (
          <section className="px-mine" aria-labelledby="mySubscriptionsTitle">
            <h2 id="mySubscriptionsTitle">ჩემი გამოწერები</h2>
            {mine.map((s) => (
              <div key={s.id} className="px-mine-row">
                <span className="px-mine-icon" aria-hidden="true">
                  {ICONS.crown}
                </span>
                <span className="px-mine-copy">
                  <strong>{s.plan.name}</strong>
                  <small>
                    <b className={isLive(s) ? 'on' : undefined}>{STATUS_LABELS[s.status]}</b> · {stateLine(s)}: {new Date(s.currentPeriodEnd).toLocaleDateString('ka-GE')}
                    {s.status === SubscriptionStatus.Active && s.cancelAtPeriodEnd && ' (გაუქმდება პერიოდის ბოლოს)'}
                    {s.status === SubscriptionStatus.Active && s.isGranted && !s.cancelAtPeriodEnd && ' (ავტომატურად არ განახლდება)'}
                  </small>
                </span>
                {isLive(s) && !s.cancelAtPeriodEnd && !s.isGranted && (
                  <button type="button" className="px-mine-cancel" disabled={busyId === s.id} onClick={() => cancel(s)}>
                    {busyId === s.id ? 'მიმდინარეობს…' : 'გაუქმება'}
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        {loading ? (
          <div className="px-empty">იტვირთება…</div>
        ) : !plan ? (
          <div className="px-empty">{error ? 'გეგმების ჩატვირთვა ვერ მოხერხდა.' : 'გეგმები ჯერ არ არის დამატებული.'}</div>
        ) : (
          <>
            {ordered.length > 1 && (
              <div className="px-switch" role="tablist" aria-label="გეგმები">
                {ordered.map((p) => (
                  <button key={p.id} type="button" role="tab" aria-selected={p.id === plan.id} className={p.id === plan.id ? 'on' : undefined} onClick={() => { setSelectedId(p.id); setOpenPerk(null); setShowAbout(false) }}>
                    <strong>{p.name}</strong>
                    <small>{AUDIENCE_LABELS[p.audience]}</small>
                  </button>
                ))}
              </div>
            )}

            <section className="px-price" aria-label={plan.name}>
              <div className="px-price-row">
                <strong>
                  {`${plan.priceGel} GEL `}<span>{`/ ${plan.billingPeriodDays} დღე`}</span>
                </strong>
                <span className="px-price-tags">
                  <svg className="px-price-crown" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 8l4.6 3.6L12 4.5l4.4 7.1L21 8l-1.8 9.5H4.8z" />
                  </svg>
                  {isBestValue(plan, plans) && (
                    <em className="px-best" data-i18n-keep="">
                      BEST VALUE
                    </em>
                  )}
                </span>
              </div>
              <button type="button" className="px-about" aria-expanded={showAbout} onClick={() => setShowAbout((v) => !v)} disabled={!plan.description?.trim()}>
                გახსენი მეტი WaveHubX-ზე
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5M12 8h.01" />
                </svg>
              </button>
              {showAbout && plan.description?.trim() && <p className="px-about-text">{plan.description}</p>}
            </section>

            <ul className="px-perks">
              {perksOf(plan).map((perk) => {
                const open = openPerk === perk.key
                return (
                  <li key={perk.key} className={open ? 'open' : undefined}>
                    <button type="button" aria-expanded={open} onClick={() => setOpenPerk(open ? null : perk.key)}>
                      <span className={`px-perk-icon ${perk.tone}`}>{perk.icon}</span>
                      <span className="px-perk-title">{perk.title}</span>
                      <svg className="px-chev" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </button>
                    {open && <p>{perk.detail}</p>}
                  </li>
                )
              })}
            </ul>

            {!user ? (
              <Link className="px-cta" href="/login?next=/plans">
                <ZapIcon />
                შესვლა გამოსაწერად
                <ChevIcon />
              </Link>
            ) : current ? (
              <button type="button" className="px-cta" disabled>
                {current.plan.id === plan.id ? 'გამოწერა აქტიურია' : 'ჯერ გააუქმეთ მიმდინარე გეგმა'}
              </button>
            ) : (
              <button type="button" className="px-cta" disabled={busyId === plan.id} onClick={() => subscribe(plan.id)}>
                <ZapIcon />
                {busyId === plan.id ? 'გადამისამართება…' : 'გამოწერის გააქტიურება'}
                <ChevIcon />
              </button>
            )}
            <p className="px-bank">
              გადახდა: <img src="/assets/bog-logo.png" alt="საქართველოს ბანკი" />
            </p>

            <ul className="px-facts">
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z" />
                  <path d="m8.8 12.2 2.3 2.3 4.3-4.6" />
                </svg>
                უსაფრთხო გადახდა
              </li>
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 11a8 8 0 0 0-14.5-4.6L4 8" />
                  <path d="M4 3.5V8h4.5M4 13a8 8 0 0 0 14.5 4.6L20 16" />
                  <path d="M20 20.5V16h-4.5" />
                </svg>
                ნებისმიერ დროს გაუქმება
              </li>
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5.5" width="18" height="13" rx="2.2" />
                  <path d="M3 10h18M7 15h4" />
                </svg>
                {`${plan.billingPeriodDays} დღის წევრობა`}
              </li>
            </ul>
          </>
        )}
      </div>
    </Layout>
  )
}

function ZapIcon() {
  return (
    <svg className="px-cta-zap" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.5 2.5 4.5 13.5h6.5l-1 8 9-11h-6.5z" />
    </svg>
  )
}

function ChevIcon() {
  return (
    <svg className="px-cta-chev" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}
