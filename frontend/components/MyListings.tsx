/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ListingStatus, ListingType } from '@wavehub/shared-types'
import { api, errorMessage, type MyListing } from '../lib/api'
import { gameCover } from '../lib/games'
import { LISTING_STATUS_LABELS, LISTING_TYPE_LABELS } from '../lib/labels'
import { kaDate } from '../lib/dates'

// The prototype's seller "My Listings" record panel — it appears on both profile.html (Settings) and
// orders.html, each with the same Edit / Delete / View actions. On real data: Edit opens the full
// editor for the listing's type (/sell/items/[id] for accounts/skins — title, price, description,
// game details, photos; /sell/services/[id]; /sell/digital-keys/[id]); editing a live listing goes
// back through moderation (PATCH /listings/:id), delete is only possible for
// a never-ordered listing (the API answers "pause it instead" otherwise), plus the real lifecycle's
// pause / resume / submit-for-review. `query` narrows the grid (orders.html filters it with the
// page search).

type Status = { kind: '' | 'error' | 'success' | 'pending'; text: string }

// The full editor for each listing type.
function editHref(listing: MyListing): string {
  if (listing.type === ListingType.Service) return `/sell/services/${listing.id}`
  if (listing.type === ListingType.DigitalKey) return `/admin/steam/${listing.id}`
  return `/sell/items/${listing.id}`
}

function formatDate(value?: string | null) {
  return value ? kaDate(value) : ''
}

