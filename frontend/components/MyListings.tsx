import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ListingStatus, ListingType } from '@wavehub/shared-types'
import { api, errorMessage, type MyListing } from '../lib/api'
import { gameCover } from '../lib/games'
import { LISTING_STATUS_LABELS } from '../lib/labels'
import RecordCard from './RecordCard'

// The prototype's seller "My Listings" record panel — it appears on both profile.html (Settings) and
// orders.html, each with the same Edit / Delete / View actions and edit modal. On real data: edit
// goes back through moderation for a live listing (PATCH /listings/:id), delete is only possible for
// a never-ordered listing (the API answers "pause it instead" otherwise), plus the real lifecycle's
// pause / resume / submit-for-review. `query` narrows the grid (orders.html filters it with the
// page search).

type Status = { kind: '' | 'error' | 'success' | 'pending'; text: string }

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
  const [editing, setEditing] = useState<MyListing | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', price: '' })

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

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    const payload: { title?: string; description?: string; priceWaveCoin?: number } = {}
    if (editForm.title.trim() !== editing.title) payload.title = editForm.title.trim()
    if (editing.description !== undefined && editForm.description.trim() !== editing.description) payload.description = editForm.description.trim()
    if (editing.type !== ListingType.Service && Number(editForm.price) !== editing.priceWaveCoin) payload.priceWaveCoin = Math.floor(Number(editForm.price))
    if (Object.keys(payload).length === 0) {
      setEditing(null)
      return
    }
    await act(
      () => api.updateListing(editing.id, payload),
      editing.status === ListingStatus.Active || editing.status === ListingStatus.Paused
        ? 'ცვლილებები შენახულია — განცხადება ხელახლა გადის შემოწმებას.'
        : 'ცვლილებები შენახულია.',
    )
    setEditing(null)
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
              href={listing.status === ListingStatus.Active ? `/listings/${listing.id}` : listing.type === ListingType.DigitalKey ? `/sell/digital-keys/${listing.id}` : '/profile'}
              image={gameCover(listing.game?.slug, listing.images?.[0]?.url ?? null)}
              fallback={(listing.game?.name ?? 'WH').slice(0, 2).toUpperCase()}
              title={listing.title}
              meta={`${listing.game?.name ?? 'WaveHub'} / ${LISTING_STATUS_LABELS[listing.status]}`}
              footer={`${listing.priceWaveCoin ?? '—'} GEL / ${formatDate(listing.createdAt)}${listing.rejectionReason ? ` / ${listing.rejectionReason}` : ''}`}
              actions={
                <>
                  {listing.status !== ListingStatus.PendingReview && (
                    <button
                      className="profile-record-action"
                      type="button"
                      onClick={() => {
                        setEditing(listing)
                        setEditForm({ title: listing.title, description: listing.description ?? '', price: String(listing.priceWaveCoin ?? '') })
                      }}
                    >
                      Edit
                    </button>
                  )}
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

      {editing && (
        <div className="seller-modal" role="dialog" aria-modal="true" aria-labelledby="editListingTitle">
          <div className="seller-modal-panel listing-builder-panel">
            <div className="seller-modal-head">
              <div>
                <p className="section-kicker">განცხადების რედაქტირება</p>
                <h2 id="editListingTitle">{editing.title}</h2>
              </div>
              <button className="seller-close-button" type="button" aria-label="Close" onClick={() => setEditing(null)}>
                x
              </button>
            </div>
            <form className="seller-form listing-builder-form" onSubmit={saveEdit}>
              <section className="listing-builder-section">
                <div className="listing-builder-grid">
                  <label>
                    <span>სათაური *</span>
                    <input type="text" minLength={5} maxLength={100} required value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                  </label>
                  {editing.type !== ListingType.Service && (
                    <label>
                      <span>ფასი (GEL) *</span>
                      <input type="number" min={1} step={1} required value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                    </label>
                  )}
                  <label className="seller-description-field">
                    <span>აღწერა *</span>
                    <textarea minLength={50} maxLength={5000} required value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                    <small>
                      {editing.status === ListingStatus.Active || editing.status === ListingStatus.Paused
                        ? 'აქტიური განცხადების რედაქტირების შემდეგ ის ხელახლა გადის შემოწმებას.'
                        : 'ცვლილებები შეინახება დრაფტში.'}
                    </small>
                  </label>
                </div>
              </section>
              <div className="seller-modal-actions listing-builder-actions">
                <button className="secondary-seller-action" type="button" onClick={() => setEditing(null)}>
                  გაუქმება
                </button>
                <button className="seller-submit-button" type="submit">
                  შენახვა
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
