import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Footer from './Footer'
import MobileBottomNav from './MobileBottomNav'
import VerifyEmailBanner from './VerifyEmailBanner'
import PageHead from './PageHead'

// The static prototype's page skeleton: <div class="app-shell"> holding the sidebar, scrim and
// <main class="main-panel"> (topbar first), with the site footer and the phone bottom-nav as
// siblings AFTER the app shell — exactly where site-footer.js / profile-nav.js append them, since
// the prototype's CSS targets `.app-shell > .sidebar`, `.app-shell > .scrim` etc. directly.
//
// `bodyClass` is the page's <body class> in the prototype (e.g. `home-page`, `wallet-page`,
// `coaching-body`, `steam-keys-page`) — a lot of its CSS is scoped by it, so each page passes its
// own. `sidebar-open` (the drawer state) is set on <body> too, matching script.js#setSidebarOpen.
//
// `title`/`description` feed <title>/meta via PageHead (the site name is appended there).
export default function Layout({
  children,
  title,
  description,
  noIndex,
  bodyClass,
  topbarAction,
  mainClass,
}: {
  children: ReactNode
  title?: string
  description?: string
  noIndex?: boolean
  bodyClass?: string
  // A page-specific button the prototype puts in the topbar before the profile menu (e.g. the
  // marketplace's "Become a seller" — profile-nav.js keeps `#sellerButton` there).
  topbarAction?: ReactNode
  // Extra classes on <main class="main-panel"> (e.g. the About page's `about-main-panel`).
  mainClass?: string
}) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen)
    return () => {
      document.body.classList.remove('sidebar-open')
    }
  }, [sidebarOpen])

  useEffect(() => {
    const classes = (bodyClass ?? '').split(/\s+/).filter(Boolean)
    classes.forEach((c) => document.body.classList.add(c))
    return () => classes.forEach((c) => document.body.classList.remove(c))
  }, [bodyClass])

  useEffect(() => {
    // Closes the drawer on navigation — a response to an external event (route change).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(false)
  }, [router.asPath])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen])

  return (
    <>
      <PageHead title={title} description={description} noIndex={noIndex} />
      <a className="skip-link" href="#main-content">
        გადასვლა მთავარ შიგთავსზე
      </a>
      <div className="app-shell">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className={`main-panel${mainClass ? ` ${mainClass}` : ''}`} id="main-content" tabIndex={-1}>
          <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} sidebarOpen={sidebarOpen} action={topbarAction} />
          <VerifyEmailBanner />
          {children}
        </main>
      </div>
      <Footer />
      <MobileBottomNav />
    </>
  )
}
