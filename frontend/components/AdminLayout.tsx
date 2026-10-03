import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, type ReactNode } from 'react'
import { AdminRole } from '@wavehub/shared-types'
import Layout from './Layout'
import { useAuth } from '../lib/auth'
import { canPublishSteam } from '../lib/roles'

// The admin shell (2026-10-02 redesign): a grouped section sidebar with icons, a breadcrumb header
// with the viewer's role, and one consistent visual system for every /admin/* page (`adm-` CSS at
// the end of global.css restyles the shared admin classes inside `.adm-main`).
// Access is enforced server-side per route (@RequireAdminRole). Links a role can never open
// (Super-Admin-only sections, Steam publishing) are hidden; others show the API's 403 in-page.

type IconName = 'shield' | 'tag' | 'image' | 'dashboard' | 'chart' | 'listing' | 'game' | 'steam' | 'star' | 'scale' | 'cash' | 'users' | 'ticket' | 'coach' | 'trophy' | 'crown' | 'doc' | 'gear'

const ICONS: Record<IconName, ReactNode> = {
  shield: <path d="M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6l-8-3Zm-3 9 2 2 4-4" />,
  tag: <path d="M3 12V4h8l10 10-8 8L3 12Zm5-4h.01" />,
  image: <path d="M4 5h16v14H4V5Zm0 11 5-5 4 4 2-2 5 5M15 9h.01" />,
  dashboard: <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />,
  chart: <path d="M4 20V10m6 10V4m6 16v-7m4 7H3" />,
  listing: <path d="M4 6h16M4 12h16M4 18h10" />,
  game: <path d="M7 9h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15 15H9l-.6.8A3 3 0 0 1 3 14v-1a4 4 0 0 1 4-4Zm1 2v3m-1.5-1.5h3M16 12h.01M18 14h.01" />,
  steam: <path d="M12 3a9 9 0 1 1-8.6 11.7l4.1 1.7a2.5 2.5 0 1 0 2.4-3.3l2.7-3.9A3.3 3.3 0 1 0 9.4 8l-1.5 4.2L3.4 10.4A9 9 0 0 1 12 3Z" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
  scale: <path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7h6L6 7Zm12 0-3 7h6l-3-7Z" />,
  cash: <path d="M3 7h18v10H3V7Zm9 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v.01M18 14v.01" />,
  users: <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm13 9v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8" />,
  ticket: <path d="M4 7a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4V7Zm6 0v10" />,
  coach: <path d="M12 3 2 8l10 5 10-5-10-5Zm-6 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H4v1a4 4 0 0 0 4 4m8-5h4v1a4 4 0 0 1-4 4m-4 2v4m-4 3h8" />,
  crown: <path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" />,
  doc: <path d="M6 3h9l4 4v14H6V3Zm8 0v5h5M9 13h7M9 17h5" />,
  gear: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4a7.3 7.3 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.3 7.3 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z" />,
}

