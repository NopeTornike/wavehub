import { useEffect, useState, type FormEvent } from 'react'
import type { PublicCoachReview } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'

// The buyer's review of a completed coaching session (one per session) — it's what the coach
// profile's rating and "Student Review" tab are built from.
export default function SessionReview({ sessionId, canReview }: { sessionId: string; canReview: boolean }) {
  const [review, setReview] = useState<PublicCoachReview | null | undefined>(undefined)
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .getCoachingSessionReview(sessionId)
      .then(setReview)
      .catch(() => setReview(null))
  }, [sessionId])

  if (review === undefined) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      setReview(await api.reviewCoachingSession(sessionId, { rating, body: body.trim() || undefined }))
    } catch (err) {
      setError(errorMessage(err, 'შეფასების გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="detail-section detail-summary-card">
      <h2>სესიის შეფასება</h2>
      {review ? (
        <p>
          <strong style={{ color: '#ffc233' }}>{'★'.repeat(review.rating)}</strong> {review.body || 'კომენტარის გარეშე'}
        </p>
      ) : canReview ? (
        <form className="stack-form" onSubmit={submit}>
          <div className="wc-stars" role="radiogroup" aria-label="შეფასება">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} className={n <= rating ? 'on' : undefined} onClick={() => setRating(n)}>
                ★
              </button>
            ))}
          </div>
          <label className="field">
            კომენტარი (არასავალდებულო)
            <textarea rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          {error && (
            <p className="seller-status error" role="alert">
              {error}
            </p>
          )}
          <button className="detail-buy-button" type="submit" disabled={busy}>
            {busy ? 'იგზავნება…' : 'შეფასების გაგზავნა'}
          </button>
        </form>
      ) : (
        <p className="note">სტუდენტს შეფასება ჯერ არ დაუტოვებია.</p>
      )}
    </section>
  )
}
