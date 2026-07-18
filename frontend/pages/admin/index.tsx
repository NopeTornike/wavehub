import Link from 'next/link'
import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { api } from '../../lib/api'

type StatKey = 'listings' | 'reviews' | 'disputes' | 'withdrawals'

const STATS: Array<{ key: StatKey; href: string; label: string }> = [
  { key: 'listings', href: '/admin/listings', label: 'დასამტკიცებელი განცხადება' },
  { key: 'reviews', href: '/admin/reviews', label: 'გასაზიარებელი შეფასება' },
  { key: 'disputes', href: '/admin/disputes', label: 'ღია დავა' },
  { key: 'withdrawals', href: '/admin/withdrawals', label: 'გატანის მოთხოვნა' },
]

// Each count is fetched independently and defaults to "—" on failure — a role without access to
// one section (e.g. Marketplace & Coaching Ops Manager has no withdrawals access) shouldn't blow
// up the whole dashboard, it should just show that one tile as unavailable.
export default function AdminDashboard() {
  const [counts, setCounts] = useState<Record<StatKey, number | null>>({
    listings: null,
    reviews: null,
    disputes: null,
    withdrawals: null,
  })

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      api.adminListPendingListings(),
      api.adminListReportedReviews(),
      api.adminListOpenDisputes(),
      api.adminListPendingWithdrawals(),
    ]).then(([listings, reviews, disputes, withdrawals]) => {
      if (cancelled) return
      setCounts({
        listings: listings.status === 'fulfilled' ? listings.value.length : null,
        reviews: reviews.status === 'fulfilled' ? reviews.value.length : null,
        disputes: disputes.status === 'fulfilled' ? disputes.value.length : null,
        withdrawals: withdrawals.status === 'fulfilled' ? withdrawals.value.length : null,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AdminLayout>
      <h1 className="page-title">ადმინ პანელი</h1>
      <p className="page-subtitle">დღეს ყურადღების საჭიროებელი ელემენტები</p>

      <div className="admin-stat-grid">
        {STATS.map((stat) => (
          <Link key={stat.key} href={stat.href} className="admin-stat">
            <span className="admin-stat-value">{counts[stat.key] ?? '—'}</span>
            <span className="admin-stat-label">{stat.label}</span>
          </Link>
        ))}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <p className="note" style={{ marginTop: 0 }}>
          თითოეულ სექციაზე წვდომა შემოწმებულია სერვერზე თქვენი ადმინისტრაციული როლის მიხედვით
          (SPECIFICATION.md §5.13) — თუ სექცია თქვენთვის მიუწვდომელია, ის აჩვენებს შესაბამის შეცდომას.
        </p>
      </div>
    </AdminLayout>
  )
}
