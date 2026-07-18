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
      <div className="page">
        <div className="page-inner">
          <h1 className="page-title">მარკეტფლეისი</h1>
          <p className="page-subtitle">იპოვე სერვისები და ნივთები გამოცდილი გამყიდველებისგან</p>

          <div className="filter-bar">
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
          </div>

          {error && <div className="status-text status-error">{error}</div>}

          {loading ? (
            <div className="empty-state">იტვირთება…</div>
          ) : items.length === 0 ? (
            <div className="empty-state">ამ ფილტრებით ლისტინგი ვერ მოიძებნა.</div>
          ) : (
            <>
              <div className="listing-grid">
                {items.map((listing) => (
                  <Link key={listing.id} href={`/listings/${listing.id}`} className="listing-card">
                    <div className="listing-card-image">
                      {listing.images[0] ? (
                        <img src={listing.images[0].url} alt={listing.title} />
                      ) : (
                        <span>სურათი არ არის</span>
                      )}
                    </div>
                    <div className="listing-card-body">
                      <div className="listing-card-meta">
                        <span>{listing.category.name}</span>
                        {listing.game && <span>· {listing.game.name}</span>}
                        {listing.isFeatured && <span className="badge badge-featured">გამორჩეული</span>}
                      </div>
                      <p className="listing-card-title">{listing.title}</p>
                      <div className="listing-card-seller">@{listing.seller.username}</div>
                      <div className="listing-card-footer">
                        {listing.ratingCount > 0 ? (
                          <span className="rating-pill">★ {listing.ratingAvg}</span>
                        ) : (
                          <span className="rating-pill" style={{ color: 'var(--text-secondary)' }}>
                            შეფასების გარეშე
                          </span>
                        )}
                        <span className="price-tag">
                          {listing.startingPriceWaveCoin ?? '—'}
                          <small> WC-დან</small>
                        </span>
                      </div>
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
        </div>
      </div>
    </Layout>
  )
}
