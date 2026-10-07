import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ListingType, type PublicCategory, type PublicListingSummary, type PublicUserSearchResult, type SellerRanks } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import ProductCard from '../components/ProductCard'
import SellerModal from '../components/SellerModal'
import { api, errorMessage } from '../lib/api'
import { useCart } from '../lib/cart'
import { useShell } from '../lib/shell'
import { gel } from '../lib/money'
import StepsGuide from '../components/StepsGuide'
import HomeBanners from '../components/HomeBanners'
import { BannerPlacement } from '@wavehub/shared-types'
import { restoreScroll, saveSnapshot, takeSnapshot } from '../lib/scroll-memory'

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
type Product = 'all' | 'account' | 'skin' | 'item' | 'service'
type Sort = 'newest' | 'oldest' | 'price_asc' | 'price_desc'

function queryString(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

// Seller steps shown under the header (design 2026-10-04, "როგორ მუშაობს Escrow?").
const SELLER_STEPS = ['დააჭირე „გახდი გამყიდველი“', 'შეავსე ინფორმაცია', 'შეამოწმე', 'გამოაქვეყნე', 'დაელოდე დადასტურებას']
const SERVICE_STEPS = ['დააჭირე „გაყიდე სერვისი“', 'აღწერე სერვისი და ფოტოები', 'დაამატე პაკეტები', 'გამოაქვეყნე', 'დაელოდე დადასტურებას']

export default function Marketplace() {
  return <MarketplaceView />
}

// `servicesOnly` = the separate Services page (/services, client feedback #7): services only, its
// own heading, and "Sell a service" where the marketplace has "Become a seller".
export function MarketplaceView({ servicesOnly = false }: { servicesOnly?: boolean }) {
  const router = useRouter()
  const { games } = useShell()
  const cart = useCart()
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [items, setItems] = useState<PublicListingSummary[]>([])
  const [total, setTotal] = useState(0)
  // Back from a product returns to the same spot with the same loaded pages (lib/scroll-memory).
  const listRef = useRef({ items, total })
  useEffect(() => {
    listRef.current = { items, total }
  }, [items, total])
  useEffect(() => {
    const key = router.asPath
    const onLeave = () => saveSnapshot(key, listRef.current)
    router.events.on('routeChangeStart', onLeave)
    return () => router.events.off('routeChangeStart', onLeave)
  }, [router.asPath, router.events])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [ranks, setRanks] = useState<SellerRanks>({})
  const [tiers, setTiers] = useState<Record<string, string>>({})
  const [sellerOpen, setSellerOpen] = useState(false)
  // "Add a listing" elsewhere (My Listings) links to /marketplace?sell=1 — open the seller form.
  const sellParam = queryString(router.query.sell)
  useEffect(() => {
    // Follows the URL, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (sellParam === '1' && !servicesOnly) setSellerOpen(true)
  }, [sellParam, servicesOnly])

  const product = (servicesOnly ? 'service' : queryString(router.query.type) || 'all') as Product
  const game = queryString(router.query.game)
  const sort = (queryString(router.query.sort) || 'newest') as Sort
  const q = queryString(router.query.q)
  // A search also lists matching user accounts (GET users/search) above the product results.
  const [userHits, setUserHits] = useState<PublicUserSearchResult[]>([])
  useEffect(() => {
    const term = q.trim().replace(/^@/, '')
    if (term.length < 2 || term.length > 40) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserHits([])
      return
    }
    let cancelled = false
    api
      .searchUsers(term)
      .then((rows) => {
        if (!cancelled) setUserHits(rows)
      })
      .catch(() => {
        if (!cancelled) setUserHits([])
      })
    return () => {
      cancelled = true
    }
  }, [q])

  useEffect(() => {
    api.listCategories().then(setCategories).catch(() => undefined)
    api.getSellerRanks().then(setRanks).catch(() => undefined)
    api.getSellerTiers().then(setTiers).catch(() => undefined)
  }, [])

  // The category id as a plain value, so the filters (and the fetch) don't change identity when the
  // categories list arrives — that refetch used to wipe a Back-restored list (lib/scroll-memory).
  const categoryId =
    product === 'account' || product === 'skin' || product === 'item'
      ? categories.find((c) => c.slug === (product === 'account' ? 'accounts' : product === 'skin' ? 'skins' : 'items'))?.id
      : undefined
  const filters = useMemo(() => {
    const byType = product === 'service' ? { type: ListingType.Service } : {}
    return { ...byType, categoryId, game: game || undefined, sort, q: q || undefined }
  }, [product, categoryId, game, sort, q])

  const waitingForCategory = (product === 'account' || product === 'skin' || product === 'item') && !filters.categoryId

  useEffect(() => {
    if (!router.isReady || waitingForCategory) return
    const snap = takeSnapshot<{ items: PublicListingSummary[]; total: number }>(router.asPath)
    if (snap) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(snap.data.items)
      setTotal(snap.data.total)
      setLoading(false)
      restoreScroll(snap.scrollY)
      return
    }
    let cancelled = false
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
  }, [filters, router.isReady, router.asPath, waitingForCategory])

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
      // Services live on their own page; every other product type on the marketplace.
      if (key === 'type') {
        delete next.type
        if (value === 'service') {
          router.push({ pathname: '/services', query: next })
          return
        }
        if (value && value !== fallback) next.type = value
        if (servicesOnly) {
          router.push({ pathname: '/marketplace', query: next })
          return
        }
      }
      router.push({ pathname: servicesOnly ? '/services' : '/marketplace', query: next }, undefined, { shallow: true, scroll: false })
    },
    [router, servicesOnly],
  )

  const steps = servicesOnly ? SERVICE_STEPS : SELLER_STEPS
  const listTitle =
    product === 'account' ? 'ანგარიშები' : product === 'skin' ? 'სკინები' : product === 'item' ? 'ნივთები' : product === 'service' ? 'სერვისები' : 'ყველა პროდუქტი'

  return (
    <Layout
      title={servicesOnly ? 'სერვისები' : 'მარკეტი'}
      description={
        servicesOnly
          ? 'გეიმინგ სერვისები — ბუსტინგი, ქოუჩინგი, დუო თამაში და სხვა — WaveHubX-ზე.'
          : 'იყიდეთ და გაყიდეთ გეიმინგ ანგარიშები, სკინები, სერვისები და ციფრული გასაღებები — WaveHubX მარკეტი.'
      }
      topbarAction={
        servicesOnly ? (
          <Link className="seller-button" id="sellServiceButton" href="/sell/services">
            გაყიდე სერვისი
          </Link>
        ) : (
          <button className="seller-button" id="sellerButton" type="button" aria-haspopup="dialog" aria-controls="sellerModal" aria-expanded={sellerOpen} onClick={() => setSellerOpen(true)}>
            გახდი გამყიდველი
          </button>
        )
      }
    >
      <HomeBanners placement={servicesOnly ? BannerPlacement.ServicesTop : BannerPlacement.MarketplaceTop} />
      <StepsGuide id="escrowStepsTitle" title="როგორ მუშაობს" accent="Escrow" steps={steps} />

      <section className="marketplace-head" aria-labelledby="marketplaceTitle">
        <div>
          <p className="section-kicker">{servicesOnly ? 'ბუსტინგი, ქოუჩინგი, დუო და სხვა' : 'ანგარიშები, სკინები, ნივთები და სერვისები'}</p>
          <h1 id="marketplaceTitle">{servicesOnly ? 'სერვისები' : 'მარკეტი'}</h1>
        </div>
        <div className="marketplace-total" aria-label="ხილული განცხადებები">
          <strong id="marketplaceCount">{total}</strong>
          <span>პროდუქტი</span>
        </div>
      </section>

      {/* The product categories as one-tap chips (owner: "Accounts / Skins / Items" must be visible).
          The Services page is services-only, so it has neither the chips nor the product select. */}
      {!servicesOnly && (
        <nav className="marketplace-kinds" aria-label="კატეგორიები">
          {(
            [
              ['all', 'ყველა'],
              ['account', 'ანგარიშები'],
              ['skin', 'სკინები'],
              ['item', 'ნივთები'],
              ['service', 'სერვისები'],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={product === value} className={product === value ? 'active' : undefined} onClick={() => setFilter('type', value, 'all')}>
              {label}
            </button>
          ))}
        </nav>
      )}

      <section className={`marketplace-toolbar${servicesOnly ? ' services-only' : ''}`} aria-label="მარკეტფლეისის ფილტრები">
        <label hidden={servicesOnly}>
          <span>პროდუქტი</span>
          <select id="productTypeFilter" value={product} onChange={(e) => setFilter('type', e.target.value, 'all')}>
            <option value="all">ყველა პროდუქტი</option>
            <option value="account">ანგარიშები</option>
            <option value="skin">სკინები</option>
            <option value="item">ნივთები</option>
            <option value="service">სერვისები</option>
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

      {userHits.length > 0 && (
        <section className="marketplace-users" aria-labelledby="marketplaceUsersTitle">
          <h2 id="marketplaceUsersTitle">მომხმარებლები</h2>
          <div>
            {userHits.map((u) => (
              <Link key={u.id} href={`/u/${encodeURIComponent(u.username)}`}>
                <i style={u.avatarUrl ? { backgroundImage: `url("${u.avatarUrl}")` } : undefined} aria-hidden="true">
                  {u.avatarUrl ? '' : u.username.slice(0, 1).toUpperCase()}
                </i>
                @{u.username}
              </Link>
            ))}
          </div>
        </section>
      )}

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
          {!loading && items.map((listing) => <ProductCard key={listing.id} listing={listing} sellerRank={ranks[listing.seller.username]} sellerTier={tiers[listing.seller.username]} />)}
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

      <footer className={`marketplace-cart-footer${cart.count === 0 ? ' is-empty' : ''}`} aria-label="კალათა">
        <Link className="marketplace-cart-button" id="cartButton" href="/cart">
          <span>
            <img className="cart-icon-image" src="/assets/cart-icon.png" alt="" aria-hidden="true" /> კალათა{' '}
          </span>
          <strong id="cartCount">{cart.count}</strong>
          <small id="cartTotal">{gel(cart.totalWaveCoin)} GEL</small>
        </Link>
      </footer>

      <SellerModal open={sellerOpen} onClose={() => setSellerOpen(false)} />
    </Layout>
  )
}
