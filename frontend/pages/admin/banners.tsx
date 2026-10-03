import { useEffect, useState } from 'react'
import type { AdminBanner } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'

// Admin → Banners (Super Admin + Main Administrator): the homepage banner strip. A banner needs an
// image (byte-checked by the server) before it can be published; links are a site path (/coaching)
// or an https:// address. Optional start/end dates. Audit-logged.
const localInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 4 * 3600_000).toISOString().slice(0, 16) : '')
const fromLocal = (value: string) => (value ? new Date(`${value}:00+04:00`).toISOString() : null)

function BannerEditor({ banner, onChange, onDelete }: { banner: AdminBanner; onChange: (b: AdminBanner) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState({
    title: banner.title,
    subtitle: banner.subtitle ?? '',
    linkUrl: banner.linkUrl ?? '',
    buttonLabel: banner.buttonLabel ?? '',
    startsAt: localInput(banner.startsAt),
    endsAt: localInput(banner.endsAt),
    sortOrder: banner.sortOrder,
  })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })

  const run = async (fn: () => Promise<AdminBanner>, ok: string) => {
    setBusy(true)
    setStatus({ kind: '', text: '' })
    try {
      onChange(await fn())
      setStatus({ kind: 'success', text: ok })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'შენახვა ვერ მოხერხდა.') })
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(
      () =>
        api.adminUpdateBanner(banner.id, {
          title: draft.title.trim(),
          subtitle: draft.subtitle.trim() || null,
          linkUrl: draft.linkUrl.trim() || null,
          buttonLabel: draft.buttonLabel.trim() || null,
          startsAt: fromLocal(draft.startsAt),
          endsAt: fromLocal(draft.endsAt),
          sortOrder: draft.sortOrder,
        }),
      'შენახულია.',
    )

  return (
    <section className="card ab-row">
      <div className="ab-preview" style={banner.imageUrl ? { backgroundImage: `url(${banner.imageUrl})` } : undefined}>
        {!banner.imageUrl && <span>სურათი არ არის</span>}
        <label className={`button ghost ab-upload${busy ? ' disabled' : ''}`}>
          {banner.imageUrl ? 'სურათის შეცვლა' : 'სურათის ატვირთვა'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void run(() => api.adminUploadBannerImage(banner.id, file), 'სურათი აიტვირთა.')
            }}
          />
        </label>
      </div>
      <div className="ab-fields">
        <label className="field">
          სათაური
          <input maxLength={80} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </label>
        <label className="field">
          ქვესათაური
          <input maxLength={200} value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />
        </label>
        <div className="ab-two">
          <label className="field">
            ბმული (/coaching ან https://…)
            <input maxLength={300} value={draft.linkUrl} onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })} />
          </label>
          <label className="field">
            ღილაკის ტექსტი
            <input maxLength={30} value={draft.buttonLabel} onChange={(e) => setDraft({ ...draft, buttonLabel: e.target.value })} />
          </label>
        </div>
        <div className="ab-two">
          <label className="field">
            იწყება
            <input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
          </label>
          <label className="field">
            მთავრდება
            <input type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
          </label>
        </div>
        <label className="field ab-order">
          რიგი
          <input type="number" min={0} max={1000} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} />
        </label>
        {status.text && (
          <p className={`status-text ${status.kind === 'error' ? 'status-error' : 'status-success'}`} role={status.kind === 'error' ? 'alert' : 'status'}>
            {status.text}
          </p>
        )}
        <div className="admin-row-actions">
          <button type="button" className="button" disabled={busy} onClick={() => void save()}>
            შენახვა
          </button>
          <button type="button" className="button ghost" disabled={busy} onClick={() => void run(() => api.adminUpdateBanner(banner.id, { active: !banner.active }), banner.active ? 'გამოქვეყნება გაუქმდა.' : 'გამოქვეყნდა.')}>
            {banner.active ? 'დამალვა' : 'გამოქვეყნება'}
          </button>
          <button
            type="button"
            className="button ghost"
            disabled={busy}
            onClick={() => {
              if (window.confirm('ბანერი წაიშლება. გავაგრძელოთ?')) onDelete()
            }}
          >
            წაშლა
          </button>
          <span className={`arv-status ${banner.active ? '' : 'hidden'}`}>{banner.active ? 'გამოქვეყნებულია' : 'დამალულია'}</span>
        </div>
      </div>
    </section>
  )
}

export default function AdminBanners() {
  const [items, setItems] = useState<AdminBanner[] | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .adminListBanners()
      .then(setItems)
      .catch((err) => {
        setItems([])
        setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
      })
  }, [])

  const create = async () => {
    if (title.trim().length < 2) return setError('სათაური მინ. 2 სიმბოლო.')
    setError('')
    try {
      const b = await api.adminCreateBanner({ title: title.trim(), sortOrder: items?.length ?? 0 })
      setItems((list) => [...(list ?? []), b])
      setTitle('')
    } catch (err) {
      setError(errorMessage(err, 'შექმნა ვერ მოხერხდა.'))
    }
  }

  const remove = async (id: string) => {
    try {
      await api.adminDeleteBanner(id)
      setItems((list) => list?.filter((b) => b.id !== id) ?? null)
    } catch (err) {
      setError(errorMessage(err, 'წაშლა ვერ მოხერხდა.'))
    }
  }

  return (
    <AdminLayout title="ბანერები">
      <h1 className="page-title">ბანერები</h1>
      <p className="page-subtitle">მთავარი გვერდის ბანერები. ჯერ ატვირთე სურათი, მერე გამოაქვეყნე — საიტზე მაშინვე ჩანს.</p>
      <div className="admin-search-bar">
        <input value={title} maxLength={80} placeholder="ახალი ბანერის სათაური" onChange={(e) => setTitle(e.target.value)} />
        <button type="button" className="button" onClick={() => void create()}>
          ბანერის დამატება
        </button>
      </div>
      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}
      {items === null ? (
        <div className="empty-state">იტვირთება…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">ბანერები ჯერ არ არის.</div>
      ) : (
        items.map((b) => <BannerEditor key={b.id} banner={b} onChange={(next) => setItems((list) => list?.map((x) => (x.id === next.id ? next : x)) ?? null)} onDelete={() => void remove(b.id)} />)
      )}
    </AdminLayout>
  )
}
