import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type ReactNode } from 'react'
import type { MyTournamentEntry, PublicCoachDetail, PublicCoachingSession, PublicOrderSummary } from '@wavehub/shared-types'
import { CoachingSessionStatus, OrderStatus, TournamentStatus } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { gameCover } from '../lib/games'
import { ORDER_STATUS_LABELS } from '../lib/labels'
import { useShell } from '../lib/shell'

// docs/design-mockups/09-user-dashboard.jpg for the signed-in user: welcome, the next coaching
// session with a live countdown, coaching progress, marketplace / tournament summaries, the most
// recent order, wallet + Wave rank, and the closing banner. Everything is the user's real data; a
// block with nothing to show says so and links to where to start.

const OPEN_ORDER = [OrderStatus.Paid, OrderStatus.InProgress, OrderStatus.Delivered, OrderStatus.Disputed]

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [active])
  return now
}

const I: Record<string, ReactNode> = {
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  headset: <path d="M4 15v-3a8 8 0 0 1 16 0v3M4 14h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5Z" />,
  cart: <><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6" /><circle cx="9" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></>,
  trophy: <><path d="M7 3h10v5a5 5 0 0 1-10 0V3Z" /><path d="M7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4M12 13v4m-4 4h8m-6-4h4" /></>,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h4" />,
  wallet: <><path d="M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11" /><path d="M16 13h4" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  box: <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18M4 7.5l8 4.5 8-4.5" />,
  shield: <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />,
}
const Icon = ({ name }: { name: string }) => <svg viewBox="0 0 24 24" aria-hidden="true">{I[name]}</svg>

