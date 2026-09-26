import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ListingType, type PublicCategory, type PublicListingSummary, type SellerRanks } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import ProductCard from '../components/ProductCard'
import SellerModal from '../components/SellerModal'
import { api, errorMessage } from '../lib/api'
import { useCart } from '../lib/cart'
import { useShell } from '../lib/shell'

// The prototype's marketplace.html, section for section: head + product count, the three filter
// selects (product / game / sort), the listing grid, the floating cart footer, and the
// "Become a seller" topbar button + listing builder. On real data:
//   - listings come from GET /listings (paginated — "load more" once past a page; the prototype
//     renders its whole localStorage array at once)
//   - product filter: Accounts / Skins are real item categories; the prototype's marketplace has
//     no services or keys, but this platform sells both, so they're offered as extra options (and
//     "all products" includes them)
//   - game filter = the real games table (by slug, so /marketplace?game=cs2 links work)
//   - sort = the prototype's four sorts, server-side
//   - topbar search lands here as ?q=
// Filters live in the URL so the sidebar game menu, home grid and back/forward all line up.
/* eslint-disable @next/next/no-img-element */

const PAGE_SIZE = 24
type Product = 'all' | 'account' | 'skin' | 'service' | 'key'
type Sort = 'newest' | 'oldest' | 'price_asc' | 'price_desc'

