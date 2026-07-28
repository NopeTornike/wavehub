import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicUserProfile } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'

// Public seller-profile page — backed by GET /users/:username (backend/src/users/
// users.controller.ts). Reuses profile.html's own `.public-profile-hero`/`.public-profile-stats`
// markup, but only the stat tiles this app can back with real data (Rating, Public listings,
// Member since) — profile.html also shows "Orders received" and "Buyer reviews" tiles, and a
// marketplace-activity rank panel, none of which this app computes yet. Left out rather than
// faked with placeholder numbers.
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
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'პროფილი ვერ მოიძებნა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [username])

  return (
    <Layout>
      <div className="detail-page">
        {loading ? (
          <div className="marketplace-empty">იტვირთება…</div>
        ) : error || !profile ? (
          <div className="marketplace-empty">{error || 'პროფილი ვერ მოიძებნა.'}</div>
        ) : (
          <>
            <section className="public-profile-hero" aria-labelledby="publicProfileName">
              <span className="public-profile-avatar avatar avatar-hot">
                {profile.firstName[0]}
                {profile.lastName[0]}
              </span>
              <div>
                <h2 id="publicProfileName">
                  {profile.firstName} {profile.lastName}
                </h2>
                <span>@{profile.username}</span>
                <strong className="public-profile-role">WaveHub წევრი</strong>
                <small>შემოგვიერთდა {new Date(profile.createdAt).toLocaleDateString('ka-GE', { year: 'numeric', month: 'long' })}</small>
              </div>
            </section>

            <section className="public-profile-stats" aria-label="მომხმარებლის სტატისტიკა">
              <article>
                <i aria-hidden="true">★</i>
                <div>
                  <strong>{profile.sellerRatingAvg ?? '—'}</strong>
                  <span>რეიტინგი ({profile.sellerRatingCount})</span>
                </div>
              </article>
              <article>
                <i aria-hidden="true">▣</i>
                <div>
                  <strong>{profile.activeListingCount}</strong>
                  <span>აქტიური განცხადება</span>
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
          </>
        )}
      </div>
    </Layout>
  )
}
