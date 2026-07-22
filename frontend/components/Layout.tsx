import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Footer from './Footer'

// Matches index.html's <div class="app-shell"><aside class="sidebar">...<main class="main-panel">
// structure — see root-level styles.css (copied into frontend/styles/global.css) for the CSS this
// depends on. Mobile sidebar visibility is driven by a `sidebar-open` class on <body> (matching
// script.js's `setSidebarOpen`), not a class on the sidebar itself — kept as a real DOM
// side-effect here since that's what the copied CSS's `body.sidebar-open .sidebar` selector
// expects, rather than inventing a different mechanism.
export default function Layout({ children }: { children: ReactNode }) {
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

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-panel">
        <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />
        {children}
        <Footer />
      </main>
    </div>
  )
}
