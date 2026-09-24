import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type ReactNode } from 'react'
import type { PublicUserProfile } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { gameCover } from '../../lib/games'

// docs/design-mockups/12-public-profile.jpg: hero (photo with real online dot, name, @handle,
// WaveHubX ID with copy, role, location, join date, tagline, Message / Follow), the Wave Rank panel,
// the stats bar (followers, following, Wave Score, rating, online), Game Profile, About Me, earned
// Badges and Reviews with the star distribution and latest review. Self-entered: photo, bio,
// tagline, location, main game, platform, preferred role, notable achievement (Settings). Computed:
// everything else. A field the member hasn't filled in is left out rather than invented.

const ROLE_LABEL: Record<PublicUserProfile['role'], string> = { coach: 'ქოუჩი', seller: 'გამყიდველი', player: 'მოთამაშე' }

const BADGE_ICON: Record<string, ReactNode> = {
  tier: <path d="m12 2 8 5v10l-8 5-8-5V7l8-5Zm0 5-4 2.5v5L12 17l4-2.5v-5L12 7Z" />,
  champion: <><path d="M7 3h10v5a5 5 0 0 1-10 0V3Z" /><path d="M7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4M12 13v4m-4 4h8m-6-4h4" /></>,
  finalist: <><path d="M7 3h10v5a5 5 0 0 1-10 0V3Z" /><path d="M12 13v4m-4 4h8m-6-4h4" /></>,
  coach: <><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  'top-rated': <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  'trusted-seller': <><circle cx="12" cy="8" r="5" /><path d="m8.5 12.5-2 8.5 5.5-3 5.5 3-2-8.5" /></>,
  'deals-100': <><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></>,
  'first-deal': <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
}

