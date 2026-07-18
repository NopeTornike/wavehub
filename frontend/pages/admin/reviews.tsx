import { useEffect, useState } from 'react'
import type { AdminReviewSummary } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, ApiError } from '../../lib/api'

export default function AdminReviews() {
  const [items, setItems] = useState<AdminReviewSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .adminListReportedReviews()
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const act = async (id: string, action: 'hide' | 'remove' | 'restore') => {
    setBusyId(id)
    try {
      if (action === 'hide') await api.adminHideReview(id)
      else if (action === 'remove') await api.adminRemoveReview(id)
      else await api.adminRestoreReview(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'მოქმედება ვერ შესრულდა.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout>
      <h1 className="page-title">დარეპორტებული შეფასებები</h1>
      <p className="page-subtitle">მომხმარებლების მიერ დარეპორტებული შეფასებები</p>

      {error && <div className="status-text status-error">{error}</div>}

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">დარეპორტებული შეფასებები არ არის.</div>
      ) : (
        <div className="order-list">
          {items.map((item) => (
            <div key={item.id} className="admin-row">
              <div className="admin-row-main">
                <strong>{item.listingTitle}</strong>
                <span className="note" style={{ margin: 0 }}>
                  @{item.buyerUsername} → @{item.sellerUsername} · {item.rating}/5
                </span>
                {item.body && <span className="note" style={{ margin: 0 }}>{item.body}</span>}
              </div>
              <div className="admin-row-actions">
                <button type="button" className="button" disabled={busyId === item.id} onClick={() => act(item.id, 'hide')}>
                  დამალვა
                </button>
                <button type="button" className="button" disabled={busyId === item.id} onClick={() => act(item.id, 'restore')}>
                  აღდგენა
                </button>
                <button type="button" className="button" disabled={busyId === item.id} onClick={() => act(item.id, 'remove')}>
                  წაშლა
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
