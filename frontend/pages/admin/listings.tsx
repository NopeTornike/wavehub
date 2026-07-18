import { useEffect, useState } from 'react'
import type { AdminListingSummary } from '@wavehub/shared-types'
import { ListingType } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, ApiError } from '../../lib/api'

const TYPE_LABELS: Record<ListingType, string> = {
  [ListingType.Service]: 'სერვისი',
  [ListingType.Item]: 'ნივთი',
}

export default function AdminListings() {
  const [items, setItems] = useState<AdminListingSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .adminListPendingListings()
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

  const approve = async (id: string) => {
    setBusyId(id)
    try {
      await api.adminApproveListing(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'დამტკიცება ვერ მოხერხდა.')
    } finally {
      setBusyId(null)
    }
  }

  const reject = async (id: string) => {
    const reason = window.prompt('უარყოფის მიზეზი:')
    if (!reason) return
    setBusyId(id)
    try {
      await api.adminRejectListing(id, reason)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'უარყოფა ვერ მოხერხდა.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout>
      <h1 className="page-title">დასამტკიცებელი განცხადებები</h1>
      <p className="page-subtitle">გამოქვეყნებამდე შემოწმებული განცხადებები</p>

      {error && <div className="status-text status-error">{error}</div>}

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">ველოდები ახალ განცხადებებს.</div>
      ) : (
        <div className="order-list">
          {items.map((item) => (
            <div key={item.id} className="admin-row">
              <div className="admin-row-main">
                <strong>{item.title}</strong>
                <span className="note" style={{ margin: 0 }}>
                  @{item.sellerUsername} · {TYPE_LABELS[item.type]} · {item.categoryName}
                  {item.gameName ? ` · ${item.gameName}` : ''}
                </span>
              </div>
              <div className="admin-row-actions">
                <button
                  type="button"
                  className="button"
                  disabled={busyId === item.id}
                  onClick={() => approve(item.id)}
                >
                  დამტკიცება
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busyId === item.id}
                  onClick={() => reject(item.id)}
                >
                  უარყოფა
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