export default function PublicProfile() {
  const router = useRouter()
  const { username } = router.query as { username?: string }
  const { user: me } = useAuth()
  const meId = me?.id
  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [error, setError] = useState('')
  const [following, setFollowing] = useState(false)
  const [status, setStatus] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!username) return
    let cancelled = false
    api
      .getUserProfile(username)
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'პროფილი ვერ მოიძებნა.'))
      })
    return () => {
      cancelled = true
    }
  }, [username])

  useEffect(() => {
    if (!meId || !username) return
    api
      .getFollowStatus(username)
      .then((res) => setFollowing(res.following))
      .catch(() => undefined)
  }, [meId, username])

  if (!profile) {
    return (
      <Layout title="პროფილი" noIndex={!!error}>
        <section className="up-page">
          <div className="wt-empty">{error ? <strong>{error}</strong> : 'იტვირთება…'}</div>
        </section>
      </Layout>
    )
  }

  const p = profile
  const name = `${p.firstName} ${p.lastName}`.trim() || p.username
  const own = me?.username === p.username
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  const mainGame = p.mainGames[0] ?? null
  const joined = new Date(p.createdAt).toLocaleDateString('ka-GE', { month: 'short', year: 'numeric' })
  const rating = p.reviews.average
  const gameFacts: Array<[string, string | null]> = [
    ['ძირითადი თამაში', mainGame?.name ?? null],
    ['პლატფორმა', p.platform],
    ['სასურველი როლი / სტილი', p.preferredRole],
    ['გამორჩეული მიღწევა', p.achievement],
  ]

  const toggleFollow = async () => {
    if (!me) {
      router.push(`/login?next=/u/${p.username}`)
      return
    }
    try {
      const res = following ? await api.unfollowUser(p.username) : await api.followUser(p.username)
      setFollowing(res.following)
      setProfile({ ...p, followers: res.followers })
    } catch (err) {
      setStatus(errorMessage(err, 'მოქმედება ვერ შესრულდა.'))
    }
  }

  const message = async () => {
    if (!me) {
      router.push(`/login?next=/u/${p.username}`)
      return
    }
    try {
      const conversation = await api.startDirectConversation(p.userId)
      router.push(`/messages?conversation=${conversation.id}`)
    } catch (err) {
      setStatus(errorMessage(err, 'მიწერა შესაძლებელია ერთმანეთთან გარიგების შემდეგ.'))
    }
  }

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(p.shortId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — nothing to do
    }
  }

  return (
    <Layout title={`${name} (@${p.username})`} description={(p.tagline || p.bio || `${name} — WaveHubX`).slice(0, 160)}>
      <section className="up-page">
        <header className="up-hero">
          <div className="up-avatar-wrap">
            <div className="up-avatar" style={p.avatarUrl ? { backgroundImage: `url("${p.avatarUrl}")` } : undefined}>
              {p.avatarUrl ? '' : initials}
            </div>
            {p.online && <i className="up-online-dot" title="ონლაინ" aria-label="ონლაინ"></i>}
          </div>
          <div className="up-identity">
            <h1>
              {name}
              {(p.coachId || p.badges.some((b) => b.key === 'trusted-seller')) && <span className="up-verified" aria-label="ვერიფიცირებული" role="img"></span>}
            </h1>
            <p className="up-handle">@{p.username}</p>
            <p className="up-id">
              WaveHubX ID: {p.shortId}
              <button type="button" onClick={() => void copyId()} aria-label="ID-ის კოპირება">
                {copied ? '✓' : '⧉'}
              </button>
            </p>
            <span className="up-role">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6L14 14h-4l-1 1.6A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4Z" />
              </svg>
              {p.profileBadge ?? ROLE_LABEL[p.role]}
            </span>
            <p className="up-meta">
              {p.location && (
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                  {p.location}
                </span>
              )}
              <span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 10h18" />
                </svg>
                შემოგვიერთდა {joined}
              </span>
            </p>
            {p.tagline && <p className="up-tagline">{p.tagline}</p>}
            <div className="up-actions">
              {own ? (
                <Link className="up-btn primary" href="/profile">
                  პროფილის რედაქტირება
                </Link>
              ) : (
                <>
                  <button type="button" className="up-btn primary" onClick={() => void message()}>
                    მიწერა
                  </button>
                  <button type="button" className={`up-btn${following ? ' on' : ''}`} aria-pressed={following} onClick={() => void toggleFollow()}>
                    {following ? 'გამოწერილია ✓' : '+ გამოწერა'}
                  </button>
                </>
              )}
              {p.coachId && (
                <Link className="up-btn" href={`/coaching/${p.coachId}`}>
                  ქოუჩის პროფილი
                </Link>
              )}
            </div>
            {status && (
              <p className="seller-status error" role="alert">
                {status}
              </p>
            )}
          </div>
          <aside className="up-rank">
            <small>WAVE RANK</small>
            <div>
              <span className="up-rank-gem" aria-hidden="true">
                <svg viewBox="0 0 24 24">{BADGE_ICON.tier}</svg>
              </span>
              <span>
                <strong>{p.waveRank.name}</strong>
                <em>დონე {p.waveRank.level}</em>
              </span>
            </div>
            {p.waveRank.nextName !== p.waveRank.name && (
              <p>
                შემდეგი რანგი: {p.waveRank.nextName} ({p.waveRank.progressToNext}%)
              </p>
            )}
            <i>
              <b style={{ width: `${p.waveRank.progressToNext}%` }}></b>
            </i>
          </aside>
          <p className="up-slogan" aria-hidden="true">
            Play.
            <br />
            Connect.
            <br />
            Earn.
          </p>
        </header>

        <section className="up-stats" aria-label="სტატისტიკა">
          {(
            [
              ['users', String(p.followers), 'გამომწერი'],
              ['user', String(p.following), 'გამოწერილი'],
              ['chart', String(Math.round(p.waveRank.score)), 'Wave Score'],
              ['star', rating === null ? '—' : rating.toFixed(1), 'რეიტინგი'],
            ] as const
          ).map(([icon, value, label]) => (
            <div key={label}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {icon === 'users' ? (
                  <>
                    <circle cx="9" cy="8" r="3.5" />
                    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5.5 5.5 0 0 1 3.5 6" />
                  </>
                ) : icon === 'user' ? (
                  <>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </>
                ) : icon === 'chart' ? (
                  <path d="M5 20V12m5 8V6m5 14v-9m5 9V4" />
                ) : (
                  <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
                )}
              </svg>
              <span>
                <strong>{value}</strong>
                <small>{label}</small>
              </span>
            </div>
          ))}
          <div>
            <i className={`up-dot${p.online ? ' on' : ''}`} aria-hidden="true"></i>
            <span>
              <strong>{p.online ? 'ონლაინ' : 'ოფლაინ'}</strong>
              <small>{p.online ? 'ახლა აქტიურია' : 'ამჟამად არ არის'}</small>
            </span>
          </div>
        </section>

        <div className="up-grid">
          <section className="up-card up-game">
            <header>
              <h2>თამაშის პროფილი</h2>
              <p>სწრაფი მიმოხილვა</p>
            </header>
            <div className="up-game-body">
              <div className="up-game-cover" style={mainGame && gameCover(mainGame.slug) ? { backgroundImage: `url('${gameCover(mainGame.slug)}')` } : undefined}>
                {!mainGame && <span>თამაში არ არის არჩეული</span>}
              </div>
              <dl>
                {gameFacts
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                {gameFacts.every(([, value]) => !value) && <p className="up-muted">ჯერ არ შეუვსია.</p>}
              </dl>
            </div>
          </section>

          <section className="up-card up-about">
            <header>
              <h2>ჩემ შესახებ</h2>
              {own && <Link href="/profile">რედაქტირება</Link>}
            </header>
            <div className="up-about-body">
              <p>{p.bio || (own ? 'დაამატე მოკლე აღწერა პარამეტრებში.' : 'ჯერ არ შეუვსია.')}</p>
              <blockquote>
                <span>“</span>
                {p.tagline || 'Play. Connect. Earn.'}
                <small>WAVEHUBX</small>
              </blockquote>
            </div>
          </section>

          <section className="up-card up-badges">
            <header>
              <h2>ბეჯები</h2>
              <p>მიღწევები და აღიარება</p>
            </header>
            <div className="up-badge-row">
              {p.badges.map((badge) => (
                <div key={badge.key} className={`up-badge ${badge.key}`}>
                  <span aria-hidden="true">
                    <svg viewBox="0 0 24 24">{BADGE_ICON[badge.key] ?? BADGE_ICON.tier}</svg>
                  </span>
                  <small>{badge.label}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="up-card up-reviews">
            <header>
              <h2>შეფასებები ({p.reviews.count})</h2>
              <p>რას ამბობს საზოგადოება</p>
            </header>
            {p.reviews.count === 0 ? (
              <p className="up-muted">შეფასებები ჯერ არ არის — მათ მყიდველები და სტუდენტები ტოვებენ დასრულებული გარიგების შემდეგ.</p>
            ) : (
              <div className="up-reviews-body">
                <div className="up-score">
                  <strong>{rating?.toFixed(1)}</strong>
                  <span className="gold">{'★'.repeat(Math.round(rating ?? 0))}</span>
                  <small>{p.reviews.count} შეფასების მიხედვით</small>
                </div>
                <ul className="up-bars">
                  {p.reviews.distribution.map((n, i) => {
                    const pct = Math.round((n / p.reviews.count) * 100)
                    return (
                      <li key={i}>
                        <span>{5 - i} ★</span>
                        <i>
                          <b style={{ width: `${pct}%` }}></b>
                        </i>
                        <small>{pct}%</small>
                      </li>
                    )
                  })}
                </ul>
                {p.reviews.latest[0] && (
                  <article className="up-review">
                    <header>
                      <strong>@{p.reviews.latest[0].buyerUsername}</strong>
                      <small>{new Date(p.reviews.latest[0].createdAt).toLocaleDateString('ka-GE')}</small>
                    </header>
                    <span className="gold">{'★'.repeat(p.reviews.latest[0].rating)}</span>
                    <p>{p.reviews.latest[0].body || 'კომენტარის გარეშე'}</p>
                  </article>
                )}
              </div>
            )}
          </section>
        </div>

        {p.activeListingCount > 0 && (
          <p className="up-listings-link">
            აქტიური განცხადებები: {p.activeListingCount} · დასრულებული გარიგებები: {p.completedDeals}
          </p>
        )}
      </section>
    </Layout>
  )
}
