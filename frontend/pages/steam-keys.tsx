import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { ListingType, type PublicListingSummary } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import { api, errorMessage } from '../lib/api'
import { useFavorites } from '../lib/favorites'
import { gameCover } from '../lib/games'

// The prototype's steam-keys.html store page (body.steam-keys-page: heading, search + sort, chip
// row, card grid, mobile featured strip, store footer), on the platform's real digital-key
// listings. Differences, all because the prototype's catalogue is a hardcoded list:
//   - the chip row filters by the real games that have keys (the prototype's genre chips have no
//     backing data — keys don't carry a genre)
//   - "Popular" = real completed-order count; price/title sorts are real
//   - stock badge = the live count of unsold keys; ♡ = a real favourite
//   - sellers get the same topbar button style as the marketplace's, into the real key-upload flow
/* eslint-disable @next/next/no-img-element */

type Sort = 'popular' | 'price-low' | 'price-high' | 'title'

function price(listing: PublicListingSummary) {
  return listing.priceWaveCoin ?? listing.startingPriceWaveCoin ?? 0
}

function KeyCard({ listing }: { listing: PublicListingSummary }) {
  const { isFavorite, toggle } = useFavorites()
  const saved = isFavorite(listing.id)
  const cover = gameCover(listing.game?.slug, listing.images[0]?.url ?? null)
  const inStock = (listing.stockQuantity ?? 0) > 0
  return (
    <article className="steam-game-card">
      <div
        className="steam-game-cover"
        style={cover ? { backgroundImage: `linear-gradient(180deg,transparent,rgba(5,8,16,.65)),url('${cover}')` } : undefined}
      >
        <span>
          <img src="/assets/steam-logo.png" alt="" />
          Steam გასაღები
        </span>
        <b className={`steam-stock ${inStock ? 'stock' : 'out'}`}>{inStock ? 'მარაგშია' : 'ამოიწურა'}</b>
        <button type="button" className={saved ? 'saved' : ''} aria-label={`Save ${listing.title}`} aria-pressed={saved} onClick={() => void toggle(listing.id)}>
          {saved ? '♥' : '♡'}
        </button>
      </div>
      <div className="steam-game-info">
        <h2>{listing.title}</h2>
        <p>{listing.game?.name ?? 'Steam'}</p>
        <div className="steam-game-price">
          <strong>
            {price(listing)} <small>WC</small>
          </strong>
          <Link href={`/listings/${listing.id}`}>See Details</Link>
        </div>
      </div>
    </article>
  )
}

