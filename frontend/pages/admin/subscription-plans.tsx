import { useEffect, useState, type FormEvent } from 'react'
import type { AdminSubscriptionPlanSummary, AdminUserSubscriptionSummary, AdminUserSummary, SubscriptionPerks } from '@wavehub/shared-types'
import { SubscriptionAudience } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'

const AUDIENCE_LABELS: Record<SubscriptionAudience, string> = {
  [SubscriptionAudience.Buyer]: 'მყიდველი',
  [SubscriptionAudience.SellerCoach]: 'გამყიდველი / მწვრთნელი',
}

const emptyForm = {
  audience: SubscriptionAudience.Buyer as SubscriptionAudience,
  tier: '',
  name: '',
  description: '',
  priceGel: 10,
  billingPeriodDays: 30,
  sortOrder: 0,
  feeDiscount: '',
  featuredListings: false,
  prioritySupport: false,
  profileBadge: '',
}

function buildPerks(f: typeof emptyForm): SubscriptionPerks {
  const perks: SubscriptionPerks = {}
  if (f.feeDiscount !== '' && Number(f.feeDiscount) > 0) perks.platformFeeDiscountPercent = Number(f.feeDiscount)
  if (f.featuredListings) perks.featuredListings = true
  if (f.prioritySupport) perks.prioritySupport = true
  if (f.profileBadge.trim()) perks.profileBadge = f.profileBadge.trim()
  return perks
}

// Human-readable perk summary for the plan list (instead of dumping the raw jsonb).
function perkSummary(perks: SubscriptionPerks): string {
  const parts: string[] = []
  if (perks.platformFeeDiscountPercent) parts.push(`საკომისიო −${perks.platformFeeDiscountPercent}%`)
  if (perks.featuredListings) parts.push('გამორჩეული')
  if (perks.prioritySupport) parts.push('პრიორიტეტული მხარდაჭერა')
  if (perks.profileBadge) parts.push(`ბეჯი: ${perks.profileBadge}`)
  return parts.length > 0 ? parts.join(', ') : 'პერკების გარეშე'
}

