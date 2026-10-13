import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { AdminAnalytics, AnalyticsBreakdownRow } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import BarList from '../../components/charts/BarList'
import TrendChart from '../../components/charts/TrendChart'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'

// Super Admin statistics (backend/src/analytics/): sales, what sold (games, types, categories,
// listings, sellers), subscriptions, coaching, and money in/out, for a date range. Every figure is
// an aggregate of real rows. Money is GEL (WaveCoin is 1:1 GEL). One filter row scopes the whole
// page; while a new range loads, the old figures stay at reduced opacity (no layout jump).

const PINK = '#ff2f8f'
const VIOLET = '#a855f7'
const DAY = 86_400_000

type Preset = { key: string; label: string; days: number | null }
const PRESETS: Preset[] = [
  { key: 'today', label: 'დღეს', days: 1 },
  { key: '7', label: '7 დღე', days: 7 },
  { key: '30', label: '30 დღე', days: 30 },
  { key: '90', label: '90 დღე', days: 90 },
  { key: '365', label: '12 თვე', days: 365 },
  { key: 'custom', label: 'სხვა პერიოდი', days: null },
]

type Metric = 'gmv' | 'orders' | 'topupsGel' | 'subscriptionsGel'
const METRICS: Array<{ key: Metric; label: string; color: string; money: boolean }> = [
  { key: 'gmv', label: 'გაყიდვები (GEL)', color: PINK, money: true },
  { key: 'orders', label: 'შეკვეთები', color: PINK, money: false },
  { key: 'topupsGel', label: 'შევსებები (GEL)', color: VIOLET, money: true },
  { key: 'subscriptionsGel', label: 'გამოწერები (GEL)', color: VIOLET, money: true },
]

const TYPE_LABELS: Record<string, string> = { service: 'სერვისები', item: 'ანგარიშები / სკინები', digital_key: 'Steam გასაღებები' }
const AUDIENCE_LABELS: Record<string, string> = { buyer: 'მყიდველი', seller_coach: 'გამყიდველი / მწვრთნელი' }

