import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicListingDetail, PublicReview } from '@wavehub/shared-types'
import { ListingType } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'

export default function ListingDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }

  const [listing, setListing] = useState<PublicListingDetail | null>(null)
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [sort, setSort] = useState<'newest' | 'highest' | 'lowest'>('newest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        <div className="page">
          <div className="page-inner empty-state">იტვირთება…</div>
        </div>
      </Layout>
    )
  }

  if (error || !listing) {
    return (
      <Layout>
        <div className="page">
          <div className="page-inner empty-state">{error || 'ლისტინგი ვერ მოიძებნა.'}</div>
        </div>
      </Layout>
    )
  }

  const selectedPackage = listing.packages.find((pkg) => pkg.id === selectedPackageId) ?? null
  const displayPrice =
    listing.type === ListingType.Item ? listing.priceWaveCoin : selectedPackage?.priceWaveCoin ?? null

  return (
    <Layout>
      <div className="page">
        <div className="page-inner">
          <div className="detail-layout">
            <div>
              <div className="detail-gallery">
                {listing.images[0] ? (
                  <img src={listing.images[0].url} alt={listing.title} />
                ) : (
                  <span>სურათი არ არის</span>
                )}
              </div>

              <div className="detail-section">
                <div className="listing-card-meta">
                  <span>{listing.category.name}</span>
                  {listing.game && <span>· {listing.game.name}</span>}
                  {listing.isFeatured && <span className="badge badge-featured">გამორჩეული</span>}
                </div>
                <h1 className="page-title" style={{ marginTop: 8 }}>
                  {listing.title}
                </h1>
                {listing.ratingCount > 0 && (
                  <span className="rating-pill">
                    ★ {listing.ratingAvg} ({listing.ratingCount})
                  </span>
                )}
              </div>

              <div className="detail-section">
                <h2>აღწერა</h2>
                <p>{listing.description}</p>
              </div>

              {listing.type === ListingType.Service && listing.requirementsSchema && listing.requirementsSchema.length > 0 && (
                <div className="detail-section">
                  <h2>საჭირო ინფორმაცია შეკვეთისას</h2>
                  <ul>
                    {listing.requirementsSchema.map((field) => (
                      <li key={field.key}>
                        {field.label}
                        {field.required ? ' *' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {listing.faq && listing.faq.length > 0 && (
                <div className="detail-section">
                  <h2>ხშირად დასმული კითხვები</h2>
                  {listing.faq.map((entry, index) => (
                    <div key={index} style={{ marginBottom: 10 }}>
                      <strong>{entry.q}</strong>
                      <p style={{ margin: '4px 0 0' }}>{entry.a}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="detail-section">
                <h2>შეფასებები ({reviews.length})</h2>
                <div className="filter-bar">
                  <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                    <option value="newest">უახლესი</option>
                    <option value="highest">უმაღლესი შეფასება</option>
                    <option value="lowest">უდაბლესი შეფასება</option>
                  </select>
                </div>
                {reviews.length === 0 ? (
                  <p className="note">ჯერ შეფასებები არ არის.</p>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="review-item">
                      <div className="review-item-head">
                        <span>@{review.buyer.username}</span>
                        <span className="rating-pill">★ {review.rating}</span>
                      </div>
                      {review.body && <p style={{ margin: 0 }}>{review.body}</p>}
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
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
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
                <div className="detail-section">
                  <span className="price-tag" style={{ fontSize: '1.4rem' }}>
                    {displayPrice} WC
                  </span>
                  {listing.stockQuantity !== null && (
                    <p className="note">მარაგშია: {listing.stockQuantity}</p>
                  )}
                </div>
              )}

              <button className="button glow-on-hover" type="button" style={{ width: '100%', marginTop: 16 }}>
                {displayPrice !== null ? `ყიდვა — ${displayPrice} WC` : 'ყიდვა'}
              </button>
              <p className="note" style={{ textAlign: 'center', marginTop: 8 }}>
                შეკვეთის გაფორმება მალე დაემატება
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
