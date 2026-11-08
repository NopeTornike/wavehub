import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { UserStatus } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'

// "Write a review" on the listing page (owner 2026-11-08): any email-verified user may leave ONE
// review of a product, even without buying it (POST listings/:id/reviews). A buyer with a completed
// order is sent to the order's review instead (that one is marked "verified purchase").
export default function ListingReviewForm({ listingId, isOwnListing, orderReviewHref, onPosted }: { listingId: string; isOwnListing: boolean; orderReviewHref: string | null; onPosted: () => void }) {
  const { user } = useAuth()
  const [reviewed, setReviewed] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    api
      .myListingReview(listingId)
      .then((r) => {
        if (!cancelled) setReviewed(r.reviewed)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [userId, listingId])

  if (isOwnListing) return null
  if (orderReviewHref)
    return (
      <Link className="detail-write-review" href={orderReviewHref}>
        ★ შენ იყიდე ეს პროდუქტი — დაწერე შეფასება
      </Link>
    )
  if (!user)
    return (
      <Link className="detail-write-review" href={`/login?next=/listings/${listingId}`}>
        ★ შედი და დაწერე შეფასება
      </Link>
    )
  if (reviewed !== false) return null
  if (user.status === UserStatus.PendingVerification)
    return <p className="note">შეფასების დასაწერად დაადასტურე ელფოსტა.</p>

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const text = body.trim()
    if (text && text.length < 10) return setError('კომენტარი უნდა იყოს მინიმუმ 10 სიმბოლო (ან დატოვე ცარიელი).')
    setBusy(true)
    setError('')
    try {
      await api.createListingReview(listingId, { rating, body: text || undefined })
      setReviewed(true)
      onPosted()
    } catch (err) {
      setError(errorMessage(err, 'შეფასების გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  if (!open)
    return (
      <button type="button" className="detail-write-review" onClick={() => setOpen(true)}>
        ★ დაწერე შეფასება
      </button>
    )

  return (
    <form className="stack-form lr-form" onSubmit={submit}>
      <p className="note">შენი შეფასება ჩანს ყველასთვის. შეგიძლია დაწერო ერთი შეფასება ამ პროდუქტზე.</p>
      <div className="wc-stars" role="radiogroup" aria-label="შეფასება">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ვარსკვლავი`} className={n <= rating ? 'on' : undefined} onClick={() => setRating(n)}>
            ★
          </button>
        ))}
      </div>
      <label className="field">
        კომენტარი (არასავალდებულო, მინ. 10 სიმბოლო)
        <textarea rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="lr-actions">
        <button className="button" type="submit" disabled={busy}>
          {busy ? 'იგზავნება…' : 'შეფასების გაგზავნა'}
        </button>
        <button className="button ghost" type="button" disabled={busy} onClick={() => setOpen(false)}>
          გაუქმება
        </button>
      </div>
      {error && (
        <p className="seller-status error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
