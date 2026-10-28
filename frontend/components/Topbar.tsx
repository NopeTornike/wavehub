import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { WAVE_RANK_TIERS } from '@wavehub/shared-types'
import type { PublicUserSearchResult } from '@wavehub/shared-types'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useAuthModal } from '../lib/auth-modal'
import { useCart } from '../lib/cart'
import { useShell } from '../lib/shell'
import LanguageSwitcher from './LanguageSwitcher'
import NotificationCenter from './NotificationCenter'
import RankIcon from './RankIcon'
import { gel } from '../lib/money'

// The static prototype's global topbar (profile-nav.js#standardizeTopbars + getProfileMenuMarkup),
// markup-for-markup, on real data: the search box submits to /marketplace?q=, the message/cart/
// notification badges are real counts, the wallet pill is the real WaveCoin balance, and the
// profile dropdown's Wave rank tier/level/points come from GET /me/wave-rank.
//
// Plain <img> (not next/image) throughout: these are fixed-size decorative icons the prototype's
// CSS sizes directly, and next/image's wrapper spans would change the selectors' structure.
/* eslint-disable @next/next/no-img-element */

// A plain person outline for a visitor who isn't signed in (instead of a "?" in the avatar circle).
function GuestIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

function initials(firstName?: string, lastName?: string, username?: string) {
  const source = [firstName, lastName].filter(Boolean).join(' ') || username || '?'
  return source
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

const ICONS = {
  services: 'M4 8h16v11H4z|M9 8V5h6v3|M4 13h16',
  orders: 'm4 7 8-4 8 4-8 4-8-4Z|M4 7v10l8 4 8-4V7M12 11v10',
  favorites: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z',
  support: 'M4 13v-2a8 8 0 0 1 16 0v2|M4 12H2v5a2 2 0 0 0 2 2h2v-7H4Zm16 0h2v5a2 2 0 0 1-2 2h-2v-7h2ZM18 19c0 2-2 2-4 2',
  profile: 'M4 21v-2a8 8 0 0 1 16 0v2',
  verified: 'm12 3 7 3v5c0 4.6-2.9 8.2-7 10-4.1-1.8-7-5.4-7-10V6l7-3Z|m9 12 2 2 4-4',
  plans: 'M4 7h16v12H4zM4 11h16M8 3v4M16 3v4',
  admin: 'M12 3 20 6v6c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6l8-3Z',
  tournaments: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z|M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3',
}

function MenuIcon({ paths, circle }: { paths: string; circle?: [number, number, number] }) {
  return (
    <span className="profile-menu-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        {circle && <circle cx={circle[0]} cy={circle[1]} r={circle[2]} />}
        {paths.split('|').map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  )
}

const SETTINGS_PATH =
  'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z'

// A page that filters its own content from the topbar search box (orders.html's "Search orders,
// games or users..."): the box then drives that page's filter live instead of submitting to
// /marketplace.
export type TopbarSearch = { value: string; onChange: (value: string) => void; placeholder: string; label: string }

export default function Topbar({
  onMenuClick,
  sidebarOpen,
  action,
  pageSearch,
}: {
  onMenuClick: () => void
  sidebarOpen: boolean
  action?: ReactNode
  pageSearch?: TopbarSearch
}) {
  const router = useRouter()
  const { user, checked, logout } = useAuth()
  const { openLogin } = useAuthModal()
  const { count: cartCount } = useCart()
  const { unreadMessages, unreadNotifications, waveRank } = useShell()
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [search, setSearch] = useState('')
  // Phones (home page): the search box is a 40px icon; tapping it opens a full-width search field.
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInput = useRef<HTMLInputElement>(null)
  // Live user suggestions under the search box (GET users/search, debounced; ≥2 characters).
  const [userHits, setUserHits] = useState<PublicUserSearchResult[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const searchRef = useRef<HTMLFormElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  const signedIn = checked && Boolean(user)
  const avatar = user ? initials(user.firstName, user.lastName, user.username) : '?'
  // profile-nav.js#applyAvatar: an uploaded photo replaces the initials via .avatar-image.
  const photo = user?.avatarUrl ?? null
  const avatarClass = `avatar avatar-hot${photo ? ' avatar-image' : ''}`
  const avatarStyle = photo ? { backgroundImage: `url("${photo}")` } : undefined
  const avatarText = photo ? '' : avatar
  const fullName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username : 'სტუმრის ანგარიში'
  const rankName = waveRank?.name ?? WAVE_RANK_TIERS[0][0]
  const nextRank = waveRank?.nextName ?? WAVE_RANK_TIERS[1][0]
  // The return path is only known after hydration (a statically prerendered page's server HTML has
  // no query string), so it's filled in client-side to avoid a server/client href mismatch.
  const [returnTo, setReturnTo] = useState('')
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReturnTo(router.asPath)
  }, [router.asPath])
  const loginHref = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login'

  useEffect(() => {
    const q = router.query.q
    // Keep the box in sync with a /marketplace?q= the user navigated to (back/forward, shared links).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(typeof q === 'string' ? q : '')
  }, [router.query.q])

  useEffect(() => {
    const q = search.trim().replace(/^@/, '')
    if (q.length < 2 || q.length > 40) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserHits([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      api
        .searchUsers(q)
        .then((rows) => {
          if (!cancelled) setUserHits(rows)
        })
        .catch(() => {
          if (!cancelled) setUserHits([])
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [search])

  useEffect(() => {
    if (!suggestOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSuggestOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [suggestOpen])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSuggestOpen(false)
  }, [router.asPath])

  useEffect(() => {
    if (!profileOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setProfileOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [profileOpen])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfileOpen(false)
    setNotificationsOpen(false)
  }, [router.asPath])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const q = search.trim()
    router.push(q ? `/marketplace?q=${encodeURIComponent(q)}` : '/marketplace')
  }

  const closeMenu = () => setProfileOpen(false)

  return (
    <header className="topbar global-topbar">
      <button
        className="menu-toggle"
        id="menuToggle"
        type="button"
        aria-label="მენიუს გახსნა"
        aria-controls="sidebar"
        aria-expanded={sidebarOpen}
        onClick={onMenuClick}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <Link className="mobile-header-brand" href="/" aria-label="WaveHubX home">
        <img src="/assets/logo-wavehubx-main.png" alt="WaveHubX" />
      </Link>

      {pageSearch ? (
        <form className="search-box" role="search" aria-label={pageSearch.label} onSubmit={(event) => event.preventDefault()}>
          <span className="search-icon" aria-hidden="true">
            /
          </span>
          <input
            id="pageSearch"
            type="search"
            placeholder={pageSearch.placeholder}
            autoComplete="off"
            maxLength={100}
            value={pageSearch.value}
            onChange={(event) => pageSearch.onChange(event.target.value)}
          />
        </form>
      ) : (
        <form
          className={`search-box${suggestOpen && search.trim().length >= 2 ? ' is-suggesting' : ''}${searchOpen ? ' is-open' : ''}`}
          role="search"
          aria-label="ძიება"
          onSubmit={(event) => {
            setSearchOpen(false)
            submitSearch(event)
          }}
          ref={searchRef}
        >
          <span className="search-icon" aria-hidden="true">
            /
          </span>
          {/* Only shown while the box is collapsed to an icon (phones): opens the search field. */}
          <button
            type="button"
            className="search-open-btn"
            aria-label="ძიების გახსნა"
            onClick={() => {
              setSearchOpen(true)
              window.setTimeout(() => searchInput.current?.focus(), 0)
            }}
          />
          {searchOpen && (
            <button type="button" className="search-close-btn" aria-label="ძიების დახურვა" onClick={() => setSearchOpen(false)}>
              ×
            </button>
          )}
          <input
            ref={searchInput}
            id="marketSearch"
            type="search"
            placeholder="მოძებნე თამაშები, სერვისები ან მოთამაშეები..."
            autoComplete="off"
            maxLength={100}
            value={search}
            role="combobox"
            aria-autocomplete="list"
            aria-controls="searchSuggestions"
            aria-expanded={suggestOpen && search.trim().length >= 2}
            onFocus={() => setSuggestOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSuggestOpen(false)
                setSearchOpen(false)
              }
            }}
            onChange={(event) => {
              setSearch(event.target.value)
              setSuggestOpen(true)
            }}
          />
          {suggestOpen && search.trim().length >= 2 && (
            <div className="search-suggest" id="searchSuggestions" role="listbox" aria-label="ძიების შედეგები">
              {userHits.length > 0 && (
                <>
                  <p className="search-suggest-title">მომხმარებლები</p>
                  {userHits.map((u) => (
                    <Link key={u.id} role="option" aria-selected={false} className="search-suggest-user" href={`/u/${encodeURIComponent(u.username)}`}>
                      <i style={u.avatarUrl ? { backgroundImage: `url("${u.avatarUrl}")` } : undefined} aria-hidden="true">
                        {u.avatarUrl ? '' : u.username.slice(0, 1).toUpperCase()}
                      </i>
                      <span>@{u.username}</span>
                    </Link>
                  ))}
                </>
              )}
              <Link role="option" aria-selected={false} className="search-suggest-market" href={`/marketplace?q=${encodeURIComponent(search.trim())}`}>
                მოძებნე მარკეტში: „{search.trim()}“
              </Link>
            </div>
          )}
        </form>
      )}

      <div className={`top-actions${signedIn ? ' is-signed-in' : ''}`}>
        <LanguageSwitcher />
        <Link className="icon-button" href={signedIn ? '/messages' : loginHref} aria-label="შეტყობინებები" title="შეტყობინებები">
          <img className="message-icon-image" src="/assets/message-icon.svg" alt="" aria-hidden="true" />
          <span className="message-notification-badge" hidden={unreadMessages === 0}>
            {unreadMessages > 99 ? '99+' : unreadMessages}
          </span>
        </Link>
        <Link className="icon-button cart-top-button" href="/cart" aria-label="კალათა" title="კალათა">
          <img className="cart-icon-image" src="/assets/cart-icon.png" alt="" aria-hidden="true" />
          <strong className="cart-badge" data-cart-count="">
            {cartCount}
          </strong>
        </Link>
        <button
          ref={bellRef}
          className={`icon-button has-alert${unreadNotifications > 0 ? ' has-notifications' : ''}`}
          type="button"
          aria-label="შეტყობინებები"
          title="შეტყობინებები"
          aria-haspopup="dialog"
          aria-expanded={notificationsOpen}
          onClick={(event) => {
            event.stopPropagation()
            setNotificationsOpen((open) => !open)
          }}
        >
          <span aria-hidden="true">!</span>
          <span className="notification-count-badge" hidden={unreadNotifications === 0}>
            {unreadNotifications > 99 ? '99+' : unreadNotifications}
          </span>
        </button>
        {/* Signed out there is no balance to show (owner screenshot 07: "0 GEL" + "?"). */}
        {signedIn && (
          <Link className="home-top-wallet" href="/wallet" aria-label="Wallet balance">
            <span id="homeTopWalletBalance">{gel(user?.wavecoinBalance)}</span> GEL
          </Link>
        )}

        {action}
        <div className="profile-menu" id="profileMenu" ref={menuRef}>
          <button
            className="profile-chip"
            id="profileButton"
            type="button"
            aria-label="Profile menu"
            aria-haspopup="true"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((open) => !open)}
          >
            <span className={avatarClass} id="profileAvatar" style={avatarStyle}>
              {user ? avatarText : <GuestIcon />}
            </span>
          </button>

          <div className="profile-dropdown profile-dropdown-rich" id="profileDropdown" hidden={!profileOpen}>
            <div className="profile-dropdown-head">
              <span className="profile-panel-avatar-wrap">
                <span className={avatarClass} id="profilePanelAvatar" style={avatarStyle}>
                  {avatarText}
                </span>
                {signedIn && <i aria-label="ონლაინ"></i>}
              </span>
              <div className="profile-dropdown-identity">
                <div className="profile-dropdown-name-row">
                  <strong id="profileFullName">{fullName}</strong>
                  {user?.status === 'active' && (
                    <span className="profile-verified-mark" aria-label="Verified">
                      ✓
                    </span>
                  )}
                </div>
                <small>
                  <RankIcon name={rankName} className="profile-rank-icon" />
                  <span id="profileDropdownRank">{rankName}</span>
                </small>
                <span className="profile-tier">
                  <RankIcon name={rankName} className="profile-rank-icon" />
                  <b id="profileTierName">{rankName}</b>
                  <i aria-hidden="true">→</i>
                  <strong id="profileNextTier">{nextRank}</strong>
                </span>
              </div>
            </div>

            <div className="profile-level-row" aria-label="ანგარიშის დონე">
              <span>
                Lv. <strong id="profileDropdownLevel">{waveRank?.level ?? 1}</strong>
              </span>
              <i>
                <b id="profileDropdownProgress" style={{ width: `${Math.round(((waveRank?.score ?? 0) / 1000) * 100)}%` }}></b>
              </i>
              <small>
                <span id="profileDropdownXp">{waveRank?.score ?? 0}</span> / <span id="profileDropdownXpGoal">1000</span> WAVE PTS
              </small>
            </div>

            {/* The account menu is English in both languages, in the owner's order (2026-10-15). */}
            <nav className="profile-dropdown-links" aria-label="Profile shortcuts" data-i18n-keep="">
              <div className="profile-dropdown-group">
                <Link href={signedIn ? '/orders' : loginHref} onClick={closeMenu}>
                  <MenuIcon paths={ICONS.orders} />
                  <span>My Orders</span>
                  <i aria-hidden="true">›</i>
                </Link>
                <Link href={signedIn ? '/orders#my-listings' : loginHref} onClick={closeMenu}>
                  <MenuIcon paths={ICONS.services} />
                  <span>My Listings</span>
                  <i aria-hidden="true">›</i>
                </Link>
                <Link href={signedIn ? '/tournaments/hub' : loginHref} onClick={closeMenu}>
                  <MenuIcon paths={ICONS.tournaments} />
                  <span>My Tournaments</span>
                  <i aria-hidden="true">›</i>
                </Link>
                <Link href={signedIn ? '/support/chat' : loginHref} onClick={closeMenu}>
                  <MenuIcon paths={ICONS.support} />
                  <span>Contact Support</span>
                  <i aria-hidden="true">›</i>
                </Link>
                <Link href={signedIn ? '/profile' : loginHref} onClick={closeMenu}>
                  <MenuIcon paths={SETTINGS_PATH} circle={[12, 12, 3]} />
                  <span>Settings</span>
                  <i aria-hidden="true">›</i>
                </Link>
                {user?.adminRole && (
                  <Link href="/admin" onClick={closeMenu}>
                    <MenuIcon paths={ICONS.admin} />
                    <span>Admin Panel</span>
                    <i aria-hidden="true">›</i>
                  </Link>
                )}
              </div>
              <div className="profile-dropdown-group">
                <Link id="profilePublicLink" href={user ? `/u/${user.username}` : loginHref} onClick={closeMenu}>
                  <MenuIcon paths={ICONS.profile} circle={[12, 8, 4]} />
                  <span>My Profile</span>
                </Link>
                <Link href={signedIn ? '/plans' : loginHref} onClick={closeMenu}>
                  <MenuIcon paths={ICONS.plans} />
                  <span>Subscriptions</span>
                </Link>
                <Link href={signedIn ? '/profile#verification' : loginHref} onClick={closeMenu}>
                  <MenuIcon paths={ICONS.verified} />
                  <span>Verified Status</span>
                </Link>
              </div>
            </nav>

            <div className="auth-entry-actions" id="authEntryActions" hidden={signedIn}>
              <button
                className="auth-open-button"
                type="button"
                onClick={() => {
                  closeMenu()
                  openLogin(returnTo)
                }}
              >
                შესვლა
              </button>
              <Link className="auth-open-button primary" href="/register" onClick={closeMenu}>
                ანგარიშის შექმნა
              </Link>
            </div>

            <button
              className="logout-button"
              id="logoutButton"
              type="button"
              hidden={!signedIn}
              disabled={!signedIn}
              onClick={() => {
                closeMenu()
                void logout()
              }}
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      <div className={`mobile-header-auth${signedIn ? ' is-signed-in' : ''}`} aria-label="Account actions">
        <button type="button" className="mobile-sign-in" onClick={() => openLogin(returnTo)}>
          Sign In
        </button>
        <Link className="join" href="/register">
          Join
        </Link>
        <Link className="mobile-user-profile" id="mobileUserProfile" href={user ? `/u/${user.username}` : loginHref} aria-label="Open profile">
          <span className={avatarClass} id="mobileHeaderAvatar" style={avatarStyle}>
            {user ? avatarText : <GuestIcon />}
          </span>
        </Link>
      </div>

      <NotificationCenter open={notificationsOpen} anchor={bellRef} onClose={() => setNotificationsOpen(false)} />
    </header>
  )
}
