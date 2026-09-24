import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicUserProfile } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { GAME_ART } from '../../lib/games'

// Public seller-profile page — backed by GET /users/:username (backend/src/users/users.controller.ts).
// profile.html's `.public-profile-frame`/`-hero`/`-stats` plus its About / main game / second game
// overview, all on real data: the photo, bio and up to two main games are what the member set on
// the Settings page (/profile). Four stat tiles instead of the prototype's five — "Completed orders"
// has no public backing field (root CLAUDE.md rule #6). Still not ported, for the same reason: the
// achievement badge grid, the rating-distribution "performance" block, the client-computed rank
// panel, and the per-profile listings/reviews lists; the footer "Message" button is dropped because
// Direct messaging is transacted-users-only (LAUNCH_PLAN.md §4).
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
                  <span
                    className={`public-profile-avatar avatar avatar-hot${profile.avatarUrl ? ' avatar-image' : ''}`}
                    aria-hidden="true"
                    style={profile.avatarUrl ? { backgroundImage: `url("${profile.avatarUrl}")` } : undefined}
                  >
                    {profile.avatarUrl ? '' : `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`}
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

            {/* profile.html's "About / main game / second game" overview — the bio and main games
                the member set on their Settings page (GET /users/:username). */}
            <section className="public-profile-overview public-profile-games-overview">
              <article className="public-profile-info-card">
                <div className="public-profile-section-title">
                  <span>შესახებ</span>
                </div>
                <p className="public-profile-bio" id="publicProfileBio">
                  BIO: {profile.bio || 'აღწერა ჯერ არ დამატებულა.'}
                </p>
                <dl className="public-profile-facts">
                  <div>
                    <dt>მომხმარებლის სახელი</dt>
                    <dd>@{profile.username}</dd>
                  </div>
                  <div>
                    <dt>წევრის ტიპი</dt>
                    <dd>{profile.activeListingCount > 0 ? 'მარკეტფლეისის გამყიდველი' : 'საზოგადოების წევრი'}</dd>
                  </div>
                  <div>
                    <dt>მარკეტფლეისის აქტივობა</dt>
                    <dd>{profile.activeListingCount > 0 ? `${profile.activeListingCount} აქტიური განცხადება` : 'აქტივობა ჯერ არ არის'}</dd>
                  </div>
                </dl>
              </article>
              {[0, 1].map((index) => {
                const game = profile.mainGames[index]
                const art = game ? GAME_ART[game.slug]?.cover : undefined
                return (
                  <article key={index} className="public-profile-info-card public-profile-game-card">
                    <div className="public-profile-section-title">
                      <span>{index === 0 ? 'მთავარი თამაში' : 'მეორე თამაში'}</span>
                    </div>
                    <div
                      className={`public-profile-game-visual${art ? '' : ' is-empty'}`}
                      aria-hidden="true"
                      style={art ? { backgroundImage: `linear-gradient(180deg, rgba(4, 7, 17, 0.03), rgba(4, 7, 17, 0.5)), url("${art}")` } : undefined}
                    >
                      {art ? '' : 'WH'}
                    </div>
                    <div className="public-profile-game-copy">
                      <strong>{game ? game.name : index === 0 ? 'თამაში არ არის მითითებული' : 'მეორე თამაში არ არის'}</strong>
                      <span>{game ? 'არჩეულია პროფილის პარამეტრებში' : 'აირჩიეთ თამაშები პროფილის პარამეტრებში.'}</span>
                    </div>
                  </article>
                )
              })}
            </section>
          </>
        )}
      </div>
    </Layout>
  )
}
