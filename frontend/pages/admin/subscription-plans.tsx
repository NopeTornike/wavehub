import { useEffect, useState, type FormEvent } from 'react'
import type { AdminSubscriptionPlanSummary, SubscriptionPerks } from '@wavehub/shared-types'
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

  const reload = () =>
    api
      .adminListSubscriptionPlans()
      .then((rows) => {
        setItems(rows)
        setError('')
      })
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
      .finally(() => setLoading(false))

  useEffect(() => {
    void reload()
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
    </AdminLayout>
  )
}
