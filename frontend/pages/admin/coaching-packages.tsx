import { useEffect, useState, type FormEvent } from 'react'
import { AdminRole, type AdminCoachingPackage } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import PackageCard from '../../components/PackageCard'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'

// Admin → Coaching packages: the platform's Starter / Growth / Elite, offered by every coach.
// Coaching staff can view; only Super Admin edits (prices are money) — server-enforced and
// audit-logged (backend/src/coaching/coaching-packages.controller.ts). A live card preview shows
// exactly what students see.

type Draft = { name: string; sessionsCount: number; durationMinutes: number; priceWaveCoin: number; tagline: string; description: string; features: string; active: boolean }

const toDraft = (p: AdminCoachingPackage): Draft => ({
  name: p.name,
  sessionsCount: p.sessionsCount,
  durationMinutes: p.durationMinutes,
  priceWaveCoin: p.priceWaveCoin,
  tagline: p.tagline,
  description: p.description,
  features: p.features.join('\n'),
  active: p.active,
})

function PackageEditor({ pkg, index, canEdit, onSaved }: { pkg: AdminCoachingPackage; index: number; canEdit: boolean; onSaved: (p: AdminCoachingPackage) => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(pkg))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })
  const features = draft.features.split('\n').map((f) => f.trim()).filter(Boolean)
  const set = (change: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...change }))
    setStatus({ kind: '', text: '' })
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (draft.name.trim().length < 2) return setStatus({ kind: 'error', text: 'სახელი მინ. 2 სიმბოლო.' })
    if (!Number.isInteger(draft.sessionsCount) || draft.sessionsCount < 1 || draft.sessionsCount > 10) return setStatus({ kind: 'error', text: 'სესიები: 1–10.' })
    if (!Number.isInteger(draft.durationMinutes) || draft.durationMinutes < 15 || draft.durationMinutes > 480) return setStatus({ kind: 'error', text: 'ხანგრძლივობა: 15–480 წუთი.' })
    if (!Number.isInteger(draft.priceWaveCoin) || draft.priceWaveCoin < 1 || draft.priceWaveCoin > 100000) return setStatus({ kind: 'error', text: 'ფასი: 1–100000 ₾ (მთელი რიცხვი).' })
    if (features.some((f) => f.length < 2 || f.length > 200) || features.length > 20) return setStatus({ kind: 'error', text: 'თითო პუნქტი 2–200 სიმბოლო, მაქს. 20 პუნქტი.' })
    setBusy(true)
    try {
      const saved = await api.adminUpdateCoachingPackage(pkg.id, {
        name: draft.name.trim(),
        sessionsCount: draft.sessionsCount,
        durationMinutes: draft.durationMinutes,
        priceWaveCoin: draft.priceWaveCoin,
        tagline: draft.tagline.trim(),
        description: draft.description.trim(),
        features,
        active: draft.active,
      })
      onSaved(saved)
      setDraft(toDraft(saved))
      setStatus({ kind: 'success', text: 'შენახულია — საიტზე მაშინვე ჩანს.' })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'შენახვა ვერ მოხერხდა.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="acp-row">
      <form className="stack-form" onSubmit={save}>
        <h2>
          {pkg.name} <small className="note">({pkg.key})</small>
        </h2>
        <fieldset disabled={!canEdit || busy} className="acp-fields">
          <label className="field">
            სახელი
            <input maxLength={60} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <div className="acp-numbers">
            <label className="field">
              სესიები
              <input type="number" min={1} max={10} value={draft.sessionsCount} onChange={(e) => set({ sessionsCount: Number(e.target.value) })} />
            </label>
            <label className="field">
              წუთი / სესია
              <input type="number" min={15} max={480} step={5} value={draft.durationMinutes} onChange={(e) => set({ durationMinutes: Number(e.target.value) })} />
            </label>
            <label className="field">
              ფასი (₾, სრული)
              <input type="number" min={1} max={100000} value={draft.priceWaveCoin} onChange={(e) => set({ priceWaveCoin: Number(e.target.value) })} />
            </label>
          </div>
          <label className="field">
            კითხვა (აღწერის პირველი, მუქი ხაზი)
            <textarea rows={2} maxLength={300} value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} />
          </label>
          <label className="field">
            აღწერა
            <textarea rows={3} maxLength={600} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
          </label>
          <label className="field">
            რას მოიცავს — თითო პუნქტი ახალ ხაზზე ({features.length}/20)
            <textarea rows={8} value={draft.features} onChange={(e) => set({ features: e.target.value })} />
          </label>
          <label className="acp-active">
            <input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />
            აქტიურია (ჩანს და იყიდება)
          </label>
        </fieldset>
        {status.text && (
          <p className={`status-text ${status.kind === 'error' ? 'status-error' : 'status-success'}`} role={status.kind === 'error' ? 'alert' : 'status'}>
            {status.text}
          </p>
        )}
        {canEdit && (
          <button className="button" type="submit" disabled={busy}>
            {busy ? 'ინახება…' : 'შენახვა'}
          </button>
        )}
      </form>
      <div className="acp-preview">
        <small className="note">გადახედვა</small>
        <PackageCard
          index={index}
          pkg={{ id: pkg.id, key: pkg.key, name: draft.name, tagline: draft.tagline, description: draft.description, features, sessionsCount: draft.sessionsCount, durationMinutes: draft.durationMinutes, priceWaveCoin: draft.priceWaveCoin }}
        />
      </div>
    </section>
  )
}

export default function AdminCoachingPackages() {
  const { user } = useAuth()
  const canEdit = user?.adminRole === AdminRole.SuperAdmin
  const [items, setItems] = useState<AdminCoachingPackage[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .adminListCoachingPackages()
      .then(setItems)
      .catch((err) => {
        setItems([])
        setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
      })
  }, [])

  return (
    <AdminLayout title="ქოუჩინგის პაკეტები">
      <h1 className="page-title">ქოუჩინგის პაკეტები</h1>
      <p className="page-subtitle">
        Starter, Growth და Elite — ერთნაირია ყველა ქოუჩისთვის. {canEdit ? 'ცვლილება მაშინვე აისახება საიტზე და იწერება აუდიტში.' : 'რედაქტირება შეუძლია მხოლოდ Super Admin-ს.'}
      </p>
      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}
      {items === null ? (
        <div className="empty-state">იტვირთება…</div>
      ) : (
        items.map((p, i) => <PackageEditor key={p.id} pkg={p} index={i} canEdit={canEdit} onSaved={(saved) => setItems((list) => list?.map((x) => (x.id === saved.id ? saved : x)) ?? null)} />)
      )}
    </AdminLayout>
  )
}
