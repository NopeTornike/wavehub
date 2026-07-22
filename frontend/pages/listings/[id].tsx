import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicListingDetail, PublicReview } from '@wavehub/shared-types'
import { ListingType } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export default function ListingDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me } = useAuth()

  const [listing, setListing] = useState<PublicListingDetail | null>(null)
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [sort, setSort] = useState<'newest' | 'highest' | 'lowest'>('newest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requirementAnswers, setRequirementAnswers] = useState<Record<string, string>>({})
  const [purchaseError, setPurchaseError] = useState('')
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    // See frontend/pages/marketplace.tsx for why this rule is disabled here — same
    // fetch-on-route-param-change pattern, not an external-system subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .getListing(id)
      .then((data) => {
        if (cancelled) return
        setListing(data)
        setSelectedPackageId(data.packages[0]?.id ?? null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'ლისტინგის ჩატვირთვა ვერ მოხერხდა.')
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

  if (loading) {
    return (
      <Layout>
        <div className="detail-page">
          <div className="marketplace-empty">იტვირთება…</div>
        </div>
      </Layout>
    )
  }

  if (error || !listing) {
    return (
      <Layout>
        <div className="detail-page">
          <div className="marketplace-empty">{error || 'ლისტინგი ვერ მოიძებნა.'}</div>
        </div>
      </Layout>
    )
  }

  const selectedPackage = listing.packages.find((pkg) => pkg.id === selectedPackageId) ?? null
  const displayPrice =
    listing.type === ListingType.Item ? listing.priceWaveCoin : selectedPackage?.priceWaveCoin ?? null

  return (
    <Layout>
      <div className="detail-page">
        <Link className="detail-back-link" href="/marketplace">
          ← მარკეტფლეისში დაბრუნება
        </Link>

        <div className="detail-layout">
          <div className="detail-main">
            <nav className="detail-breadcrumb">
              მარკეტფლეისი / {listing.category.name}
              {listing.game && ` / ${listing.game.name}`}
            </nav>

            <div className="detail-title-block">
              <p className="section-kicker">{listing.type === ListingType.Service ? 'სერვისის დეტალები' : 'ნივთის დეტალები'}</p>
              <h1>{listing.title}</h1>
              {listing.ratingCount > 0 && (
                <span className="rating-pill">
                  ★ {listing.ratingAvg} ({listing.ratingCount})
                </span>
              )}
            </div>

            <section className="detail-gallery-card">
              <div
                className="detail-hero-image"
                style={listing.images[0] ? { backgroundImage: `url(${listing.images[0].url})` } : undefined}
                data-label={listing.images[0] ? undefined : 'სურათი არ არის'}
              >
                <div className="detail-hero-badges">
                  <span className="service-tag">{listing.type === ListingType.Service ? 'სერვისი' : 'ნივთი'}</span>
                  {listing.isFeatured && <span className="detail-delivery-chip">გამორჩეული</span>}
                </div>
              </div>
              {listing.images.length > 1 && (
                <div className="detail-thumbnails">
                  {listing.images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      className="detail-thumbnail"
                      style={{ backgroundImage: `url(${image.url})` }}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="detail-section detail-summary-card">
              <h2>აღწერა</h2>
              <p>{listing.description}</p>
            </section>

            {listing.type === ListingType.Service && listing.requirementsSchema && listing.requirementsSchema.length > 0 && (
              <section className="detail-section detail-included-card">
                <h2>საჭირო ინფორმაცია შეკვეთისას</h2>
                <ul>
                  {listing.requirementsSchema.map((field) => (
                    <li key={field.key}>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </li>
                  ))}
                </ul>
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

            <section className="detail-tab-panel detail-reviews-card">
              <h2>შეფასებები ({reviews.length})</h2>
              <div className="filter-bar">
                <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                  <option value="newest">უახლესი</option>
                  <option value="highest">უმაღლესი შეფასება</option>
                  <option value="lowest">უდაბლესი შეფასება</option>
                </select>
              </div>
              {reviews.length === 0 ? (
                <div className="marketplace-empty">ჯერ შეფასებები არ არის.</div>
              ) : (
                <div className="detail-review-list">
                  {reviews.map((review) => (
                    <article key={review.id} className="public-review-card">
                      <div className="public-review-head">
                        <strong>@{review.buyer.username}</strong>
                        <span className="public-review-rating">★ {review.rating}</span>
                      </div>
                      {review.body && <p>{review.body}</p>}
                      {review.tags.length > 0 && (
                        <div className="review-tags">
                          {review.tags.map((tag) => (
                            <span key={tag} className="badge">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {review.sellerReply && (
                        <div className="seller-reply">
                          <strong>გამყიდველის პასუხი:</strong> {review.sellerReply}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="detail-buy-panel">
            <div className="detail-buy-head">
              <strong>{displayPrice !== null ? `${displayPrice} WC` : '—'}</strong>
            </div>

            <div className="detail-buy-tags">
              <span className="service-tag">{listing.category.name}</span>
              {listing.game && <span className="detail-delivery-chip">{listing.game.name}</span>}
            </div>

            <div className="seller-card">
              <div className="seller-avatar">{listing.seller.firstName[0]}</div>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {listing.seller.firstName} {listing.seller.lastName}
                </div>
                <div className="note" style={{ margin: 0 }}>
                  @{listing.seller.username}
                </div>
                {listing.seller.sellerRatingCount > 0 && (
                  <span className="rating-pill">
                    ★ {listing.seller.sellerRatingAvg} ({listing.seller.sellerRatingCount})
                  </span>
                )}
              </div>
            </div>

            {listing.type === ListingType.Service ? (
              <div className="package-list" style={{ marginTop: 16 }}>
                {listing.packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    className={`package-option${selectedPackageId === pkg.id ? ' selected' : ''}`}
                    onClick={() => setSelectedPackageId(pkg.id)}
                  >
                    <div className="package-option-head">
                      <span>{pkg.name}</span>
                      <span>{pkg.priceWaveCoin} WC</span>
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
            ) : (
              listing.stockQuantity !== null && <p className="note">მარაგშია: {listing.stockQuantity}</p>
            )}

            {listing.type === ListingType.Service &&
              listing.requirementsSchema &&
              listing.requirementsSchema.length > 0 && (
                <div className="detail-section" style={{ marginTop: 16 }}>
                  <h2>შეავსეთ შეკვეთამდე</h2>
                  {listing.requirementsSchema.map((field) => (
                    <div className="form-group" key={field.key}>
                      <label htmlFor={field.key}>
                        {field.label}
                        {field.required ? ' *' : ''}
                      </label>
                      {field.type === 'dropdown' ? (
                        <select
                          id={field.key}
                          className="input"
                          value={requirementAnswers[field.key] ?? ''}
                          onChange={(event) =>
                            setRequirementAnswers((prev) => ({ ...prev, [field.key]: event.target.value }))
                          }
                        >
                          <option value="">აირჩიეთ…</option>
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          id={field.key}
                          className="input"
                          value={requirementAnswers[field.key] ?? ''}
                          onChange={(event) =>
                            setRequirementAnswers((prev) => ({ ...prev, [field.key]: event.target.value }))
                          }
                        />
                      ) : (
                        <input
                          id={field.key}
                          className="input"
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={requirementAnswers[field.key] ?? ''}
                          onChange={(event) =>
                            setRequirementAnswers((prev) => ({ ...prev, [field.key]: event.target.value }))
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

            {purchaseError && (
              <div className="status-text status-error" style={{ marginTop: 8 }}>
                {purchaseError}
              </div>
            )}

            <button
              className="detail-buy-button"
              type="button"
              disabled={purchasing || (listing.type === ListingType.Service && !selectedPackageId)}
              onClick={async () => {
                setPurchaseError('')
                if (!me) {
                  router.push(`/login?next=/listings/${listing.id}`)
                  return
                }
                setPurchasing(true)
                try {
                  const order = await api.purchase({
                    listingId: listing.id,
                    packageId: listing.type === ListingType.Service ? selectedPackageId ?? undefined : undefined,
                    requirementsAnswers:
                      listing.type === ListingType.Service ? requirementAnswers : undefined,
                  })
                  router.push(`/orders/${order.id}`)
                } catch (err) {
                  setPurchaseError(
                    err instanceof ApiError ? err.message : 'შეკვეთის გაფორმება ვერ მოხერხდა.',
                  )
                } finally {
                  setPurchasing(false)
                }
              }}
            >
              {purchasing ? 'მიმდინარეობს…' : displayPrice !== null ? `ყიდვა — ${displayPrice} WC` : 'ყიდვა'}
            </button>
            {!me && (
              <p className="note" style={{ textAlign: 'center', marginTop: 8 }}>
                შესყიდვისთვის საჭიროა ავტორიზაცია
              </p>
            )}

            <div className="detail-protection">
              <strong>WaveHub Protection</strong>
              <span>ეს შეკვეთა დაცულია გამყიდველის დადასტურებით და WaveHub-ის შეკვეთების ისტორიით.</span>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  )
}
