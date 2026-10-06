import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import type { PublicReview } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'
import { kaDate } from '../lib/dates'
import Avatar, { displayName } from './Avatar'
import RankIcon from './RankIcon'

// One product review (design 2026-10-04, screenshot "reviews"): the reviewer by photo (with the
// real online dot), name and Wave rank; stars; 👍 count; the seller's reply nested underneath with
// its own 👍. The listing's seller can reply here (once); anyone signed in can like or report.
export default function ReviewCard({
  review,
  viewerId,
  isSeller,
  liked,
  replyLiked,
  onChange,
}: {
  review: PublicReview
  viewerId: string | null
  isSeller: boolean
  liked: boolean
  replyLiked: boolean
  onChange: (next: Partial<PublicReview> & { liked?: boolean; replyLiked?: boolean }) => void
}) {
  const router = useRouter()
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reported, setReported] = useState(false)
  const stars = Math.max(0, Math.min(5, Math.round(review.rating)))
  const buyerName = displayName(review.buyer)
  const sellerName = displayName(review.seller)

  const like = async (target: 'review' | 'reply') => {
    if (!viewerId) {
      void router.push(`/login?next=${encodeURIComponent(router.asPath)}`)
      return
    }
    const was = target === 'review' ? liked : replyLiked
    try {
      const res = await api.likeReview(review.id, target, !was)
      onChange(target === 'review' ? { likeCount: res.count, liked: res.liked } : { replyLikeCount: res.count, replyLiked: res.liked })
    } catch (err) {
      setError(errorMessage(err, 'ვერ მოხერხდა.'))
    }
  }

  const sendReply = async () => {
    if (!reply.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.replyToReview(review.id, reply.trim())
      onChange({ sellerReply: reply.trim(), sellerRepliedAt: new Date().toISOString() })
      setReplying(false)
    } catch (err) {
      setError(errorMessage(err, 'პასუხის გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  const report = async () => {
    if (!viewerId) return
    if (!window.confirm('შეფასების დაჩივრება მოდერაციისთვის?')) return
    try {
      await api.reportReview(review.id, 'other')
      setReported(true)
    } catch (err) {
      setError(errorMessage(err, 'დაჩივრება ვერ მოხერხდა.'))
    }
  }

  return (
    <article className="rv-card">
      <Link className="rv-photo" href={`/u/${review.buyer.username}`} aria-label={buyerName}>
        <Avatar name={buyerName} src={review.buyer.avatarUrl} size={72} online={review.buyer.online} />
      </Link>
      <div className="rv-body">
        <div className="rv-top">
          <Link className="rv-name" href={`/u/${review.buyer.username}`}>
            {buyerName}
          </Link>
          <time dateTime={review.createdAt}>{kaDate(review.createdAt)}</time>
          {viewerId && viewerId !== review.buyer.id && (
            <details className="rv-more">
              <summary aria-label="მეტი">
                <span aria-hidden="true">⋮</span>
              </summary>
              <div>
                <button type="button" disabled={reported} onClick={() => void report()}>
                  {reported ? 'დაჩივრებულია ✓' : 'დაჩივრება'}
                </button>
              </div>
            </details>
          )}
        </div>
        {review.buyerRank && (
          <span className="rv-rank">
            <RankIcon name={review.buyerRank} className="rv-rank-icon" />
            <span>{review.buyerRank}</span>
          </span>
        )}
        <span className="rv-stars" aria-label={`${stars} / 5`}>
          {'★'.repeat(stars)}
          <span>{'★'.repeat(5 - stars)}</span>
        </span>
        <p>{review.body || 'კომენტარის გარეშე.'}</p>
        {review.tags.length > 0 && (
          <div className="rv-tags">
            {review.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
        <div className="rv-actions">
          <button type="button" className={`rv-like${liked ? ' on' : ''}`} aria-pressed={liked} onClick={() => void like('review')}>
            <span aria-hidden="true">👍</span>
            {review.likeCount}
          </button>
          {isSeller && !review.sellerReply && (
            <button type="button" className="rv-reply-btn" onClick={() => setReplying((v) => !v)}>
              <span aria-hidden="true">↩</span> პასუხი
            </button>
          )}
        </div>
        {replying && (
          <div className="rv-reply-form">
            <textarea maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="დაწერე პასუხი მყიდველს…" aria-label="პასუხი შეფასებაზე" />
            <button type="button" disabled={busy || !reply.trim()} onClick={() => void sendReply()}>
              გაგზავნა
            </button>
          </div>
        )}
        {error && <p className="rv-error">{error}</p>}

        {review.sellerReply && (
          <div className="rv-reply">
            <Link className="rv-photo" href={`/u/${review.seller.username}`} aria-label={sellerName}>
              <Avatar name={sellerName} src={review.seller.avatarUrl} size={56} />
            </Link>
            <div className="rv-body">
              <div className="rv-top">
                <Link className="rv-name" href={`/u/${review.seller.username}`}>
                  {sellerName}
                </Link>
                {review.seller.rank && (
                  <span className="rv-rank inline">
                    <RankIcon name={review.seller.rank} className="rv-rank-icon" />
                    <span>{review.seller.rank}</span>
                  </span>
                )}
                {review.sellerRepliedAt && <time dateTime={review.sellerRepliedAt}>{kaDate(review.sellerRepliedAt)}</time>}
              </div>
              <p>{review.sellerReply}</p>
              <div className="rv-actions">
                <button type="button" className={`rv-like${replyLiked ? ' on' : ''}`} aria-pressed={replyLiked} onClick={() => void like('reply')}>
                  <span aria-hidden="true">👍</span>
                  {review.replyLikeCount}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
