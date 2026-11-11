/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import type { RewardHub, RewardTaskView, RewardTrigger, RewardWinView } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import VerifiedMark from '../components/VerifiedMark'
import RewardChest from '../components/rewards/RewardChest'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useAuthModal } from '../lib/auth-modal'
import { useShell } from '../lib/shell'
import { kaDayMonth } from '../lib/dates'

// User Hub (owner 2026-11-10, docs/design-mockups/round-6/02). Every number is the viewer's real
// data from GET rewards/hub: tasks staff wrote (checked against real activity), XP and level, the
// check-in streak, this week's top 10 and the weekly prize boxes. Days reset at Tbilisi midnight.

const fmt = (n: number) => n.toLocaleString('en-US')
const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0')

const PATHS: Record<string, ReactNode> = {
  login: <path d="M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8M4 12h11m-4-4 4 4-4 4" />,
  store: (
    <>
      <path d="M4 9h16l-1.2-4.2A1 1 0 0 0 17.8 4H6.2a1 1 0 0 0-1 .8L4 9Z" />
      <path d="M5 9v10h14V9M9 19v-5h6v5" />
    </>
  ),
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H5a3 3 0 0 0 3 4m8-4h3a3 3 0 0 1-3 4M12 13v4m-4 3h8l-1-3H9l-1 3Z" />,
  cap: <path d="m2 9 10-5 10 5-10 5L2 9Zm4 2v5c3 2 9 2 12 0v-5M22 9v5" />,
  cart: <path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2M9.5 19a1 1 0 1 0 0 .1M17 19a1 1 0 1 0 0 .1" />,
  wallet: <path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7Zm0 0 11-3v3m1 7h.01" />,
  users: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m2 15a6 6 0 0 0-3-5.2" />,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  calendar: <path d="M4 6h16v14H4V6Zm0 4h16M8 3v4m8-4v4m-8 7 2.5 2.5L16 12" />,
  box: <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm-8 4.5 8 4.5 8-4.5M12 12v9" />,
  check: <path d="m5 12 4.5 4.5L19 7" />,
  lock: <path d="M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 8 0v3" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  fire: <path d="M12 21c-4 0-7-3-7-7 0-3 2-5 3-7 0 2 1 3 2 3 0-3 2-6 4-7-1 3 1 5 3 7 1 1 2 3 2 4 0 4-3 7-7 7Z" />,
  gift: <path d="M4 10h16v4H4v-4Zm1 4v6h14v-6M12 10v10m0-10c-2-4-7-5-7-2s5 2 7 2Zm0 0c2-4 7-5 7-2s-5 2-7 2Z" />,
  grid: <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />,
  bars: <path d="M5 20V12m7 8V5m7 15v-6M3 20h18" />,
  chevron: <path d="m9 6 6 6-6 6" />,
}

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={`uh-ico ${className ?? ''}`} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name] ?? PATHS.star}
    </svg>
  )
}

const TRIGGER: Record<RewardTrigger, { icon: string; href: string }> = {
  login: { icon: 'login', href: '/' },
  visit_marketplace: { icon: 'store', href: '/marketplace' },
  visit_tournaments: { icon: 'trophy', href: '/tournaments' },
  visit_coaching: { icon: 'cap', href: '/coaching' },
  purchase: { icon: 'cart', href: '/marketplace' },
  topup: { icon: 'wallet', href: '/wallet' },
  follow: { icon: 'users', href: '/marketplace' },
  follow_coach: { icon: 'users', href: '/coaching' },
  review: { icon: 'star', href: '/orders' },
  book_session: { icon: 'calendar', href: '/coaching' },
  tournament_join: { icon: 'trophy', href: '/tournaments' },
  list_item: { icon: 'box', href: '/marketplace?sell=1' },
}

