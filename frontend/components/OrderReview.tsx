import { useEffect, useState, type FormEvent } from 'react'
import { ReviewStatus, type OrderReviewState } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'

// The review block on a completed order (pages/orders/[id].tsx, anchor #review): the buyer writes
// one review (stars + optional comment ≥10 chars), the seller answers it once. State comes from
// GET reviews/order/:id, so a reload shows the existing review instead of a form that would 409.
export default function OrderReview({ orderId, isBuyer, isSeller }: { orderId: string; isBuyer: boolean; isSeller: boolean }) {
  const [state, setState] = useState<OrderReviewState | null>(null)
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .getOrderReview(orderId)
      .then(setState)
      .catch(() => setState({ review: null, status: null }))
  }, [orderId])

  if (!state) return null
  const review = state.review

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const text = body.trim()
    if (text && text.length < 10) return setError('კომენტარი უნდა იყოს მინიმუმ 10 სიმბოლო (ან დატოვე ცარიელი).')
    setBusy(true)
    setError('')
    try {
      await api.createReview({ orderId, rating, body: text || undefined })
      setState(await api.getOrderReview(orderId))
    } catch (err) {
      setError(errorMessage(err, 'შეფასების გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  const sendReply = async (event: FormEvent) => {
    event.preventDefault()
    if (!review || !reply.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.replyToReview(review.id, reply.trim())
      setState(await api.getOrderReview(orderId))
    } catch (err) {
      setError(errorMessage(err, 'პასუხის გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="order-section order-review" id="review">
      <h2>{review ? 'შეფასება' : isBuyer ? 'შეაფასე შეკვეთა' : 'შეფასება'}</h2>
      {review ? (
        <>
          <div className="order-review-card">
            <span className="order-review-stars" aria-label={`${review.rating} / 5`}>
              {'★'.repeat(review.rating)}
              <span>{'★'.repeat(5 - review.rating)}</span>
            </span>
            <p>{review.body || 'კომენტარის გარეშე.'}</p>
            {review.sellerReply && (
              <p className="order-review-reply">
                <strong>გამყიდველის პასუხი:</strong> {review.sellerReply}
              </p>
            )}
            {state.status && state.status !== ReviewStatus.Published && (
              <p className="note">
                {state.status === ReviewStatus.Reported ? 'შეფასება მოდერაციის განხილვაშია.' : 'შეფასება დამალულია მოდერაციის მიერ.'}
              </p>
            )}
          </div>
          {isSeller && !review.sellerReply && state.status === ReviewStatus.Published && (
            <form className="stack-form" onSubmit={sendReply}>
              <label className="field">
                უპასუხე მყიდველს (ჩანს პროდუქტის გვერდზე)
                <textarea rows={2} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} />
              </label>
              <button className="button" type="submit" disabled={busy || !reply.trim()}>
                {busy ? 'იგზავნება…' : 'პასუხის გაგზავნა'}
              </button>
            </form>
          )}
        </>
      ) : isBuyer ? (
        <form className="stack-form" onSubmit={submit}>
          <p className="note">როგორ მოგეწონა? შენი შეფასება გამოჩნდება პროდუქტის გვერდზე და დაეხმარება სხვა მყიდველებს.</p>
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
          <button className="button" type="submit" disabled={busy}>
            {busy ? 'იგზავნება…' : 'შეფასების გაგზავნა'}
          </button>
        </form>
      ) : (
        <p className="note">მყიდველს შეფასება ჯერ არ დაუტოვებია.</p>
      )}
      {error && (
        <p className="seller-status error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