type NavItem = { href: string; label: string; icon: IconName; superAdminOnly?: boolean; steamPublisherOnly?: boolean }
const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'მიმოხილვა',
    items: [
      { href: '/admin', label: 'დაფა', icon: 'dashboard' },
      { href: '/admin/analytics', label: 'სტატისტიკა', icon: 'chart', superAdminOnly: true },
    ],
  },
  {
    label: 'მარკეტი',
    items: [
      { href: '/admin/listings', label: 'განცხადებები', icon: 'listing' },
      { href: '/admin/games', label: 'თამაშები', icon: 'game' },
      { href: '/sell/digital-keys', label: 'Steam თამაშები', icon: 'steam', steamPublisherOnly: true },
      { href: '/admin/reviews', label: 'შეფასებები', icon: 'star' },
      { href: '/admin/disputes', label: 'დავები', icon: 'scale' },
    ],
  },
  {
    label: 'ფინანსები',
    items: [
      { href: '/admin/withdrawals', label: 'გატანები', icon: 'cash' },
      { href: '/admin/subscription-plans', label: 'გამოწერები', icon: 'crown' },
      { href: '/admin/promo-codes', label: 'პრომო კოდები', icon: 'tag', superAdminOnly: true },
    ],
  },
  {
    label: 'ხალხი',
    items: [
      { href: '/admin/users', label: 'მომხმარებლები', icon: 'users' },
      { href: '/admin/coaches', label: 'ქოუჩები', icon: 'coach' },
      { href: '/admin/coaching-packages', label: 'ქოუჩინგის პაკეტები', icon: 'crown' },
      { href: '/admin/tickets', label: 'მხარდაჭერა', icon: 'ticket' },
      { href: '/admin/trust', label: 'უსაფრთხოება', icon: 'shield' },
    ],
  },
  {
    label: 'კონტენტი',
    items: [
      { href: '/admin/tournaments', label: 'ტურნირები', icon: 'trophy' },
      { href: '/admin/content', label: 'გვერდები', icon: 'doc' },
      { href: '/admin/banners', label: 'ბანერები', icon: 'image' },
    ],
  },
  {
    label: 'სისტემა',
    items: [{ href: '/admin/settings', label: 'პარამეტრები', icon: 'gear', superAdminOnly: true }],
  },
]

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  [AdminRole.SuperAdmin]: 'Super Admin',
  [AdminRole.OperationLead]: 'Operation Lead',
  [AdminRole.MainAdministrator]: 'მთავარი ადმინისტრატორი',
  [AdminRole.MarketplaceCoachingOpsManager]: 'მარკეტი და ქოუჩინგი',
  [AdminRole.TrustSafetyOfficer]: 'Trust & Safety',
  [AdminRole.SupportSpecialist]: 'მხარდაჭერა',
}

export function AdminIcon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export default function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const layoutTitle = title ? `${title} · ადმინ პანელი` : 'ადმინ პანელი'
  const router = useRouter()
  const { user, checked } = useAuth()

  useEffect(() => {
    if (checked && !user) {
      router.push(`/login?next=${encodeURIComponent(router.asPath)}`)
    }
  }, [checked, user, router])

  if (!checked || (checked && !user)) {
    return (
      <Layout title={layoutTitle} noIndex>
        <div className="adm-loading">იტვირთება…</div>
      </Layout>
    )
  }

  if (!user!.adminRole) {
    return (
      <Layout title={layoutTitle} noIndex>
        <div className="adm-denied">
          <h1>წვდომა შეზღუდულია</h1>
          <p>ეს გვერდი ხელმისაწვდომია მხოლოდ WaveHub-ის ადმინისტრაციისთვის.</p>
          <Link href="/">მთავარზე დაბრუნება</Link>
        </div>
      </Layout>
    )
  }

  const role = user!.adminRole
  const visible = (item: NavItem) => (!item.superAdminOnly || role === AdminRole.SuperAdmin) && (!item.steamPublisherOnly || canPublishSteam(user))
  const isActive = (href: string) => (href === '/admin' ? router.pathname === '/admin' : router.pathname === href || router.pathname.startsWith(`${href}/`))
  const current = NAV_GROUPS.flatMap((g) => g.items).find((item) => isActive(item.href))

  return (
    <Layout title={layoutTitle} noIndex>
      <div className="adm-shell">
        <aside className="adm-side" aria-label="ადმინ პანელის სექციები">
          <div className="adm-side-head">
            <strong>ადმინ პანელი</strong>
            <span className="adm-role">{ADMIN_ROLE_LABELS[role] ?? role}</span>
          </div>
          <nav>
            {NAV_GROUPS.map((group) => {
              const items = group.items.filter(visible)
              if (items.length === 0) return null
              return (
                <div key={group.label} className="adm-group">
                  <small>{group.label}</small>
                  {items.map((item) => (
                    <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : undefined} aria-current={isActive(item.href) ? 'page' : undefined}>
                      <AdminIcon name={item.icon} />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              )
            })}
          </nav>
        </aside>
        <div className="adm-main">
          <div className="adm-crumbs">
            <Link href="/admin">ადმინ პანელი</Link>
            {current && current.href !== '/admin' && (
              <>
                <span aria-hidden="true">/</span>
                <Link href={current.href}>{current.label}</Link>
              </>
            )}
            {title && (!current || title !== current.label) && current?.href !== '/admin' && (
              <>
                <span aria-hidden="true">/</span>
                <em>{title}</em>
              </>
            )}
          </div>
          {children}
        </div>
      </div>
    </Layout>
  )
}