function Medal({ place }: { place: number }) {
  if (place > 3) return <b className="uh-num">{place}</b>
  const tone = place === 1 ? ['#ffe27a', '#d99a00'] : place === 2 ? ['#f3f6ff', '#9aa3b8'] : ['#ffc08a', '#c2621f']
  return (
    <svg className="uh-medal" viewBox="0 0 56 44" role="img" aria-label={`${place} ადგილი`}>
      <path d="M9 14c-4 6-3 15 4 21M47 14c4 6 3 15-4 21" fill="none" stroke={tone[1]} strokeWidth="3" strokeLinecap="round" />
      <path d="M12 12l8 7 8-12 8 12 8-7-3 22H15L12 12Z" fill={tone[0]} stroke={tone[1]} strokeWidth="2" />
      <text x="28" y="31" textAnchor="middle" fontSize="15" fontWeight="900" fill="#2a1a05">
        {place}
      </text>
    </svg>
  )
}

function LevelHex({ level }: { level: number }) {
  return (
    <svg className="uh-hex" viewBox="0 0 120 132" aria-hidden="true">
      <defs>
        <linearGradient id="uhHex" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7ae0" />
          <stop offset="1" stopColor="#8a2be2" />
        </linearGradient>
      </defs>
      <path d="M60 4 112 34v64l-52 30L8 98V34L60 4Z" fill="rgba(60,20,90,.65)" stroke="url(#uhHex)" strokeWidth="5" />
      <path d="M44 40l8 7 8-12 8 12 8-7-3 14H47l-3-14Z" fill="none" stroke="#ff9cf0" strokeWidth="3" strokeLinejoin="round" />
      <text x="60" y="86" textAnchor="middle" fontSize="24" fontWeight="900" fill="#fff">
        Lv. {level}
      </text>
    </svg>
  )
}

function TaskRow({ task }: { task: RewardTaskView }) {
  const t = TRIGGER[task.trigger]
  return (
    <li className={`uh-task${task.done ? ' done' : ''}`}>
      <Icon name={t.icon} className="uh-task-icon" />
      <span className="uh-task-text">
        {task.done ? <span>{task.title}</span> : <Link href={t.href}>{task.title}</Link>}
        {task.target > 1 && (
          <small>
            {task.progress} / {task.target}
          </small>
        )}
      </span>
      <b className="uh-xp">+{fmt(task.xp)} XP</b>
      <span className={`uh-check${task.done ? ' on' : ''}`} aria-label={task.done ? 'შესრულებულია' : 'შესასრულებელია'}>
        {task.done && <Icon name="check" />}
      </span>
    </li>
  )
}