export default function MyListings({
  className = '',
  gridId,
  query = '',
  onCount,
}: {
  className?: string
  gridId?: string
  query?: string
  onCount?: (count: number) => void
}) {
  const [listings, setListings] = useState<MyListing[] | null>(null)
  const [status, setStatus] = useState<Status>({ kind: '', text: '' })

  const reload = useCallback(
    () =>
      api
        .listMyListings()
        .then((rows) => {
          setListings(rows)
          onCount?.(rows.length)
        })
        .catch(() => setListings((current) => current ?? [])),
    [onCount],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  const act = async (run: () => Promise<unknown>, done: string) => {
    setStatus({ kind: 'pending', text: 'მუშავდება…' })
    try {
      await run()
      await reload()
      setStatus({ kind: 'success', text: done })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'მოქმედება ვერ შესრულდა.') })
    }
  }

  const q = query.trim().toLowerCase()
  const shown = (listings ?? []).filter(
    (listing) => !q || [listing.title, listing.game?.name, listing.description].filter(Boolean).join(' ').toLowerCase().includes(q),
  )

  return (
    <section className={`ml-panel ${className}`.trim()} aria-labelledby={`${gridId ?? 'myListings'}Title`}>
      <header className="ml-head">
        <div>
          <p className="section-kicker">გამყიდველის პანელი</p>
          <h2 id={`${gridId ?? 'myListings'}Title`}>ჩემი განცხადებები</h2>
          <p>აქ ნახავთ თქვენ მიერ განთავსებულ ყველა განცხადებას.</p>
        </div>
        <Link className="ml-add" href="/marketplace?sell=1">
          <img src="/assets/ui/plus-circle.png" alt="" aria-hidden="true" />
          განცხადების დამატება
        </Link>
      </header>

      <div className="ml-how">
        <span className="ml-how-icon">
          <img src="/assets/ui/cart-light.png" alt="" aria-hidden="true" />
        </span>
        <div>
          <strong>როგორ მუშაობს?</strong>
          <ol>
            <li>
              <span>
                <img src="/assets/ui/doc-pink.png" alt="" aria-hidden="true" />
              </span>
              1. შექმენი განცხადება
            </li>
            <li>
              <span>
                <img src="/assets/ui/chat-light.png" alt="" aria-hidden="true" />
              </span>
              2. მოლაპარაკე მყიდველთან
            </li>
            <li>
              <span>
                <img src="/assets/ui/check-circle-light.png" alt="" aria-hidden="true" />
              </span>
              3. დაადასტურე შეკვეთა
            </li>
          </ol>
        </div>
      </div>

      <p className={`seller-status${status.kind ? ` ${status.kind}` : ''}`} aria-live="polite">
        {status.text}
      </p>
      <div className="ml-grid" id={gridId}>
        {shown.map((listing) => {
          const image = listing.images?.[0]?.url ?? gameCover(listing.game?.slug)
          const tone = listing.status === ListingStatus.Active ? 'ok' : listing.status === ListingStatus.PendingReview || listing.status === ListingStatus.Draft ? 'wait' : 'bad'
          const view = listing.status === ListingStatus.Active ? `/listings/${listing.id}` : editHref(listing)
          return (
            <article key={listing.id} className="ml-card">
              <Link className="ml-thumb" href={view} style={image ? { backgroundImage: `url('${image}')` } : undefined} aria-label={listing.title}>
                {image ? '' : (listing.game?.name ?? 'WH').slice(0, 2).toUpperCase()}
              </Link>
              <div className="ml-body">
                <div className="ml-top">
                  <span className={`ml-status ${tone}`}>
                    <i aria-hidden="true" />
                    {LISTING_STATUS_LABELS[listing.status]}
                  </span>
                  <details className="ml-more">
                    <summary aria-label="მეტი მოქმედება">
                      <img src="/assets/ui/ellipsis.png" alt="" aria-hidden="true" />
                    </summary>
                    <div>
                      {listing.status === ListingStatus.Active && <Link href={`/listings/${listing.id}`}>ნახვა</Link>}
                      {listing.status === ListingStatus.Active && (
                        <button type="button" onClick={() => void act(() => api.pauseListing(listing.id), 'განცხადება შეჩერდა.')}>
                          შეჩერება
                        </button>
                      )}
                      {listing.status === ListingStatus.Paused && (
                        <button type="button" onClick={() => void act(() => api.unpauseListing(listing.id), 'განცხადება კვლავ აქტიურია.')}>
                          განახლება
                        </button>
                      )}
                      {(listing.status === ListingStatus.Draft || listing.status === ListingStatus.Rejected) && (
                        <button type="button" onClick={() => void act(() => api.submitListingForReview(listing.id), 'გაიგზავნა შესამოწმებლად.')}>
                          შესამოწმებლად გაგზავნა
                        </button>
                      )}
                    </div>
                  </details>
                </div>
                <h3>
                  <Link href={view}>{listing.title}</Link>
                </h3>
                <p className="ml-sub">{[listing.game?.name, LISTING_TYPE_LABELS[listing.type]].filter(Boolean).join(' / ')}</p>
                {listing.rejectionReason && listing.status === ListingStatus.Rejected && <p className="ml-reason">{listing.rejectionReason}</p>}
                <div className="ml-price-row">
                  <span className="ml-price">
                    <img src="/assets/ui/tag.png" alt="" aria-hidden="true" />
                    {listing.priceWaveCoin != null ? `${listing.priceWaveCoin} GEL` : '— GEL'}
                  </span>
                  <span className="ml-date">
                    <img src="/assets/ui/calendar.png" alt="" aria-hidden="true" />
                    {formatDate(listing.createdAt)}
                  </span>
                </div>
                <div className="ml-stats">
                  <span>
                    <img src="/assets/ui/eye.png" alt="" aria-hidden="true" />
                    {`${listing.viewsCount ?? 0} ნახვა`}
                  </span>
                  <span>
                    <img src="/assets/ui/heart.png" alt="" aria-hidden="true" />
                    {`${listing.favoriteCount ?? 0} მოწონება`}
                  </span>
                  <span>
                    <img src="/assets/ui/cart-sm.png" alt="" aria-hidden="true" />
                    {`${listing.ordersCount ?? 0} შეკვეთა`}
                  </span>
                </div>
              </div>
              <div className="ml-actions">
                <Link className="ml-edit" href={editHref(listing)}>
                  <img src="/assets/ui/pencil-light.png" alt="" aria-hidden="true" />
                  რედაქტირება
                </Link>
                <button
                  className="ml-delete"
                  type="button"
                  onClick={() => {
                    if (window.confirm(`წავშალოთ „${listing.title}“?`)) void act(() => api.deleteListing(listing.id), 'განცხადება წაიშალა.')
                  }}
                >
                  <img src="/assets/ui/trash.png" alt="" aria-hidden="true" />
                  წაშლა
                </button>
              </div>
            </article>
          )
        })}
      </div>
      <div className="marketplace-empty" hidden={listings === null || shown.length > 0}>
        განცხადებები ჯერ არ არის.
      </div>
    </section>
  )
}
