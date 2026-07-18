import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicOrderSummary } from '@wavehub/shared-types'
import { OrderStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PendingPayment]: 'გადახდის მოლოდინში',
  [OrderStatus.Paid]: 'გადახდილია',
  [OrderStatus.InProgress]: 'მიმდინარეობს',
  [OrderStatus.Delivered]: 'მიწოდებულია',
  [OrderStatus.Completed]: 'დასრულებულია',
  [OrderStatus.Cancelled]: 'გაუქმებულია',
  [OrderStatus.Refunded]: 'თანხა დაბრუნებულია',
  [OrderStatus.Disputed]: 'დავის პროცესშია',
  [OrderStatus.Expired]: 'ვადაგასულია',
}

export default function Orders() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const [tab, setTab] = useState<'buyer' | 'seller'>('buyer')
  const [orders, setOrders] = useState<PublicOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (checked && !user) {
      router.push('/login?next=/orders')
    }
  }, [checked, user, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    const call = tab === 'buyer' ? api.listOrdersAsBuyer() : api.listOrdersAsSeller()
    call
      .then((data) => {
        if (!cancelled) setOrders(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'შეკვეთების ჩატვირთვა ვერ მოხერხდა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, user])

  return (
    <Layout>
      <div className="page">
        <div className="page-inner">
          <h1 className="page-title">ჩემი შეკვეთები</h1>
          <p className="page-subtitle">ნახეთ და მართეთ თქვენი შესყიდვები და გაყიდვები</p>

          <div className="order-tabs">
            <button className={tab === 'buyer' ? 'active' : ''} type="button" onClick={() => setTab('buyer')}>
              შესყიდვები
            </button>
            <button className={tab === 'seller' ? 'active' : ''} type="button" onClick={() => setTab('seller')}>
              გაყიდვები
            </button>
          </div>

          {error && <div className="status-text status-error">{error}</div>}

          {loading ? (
            <div className="empty-state">იტვირთება…</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">შეკვეთები ჯერ არ არის.</div>
          ) : (
            <div className="order-list">
              {orders.map((order) => {
                const counterpart = tab === 'buyer' ? order.seller : order.buyer
                return (
                  <Link key={order.id} href={`/orders/${order.id}`} className="order-card">
                    <div className="order-card-main">
                      <strong>{order.listing.title}</strong>
                      <span className="note" style={{ margin: 0 }}>
                        {order.orderNumber} · @{counterpart.username}
                        {order.package ? ` · ${order.package.name}` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span className={`order-status order-status-${order.status}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                      <span className="price-tag">{order.priceWaveCoin} WC</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