function PrizeOpener({ win, onClose, onOpened }: { win: RewardWinView; onClose: () => void; onOpened: (w: RewardWinView) => void }) {
  const [stage, setStage] = useState<'idle' | 'shaking' | 'open'>(win.openedAt ? 'open' : 'idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const open = async () => {
    setError('')
    setStage('shaking')
    try {
      const [fresh] = await Promise.all([api.openRewardWin(win.id), new Promise((r) => setTimeout(r, 1400))])
      setStage('open')
      onOpened(fresh)
    } catch (err) {
      setStage('idle')
      setError(errorMessage(err, 'ყუთი ვერ გაიხსნა.'))
    }
  }

  return (
    <div className="uh-modal" role="dialog" aria-modal="true" aria-label="პრიზის ყუთი" onClick={onClose}>
      <div className={`uh-opener ${stage}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="uh-close" onClick={onClose} aria-label="დახურვა">
          ×
        </button>
        <p className="uh-opener-kicker">კვირის Top {win.place} · {kaDayMonth(new Date(`${win.weekStart}T12:00:00Z`))}-ის კვირა</p>
        <div className="uh-opener-stage">
          <span className="uh-rays" aria-hidden="true"></span>
          <RewardChest open={stage === 'open'} place={win.place} className="uh-opener-chest" />
          {stage === 'open' && (
            <div className="uh-prize-card">
              {win.prize.imageUrl ? <img src={win.prize.imageUrl} alt="" /> : <Icon name="gift" className="uh-prize-icon" />}
              <strong>{win.prize.title}</strong>
              {win.prize.description && <p>{win.prize.description}</p>}
            </div>
          )}
        </div>
        {stage === 'open' ? (
          <p className="uh-opener-note">{win.deliveredAt ? 'პრიზი გადმოგეცა ✓' : 'WaveHubX-ის გუნდი მალე დაგიკავშირდება პრიზის გადასაცემად.'}</p>
        ) : (
          <button type="button" className="uh-open-btn" onClick={open} disabled={stage === 'shaking'}>
            {stage === 'shaking' ? 'იხსნება…' : 'ყუთის გახსნა'}
          </button>
        )}
        {error && <p className="uh-error">{error}</p>}
      </div>
    </div>
  )
}

export default function UserHubPage() {
  const { user, checked } = useAuth()
  const { openLogin } = useAuthModal()
  const { waveRank } = useShell()
  const [hub, setHub] = useState<RewardHub | null>(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [earned, setEarned] = useState<Array<{ title: string; xp: number }>>([])
  const [opening, setOpening] = useState<RewardWinView | null>(null)
  const userId = user?.id

  const load = useCallback(() => {
    api
      .getRewardHub()
      .then((h) => {
        setHub(h)
        if (h.justEarned.length) setEarned(h.justEarned)
      })
      .catch((err) => setError(errorMessage(err, 'User Hub ვერ ჩაიტვირთა.')))
  }, [])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // A new day while the page is open: fetch the fresh tasks.
  useEffect(() => {
    if (hub && now >= Date.parse(hub.resetsAt) + 2000) load()
  }, [now, hub, load])

  useEffect(() => {
    if (!earned.length) return
    const timer = window.setTimeout(() => setEarned([]), 5000)
    return () => window.clearTimeout(timer)
  }, [earned])

  const left = hub ? Math.max(0, Date.parse(hub.resetsAt) - now) : 0
  const resets = `${pad(Math.floor(left / 3_600_000))}:${pad(Math.floor((left % 3_600_000) / 60_000))}:${pad(Math.floor((left % 60_000) / 1000))}`
  const weekLeft = hub ? Math.max(0, Date.parse(hub.weekEndsAt) - now) : 0
  const weekDays = Math.floor(weekLeft / 86_400_000)
  const weekHours = Math.floor((weekLeft % 86_400_000) / 3_600_000)

  const hero = (
    <section className="uh-hero" id="overview">
      <div>
        <h1>
          User <em>Hub</em>
        </h1>
        <p>შეასრულე დავალებები, დააგროვე XP, აიწიე Level და მოიგე კვირის პრიზები.</p>
      </div>
      <RewardChest className="uh-hero-chest" />
    </section>
  )

  if (checked && !user) {
    return (
      <Layout title="User Hub" noIndex>
        <div className="uh-page">
          {hero}
          <section className="uh-card uh-guest">
            <p>User Hub-ის სანახავად შედი ანგარიშზე.</p>
            <button type="button" className="uh-open-btn" onClick={() => openLogin()}>
              შესვლა
            </button>
          </section>
        </div>
      </Layout>
    )
  }

  const pct = hub ? Math.min(100, Math.round(((hub.xp.total - hub.xp.levelFloor) / Math.max(1, hub.xp.nextLevelAt - hub.xp.levelFloor)) * 100)) : 0
  const pendingWins = hub?.wins.filter((w) => !w.openedAt) ?? []

  return (
    <Layout title="User Hub" noIndex>
      <div className="uh-page">
        {hero}
        {error && <p className="status-text status-error">{error}</p>}
        {hub && !hub.enabled && (
          <section className="uh-card uh-guest">
            <p>User Hub დროებით გამორთულია.</p>
          </section>
        )}
        {!hub && !error && <p className="empty-state">იტვირთება…</p>}

        {hub?.enabled && (
          <div className="uh-grid">
            <aside className="uh-card uh-profile">
              <LevelHex level={hub.xp.level} />
              <strong className="uh-rank">{waveRank?.name ?? user?.username}</strong>
              <span className="uh-xp-line">
                {fmt(hub.xp.total)} / {fmt(hub.xp.nextLevelAt)} XP
              </span>
              <span className="uh-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <i style={{ width: `${pct}%` }}></i>
              </span>
              <span className="uh-week-xp">
                ამ კვირაში: <b>{fmt(hub.xp.week)} XP</b>
                {hub.me.place && <> · #{hub.me.place}</>}
              </span>
              <nav className="uh-nav" aria-label="User Hub">
                <a href="#overview" className="active">
                  <Icon name="grid" /> Overview
                </a>
                <a href="#daily">
                  <Icon name="calendar" /> Daily Tasks
                </a>
                <a href="#achievements">
                  <Icon name="trophy" /> Achievements
                </a>
                <a href="#leaderboard">
                  <Icon name="bars" /> Leaderboard
                </a>
                <a href="#rewards">
                  <Icon name="gift" /> Rewards
                  {pendingWins.length > 0 && <span className="uh-dot">{pendingWins.length}</span>}
                </a>
              </nav>
            </aside>

            <section className="uh-card uh-daily" id="daily">
              <header className="uh-card-head">
                <Icon name="calendar" className="uh-head-icon" />
                <span>
                  <h2>Daily Tasks</h2>
                  <small>შეასრულე მარტივი დავალებები და მიიღე XP ყოველდღე.</small>
                </span>
                <span className="uh-reset">
                  <Icon name="refresh" /> Resets in: <b>{resets}</b>
                </span>
              </header>
              {hub.daily.length === 0 ? (
                <p className="uh-empty">დღიური დავალებები ჯერ არ არის.</p>
              ) : (
                <ul className="uh-tasks">
                  {hub.daily.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </ul>
              )}
            </section>

            <section className="uh-card uh-streak">
              <header className="uh-card-head">
                <Icon name="fire" className="uh-head-icon fire" />
                <span>
                  <h2>Daily Streak</h2>
                  <small>შემოდი ყოველდღე და გაზარდე Streak!</small>
                </span>
              </header>
              <ol className="uh-days">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                  const done = d <= hub.streak.position
                  const current = hub.streak.todayDone ? d === hub.streak.position : d === hub.streak.position + 1
                  return (
                    <li key={d} className={`${done ? 'done' : ''}${current ? ' current' : ''}`}>
                      <b>{d}</b>
                      {done ? <Icon name="check" /> : current ? <span className="uh-today">დღეს</span> : <Icon name="lock" />}
                    </li>
                  )
                })}
              </ol>
              <div className="uh-streak-reward">
                <Icon name="gift" className="uh-gift" />
                <span>
                  <strong>7-Day Streak Reward</strong>
                  <small>Bonus +{fmt(hub.streak.bonusXp)} XP · Streak: {hub.streak.days} დღე</small>
                </span>
                <RewardChest className="uh-mini-chest" />
              </div>
            </section>

            <section className="uh-card uh-achievements" id="achievements">
              <header className="uh-card-head">
                <Icon name="trophy" className="uh-head-icon" />
                <span>
                  <h2>Achievements</h2>
                  <small>მიაღწიე მიზნებს და მიიღე უნიკალური ჯილდოები.</small>
                </span>
              </header>
              {hub.achievements.length === 0 ? (
                <p className="uh-empty">მიღწევები ჯერ არ არის.</p>
              ) : (
                <ul className="uh-ach-list">
                  {hub.achievements.map((a) => (
                    <li key={a.id} className={a.done ? 'done' : undefined}>
                      <span className="uh-ach-hex">
                        <Icon name={TRIGGER[a.trigger].icon} />
                        {a.done && (
                          <i className="uh-ach-ok">
                            <Icon name="check" />
                          </i>
                        )}
                      </span>
                      <strong>{a.title}</strong>
                      {a.target > 1 && !a.done && (
                        <small>
                          {a.progress} / {a.target}
                        </small>
                      )}
                      <b className="uh-xp">+{fmt(a.xp)} XP</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="uh-card uh-board" id="leaderboard">
              <header className="uh-card-head">
                <Icon name="bars" className="uh-head-icon" />
                <span>
                  <h2>Community Leaderboard</h2>
                  <small>
                    ამ კვირის Top 10 · დასრულებამდე {weekDays} დღე {weekHours} სთ
                  </small>
                </span>
              </header>
              {hub.leaderboard.length === 0 ? (
                <p className="uh-empty">ამ კვირაში XP ჯერ არავის აქვს — იყავი პირველი!</p>
              ) : (
                <ol className="uh-leaders">
                  {hub.leaderboard.map((r) => {
                    const name = [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.username
                    return (
                      <li key={r.username} className={`p${r.place}${r.username === user?.username ? ' me' : ''}`}>
                        <span className="uh-place">
                          <Medal place={r.place} />
                        </span>
                        <Link href={`/u/${r.username}`} className="uh-leader-who">
                          <Avatar name={name} src={r.avatarUrl} size={36} ring={false} />
                          <span>{name}</span>
                          {r.verified && <VerifiedMark size={16} />}
                        </Link>
                        <b>{fmt(r.xp)} XP</b>
                      </li>
                    )
                  })}
                </ol>
              )}
              {hub.me.place && hub.me.place > 10 && (
                <p className="uh-me-line">
                  შენ ხარ #{hub.me.place} · {fmt(hub.me.xp)} XP
                </p>
              )}
            </section>

            <section className="uh-card uh-rewards" id="rewards">
              <header className="uh-card-head">
                <Icon name="gift" className="uh-head-icon" />
                <span>
                  <h2>Weekly Rewards</h2>
                  <small>კვირის ბოლოს Top 3 იღებს პრიზის ყუთს. კვირა ორშაბათიდან კვირამდეა (თბილისის დროით).</small>
                </span>
              </header>
              {pendingWins.length > 0 && (
                <div className="uh-wins">
                  {pendingWins.map((w) => (
                    <button key={w.id} type="button" className="uh-win" onClick={() => setOpening(w)}>
                      <RewardChest place={w.place} className="uh-win-chest" />
                      <span>
                        <strong>შენ მოიგე Top {w.place}! 🎉</strong>
                        <small>დააჭირე და გახსენი ყუთი</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {hub.prizes.length === 0 ? (
                <p className="uh-empty">ამ კვირის პრიზები მალე გამოცხადდება.</p>
              ) : (
                <ul className="uh-prizes">
                  {hub.prizes.map((p) => (
                    <li key={p.place} className={`p${p.place}`}>
                      <Medal place={p.place} />
                      {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <RewardChest place={p.place} className="uh-prize-chest" />}
                      <strong>{p.title}</strong>
                      {p.description && <small>{p.description}</small>}
                    </li>
                  ))}
                </ul>
              )}
              {hub.wins.some((w) => w.openedAt) && (
                <div className="uh-history">
                  <h3>ჩემი პრიზები</h3>
                  {hub.wins
                    .filter((w) => w.openedAt)
                    .map((w) => (
                      <button key={w.id} type="button" onClick={() => setOpening(w)}>
                        <span>
                          Top {w.place} · {w.prize.title}
                        </span>
                        <small>{w.deliveredAt ? 'გადაცემულია ✓' : 'გადაცემის მოლოდინში'}</small>
                      </button>
                    ))}
                </div>
              )}
            </section>
          </div>
        )}

        {earned.length > 0 && (
          <div className="uh-toast" role="status">
            {earned.map((e) => (
              <span key={e.title}>
                <b>+{fmt(e.xp)} XP</b> {e.title}
              </span>
            ))}
          </div>
        )}

        {opening && (
          <PrizeOpener
            win={opening}
            onClose={() => setOpening(null)}
            onOpened={(fresh) => {
              setOpening(fresh)
              setHub((h) => (h ? { ...h, wins: h.wins.map((w) => (w.id === fresh.id ? fresh : w)) } : h))
            }}
          />
        )}
      </div>
    </Layout>
  )
}
