import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicCategory, PublicGame, PublicListingSummary } from '@wavehub/shared-types'
import { ListingType } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import { api, ApiError } from '../lib/api'

const PAGE_SIZE = 20

export default function Marketplace() {
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [games, setGames] = useState<PublicGame[]>([])
  const [items, setItems] = useState<PublicListingSummary[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [categoryId, setCategoryId] = useState('')
  const [gameId, setGameId] = useState('')
  const [type, setType] = useState<ListingType | ''>('')

  useEffect(() => {
    api.listCategories().then(setCategories).catch(() => undefined)
    api.listGames().then(setGames).catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false
    // Refetching on filter/offset change needs to flip loading back on — the react-hooks lint rule
    // flags any setState at the top of an effect body, but there's no external-system subscription
    // to move this into; this is a plain data-fetch-on-dependency-change effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .browseListings({
        categoryId: categoryId || undefined,
        gameId: gameId || undefined,
        type: type || undefined,
        limit: PAGE_SIZE,
        offset,
      })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'ლისტინგების ჩატვირთვა ვერ მოხერხდა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [categoryId, gameId, type, offset])

  const resetOffset = () => setOffset(0)

  return (
    <Layout>
      <section className="marketplace-head" aria-labelledby="marketplaceTitle">
        <div>
          <p className="section-kicker">სერვისები და ნივთები</p>
          <h1 id="marketplaceTitle">მარკეტფლეისი</h1>
        </div>
        <div className="marketplace-total" aria-label="ხილული ლისტინგები">
          <strong>{total}</strong>
          <span>ლისტინგი</span>
        </div>
      </section>

      <section className="marketplace-toolbar" aria-label="მარკეტფლეისის ფილტრები">
        <label>
          <span>კატეგორია</span>
          <select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value)
              resetOffset()
            }}
          >
            <option value="">ყველა კატეგორია</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>თამაში</span>
          <select
            value={gameId}
            onChange={(event) => {
              setGameId(event.target.value)
              resetOffset()
            }}
          >
            <option value="">ყველა თამაში</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>ტიპი</span>
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as ListingType | '')
              resetOffset()
            }}
          >
            <option value="">სერვისი და ნივთი</option>
            <option value={ListingType.Service}>სერვისი</option>
            <option value={ListingType.Item}>ნივთი</option>
          </select>
        </label>
      </section>

      <section className="marketplace-list-section" aria-labelledby="marketplaceListTitle">
        <div className="section-heading">
          <div>
            <p className="section-kicker">ცოცხალი ლისტინგები</p>
            <h2 id="marketplaceListTitle">სერვისები და ნივთები</h2>
          </div>
        </div>

        {error && <div className="status-text status-error">{error}</div>}

        {loading ? (
          <div className="marketplace-empty">იტვირთება…</div>
        ) : items.length === 0 ? (
          <div className="marketplace-empty">ამ ფილტრებით ლისტინგი ვერ მოიძებნა.</div>
        ) : (
          <>
            <div className="marketplace-grid">
              {items.map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`} className="marketplace-card">
                  {listing.images[0] && (
                    <div
                      className="marketplace-card-cover"
                      style={{ backgroundImage: `url(${listing.images[0].url})` }}
                    />
                  )}

                  <div className="marketplace-card-top">
                    <span className="service-tag">{listing.type === ListingType.Service ? 'სერვისი' : 'ნივთი'}</span>
                    <div className="marketplace-card-actions">
                      <strong>
                        {listing.startingPriceWaveCoin ?? '—'} WC{listing.type === ListingType.Service ? '-დან' : ''}
                      </strong>
                    </div>
                  </div>

                  <h3>{listing.title}</h3>

                  <div className="marketplace-card-meta">
                    <span className="avatar avatar-blue">{listing.category.name[0]}</span>
                    <span>
                      {listing.category.name}
                      {listing.game && ` · ${listing.game.name}`}
                    </span>
                    {listing.ratingCount > 0 ? (
                      <span className="rating-pill">★ {listing.ratingAvg}</span>
                    ) : (
                      <span className="rating-pill" style={{ color: 'var(--text-secondary)' }}>
                        —
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            <div className="filter-bar" style={{ marginTop: 24, justifyContent: 'center' }}>
              <button
                className="button"
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                წინა
              </button>
              <button
                className="button"
                type="button"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                შემდეგი
              </button>
            </div>
          </>
        )}
      </section>
    </Layout>
  )
}
