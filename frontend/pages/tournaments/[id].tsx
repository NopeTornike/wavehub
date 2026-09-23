import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import type { PublicTournamentSummary } from '@wavehub/shared-types'
import { TournamentStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { CalendarGlyph, PlayersGlyph } from '../../components/TournamentStatIcons'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const STATUS_LABELS: Record<TournamentStatus, string> = {
  [TournamentStatus.Open]: 'ღიაა',
  [TournamentStatus.Upcoming]: 'მალე იწყება',
  [TournamentStatus.Completed]: 'დასრულებულია',
}

type Tab = 'general' | 'prize' | 'rules'

// '★' matches the rating-star glyph used everywhere else on the site (marketplace/listing/coach
// rating pills) — swapped in for the previous '♛' (chess queen), which didn't read as "prize" at
// a glance and was the only chess piece in an otherwise glyph-free icon language.
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'general', icon: 'ⓘ', label: 'ზოგადი' },
  { id: 'prize', icon: '★', label: 'პრიზი' },
  { id: 'rules', icon: '▤', label: 'წესები' },
]

// Markup pulled from tournament-detail.html (see LAUNCH_PLAN.md §2b). The prototype's "Top Players"
// tab is intentionally not ported: this app has no standings/bracket data (tournaments are
// registration-only — backend/src/tournaments/CLAUDE.md), so the tab could only ever promise
// something that doesn't exist. The "Rules" tab shows WaveHub-wide conduct rules, not per-tournament
// data (the backend has no such field) — it says so.
export default function TournamentDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me } = useAuth()
  const meId = me?.id

  const [tournament, setTournament] = useState<PublicTournamentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('general')
  const [isRegistered, setIsRegistered] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState('')

  const load = useCallback(() => {
    if (!id) return
    setError('')
    Promise.all([api.getTournament(id), meId ? api.listMyTournamentRegistrations() : Promise.resolve<string[]>([])])
      .then(([data, myIds]) => {
        setTournament(data)
        setIsRegistered(myIds.includes(id))
      })
      .catch((err) => setError(errorMessage(err, 'ტურნირი ვერ მოიძებნა.')))
      .finally(() => setLoading(false))
  }, [id, meId])

  useEffect(() => {
    // Refetch when the route param or the logged-in identity changes (registered-state depends on
    // who's asking) — depends on the id string, not the user object, so a balance refresh doesn't
    // re-run it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  if (loading) {
    return (
      <Layout title="ტურნირი">
        <div className="tournament-detail-page">
          <div className="marketplace-empty">იტვირთება…</div>
        </div>
      </Layout>
    )
  }

  if (error || !tournament) {
    return (
      <Layout title="ტურნირი ვერ მოიძებნა" noIndex>
        <div className="tournament-detail-page td-not-found">
          <strong>{error || 'ტურნირი ვერ მოიძებნა.'}</strong>
          <Link href="/tournaments">ყველა ტურნირი</Link>
        </div>
      </Layout>
    )
  }

  const register = async () => {
    if (!me) {
      router.push(`/login?next=/tournaments/${tournament.id}`)
      return
    }
    setRegisterError('')
    setRegistering(true)
    try {
      const updated = await api.registerForTournament(tournament.id)
      setTournament(updated)
      setIsRegistered(true)
    } catch (err) {
      setRegisterError(errorMessage(err, 'რეგისტრაცია ვერ მოხერხდა.'))
    } finally {
      setRegistering(false)
    }
  }

  const full = tournament.registeredCount >= tournament.maxPlayers
  const open = tournament.status === TournamentStatus.Open
  const canRegister = !isRegistered && !full && open
  const registerLabel = isRegistered
    ? 'დარეგისტრირებული ხართ ✓'
    : full
      ? 'ადგილები ამოიწურა'
      : open
        ? me
          ? 'რეგისტრაცია ›'
          : 'შესვლა და რეგისტრაცია ›'
        : tournament.status === TournamentStatus.Completed
          ? 'ტურნირი დასრულდა'
          : 'რეგისტრაცია ჯერ არ დაწყებულა'
  const startDate = new Date(tournament.startDate).toLocaleDateString('ka-GE', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <Layout title={tournament.name} description={`${tournament.gameName} — ${tournament.description}`.slice(0, 200)}>
      <section className="tournament-detail-page">
        <Link className="tournament-detail-back" href="/tournaments">
          ← ყველა ტურნირი
        </Link>

        <div
          className="tournament-detail-hero"
          role="img"
          aria-label={`${tournament.name} — ქოვერი`}
          style={tournament.coverImageUrl ? { backgroundImage: `url(${tournament.coverImageUrl})` } : undefined}
        >
          <div className="tournament-detail-hero-copy">
            <span>
              <i /> WAVEHUB <i />
            </span>
            <h1>{tournament.name}</h1>
            <strong>{tournament.gameName}</strong>
          </div>
        </div>

        <section className="tournament-detail-summary" aria-label="ტურნირის მონაცემები">
          <div>
            <b aria-hidden="true">▣</b>
            <span>
              <small>რეგისტრაცია</small>
              <strong className={open ? 'is-open' : ''}>{STATUS_LABELS[tournament.status]}</strong>
            </span>
          </div>
          <div>
            <b aria-hidden="true">
              <CalendarGlyph />
            </b>
            <span>
              <small>თარიღი</small>
              <strong>{startDate}</strong>
            </span>
          </div>
          <div>
            <b aria-hidden="true">
              <PlayersGlyph />
            </b>
            <span>
              <small>მოთამაშეები</small>
              <strong>
                {tournament.registeredCount} / {tournament.maxPlayers}
              </strong>
              <em>დარეგისტრირებული</em>
            </span>
          </div>
          <div>
            <b aria-hidden="true">★</b>
            <span>
              <small>პრიზი</small>
              <strong className="is-pink">{tournament.prize}</strong>
            </span>
          </div>
          <div>
            <b aria-hidden="true">◇</b>
            <span>
              <small>შენატანი</small>
              <strong className="is-open">უფასო</strong>
            </span>
          </div>
          <button type="button" disabled={registering || (me ? !canRegister : !open)} onClick={register}>
            {registering ? 'იჯავშნება…' : registerLabel}
          </button>
        </section>

        {registerError && (
          <p className="tournament-detail-notice" role="alert" style={{ color: 'var(--red)' }}>
            {registerError}
          </p>
        )}

        <div className="tournament-detail-tabs" role="tablist" aria-label="ტურნირის დეტალები">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`td-tab-${t.id}`}
              className={tab === t.id ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`td-panel-${t.id}`}
              onClick={() => setTab(t.id)}
            >
              <span aria-hidden="true" style={{ margin: 0 }}>
                {t.icon}
              </span>{' '}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <section className="tournament-detail-panel active" id="td-panel-general" role="tabpanel" aria-labelledby="td-tab-general">
            <div className="tournament-general-info">
              <h2>ტურნირის შესახებ</h2>
              <p style={{ whiteSpace: 'pre-line' }}>{tournament.description}</p>
            </div>
          </section>
        )}

        {tab === 'prize' && (
          <section className="tournament-detail-panel active" id="td-panel-prize" role="tabpanel" aria-labelledby="td-tab-prize">
            <div className="td-simple-panel">
              <span aria-hidden="true">★</span>
              <div>
                <h2>პრიზი</h2>
                <strong>{tournament.prize}</strong>
                <p>გამოცხადებული პრიზი გადაეცემა გამარჯვებულებს ტურნირის შედეგების მიხედვით.</p>
              </div>
            </div>
          </section>
        )}

        {tab === 'rules' && (
          <section className="tournament-detail-panel active" id="td-panel-rules" role="tabpanel" aria-labelledby="td-tab-rules">
            <div className="td-simple-panel">
              <span aria-hidden="true">▤</span>
              <div>
                <h2>ზოგადი წესები</h2>
                <ul>
                  <li>ითამაშეთ მხოლოდ თქვენი რეგისტრირებული WaveHub ანგარიშით.</li>
                  <li>სამართლიანი თამაში და მოწინააღმდეგის პატივისცემა სავალდებულოა.</li>
                  <li>სადავო შედეგებზე ორგანიზატორის გადაწყვეტილება საბოლოოა.</li>
                </ul>
                <p>ეს WaveHub-ის ყველა ტურნირზე მოქმედი ზოგადი წესებია.</p>
              </div>
            </div>
          </section>
        )}
      </section>
    </Layout>
  )
}
