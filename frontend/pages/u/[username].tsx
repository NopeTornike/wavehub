import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicUserProfile } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'

// Public seller-profile page — backed by GET /users/:username (backend/src/users/
// users.controller.ts). Reuses profile.html's own `.public-profile-frame`/`.public-profile-hero`/
// `.public-profile-stats` markup (2026-09 re-check against the current, much-grown profile.html —
// it now also has an `.public-profile-avatar-wrap`/`-ring`, a `.public-profile-rank-panel` aside,
// an "About"/main-game/secondary-game overview, an achievements badge grid, a rating-distribution
// "performance" section, and full listings/reviews sub-sections with a "Message" footer button).
// `PublicUserProfile` only carries username/firstName/lastName/sellerRatingAvg/sellerRatingCount/
// activeListingCount/createdAt/profileBadge — none of those richer sections have real data behind
// them (no bio/game-preference fields on `User`, no per-user achievement records, no rating
// distribution, and no public "list this seller's listings/reviews" endpoint to call without a
// backend change, which is out of scope here) — root CLAUDE.md rule #6, left out rather than
// faked. The rank panel is specifically a client-computed "marketplace activity" score in the
// static prototype, not real backend data, so it's dropped too. The footer "Message" button is
// also intentionally dropped: Direct messaging is transacted-users-only (LAUNCH_PLAN.md §4), so a
// generic "message this seller" entry point from an arbitrary public profile would be misleading —
// the only real entry points are the buttons on an actual order/session page (see
// `pages/messages/index.tsx`). What IS backed by real data now renders as 4 (not the prototype's
// 5) stat tiles — Rating, Public listings, Buyer reviews, Member since — dropping only "Completed
// orders", which has no equivalent field.
export default function PublicProfile() {
  const router = useRouter()
  const { username } = router.query as { username?: string }

  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!username) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .getUserProfile(username)
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'პროფილი ვერ მოიძებნა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [username])

  return (
    <Layout
      title={profile ? `${profile.firstName} ${profile.lastName} (@${profile.username})` : username ? `@${username}` : 'პროფილი'}
      description={profile ? `${profile.firstName} ${profile.lastName}-ის პროფილი WaveHub-ზე — რეიტინგი და აქტიური განცხადებები.` : undefined}
      noIndex={!profile}
    >
      <div className="detail-page">
        {loading ? (
          <div className="marketplace-empty">იტვირთება…</div>
        ) : error || !profile ? (
          <div className="marketplace-empty" role="alert">
            {error || 'პროფილი ვერ მოიძებნა.'}
          </div>
        ) : (
          <>
            <div className="public-profile-frame">
              <section className="public-profile-hero" aria-labelledby="publicProfileName">
                <div className="public-profile-avatar-wrap">
                  <span className="public-profile-avatar avatar avatar-hot" aria-hidden="true">
                    {profile.firstName[0]}
                    {profile.lastName[0]}
                  </span>
                  <span className="public-profile-avatar-ring" aria-hidden="true" />
                </div>

                <div className="public-profile-copy">
                  <div className="public-profile-name-row">
                    <h2 id="publicProfileName">
                      {profile.firstName} {profile.lastName}
                    </h2>
                    <span className="public-profile-member-mark" aria-label="WaveHub წევრი">
                      W
                    </span>
                  </div>
                  <span>@{profile.username}</span>
                  <strong className="public-profile-role">
                    {profile.activeListingCount > 0 ? 'მარკეტფლეისის გამყიდველი' : 'WaveHub წევრი'}
                  </strong>
                  {profile.profileBadge && <span className="badge-pill">★ {profile.profileBadge}</span>}
                  <small>შემოგვიერთდა {new Date(profile.createdAt).toLocaleDateString('ka-GE', { year: 'numeric', month: 'long' })}</small>
                </div>
              </section>

              <section className="public-profile-stats public-profile-stats-4" aria-label="მომხმარებლის სტატისტიკა">
                <article>
                  <i className="public-profile-rating-icon" aria-hidden="true">
                    <Image src="/assets/profile-rating-icon.svg" alt="" width={34} height={34} unoptimized />
                  </i>
                  <div>
                    <strong>{profile.sellerRatingAvg ?? '—'}</strong>
                    <span>რეიტინგი</span>
                  </div>
                </article>
                <article>
                  <i aria-hidden="true">▣</i>
                  <div>
                    <strong>{profile.activeListingCount}</strong>
                    <span>საჯარო განცხადება</span>
                  </div>
                </article>
                <article>
                  <i className="public-profile-reviews-icon" aria-hidden="true">
                    <Image src="/assets/buyer-reviews-icon.svg" alt="" width={36} height={36} unoptimized />
                  </i>
                  <div>
                    <strong>{profile.sellerRatingCount}</strong>
                    <span>მყიდველის შეფასება</span>
                  </div>
                </article>
                <article>
                  <i aria-hidden="true">◷</i>
                  <div>
                    <strong>{new Date(profile.createdAt).getFullYear()}</strong>
                    <span>წევრია</span>
                  </div>
                </article>
              </section>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
