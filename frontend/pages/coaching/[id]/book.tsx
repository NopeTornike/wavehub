/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_COACH_AVAILABILITY, coachAvailabilityProblem, coachAvailabilityStarts, type PublicCoachDetail, type PublicCoachingSession } from '@wavehub/shared-types'
import PageHead from '../../../components/PageHead'
import LanguageSwitcher from '../../../components/LanguageSwitcher'
import { api, errorMessage } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'

// Tornike's 6-step coach booking (prototype coach-booking.html + coach-booking-flow.js, 38b086d),
// markup and `booking-*` classes 1:1, on real data:
//   1 package — the coach's hourly single session + their real packages (no invented tiers);
//   2 schedule — 14 days × hourly slots (Tbilisi time), the coach's booked times greyed out
//     (GET coaches/:id/busy); a package needs its sessionsCount slots;
//   3 goal — goal + Discord required, challenges optional, plus the coach's own questions;
//   4 review; 5 payment — from the WaveCoin balance into escrow (POST coaches/:id/bookings;
//     top up on /wallet if short); 6 confirmation — the sessions just created.
// The prototype's "Most popular" ribbon, fixed 3/5-session tiers and BOG-per-booking payment are not
// ported (rule #6 / our payment model is the WaveCoin balance).

type IconName =
  | 'arrowRight' | 'arrowLeft' | 'package' | 'rocket' | 'growth' | 'crown' | 'clock' | 'note' | 'chat' | 'check' | 'shield' | 'calendar'
  | 'headset' | 'star' | 'user' | 'thumb' | 'help' | 'target' | 'gamepad' | 'alert' | 'lock' | 'discord' | 'light' | 'clipboard' | 'lari'
  | 'bolt' | 'card' | 'mail' | 'bell' | 'monitor' | 'grid' | 'home' | 'trash' | 'external' | 'close' | 'wallet'

const ICONS: Record<IconName, ReactNode> = {
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5m6 6-6-6 6-6" />,
  package: (
    <>
      <path d="m3 7 9 5 9-5-9-5-9 5Z" />
      <path d="m3 7 9 5v10l-9-5V7Zm18 0-9 5v10l9-5V7Z" />
    </>
  ),
  rocket: (
    <>
      <path d="M14 5c3.5-3.5 6.8-2.8 6.8-2.8S21.5 5.5 18 9l-5 5-4-4 5-5Z" />
      <path d="m9 10-4 1-3 3 6 1m5-1 1 6 3-3 1-4M7 17c-2 0-3 1-3 3 2 0 3-1 3-3Z" />
    </>
  ),
  growth: (
    <>
      <path d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
      <path d="m3 8 5-5 5 5 8-8" />
    </>
  ),
  crown: (
    <>
      <path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" />
      <path d="M5 22h14" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  note: (
    <>
      <path d="M5 3h14v18H5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v12H9l-5 4V5Z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  shield: (
    <>
      <path d="M12 2 4 5v6c0 5 3.4 8.4 8 11 4.6-2.6 8-6 8-11V5l-8-3Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4m8-4v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  headset: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2Zm16 0h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2Z" />
    </>
  ),
  star: <path d="m12 2 3 6 6.5 1-4.8 4.7 1.2 6.5L12 17l-5.9 3.2 1.2-6.5L2.5 9 9 8l3-6Z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  thumb: <path d="M7 10v11H3V10h4Zm0 9h10a2 2 0 0 0 2-1.6l1.5-7A2 2 0 0 0 18.5 8H14l1-4c.3-1.2-.5-2-1.5-2L7 10" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.3 2.3 0 1 1 3.6 1.9c-1 .7-1.4 1.2-1.4 2.1m0 4h.01" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
      <path d="m14 10 7-7" />
    </>
  ),
  gamepad: (
    <>
      <path d="M7 8h10a5 5 0 0 1 4.5 7.2l-1.2 2.5a2.2 2.2 0 0 1-3.5.6L15 16H9l-1.8 2.3a2.2 2.2 0 0 1-3.5-.6l-1.2-2.5A5 5 0 0 1 7 8Z" />
      <path d="M7 11v4m-2-2h4m7-1h.01m2 2h.01" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6m0 4h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  discord: (
    <>
      <path
        className="discord-mark"
        d="M18.8 5.7A16 16 0 0 0 15 4.5l-.5 1a13.5 13.5 0 0 0-5 0l-.5-1a16 16 0 0 0-3.8 1.2C3.6 8.1 2.8 10.8 2.6 14c1.8 2 3.6 3.1 5.4 3.8l1.3-1.7a11 11 0 0 1-2-1c3 1.4 6.4 1.4 9.4 0-.6.4-1.3.7-2 1l1.3 1.7c1.8-.7 3.6-1.8 5.4-3.8-.2-3.2-1-5.9-2.6-8.3Z"
      />
      <ellipse className="discord-eye" cx="9" cy="11.8" rx="1.25" ry="1.55" />
      <ellipse className="discord-eye" cx="15" cy="11.8" rx="1.25" ry="1.55" />
    </>
  ),
  light: (
    <>
      <path d="M9 18h6m-5 3h4" />
      <path d="M8.5 15a6 6 0 1 1 7 0c-1 .7-1.5 1.4-1.5 2h-4c0-.6-.5-1.3-1.5-2Z" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="18" rx="2" />
      <path d="M9 4V2h6v2M9 10h6m-6 4h6m-6 4h4" />
    </>
  ),
  lari: (
    <text x="12" y="17" textAnchor="middle" fill="currentColor" stroke="none" fontSize="17" fontWeight="700">
      ₾
    </text>
  ),
  bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" />,
  monitor: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  home: <path d="m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z" />,
  trash: <path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" />,
  external: (
    <>
      <path d="M14 3h7v7m0-7-9 9" />
      <path d="M18 13v8H3V6h8" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M16 15h2" />
    </>
  ),
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  )
}

