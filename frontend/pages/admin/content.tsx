import { useEffect, useState } from 'react'
import type { AdminContentPage } from '@wavehub/shared-types'
import { ContentPageStatus } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, ApiError } from '../../lib/api'

// Main Administrator + Super Admin only server-side (see
// backend/src/content/admin-content.controller.ts) — any other role's calls here 403, surfaced
// via the error banner like every other admin page.
export default function AdminContent() {
  const [pages, setPages] = useState<AdminContentPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<ContentPageStatus>(ContentPageStatus.Draft)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = () => {
    setLoading(true)
    api
      .adminListContentPages()
      .then(setPages)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  const selectPage = (page: AdminContentPage | null) => {
    setSaved(false)
    setError('')
    if (!page) {
      setSelectedSlug(null)
      setSlug('')
      setTitle('')
      setBody('')
      setStatus(ContentPageStatus.Draft)
      return
    }
    setSelectedSlug(page.slug)
    setSlug(page.slug)
    setTitle(page.title)
    setBody(page.body)
    setStatus(page.status)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      const updated = await api.adminUpsertContentPage({ slug, title, body, status })
      setSaved(true)
      load()
      selectPage(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'შენახვა ვერ მოხერხდა.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <h1 className="page-title">კონტენტის მართვა</h1>
      <p className="page-subtitle">საიტის სტატიკური გვერდები — About, Terms, Privacy Policy და სხვა</p>

      {error && <div className="status-text status-error">{error}</div>}
      {saved && <div className="status-text status-success">შენახულია.</div>}

      <div className="detail-layout" style={{ marginTop: 16 }}>
        <div className="detail-main">
          {loading ? (
            <div className="marketplace-empty">იტვირთება…</div>
          ) : (
            <div className="order-list">
              {pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className="legacy-order-card"
                  style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => selectPage(page)}
                >
                  <div className="order-card-main">
                    <strong>{page.title}</strong>
                    <span className="note" style={{ margin: 0 }}>
                      /{page.slug} · {page.status === ContentPageStatus.Published ? 'გამოქვეყნებული' : 'დრაფტი'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="detail-buy-panel">
          <div className="detail-buy-head">
            <strong>{selectedSlug ? 'გვერდის რედაქტირება' : 'ახალი გვერდი'}</strong>
          </div>

          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="slug">Slug</label>
              <input
                id="slug"
                className="input"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="about"
                pattern="[a-z0-9-]+"
                disabled={Boolean(selectedSlug)}
                required
              />
              {selectedSlug && <p className="note">Slug არ იცვლება არსებული გვერდისთვის.</p>}
            </div>

            <div className="form-group">
              <label htmlFor="title">სათაური</label>
              <input id="title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} required />
            </div>

            <div className="form-group">
              <label htmlFor="body">ტექსტი</label>
              <textarea
                id="body"
                className="input"
                rows={10}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="status">სტატუსი</label>
              <select id="status" className="input" value={status} onChange={(event) => setStatus(event.target.value as ContentPageStatus)}>
                <option value={ContentPageStatus.Draft}>დრაფტი</option>
                <option value={ContentPageStatus.Published}>გამოქვეყნებული</option>
              </select>
            </div>

            <button className="detail-buy-button" type="submit" disabled={saving || !slug || !title}>
              {saving ? 'ინახება…' : 'შენახვა'}
            </button>
            {selectedSlug && (
              <button className="button" type="button" onClick={() => selectPage(null)}>
                ახალი გვერდი
              </button>
            )}
          </form>
        </aside>
      </div>
    </AdminLayout>
  )
}