export default function SteamKeys() {
  const router = useRouter()
  const [items, setItems] = useState<PublicListingSummary[] | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('popular')
  const [game, setGame] = useState('all')

  useEffect(() => {
    api
      .browseListings({ type: ListingType.DigitalKey, limit: 100 })
      .then((res) => setItems(res.items))
      .catch((err) => {
        setItems([])
        setError(errorMessage(err, 'გასაღებების ჩატვირთვა ვერ მოხერხდა.'))
      })
  }, [])

  const games = useMemo(() => {
    const seen = new Map<string, string>()
    ;(items ?? []).forEach((listing) => {
      if (listing.game) seen.set(listing.game.slug, listing.game.name)
    })
    return [...seen.entries()]
  }, [items])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = (items ?? []).filter(
      (listing) =>
        (game === 'all' || listing.game?.slug === game) &&
        (!q || listing.title.toLowerCase().includes(q) || (listing.game?.name ?? '').toLowerCase().includes(q)),
    )
    const sorted = [...list]
    if (sort === 'price-low') sorted.sort((a, b) => price(a) - price(b))
    else if (sort === 'price-high') sorted.sort((a, b) => price(b) - price(a))
    else if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title))
    else sorted.sort((a, b) => b.ordersCount - a.ordersCount)
    return sorted
  }, [items, game, search, sort])

  const featured = (items ?? []).filter((listing) => (listing.stockQuantity ?? 0) > 0).slice(0, 3)

  return (
    <Layout
      title="Steam გასაღებები"
      description="ციფრული გასაღებები და კოდები მყისიერი მიწოდებით — WaveHubX Steam გასაღებები."
      bodyClass="steam-keys-page"
      topbarAction={
        <button className="seller-button" type="button" onClick={() => router.push('/sell/digital-keys')}>
          გასაღებების გაყიდვა
        </button>
      }
    >
      <section className="steam-store" id="steamGames">
        <header className="steam-store-heading">
          <div>
            <h1>Steam თამაშები</h1>
            <p>აღმოაჩინე თამაშები. მიიღე გასაღები. დაიწყე თამაში.</p>
          </div>
          <a href="#steamGrid">
            ყველა თამაშის ნახვა <span>→</span>
          </a>
        </header>

        <section className="steam-catalog-toolbar" aria-label="Steam თამაშების ფილტრები">
          <label>
            <span className="sr-only">თამაშების ძიება</span>
            <input id="steamSearch" type="search" placeholder="მოძებნე თამაშები..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="steam-sort-label">
            დალაგება{' '}
            <select id="steamSort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="popular">პოპულარული</option>
              <option value="price-low">ფასი: დაბლიდან მაღლისკენ</option>
              <option value="price-high">ფასი: მაღლიდან დაბლისკენ</option>
              <option value="title">სათაური</option>
            </select>
          </label>
          <div className="steam-genres" id="steamGenres">
            <button className={game === 'all' ? 'active' : undefined} type="button" onClick={() => setGame('all')}>
              ყველა
            </button>
            {games.map(([slug, name]) => (
              <button key={slug} className={game === slug ? 'active' : undefined} type="button" onClick={() => setGame(slug)}>
                {name}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <p className="status-text status-error" role="alert">
            {error}
          </p>
        )}

        <div className="steam-games-grid" id="steamGrid">
          {items === null ? (
            <p className="marketplace-empty">იტვირთება…</p>
          ) : visible.length === 0 ? (
            <p className="marketplace-empty">გასაღებები ვერ მოიძებნა.</p>
          ) : (
            visible.map((listing) => <KeyCard key={listing.id} listing={listing} />)
          )}
        </div>
      </section>

      <section className="featured-items" aria-labelledby="featuredItemsTitle">
        <header className="featured-items-heading">
          <div className="featured-items-title">
            <span className="featured-items-spark" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none"><path d="M16 2.5 18.9 13l10.6 3-10.6 3L16 29.5 13.1 19 2.5 16l10.6-3L16 2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="m24.5 4 .9 3.1 3.1.9-3.1.9-.9 3.1-.9-3.1-3.1-.9 3.1-.9.9-3.1Z" fill="currentColor" /></svg>
            </span>
            <h2 id="featuredItemsTitle">რჩეული ნივთები</h2>
          </div>
          <a href="#steamGrid">
            ყველას ნახვა <span aria-hidden="true">→</span>
          </a>
        </header>
        <div className="featured-items-grid">
          {featured.map((listing) => {
            const cover = gameCover(listing.game?.slug, listing.images[0]?.url ?? null)
            return (
              <Link key={listing.id} className="featured-item-card" href={`/listings/${listing.id}`}>
                <span className="featured-item-save" aria-hidden="true">
                  ♡
                </span>
                <span className="mobile-featured-product-image" style={cover ? { backgroundImage: `url("${cover}")` } : undefined}></span>
                <strong>{listing.title}</strong>
                <small>მყისიერი აქტივაცია</small>
                <b>{price(listing)} WC</b>
              </Link>
            )
          })}
        </div>
      </section>

      <footer className="steam-store-footer">
        <Link href="/">
          <img src="/assets/favicon.png" alt="" />
          <span>
            <strong>WaveHub</strong>
            <small>© {new Date().getFullYear()} WaveHub. All rights reserved.</small>
          </span>
        </Link>
        <p>ითამაშე მეტი. გადაიხადე ნაკლები.</p>
        <div>
          <span>Facebook</span>
          <span>Instagram</span>
          <span>TikTok</span>
          <span>Discord</span>
        </div>
      </footer>
    </Layout>
  )
}