function queryString(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

export default function Marketplace() {
  const router = useRouter()
  const { games } = useShell()
  const cart = useCart()
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [items, setItems] = useState<PublicListingSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [ranks, setRanks] = useState<SellerRanks>({})
  const [sellerOpen, setSellerOpen] = useState(false)

  const product = (queryString(router.query.type) || 'all') as Product
  const game = queryString(router.query.game)
  const sort = (queryString(router.query.sort) || 'newest') as Sort
  const q = queryString(router.query.q)

  useEffect(() => {
    api.listCategories().then(setCategories).catch(() => undefined)
    api.getSellerRanks().then(setRanks).catch(() => undefined)
  }, [])

  const filters = useMemo(() => {
    const byType =
      product === 'service' ? { type: ListingType.Service } : product === 'key' ? { type: ListingType.DigitalKey } : {}
    const categoryId =
      product === 'account' || product === 'skin'
        ? categories.find((c) => c.slug === (product === 'account' ? 'accounts' : 'skins'))?.id
        : undefined
    return { ...byType, categoryId, game: game || undefined, sort, q: q || undefined }
  }, [product, categories, game, sort, q])

  const waitingForCategory = (product === 'account' || product === 'skin') && !filters.categoryId

  useEffect(() => {
    if (!router.isReady || waitingForCategory) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .browseListings({ ...filters, limit: PAGE_SIZE, offset: 0 })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err) => {
        if (cancelled) return
        setItems([])
        setTotal(0)
        setError(errorMessage(err, 'განცხადებების ჩატვირთვა ვერ მოხერხდა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filters, router.isReady, waitingForCategory])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const res = await api.browseListings({ ...filters, limit: PAGE_SIZE, offset: items.length })
      setItems((current) => [...current, ...res.items])
      setTotal(res.total)
    } catch (err) {
      setError(errorMessage(err, 'განცხადებების ჩატვირთვა ვერ მოხერხდა.'))
    } finally {
      setLoadingMore(false)
    }
  }

  const setFilter = useCallback(
    (key: 'type' | 'game' | 'sort', value: string, fallback: string) => {
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(router.query)) if (typeof v === 'string' && v) next[k] = v
      if (!value || value === fallback) delete next[key]
      else next[key] = value
      router.push({ pathname: '/marketplace', query: next }, undefined, { shallow: true, scroll: false })
    },
    [router],
  )

  const listTitle =
    product === 'account' ? 'ანგარიშები' : product === 'skin' ? 'სკინები' : product === 'service' ? 'სერვისები' : product === 'key' ? 'ციფრული გასაღებები' : 'ანგარიშები და სკინები'

  return (
    <Layout
      title="მარკეტი"
      description="იყიდეთ და გაყიდეთ გეიმინგ ანგარიშები, სკინები, სერვისები და ციფრული გასაღებები — WaveHubX მარკეტი."
      topbarAction={
        <button className="seller-button" id="sellerButton" type="button" aria-haspopup="dialog" aria-controls="sellerModal" aria-expanded={sellerOpen} onClick={() => setSellerOpen(true)}>
          გახდი გამყიდველი
        </button>
      }
    >
      <section className="marketplace-head" aria-labelledby="marketplaceTitle">
        <div>
          <p className="section-kicker">ანგარიშებისა და სკინების მარკეტფლეისი</p>
          <h1 id="marketplaceTitle">მარკეტი</h1>
        </div>
        <div className="marketplace-total" aria-label="ხილული განცხადებები">
          <strong id="marketplaceCount">{total}</strong>
          <span>პროდუქტი</span>
        </div>
      </section>

      <section className="marketplace-toolbar" aria-label="მარკეტფლეისის ფილტრები">
        <label>
          <span>პროდუქტი</span>
          <select id="productTypeFilter" value={product} onChange={(e) => setFilter('type', e.target.value, 'all')}>
            <option value="all">ყველა პროდუქტი</option>
            <option value="account">ანგარიშები</option>
            <option value="skin">სკინები</option>
            <option value="service">სერვისები</option>
            <option value="key">ციფრული გასაღებები</option>
          </select>
        </label>
        <label>
          <span>თამაში</span>
          <select id="gameFilter" value={game} onChange={(e) => setFilter('game', e.target.value, '')}>
            <option value="">ყველა თამაში</option>
            {games.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>ფასი (GEL)</span>
          <select id="priceSort" value={sort} onChange={(e) => setFilter('sort', e.target.value, 'newest')}>
            <option value="newest">უახლესი</option>
            <option value="oldest">უძველესი</option>
            <option value="price_asc">ფასი: დაბლიდან მაღლისკენ</option>
            <option value="price_desc">ფასი: მაღლიდან დაბლისკენ</option>
          </select>
        </label>
      </section>

      <section className="marketplace-list-section" aria-labelledby="marketplaceListTitle">
        <div className="section-heading">
          <div>
            <p className="section-kicker">{q ? `ძიება: „${q}“` : 'აქტიური განცხადებები'}</p>
            <h2 id="marketplaceListTitle">{listTitle}</h2>
          </div>
          {q && (
            <Link href={{ pathname: '/marketplace', query: { ...router.query, q: undefined } }} className="section-heading-link">
              ძიების გასუფთავება ×
            </Link>
          )}
        </div>

        {error && (
          <p className="status-text status-error" role="alert">
            {error}
          </p>
        )}

        <div className="marketplace-grid" id="marketplaceGrid" aria-busy={loading}>
          {!loading && items.map((listing) => <ProductCard key={listing.id} listing={listing} sellerRank={ranks[listing.seller.username]} />)}
        </div>
        <div className="marketplace-empty" id="marketplaceEmpty" hidden={loading ? false : items.length > 0}>
          {loading ? 'იტვირთება…' : 'განცხადებები ჯერ არ არის.'}
        </div>

        {!loading && items.length < total && (
          <div className="marketplace-load-more">
            <button type="button" className="product-showcase-details" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'იტვირთება…' : 'მეტის ჩვენება'}
            </button>
          </div>
        )}
      </section>

      <footer className="marketplace-cart-footer" aria-label="კალათა">
        <Link className="marketplace-cart-button" id="cartButton" href="/cart">
          <span>
            <img className="cart-icon-image" src="/assets/cart-icon.png" alt="" aria-hidden="true" /> კალათა{' '}
          </span>
          <strong id="cartCount">{cart.count}</strong>
          <small id="cartTotal">{cart.totalWaveCoin} GEL</small>
        </Link>
      </footer>

      <SellerModal open={sellerOpen} onClose={() => setSellerOpen(false)} />
    </Layout>
  )
}
