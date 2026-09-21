import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/auth'

// Matches index.html's <aside class="sidebar">. The prototype's "Favorites" and "Cart" items were
// dropped rather than kept as dead placeholders (favorites was never built; a multi-item cart
// doesn't fit the single-listing-purchase order model — see root CLAUDE.md's "Architecture notes").
const NAV_ITEMS = [
  { href: '/', label: 'მთავარი', icon: 'home-icon.svg' },
  { href: '/marketplace', label: 'მარკეტფლეისი', icon: 'marketplace-icon.svg' },
  { href: '/coaching', label: 'კოუჩინგი', icon: 'sidebar-coaching-icon.svg' },
  { href: '/tournaments', label: 'ტურნირები', icon: 'tournaments-icon.svg' },
  { href: '/orders', label: 'შეკვეთები', icon: 'orders-icon.svg' },
  { href: '/messages', label: 'შეტყობინებები', icon: 'sidebar-message-icon.svg' },
  { href: '/support', label: 'დახმარება', icon: 'message-icon.svg' },
  { href: '/wallet', label: 'საფულე', icon: 'wallet-icon.svg' },
  { href: '/plans', label: 'გამოწერები', icon: 'wallet-icon.svg' },
]

// A nav link is "current" on its own path and on any nested route (e.g. /orders/[id]) — except the
// home link, which would otherwise match everything.
function isCurrent(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { user } = useAuth()

  return (
    <>
      <aside className="sidebar" id="sidebar" aria-label="WaveHub-ის ნავიგაცია">
        <Link href="/" className="brand" aria-label="WaveHub — მთავარი გვერდი">
          <Image src="/assets/logo-wavehubx.png" alt="WaveHubX" width={240} height={240} priority />
        </Link>

        <nav className="side-nav" aria-label="ძირითადი გვერდები">
          {NAV_ITEMS.map((item) => {
            const current = isCurrent(router.pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`side-link${current ? ' active' : ''}`}
                aria-current={current ? 'page' : undefined}
                onClick={onClose}
              >
                <span className="nav-icon" aria-hidden="true">
                  <Image src={`/assets/${item.icon}`} alt="" width={28} height={28} unoptimized />
                </span>
                <span>{item.label}</span>
              </Link>
            )
          })}
          {user?.adminRole && (
            <Link
              href="/admin"
              className={`side-link${router.pathname.startsWith('/admin') ? ' active' : ''}`}
              aria-current={router.pathname.startsWith('/admin') ? 'page' : undefined}
              onClick={onClose}
            >
              <span className="nav-icon nav-icon-settings" aria-hidden="true">
                <Image src="/assets/settings-icon.svg" alt="" width={28} height={28} unoptimized />
              </span>
              <span>ადმინი</span>
            </Link>
          )}
        </nav>

        <div className="sidebar-status">
          <span className="status-dot" aria-hidden="true"></span>
          <span>WaveHub</span>
        </div>
      </aside>
      {open && <div className="scrim" onClick={onClose} aria-hidden="true" />}
    </>
  )
}
