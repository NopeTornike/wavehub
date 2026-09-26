import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicOrderSummary } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import MyListings from '../../components/MyListings'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { gameCover } from '../../lib/games'
import { LISTING_TYPE_LABELS, ORDER_STATUS_LABELS } from '../../lib/labels'

// The prototype's orders.html (orders.js), on real data: the page head with the combined order
// count, the signed-out "sign in to view orders" panel, the Purchased / Sold summary tiles and tabs,
// the order cards (thumb, status + date, title, game · type, counterparty, order number, price and
// "View details") and the seller's "My Listings" record panel with its Edit / Delete actions.
// Both sides are loaded up front so both summary tiles carry real numbers. The topbar search box
// filters the orders and listings, as on the prototype.

function formatDate(value: string) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ka-GE', { year: 'numeric', month: 'short', day: 'numeric' })
}

type Tab = 'purchased' | 'sold'

export default function Orders() {
  const { user, checked } = useAuth()
  const userId = user?.id
  const [tab, setTab] = useState<Tab>('purchased')
  const [rows, setRows] = useState<{ purchased: PublicOrderSummary[]; sold: PublicOrderSummary[] } | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([api.listOrdersAsBuyer(), api.listOrdersAsSeller()])
      .then(([purchased, sold]) => {
        if (!cancelled) setRows({ purchased, sold })
      })
      .catch((err) => {
        if (cancelled) return
        setRows({ purchased: [], sold: [] })
        setError(errorMessage(err, 'შეკვეთების ჩატვირთვა ვერ მოხერხდა.'))
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const purchased = rows?.purchased ?? []
  const sold = rows?.sold ?? []
  const sum = (list: PublicOrderSummary[]) => list.reduce((total, order) => total + order.priceWaveCoin, 0)
  const q = query.trim().toLowerCase()
  const shown = (tab === 'purchased' ? purchased : sold).filter(
    (order) =>
      !q ||
      [order.listing.title, order.listing.gameName, order.seller.username, order.buyer.username, ORDER_STATUS_LABELS[order.status], order.orderNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
  )

  return (
    <Layout
      title="ჩემი შეკვეთები"
      noIndex
      pageSearch={{ value: query, onChange: setQuery, placeholder: 'მოძებნე შეკვეთები, თამაშები ან მომხმარებლები...', label: 'შეკვეთების ძიება' }}
    >
      <section className="orders-page-head">
        <div>
          <p className="section-kicker">შეკვეთების ისტორია</p>
          <h1>ჩემი შეკვეთები</h1>
          <p>აკონტროლე ყველაფერი, რაც WaveHub-ზე იყიდე ან გაყიდე.</p>
        </div>
        <div className="marketplace-total">
          <strong id="ordersTotalCount">{purchased.length + sold.length}</strong>
          <span>შეკვეთა</span>
        </div>
      </section>

      <section className="orders-login" id="ordersLogin" hidden={!checked || !!user}>
        <h2>შედით შეკვეთების სანახავად</h2>
        <p>შესვლის შემდეგ ხელმისაწვდომი იქნება ყიდვებისა და გაყიდვების ისტორია.</p>
        <Link href="/login?next=/orders">შესვლა</Link>
      </section>

      <section className="orders-dashboard" id="ordersDashboard" hidden={!user}>
        <div className="orders-summary" aria-label="შეკვეთების შეჯამება">
          <article>
            <span>შესყიდვები</span>
            <strong id="purchasedCount">{purchased.length}</strong>
            <small id="purchasedTotal">{sum(purchased)} GEL</small>
          </article>
          <article>
            <span>გაყიდვები</span>
            <strong id="soldCount">{sold.length}</strong>
            <small id="soldTotal">{sum(sold)} GEL</small>
          </article>
        </div>

        <div className="orders-tabs" role="tablist">
          {(
            [
              ['purchased', 'შესყიდვები'],
              ['sold', 'გაყიდვები'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : undefined} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="status-text status-error" role="alert">
            {error}
          </div>
        )}

        <div className="orders-list" id="ordersList">
          {shown.map((order) => {
            const counterpart = tab === 'purchased' ? `გამყიდველი: @${order.seller.username}` : `მყიდველი: @${order.buyer.username}`
            const image = order.listing.imageUrl ?? gameCover(order.listing.gameSlug)
            const details = [order.listing.gameName, LISTING_TYPE_LABELS[order.listing.type], order.package?.name].filter(Boolean).join(' · ')
            return (
              <article key={order.id} className="order-card">
                <Link
                  className="order-thumb"
                  href={`/orders/${order.id}`}
                  aria-label={order.listing.title}
                  style={image ? { backgroundImage: `linear-gradient(180deg,rgba(5,8,19,.06),rgba(5,8,19,.5)),url('${image}')` } : undefined}
                >
                  {image ? '' : (order.listing.gameName ?? 'WH').slice(0, 2).toUpperCase()}
                </Link>
                <div className="order-copy">
                  <div>
                    <span className="order-status">{ORDER_STATUS_LABELS[order.status]}</span>
                    <small>{formatDate(order.createdAt)}</small>
                  </div>
                  <h2>{order.listing.title}</h2>
                  <p>{details}</p>
                  <span>{counterpart}</span>
                  <code>Order #{order.orderNumber}</code>
                </div>
                <div className="order-side">
                  <strong>{order.priceWaveCoin} GEL</strong>
                  <Link href={`/orders/${order.id}`}>დეტალების ნახვა</Link>
                </div>
              </article>
            )
          })}
        </div>
        <div className="orders-empty" id="ordersEmpty" hidden={rows === null || shown.length > 0}>
          <strong>შეკვეთები ვერ მოიძებნა</strong>
          <p>თქვენი შესაბამისი შეკვეთები აქ გამოჩნდება.</p>
        </div>
        {rows === null && user && <div className="orders-empty">იტვირთება…</div>}

        {user && <MyListings className="orders-listings-section" gridId="ordersListings" query={query} />}
      </section>
    </Layout>
  )
}