export default function AdminSubscriptionPlans() {
  const [items, setItems] = useState<AdminSubscriptionPlanSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)
  const [live, setLive] = useState<AdminUserSubscriptionSummary[]>([])
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<AdminUserSummary[]>([])
  const [grantUser, setGrantUser] = useState<AdminUserSummary | null>(null)
  const [grantPlanId, setGrantPlanId] = useState('')
  const [grantDays, setGrantDays] = useState('')
  const [grantReason, setGrantReason] = useState('')
  const [grantMsg, setGrantMsg] = useState('')
  const [granting, setGranting] = useState(false)

  const reloadLive = () => api.adminListLiveSubscriptions().then(setLive).catch(() => undefined)

  const reload = () =>
    api
      .adminListSubscriptionPlans()
      .then((plans) => {
        setItems(plans)
        setError('')
        void reloadLive()
      })
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
      .finally(() => setLoading(false))

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load
  }, [])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setFormError('')
    // Mirrors backend/src/subscriptions/dto/create-plan.dto.ts so the admin gets a Georgian hint
    // before the round-trip instead of a raw class-validator message.
    const tier = form.tier.trim()
    const name = form.name.trim()
    const description = form.description.trim()
    if (tier.length < 2 || tier.length > 40) return setFormError('დონე უნდა იყოს 2–40 სიმბოლო.')
    if (name.length < 3 || name.length > 80) return setFormError('სახელი უნდა იყოს 3–80 სიმბოლო.')
    if (description.length < 10 || description.length > 2000) return setFormError('აღწერა უნდა იყოს 10–2000 სიმბოლო.')
    if (!Number.isInteger(form.priceGel) || form.priceGel < 1) return setFormError('ფასი უნდა იყოს მთელი რიცხვი, მინიმუმ 1 ₾.')
    if (!Number.isInteger(form.billingPeriodDays) || form.billingPeriodDays < 1) return setFormError('პერიოდი უნდა იყოს მთელი რიცხვი, მინიმუმ 1 დღე.')
    setCreating(true)
    try {
      await api.adminCreateSubscriptionPlan({
        audience: form.audience,
        tier,
        name,
        description,
        priceGel: form.priceGel,
        billingPeriodDays: form.billingPeriodDays,
        sortOrder: Number(form.sortOrder) || 0,
        perks: buildPerks(form),
      })
      setForm(emptyForm)
      await reload()
    } catch (err) {
      setFormError(errorMessage(err, 'შექმნა ვერ მოხერხდა.'))
    } finally {
      setCreating(false)
    }
  }

  const searchUsers = async () => {
    setGrantMsg('')
    try {
      const res = await api.adminListUsers({ query: userQuery.trim(), limit: 5 })
      setUserResults(res.items)
    } catch (err) {
      setGrantMsg(errorMessage(err, 'ძებნა ვერ მოხერხდა.'))
    }
  }

  const grant = async () => {
    if (!grantUser || !grantPlanId) return
    setGrantMsg('')
    setGranting(true)
    try {
      await api.adminGrantSubscription({
        userId: grantUser.id,
        planId: grantPlanId,
        periodDays: grantDays ? Number(grantDays) : undefined,
        reason: grantReason.trim(),
      })
      setGrantMsg('გამოწერა მიენიჭა.')
      setGrantUser(null)
      setUserResults([])
      setGrantReason('')
      setGrantDays('')
      await reloadLive()
    } catch (err) {
      setGrantMsg(errorMessage(err, 'მინიჭება ვერ მოხერხდა.'))
    } finally {
      setGranting(false)
    }
  }

  const revoke = async (id: string) => {
    const reason = window.prompt('გაუქმების მიზეზი (მინ. 3 სიმბოლო)')
    if (!reason || reason.trim().length < 3) return
    setBusyId(id)
    setError('')
    try {
      await api.adminRevokeSubscription(id, reason.trim())
      await reloadLive()
    } catch (err) {
      setError(errorMessage(err, 'გაუქმება ვერ მოხერხდა.'))
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = async (plan: AdminSubscriptionPlanSummary) => {
    setBusyId(plan.id)
    setError('')
    try {
      await api.adminUpdateSubscriptionPlan(plan.id, { isActive: !plan.isActive })
      await reload()
    } catch (err) {
      setError(errorMessage(err, 'განახლება ვერ მოხერხდა.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout title="გამოწერის გეგმები">
      <h1 className="page-title">გამოწერის გეგმები</h1>
      <p className="page-subtitle">მყიდველის და გამყიდველის/მწვრთნელის გეგმები. არსებულ გამოწერებზე ფასი არ იცვლება — ახალი გეგმა შექმენით.</p>
      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}

      <form className="stack-form" onSubmit={create}>
        <h2>ახალი გეგმა</h2>
        {formError && (
          <div className="status-text status-error" role="alert">
            {formError}
          </div>
        )}
        <div className="stack-form-grid">
          <label className="field">
            აუდიტორია
            <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as SubscriptionAudience })}>
              <option value={SubscriptionAudience.Buyer}>{AUDIENCE_LABELS[SubscriptionAudience.Buyer]}</option>
              <option value={SubscriptionAudience.SellerCoach}>{AUDIENCE_LABELS[SubscriptionAudience.SellerCoach]}</option>
            </select>
          </label>
          <label className="field">
            დონე
            <input placeholder="მაგ. plus" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} required />
          </label>
          <label className="field">
            სახელი
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
        </div>
        <label className="field">
          აღწერა <small>მინიმუმ 10 სიმბოლო</small>
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        </label>
        <div className="stack-form-grid">
          <label className="field">
            ფასი (₾)
            <input type="number" min={1} step={1} value={form.priceGel} onChange={(e) => setForm({ ...form, priceGel: Number(e.target.value) })} required />
          </label>
          <label className="field">
            პერიოდი (დღე)
            <input type="number" min={1} step={1} value={form.billingPeriodDays} onChange={(e) => setForm({ ...form, billingPeriodDays: Number(e.target.value) })} required />
          </label>
          <label className="field">
            რიგითობა
            <input type="number" step={1} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
          </label>
        </div>
        <div className="stack-form-grid">
          <label className="field">
            საკომისიოს შემცირება (პროც. პუნქტი) <small>მოქმედებს გამყიდველზე/მწვრთნელზე</small>
            <input type="number" min={0} max={100} value={form.feeDiscount} onChange={(e) => setForm({ ...form, feeDiscount: e.target.value })} />
          </label>
          <label className="field">
            პროფილის ბეჯი (ტექსტი)
            <input value={form.profileBadge} onChange={(e) => setForm({ ...form, profileBadge: e.target.value })} />
          </label>
        </div>
        <label className="field check">
          <input type="checkbox" checked={form.featuredListings} onChange={(e) => setForm({ ...form, featuredListings: e.target.checked })} />
          გამორჩეული განცხადებები / მწვრთნელი
        </label>
        <label className="field check">
          <input type="checkbox" checked={form.prioritySupport} onChange={(e) => setForm({ ...form, prioritySupport: e.target.checked })} />
          პრიორიტეტული მხარდაჭერა
        </label>
        <button type="submit" className="button" disabled={creating}>
          {creating ? 'იქმნება…' : 'გეგმის შექმნა'}
        </button>
      </form>

      <h2 style={{ fontSize: '1rem' }}>ყველა გეგმა</h2>
      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">გეგმები არ არის.</div>
      ) : (
        <div className="order-list">
          {items.map((p) => (
            <div key={p.id} className="admin-row">
              <div className="admin-row-main">
                <strong>{p.name}</strong>{' '}
                <span className="note">
                  ({AUDIENCE_LABELS[p.audience]} · {p.tier})
                </span>
                <div className="note" style={{ margin: 0 }}>
                  {p.priceGel} ₾ / {p.billingPeriodDays} დღე · {p.isActive ? 'აქტიური' : 'გამორთული'} · {perkSummary(p.perks)}
                </div>
              </div>
              <div className="admin-row-actions">
                <button type="button" className="button" disabled={busyId === p.id} onClick={() => toggleActive(p)}>
                  {p.isActive ? 'გამორთვა' : 'ჩართვა'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: '1rem', marginTop: 32 }}>გამოწერის ხელით მინიჭება</h2>
      <p className="note">მინიჭებულ გამოწერას ბარათი არ აქვს — ავტომატურად არ განახლდება და პერიოდის ბოლოს ვადა გაუვა.</p>
      <div className="admin-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, marginBottom: 24 }}>
        {grantMsg && <div className="status-text">{grantMsg}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="მომხმარებლის ძებნა (username / email)" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
          <button type="button" className="button" onClick={searchUsers}>ძებნა</button>
        </div>
        {userResults.map((u) => (
          <button key={u.id} type="button" className="button" onClick={() => setGrantUser(u)}>
            {u.username} · {u.email}
          </button>
        ))}
        {grantUser && <div className="note">არჩეული: <strong>{grantUser.username}</strong></div>}
        <select value={grantPlanId} onChange={(e) => setGrantPlanId(e.target.value)}>
          <option value="">აირჩიეთ გეგმა</option>
          {items.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.audience} · {p.tier})</option>
          ))}
        </select>
        <input type="number" min={1} max={3650} placeholder="ხანგრძლივობა დღეებში (ცარიელი = გეგმის პერიოდი)" value={grantDays} onChange={(e) => setGrantDays(e.target.value)} />
        <input placeholder="მიზეზი (აუდიტის ჟურნალისთვის)" value={grantReason} onChange={(e) => setGrantReason(e.target.value)} />
        <button type="button" className="button" disabled={granting || !grantUser || !grantPlanId || grantReason.trim().length < 3} onClick={grant}>
          {granting ? '…' : 'მინიჭება'}
        </button>
      </div>

      <h2 style={{ fontSize: '1rem' }}>აქტიური გამოწერები</h2>
      {live.length === 0 ? (
        <div className="empty-state">აქტიური გამოწერები არ არის.</div>
      ) : (
        <div className="order-list">
          {live.map((s) => (
            <div key={s.id} className="admin-row">
              <div className="admin-row-main">
                <strong>{s.user.username}</strong> <span className="note">{s.user.email}</span>
                <div className="note" style={{ margin: 0 }}>
                  {s.plan.name} · {s.status} · {s.isGranted ? 'ხელით მინიჭებული' : 'BOG'} · ვადა: {new Date(s.currentPeriodEnd).toLocaleDateString('ka-GE')}
                </div>
              </div>
              <div className="admin-row-actions">
                <button type="button" className="button" disabled={busyId === s.id} onClick={() => revoke(s.id)}>
                  გაუქმება
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
