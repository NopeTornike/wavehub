import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ListingStatus, ListingType } from '@wavehub/shared-types'
import { api, errorMessage, type MyListing } from '../lib/api'
import { gameCover } from '../lib/games'
import { LISTING_STATUS_LABELS } from '../lib/labels'
import RecordCard from './RecordCard'

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
  if (listing.type === ListingType.DigitalKey) return `/sell/digital-keys/${listing.id}`
  return `/sell/items/${listing.id}`
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ka-GE', { year: 'numeric', month: 'short', day: 'numeric' })
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
    <>
      <section className={`profile-record-section ${className}`.trim()} aria-labelledby={`${gridId ?? 'myListings'}Title`}>
        <div className="section-heading">
          <div>
            <p className="section-kicker">გამყიდველის პანელი</p>
            <h2 id={`${gridId ?? 'myListings'}Title`}>ჩემი განცხადებები</h2>
          </div>
          <Link className="secondary-seller-action" href="/marketplace">
            განცხადების დამატება
          </Link>
        </div>
        <p className={`seller-status${status.kind ? ` ${status.kind}` : ''}`} aria-live="polite">
          {status.text}
        </p>
        <div className="profile-record-grid" id={gridId}>
          {shown.map((listing) => (
            <RecordCard
              key={listing.id}
              href={
                listing.status === ListingStatus.Active
                  ? `/listings/${listing.id}`
                  : listing.type === ListingType.DigitalKey
                    ? `/sell/digital-keys/${listing.id}`
                    : editHref(listing)
              }
              image={listing.images?.[0]?.url ?? gameCover(listing.game?.slug)}
              fallback={(listing.game?.name ?? 'WH').slice(0, 2).toUpperCase()}
              title={listing.title}
              meta={`${listing.game?.name ?? 'WaveHub'} / ${LISTING_STATUS_LABELS[listing.status]}`}
              footer={`${listing.priceWaveCoin ?? '—'} GEL / ${formatDate(listing.createdAt)}${listing.rejectionReason ? ` / ${listing.rejectionReason}` : ''}`}
              actions={
                <>
                  <Link className="profile-record-action" href={editHref(listing)}>
                    Edit
                  </Link>
                  {listing.status === ListingStatus.Active && (
                    <button className="profile-record-action" type="button" onClick={() => void act(() => api.pauseListing(listing.id), 'განცხადება შეჩერდა.')}>
                      Pause
                    </button>
                  )}
                  {listing.status === ListingStatus.Paused && (
                    <button className="profile-record-action" type="button" onClick={() => void act(() => api.unpauseListing(listing.id), 'განცხადება კვლავ აქტიურია.')}>
                      Resume
                    </button>
                  )}
                  {(listing.status === ListingStatus.Draft || listing.status === ListingStatus.Rejected) && (
                    <button className="profile-record-action" type="button" onClick={() => void act(() => api.submitListingForReview(listing.id), 'გაიგზავნა შესამოწმებლად.')}>
                      Submit
                    </button>
                  )}
                  <button
                    className="profile-record-action danger"
                    type="button"
                    onClick={() => {
                      if (window.confirm(`წავშალოთ „${listing.title}“?`)) void act(() => api.deleteListing(listing.id), 'განცხადება წაიშალა.')
                    }}
                  >
                    Delete
                  </button>
                  {listing.status === ListingStatus.Active && (
                    <Link className="profile-record-action" href={`/listings/${listing.id}`}>
                      View
                    </Link>
                  )}
                </>
              }
            />
          ))}
        </div>
        <div className="marketplace-empty" hidden={listings === null || shown.length > 0}>
          განცხადებები ჯერ არ არის.
        </div>
      </section>

    </>
  )
}
