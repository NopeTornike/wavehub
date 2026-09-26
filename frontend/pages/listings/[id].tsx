import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicListingDetail, PublicReview } from '@wavehub/shared-types'
import { ListingType } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import SteamGameDetail from '../../components/SteamGameDetail'
import { accountStatusLabel, listingKind } from '../../components/ProductCard'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useFavorites } from '../../lib/favorites'
import { GAME_ART } from '../../lib/games'
import GAME_DETAILS from '../../lib/game-details.json'

// The prototype's detail.html (detail.js), section for section: back link, breadcrumb, title with
// the game's title icon, About card, the game-specific details grid, Access & Delivery, Linked
// accounts, gallery, reviews, the buy panel (price + share, stock/seller lines, tags, the four
// score tiles, buy / wishlist / message) and the seller strip. All real:
//   - scores: the listing's real review average, favourite count and completed orders
//     (listings.ordersCount is bumped on completion); response time isn't tracked, so it says
//     "Not specified" exactly like the prototype does when a seller hasn't set one
//   - the game-specific and access grids read the seller-entered item attributes; the field labels
//     come from the same extracted definitions the seller form uses
//   - gallery = the game's cover art followed by the listing's real uploaded photos
//   - buy = a real escrow order (service listings pick a package and fill the requirements form
//     first — the prototype has no services); wishlist = real favourite; Message Seller opens a
//     real direct conversation (the backend only allows it once the two have transacted, and says so)
//   - share uses the device share sheet, falling back to copying the link
/* eslint-disable @next/next/no-img-element */

type DetailField = { id: string; label: string }
const DETAIL_FIELDS = GAME_DETAILS as unknown as Record<string, { title: string; fields: DetailField[] }>

const ACCESS_FIELDS: Array<{ key: string; label: string; format?: (v: unknown) => string }> = [
  { key: 'loginMethod', label: 'Login Method' },
  { key: 'emailChangeable', label: 'Email Changeable', format: (v) => (v ? 'Yes' : 'No') },
  { key: 'originalEmail', label: 'Original Email Available', format: (v) => (v ? 'Yes' : 'No') },
  { key: 'fullAccess', label: 'Full Access Provided', format: (v) => (v ? 'Yes' : 'No') },
  {
    key: 'twoFactor',
    label: 'Two-Factor Authentication',
    format: (v) => (v === 'enabled' ? 'Enabled' : v === 'disabled' ? 'Disabled' : v === 'removable' ? 'Enabled, removable' : String(v)),
  },
  { key: 'deliveryMethod', label: 'Delivery Method' },
  { key: 'deliveryTime', label: 'Delivery Time' },
]

function initials(first?: string, last?: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?'
}

