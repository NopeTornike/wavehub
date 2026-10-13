/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PublicUserProfile } from '@wavehub/shared-types'
import { waveRankIcon } from '@wavehub/shared-types'
import { api } from '../lib/api'
import { kaDate } from '../lib/dates'
import { displayName } from './Avatar'

// Tornike's quick seller profile (prototype seller-profile-preview.js, its `.seller-profile-*` CSS is
// in global.css): tapping a seller on a product card opens a card with their photo, name, bio,
// Wave rank, rating / sales and latest reviews, plus "Message" and "View full profile". Real data
// from GET users/:username only — no invented score.
export default function SellerPreview({ username, onClose }: { username: string; onClose: () => void }) {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let alive = true
    api
      .getUserProfile(username)
      .then((p) => alive && setProfile(p))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [username])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setOpen(true)
      closeRef.current?.focus()
    })
    document.body.classList.add('seller-profile-open')
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      document.body.classList.remove('seller-profile-open')
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const name = profile ? displayName(profile) : username
  const verified = !!profile?.badges.some((b) => b.key === 'verified')
  const rating = profile?.reviews.average
  const roleLabel = profile?.role === 'coach' ? 'ქოუჩი' : profile?.role === 'seller' ? 'გამყიდველი' : 'WaveHub-ის წევრი'

  return createPortal(
    <div className={`seller-profile-modal${open ? ' is-open' : ''}`}>
      <div className="seller-profile-backdrop" onClick={onClose} />
      <section className="seller-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="quickSellerName">
        <button ref={closeRef} className="seller-profile-close" type="button" onClick={onClose} aria-label="დახურვა">
          ×
        </button>
        {failed ? (
          <p className="seller-profile-reviews-empty">პროფილი ვერ ჩაიტვირთა.</p>
        ) : !profile ? (
          <p className="seller-profile-reviews-empty">იტვირთება…</p>
        ) : (
          <>
            <header className="seller-profile-header">
              <div className="seller-profile-person">
                <span className="seller-profile-photo" style={profile.avatarUrl ? { backgroundImage: `url("${profile.avatarUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
                  {!profile.avatarUrl && <b>{name.slice(0, 2).toUpperCase()}</b>}
                  {profile.online && <i aria-label="ონლაინ" />}
                </span>
                <div className="seller-profile-identity">
                  <h2>
                    <span id="quickSellerName">{name}</span>
                    {verified && <b aria-label="ვერიფიცირებული">✓</b>}
                  </h2>
                  <div>
                    <strong>@{profile.username}</strong>
                    <span>{roleLabel}</span>
                  </div>
                  <p>{profile.bio || profile.tagline || 'ბიო ჯერ არ არის დამატებული.'}</p>
                  <small>
                    {profile.location && (
                      <span>
                        ⌖ <b>{profile.location}</b>
                      </span>
                    )}
                    <span>
                      ▣ წევრია <b>{kaDate(profile.createdAt)}</b>-დან
                    </span>
                  </small>
                </div>
              </div>
              <div className="seller-rank-card">
                <span className="seller-rank-emblem">
                  <img src={waveRankIcon(profile.waveRank.name)} alt="" aria-hidden="true" />
                </span>
                <div>
                  <small>რანკი</small>
                  <strong>{profile.waveRank.name}</strong>
                  <span>WaveHubX რანკი</span>
                </div>
                <p>
                  <span style={{ background: `linear-gradient(90deg, #ed0b72 ${profile.waveRank.progressToNext * 0.55}%, #7d1ccc ${profile.waveRank.progressToNext}%, #21104e ${profile.waveRank.progressToNext}%)` }} />
                  <small>
                    შემდეგი: <b>{profile.waveRank.nextName}</b>
                  </small>
                </p>
              </div>
            </header>
            <div className="seller-profile-stats">
              <div>
                <strong>{rating !== null && rating !== undefined ? rating.toFixed(1) : '—'}</strong>
                <small>რეიტინგი</small>
                <span>{'★'.repeat(Math.round(rating ?? 0)).padEnd(5, '☆')}</span>
              </div>
              <div>
                <strong>{profile.completedDeals}</strong>
                <small>დასრულებული გარიგება</small>
                <span>{`${profile.activeListingCount} აქტიური განცხადება`}</span>
              </div>
              <div>
                <strong>{profile.followers}</strong>
                <small>გამომწერი</small>
                <span>{`${profile.reviews.count} შეფასება`}</span>
              </div>
            </div>
            <section className="seller-profile-reviews">
              <header>
                <h3>
                  შეფასებები <small>({profile.reviews.count})</small>
                </h3>
                <Link href={`/u/${encodeURIComponent(profile.username)}`} onClick={onClose}>
                  ყველას ნახვა →
                </Link>
              </header>
              {profile.reviews.latest.length === 0 ? (
                <p className="seller-profile-reviews-empty">შეფასებები ჯერ არ არის.</p>
              ) : (
                profile.reviews.latest.map((r) => {
                  const who = displayName({ firstName: r.buyerFirstName, lastName: r.buyerLastName, username: r.buyerUsername })
                  return (
                    <article key={`${r.buyerUsername}-${r.createdAt}`}>
                      <span className="seller-review-avatar" style={r.buyerAvatarUrl ? { backgroundImage: `url("${r.buyerAvatarUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
                        {r.buyerAvatarUrl ? '' : who.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <h4>{who}</h4>
                        <b>{'★'.repeat(r.rating).padEnd(5, '☆')}</b>
                        <p>{r.body || 'კომენტარის გარეშე.'}</p>
                      </div>
                      <time dateTime={r.createdAt}>{kaDate(r.createdAt)}</time>
                    </article>
                  )
                })
              )}
            </section>
            <footer className="seller-profile-actions">
              <Link className="seller-message-action" href="/messages" onClick={onClose}>
                <span>▣</span>
                <b>
                  მიწერა<small>შეტყობინებები</small>
                </b>
                <i>→</i>
              </Link>
              <Link className="seller-view-action" href={`/u/${encodeURIComponent(profile.username)}`} onClick={onClose}>
                სრული პროფილი <span>→</span>
              </Link>
            </footer>
          </>
        )}
      </section>
    </div>,
    document.body,
  )
}
