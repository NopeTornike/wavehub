import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ListingType } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useCart, type CartLine } from '../lib/cart'
import { gameCover } from '../lib/games'

// The prototype's cart.html (head + 3-step progress + item list + order summary), on the real
// order system. The prototype's checkout only records a local "checkout request"; here checkout
// places one real escrow order per unit (POST /orders — the backend's purchase is single-listing
// by design), so money moves exactly as it does from a listing page.
//   - Each line is re-read from the server on load: the price shown and charged is the live one,
//     and lines whose listing is gone/unavailable are flagged instead of silently bought.
//   - Checkout first compares the live total with the real WaveCoin balance.
//   - Lines are bought one by one; each success leaves the cart and links to its order, each
//     failure stays with the reason, so a partial checkout is never ambiguous.
/* eslint-disable @next/next/no-img-element */

type LiveState = { price: number; available: boolean; gameSlug: string | null; reason?: string }
type Result = { listingId: string; title: string; orderIds: string[]; error?: string }

export default function CartPage() {
  const { user, checked, refresh } = useAuth()
  const cart = useCart()
  const [live, setLive] = useState<Record<string, LiveState>>({})
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success' | 'pending'; text: string }>({ kind: '', text: '' })
  const [results, setResults] = useState<Result[]>([])
  const [busy, setBusy] = useState(false)

  const lineIds = cart.lines.map((l) => l.listingId).join(',')

  useEffect(() => {
    if (!lineIds) return
    let cancelled = false
    Promise.all(
      lineIds.split(',').map(async (id): Promise<[string, LiveState]> => {
        try {
          const listing = await api.getListing(id)
          const price = listing.priceWaveCoin ?? listing.startingPriceWaveCoin ?? 0
          const stock = listing.stockQuantity ?? 0
          const available = listing.type !== ListingType.Service && stock > 0
          return [id, { price, available, gameSlug: listing.game?.slug ?? null, reason: available ? undefined : 'მარაგი ამოიწურა' }]
        } catch {
          return [id, { price: 0, available: false, gameSlug: null, reason: 'განცხადება აღარ არის ხელმისაწვდომი' }]
        }
      }),
    ).then((entries) => {
      if (!cancelled) setLive(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [lineIds])

  const priceOf = (line: CartLine) => live[line.listingId]?.price ?? line.priceWaveCoin
  const buyable = cart.lines.filter((line) => live[line.listingId]?.available !== false)
  const total = buyable.reduce((sum, line) => sum + priceOf(line) * line.quantity, 0)
  const itemCount = buyable.reduce((sum, line) => sum + line.quantity, 0)
  const balance = user?.wavecoinBalance ?? 0

  const checkout = async () => {
    if (!user) {
      setStatus({ kind: 'error', text: 'გადახდამდე გთხოვთ შეხვიდეთ ანგარიშზე.' })
      return
    }
    if (buyable.length === 0) return
    if (total > balance) {
      setStatus({ kind: 'error', text: `ბალანსი არ არის საკმარისი: საჭიროა ${total} GEL, გაქვთ ${balance} WC.` })
      return
    }
    setBusy(true)
    setStep(2)
    setStatus({ kind: 'pending', text: 'შეკვეთები იქმნება…' })
    const outcome: Result[] = []
    for (const line of buyable) {
      const result: Result = { listingId: line.listingId, title: line.title, orderIds: [] }
      for (let unit = 0; unit < line.quantity; unit += 1) {
        try {
          const order = await api.purchase({ listingId: line.listingId })
          result.orderIds.push(order.id)
        } catch (err) {
          result.error = errorMessage(err, 'შეკვეთა ვერ შეიქმნა.')
          break
        }
      }
      if (result.orderIds.length === line.quantity) cart.remove(line.listingId)
      else if (result.orderIds.length > 0) cart.setQuantity(line.listingId, line.quantity - result.orderIds.length)
      outcome.push(result)
    }
    await refresh()
    setResults(outcome)
    setBusy(false)
    const failed = outcome.filter((r) => r.error)
    if (failed.length === 0) {
      setStep(3)
      setStatus({ kind: 'success', text: 'შეკვეთები შეიქმნა. თანხა დაცულია ესქროუში, სანამ მიწოდებას არ დაადასტურებთ.' })
    } else {
      setStep(1)
      setStatus({ kind: 'error', text: `${failed.length} პროდუქტის შეძენა ვერ მოხერხდა — იხილეთ ქვემოთ.` })
    }
  }

  return (
    <Layout title="კალათა" noIndex bodyClass="cart-page">
      <section className="marketplace-head cart-page-head" aria-labelledby="cartTitle">
        <div>
          <p className="section-kicker">გადახდაზე გადასვლა</p>
          <h1 id="cartTitle">შენი კალათა</h1>
          <p className="cart-page-subtitle">გადახედე არჩეულ ნივთებს და უსაფრთხოდ დაასრულე შეკვეთა.</p>
        </div>
        <div className="marketplace-total" aria-label="კალათის პროდუქტები">
          <strong id="cartCount">{cart.count}</strong>
          <span>პროდუქტი</span>
        </div>
      </section>

      <ol className="cart-progress" aria-label="გადახდის ეტაპები">
        {['კალათა', 'გადახდა', 'დასრულება'].map((label, index) => (
          <li key={label} className={step >= index + 1 ? 'active' : undefined}>
            <span>{index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      <section className="cart-page-layout" aria-label="კალათის პროდუქტები">
        <div className="cart-page-main">
          <div className="cart-list-heading">
            <div>
              <span className="cart-list-icon" aria-hidden="true">
                <img src="/assets/cart-icon.png" alt="" />
              </span>
              <div>
                <strong>შეკვეთის ნივთები</strong>
                <small>ციფრული პროდუქტები შენს კალათაში</small>
              </div>
            </div>
            <Link href="/marketplace">შოპინგის გაგრძელება</Link>
          </div>

          <div className="cart-list cart-page-list" id="cartList">
            {cart.lines.map((line) => {
              const state = live[line.listingId]
              const image = gameCover(state?.gameSlug, line.imageUrl)
              return (
                <article key={line.listingId} className={`cart-item cart-page-item${state?.available === false ? ' is-unavailable' : ''}`}>
                  <Link
                    className="cart-item-thumb"
                    href={`/listings/${line.listingId}`}
                    aria-label={`Open ${line.title}`}
                    style={image ? { backgroundImage: `linear-gradient(rgba(5, 8, 19, 0.08), rgba(5, 8, 19, 0.4)), url("${image}")` } : undefined}
                  />
                  <div className="cart-item-copy">
                    <strong>{line.title}</strong>
                    <span>
                      {line.gameName ?? 'Marketplace'} / {line.sellerUsername}
                      {line.quantity > 1 ? ` · ×${line.quantity}` : ''}
                    </span>
                    <small>{state?.available === false ? state.reason : `${priceOf(line) * line.quantity} GEL`}</small>
                  </div>
                  <div className="cart-item-actions">
                    <Link href={`/listings/${line.listingId}`}>ნახვა</Link>
                    <button className="cart-remove-button" type="button" onClick={() => cart.remove(line.listingId)} disabled={busy}>
                      წაშლა
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          <div className="marketplace-empty" id="cartEmpty" hidden={cart.lines.length > 0}>
            კალათა ცარიელია. <Link href="/marketplace">დაათვალიერე მარკეტი</Link>
          </div>

          {results.length > 0 && (
            <div className="cart-list cart-page-list" aria-label="შეკვეთის შედეგები">
              {results.map((result) => (
                <article key={result.listingId} className="cart-item cart-page-item">
                  <div className="cart-item-copy">
                    <strong>{result.title}</strong>
                    <span>{result.error ? result.error : `შეკვეთა შეიქმნა (${result.orderIds.length})`}</span>
                  </div>
                  <div className="cart-item-actions">
                    {result.orderIds.map((id) => (
                      <Link key={id} href={`/orders/${id}`}>
                        შეკვეთა
                      </Link>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="cart-checkout-panel" aria-label="შეკვეთის შეჯამება">
          <header>
            <span>შეკვეთის მიმოხილვა</span>
            <h2>შეჯამება</h2>
          </header>
          <div className="cart-summary-row">
            <span>შუალედური ჯამი</span>
            <strong id="cartSubtotal">{total} GEL</strong>
          </div>
          <div className="cart-summary-row">
            <span>ნივთები</span>
            <strong id="cartSummaryCount">{itemCount}</strong>
          </div>
          <div className="cart-summary-row cart-fee-row">
            <span>მომსახურების საკომისიო</span>
            <strong>უფასო</strong>
          </div>
          {user && (
            <div className="cart-summary-row">
              <span>ბალანსი</span>
              <strong>{balance} WC</strong>
            </div>
          )}
          <div className="cart-summary-total">
            <span>სულ</span>
            <strong id="cartTotal">{total} GEL</strong>
          </div>
          {checked && !user ? (
            <Link className="cart-checkout-button" href="/login?next=/cart">
              <span>შესვლა და გადახდა</span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : total > balance && buyable.length > 0 ? (
            <Link className="cart-checkout-button" href="/wallet">
              <span>საფულის შევსება</span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <button className="cart-checkout-button" id="checkoutButton" type="button" disabled={busy || buyable.length === 0} onClick={checkout}>
              <span>{busy ? 'მუშავდება…' : 'გადახდაზე გადასვლა'}</span>
              <span aria-hidden="true">→</span>
            </button>
          )}
          <div className="cart-secure-note">
            <span aria-hidden="true">✓</span>
            <p>
              <strong>დაცული გადახდა</strong>
              <small>თანხა ესქროუშია, სანამ მიწოდებას არ დაადასტურებ.</small>
            </p>
          </div>
          <p className={`seller-status${status.kind ? ` ${status.kind}` : ''}`} id="checkoutStatus" aria-live="polite">
            {status.text}
          </p>
        </aside>
      </section>
    </Layout>
  )
}
