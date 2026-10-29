import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { useShell } from '../lib/shell'

// The sidebar's owner-defined navigation order plus the Marketplace flyout listing games. Real
// data behind it: the game list is the games table (GET /stats/games), the Messages pill is the real
// unread direct-message count, the Cart pill is the cart, and "N online" counts accounts seen in
// the last few minutes (backend/src/community/) instead of the prototype's random number.
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
  { id: 'messages', label: 'Messages', href: '/messages', icon: 'sidebar-message-icon.svg', iconClass: 'nav-icon-messages', count: 'message', match: (p) => p.startsWith('/messages') },
  {
    id: 'marketplace',
    label: 'Marketplace',
    href: '/marketplace',
    icon: 'marketplace-icon.svg',
    iconClass: 'nav-icon-marketplace',
    match: (p) => p === '/marketplace' || p.startsWith('/listings'),
  },
  { id: 'coaching', label: 'Coaching', href: '/coaching', icon: 'sidebar-coaching-icon.svg', iconClass: 'nav-icon-coaching', match: (p) => p.startsWith('/coaching') },
  { id: 'tournaments', label: 'Tourtaments', href: '/tournaments', icon: 'tournaments-icon.svg', iconClass: 'nav-icon-tournaments', match: (p) => p.startsWith('/tournaments') },
  { id: 'services', label: 'Services', href: '/services', icon: 'active-services-icon.svg', iconClass: 'nav-icon-marketplace', match: (p) => p === '/services' || p.startsWith('/sell/services') },
  { id: 'steam-keys', label: 'Steam Keys', href: '/steam-keys', icon: 'steam-logo.png', iconClass: 'steam-side-icon', match: (p) => p.startsWith('/steam-keys') || p.startsWith('/sell/digital-keys') },
  { id: 'cart', label: 'Cart', href: '/cart', icon: 'sidebar-cart-icon.svg', iconClass: 'nav-icon-cart', count: 'cart', match: (p) => p.startsWith('/cart') },
  { id: 'favorites', label: 'Favorities', href: '/favorites', icon: 'favorites-icon.svg', iconClass: 'nav-icon-heart', match: (p) => p.startsWith('/favorites') },
  { id: 'settings', label: 'Settings', href: '/profile', icon: 'settings-icon.svg', iconClass: 'nav-icon-about', match: (p) => p === '/profile' },
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
      <aside className="sidebar" id="sidebar" aria-label="WaveHub navigation">
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
                      ყველა თამაში
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
          <span id="onlineCount">{onlineCount === null ? '' : `${onlineCount} online`}</span>
        </div>
      </aside>
      <div className="scrim" id="scrim" hidden={!open} onClick={onClose} />
    </>
  )
}