const iso = (d: Date) => d.toISOString().slice(0, 10)
const num = (n: number) => n.toLocaleString('en-US')
const gel = (n: number) => `${num(n)} GEL`
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${(n / 1000).toFixed(1)}K` : num(n))
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—')

function presetRange(days: number): { from: string; to: string } {
  const today = new Date()
  return { from: iso(new Date(today.getTime() - (days - 1) * DAY)), to: iso(today) }
}

function bucketLabel(bucket: string, kind: 'day' | 'month') {
  const d = new Date(`${bucket}T00:00:00Z`)
  return kind === 'day'
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    : d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="an-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  )
}

function BreakdownTable({ rows, labelOf, caption }: { rows: AnalyticsBreakdownRow[]; labelOf: (r: AnalyticsBreakdownRow) => string; caption: string }) {
  if (rows.length === 0) return <p className="an-empty">ამ პერიოდში გაყიდვები არ არის.</p>
  const total = rows.reduce((sum, r) => sum + r.gmv, 0)
  return (
    <table className="an-table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">დასახელება</th>
          <th scope="col">შეკვეთები</th>
          <th scope="col">გაყიდვები</th>
          <th scope="col">წილი</th>
          <th scope="col">საკომისიო</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row">{labelOf(r)}</th>
            <td>{num(r.orders)}</td>
            <td>{gel(r.gmv)}</td>
            <td>{pct(r.gmv, total)}</td>
            <td>{gel(r.platformFees)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function AdminAnalytics() {
  const { user } = useAuth()
  const isSuperAdmin = user?.adminRole === 'super_admin'
  const [preset, setPreset] = useState('30')
  const [range, setRange] = useState(() => presetRange(30))
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [metric, setMetric] = useState<Metric>('gmv')

  useEffect(() => {
    if (!isSuperAdmin) return
    let cancelled = false
    // Keep the previous figures on screen (dimmed) while the new range loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api
      .adminGetAnalytics(range.from, range.to)
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'სტატისტიკის ჩატვირთვა ვერ მოხერხდა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isSuperAdmin, range.from, range.to])

  const chosenMetric = METRICS.find((m) => m.key === metric)!
  const points = useMemo(() => (data ? data.series.map((p) => ({ label: bucketLabel(p.bucket, data.bucket), value: p[metric] })) : []), [data, metric])

  if (user && !isSuperAdmin) {
    return (
      <AdminLayout title="სტატისტიკა">
        <div className="admin-denied">
          <h1 className="page-title">წვდომა შეზღუდულია</h1>
          <p>სტატისტიკა ხელმისაწვდომია მხოლოდ Super Admin-ისთვის.</p>
        </div>
      </AdminLayout>
    )
  }

  const choosePreset = (p: Preset) => {
    setPreset(p.key)
    if (p.days) setRange(presetRange(p.days))
  }

  const earnings = data ? data.sales.platformFees + data.coaching.platformFees : 0

  return (
    <AdminLayout title="სტატისტიკა">
      <div className="an-page">
        <header className="an-head">
          <div>
            <h1 className="page-title">სტატისტიკა</h1>
            <p className="page-subtitle">გაყიდვები, თამაშები, გამოწერები და ფულის მოძრაობა · მხოლოდ Super Admin</p>
          </div>
        </header>

        <div className="an-filters" role="group" aria-label="პერიოდი">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" className={preset === p.key ? 'active' : undefined} aria-pressed={preset === p.key} onClick={() => choosePreset(p)}>
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <span className="an-custom">
              <label>
                <span>დან</span>
                <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} />
              </label>
              <label>
                <span>მდე</span>
                <input type="date" value={range.to} min={range.from} max={iso(new Date())} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} />
              </label>
            </span>
          )}
          {data && (
            <small className="an-range">
              {data.from} — {data.to}
            </small>
          )}
        </div>

        {error && (
          <div className="status-text status-error" role="alert">
            {error}
          </div>
        )}

        {!data ? (
          <div className="empty-state">{loading ? 'იტვირთება…' : ''}</div>
        ) : (
          <div className={`an-body${loading ? ' is-loading' : ''}`} aria-busy={loading}>
            <section className="an-tiles" aria-label="მთავარი მაჩვენებლები">
              <Tile label="გაყიდვები" value={gel(data.sales.gmv)} note={`${num(data.sales.orders)} შეკვეთა · საშ. ${gel(data.sales.averageOrder)}`} />
              <Tile label="პლატფორმის შემოსავალი" value={gel(earnings)} note={`შეკვეთები ${gel(data.sales.platformFees)} · კოუჩინგი ${gel(data.coaching.platformFees)}`} />
              <Tile label="შევსებები (BOG)" value={gel(data.money.topupsGel)} note={`${num(data.money.topups)} გადახდა`} />
              <Tile label="გამოწერების შემოსავალი" value={gel(data.subscriptions.revenueGel)} note={`${num(data.subscriptions.activeNow)} აქტიური · თვეში ~${gel(data.subscriptions.monthlyRecurringGel)}`} />
              <Tile label="დასრულებული" value={gel(data.sales.completedValue)} note={`${num(data.sales.completedOrders)} შეკვეთა`} />
              <Tile label="ესქროუში ახლა" value={gel(data.sales.inEscrow)} note="გადახდილი, ჯერ დაუსრულებელი" />
              <Tile label="დაბრუნებული" value={gel(data.sales.refundedValue)} note={`${num(data.sales.refundedOrders)} შეკვეთა`} />
              <Tile label="ახალი მომხმარებლები" value={num(data.users.newInRange)} note={`${num(data.users.verifiedInRange)} დადასტურებული · სულ ${compact(data.users.total)}`} />
            </section>

            <section className="an-card">
              <header className="an-card-head">
                <h2>{chosenMetric.label}</h2>
                <div className="an-seg" role="group" aria-label="მაჩვენებელი">
                  {METRICS.map((m) => (
                    <button key={m.key} type="button" className={metric === m.key ? 'active' : undefined} aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </header>
              <TrendChart points={points} color={chosenMetric.color} format={chosenMetric.money ? (n) => compact(n) : (n) => num(Math.round(n))} tipFormat={chosenMetric.money ? gel : num} ariaLabel={`${chosenMetric.label}, ${data.from} — ${data.to}`} />
              <details className="an-data">
                <summary>ცხრილის ნახვა</summary>
                <table className="an-table">
                  <thead>
                    <tr>
                      <th scope="col">{data.bucket === 'day' ? 'დღე' : 'თვე'}</th>
                      <th scope="col">გაყიდვები</th>
                      <th scope="col">შეკვეთები</th>
                      <th scope="col">შევსებები</th>
                      <th scope="col">გამოწერები</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.map((p) => (
                      <tr key={p.bucket}>
                        <th scope="row">{p.bucket}</th>
                        <td>{gel(p.gmv)}</td>
                        <td>{num(p.orders)}</td>
                        <td>{gel(p.topupsGel)}</td>
                        <td>{gel(p.subscriptionsGel)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </section>

            <div className="an-grid">
              <section className="an-card">
                <h2>გაყიდვები თამაშების მიხედვით</h2>
                <BarList
                  rows={data.byGame.map((r) => ({ key: r.key, label: r.label || 'ზოგადი', value: r.gmv, detail: `${num(r.orders)} შეკვეთა · საკომისიო ${gel(r.platformFees)}` }))}
                  color={PINK}
                  format={gel}
                  empty="ამ პერიოდში გაყიდვები არ არის."
                />
              </section>
              <section className="an-card">
                <h2>პროდუქტის ტიპი</h2>
                <BreakdownTable rows={data.byType} labelOf={(r) => TYPE_LABELS[r.key] ?? r.label} caption="გაყიდვები ტიპის მიხედვით" />
                <h3>კატეგორიები</h3>
                <BreakdownTable rows={data.byCategory} labelOf={(r) => r.label} caption="გაყიდვები კატეგორიების მიხედვით" />
              </section>
            </div>

            <div className="an-grid">
              <section className="an-card">
                <h2>ყველაზე გაყიდვადი განცხადებები</h2>
                {data.topListings.length === 0 ? (
                  <p className="an-empty">ამ პერიოდში გაყიდვები არ არის.</p>
                ) : (
                  <table className="an-table">
                    <thead>
                      <tr>
                        <th scope="col">განცხადება</th>
                        <th scope="col">თამაში</th>
                        <th scope="col">შეკვეთები</th>
                        <th scope="col">გაყიდვები</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topListings.map((l) => (
                        <tr key={l.listingId}>
                          <th scope="row">
                            <Link href={`/listings/${l.listingId}`}>{l.title}</Link>
                            <small>
                              @{l.seller} · {TYPE_LABELS[l.type] ?? l.type}
                            </small>
                          </th>
                          <td>{l.game ?? '—'}</td>
                          <td>{num(l.orders)}</td>
                          <td>{gel(l.gmv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
              <section className="an-card">
                <h2>საუკეთესო გამყიდველები</h2>
                {data.topSellers.length === 0 ? (
                  <p className="an-empty">ამ პერიოდში გაყიდვები არ არის.</p>
                ) : (
                  <table className="an-table">
                    <thead>
                      <tr>
                        <th scope="col">გამყიდველი</th>
                        <th scope="col">შეკვეთები</th>
                        <th scope="col">გაყიდვები</th>
                        <th scope="col">საკომისიო</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topSellers.map((s) => (
                        <tr key={s.username}>
                          <th scope="row">
                            <Link href={`/u/${s.username}`}>@{s.username}</Link>
                          </th>
                          <td>{num(s.orders)}</td>
                          <td>{gel(s.gmv)}</td>
                          <td>{gel(s.platformFees)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="an-note">
                  {num(data.users.sellersWithSales)} <span>გამყიდველს ჰქონდა გაყიდვა</span> · {num(data.users.buyers)} <span>მყიდველი</span>
                </p>
              </section>
            </div>

            <section className="an-card">
              <h2>გამოწერები</h2>
              <div className="an-mini">
                <Tile label="აქტიური ახლა" value={num(data.subscriptions.activeNow)} note={`${num(data.subscriptions.grantedNow)} ხელით მინიჭებული`} />
                <Tile label="ახალი" value={num(data.subscriptions.newInRange)} />
                <Tile label="გაუქმებული / ვადაგასული" value={num(data.subscriptions.cancelledInRange)} />
                <Tile label="შემოსავალი" value={gel(data.subscriptions.revenueGel)} />
                <Tile label="თვიური (MRR)" value={gel(data.subscriptions.monthlyRecurringGel)} note="აქტიური ფასიანი გეგმები, 30 დღეზე" />
              </div>
              {data.subscriptions.byPlan.length === 0 ? (
                <p className="an-empty">გეგმები ჯერ არ არის.</p>
              ) : (
                <table className="an-table">
                  <thead>
                    <tr>
                      <th scope="col">გეგმა</th>
                      <th scope="col">აუდიტორია</th>
                      <th scope="col">ფასი</th>
                      <th scope="col">აქტიური</th>
                      <th scope="col">ახალი</th>
                      <th scope="col">შემოსავალი</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscriptions.byPlan.map((p) => (
                      <tr key={p.planId}>
                        <th scope="row">{p.name}</th>
                        <td>{AUDIENCE_LABELS[p.audience] ?? p.audience}</td>
                        <td>{gel(p.priceGel)}</td>
                        <td>{num(p.activeNow)}</td>
                        <td>{num(p.newInRange)}</td>
                        <td>{gel(p.revenueGel)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <div className="an-grid">
              <section className="an-card">
                <h2>კოუჩინგი</h2>
                <div className="an-mini">
                  <Tile label="დაჯავშნილი სესიები" value={num(data.coaching.sessions)} />
                  <Tile label="დასრულებული" value={num(data.coaching.completed)} />
                  <Tile label="გაუქმებული" value={num(data.coaching.cancelled)} />
                  <Tile label="ღირებულება" value={gel(data.coaching.value)} note={`საკომისიო ${gel(data.coaching.platformFees)}`} />
                </div>
              </section>
              <section className="an-card">
                <h2>ფულის მოძრაობა</h2>
                <div className="an-mini">
                  <Tile label="შემოვიდა (BOG შევსება)" value={gel(data.money.topupsGel)} note={`${num(data.money.topups)} გადახდა`} />
                  <Tile label="გაცემული (გატანა)" value={gel(data.money.withdrawalsPaidValue)} note={`${num(data.money.withdrawalsPaid)} მოთხოვნა`} />
                  <Tile label="გასაცემი (მოლოდინში)" value={gel(data.money.withdrawalsPendingValue)} note={`${num(data.money.withdrawalsPending)} მოთხოვნა — ახლა`} />
                  <Tile label="ესქროუში ახლა" value={gel(data.sales.inEscrow)} />
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
