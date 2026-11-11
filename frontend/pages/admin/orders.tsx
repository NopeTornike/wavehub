/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { FormEvent, useEffect, useState } from 'react'
import { OrderStatus, type AdminOrderPage, type AdminOrderParty } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import Avatar from '../../components/Avatar'
import { api, errorMessage } from '../../lib/api'
import { kaDateTime } from '../../lib/dates'
import { ORDER_STATUS_LABELS } from '../../lib/labels'
import { gel } from '../../lib/money'

// Admin → Orders (owner 2026-11-10: "orders come in and I can't see whose order sold — show me so I
// can warn the seller"). Every order, newest first: what sold, buyer → seller, amount, status, and
// one tap to message the seller or open the order. Read-only; served by `GET admin/orders`
// (Super Admin, Main Administrator, Operation Lead, Marketplace Ops). A new order also rings their bell.

const FILTERS: Array<[string, string]> = [
  ['', 'ყველა'],
  [OrderStatus.Paid, 'ახალი (გადახდილი)'],
  [OrderStatus.InProgress, 'მიმდინარე'],
  [OrderStatus.Delivered, 'მიწოდებული'],
  [OrderStatus.Disputed, 'დავაში'],
  [OrderStatus.Completed, 'დასრულებული'],
  [OrderStatus.Cancelled, 'გაუქმებული'],
  [OrderStatus.Refunded, 'დაბრუნებული'],
]

function Party({ label, party }: { label: string; party: AdminOrderParty }) {
  return (
    <span className="ao-party">
      <Avatar name={party.name} src={party.avatarUrl} size={34} ring={false} />
      <span>
        <small>{label}</small>
        <Link href={`/u/${party.username}`}>{party.name}</Link>
        <em>@{party.username}</em>
      </span>
    </span>
  )
}

export default function AdminOrders() {
  const router = useRouter()
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AdminOrderPage | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  // `?q=WH-000123` (the staff bell links here) pre-fills the search.
  useEffect(() => {
    if (!router.isReady) return
    const q = typeof router.query.q === 'string' ? router.query.q : ''
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(q)
    setApplied(q)
  }, [router.isReady, router.query.q])

  useEffect(() => {
    if (!router.isReady) return
    let cancelled = false
    api
      .adminListOrders({ status, q: applied, page })
      .then((res) => {
        if (!cancelled) {
          setData(res)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'შეკვეთების ჩატვირთვა ვერ მოხერხდა.'))
      })
    return () => {
      cancelled = true
    }
  }, [router.isReady, status, applied, page])

  const search = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setApplied(query.trim())
  }

  const message = async (userId: string) => {
    setBusy(userId)
    try {
      const { id } = await api.startDirectConversation(userId)
      await router.push(`/messages?conversation=${id}`)
    } catch (err) {
      setError(errorMessage(err, 'მიწერა ვერ მოხერხდა.'))
    } finally {
      setBusy(null)
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / 30)) : 1

  return (
    <AdminLayout title="შეკვეთები">
      <h1 className="page-title">შეკვეთები</h1>
      <p className="page-subtitle">ყველა შეკვეთა — ვინ იყიდა, ვისგან და რა. ახალ შეკვეთაზე შეტყობინებაც მოდის.</p>

      <form className="ao-toolbar" onSubmit={search}>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="შეკვეთის ნომერი, განცხადება ან @username" aria-label="ძიება" />
        <button type="submit" className="button">
          ძიება
        </button>
      </form>
      <div className="al-tabs ao-filters" role="tablist">
        {FILTERS.map(([value, label]) => (
          <button
            key={value || 'all'}
            type="button"
            role="tab"
            aria-selected={status === value}
            className={status === value ? 'active' : undefined}
            onClick={() => {
              setStatus(value)
              setPage(1)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      )}

      {!data ? (
        <p className="empty-state">იტვირთება…</p>
      ) : data.items.length === 0 ? (
        <p className="empty-state">შეკვეთები არ მოიძებნა.</p>
      ) : (
        <>
          <p className="ao-count">სულ {data.total} შეკვეთა</p>
          <div className="ao-list">
            {data.items.map((o) => (
              <article key={o.id} className={`ao-card is-${o.status}`}>
                <header>
                  <strong>#{o.orderNumber}</strong>
                  <span className={`ao-status is-${o.status}`}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                  <time>{kaDateTime(o.createdAt)}</time>
                </header>
                <p className="ao-title">
                  <Link href={`/listings/${o.listing.id}`}>{o.listing.title}</Link>
                  {o.listing.gameName && <small>{o.listing.gameName}</small>}
                </p>
                <div className="ao-parties">
                  <Party label="მყიდველი" party={o.buyer} />
                  <span className="ao-arrow" aria-hidden="true">
                    →
                  </span>
                  <Party label="გამყიდველი" party={o.seller} />
                </div>
                <footer>
                  <span className="ao-amount">
                    <b>{gel(o.buyerTotalWaveCoin)} GEL</b>
                    <small>ფასი {gel(o.priceWaveCoin)}</small>
                  </span>
                  {o.seller.email && (
                    <a className="ao-mail" href={`mailto:${o.seller.email}`}>
                      {o.seller.email}
                    </a>
                  )}
                  <span className="ao-actions">
                    <button type="button" className="button" disabled={busy === o.seller.id} onClick={() => message(o.seller.id)}>
                      გამყიდველს მიწერა
                    </button>
                    <Link className="button" href={`/orders/${o.id}`}>
                      გახსნა
                    </Link>
                  </span>
                </footer>
              </article>
            ))}
          </div>
          {pages > 1 && (
            <nav className="ao-pager" aria-label="გვერდები">
              <button type="button" className="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ‹ წინა
              </button>
              <span>
                {page} / {pages}
              </span>
              <button type="button" className="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                შემდეგი ›
              </button>
            </nav>
          )}
        </>
      )}
    </AdminLayout>
  )
}
