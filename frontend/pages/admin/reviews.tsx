import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AdminRole, ReviewStatus, type AdminReviewRow, type AdminReviewSummary } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'

// Admin → Reviews: the reported queue, plus every product (order) and coach (session) review with
// search and a status filter. Hide/restore: the review-moderation roles; delete and editing the
// stars/text/seller reply: Super Admin only (server-enforced, audit-logged).

type Tab = 'reported' | 'product' | 'coach'
const STATUS_LABELS: Record<ReviewStatus, string> = {
  [ReviewStatus.Published]: 'გამოქვეყნებული',
  [ReviewStatus.Hidden]: 'დამალული',
  [ReviewStatus.Reported]: 'დარეპორტებული',
  [ReviewStatus.Deleted]: 'წაშლილი',
}

function Stars({ value }: { value: number }) {
  return (
    <span className="arv-stars" aria-label={`${value} / 5`}>
      {'★'.repeat(value)}
      <span>{'★'.repeat(5 - value)}</span>
    </span>
  )
}

function EditReview({ row, onSaved, onCancel }: { row: AdminReviewRow; onSaved: (row: AdminReviewRow) => void; onCancel: () => void }) {
  const [rating, setRating] = useState(row.rating)
  const [body, setBody] = useState(row.body ?? '')
  const [reply, setReply] = useState(row.sellerReply ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const payload: { rating?: number; body?: string | null; sellerReply?: string | null } = {}
    if (rating !== row.rating) payload.rating = rating
    if (body.trim() !== (row.body ?? '')) payload.body = body.trim() || null
    if (row.kind === 'product' && reply.trim() !== (row.sellerReply ?? '')) payload.sellerReply = reply.trim() || null
    if (!Object.keys(payload).length) return onCancel()
    setBusy(true)
    setError('')
    try {
      await api.adminEditReview(row.kind, row.id, payload)
      onSaved({ ...row, rating, body: body.trim() || null, sellerReply: row.kind === 'product' ? reply.trim() || null : null })
    } catch (err) {
      setError(errorMessage(err, 'შენახვა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="arv-edit" onSubmit={save}>
      <div className="wc-stars" role="radiogroup" aria-label="შეფასება">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ვარსკვლავი`} className={n <= rating ? 'on' : undefined} onClick={() => setRating(n)}>
            ★
          </button>
        ))}
      </div>
      <label className="field">
        ტექსტი
        <textarea rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      {row.kind === 'product' && (
        <label className="field">
          გამყიდველის პასუხი
          <textarea rows={2} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} />
        </label>
      )}
      {error && (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-row-actions">
        <button type="submit" className="button" disabled={busy}>
          {busy ? 'ინახება…' : 'შენახვა'}
        </button>
        <button type="button" className="button ghost" disabled={busy} onClick={onCancel}>
          გაუქმება
        </button>
      </div>
      <p className="note">ცვლილება მაშინვე აისახება პროდუქტის/ქოუჩის რეიტინგზე და იწერება აუდიტის ჟურნალში.</p>
    </form>
  )
}

export default function AdminReviews() {
  const { user } = useAuth()
  const isSuperAdmin = user?.adminRole === AdminRole.SuperAdmin
  const [tab, setTab] = useState<Tab>('reported')
  const [reported, setReported] = useState<AdminReviewSummary[]>([])
  const [rows, setRows] = useState<AdminReviewRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | ReviewStatus>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    const done = () => setLoading(false)
    if (tab === 'reported') {
      api
        .adminListReportedReviews()
        .then(setReported)
        .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
        .finally(done)
    } else {
      api
        .adminListReviews({ kind: tab, status: status || undefined, q: search || undefined, page })
        .then((res) => {
          setRows(res.items)
          setTotal(res.total)
        })
        .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
        .finally(done)
    }
  }, [tab, status, search, page])

  useEffect(() => {
    // Refetch whenever the tab/filter/page changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const moderate = async (id: string, action: 'hide' | 'remove' | 'restore') => {
    if (action === 'remove' && !window.confirm('შეფასება სამუდამოდ წაიშლება საჯარო გვერდიდან. გავაგრძელოთ?')) return
    setBusyId(id)
    setError('')
    try {
      if (action === 'hide') await api.adminHideReview(id)
      else if (action === 'remove') await api.adminRemoveReview(id)
      else await api.adminRestoreReview(id)
      const next = action === 'hide' ? ReviewStatus.Hidden : action === 'remove' ? ReviewStatus.Deleted : ReviewStatus.Published
      setReported((list) => list.filter((r) => r.id !== id))
      setRows((list) => list.map((r) => (r.id === id ? { ...r, status: next } : r)))
    } catch (err) {
      setError(errorMessage(err, 'მოქმედება ვერ შესრულდა.'))
    } finally {
      setBusyId(null)
    }
  }

  const deleteCoachReview = async (id: string) => {
    if (!window.confirm('ქოუჩის შეფასება სამუდამოდ წაიშლება და რეიტინგი გადაითვლება. გავაგრძელოთ?')) return
    setBusyId(id)
    try {
      await api.adminDeleteCoachReview(id)
      setRows((list) => list.filter((r) => r.id !== id))
      setTotal((t) => t - 1)
    } catch (err) {
      setError(errorMessage(err, 'წაშლა ვერ მოხერხდა.'))
    } finally {
      setBusyId(null)
    }
  }

  const pages = Math.max(1, Math.ceil(total / 25))

  return (
    <AdminLayout title="შეფასებები">
      <h1 className="page-title">შეფასებები</h1>
      <p className="page-subtitle">პროდუქტებისა და ქოუჩების ყველა შეფასება — მოდერაცია{isSuperAdmin ? ' და რედაქტირება' : ''}.</p>

      <div className="al-tabs" role="tablist">
        {(
          [
            ['reported', 'დარეპორტებული'],
            ['product', 'პროდუქტები'],
            ['coach', 'ქოუჩები'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'active' : undefined}
            onClick={() => {
              setTab(key)
              setPage(1)
              setEditing(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 'reported' && (
        <form
          className="admin-search-bar"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setSearch(query.trim())
          }}
        >
          <input value={query} maxLength={60} onChange={(e) => setQuery(e.target.value)} placeholder="ძიება: მომხმარებელი, პროდუქტი ან ტექსტი" aria-label="შეფასებების ძიება" />
          {tab === 'product' && (
            <select
              value={status}
              aria-label="სტატუსი"
              onChange={(e) => {
                setPage(1)
                setStatus(e.target.value as '' | ReviewStatus)
              }}
            >
              <option value="">ყველა სტატუსი</option>
              {Object.values(ReviewStatus).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}
          <button className="button" type="submit">
            ძიება
          </button>
        </form>
      )}

      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : tab === 'reported' ? (
        reported.length === 0 ? (
          <div className="empty-state">დარეპორტებული შეფასებები არ არის.</div>
        ) : (
          <div className="order-list">
            {reported.map((item) => (
              <div key={item.id} className="admin-row">
                <div className="admin-row-main">
                  <strong>
                    <Link href={`/listings/${item.listingId}`}>{item.listingTitle}</Link>
                  </strong>
                  <span className="note">
                    <Stars value={item.rating} /> @{item.buyerUsername} → @{item.sellerUsername}
                  </span>
                  {item.body && <span className="arv-body">{item.body}</span>}
                </div>
                <div className="admin-row-actions">
                  <button type="button" className="button" disabled={busyId === item.id} onClick={() => moderate(item.id, 'hide')}>
                    დამალვა
                  </button>
                  <button type="button" className="button ghost" disabled={busyId === item.id} onClick={() => moderate(item.id, 'restore')}>
                    დატოვება
                  </button>
                  {isSuperAdmin && (
                    <button type="button" className="button ghost" disabled={busyId === item.id} onClick={() => moderate(item.id, 'remove')}>
                      წაშლა
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : rows.length === 0 ? (
        <div className="empty-state">შეფასებები ვერ მოიძებნა.</div>
      ) : (
        <>
          <div className="order-list">
            {rows.map((row) => (
              <div key={row.id} className="admin-row arv-row">
                <div className="admin-row-main">
                  <strong>
                    <Link href={row.subjectHref}>{row.subjectTitle}</Link>
                    {row.kind === 'product' && <span className={`arv-status ${row.status}`}>{STATUS_LABELS[row.status]}</span>}
                  </strong>
                  <span className="note">
                    <Stars value={row.rating} /> @{row.buyerUsername} → @{row.sellerUsername} · {new Date(row.createdAt).toLocaleDateString('ka-GE')}
                  </span>
                  {editing === row.id ? (
                    <EditReview
                      row={row}
                      onCancel={() => setEditing(null)}
                      onSaved={(next) => {
                        setRows((list) => list.map((r) => (r.id === next.id ? next : r)))
                        setEditing(null)
                      }}
                    />
                  ) : (
                    <>
                      <span className="arv-body">{row.body || 'კომენტარის გარეშე.'}</span>
                      {row.sellerReply && <span className="arv-reply">გამყიდველის პასუხი: {row.sellerReply}</span>}
                    </>
                  )}
                </div>
                {editing !== row.id && (
                  <div className="admin-row-actions">
                    {isSuperAdmin && (
                      <button type="button" className="button" onClick={() => setEditing(row.id)}>
                        რედაქტირება
                      </button>
                    )}
                    {row.kind === 'product' && row.status !== ReviewStatus.Hidden && row.status !== ReviewStatus.Deleted && (
                      <button type="button" className="button ghost" disabled={busyId === row.id} onClick={() => moderate(row.id, 'hide')}>
                        დამალვა
                      </button>
                    )}
                    {row.kind === 'product' && row.status !== ReviewStatus.Published && (
                      <button type="button" className="button ghost" disabled={busyId === row.id} onClick={() => moderate(row.id, 'restore')}>
                        გამოქვეყნება
                      </button>
                    )}
                    {isSuperAdmin && row.kind === 'product' && row.status !== ReviewStatus.Deleted && (
                      <button type="button" className="button ghost" disabled={busyId === row.id} onClick={() => moderate(row.id, 'remove')}>
                        წაშლა
                      </button>
                    )}
                    {isSuperAdmin && row.kind === 'coach' && (
                      <button type="button" className="button ghost" disabled={busyId === row.id} onClick={() => deleteCoachReview(row.id)}>
                        წაშლა
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {pages > 1 && (
            <div className="arv-pages">
              <button type="button" className="button ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← წინა
              </button>
              <span>
                {page} / {pages} · სულ {total}
              </span>
              <button type="button" className="button ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                შემდეგი →
              </button>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  )
}
