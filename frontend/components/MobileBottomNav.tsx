import Link from 'next/link'
import { useRouter } from 'next/router'

// profile-nav.js#renderMobileNavigation — the phone-width bottom tab bar (hidden on desktop by CSS).
const ROUTES: Array<{ id: string; href: string; label: string; icon: React.ReactNode }> = [
  { id: 'marketplace', href: '/marketplace', label: 'მარკეტი', icon: <><path d="M6 8h12l1 13H5L6 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></> },
  { id: 'orders', href: '/orders', label: 'შეკვეთები', icon: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5" /></> },
  { id: 'wallet', href: '/wallet', label: 'საფულე', icon: <><path d="M4 7h15a2 2 0 0 1 2 2v10H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12v4" /><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" /></> },
  { id: 'profile', href: '/profile', label: 'პროფილი', icon: <><circle cx="12" cy="7" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></> },
]

function activeRoute(path: string) {
  if (path.startsWith('/marketplace') || path.startsWith('/listings') || path.startsWith('/cart') || path.startsWith('/steam-keys')) return 'marketplace'
  if (path.startsWith('/orders')) return 'orders'
  if (path.startsWith('/wallet')) return 'wallet'
  if (path.startsWith('/profile')) return 'profile'
  return 'home'
}

export default function MobileBottomNav() {
  const { pathname } = useRouter()
  const active = activeRoute(pathname)
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <Link className={`mobile-home-link${active === 'home' ? ' active' : ''}`} href="/" data-mobile-route="home">
        <span className="mobile-home-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4v-9Z" /></svg>
        </span>
        <span>მთავარი</span>
      </Link>
      {ROUTES.map((route) => (
        <Link key={route.id} className={active === route.id ? 'active' : undefined} href={route.href} data-mobile-route={route.id}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{route.icon}</svg>
          <span>{route.label}</span>
        </Link>
      ))}
    </nav>
  )
}
