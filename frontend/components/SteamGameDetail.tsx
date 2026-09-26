/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import type { PublicListingDetail, PublicListingSummary, PublicReview } from '@wavehub/shared-types'
import { ListingType, STEAM_GENRES } from '@wavehub/shared-types'
import Layout from './Layout'
import { TRAILER_URL } from './SteamFactsFields'
import { api } from '../lib/api'
import { useCart } from '../lib/cart'
import { gameCover } from '../lib/games'

// docs/design-mockups/05-steam-game-detail.jpg for a digital-key listing: breadcrumb, gallery
// (arrows, counter, thumbnails, trailer link), buy box (badges, title, tagline, rating + sold, price
// with the seller's "was" price, facts grid, Buy Now / Add to Cart, wishlist / share), the four
// tabs and "You may also like". Every fact is real: rating/reviews and "sold" come from completed
// orders, stock is the live unsold-key count, tagline/region/edition/language/trailer are what the
// seller entered (unset → "Not specified"), and the discount only appears when the seller set a
// "was" price above the real one (the API refuses anything else).

const GENRE_LABEL = Object.fromEntries(STEAM_GENRES)

const I: Record<string, ReactNode> = {
  steam: <><circle cx="12" cy="12" r="9" /><circle cx="15" cy="9.5" r="2.5" /><path d="m3.5 14 5 2a2.5 2.5 0 1 0 4-2.5l1.5-2" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  shield: <><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  box: <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18M4 7.5l8 4.5 8-4.5" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />,
  edition: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  lang: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h6M10 9v7M15 16l2-5 2 5m-3.3-1.5h2.6" /></>,
  cart: <><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6" /><circle cx="9" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></>,
  heart: <path d="M12 20s-7-4.5-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.5-9 9-9 9Z" />,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  warn: <path d="M12 3 2 20h20L12 3Zm0 6v5m0 3h.01" />,
  play: <path d="m9 7 8 5-8 5V7Z" />,
  left: <path d="m15 6-6 6 6 6" />,
  right: <path d="m9 6 6 6-6 6" />,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
}
const Icon = ({ name, className }: { name: string; className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    {I[name]}
  </svg>
)

type Tab = 'overview' | 'activation' | 'requirements' | 'reviews'

export default function SteamGameDetail({
  listing,
  reviews,
  saved,
  purchasing,
  status,
  isOwnListing,
  notEnoughBalance,
  onBuy,
  onFavorite,
  onShare,
}: {
  listing: PublicListingDetail
  reviews: PublicReview[]
  saved: boolean
  purchasing: boolean
  status: { kind: '' | 'error' | 'success'; text: string }
  isOwnListing: boolean
  notEnoughBalance: boolean
  onBuy: () => void
  onFavorite: () => void
  onShare: () => void
}) {
  const cart = useCart()
  const [tab, setTab] = useState<Tab>('overview')
  const [index, setIndex] = useState(0)
  const [related, setRelated] = useState<PublicListingSummary[]>([])
  const attrs = listing.itemAttributes ?? {}
  const text = (key: string) => (attrs[key] === undefined || attrs[key] === null || attrs[key] === '' ? null : String(attrs[key]))
  const genre = text('genre')

  useEffect(() => {
    let cancelled = false
    const load = (withGenre: boolean) =>
      api.browseListings({ type: ListingType.DigitalKey, genre: withGenre && genre ? genre : undefined, sort: 'popular', limit: 11 }).then((res) => res.items.filter((l) => l.id !== listing.id))
    load(true)
      .then(async (rows) => (rows.length >= 3 || !genre ? rows : [...rows, ...(await load(false)).filter((r) => !rows.some((x) => x.id === r.id))]))
      .then((rows) => {
        if (!cancelled) setRelated(rows.slice(0, 10))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [listing.id, genre])

  const fallbackCover = gameCover(listing.game?.slug)
  const gallery = listing.images.length ? listing.images.map((img) => img.url) : fallbackCover ? [fallbackCover] : []
  const hero = gallery[index] ?? null
  const price = listing.priceWaveCoin ?? 0
  const compareAt = typeof attrs.compareAtPrice === 'number' && attrs.compareAtPrice > price ? attrs.compareAtPrice : null
  const discount = compareAt ? Math.round((1 - price / compareAt) * 100) : 0
  const inStock = (listing.stockQuantity ?? 0) > 0
  const rating = listing.ratingAvg ? Number(listing.ratingAvg) : null
  const trailer = text('trailerUrl')
  const trailerOk = trailer && TRAILER_URL.test(trailer) ? trailer : null
  const inCart = cart.has(listing.id)
  const NS = 'Not specified'

  const facts: Array<[icon: string, label: string, value: ReactNode, tone?: string]> = [
    ['steam', 'პლატფორმა', 'Steam'],
    ['refresh', 'მიწოდება', 'მყისიერი'],
    ['globe', 'რეგიონი', text('region') ?? NS],
    ['box', 'მარაგი', inStock ? `მარაგშია (${listing.stockQuantity})` : 'ამოიწურა', inStock ? 'green' : 'red'],
    ['edition', 'გამოცემა', text('edition') ?? NS],
    ['lang', 'ენა', text('language') ?? NS],
  ]

  const addToCart = () =>
    cart.add({
      listingId: listing.id,
      title: listing.title,
      priceWaveCoin: price,
      imageUrl: gallery[0] ?? null,
      gameName: listing.game?.name ?? null,
      sellerUsername: listing.seller.username,
      type: 'digital_key',
    })

  const step = (dir: 1 | -1) => setIndex((i) => (gallery.length ? (i + dir + gallery.length) % gallery.length : 0))

  return (
    <Layout title={listing.title} description={listing.description.slice(0, 160)}>
      <section className="sd-page">
        <nav className="sd-crumbs" aria-label="ნავიგაცია">
          <Link href="/">მთავარი</Link>
          <Icon name="right" />
          <Link href="/marketplace">თამაშები</Link>
          <Icon name="right" />
          <Link href="/steam-keys">Steam თამაშები</Link>
          <Icon name="right" />
          <span>{listing.title}</span>
        </nav>

        <section className="sd-top">
          <div className="sd-gallery">
            <div className="sd-hero" style={hero ? { backgroundImage: `url('${hero}')` } : undefined}>
              {!hero && <img className="sd-hero-logo" src="/assets/steam-logo.png" alt="" />}
              {gallery.length > 1 && (
                <>
                  <span className="sd-counter">
                    {index + 1} / {gallery.length}
                  </span>
                  <button type="button" className="sd-arrow prev" aria-label="წინა ფოტო" onClick={() => step(-1)}>
                    <Icon name="left" />
                  </button>
                  <button type="button" className="sd-arrow next" aria-label="შემდეგი ფოტო" onClick={() => step(1)}>
                    <Icon name="right" />
                  </button>
                </>
              )}
              {trailerOk && (
                <a className="sd-trailer" href={trailerOk} target="_blank" rel="noopener noreferrer nofollow">
                  <span>
                    <Icon name="play" />
                  </span>
                  ტრეილერის ნახვა
                </a>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="sd-thumbs">
                {gallery.slice(0, 6).map((url, i) => (
                  <button key={url} type="button" className={i === index ? 'active' : undefined} style={{ backgroundImage: `url('${url}')` }} aria-label={`ფოტო ${i + 1}`} onClick={() => setIndex(i)}></button>
                ))}
              </div>
            )}
          </div>

          <article className="sd-buy">
            <div className="sd-badges">
              <span>
                <img src="/assets/steam-logo.png" alt="" /> STEAM KEY
              </span>
              <span className={inStock ? 'green' : 'red'}>
                <i aria-hidden="true"></i>
                {inStock ? 'მარაგშია' : 'ამოიწურა'}
              </span>
              <span>
                <Icon name="bolt" className="pink" /> მყისიერი მიწოდება
              </span>
              {genre && <span>{GENRE_LABEL[genre] ?? genre}</span>}
            </div>
            <h1>{listing.title}</h1>
            <p className="sd-tagline">{text('tagline') ?? listing.game?.name ?? 'Steam'}</p>
            <p className="sd-rating">
              {rating !== null ? (
                <>
                  <Icon name="star" className="gold" /> {rating.toFixed(1)} <small>({listing.ratingCount} შეფასება)</small>
                </>
              ) : (
                <small>შეფასებები ჯერ არ არის</small>
              )}
              <i aria-hidden="true"></i>
              <small>{listing.ordersCount} გაყიდული</small>
            </p>
            <div className="sd-price">
              <strong>{price} GEL</strong>
              {compareAt && (
                <>
                  <b>-{discount}%</b>
                  <s>{compareAt} GEL</s>
                </>
              )}
            </div>
            <dl className="sd-facts">
              {facts.map(([icon, label, value, tone]) => (
                <div key={label}>
                  <dt>
                    <Icon name={icon} />
                    {label}
                  </dt>
                  <dd className={tone}>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="sd-actions">
              <button type="button" className="primary" disabled={purchasing || !inStock || isOwnListing} onClick={onBuy}>
                <Icon name="cart" />
                {purchasing ? 'მუშავდება…' : isOwnListing ? 'თქვენი განცხადება' : 'ახლავე ყიდვა'}
              </button>
              <button type="button" disabled={!inStock || isOwnListing || inCart} onClick={addToCart}>
                <Icon name="cart" />
                {inCart ? 'კალათაშია ✓' : 'კალათაში დამატება'}
              </button>
            </div>
            <div className="sd-secondary">
              <button type="button" aria-pressed={saved} className={saved ? 'on' : undefined} onClick={onFavorite}>
                <Icon name="heart" />
                {saved ? 'სურვილებშია' : 'სურვილებში დამატება'}
              </button>
              <button type="button" onClick={onShare}>
                <Icon name="share" /> გაზიარება
              </button>
            </div>
            {notEnoughBalance && !isOwnListing && inStock && (
              <p className="seller-status error">
                ბალანსი არ არის საკმარისი — <Link href="/wallet">შეავსეთ საფულე</Link>.
              </p>
            )}
            {status.text && (
              <p className={`seller-status ${status.kind}`} role={status.kind === 'error' ? 'alert' : undefined}>
                {status.text}
              </p>
            )}
            <p className="sd-seller">
              გამყიდველი: <Link href={`/u/${listing.seller.username}`}>@{listing.seller.username}</Link>
            </p>
          </article>
        </section>

        <section className="sd-info">
          <nav>
            {(
              [
                ['overview', 'მიმოხილვა'],
                ['activation', 'აქტივაციის ინსტრუქცია'],
                ['requirements', 'სისტემური მოთხოვნები'],
                ['reviews', `შეფასებები (${listing.ratingCount})`],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" className={tab === key ? 'active' : undefined} aria-pressed={tab === key} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </nav>
          <div className={`sd-info-grid${tab === 'overview' ? '' : ' single'}`}>
            {tab === 'overview' && (
              <>
                <article>
                  <h2>თამაშის შესახებ</h2>
                  <p style={{ whiteSpace: 'pre-line' }}>{listing.description}</p>
                </article>
                <article>
                  <h2>რას მიიღებთ</h2>
                  <ul className="sd-list">
                    <li>
                      <Icon name="check" /> Steam-ის აქტივაციის გასაღები
                    </li>
                    <li>
                      <Icon name="check" /> {text('edition') ?? listing.title}
                    </li>
                    <li>
                      <Icon name="check" /> მყისიერი მიწოდება WaveHubX-ზე
                    </li>
                  </ul>
                </article>
                <article>
                  <h2>როგორ ხდება აქტივაცია</h2>
                  <ol className="sd-steps">
                    <li>
                      <b>1</b> გადაიხადეთ WaveCoin-ით
                    </li>
                    <li>
                      <b>2</b> გასაღებს მაშინვე მიიღებთ შეკვეთის გვერდზე
                    </li>
                    <li>
                      <b>3</b> გაააქტიურეთ Steam-ზე და ისიამოვნეთ
                    </li>
                  </ol>
                </article>
                <article>
                  <h2>მნიშვნელოვანი ინფორმაცია</h2>
                  <ul className="sd-list warn">
                    <li>
                      <Icon name="warn" /> რეგიონი: {text('region') ?? 'გამყიდველს არ მიუთითებია — გადაამოწმეთ ყიდვამდე'}.
                    </li>
                    <li>
                      <Icon name="warn" /> გასაღების ნახვის ან აქტივაციის შემდეგ თანხა არ ბრუნდება.
                    </li>
                    <li>
                      <Icon name="warn" /> მიწოდება ხდება თქვენი WaveHubX შეკვეთის გვერდზე.
                    </li>
                  </ul>
                </article>
              </>
            )}
            {tab === 'activation' && (
              <article>
                <h2>აქტივაციის ინსტრუქცია</h2>
                <ol className="sd-steps">
                  <li>
                    <b>1</b> გახსენით Steam-ის აპლიკაცია და შედით ანგარიშზე.
                  </li>
                  <li>
                    <b>2</b> მენიუში აირჩიეთ „Games“ → „Activate a Product on Steam…“.
                  </li>
                  <li>
                    <b>3</b> ჩასვით შეკვეთის გვერდზე მიღებული გასაღები და დაადასტურეთ.
                  </li>
                  <li>
                    <b>4</b> თამაში დაემატება თქვენს ბიბლიოთეკას.
                  </li>
                </ol>
              </article>
            )}
            {tab === 'requirements' && (
              <article>
                <h2>სისტემური მოთხოვნები</h2>
                <p>სისტემური მოთხოვნები იხილეთ თამაშის ოფიციალურ Steam-ის გვერდზე — ისინი განსხვავდება თამაშისა და გამოცემის მიხედვით.</p>
              </article>
            )}
            {tab === 'reviews' && (
              <article>
                <h2>შეფასებები</h2>
                {reviews.length === 0 ? (
                  <p>შეფასებები ჯერ არ არის — შეფასებას მხოლოდ მყიდველები ტოვებენ დასრულებული შეკვეთის შემდეგ.</p>
                ) : (
                  <ul className="sd-reviews">
                    {reviews.map((review) => (
                      <li key={review.id}>
                        <span className="gold">
                          {'★'.repeat(review.rating)}
                          {'☆'.repeat(5 - review.rating)}
                        </span>
                        <strong>@{review.buyer.username}</strong>
                        <p>{review.body || 'კომენტარის გარეშე'}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )}
          </div>
        </section>

        {related.length > 0 && (
          <section className="sd-related">
            <header>
              <h2>შეიძლება მოგეწონოს</h2>
              <Link href="/steam-keys">
                ყველას ნახვა <Icon name="right" />
              </Link>
            </header>
            <div className="sd-related-track">
              {related.map((item) => {
                const cover = item.images[0]?.url ?? gameCover(item.game?.slug)
                const tagline = item.itemAttributes?.tagline
                return (
                  <Link key={item.id} className="sd-related-card" href={`/listings/${item.id}`}>
                    <span style={cover ? { backgroundImage: `url('${cover}')` } : undefined}></span>
                    <strong>{item.title}</strong>
                    <small>{tagline ? String(tagline) : item.game?.name ?? 'Steam'}</small>
                    <b>{item.priceWaveCoin ?? item.startingPriceWaveCoin} GEL</b>
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </section>
    </Layout>
  )
}