const STEPS: Array<[string, IconName]> = [
  ['პაკეტი', 'package'],
  ['განრიგი', 'calendar'],
  ['შენი მიზანი', 'target'],
  ['შემოწმება', 'clipboard'],
  ['გადახდა', 'card'],
  ['დადასტურება', 'check'],
]
const TONES = ['pink', 'gold', 'purple']
const PKG_ICONS: IconName[] = ['growth', 'crown', 'rocket']
const WEEKDAYS = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი']
const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ']
// Coaches are in Georgia: slots are Tbilisi time (UTC+4, no DST).
const TZ_OFFSET = '+04:00'
const DAYS = 14
const SINGLE = 'single'
const SINGLE_MINUTES = 60

type Option = { id: string; name: string; subtitle: string; sessions: number; minutes: number; total: number; icon: IconName; tone: string; features: Array<[IconName, string]> }
type Draft = { step: number; option: string; slots: string[]; goal: string; challenges: string; discord: string; answers: Record<string, string> }

// The Tbilisi calendar date of `ms` as YYYY-MM-DD.
function tbilisiDate(ms: number): string {
  return new Date(ms + 4 * 3600_000).toISOString().slice(0, 10)
}
function dayParts(date: string) {
  const d = new Date(`${date}T12:00:00${TZ_OFFSET}`)
  return { weekday: WEEKDAYS[d.getUTCDay()], day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()] }
}
function slotLabel(iso: string): string {
  const t = new Date(iso).getTime()
  const date = tbilisiDate(t)
  const p = dayParts(date)
  const hm = new Date(t + 4 * 3600_000).toISOString().slice(11, 16)
  return `${p.day} ${p.month} · ${hm}`
}
function money(value: number): string {
  return `₾${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function scoreLabel(score: number): string {
  if (score >= 90) return 'შესანიშნავი'
  if (score >= 70) return 'ძალიან კარგი'
  if (score >= 40) return 'კარგი'
  return 'მზარდი'
}

export default function CoachBooking() {
  const router = useRouter()
  const coachId = typeof router.query.id === 'string' ? router.query.id : ''
  const { user, checked, refresh } = useAuth()
  const [coach, setCoach] = useState<PublicCoachDetail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState<Array<{ start: number; end: number }>>([])
  const [draft, setDraft] = useState<Draft>({ step: 1, option: SINGLE, slots: [], goal: '', challenges: '', discord: '', answers: {} })
  const [date, setDate] = useState(() => tbilisiDate(Date.now()))
  const [showAllDates, setShowAllDates] = useState(false)
  const [formError, setFormError] = useState('')
  const [paying, setPaying] = useState(false)
  const [booked, setBooked] = useState<PublicCoachingSession[] | null>(null)
  const storageKey = `wavehub.coachBooking.${coachId}`

  // The prototype's standalone booking shell is scoped by a <body> class.
  useEffect(() => {
    document.body.classList.add('booking-flow-body')
    return () => document.body.classList.remove('booking-flow-body')
  }, [])

  useEffect(() => {
    if (checked && !user && coachId) router.replace(`/login?next=${encodeURIComponent(`/coaching/${coachId}/book`)}`)
  }, [checked, user, coachId, router])

  // Restore an unfinished booking (e.g. after topping up the wallet) and the requested package.
  useEffect(() => {
    if (!coachId) return
    let saved: Partial<Draft> = {}
    try {
      saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}')
    } catch {
      saved = {}
    }
    const pkg = typeof router.query.package === 'string' ? router.query.package : ''
    const step = Number(router.query.step) || saved.step || 1
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft((d) => ({ ...d, ...saved, ...(pkg ? { option: pkg, slots: [] } : {}), step: Math.min(5, Math.max(1, step)) }))
  }, [coachId, storageKey, router.query.package, router.query.step])

  useEffect(() => {
    if (!coachId || booked) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft))
    } catch {
      // private mode — the booking still works, it just isn't restored after a reload
    }
  }, [draft, coachId, storageKey, booked])

  useEffect(() => {
    if (!coachId) return
    api
      .getCoach(coachId)
      .then((c) => {
        setCoach(c)
        // Open the calendar on the first day the coach works (and still has bookable time).
        const now = Date.now()
        const hours = c.availability ?? DEFAULT_COACH_AVAILABILITY
        for (let i = 0; i < DAYS; i++) {
          const d = tbilisiDate(now + i * 86400_000)
          if (coachAvailabilityStarts(hours, d, 30).some((ms) => !coachAvailabilityProblem(hours, ms, 30, now))) {
            setDate((current) => (current === tbilisiDate(now) ? d : current))
            break
          }
        }
      })
      .catch((err) => setLoadError(errorMessage(err, 'ქოუჩი ვერ მოიძებნა.')))
  }, [coachId])

  const loadBusy = useCallback(() => {
    if (!coachId) return
    api
      .coachBusyTimes(coachId)
      .then((rows) => setBusy(rows.map((r) => ({ start: new Date(r.start).getTime(), end: new Date(r.end).getTime() }))))
      .catch(() => setBusy([]))
  }, [coachId])
  useEffect(() => {
    if (user) loadBusy()
  }, [user, loadBusy])

  const options: Option[] = useMemo(() => {
    if (!coach) return []
    const single: Option = {
      id: SINGLE,
      name: 'ერთი სესია',
      subtitle: 'ერთჯერადი დაჯავშნა · პაკეტისა და გამოწერის გარეშე',
      sessions: 1,
      minutes: SINGLE_MINUTES,
      total: Math.round((coach.hourlyRateWaveCoin * SINGLE_MINUTES) / 60),
      icon: 'rocket',
      tone: 'purple',
      features: [
        ['user', '1 პირდაპირი სესია'],
        ['clock', `${SINGLE_MINUTES} წუთი`],
        ['check', 'გადახდა მხოლოდ ერთ სესიაზე'],
        ['check', 'გამოწერის გარეშე'],
        ['chat', 'ჩატი ქოუჩთან'],
      ],
    }
    return [
      single,
      ...coach.packages.map((p, i): Option => ({
        id: p.id,
        name: p.name,
        subtitle: p.description || `${p.sessionsCount} სესიიანი პაკეტი`,
        sessions: p.sessionsCount,
        minutes: p.durationMinutes,
        total: p.priceWaveCoin,
        icon: PKG_ICONS[i % PKG_ICONS.length],
        tone: TONES[i % TONES.length],
        features: [
          ['package', `${p.sessionsCount} პირდაპირი სესია`],
          ['clock', `თითო ${p.durationMinutes} წუთი`],
          ['check', 'თანხა დაცულია სესიების დასრულებამდე'],
          ['chat', 'ჩატი ქოუჩთან'],
        ],
      })),
    ]
  }, [coach])

  const option = options.find((o) => o.id === draft.option) ?? options[0]
  const [openedAt] = useState(() => Date.now())
  const dates = useMemo(() => Array.from({ length: DAYS }, (_, i) => tbilisiDate(openedAt + i * 86400_000)), [openedAt])
  const today = dates[0]
  const tomorrow = dates[1]

  // Starts come from the coach's working hours (coachAvailabilityStarts — the backend checks the
  // same rules). A start is free when it respects the coach's notice/horizon and overlaps neither
  // the coach's bookings nor the student's other chosen slots.
  const availability = coach?.availability ?? DEFAULT_COACH_AVAILABILITY
  const slotState = useCallback(
    (iso: string): 'free' | 'busy' | 'past' => {
      if (!option) return 'busy'
      const start = new Date(iso).getTime()
      const end = start + option.minutes * 60_000
      if (coachAvailabilityProblem(availability, start, option.minutes, Date.now())) return 'past'
      if (busy.some((b) => start < b.end && b.start < end)) return 'busy'
      return 'free'
    },
    [busy, option, availability],
  )
  const daySlots = (d: string) => (option ? coachAvailabilityStarts(availability, d, option.minutes).map((ms) => new Date(ms).toISOString()) : [])
  const freeCount = (d: string) => daySlots(d).filter((s) => slotState(s) === 'free').length
  const overlapsChosen = (iso: string) => {
    if (!option) return false
    const s = new Date(iso).getTime()
    const e = s + option.minutes * 60_000
    return draft.slots.some((c) => {
      if (c === iso) return false
      const cs = new Date(c).getTime()
      return s < cs + option.minutes * 60_000 && cs < e
    })
  }

  const goStep = (step: number) => {
    setFormError('')
    setDraft((d) => ({ ...d, step }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const next = () => {
    if (!option) return
    if (draft.step === 2 && draft.slots.length !== option.sessions) {
      setFormError(`აირჩიე ${option.sessions} დრო გასაგრძელებლად.`)
      return
    }
    if (draft.step === 3) {
      if (draft.goal.trim().length < 5) return setFormError('აღწერე შენი მიზანი (მინიმუმ 5 სიმბოლო).')
      if (!/^[\w.#-]{2,40}$/u.test(draft.discord.trim())) return setFormError('მიუთითე Discord-ის მომხმარებლის სახელი (ლათინური ასოები, ციფრები, . _ - #).')
      const missing = coach?.bookingQuestions.find((q) => q.required && !(draft.answers[q.key] ?? '').trim())
      if (missing) return setFormError(`უპასუხე კითხვას: ${missing.label}`)
    }
    goStep(draft.step + 1)
  }

  const pay = async () => {
    if (!coach || !option) return
    setFormError('')
    setPaying(true)
    try {
      const answers = Object.fromEntries(Object.entries(draft.answers).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
      const result = await api.bookCoachSessions(coach.id, {
        ...(option.id === SINGLE ? { durationMinutes: option.minutes } : { packageId: option.id }),
        slots: draft.slots,
        goal: draft.goal.trim(),
        challenges: draft.challenges.trim() || undefined,
        discord: draft.discord.trim(),
        answers: Object.keys(answers).length ? answers : undefined,
      })
      setBooked(result)
      try {
        sessionStorage.removeItem(storageKey)
      } catch {
        // ignore
      }
      await refresh()
      setDraft((d) => ({ ...d, step: 6 }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setFormError(errorMessage(err, 'დაჯავშნა ვერ მოხერხდა.'))
      loadBusy()
    } finally {
      setPaying(false)
    }
  }

  if (loadError) {
    return (
      <main className="booking-flow">
        <PageHead title="ქოუჩინგის დაჯავშნა" noIndex />
        <div className="booking-shell">
          <p className="booking-no-availability">{loadError}</p>
          <Link className="booking-back" href="/coaching">
            <Icon name="arrowLeft" /> ქოუჩებზე დაბრუნება
          </Link>
        </div>
      </main>
    )
  }
  if (!coach || !user || !option) {
    return (
      <main className="booking-flow">
        <PageHead title="ქოუჩინგის დაჯავშნა" noIndex />
        <div className="booking-shell">
          <p className="booking-no-availability">იტვირთება…</p>
        </div>
      </main>
    )
  }

  const name = `${coach.firstName} ${coach.lastName}`.trim() || coach.username
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const rating = coach.ratingAvg ? Number(coach.ratingAvg) : null
  const balance = user.wavecoinBalance
  const shortBy = Math.max(0, option.total - balance)
  const step = draft.step

  const coachCard = (
    <article className="booking-coach-card">
      <div
        className={`booking-coach-avatar${coach.avatarUrl ? ' has-image' : ''}`}
        style={coach.avatarUrl ? ({ '--booking-coach-image': `url('${coach.avatarUrl}')` } as React.CSSProperties) : undefined}
      >
        {coach.avatarUrl ? '' : initials}
      </div>
      <div className="booking-coach-copy">
        <div className="booking-coach-name">
          <h2>{name}</h2>
          <span className="booking-verified">✓</span>
          <em>
            <Icon name="shield" /> {coach.rank || 'ვერიფიცირებული ქოუჩი'}
          </em>
        </div>
        <div className="booking-rating">
          <Icon name="star" />
          {rating !== null ? (
            <>
              <strong>{rating.toFixed(1)}</strong>
              <span>({coach.ratingCount} შეფასება)</span>
            </>
          ) : (
            <span>ახალი ქოუჩი — შეფასებები ჯერ არ აქვს</span>
          )}
        </div>
        {step >= 3 && coach.online && (
          <div className="booking-online">
            <i></i> ონლაინ
          </div>
        )}
        <div className="booking-coach-stats">
          <Icon name="user" /> {coach.completedSessions} დასრულებული სესია
          {coach.stats.successRate !== null && (
            <>
              {' '}
              <i>•</i> <Icon name="thumb" /> {coach.stats.successRate}% წარმატებული
            </>
          )}
        </div>
      </div>
      <div className="booking-score">
        <span>
          <Icon name="shield" />
          <strong>Wave ქულა</strong>
        </span>
        <b>
          {coach.waveScore.score}
          <small>/100</small>
        </b>
        <em>{scoreLabel(coach.waveScore.score)}</em>
      </div>
    </article>
  )

  const intro = (kicker: string, title: string, subtitle: ReactNode) => (
    <div className="booking-intro">
      {kicker && <span>{kicker}</span>}
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  )

  const secureNote = (text: string) => (
    <p className="booking-secure-note">
      <Icon name="lock" /> {text}
    </p>
  )

  const nav = (label: string, opts: { back?: boolean; single?: boolean; note?: string } = {}) => (
    <>
      {formError && (
        <p className="booking-form-error" role="alert">
          {formError}
        </p>
      )}
      <div className={`booking-actions${opts.single ? ' single' : ''}`}>
        {opts.back !== false && (
          <button className="booking-back" type="button" onClick={() => goStep(step - 1)}>
            <Icon name="arrowLeft" /> უკან
          </button>
        )}
        <button className="booking-next" type="button" onClick={next}>
          {label}
          <Icon name="arrowRight" />
        </button>
      </div>
      {secureNote(opts.note ?? 'გადახდამდე ყველაფერს გადაამოწმებ.')}
    </>
  )

  let body: ReactNode = null
  if (step === 1) {
    body = (
      <>
        {intro('', 'დაჯავშნე ქოუჩინგ სესია', 'აირჩიე ერთი სესია ან პაკეტი, რომელიც შენს მიზნებს შეესაბამება.')}
        {coachCard}
        <section className="booking-section-heading">
          <span>
            <Icon name="package" />
          </span>
          <div>
            <h2>აირჩიე სესიის ვარიანტი</h2>
            <p>დაჯავშნე ერთი სესია ან ქოუჩის პაკეტი. ყველა ვარიანტი მოიცავს ინდივიდუალურ ქოუჩინგს {name}-თან.</p>
          </div>
        </section>
        <div className="booking-packages">
          {options.map((o) => {
            const selected = o.id === option.id
            const choose = () => setDraft((d) => ({ ...d, option: o.id, slots: d.option === o.id ? d.slots : [] }))
            return (
              <article key={o.id} className={`booking-package ${o.tone}${selected ? ' selected' : ''}`}>
                <button className="booking-radio" type="button" aria-label={`აირჩიე ${o.name}`} onClick={choose}>
                  {selected && <Icon name="check" />}
                </button>
                <div className="booking-package-icon">
                  <Icon name={o.icon} />
                </div>
                <h3>{o.name}</h3>
                <p>{o.subtitle}</p>
                <ul>
                  {o.features.map(([icon, label]) => (
                    <li key={label}>
                      <Icon name={icon} /> {label}
                    </li>
                  ))}
                </ul>
                <div className="booking-package-price">
                  <strong>{money(o.total)}</strong>
                  <span>სულ</span>
                  <small>{money(Math.round(o.total / o.sessions))} / სესია</small>
                </div>
                <button className="booking-select" type="button" onClick={choose}>
                  {selected ? (
                    <>
                      არჩეული <Icon name="check" />
                    </>
                  ) : o.id === SINGLE ? (
                    'ერთი სესიის არჩევა'
                  ) : (
                    'პაკეტის არჩევა'
                  )}
                </button>
              </article>
            )
          })}
        </div>
        <div className="booking-benefits">
          <div>
            <Icon name="shield" />
            <span>
              <strong>უსაფრთხო და დაცული</strong>
              <small>თანხა ქოუჩს გადაეცემა მხოლოდ სესიის დადასტურების შემდეგ.</small>
            </span>
          </div>
          <div>
            <Icon name="calendar" />
            <span>
              <strong>მოქნილი განრიგი</strong>
              <small>აირჩიე შენთვის მოსახერხებელი დრო.</small>
            </span>
          </div>
          <div>
            <Icon name="headset" />
            <span>
              <strong>მხარდაჭერა</strong>
              <small>პრობლემის შემთხვევაში მხარდაჭერის გუნდი დაგეხმარება.</small>
            </span>
          </div>
        </div>
        {nav('განრიგზე გადასვლა', { back: false, single: true })}
      </>
    )
  } else if (step === 2) {
    const visibleDates = showAllDates ? dates : dates.slice(0, 7)
    const chosenDay = dayParts(date)
    const dayLabel = (d: string) => (d === today ? 'დღეს' : d === tomorrow ? 'ხვალ' : dayParts(d).weekday)
    body = (
      <>
        {intro(
          'ეტაპი 2 / 6',
          'აირჩიე სესიები',
          <>
            აირჩიე <b>{option.sessions === 1 ? 'ერთი დრო' : `${option.sessions} დრო`}</b>, რომელიც შენთვის მოსახერხებელია ({option.minutes} წუთი თითო).
          </>,
        )}
        {coachCard}
        <section className="booking-schedule-section">
          <h2>1. აირჩიე თარიღი</h2>
          <div className="booking-dates">
            {visibleDates.map((d) => {
              const count = freeCount(d)
              const p = dayParts(d)
              return (
                <button key={d} className={d === date ? 'selected' : undefined} type="button" onClick={() => setDate(d)}>
                  <strong>{dayLabel(d)}</strong>
                  <span>
                    {p.day} {p.month}
                  </span>
                  <small className={count ? '' : 'full'}>{count ? `${count} დრო` : daySlots(d).length ? 'სავსეა' : 'არ მუშაობს'}</small>
                </button>
              )
            })}
            <button type="button" className="booking-more-dates" onClick={() => setShowAllDates((v) => !v)}>
              <Icon name="calendar" />
              <strong>{showAllDates ? 'ნაკლები თარიღი' : 'მეტი თარიღი'}</strong>
              <small>{showAllDates ? 'კალენდრის შეკეცვა' : '14 დღე'}</small>
            </button>
          </div>
        </section>
        <section className="booking-schedule-section">
          <div className="booking-slot-title">
            <div>
              <h2>
                2. აირჩიე დრო — {dayLabel(date)}, {chosenDay.day} {chosenDay.month}
              </h2>
              <p>
                <Icon name="alert" /> {option.sessions === 1 ? 'შენი სესიისთვის აირჩიე ერთი დრო.' : `შენი პაკეტისთვის აირჩიე ${option.sessions} დრო (შეიძლება სხვადასხვა დღეს).`}
              </p>
            </div>
            <span>◎ &nbsp;GMT +4 (თბილისი)</span>
          </div>
          {daySlots(date).length === 0 && <p className="booking-no-slots">ქოუჩი ამ დღეს არ მუშაობს — აირჩიე სხვა თარიღი.</p>}
          <div className="booking-slots">
            {daySlots(date).map((iso) => {
              const state = slotState(iso)
              const selected = draft.slots.includes(iso)
              const blocked = state !== 'free' || (!selected && overlapsChosen(iso))
              const hm = new Date(new Date(iso).getTime() + 4 * 3600_000).toISOString().slice(11, 16)
              return (
                <button
                  key={iso}
                  className={`${selected ? 'selected' : ''}${blocked ? ' disabled' : ''}`}
                  type="button"
                  disabled={blocked}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      slots: selected ? d.slots.filter((s) => s !== iso) : d.slots.length < option.sessions ? [...d.slots, iso].sort() : d.slots,
                    }))
                  }
                >
                  <strong>{hm}</strong>
                  <span>{selected ? 'არჩეულია' : state === 'busy' ? 'დაკავებულია' : state === 'past' ? 'მიუწვდომელია' : 'ხელმისაწვდომია'}</span>
                  {selected && <Icon name="check" />}
                </button>
              )
            })}
          </div>
        </section>
        <div className="booking-selected-slots">
          <span>არჩეული დროები:</span>
          <div>
            {draft.slots.length ? (
              draft.slots.map((iso, i) => (
                <button key={iso} type="button" onClick={() => setDraft((d) => ({ ...d, slots: d.slots.filter((s) => s !== iso) }))}>
                  <b>{i + 1}</b>
                  {slotLabel(iso)}
                  <Icon name="close" />
                </button>
              ))
            ) : (
              <small>დრო ჯერ არ აგირჩევია</small>
            )}
          </div>
          <button type="button" onClick={() => setDraft((d) => ({ ...d, slots: [] }))}>
            გასუფთავება <Icon name="trash" />
          </button>
        </div>
        {nav('მიზნებზე გადასვლა')}
      </>
    )
  } else if (step === 3) {
    body = (
      <>
        {intro(
          'ეტაპი 3 / 6',
          'რა არის შენი მიზანი?',
          <>
            დაეხმარე ქოუჩს გაიგოს, რის მიღწევა გსურს,
            <br />
            რათა შენთვის საუკეთესო სესია მოამზადოს.
          </>,
        )}
        {coachCard}
        <div className="booking-goal-layout">
          <section className="booking-goal-form">
            <label>
              <span>
                <Icon name="target" />
                <b>აღწერე შენი მიზანი</b>
                <small>რისი გაუმჯობესება, მიღწევა ან სწავლა გინდა.</small>
              </span>
              <textarea
                maxLength={500}
                placeholder="მაგ.: მინდა მივაღწიო Conqueror-ს და გავაუმჯობესო აიმი და თამაშის ხედვა…"
                value={draft.goal}
                onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value }))}
              />
              <em>
                <b>{draft.goal.length}</b>/500
              </em>
            </label>
            <label>
              <span>
                <Icon name="gamepad" />
                <b>
                  კონკრეტული სირთულეები? <small>(არასავალდებულო)</small>
                </b>
                <small>რაზე გინდა განსაკუთრებით იმუშაოთ.</small>
              </span>
              <textarea
                maxLength={300}
                placeholder="მაგ.: ვერ ვიგებ ახლო ბრძოლებს, მიჭირს ფინალურ წრეებში გადაწყვეტილებები…"
                value={draft.challenges}
                onChange={(e) => setDraft((d) => ({ ...d, challenges: e.target.value }))}
              />
              <em>
                <b>{draft.challenges.length}</b>/300
              </em>
            </label>
            <label className="booking-discord">
              <span>
                <Icon name="discord" />
                <b>შენი Discord სესიისთვის</b>
                <small>ჩაწერე Discord-ის მომხმარებლის სახელი, რომ ქოუჩმა სესიამდე დაგამატოს.</small>
              </span>
              <div>
                <input value={draft.discord} placeholder="მაგ. gio.wavehub" autoComplete="off" maxLength={40} onChange={(e) => setDraft((d) => ({ ...d, discord: e.target.value }))} />
                <b>{draft.discord.trim() ? '✓ Discord დამატებულია' : ''}</b>
              </div>
              <p>
                <Icon name="lock" /> შენს Discord-ს ხედავს მხოლოდ ამ ჯავშნის ქოუჩი.
              </p>
            </label>
            {coach.bookingQuestions.map((q) => (
              <label key={q.key}>
                <span>
                  <Icon name="note" />
                  <b>
                    {q.label}
                    {q.required ? ' *' : ''}
                  </b>
                  <small>ქოუჩის კითხვა</small>
                </span>
                {q.type === 'dropdown' ? (
                  <select value={draft.answers[q.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, answers: { ...d.answers, [q.key]: e.target.value } }))}>
                    <option value="">—</option>
                    {(q.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : q.type === 'textarea' ? (
                  <textarea maxLength={1000} value={draft.answers[q.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, answers: { ...d.answers, [q.key]: e.target.value } }))} />
                ) : (
                  <input
                    type={q.type === 'number' ? 'number' : 'text'}
                    maxLength={1000}
                    value={draft.answers[q.key] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, answers: { ...d.answers, [q.key]: e.target.value } }))}
                  />
                )}
              </label>
            ))}
            <div className="booking-discord-help">
              <Icon name="discord" />
              <span>
                <strong>არ გაქვს Discord?</strong>
                <small>სესია Discord-ზე ტარდება.</small>
              </span>
              <a href="https://discord.com/register" target="_blank" rel="noreferrer noopener">
                ანგარიშის შექმნა <Icon name="external" />
              </a>
            </div>
          </section>
          <aside className="booking-tips">
            <h2>
              <Icon name="light" /> სწრაფი რჩევები
            </h2>
            <ul>
              <li>
                <Icon name="target" /> მიუთითე შენი მიმდინარე რანგი ან დონე
              </li>
              <li>
                <Icon name="gamepad" /> დაწერე, რომელ რეჟიმებს თამაშობ
              </li>
              <li>
                <Icon name="alert" /> გაგვიზიარე შენი ყველაზე დიდი სირთულეები
              </li>
              <li>
                <Icon name="chat" /> რაც მეტ დეტალს მისცემ, მით უკეთ დაგეხმარება ქოუჩი
              </li>
            </ul>
            <div>
              <h3>
                <Icon name="lock" /> პირადი და დაცული
              </h3>
              <p>შენს მიზანს და Discord-ს ხედავს მხოლოდ შენი ქოუჩი.</p>
            </div>
          </aside>
        </div>
        {nav('შემოწმებაზე გადასვლა')}
      </>
    )
  } else if (step === 4) {
    body = (
      <>
        {intro('ეტაპი 4 / 6', 'შეამოწმე ჯავშანი', 'გადახდამდე გადაამოწმე ყველა დეტალი.')}
        {coachCard}
        <div className="booking-review-list">
          <article>
            <span className="pink">
              <Icon name={option.id === SINGLE ? 'rocket' : 'growth'} />
            </span>
            <div>
              <h2>სესიის ვარიანტი</h2>
              <strong>{option.id === SINGLE ? option.name : `${option.name} პაკეტი`}</strong>
              <small>
                {option.sessions} სესია · თითო {option.minutes} წუთი
              </small>
            </div>
            <button type="button" onClick={() => goStep(1)}>
              შეცვლა ›
            </button>
          </article>
          <article>
            <span className="purple">
              <Icon name="calendar" />
            </span>
            <div>
              <h2>განრიგი</h2>
              <strong>{draft.slots.length} არჩეული დრო</strong>
              <p>
                {draft.slots.map((iso, i) => (
                  <span key={iso}>
                    <b>{i + 1}</b>
                    <em>{slotLabel(iso)}</em>
                  </span>
                ))}
              </p>
            </div>
            <button type="button" onClick={() => goStep(2)}>
              შეცვლა ›
            </button>
          </article>
          <article>
            <span className="purple">
              <Icon name="target" />
            </span>
            <div>
              <h2>შენი მიზანი</h2>
              <strong>{draft.goal}</strong>
              <small>Discord: {draft.discord}</small>
            </div>
            <button type="button" onClick={() => goStep(3)}>
              შეცვლა ›
            </button>
          </article>
          <article>
            <span className="green">
              <Icon name="lari" />
            </span>
            <div>
              <h2>ჯამური ფასი</h2>
              <strong>{option.id === SINGLE ? 'ერთჯერადი სესია · გამოწერის გარეშე' : `მოიცავს ყველა ${option.sessions} სესიას`}</strong>
            </div>
            <b className="booking-total">{money(option.total)}</b>
          </article>
        </div>
        <div className="booking-benefits review">
          <div>
            <Icon name="shield" />
            <span>
              <strong>დაცული გადახდა</strong>
              <small>თანხა ქოუჩს გადაეცემა მხოლოდ შენი დადასტურების შემდეგ</small>
            </span>
          </div>
          <div>
            <Icon name="package" />
            <span>
              <strong>თანხის დაბრუნება</strong>
              <small>თუ სესია არ შედგა, თანხა სრულად დაგიბრუნდება</small>
            </span>
          </div>
          <div>
            <Icon name="bolt" />
            <span>
              <strong>მყისიერი დადასტურება</strong>
              <small>ქოუჩი შეტყობინებას მაშინვე მიიღებს</small>
            </span>
          </div>
        </div>
        {nav('გადახდაზე გადასვლა')}
      </>
    )
  } else if (step === 5) {
    body = (
      <>
        {intro('ეტაპი 5 / 6', 'გადახდა', 'გადაიხადე WaveCoin ბალანსით და დაადასტურე ქოუჩინგ სესია.')}
        {coachCard}
        <section className="booking-payment-method">
          <h2>გადახდის მეთოდი</h2>
          <div className="booking-bank-option">
            <i></i>
            <span className="bog-mini">WC</span>
            <div>
              <strong>WaveCoin ბალანსი</strong>
              <small>შენი ბალანსი: {balance} WC (1 WC = 1 GEL)</small>
            </div>
            <em>{shortBy > 0 ? `აკლია ${shortBy} WC` : 'საკმარისია'}</em>
          </div>
          <p>
            <Icon name="lock" /> ბალანსის შევსება ხდება საქართველოს ბანკის უსაფრთხო გადახდით.
          </p>
        </section>
        <section className="booking-how">
          <div>
            <h2>როგორ მუშაობს?</h2>
            <ol>
              <li>
                <b>1</b>„გადახდის“ დაჭერისას თანხა ჩამოგეჭრება ბალანსიდან და დაცულ ანგარიშზე გადავა.
              </li>
              <li>
                <b>2</b>ქოუჩი მიიღებს შეტყობინებას და შენს მიზანს.
              </li>
              <li>
                <b>3</b>სესიის დროს ორივე დაადასტურებთ დაწყებას — შეხსენებას მიიღებ.
              </li>
              <li>
                <b>4</b>სესიის შემდეგ შენ ადასტურებ დასრულებას და მხოლოდ მაშინ ერიცხება თანხა ქოუჩს.
              </li>
            </ol>
          </div>
          <div className="bog-brand">
            <span>WC</span>
            <strong>
              WaveCoin
              <small>WaveHub-ის ბალანსი</small>
            </strong>
          </div>
        </section>
        <article className="booking-payment-total">
          <span className="green">
            <Icon name="lari" />
          </span>
          <div>
            <h2>ჯამური ფასი</h2>
            <small>{option.id === SINGLE ? 'ერთჯერადი სესია · გამოწერის გარეშე' : `მოიცავს ყველა ${option.sessions} სესიას`}</small>
          </div>
          <b>{money(option.total)}</b>
        </article>
        {formError && (
          <p className="booking-form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="booking-actions">
          <button className="booking-back" type="button" onClick={() => goStep(4)}>
            <Icon name="arrowLeft" /> უკან
          </button>
          {shortBy > 0 ? (
            <Link className="booking-next" href={`/wallet?topup=${shortBy}`}>
              <Icon name="wallet" />
              ბალანსის შევსება
              <Icon name="arrowRight" />
            </Link>
          ) : (
            <button className="booking-next" type="button" disabled={paying} onClick={() => void pay()}>
              <Icon name="lock" />
              {paying ? 'მიმდინარეობს…' : `გადახდა — ${money(option.total)}`}
              <Icon name="arrowRight" />
            </button>
          )}
        </div>
        {secureNote(shortBy > 0 ? 'შევსების შემდეგ დაბრუნდი ამ გვერდზე — ჯავშანი შენახულია.' : 'დაცული გადახდა • თანხა ქოუჩს გადაეცემა სესიის დადასტურების შემდეგ')}
      </>
    )
  } else if (booked && booked.length > 0) {
    const first = booked[0]
    body = (
      <section className="booking-confirmed">
        <div className="booking-success-mark">
          <Icon name="check" />
          <i></i>
        </div>
        <h1>შენი ქოუჩინგ სესია დაჯავშნილია! 🎉</h1>
        <p>
          ჯავშანი {name}-თან დადასტურებულია.
          <br />
          ქოუჩმა მიიღო შენი მიზანი და სესიის დეტალები.
        </p>
        <span className="booking-notified">✓ ქოუჩს ეცნობა</span>
        <article className="booking-summary">
          <h2>ჯავშნის დეტალები</h2>
          <div>
            <span
              className={`booking-summary-avatar${coach.avatarUrl ? ' has-image' : ''}`}
              style={coach.avatarUrl ? ({ '--booking-coach-image': `url('${coach.avatarUrl}')` } as React.CSSProperties) : undefined}
            >
              {coach.avatarUrl ? '' : initials}
            </span>
            <small>ქოუჩი</small>
            <strong>
              {name} <em>✓</em>
              <b>
                <Icon name="shield" /> {coach.rank || 'ვერიფიცირებული ქოუჩი'}
              </b>
            </strong>
          </div>
          <div>
            <span className="pink">
              <Icon name={option.id === SINGLE ? 'rocket' : 'growth'} />
            </span>
            <small>სესიის ვარიანტი</small>
            <strong>
              {option.id === SINGLE ? option.name : `${option.name} პაკეტი`}
              <b>{booked.length} სესია</b>
            </strong>
          </div>
          <div>
            <span className="purple">
              <Icon name="calendar" />
            </span>
            <small>{booked.length > 1 ? 'სესიები' : 'სესია'}</small>
            <strong>
              {booked.map((s) => slotLabel(s.scheduledAt)).join(', ')}
              <b>GMT +4</b>
            </strong>
          </div>
          <div>
            <span className="purple">
              <Icon name="target" />
            </span>
            <small>შენი მიზანი</small>
            <strong>{first.goal}</strong>
          </div>
          <div>
            <span className="green">
              <Icon name="lari" />
            </span>
            <small>გადახდილი</small>
            <strong className="paid">{money(booked.reduce((sum, s) => sum + s.priceWaveCoin, 0))}</strong>
          </div>
        </article>
        <h2 className="booking-next-title">რა ხდება შემდეგ?</h2>
        <div className="booking-next-steps">
          <article>
            <span>
              <Icon name="mail" />
            </span>
            <div>
              <strong>1. ქოუჩი იღებს შენს მიზანს</strong>
              <p>{name} ხედავს შენს მიზანს და Discord-ს.</p>
            </div>
          </article>
          <i>
            <Icon name="arrowRight" />
          </i>
          <article>
            <span>
              <Icon name="bell" />
            </span>
            <div>
              <strong>2. შეხსენება</strong>
              <p>სესიამდე 15 წუთით ადრე მიიღებ შეტყობინებას.</p>
            </div>
          </article>
          <i>
            <Icon name="arrowRight" />
          </i>
          <article>
            <span>
              <Icon name="monitor" />
            </span>
            <div>
              <strong>3. დაადასტურე დაწყება</strong>
              <p>სესიის გვერდზე ორივე დაადასტურებთ, რომ სესია დაიწყო.</p>
            </div>
          </article>
        </div>
        <div className="booking-confirm-actions">
          <Link href={booked.length === 1 ? `/coaching-sessions/${first.id}` : '/coaching-sessions'}>
            <Icon name="grid" /> ჩემი სესიები <Icon name="arrowRight" />
          </Link>
          <Link href="/">
            <Icon name="home" /> მთავარზე დაბრუნება
          </Link>
        </div>
        {secureNote('სესიების მართვა შეგიძლია „ჩემი სესიების“ გვერდიდან.')}
      </section>
    )
  } else {
    body = (
      <section className="booking-confirmed">
        <h1>ჯავშანი ვერ მოიძებნა</h1>
        <p>
          <Link href="/coaching-sessions">ჩემი სესიები</Link>
        </p>
      </section>
    )
  }

  return (
    <main className="booking-flow" id="coachBookingRoot" data-step={step}>
      <PageHead title={`${name} — ქოუჩინგის დაჯავშნა`} noIndex />
      <div className="booking-shell">
        <header className="booking-header">
          <Link className="booking-logo" href="/" aria-label="WaveHubX home">
            <img src="/assets/logo-wavehubx-main.png" alt="WaveHubX" />
          </Link>
          <div className="booking-header-actions">
            <LanguageSwitcher />
            <Link className="booking-help" href="/support">
              <Icon name="help" />
              <span>დახმარება გჭირდება?</span>
            </Link>
          </div>
        </header>
        <nav className="booking-progress" aria-label="დაჯავშნის ეტაპები">
          {STEPS.map(([label], index) => {
            const number = index + 1
            return (
              <div key={label} className={`booking-progress-step${number < step ? ' done' : ''}${number === step ? ' active' : ''}`}>
                <span>{number < step ? <Icon name="check" /> : number}</span>
                <small>{label}</small>
              </div>
            )
          })}
        </nav>
        <div className="booking-stage">{body}</div>
      </div>
    </main>
  )
}
