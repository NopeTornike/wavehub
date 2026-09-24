import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { type MyProfile, type PublicCoachingSession, type PublicOrderSummary } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import MyListings from '../components/MyListings'
import RecordCard from '../components/RecordCard'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ORDER_STATUS_LABELS, SESSION_STATUS_LABELS } from '../lib/labels'
import { useShell } from '../lib/shell'

// The prototype's profile.html in its signed-in "control" layout (Settings) and its signed-out
// login panel, on real data:
//   - the form edits the real profile (PATCH /me/profile) and photo (POST /me/avatar — byte-sniffed
//     image upload); username stays read-only, main games are the real games table, max 2
//   - "My listings" (the prototype's listing records, with its Edit/Delete) = the seller's real
//     listings: edit goes back through moderation, delete is only possible for a never-ordered
//     listing (the API says "pause it instead" otherwise), plus pause/resume
//   - coaching sessions = real sessions as buyer and as coach; purchases = real orders as buyer
//   - #verification shows the real email-verification state (the profile menu links here)

type Status = { kind: '' | 'error' | 'success' | 'pending'; text: string }

function formatDate(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ka-GE', { year: 'numeric', month: 'short', day: 'numeric' })
}

function initials(first?: string, last?: string, username?: string) {
  const source = [first, last].filter(Boolean).join(' ') || username || '?'
  return source.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

export default function Profile() {
  const { user, checked, refresh, logout } = useAuth()
  const { games } = useShell()
  const userId = user?.id
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', bio: '', mainGameIds: [] as string[] })
  const [status, setStatus] = useState<Status>({ kind: '', text: '' })
  const [saving, setSaving] = useState(false)
  const [listingCount, setListingCount] = useState(0)
  const [sessions, setSessions] = useState<PublicCoachingSession[]>([])
  const [purchases, setPurchases] = useState<PublicOrderSummary[]>([])
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!userId) return
    api
      .getMyProfile()
      .then((p) => {
        setProfile(p)
        setForm({ firstName: p.firstName, lastName: p.lastName, bio: p.bio ?? '', mainGameIds: p.mainGameIds })
      })
      .catch(() => undefined)
    Promise.all([api.listMySessionsAsBuyer().catch(() => []), api.listMySessionsAsCoach().catch(() => [])]).then(([asBuyer, asCoach]) => {
      const all = new Map<string, PublicCoachingSession>()
      ;[...asBuyer, ...asCoach].forEach((s) => all.set(s.id, s))
      setSessions([...all.values()].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)))
    })
    api.listOrdersAsBuyer().then(setPurchases).catch(() => setPurchases([]))
  }, [userId])

  useEffect(() => {
    if (!profile || typeof window === 'undefined' || window.location.hash !== '#verification') return
    document.getElementById('verification')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [profile])

  const recordCount = listingCount + sessions.length + purchases.length

  const toggleGame = (id: string) =>
    setForm((current) => {
      if (current.mainGameIds.includes(id)) return { ...current, mainGameIds: current.mainGameIds.filter((g) => g !== id) }
      if (current.mainGameIds.length >= 2) return current
      return { ...current, mainGameIds: [...current.mainGameIds, id] }
    })

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setStatus({ kind: 'error', text: 'სახელი და გვარი სავალდებულოა.' })
      return
    }
    setSaving(true)
    setStatus({ kind: 'pending', text: 'ინახება…' })
    try {
      const next = await api.updateMyProfile({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), bio: form.bio, mainGameIds: form.mainGameIds })
      setProfile(next)
      await refresh()
      setStatus({ kind: 'success', text: 'ცვლილებები შენახულია.' })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'შენახვა ვერ მოხერხდა.') })
    } finally {
      setSaving(false)
    }
  }

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setStatus({ kind: 'error', text: 'ფოტო უნდა იყოს PNG, JPG ან WEBP, მაქსიმუმ 3MB.' })
      return
    }
    setStatus({ kind: 'pending', text: 'ფოტო იტვირთება…' })
    try {
      const next = await api.uploadAvatar(file)
      setProfile(next)
      await refresh()
      setStatus({ kind: 'success', text: 'ფოტო განახლდა.' })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'ფოტოს ატვირთვა ვერ მოხერხდა.') })
    }
  }

  const resendVerification = async () => {
    setResending(true)
    try {
      await api.resendVerification()
      setStatus({ kind: 'success', text: 'დადასტურების ბმული გაიგზავნა ელფოსტაზე.' })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'ბმულის გაგზავნა ვერ მოხერხდა.') })
    } finally {
      setResending(false)
    }
  }

  const avatarStyle = profile?.avatarUrl ? { backgroundImage: `url("${profile.avatarUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined

  return (
    <Layout title="პროფილი" noIndex>
      <section className="marketplace-head" aria-labelledby="profileTitle">
        <div>
          <p className="section-kicker">ანგარიშის მართვა</p>
          <h1 id="profileTitle">პროფილი</h1>
        </div>
        <div className="marketplace-total" aria-label="პროფილის ჩანაწერები">
          <strong id="profileRecordCount">{recordCount}</strong>
          <span>ჩანაწერი</span>
        </div>
      </section>

      {checked && !user && (
        <section className="profile-login-panel" id="profileLoginPanel">
          <div className="profile-login-visual" aria-hidden="true">
            <span className="profile-login-orbit"></span>
            <svg viewBox="0 0 48 48"><path d="M24 25c6.1 0 11-4.9 11-11S30.1 3 24 3 13 7.9 13 14s4.9 11 11 11Z" /><path d="M5 45c1.5-10.2 8-15.3 19-15.3S41.5 34.8 43 45" /><path d="m36.5 25.5 3 3 5.5-6" /></svg>
          </div>
          <div className="profile-login-copy">
            <span className="profile-login-kicker">წევრის წვდომა</span>
            <h2>ეს პროფილი შენია</h2>
            <p>შედით ანგარიშზე, მართეთ პროფილი, გამოაქვეყნეთ განცხადებები, აკონტროლეთ შეკვეთები და შეინახეთ მონაცემები სინქრონულად.</p>
            <div className="profile-login-benefits" aria-label="Account benefits">
              <span>დაცული სესია</span>
              <span>სინქრონული აქტივობა</span>
              <span>შენახული პროგრესი</span>
            </div>
          </div>
          <div className="profile-login-actions">
            <Link className="auth-open-button primary" href="/login?next=/profile">
              <span className="profile-login-action-icon" aria-hidden="true">→</span>
              <span className="profile-login-action-copy">
                <strong>შესვლა</strong>
                <small>ანგარიშზე გადასვლა</small>
              </span>
            </Link>
            <Link className="auth-open-button" href="/register">
              <span className="profile-login-action-icon" aria-hidden="true">+</span>
              <span className="profile-login-action-copy">
                <strong>ანგარიშის შექმნა</strong>
                <small>შემოუერთდით WaveHub-ს უფასოდ</small>
              </span>
            </Link>
          </div>
        </section>
      )}

      {user && (
        <section className="profile-control-layout" id="profileControlLayout">
          <form className="profile-settings-card" id="profileForm" onSubmit={save}>
            <div className="profile-photo-row">
              <span className={`profile-photo-preview avatar avatar-hot${profile?.avatarUrl ? ' avatar-image' : ''}`} id="profilePhotoPreview" style={avatarStyle}>
                {profile?.avatarUrl ? '' : initials(user.firstName, user.lastName, user.username)}
              </span>
              <label className="profile-upload-field">
                <span>პროფილის ფოტო</span>
                <span className="upload-control">
                  <span className="upload-icon" aria-hidden="true"></span>
                  <span className="upload-copy">
                    <strong>ფოტოს ატვირთვა</strong>
                    <small>PNG, JPG ან WEBP პროფილის სურათი.</small>
                  </span>
                  <input
                    id="profilePhotoInput"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      void uploadPhoto(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </span>
              </label>
            </div>
            <div className="profile-form-grid">
              <label>
                <span>მომხმარებლის სახელი</span>
                <input id="profileUsernameInput" type="text" readOnly value={user.username} />
              </label>
              <label>
                <span>სახელი</span>
                <input id="profileFirstNameInput" type="text" maxLength={40} autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </label>
              <label>
                <span>გვარი</span>
                <input id="profileLastNameInput" type="text" maxLength={40} autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </label>
            </div>
            <label className="profile-bio-field">
              <span>ბიო</span>
              <textarea id="profileBioInput" maxLength={300} rows={4} placeholder="Tell the community a little about yourself..." value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              <small>
                <span id="profileBioCount">{form.bio.length}</span>/300 characters
              </small>
            </label>
            <fieldset className="profile-main-games-field" id="profileMainGamesField">
              <legend>
                მთავარი თამაშები <small>აირჩიეთ მაქსიმუმ 2</small>
              </legend>
              <div className="profile-main-games-options">
                {games.map((game) => {
                  const checkedGame = form.mainGameIds.includes(game.gameId)
                  return (
                    <label key={game.gameId}>
                      <input
                        type="checkbox"
                        name="mainGames"
                        value={game.gameId}
                        checked={checkedGame}
                        disabled={!checkedGame && form.mainGameIds.length >= 2}
                        onChange={() => toggleGame(game.gameId)}
                      />
                      <span>{game.name}</span>
                    </label>
                  )
                })}
              </div>
              <small className="profile-main-games-help" id="profileMainGamesHelp">
                {form.mainGameIds.length} of 2 selected
              </small>
            </fieldset>
            <p className="profile-verification" id="verification">
              {user.status === 'active' ? (
                <>✓ ელფოსტა დადასტურებულია</>
              ) : (
                <>
                  ელფოსტა ჯერ არ არის დადასტურებული.{' '}
                  <button type="button" className="secondary-seller-action" onClick={resendVerification} disabled={resending}>
                    ბმულის ხელახლა გაგზავნა
                  </button>
                </>
              )}
            </p>
            <div className="profile-form-actions">
              <button className="seller-submit-button" type="submit" disabled={saving}>
                ცვლილებების შენახვა
              </button>
              <Link className="secondary-seller-action" id="profilePublicLink" href={`/u/${user.username}`}>
                საჯარო პროფილის ნახვა
              </Link>
              <button className="secondary-seller-action" id="profileLogoutButton" type="button" onClick={() => void logout()}>
                გასვლა
              </button>
              <p className={`seller-status${status.kind ? ` ${status.kind}` : ''}`} id="profileStatus" aria-live="polite">
                {status.text}
              </p>
            </div>
          </form>

          <MyListings gridId="profileListings" onCount={setListingCount} />

          <section className="profile-record-section" aria-labelledby="profileSessionsTitle">
            <div className="section-heading">
              <div>
                <p className="section-kicker">ქოუჩინგი</p>
                <h2 id="profileSessionsTitle">ქოუჩინგის სესიები</h2>
              </div>
              <Link className="secondary-seller-action" id="profileAddSessionButton" href="/coaching">
                სესიის დამატება
              </Link>
            </div>
            <div className="profile-record-grid" id="profileSessions">
              {sessions.map((session) => {
                const asCoach = session.coachUserId === user.id
                return (
                  <RecordCard
                    key={session.id}
                    href={`/coaching-sessions/${session.id}`}
                    fallback="CS"
                    title={asCoach ? `სესია — ${session.buyerUsername}` : `სესია — ${session.coachFirstName} ${session.coachLastName}`}
                    meta={`${asCoach ? 'ქოუჩი' : 'მყიდველი'} / ${SESSION_STATUS_LABELS[session.status]}`}
                    footer={`${new Date(session.scheduledAt).toLocaleString('ka-GE', { dateStyle: 'medium', timeStyle: 'short' })} / ${session.durationMinutes} წთ / ${session.priceWaveCoin} WC`}
                  />
                )
              })}
            </div>
            <div className="marketplace-empty" id="profileSessionsEmpty" hidden={sessions.length > 0}>
              ქოუჩინგის სესიები ჯერ არ არის.
            </div>
          </section>

          <section className="profile-record-section" aria-labelledby="profilePurchasesTitle">
            <div className="section-heading">
              <div>
                <p className="section-kicker">შეკვეთების ისტორია</p>
                <h2 id="profilePurchasesTitle">ჩემი შესყიდვები</h2>
              </div>
              <Link href="/cart">კალათის გახსნა</Link>
            </div>
            <div className="profile-record-grid" id="profilePurchases">
              {purchases.map((order) => (
                <RecordCard
                  key={order.id}
                  href={`/orders/${order.id}`}
                  fallback="OR"
                  title={order.listing.title}
                  meta={`#${order.orderNumber} / ${order.seller.username}`}
                  footer={`${ORDER_STATUS_LABELS[order.status]} / ${formatDate(order.createdAt)} / ${order.priceWaveCoin} WC`}
                />
              ))}
            </div>
            <div className="marketplace-empty" id="profilePurchasesEmpty" hidden={purchases.length > 0}>
              შესყიდვები ჯერ არ არის.
            </div>
          </section>
        </section>
      )}
    </Layout>
  )
}

