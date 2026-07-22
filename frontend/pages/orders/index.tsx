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

  // The API only returns the active tab's orders at a time, so unlike orders.html's
  // localStorage-backed dashboard (which shows both Purchased and Sold counts side by side at
  // once), this summary only ever has real numbers for the currently selected tab — the other
  // one shows a dash rather than a fabricated 0.
  const totalPrice = orders.reduce((sum, order) => sum + order.priceWaveCoin, 0)

  return (
    <Layout>
      <section className="orders-page-head">
        <div>
          <p className="section-kicker">შეკვეთების ისტორია</p>
          <h1>ჩემი შეკვეთები</h1>
          <p>ნახეთ და მართეთ თქვენი შესყიდვები და გაყიდვები WaveHub-ზე.</p>
        </div>
        <div className="marketplace-total">
          <strong>{orders.length}</strong>
          <span>შეკვეთა</span>
        </div>
      </section>

      <section className="orders-dashboard">
        <div className="orders-summary" aria-label="შეკვეთების შეჯამება">
          <article>
            <span>შესყიდვები</span>
            <strong>{tab === 'buyer' ? orders.length : '—'}</strong>
            <small>{tab === 'buyer' ? `${totalPrice} WC` : ''}</small>
          </article>
          <article>
            <span>გაყიდვები</span>
            <strong>{tab === 'seller' ? orders.length : '—'}</strong>
            <small>{tab === 'seller' ? `${totalPrice} WC` : ''}</small>
          </article>
        </div>

        <div className="orders-tabs" role="tablist">
          <button className={tab === 'buyer' ? 'active' : ''} type="button" role="tab" aria-selected={tab === 'buyer'} onClick={() => setTab('buyer')}>
            შესყიდვები
          </button>
          <button className={tab === 'seller' ? 'active' : ''} type="button" role="tab" aria-selected={tab === 'seller'} onClick={() => setTab('seller')}>
            გაყიდვები
          </button>
        </div>

        {error && <div className="status-text status-error">{error}</div>}

        {loading ? (
          <div className="orders-empty">იტვირთება…</div>
        ) : orders.length === 0 ? (
          <div className="orders-empty">
            <strong>შეკვეთები ვერ მოიძებნა</strong>
            <p>თქვენი შესაბამისი შეკვეთები აქ გამოჩნდება.</p>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => {
              const counterpart = tab === 'buyer' ? order.seller : order.buyer
              return (
                <Link key={order.id} href={`/orders/${order.id}`} className="order-card">
                  <span className="order-thumb" aria-hidden="true">
                    {order.listing.title.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="order-copy">
                    <div>
                      <span className="order-status">{STATUS_LABELS[order.status]}</span>
                    </div>
                    <h2>{order.listing.title}</h2>
                    <p>{order.package ? order.package.name : order.listing.title}</p>
                    <span>{tab === 'buyer' ? 'გამყიდველი' : 'მყიდველი'}: @{counterpart.username}</span>
                    <code>Order #{order.orderNumber}</code>
                  </div>
                  <div className="order-side">
                    <strong>{order.priceWaveCoin} WC</strong>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </Layout>
  )
}
