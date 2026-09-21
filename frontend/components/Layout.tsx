import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Footer from './Footer'
import VerifyEmailBanner from './VerifyEmailBanner'
import PageHead from './PageHead'

// Matches index.html's <div class="app-shell"><aside class="sidebar">...<main class="main-panel">
// structure — see root-level styles.css (copied into frontend/styles/global.css) for the CSS this
// depends on. Mobile sidebar visibility is driven by a `sidebar-open` class on <body> (matching
// script.js's `setSidebarOpen`), not a class on the sidebar itself — kept as a real DOM
// side-effect here since that's what the copied CSS's `body.sidebar-open .sidebar` selector
// expects, rather than inventing a different mechanism.
//
// `title`/`description` feed the page's <title>/meta tags via PageHead (every page passes its own;
// the site name is appended there, so callers only supply the page-specific part).
export default function Layout({
  children,
  title,
  description,
  noIndex,
}: {
  children: ReactNode
  title?: string
  description?: string
  noIndex?: boolean
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
    // Closes the mobile sidebar on navigation — a real external-event response (route change),
    // not a derived-state anti-pattern, but the lint rule can't tell the difference.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(false)
  }, [router.pathname])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen])

  return (
    <div className="app-shell">
      <PageHead title={title} description={description} noIndex={noIndex} />
      <a className="skip-link" href="#main-content">
        გადასვლა მთავარ შიგთავსზე
      </a>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-panel" id="main-content" tabIndex={-1}>
        <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} sidebarOpen={sidebarOpen} />
        <VerifyEmailBanner />
        {children}
        <Footer />
      </main>
    </div>
  )
}
