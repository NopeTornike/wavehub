import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { useShell } from '../lib/shell'

// The static prototype's sidebar (profile-nav.js#standardizeNavigation + the marketplace game
// menu), item-for-item: same order, icons, labels and the Marketplace flyout listing games. Real
// data behind it: the game list is the games table (GET /stats/games), the Messages pill is the real
// unread direct-message count, the Cart pill is the cart, and "N online" counts accounts seen in
// the last few minutes (backend/src/community/) instead of the prototype's random number. Staff
// accounts get one extra "Admin" entry at the end — the admin panel has no prototype equivalent.
// Order (owner 2026-10-15): Home, Dashboard, Marketplace, Services, Steam Keys, Coaching,
// Tournaments, About Us, Messages, Wallet, Cart, Favorites. Subscriptions are in the profile menu.
/* eslint-disable @next/next/no-img-element */

type NavItem = {
  id: string
  label: string
  href: string
  icon: string
  iconClass: string
  count?: 'message' | 'cart'
  match: (path: string) => boolean
}

const NAV: NavItem[] = [
  { id: 'index', label: 'Home', href: '/', icon: 'home-icon.svg', iconClass: 'nav-icon-home', match: (p) => p === '/' },
  {
    id: 'marketplace',
    label: 'Marketplace',
    href: '/marketplace',
    icon: 'marketplace-icon.svg',
    iconClass: 'nav-icon-marketplace',
    match: (p) => p === '/marketplace' || p.startsWith('/listings'),
  },
  // Services have their own page (client feedback #7).
  { id: 'services', label: 'Services', href: '/services', icon: 'active-services-icon.svg', iconClass: 'nav-icon-marketplace', match: (p) => p === '/services' || p.startsWith('/sell/services') },
  { id: 'steam-keys', label: 'Steam Keys', href: '/steam-keys', icon: 'steam-logo.png', iconClass: 'steam-side-icon', match: (p) => p.startsWith('/steam-keys') || p.startsWith('/sell/digital-keys') },
  { id: 'coaching', label: 'Coaching', href: '/coaching', icon: 'sidebar-coaching-icon.svg', iconClass: 'nav-icon-coaching', match: (p) => p.startsWith('/coaching') },
  { id: 'tournaments', label: 'Tournaments', href: '/tournaments', icon: 'tournaments-icon.svg', iconClass: 'nav-icon-tournaments', match: (p) => p.startsWith('/tournaments') },
  { id: 'about', label: 'About Us', href: '/about', icon: 'about-icon.svg', iconClass: 'nav-icon-about', match: (p) => p === '/about' },
  { id: 'messages', label: 'Messages', href: '/messages', icon: 'sidebar-message-icon.svg', iconClass: 'nav-icon-messages', count: 'message', match: (p) => p.startsWith('/messages') },
  { id: 'wallet', label: 'Wallet', href: '/wallet', icon: 'wallet-icon.svg', iconClass: 'nav-icon-wallet', match: (p) => p.startsWith('/wallet') },
  { id: 'cart', label: 'Cart', href: '/cart', icon: 'sidebar-cart-icon.svg', iconClass: 'nav-icon-cart', count: 'cart', match: (p) => p.startsWith('/cart') },
  { id: 'favorites', label: 'Favorites', href: '/favorites', icon: 'favorites-icon.svg', iconClass: 'nav-icon-heart', match: (p) => p.startsWith('/favorites') },
]

// Signed-in only (docs/design-mockups/09).
const DASHBOARD: NavItem = { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'dashboard-icon.svg', iconClass: 'nav-icon-home', match: (p) => p === '/dashboard' }

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { user } = useAuth()
  const { count: cartCount } = useCart()
  const { unreadMessages, onlineCount, games } = useShell()
  const [gameMenuOpen, setGameMenuOpen] = useState(false)
  const gameMenuRef = useRef<HTMLDivElement>(null)
  const path = router.pathname

  useEffect(() => {
    if (!gameMenuOpen) return
    const onClick = (event: MouseEvent) => {
      if (gameMenuRef.current && !gameMenuRef.current.contains(event.target as Node)) setGameMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGameMenuOpen(false)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [gameMenuOpen])

  const pill = (item: NavItem) => {
    if (item.count === 'message') return <span className="nav-pill" id="messageCount">{unreadMessages}</span>
    if (item.count === 'cart') return <span className="nav-pill" id="cartNavCount" data-cart-count="">{cartCount}</span>
    return null
  }

  const linkBody = (item: NavItem) => (
    <>
      <span className={`nav-icon ${item.iconClass}`} aria-hidden="true">
        <img src={`/assets/${item.icon}`} alt="" />
      </span>
      <span>{item.label}</span>
    </>
  )

  return (
    <>
      {/* Navigation stays in English in both languages (owner, 2026-10-15). */}
      <aside className="sidebar" id="sidebar" aria-label="WaveHub navigation" data-i18n-keep="">
        <Link className="brand" href="/" aria-label="WaveHub home" onClick={onClose}>
          <img src="/assets/logo-wavehubx-main.png" alt="WaveHubX" />
        </Link>

        <nav className="side-nav" aria-label="Main pages">
          {(user ? [NAV[0], DASHBOARD, ...NAV.slice(1)] : NAV).map((item) => {
            const active = item.match(path)
            if (item.id === 'marketplace') {
              return (
                <div key={item.id} className={`marketplace-game-menu${gameMenuOpen ? ' open' : ''}`} ref={gameMenuRef}>
                  <a
                    className={`side-link${active ? ' active' : ''}`}
                    href={item.href}
                    data-section="Marketplace"
                    aria-haspopup="true"
                    aria-expanded={gameMenuOpen}
                    onClick={(event) => {
                      // Same as the prototype: the Marketplace entry toggles the game flyout; "all games" is inside it.
                      event.preventDefault()
                      setGameMenuOpen((value) => !value)
                    }}
                  >
                    {linkBody(item)}
                    <span className="marketplace-menu-arrow" aria-hidden="true"></span>
                  </a>
                  <div className="marketplace-game-dropdown" aria-label="Marketplace games">
                    <Link href="/marketplace" onClick={onClose}>
                      All Games
                    </Link>
                    {games.map((game) => (
                      <Link key={game.slug} href={`/marketplace?game=${game.slug}`} onClick={onClose}>
                        {game.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            }
            return (
              <Link
                key={item.id}
                className={`side-link${active ? ' active' : ''}`}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={onClose}
              >
                {linkBody(item)}
                {pill(item)}
              </Link>
            )
          })}
          {/* Orders, Settings and Admin live in the profile menu (Tornike 2026-10-01 removed them here). */}
        </nav>

        <div className="sidebar-status" aria-label="Platform activity">
          <span className="status-dot" aria-hidden="true"></span>
          <span id="onlineCount">{onlineCount === null ? '' : `${onlineCount} Online`}</span>
        </div>
      </aside>
      <div className="scrim" id="scrim" hidden={!open} onClick={onClose} />
    </>
  )
}
