/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Fragment, useEffect, useState } from 'react'
import { ListingType, type PublicListingSummary } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { gameCover } from '../lib/games'
import { TIcon } from '../lib/tournaments'

// docs/design-mockups/04-steam-games-list.jpg: title, search, sort (no genre filter — owner decision 2026-09-26), a row of large
// cards then a row of compact ones, and pagination — over the platform's real digital-key
// listings. Card facts are real: stock = unsold keys, tagline/genre = what the seller entered,
// "Popular" = completed orders. Search, sort and paging are server-side.

type Sort = 'popular' | 'newest' | 'price_asc' | 'price_desc'
const PER_PAGE = 12
const LARGE = 5

function pageList(total: number, active: number): number[] {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1)
  return [...new Set([1, active - 1, active, active + 1, total])].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
}

function SteamCard({ listing, size }: { listing: PublicListingSummary; size: 'lg' | 'sm' }) {
  const attrs = listing.itemAttributes ?? {}
  const cover = listing.images[0]?.url ?? gameCover(listing.game?.slug)
  const inStock = (listing.stockQuantity ?? 0) > 0
  const price = listing.priceWaveCoin ?? listing.startingPriceWaveCoin ?? 0
  const href = `/listings/${listing.id}`
  return (
    <article className={`sg-card ${size}${inStock ? '' : ' out'}`}>
      <Link className="sg-cover" href={href} style={cover ? { backgroundImage: `url('${cover}')` } : undefined} aria-label={listing.title}>
        <span className="sg-pill">
          <img src="/assets/steam-logo.png" alt="" /> STEAM KEY
        </span>
        <span className={`sg-stock${inStock ? '' : ' out'}`}>
          <i aria-hidden="true"></i>
          {inStock ? 'მარაგშია' : 'ამოიწურა'}
        </span>
        {!cover && <img className="sg-cover-logo" src="/assets/steam-logo.png" alt="" />}
      </Link>
      <div className="sg-body">
        <strong>{listing.title}</strong>
        <span>{attrs.tagline ? String(attrs.tagline) : listing.game?.name ?? 'Steam'}</span>
        <div className="sg-foot">
          <b>{price} GEL</b>
          <Link className="sg-details" href={href} aria-disabled={!inStock}>
            დეტალები <TIcon name="arrow" />
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function SteamGames() {
  const router = useRouter()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('popular')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<{ items: PublicListingSummary[]; total: number } | null>(null)
  const [error, setError] = useState('')

  // Debounced search box.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    api
      .browseListings({ type: ListingType.DigitalKey, q: search || undefined, sort, limit: PER_PAGE, offset: (page - 1) * PER_PAGE })
      .then((res) => {
        if (cancelled) return
        setResult(res)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setResult({ items: [], total: 0 })
        setError(errorMessage(err, 'თამაშების ჩატვირთვა ვერ მოხერხდა.'))
      })
    return () => {
      cancelled = true
    }
  }, [search, sort, page])

  const items = result?.items ?? []
  const large = page === 1 ? items.slice(0, LARGE) : []
  const small = page === 1 ? items.slice(LARGE) : items
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / PER_PAGE))

  return (
    <Layout title="Steam თამაშები" description="Steam-ის აქტივაციის გასაღებები WaveHubX-ზე — მყისიერი მიწოდება, ესქროუ დაცვა.">
      <section className="sg-page">
        <div className="sg-top">
          <button
            type="button"
            className="sg-back"
            onClick={() => {
              if (window.history.length > 1) router.back()
              else router.push('/')
            }}
          >
            <TIcon name="back" /> უკან
          </button>
          {user && (
            <Link className="wt-head-link" href="/sell/digital-keys">
              გასაღებების გაყიდვა
            </Link>
          )}
        </div>
        <header className="sg-head">
          <h1>Steam თამაშები</h1>
          <p>შეიძინე საყვარელი თამაშები საუკეთესო ფასად. მყისიერი მიწოდება, ესქროუ დაცვა.</p>
        </header>

        <div className="sg-toolbar">
          <label className="sg-search">
            <TIcon name="search" />
            <span className="sr-only">თამაშების ძიება</span>
            <input type="search" placeholder="მოძებნე თამაშები..." value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} />
          </label>
          <label className="sg-sort">
            <span>დალაგება</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as Sort)
                setPage(1)
              }}
            >
              <option value="popular">პოპულარული</option>
              <option value="newest">უახლესი</option>
              <option value="price_asc">ფასი ↑</option>
              <option value="price_desc">ფასი ↓</option>
            </select>
          </label>
        </div>

        {error && (
          <p className="seller-status error" role="alert">
            {error}
          </p>
        )}
        {result === null ? (
          <div className="marketplace-empty">იტვირთება…</div>
        ) : items.length === 0 ? (
          <div className="wt-empty">
            <img src="/assets/steam-logo.png" alt="" width={44} height={44} style={{ filter: 'invert(1)', opacity: 0.6 }} />
            <strong>თამაშები ვერ მოიძებნა</strong>
            <p>{search ? 'სცადე სხვა ძიება.' : 'გამყიდველების მიერ დამატებული Steam გასაღებები აქ გამოჩნდება.'}</p>
          </div>
        ) : (
          <>
            {large.length > 0 && (
              <div className="sg-grid lg">
                {large.map((listing) => (
                  <SteamCard key={listing.id} listing={listing} size="lg" />
                ))}
              </div>
            )}
            {small.length > 0 && (
              <div className="sg-grid sm">
                {small.map((listing) => (
                  <SteamCard key={listing.id} listing={listing} size="sm" />
                ))}
              </div>
            )}
          </>
        )}

        {totalPages > 1 && (
          <nav className="sg-pages" aria-label="გვერდები">
            <button type="button" aria-label="წინა" disabled={page === 1} onClick={() => setPage(page - 1)}>
              <TIcon name="chevronLeft" />
            </button>
            {pageList(totalPages, page).map((p, i, list) => (
              <Fragment key={p}>
                {i > 0 && p - list[i - 1] > 1 && <span aria-hidden="true">…</span>}
                <button type="button" className={p === page ? 'active' : undefined} aria-current={p === page ? 'page' : undefined} onClick={() => setPage(p)}>
                  {p}
                </button>
              </Fragment>
            ))}
            <button type="button" aria-label="შემდეგი" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              <TIcon name="chevron" />
            </button>
          </nav>
        )}
      </section>
    </Layout>
  )
}
