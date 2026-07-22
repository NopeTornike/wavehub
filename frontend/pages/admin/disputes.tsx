import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { AdminDisputeSummary } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, ApiError } from '../../lib/api'

// List-only — resolving a dispute needs the full evidence/message thread, which already exists on
// the order detail page (frontend/pages/orders/[id].tsx). This page's job is just "which orders
// have an open dispute", each row links straight to that page's dispute section.
export default function AdminDisputes() {
  const [items, setItems] = useState<AdminDisputeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api
      .adminListOpenDisputes()
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

  return (
    <AdminLayout>
      <h1 className="page-title">ღია დავები</h1>
      <p className="page-subtitle">გადაწყვეტა შესაძლებელია შესაბამისი შეკვეთის გვერდზე (მხოლოდ Super Admin)</p>

      {error && <div className="status-text status-error">{error}</div>}

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">ღია დავა არ არის.</div>
      ) : (
        <div className="order-list">
          {items.map((item) => (
            <Link key={item.id} href={`/orders/${item.orderId}`} className="legacy-order-card">
              <div className="order-card-main">
                <strong>{item.orderNumber}</strong>
                <span className="note" style={{ margin: 0 }}>{item.reason}</span>
              </div>
              <span className="order-status order-status-disputed">დავა</span>
            </Link>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
