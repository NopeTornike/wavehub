import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AdminRole, TicketStatus } from '@wavehub/shared-types'
import AdminLayout, { AdminIcon } from '../../components/AdminLayout'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type Key = 'listings' | 'coaches' | 'tickets' | 'disputes' | 'withdrawals' | 'reviews'
type IconName = Parameters<typeof AdminIcon>[0]['name']

// What needs a staff member today. Each count is fetched on its own — a role without access to a
// section (server-enforced) just shows "—" for that tile instead of breaking the page.
const QUEUES: Array<{ key: Key; href: string; label: string; hint: string; icon: IconName }> = [
  { key: 'listings', href: '/admin/listings', label: 'განცხადებები', hint: 'ელოდება დამტკიცებას', icon: 'listing' },
  { key: 'coaches', href: '/admin/coaches', label: 'ქოუჩები', hint: 'ვერიფიკაციის მოთხოვნა', icon: 'coach' },
  { key: 'tickets', href: '/admin/tickets', label: 'მხარდაჭერა', hint: 'ღია ბილეთი', icon: 'ticket' },
  { key: 'disputes', href: '/admin/disputes', label: 'დავები', hint: 'ღია დავა', icon: 'scale' },
  { key: 'withdrawals', href: '/admin/withdrawals', label: 'გატანები', hint: 'ელოდება დამუშავებას', icon: 'cash' },
  { key: 'reviews', href: '/admin/reviews', label: 'შეფასებები', hint: 'დაჩივრებული', icon: 'star' },
]

const QUICK: Array<{ href: string; label: string; icon: IconName; superAdminOnly?: boolean }> = [
  { href: '/admin/coaches', label: 'ქოუჩის დამატება', icon: 'coach' },
  { href: '/admin/tournaments', label: 'ტურნირის შექმნა', icon: 'trophy' },
  { href: '/admin/users', label: 'მომხმარებლის ძებნა', icon: 'users' },
  { href: '/admin/listings', label: 'რჩეული პროდუქტები', icon: 'listing' },
  { href: '/admin/analytics', label: 'სტატისტიკა', icon: 'chart', superAdminOnly: true },
  { href: '/admin/settings', label: 'პარამეტრები', icon: 'gear', superAdminOnly: true },
]

export default function AdminDashboard() {
  const { user } = useAuth()
  const [counts, setCounts] = useState<Record<Key, number | null>>({ listings: null, coaches: null, tickets: null, disputes: null, withdrawals: null, reviews: null })

  useEffect(() => {
    let cancelled = false
    const count = (p: Promise<unknown[]>) => p.then((rows) => rows.length).catch(() => null)
    Promise.all([
      count(api.adminListPendingListings()),
      count(api.adminListPendingCoaches()),
      Promise.all([api.adminListTickets({ status: TicketStatus.Open }), api.adminListTickets({ status: TicketStatus.Escalated })])
        .then(([open, escalated]) => open.length + escalated.length)
        .catch(() => null),
      count(api.adminListOpenDisputes()),
      count(api.adminListPendingWithdrawals()),
      count(api.adminListReportedReviews()),
    ]).then(([listings, coaches, tickets, disputes, withdrawals, reviews]) => {
      if (!cancelled) setCounts({ listings, coaches, tickets, disputes, withdrawals, reviews })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const isSuperAdmin = user?.adminRole === AdminRole.SuperAdmin
  const todo = QUEUES.filter((q) => counts[q.key] !== null)
  const total = todo.reduce((sum, q) => sum + (counts[q.key] ?? 0), 0)

  return (
    <AdminLayout title="დაფა">
      <header className="adm-head">
        <div>
          <h1>გამარჯობა{user?.firstName ? `, ${user.firstName}` : ''}</h1>
          <p>{total > 0 ? `დღეს ${total} საკითხი ელოდება შენს ყურადღებას.` : 'ყველა რიგი ცარიელია — ყველაფერი წესრიგშია.'}</p>
        </div>
      </header>

      <div className="adm-kpis">
        {QUEUES.map((q) => {
          const value = counts[q.key]
          return (
            <Link key={q.key} href={q.href} className={`adm-kpi${value ? ' alert' : ''}`}>
              <span className="adm-kpi-top">
                {q.label}
                <AdminIcon name={q.icon} />
              </span>
              <b>{value ?? '—'}</b>
              <small>{value === null ? 'შენს როლს არ აქვს წვდომა' : q.hint}</small>
            </Link>
          )
        })}
      </div>

      <div className="adm-panels">
        <section className="adm-panel">
          <h2>გასაკეთებელი</h2>
          {todo.length === 0 ? (
            <p className="note">იტვირთება…</p>
          ) : (
            todo.map((q) => (
              <Link key={q.key} href={q.href} className="adm-todo">
                <span>
                  {q.label} — {q.hint}
                </span>
                <b className={counts[q.key] ? undefined : 'zero'}>{counts[q.key]}</b>
              </Link>
            ))
          )}
        </section>
        <section className="adm-panel">
          <h2>სწრაფი მოქმედებები</h2>
          <div className="adm-quick">
            {QUICK.filter((q) => !q.superAdminOnly || isSuperAdmin).map((q) => (
              <Link key={q.label} href={q.href}>
                <AdminIcon name={q.icon} />
                {q.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
