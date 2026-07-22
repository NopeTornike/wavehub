import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/auth'

// Matches index.html's <aside class="sidebar">. "Favorites" and "Cart" are kept for visual parity
// with the static prototype but have no real backend yet (favorites was never built; a multi-item
// cart doesn't fit the single-listing-purchase order model — see root CLAUDE.md's "Architecture
// notes") — both are non-functional placeholders, same "visible but disabled" pattern used
// elsewhere in this app (e.g. coaching session booking) rather than being silently hidden.
const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: 'home-icon.svg' },
  { href: '/marketplace', label: 'Marketplace', icon: 'marketplace-icon.svg' },
  { href: '/coaching', label: 'Coaching', icon: 'sidebar-coaching-icon.svg' },
  { href: '/orders', label: 'Orders', icon: 'orders-icon.svg' },
  { href: '/support', label: 'დახმარება', icon: 'message-icon.svg' },
  { href: '/wallet', label: 'Wallet', icon: 'wallet-icon.svg' },
]

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { user } = useAuth()

  return (
    <>
      <aside className="sidebar" id="sidebar" aria-label="WaveHub navigation">
        <Link href="/" className="brand" aria-label="WaveHub home">
          <img src="/assets/logo-wavehubx.png" alt="WaveHubX" />
        </Link>

        <nav className="side-nav" aria-label="Main pages">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`side-link${router.pathname === item.href ? ' active' : ''}`}
              onClick={onClose}
            >
              <span className="nav-icon" aria-hidden="true">
                <img src={`/assets/${item.icon}`} alt="" />
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
          {user?.adminRole && (
            <Link href="/admin" className={`side-link${router.pathname.startsWith('/admin') ? ' active' : ''}`} onClick={onClose}>
              <span className="nav-icon nav-icon-settings" aria-hidden="true">
                <img src="/assets/settings-icon.svg" alt="" />
              </span>
              <span>Admin</span>
            </Link>
          )}
        </nav>

        <div className="sidebar-status" aria-label="Platform activity">
          <span className="status-dot" aria-hidden="true"></span>
          <span>WaveHub</span>
        </div>
      </aside>
      {open && <div className="scrim" onClick={onClose} />}
    </>
  )
}
