import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import type { SellerLeaderboard as Board, SellerLeaderboardPeriod, SellerLeaderboardSort } from '@wavehub/shared-types'
import Avatar from './Avatar'
import VerifiedMark from './VerifiedMark'
import { api } from '../lib/api'

// Marketplace sellers leaderboard (owner 2026-11-10, docs/design-mockups/round-6/03). Live numbers
// only: products = the seller's active listings now, sales = completed orders, rating = published
// buyer reviews (sales and rating follow the period filter). Super Admin turns it on / off in
// Admin → Settings; when off — or before anyone has sold anything — nothing renders.

const fmt = (n: number) => n.toLocaleString('en-US')

const ICONS: Record<string, ReactNode> = {
  box: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
    </>
  ),
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  crown: <path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
}

function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

function Medal({ place }: { place: number }) {
  if (place > 3) return <b className="sl-num">{place}</b>
  const tone = place === 1 ? ['#ffe27a', '#d99a00'] : place === 2 ? ['#f3f6ff', '#9aa3b8'] : ['#ffc08a', '#c2621f']
  return (
    <svg className={`sl-medal p${place}`} viewBox="0 0 56 44" role="img" aria-label={`${place} ადგილი`}>
      <defs>
        <linearGradient id={`slm${place}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone[0]} />
          <stop offset="1" stopColor={tone[1]} />
        </linearGradient>
      </defs>
      {/* laurel */}
      <path d="M9 14c-4 6-3 15 4 21M47 14c4 6 3 15-4 21" fill="none" stroke={tone[1]} strokeWidth="3" strokeLinecap="round" opacity=".85" />
      <path d="M12 12l8 7 8-12 8 12 8-7-3 22H15L12 12Z" fill={`url(#slm${place})`} stroke="rgba(0,0,0,.35)" strokeWidth="1.2" />
      <text x="28" y="31" textAnchor="middle" fontSize="15" fontWeight="900" fill="#2a1a05">
        {place}
      </text>
    </svg>
  )
}

const TABS: Array<[SellerLeaderboardSort, string, keyof typeof ICONS]> = [
  ['overall', 'Overall', 'crown'],
  ['products', 'Most Products', 'box'],
  ['sales', 'Most Sales', 'cart'],
  ['rating', 'Highest Rating', 'star'],
]

const PERIODS: Array<[SellerLeaderboardPeriod, string]> = [
  ['all', 'All Time'],
  ['30d', 'ბოლო 30 დღე'],
  ['7d', 'ბოლო 7 დღე'],
]

export default function SellerLeaderboard() {
  const [sort, setSort] = useState<SellerLeaderboardSort>('overall')
  const [period, setPeriod] = useState<SellerLeaderboardPeriod>('all')
  const [board, setBoard] = useState<Board | null>(null)
  // Whether the board has ever had sellers (so a quiet 7-day filter still shows its empty state).
  const [everShown, setEverShown] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .getSellerLeaderboard(sort, period)
      .then((b) => {
        if (!alive) return
        setBoard(b)
        if (b.visible && b.rows.length > 0) setEverShown(true)
      })
      .catch(() => alive && setBoard(null))
    return () => {
      alive = false
    }
  }, [sort, period])

  if (!board || !board.visible || !everShown) return null
  const { rows, totals } = board

  return (
    <section className="sl-board" aria-labelledby="slTitle">
      <header className="sl-head">
        <span className="sl-head-icon">
          <Icon name="bag" />
        </span>
        <span className="sl-head-text">
          <h2 id="slTitle">Marketplace Leaderboard</h2>
          <small>Top Sellers on WaveHubX</small>
        </span>
        <label className="sl-period">
          <Icon name="calendar" />
          <select value={period} onChange={(e) => setPeriod(e.target.value as SellerLeaderboardPeriod)} aria-label="პერიოდი">
            {PERIODS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <nav className="sl-tabs" aria-label="დალაგება">
        {TABS.map(([value, label, icon]) => (
          <button key={value} type="button" className={sort === value ? 'active' : undefined} aria-pressed={sort === value} onClick={() => setSort(value)}>
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sl-table" role="table" aria-label="Top 5 Seller">
        <div className="sl-row sl-cols" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">Seller</span>
          <span role="columnheader">
            <Icon name="box" /> Products
          </span>
          <span role="columnheader">
            <Icon name="cart" /> Sales
          </span>
          <span role="columnheader">
            <Icon name="star" /> Rating
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="sl-empty">ამ პერიოდში მონაცემები ჯერ არ არის.</p>
        ) : (
          rows.map((r) => {
            const name = [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.username
            return (
              <div key={r.username} className={`sl-row sl-seller p${r.rank}`} role="row">
                <span className="sl-rank" role="cell">
                  <Medal place={r.rank} />
                </span>
                <Link className="sl-who" href={`/u/${r.username}`} role="cell">
                  <Avatar name={name} src={r.avatarUrl} size={48} ring={false} />
                  <span>
                    <strong>
                      <span className="sl-name">{name}</span>
                      {r.verified && <VerifiedMark size={18} />}
                    </strong>
                    <small>@{r.username}</small>
                  </span>
                </Link>
                <span className="sl-stat" role="cell" data-label="Products">
                  <Icon name="box" />
                  <b>{fmt(r.products)}</b>
                </span>
                <span className="sl-stat" role="cell" data-label="Sales">
                  <Icon name="cart" />
                  <b>{fmt(r.sales)}</b>
                </span>
                <span className="sl-stat rating" role="cell" data-label="Rating">
                  <Icon name="star" className="sl-star" />
                  {r.rating === null ? (
                    <em>ახალი</em>
                  ) : (
                    <>
                      <b>{r.rating.toFixed(2)}</b>
                      <small>({fmt(r.ratingCount)})</small>
                    </>
                  )}
                </span>
              </div>
            )
          })
        )}
      </div>

      <footer className="sl-totals">
        <span>
          <Icon name="box" className="pink" />
          <span>
            <small>Total Products</small>
            <b>{fmt(totals.products)}</b>
          </span>
        </span>
        <span>
          <Icon name="cart" className="pink" />
          <span>
            <small>Total Sales</small>
            <b>{fmt(totals.sales)}</b>
          </span>
        </span>
        <span>
          <Icon name="star" className="gold" />
          <span>
            <small>Average Rating</small>
            <b>{totals.rating === null ? '—' : totals.rating.toFixed(2)}</b>
          </span>
        </span>
      </footer>
    </section>
  )
}
