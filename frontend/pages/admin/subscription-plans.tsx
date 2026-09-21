import { useEffect, useState } from 'react'
import type { AdminSubscriptionPlanSummary, SubscriptionPerks } from '@wavehub/shared-types'
import { SubscriptionAudience } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, ApiError } from '../../lib/api'

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
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false))

  useEffect(() => {
    void reload()
  }, [])

  const create = async () => {
    setFormError('')
    setCreating(true)
    try {
      await api.adminCreateSubscriptionPlan({
        audience: form.audience,
        tier: form.tier.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        priceGel: Number(form.priceGel),
        billingPeriodDays: Number(form.billingPeriodDays),
        sortOrder: Number(form.sortOrder),
        perks: buildPerks(form),
      })
      setForm(emptyForm)
      await reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'შექმნა ვერ მოხერხდა.')
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
      setError(err instanceof ApiError ? err.message : 'განახლება ვერ მოხერხდა.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout>
      <h1 className="page-title">გამოწერის გეგმები</h1>
      <p className="page-subtitle">მყიდველის და გამყიდველის/მწვრთნელის გეგმები. არსებულ გამოწერებზე ფასი არ იცვლება — ახალი გეგმა შექმენით.</p>
      {error && <div className="status-text status-error">{error}</div>}

      <div className="admin-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', margin: 0 }}>ახალი გეგმა</h2>
        {formError && <div className="status-text status-error">{formError}</div>}
        <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as SubscriptionAudience })}>
          <option value={SubscriptionAudience.Buyer}>მყიდველი</option>
          <option value={SubscriptionAudience.SellerCoach}>გამყიდველი / მწვრთნელი</option>
        </select>
        <input placeholder="დონე (მაგ. plus)" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} />
        <input placeholder="სახელი" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <textarea placeholder="აღწერა (მინ. 10 სიმბოლო)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input type="number" min={1} placeholder="ფასი ₾" value={form.priceGel} onChange={(e) => setForm({ ...form, priceGel: Number(e.target.value) })} />
        <input type="number" min={1} placeholder="პერიოდი (დღე)" value={form.billingPeriodDays} onChange={(e) => setForm({ ...form, billingPeriodDays: Number(e.target.value) })} />
        <input type="number" min={0} max={100} placeholder="საკომისიოს შემცირება პროც. პუნქტით (გამყიდველი/მწვრთნელი)" value={form.feeDiscount} onChange={(e) => setForm({ ...form, feeDiscount: e.target.value })} />
        <input placeholder="პროფილის ბეჯი (ტექსტი)" value={form.profileBadge} onChange={(e) => setForm({ ...form, profileBadge: e.target.value })} />
        <label>
          <input type="checkbox" checked={form.featuredListings} onChange={(e) => setForm({ ...form, featuredListings: e.target.checked })} /> გამორჩეული განცხადებები / მწვრთნელი
        </label>
        <label>
          <input type="checkbox" checked={form.prioritySupport} onChange={(e) => setForm({ ...form, prioritySupport: e.target.checked })} /> პრიორიტეტული მხარდაჭერა
        </label>
        <button type="button" className="button" disabled={creating} onClick={create}>
          {creating ? '…' : 'შექმნა'}
        </button>
      </div>

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
                <strong>{p.name}</strong> <span className="note">({p.audience} · {p.tier})</span>
                <div className="note" style={{ margin: 0 }}>
                  {p.priceGel} ₾ / {p.billingPeriodDays} დღე · {p.isActive ? 'აქტიური' : 'გამორთული'} · {JSON.stringify(p.perks)}
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