function Card({ icon, title, href, children, className = '' }: { icon: string; title: string; href?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`db-card ${className}`.trim()}>
      <header>
        <span className="db-card-icon">
          <Icon name={icon} />
        </span>
        <h2>{title}</h2>
        {href && (
          <Link href={href}>
            ყველას ნახვა <Icon name="arrow" />
          </Link>
        )}
      </header>
      {children}
    </section>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const { waveRank } = useShell()
  const userId = user?.id
  const [sessions, setSessions] = useState<PublicCoachingSession[] | null>(null)
  const [coach, setCoach] = useState<PublicCoachDetail | null>(null)
  const [orders, setOrders] = useState<PublicOrderSummary[]>([])
  const [tournaments, setTournaments] = useState<MyTournamentEntry[]>([])

  useEffect(() => {
    if (checked && !user) router.replace('/login?next=/dashboard')
  }, [checked, user, router])

  useEffect(() => {
    if (!userId) return
    api.listMySessionsAsBuyer().then(setSessions).catch(() => setSessions([]))
    Promise.all([api.listOrdersAsBuyer().catch(() => []), api.listOrdersAsSeller().catch(() => [])]).then(([bought, sold]) =>
      setOrders([...bought, ...sold].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    )
    api.listMyTournaments().then(setTournaments).catch(() => setTournaments([]))
  }, [userId])

  const now = useNow(true)
  const upcoming = (sessions ?? [])
    .filter((s) => s.status === CoachingSessionStatus.Scheduled && new Date(s.scheduledAt).getTime() > now - 3_600_000)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const next = upcoming[0] ?? null

  useEffect(() => {
    if (!next) return
    api
      .getCoach(next.coachId)
      .then(setCoach)
      .catch(() => setCoach(null))
  }, [next?.coachId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <Layout title="დაფა" noIndex>
        <div className="marketplace-empty">იტვირთება…</div>
      </Layout>
    )
  }

  const nonCancelled = (sessions ?? []).filter((s) => s.status !== CoachingSessionStatus.Cancelled)
  const completed = nonCancelled.filter((s) => s.status === CoachingSessionStatus.Completed).length
  const total = nonCancelled.length
  const progress = total ? completed / total : 0
  const openOrders = orders.filter((o) => OPEN_ORDER.includes(o.status) && o.buyer.id === user.id)
  const recent = orders[0] ?? null
  const activeTournaments = tournaments.filter((t) => t.tournament.status !== TournamentStatus.Completed)
  const ms = next ? Math.max(0, new Date(next.scheduledAt).getTime() - now) : 0
  const countdown = [Math.floor(ms / 86_400_000), Math.floor((ms % 86_400_000) / 3_600_000), Math.floor((ms % 3_600_000) / 60_000)]
  const coachName = next ? `${next.coachFirstName} ${next.coachLastName}`.trim() : ''

  return (
    <Layout title="დაფა" noIndex>
      <section className="db-page">
        <header className="db-welcome">
          <h1>
            კეთილი დაბრუნება, {user.firstName || user.username}! <span aria-hidden="true">👋</span>
          </h1>
          <p>აი, რა ხდება შენს WaveHubX-ზე.</p>
        </header>

        <section className="db-card db-next">
          <header>
            <span className="db-card-icon">
              <Icon name="calendar" />
            </span>
            <h2>მომავალი ქოუჩინგ სესია</h2>
          </header>
          {next ? (
            <div className="db-next-body">
              <span className="db-coach-photo" style={coach?.avatarUrl ? { backgroundImage: `url("${coach.avatarUrl}")` } : undefined}>
                {coach?.avatarUrl ? '' : coachName.slice(0, 2).toUpperCase()}
              </span>
              <div className="db-next-copy">
                <p className="db-coach-name">
                  <strong>{coachName}</strong>
                  <span className="db-verified" aria-label="ვერიფიცირებული"></span>
                  {coach?.profileBadge && <em>{coach.profileBadge}</em>}
                </p>
                <p className="db-next-meta">
                  <Icon name="calendar" />
                  {new Date(next.scheduledAt).toLocaleString('ka-GE', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                <p className="db-next-meta">
                  <Icon name="user" />
                  {next.durationMinutes} წუთი · {next.priceWaveCoin} GEL
                </p>
                <span className="db-status">დადასტურებული</span>
              </div>
              <div className="db-countdown">
                <small>იწყება</small>
                <div>
                  {countdown.map((value, i) => (
                    <span key={i}>
                      {i > 0 && <i>:</i>}
                      <span className="db-cd">
                        <b>{String(value).padStart(2, '0')}</b>
                        <small>{['დღე', 'სთ', 'წთ'][i]}</small>
                      </span>
                    </span>
                  ))}
                </div>
                <Link className="db-primary" href={`/coaching-sessions/${next.id}`}>
                  <Icon name="calendar" /> სესიის გახსნა
                </Link>
                <Link className="db-link" href="/coaching-sessions">
                  ყველა სესია <Icon name="arrow" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="db-empty-row">
              <p>{sessions === null ? 'იტვირთება…' : 'დაგეგმილი სესია არ გაქვს.'}</p>
              <Link className="db-outline" href="/coaching">
                ქოუჩის პოვნა
              </Link>
            </div>
          )}
        </section>

        <div className="db-grid-3">
          <Card icon="headset" title="ჩემი ქოუჩინგი" href="/coaching-sessions">
            {total === 0 ? (
              <div className="db-empty">
                <p>ჯერ სესია არ დაგიჯავშნია.</p>
                <Link className="db-outline" href="/coaching">
                  ქოუჩების ნახვა
                </Link>
              </div>
            ) : (
              <div className="db-progress">
                <span className="db-ring" style={{ ['--p' as string]: `${Math.round(progress * 100)}` }}>
                  <strong>
                    {completed}/{total}
                  </strong>
                  <small>დასრულებული</small>
                </span>
                <ul>
                  <li>
                    <i className="pink"></i>
                    {`${total} სესია`}
                  </li>
                  <li>
                    <i className="green"></i>
                    {`${completed} დასრულებული`}
                  </li>
                  <li>
                    <i className="violet"></i>
                    {`${upcoming.length} დარჩენილი`}
                  </li>
                </ul>
                {next && <p className="db-small">შემდეგი: {new Date(next.scheduledAt).toLocaleString('ka-GE', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
              </div>
            )}
          </Card>

          <Card icon="cart" title="მარკეტი" href="/orders">
            <div className="db-summary">
              <span className="db-summary-art">
                <Icon name="box" />
              </span>
              <div>
                <strong>{openOrders.length ? `${openOrders.length} აქტიური შეკვეთა` : 'აქტიური შეკვეთა არ არის'}</strong>
                <p>{openOrders.length ? 'თვალი ადევნე მიწოდებას შეკვეთების გვერდზე.' : 'დაათვალიერე ნივთები ან გაყიდე შენი ანგარიშები.'}</p>
              </div>
            </div>
            <Link className="db-outline wide" href={openOrders.length ? '/orders' : '/marketplace'}>
              {openOrders.length ? 'შეკვეთების ნახვა' : 'მარკეტის დათვალიერება'}
            </Link>
          </Card>

          <Card icon="trophy" title="ტურნირები" href="/tournaments/mine">
            <div className="db-summary">
              <span className="db-summary-art violet">
                <Icon name="shield" />
              </span>
              <div>
                <strong>{activeTournaments.length} ტურნირი</strong>
                <p>{activeTournaments.length ? 'თვალი ადევნე მატჩებს ტურნირის ჰაბში.' : 'ჯერ არცერთ ტურნირზე არ ხარ დარეგისტრირებული.'}</p>
              </div>
            </div>
            <Link className="db-outline wide" href={activeTournaments.length ? '/tournaments/hub' : '/tournaments'}>
              {activeTournaments.length ? 'ტურნირის ჰაბი' : 'ტურნირების ნახვა'}
            </Link>
          </Card>
        </div>

        <div className="db-grid-2">
          <Card icon="receipt" title="ბოლო შეკვეთა" href="/orders">
            {recent ? (
              <Link className="db-order" href={`/orders/${recent.id}`}>
                <span
                  className="db-order-thumb"
                  style={(() => {
                    const img = recent.listing.imageUrl ?? gameCover(recent.listing.gameSlug)
                    return img ? { backgroundImage: `url('${img}')` } : undefined
                  })()}
                ></span>
                <span className="db-order-copy">
                  <strong>{recent.listing.title}</strong>
                  <small>
                    {[recent.listing.gameName, recent.package?.name].filter(Boolean).join(' · ') || (recent.buyer.id === user.id ? `გამყიდველი: @${recent.seller.username}` : `მყიდველი: @${recent.buyer.username}`)}
                  </small>
                  <small className="db-order-date">
                    <Icon name="calendar" />
                    {new Date(recent.createdAt).toLocaleString('ka-GE', { dateStyle: 'medium', timeStyle: 'short' })}
                  </small>
                </span>
                <span className="db-order-side">
                  <em className={`db-order-status ${recent.status}`}>{ORDER_STATUS_LABELS[recent.status]}</em>
                  <b>{recent.priceWaveCoin} GEL</b>
                </span>
              </Link>
            ) : (
              <div className="db-empty">
                <p>შეკვეთები ჯერ არ გაქვს.</p>
                <Link className="db-outline" href="/marketplace">
                  მარკეტი
                </Link>
              </div>
            )}
          </Card>

          <Card icon="wallet" title="საფულე და სტატუსი" href="/wallet">
            <div className="db-wallet">
              <div>
                <small>საფულის ბალანსი</small>
                <strong>{user.wavecoinBalance} WC</strong>
                <Link className="db-primary sm" href="/wallet">
                  შევსება
                </Link>
              </div>
              <div className="db-rank">
                <small>რანგი</small>
                <strong>{waveRank?.name ?? '—'}</strong>
                <small>Wave Score</small>
                <b>{waveRank?.score ?? 0}</b>
                {waveRank && (
                  <>
                    <i>
                      <u style={{ width: `${waveRank.progressToNext}%` }}></u>
                    </i>
                    {waveRank.nextName !== waveRank.name && <small>შემდეგი: {waveRank.nextName}</small>}
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>

        <section className="db-banner">
          <div>
            <h2>აიმაღლე დონე.</h2>
            <p>ქოუჩინგი, ანგარიშები, ნივთები და ტურნირები — ყველაფერი ერთ ადგილას.</p>
            <Link className="db-primary" href="/">
              WaveHubX-ის აღმოჩენა
            </Link>
          </div>
        </section>
      </section>
    </Layout>
  )
}
