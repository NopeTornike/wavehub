import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, type ReactNode } from 'react'
import Layout from './Layout'
import { useAuth } from '../lib/auth'

const NAV_ITEMS = [
  { href: '/admin', label: 'დაფა' },
  { href: '/admin/listings', label: 'განცხადებები' },
  { href: '/admin/reviews', label: 'შეფასებები' },
  { href: '/admin/disputes', label: 'დავები' },
  { href: '/admin/withdrawals', label: 'გატანები' },
  { href: '/admin/users', label: 'მომხმარებლები' },
  { href: '/admin/settings', label: 'პლატფორმის პარამეტრები' },
]

// Wraps every /admin/* page: redirects a logged-out visitor to login, shows a plain "not
// authorized" state for a logged-in non-staff user, and renders the section nav otherwise.
// Deliberately does NOT hide individual nav links per adminRole — the per-role CAN/CANNOT catalog
// (SPECIFICATION.md §5.13) is enforced server-side by each route's own @RequireAdminRole(...); a
// role without access to a given section just gets a 403 from that page's own api call rather
// than the link being hidden. Building a full client-side permission matrix mirroring the backend
// one exactly wasn't worth the duplication risk for a first pass — see frontend/CLAUDE.md.
export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, checked } = useAuth()

  useEffect(() => {
    if (checked && !user) {
      router.push(`/login?next=${encodeURIComponent(router.asPath)}`)
    }
  }, [checked, user, router])

  if (!checked || (checked && !user)) {
    return (
      <Layout>
        <div className="page">
          <div className="page-inner">
            <div className="empty-state">იტვირთება…</div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!user!.adminRole) {
    return (
      <Layout>
        <div className="page">
          <div className="page-inner">
            <div className="admin-denied">
              <h1 className="page-title">წვდომა შეზღუდულია</h1>
              <p>ეს გვერდი ხელმისაწვდომია მხოლოდ ადმინისტრაციისთვის.</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page">
        <div className="page-inner">
          <nav className="admin-nav">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className={router.pathname === item.href ? 'active' : ''}>
                {item.label}
              </Link>
            ))}
          </nav>
          {children}
        </div>
      </div>
    </Layout>
  )
}