export default function ListingDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me, refresh } = useAuth()
  const { isFavorite, toggle } = useFavorites()

  const [listing, setListing] = useState<PublicListingDetail | null>(null)
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [sort, setSort] = useState<'newest' | 'highest' | 'lowest'>('newest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requirementAnswers, setRequirementAnswers] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })
  const [purchasing, setPurchasing] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  const [favoriteCount, setFavoriteCount] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    // Refetch when the route param changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .getListing(id)
      .then((data) => {
        if (cancelled) return
        setListing(data)
        setFavoriteCount(data.favoriteCount)
        setSelectedPackageId(data.packages[0]?.id ?? null)
        setImageIndex(0)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'ლისტინგის ჩატვირთვა ვერ მოხერხდა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    api
      .listReviewsForListing(id, sort)
      .then((data) => {
        if (!cancelled) setReviews(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [id, sort])

  if (loading || error || !listing) {
    return (
      <Layout title={loading ? 'განცხადება' : 'განცხადება ვერ მოიძებნა'} noIndex={!loading}>
        <section className="detail-page">
          <div className="marketplace-empty" id="detailEmpty">
            {loading ? 'იტვირთება…' : error || 'Offer not found.'}
          </div>
        </section>
      </Layout>
    )
  }

  const kind = listingKind(listing)
  const attrs = listing.itemAttributes ?? {}
  const slug = listing.game?.slug ?? ''
  const art = GAME_ART[slug]
  const gallery = [...(art ? [{ key: 'cover', url: art.cover, label: listing.game?.name ?? '' }] : []), ...listing.images.map((img, i) => ({ key: img.id, url: img.url, label: `${i + 1}` }))]
  const hero = gallery[imageIndex] ?? gallery[0]
  const selectedPackage = listing.packages.find((pkg) => pkg.id === selectedPackageId) ?? null
  const price = listing.type === ListingType.Service ? selectedPackage?.priceWaveCoin ?? null : listing.priceWaveCoin
  const sellerName = [listing.seller.firstName, listing.seller.lastName].filter(Boolean).join(' ') || listing.seller.username
  const kindLabel = kind === 'account' ? 'Account' : kind === 'skin' ? 'Skin' : kind === 'service' ? 'Service' : 'Steam Key'
  const tag =
    kind === 'account' ? accountStatusLabel(attrs.accountStatus) : kind === 'skin' ? 'სკინი' : kind === 'service' ? listing.category.name : 'Steam გასაღები'
  const delivery =
    kind === 'service'
      ? selectedPackage
        ? `${selectedPackage.deliveryTimeDays} დღე`
        : null
      : kind === 'key'
        ? 'მყისიერი'
        : attrs.deliveryTime
          ? String(attrs.deliveryTime)
          : 'მყისიერი'
  const inStock = kind === 'service' ? true : (listing.stockQuantity ?? 0) > 0
  const rating = listing.ratingAvg ? Number(listing.ratingAvg) : null
  const saved = isFavorite(listing.id)
  const isOwnListing = me?.id === listing.seller.id
  const missingRequirement =
    listing.type === ListingType.Service
      ? (listing.requirementsSchema ?? []).find((field) => field.required && !(requirementAnswers[field.key] ?? '').trim())
      : undefined
  const notEnoughBalance = !!me && price !== null && me.wavecoinBalance < price
  const detailForm = DETAIL_FIELDS[slug]
  const gameSpecific = detailForm ? detailForm.fields.filter((f) => attrs[f.id] !== undefined && attrs[f.id] !== '').map((f) => [f.label, attrs[f.id]] as const) : []
  const platformRegion = [attrs.platform, attrs.region].filter(Boolean).join(' / ')

  const buy = async () => {
    setStatus({ kind: '', text: '' })
    if (!me) {
      router.push(`/login?next=/listings/${listing.id}`)
      return
    }
    if (missingRequirement) {
      setStatus({ kind: 'error', text: `შეავსეთ სავალდებულო ველი: ${missingRequirement.label}` })
      return
    }
    setPurchasing(true)
    try {
      const order = await api.purchase({
        listingId: listing.id,
        packageId: listing.type === ListingType.Service ? selectedPackageId ?? undefined : undefined,
        requirementsAnswers: listing.type === ListingType.Service ? requirementAnswers : undefined,
      })
      // The purchase debits the balance — refresh the session before leaving so the topbar is current.
      await refresh()
      router.push(`/orders/${order.id}`)
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'შეკვეთის გაფორმება ვერ მოხერხდა.') })
      setPurchasing(false)
    }
  }

  const toggleFavorite = async () => {
    const next = await toggle(listing.id)
    if (next !== null) setFavoriteCount(next)
  }

  const messageSeller = async () => {
    if (!me) {
      router.push(`/login?next=/listings/${listing.id}`)
      return
    }
    try {
      const conversation = await api.startDirectConversation(listing.seller.id)
      router.push(`/messages?conversation=${conversation.id}`)
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'შეტყობინების გაგზავნა ვერ მოხერხდა.') })
    }
  }

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url })
      else {
        await navigator.clipboard.writeText(url)
        setStatus({ kind: 'success', text: 'ბმული დაკოპირდა.' })
      }
    } catch {
      // share sheet dismissed — nothing to do
    }
  }

  if (listing.type === ListingType.DigitalKey) {
    return (
      <SteamGameDetail
        listing={listing}
        reviews={reviews}
        saved={saved}
        purchasing={purchasing}
        status={status}
        isOwnListing={isOwnListing}
        notEnoughBalance={notEnoughBalance}
        onBuy={() => void buy()}
        onFavorite={() => void toggleFavorite()}
        onShare={() => void share()}
      />
    )
  }

  return (
    <Layout title={listing.title} description={listing.description.slice(0, 160)}>
      <section className="detail-page">
        <Link
          className="detail-back-link"
          id="detailBackLink"
          href="/marketplace"
          onClick={(event) => {
            if (window.history.length > 1) {
              event.preventDefault()
              router.back()
            }
          }}
        >
          უკან
        </Link>

        <article className="detail-layout" id="detailLayout">
          <div className="detail-main">
            <nav className="detail-breadcrumb" id="detailBreadcrumb" aria-label="Product path">
              <Link href="/">Home</Link> / <Link href="/marketplace">Marketplace</Link>
              {listing.game && (
                <>
                  {' '}
                  / <Link href={`/marketplace?game=${listing.game.slug}`}>{listing.game.name}</Link>
                </>
              )}{' '}
              / {kindLabel} / {listing.title}
            </nav>

            <div className="detail-title-block">
              <p className="section-kicker" id="detailKicker">
                {kindLabel} detail
              </p>
              <div className="detail-heading-row">
                {art && <img className="detail-title-game-icon" id="detailTitleGameIcon" src={art.icon} alt={`${listing.game?.name} icon`} />}
                <h1 id="detailTitle">{listing.title}</h1>
              </div>
              <p className="detail-lead" id="detailDescription">
                {listing.description}
              </p>
            </div>

            <div className="detail-tab-panels">
              <section className="detail-tab-panel detail-info-grid" id="detailOverview">
                <section className="detail-section detail-summary-card" aria-labelledby="detailInfoTitle">
                  <h2 id="detailInfoTitle">About This {kindLabel}</h2>
                  <p id="detailLongDescription" style={{ whiteSpace: 'pre-line' }}>
                    {listing.description}
                  </p>
                </section>
              </section>

              <section className="detail-tab-panel detail-info-grid" id="detailDetails">
                {gameSpecific.length > 0 && (
                  <section className="detail-section detail-game-specific-card" id="detailGameSpecific" aria-labelledby="detailGameSpecificTitle">
                    <h2 id="detailGameSpecificTitle">{listing.game?.name} Details</h2>
                    <div className="detail-meta-grid detail-game-specific-grid" id="detailGameSpecificGrid">
                      {gameSpecific.map(([label, value]) => (
                        <div key={label}>
                          <span>{label}</span>
                          <strong>{String(value)}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {kind === 'account' && (
                  <section className="detail-section detail-access-card" id="detailAccessCard" aria-labelledby="detailAccessTitle">
                    <h2 id="detailAccessTitle">Access &amp; Delivery</h2>
                    <div className="detail-facts-grid" id="detailAccessGrid">
                      {ACCESS_FIELDS.map((field) => {
                        const value = attrs[field.key]
                        const shown = value === undefined || value === '' ? 'Not specified' : field.format ? field.format(value) : String(value)
                        return (
                          <div key={field.key}>
                            <span>{field.label}</span>
                            <strong>{shown}</strong>
                          </div>
                        )
                      })}
                      <div>
                        <span>Platform / Region</span>
                        <strong>{platformRegion || 'Not specified'}</strong>
                      </div>
                    </div>
                  </section>
                )}

                {attrs.linkedAccounts && (
                  <section className="detail-section detail-linked-card" id="detailLinkedCard" aria-labelledby="detailLinkedTitle">
                    <h2 id="detailLinkedTitle">Linked Accounts</h2>
                    <div className="detail-linked-grid" id="detailLinkedGrid">
                      {String(attrs.linkedAccounts)
                        .split(',')
                        .map((part) => part.trim())
                        .filter(Boolean)
                        .map((account) => (
                          <span key={account}>{account}</span>
                        ))}
                    </div>
                  </section>
                )}

                {kind === 'service' && listing.packages.length > 0 && (
                  <section className="detail-section detail-included-card" aria-labelledby="detailPackagesTitle">
                    <h2 id="detailPackagesTitle">პაკეტები</h2>
                    <div className="package-list">
                      {listing.packages.map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          className={`package-option${selectedPackageId === pkg.id ? ' selected' : ''}`}
                          aria-pressed={selectedPackageId === pkg.id}
                          onClick={() => setSelectedPackageId(pkg.id)}
                        >
                          <div className="package-option-head">
                            <span>{pkg.name}</span>
                            <span>{pkg.priceWaveCoin} GEL</span>
                          </div>
                          <div className="note" style={{ margin: '4px 0 0' }}>
                            მიწოდება {pkg.deliveryTimeDays} დღეში · {pkg.revisionsIncluded} რევიზია
                          </div>
                          {pkg.features.length > 0 && (
                            <ul>
                              {pkg.features.map((feature) => (
                                <li key={feature}>{feature}</li>
                              ))}
                            </ul>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {listing.faq && listing.faq.length > 0 && (
                  <section className="detail-section detail-summary-card">
                    <h2>ხშირად დასმული კითხვები</h2>
                    {listing.faq.map((entry, index) => (
                      <div key={index} style={{ marginBottom: 10 }}>
                        <strong>{entry.q}</strong>
                        <p style={{ margin: '4px 0 0' }}>{entry.a}</p>
                      </div>
                    ))}
                  </section>
                )}
              </section>

              <section className="detail-tab-panel detail-combined-section" id="detailGallery">
                <h2 className="detail-combined-title">Gallery</h2>
                <section className="detail-gallery-card" aria-label="Product gallery">
                  <div
                    className={`detail-hero-image${hero?.key === 'cover' ? ' game-cover-contain' : ''}`}
                    id="detailHeroImage"
                    data-label={listing.game?.name ?? ''}
                    style={hero ? { backgroundImage: `linear-gradient(rgba(5, 8, 19, 0.03), rgba(5, 8, 19, 0.22)), url("${hero.url}")` } : undefined}
                  >
                    <div className="detail-hero-badges">
                      <span className={`service-tag ${kind === 'account' ? 'account' : kind === 'skin' ? 'skin' : 'hot'}`} id="detailHeroTag">
                        {kind === 'account' && (
                          <svg className="service-tag-account-icon" viewBox="0 0 16 16" aria-hidden="true">
                            <circle cx="8" cy="5" r="3" fill="currentColor" />
                            <path d="M2 15a6 6 0 0 1 12 0H2Z" fill="currentColor" />
                          </svg>
                        )}
                        <span id="detailHeroTagText">{tag}</span>
                      </span>
                      {delivery && (
                        <span className="detail-delivery-chip" id="detailHeroDelivery">
                          {delivery}
                        </span>
                      )}
                    </div>
                    <button
                      className={`detail-hero-save${saved ? ' saved' : ''}`}
                      id="detailSaveButton"
                      type="button"
                      aria-label="Add to wishlist"
                      aria-pressed={saved}
                      title="Add to wishlist"
                      onClick={() => void toggleFavorite()}
                    ></button>
                    {gallery.length > 0 && (
                      <span className="detail-gallery-count" id="detailGalleryCount">
                        {imageIndex + 1} / {gallery.length}
                      </span>
                    )}
                  </div>
                  {gallery.length > 1 && (
                    <div className="detail-thumbnails" id="detailThumbnails" aria-label="Product thumbnails">
                      {gallery.map((image, index) => (
                        <button
                          key={image.key}
                          type="button"
                          className={`detail-thumbnail${image.key === 'cover' ? ' game-cover-contain' : ''}${index === imageIndex ? ' active' : ''}`}
                          aria-label={`Show ${image.label}`}
                          aria-pressed={index === imageIndex}
                          onClick={() => setImageIndex(index)}
                          style={{ backgroundImage: `linear-gradient(rgba(5, 8, 19, 0.02), rgba(5, 8, 19, 0.22)), url("${image.url}")` }}
                        >
                          <span>{image.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </section>

              <section className="detail-tab-panel detail-section detail-reviews-card" id="detailReviews" aria-labelledby="detailReviewsTitle">
                <h2 id="detailReviewsTitle">შეფასებები</h2>
                <div className="detail-review-summary" id="detailReviewSummary">
                  {rating !== null && listing.ratingCount > 0
                    ? `${rating.toFixed(1)}/5 from ${listing.ratingCount} ${listing.ratingCount === 1 ? 'review' : 'reviews'}`
                    : 'No reviews yet for this product.'}
                </div>
                {reviews.length > 1 && (
                  <label className="detail-review-sort">
                    <span className="sr-only">შეფასებების დალაგება</span>
                    <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                      <option value="newest">უახლესი</option>
                      <option value="highest">უმაღლესი შეფასება</option>
                      <option value="lowest">უდაბლესი შეფასება</option>
                    </select>
                  </label>
                )}
                <div className="detail-review-list" id="detailReviewList">
                  {reviews.map((review) => {
                    const stars = Math.max(0, Math.min(5, Math.round(review.rating)))
                    return (
                      <article key={review.id} className="public-review-card">
                        <div className="public-review-head">
                          <Link className="public-review-reviewer" href={`/u/${review.buyer.username}`} aria-label={`Open ${review.buyer.username} profile`}>
                            <span className="message-avatar">{review.buyer.username[0]?.toUpperCase()}</span>
                            <strong>{review.buyer.username}</strong>
                          </Link>
                          <span className="public-review-rating">
                            {'★'.repeat(stars)}
                            {'☆'.repeat(5 - stars)}
                          </span>
                          <small>{new Date(review.createdAt).toLocaleDateString('ka-GE', { year: 'numeric', month: 'short', day: 'numeric' })}</small>
                        </div>
                        <span className="public-review-item">About: {listing.title}</span>
                        <p>{review.body || 'No written comment.'}</p>
                        {review.sellerReply && (
                          <p className="seller-reply">
                            <strong>გამყიდველის პასუხი:</strong> {review.sellerReply}
                          </p>
                        )}
                      </article>
                    )
                  })}
                </div>
                <div className="marketplace-empty" id="detailReviewsEmpty" hidden={reviews.length > 0}>
                  No reviews yet.
                </div>
              </section>
            </div>
          </div>

          <aside className="detail-buy-panel" aria-label="Buy offer">
            <div className="detail-buy-head">
              <strong id="detailPrice">{price !== null ? `${price} GEL` : '—'}</strong>
              <button className="detail-share-button" type="button" aria-label="Share product" onClick={() => void share()}>
                გაზიარება
              </button>
            </div>
            <div className="detail-stock-lines">
              <span>
                <i></i> {inStock ? 'მარაგშია' : 'ამოიწურა'}
              </span>
              <span>
                <i></i> Sold by <strong id="detailSoldBy">{sellerName}</strong>
              </span>
            </div>
            <div className="detail-buy-tags">
              <span className={`service-tag ${kind === 'account' ? 'account' : kind === 'skin' ? 'skin' : 'hot'}`} id="detailTag">
                {tag}
              </span>
              {delivery && (
                <span className="detail-delivery-chip" id="detailSideDelivery">
                  {delivery}
                </span>
              )}
            </div>
            <div className="detail-buy-scores" aria-label="Marketplace scores">
              <div className="detail-icon-score detail-rating-score">
                <img className="detail-score-icon" src="/assets/seller-rating-star-icon.png" alt="" aria-hidden="true" />
                <span>Product Rating</span>
                <strong id="detailSideSellerScore">{rating !== null && listing.ratingCount > 0 ? rating.toFixed(1) : '-'}</strong>
                <small id="detailSideSellerScoreLabel">{listing.ratingCount > 0 ? `${listing.ratingCount} reviews` : 'No rating'}</small>
              </div>
              <div className="detail-icon-score detail-favorites-score">
                <img className="detail-score-icon" src="/assets/favorites-score-icon.svg" alt="" aria-hidden="true" />
                <span>რჩეულები</span>
                <strong id="detailSideQualityScore">{favoriteCount}</strong>
                <small id="detailSideQualityScoreLabel">{favoriteCount === 1 ? 'saved' : 'saves'}</small>
              </div>
              <div className="detail-icon-score detail-completed-score">
                <img className="detail-score-icon" src="/assets/completed-orders-icon.svg" alt="" aria-hidden="true" />
                <span>Completed Orders</span>
                <strong id="detailCompletedOrders">{listing.ordersCount}</strong>
                <small>real orders</small>
              </div>
              <div className="detail-icon-score detail-response-score">
                <img className="detail-score-icon" src="/assets/avg-response-time-icon.svg" alt="" aria-hidden="true" />
                <span>Avg. Response Time</span>
                <strong id="detailResponseTime">Not specified</strong>
                <small>seller response</small>
              </div>
            </div>

            {kind === 'key' && (
              <p className="note">
                გასაღები ხელმისაწვდომი გახდება შეძენისთანავე. შესყიდვა საბოლოოა და არ ექვემდებარება გაუქმებას — პრობლემის შემთხვევაში მიმართეთ დავის განხილვას.
              </p>
            )}

            {kind === 'service' && listing.requirementsSchema && listing.requirementsSchema.length > 0 && (
              <div className="detail-requirements">
                <strong>შეავსეთ შეკვეთამდე</strong>
                {listing.requirementsSchema.map((field) => {
                  const value = requirementAnswers[field.key] ?? ''
                  const set = (next: string) => setRequirementAnswers((prev) => ({ ...prev, [field.key]: next }))
                  return (
                    <label key={field.key} className="field">
                      <span>
                        {field.label}
                        {field.required ? ' *' : ''}
                      </span>
                      {field.type === 'dropdown' ? (
                        <select aria-required={field.required} value={value} onChange={(e) => set(e.target.value)}>
                          <option value="">აირჩიეთ…</option>
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea aria-required={field.required} value={value} onChange={(e) => set(e.target.value)} />
                      ) : (
                        <input aria-required={field.required} type={field.type === 'number' ? 'number' : 'text'} value={value} onChange={(e) => set(e.target.value)} />
                      )}
                    </label>
                  )
                })}
              </div>
            )}

            {isOwnListing ? (
              <p className="note">ეს თქვენი განცხადებაა — საკუთარი განცხადების ყიდვა შეუძლებელია.</p>
            ) : (
              <>
                {notEnoughBalance && (
                  <p className="note">
                    თქვენი ბალანსია {me!.wavecoinBalance} WC — ამ შეძენისთვის არ გყოფნით. <Link href="/wallet">შეავსეთ საფულე</Link>
                  </p>
                )}
                <button
                  className="detail-buy-button"
                  id="buyButton"
                  type="button"
                  disabled={purchasing || !inStock || (kind === 'service' && !selectedPackageId)}
                  onClick={buy}
                >
                  {purchasing ? 'მიმდინარეობს…' : 'ახლავე ყიდვა'}
                </button>
              </>
            )}
            <div className="detail-secondary-actions">
              <button id="wishlistButton" type="button" aria-pressed={saved} title="Add to wishlist" onClick={() => void toggleFavorite()}>
                {saved ? 'რჩეულებშია ♥' : 'რჩეულებში დამატება'}
              </button>
              {!isOwnListing && (
                <button id="messageSellerButton" type="button" onClick={() => void messageSeller()}>
                  Message Seller
                </button>
              )}
            </div>
            <p className={`seller-status${status.kind ? ` ${status.kind}` : ''}`} id="buyStatus" aria-live="polite">
              {status.text}
            </p>
            <div className="detail-protection">
              <strong>WaveHub Protection</strong>
              <span>This order is protected by seller confirmation and WaveHub order history.</span>
            </div>
          </aside>

          <section className="detail-seller-strip" id="detailSellerStrip">
            <span className="detail-seller-avatar" id="detailSellerAvatar">
              {initials(listing.seller.firstName, listing.seller.lastName)}
            </span>
            <div>
              <strong id="detailSellerStripName">{sellerName}</strong>
              <small id="detailSellerStripMeta">
                {listing.sellerCompletedOrders} completed orders ·{' '}
                {listing.seller.sellerRatingCount > 0 ? `★ ${Number(listing.seller.sellerRatingAvg).toFixed(1)} (${listing.seller.sellerRatingCount} reviews)` : 'No reviews yet'}
              </small>
            </div>
            <Link id="detailSellerProfileButton" href={`/u/${listing.seller.username}`}>
              View Seller Profile →
            </Link>
          </section>
        </article>
      </section>
    </Layout>
  )
}
