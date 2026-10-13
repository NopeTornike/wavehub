import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { AdminDisputeSummary, AdminSessionDisputeSummary } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'

// Order disputes (resolved on the order page) and coaching-session disputes (resolved on
// /admin/session-disputes/[id]). Super Admin only, server-enforced.
type Tab = 'orders' | 'sessions'

function fmt(value: string): string {
  const t = new Date(new Date(value).getTime() + 4 * 3600_000)
  return `${String(t.getUTCDate()).padStart(2, '0')}.${String(t.getUTCMonth() + 1).padStart(2, '0')} ${t.toISOString().slice(11, 16)}`
}

export default function AdminDisputes() {
  const [tab, setTab] = useState<Tab>('orders')
  const [orders, setOrders] = useState<AdminDisputeSummary[] | null>(null)
  const [sessions, setSessions] = useState<AdminSessionDisputeSummary[] | null>(null)
  const [sessionFilter, setSessionFilter] = useState<'open' | 'resolved' | 'all'>('open')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .adminListOpenDisputes()
      .then(setOrders)
      .catch((err) => {
        setOrders([])
        setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .adminListSessionDisputes(sessionFilter)
      .then((rows) => {
        if (!cancelled) setSessions(rows)
      })
      .catch((err) => {
        if (cancelled) return
        setSessions([])
        setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
      })
    return () => {
      cancelled = true
    }
  }, [sessionFilter])

  return (
    <AdminLayout title="დავები">
      <h1 className="page-title">დავები</h1>
      <p className="page-subtitle">შეკვეთებისა და ქოუჩინგის სესიების დავები — გადაწყვეტილებას იღებს Super Admin.</p>

      <div className="al-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'orders'} className={tab === 'orders' ? 'active' : undefined} onClick={() => setTab('orders')}>
          შეკვეთები{orders ? ` (${orders.length})` : ''}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'sessions'} className={tab === 'sessions' ? 'active' : undefined} onClick={() => setTab('sessions')}>
          ქოუჩინგის სესიები{sessions && sessionFilter === 'open' ? ` (${sessions.length})` : ''}
        </button>
      </div>

      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}

      {tab === 'orders' ? (
        orders === null ? (
          <div className="empty-state">იტვირთება…</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">ღია დავა არ არის.</div>
        ) : (
          <div className="order-list">
            {orders.map((item) => (
              <Link key={item.id} href={`/orders/${item.orderId}`} className="admin-row">
                <div className="admin-row-main">
                  <strong>{item.orderNumber}</strong>
                  <span className="note">{item.reason}</span>
                </div>
                <span className="arv-status reported">დავა</span>
              </Link>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="admin-search-bar">
            <select value={sessionFilter} aria-label="სტატუსი" onChange={(e) => setSessionFilter(e.target.value as 'open' | 'resolved' | 'all')}>
              <option value="open">ღია</option>
              <option value="resolved">გადაწყვეტილი</option>
              <option value="all">ყველა</option>
            </select>
          </div>
          {sessions === null ? (
            <div className="empty-state">იტვირთება…</div>
          ) : sessions.length === 0 ? (
            <div className="empty-state">დავა არ არის.</div>
          ) : (
            <div className="order-list">
              {sessions.map((d) => (
                <Link key={d.id} href={`/admin/session-disputes/${d.id}`} className="admin-row">
                  <div className="admin-row-main">
                    <strong>
                      @{d.buyerUsername} ↔ ქოუჩი @{d.coachUsername} · {d.priceWaveCoin} GEL
                    </strong>
                    <span className="note">
                      სესია {fmt(d.scheduledAt)} · გახსნა @{d.openedByUsername} · {fmt(d.createdAt)}
                    </span>
                    <span className="arv-body">{d.reason}</span>
                  </div>
                  <span className={`arv-status ${d.status === 'open' ? 'reported' : ''}`}>{d.status === 'open' ? 'ღია' : 'გადაწყვეტილი'}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  )
}
