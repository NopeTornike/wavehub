import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { PublicTournamentSummary } from '@wavehub/shared-types'
import { TOURNAMENT_DETAIL_KEYS, TournamentStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { gameCover } from '../../lib/games'
import { useShell } from '../../lib/shell'

// The prototype's tournament-detail.html in its "pre-join" layout (tournament-detail.js
// renderPrejoin + the Prize / Rules / Teams panels), on real data. The facts grid and Tournament
// Info read the admin-entered `details` (anything not filled in shows "To be announced", as on the
// prototype); entry is free on this platform, so Entry Fee defaults to that. The prototype's Prize
// and Teams tabs invent a prize split and six demo teams when none exist — here Prize shows the
// real total and Teams the real registration count, nothing made up. Registration is the real
// POST /tournaments/:id/register; the "registered" state comes from GET /tournaments/mine.

type Tab = 'general' | 'prize' | 'rules' | 'teams'

const ICONS: Record<string, ReactNode> = {
  users: <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  trophy: <><path d="M7 3h10v5a5 5 0 0 1-10 0V3Z" /><path d="M7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4M12 13v4m-4 4h8m-6-4h4" /></>,
  ticket: <><path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V7Z" /><path d="M14 8v2m0 2v2m0 2v2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  file: <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  crosshair: <><circle cx="12" cy="12" r="6" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4M12 9v6m-3-3h6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" /></>,
}

const Icon = ({ name }: { name: string }) => <svg viewBox="0 0 24 24">{ICONS[name]}</svg>

const FACT_ICONS: Record<string, string> = {
  format: 'users',
  mode: 'crosshair',
  region: 'globe',
  platform: 'phone',
  checkInTime: 'clock',
  startTime: 'play',
  registrationDeadline: 'calendar',
  entryFee: 'ticket',
}
const INFO_KEYS = ['teamSize', 'minimumRank', 'bracketType', 'matches', 'whoCanJoin', 'communication']
const LABEL = Object.fromEntries(TOURNAMENT_DETAIL_KEYS.map(([k, l]) => [k, l]))

const TBA = 'To be announced'

function Field({ label, value, icon }: { label: string; value?: string; icon?: string }) {
  return (
    <p className={icon ? 'prejoin-fact' : undefined}>
      {icon && <Icon name={icon} />}
      <span>
        <small>{label}</small>
        <strong>{value || TBA}</strong>
      </span>
    </p>
  )
}

export default function TournamentDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me } = useAuth()
  const { games } = useShell()
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
    // Refetch when the route param or the signed-in identity changes (registered state depends on it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  if (loading || error || !tournament) {
    return (
      <Layout title="ტურნირი" noIndex={!loading}>
        <section className="tournament-results-page" id="tournamentDetailPage">
          {loading ? (
            <div className="marketplace-empty">იტვირთება…</div>
          ) : (
            <div className="td-not-found">
              <h1>ტურნირი ვერ მოიძებნა</h1>
              <p>{error || 'შესაძლოა ტურნირი წაშლილია.'}</p>
              <Link href="/tournaments">ყველა ტურნირი</Link>
            </div>
          )}
        </section>
      </Layout>
    )
  }

  const details = tournament.details ?? {}
  const entryFee = details.entryFee || 'უფასო'
  const full = tournament.registeredCount >= tournament.maxPlayers
  const open = tournament.status === TournamentStatus.Open
  const cover = tournament.coverImageUrl ?? gameCover(games.find((g) => g.gameId === tournament.gameId)?.slug) ?? '/assets/pubg-photo.jpeg'
  const statusText = tournament.status === TournamentStatus.Open ? 'OPEN' : tournament.status === TournamentStatus.Upcoming ? 'UPCOMING' : 'COMPLETED'
  const date = new Date(tournament.startDate).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short', year: 'numeric' })
  const registerLabel = isRegistered
    ? 'დარეგისტრირებული ხართ ✓'
    : full
      ? 'ადგილები ამოიწურა'
      : open
        ? me
          ? 'Register Now'
          : 'შესვლა და რეგისტრაცია'
        : tournament.status === TournamentStatus.Completed
          ? 'ტურნირი დასრულდა'
          : 'რეგისტრაცია ჯერ არ დაწყებულა'

  const register = async () => {
    if (!me) {
      router.push(`/login?next=/tournaments/${tournament.id}`)
      return
    }
    setRegisterError('')
    setRegistering(true)
    try {
      setTournament(await api.registerForTournament(tournament.id))
      setIsRegistered(true)
    } catch (err) {
      setRegisterError(errorMessage(err, 'რეგისტრაცია ვერ მოხერხდა.'))
    } finally {
      setRegistering(false)
    }
  }

  const rules = (tournament.rules ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    <Layout title={tournament.name} description={`${tournament.gameName} — ${tournament.description}`.slice(0, 200)}>
      <section className="tournament-results-page" id="tournamentDetailPage">
        <section className="prejoin-page">
          <header className="prejoin-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(2,6,14,.1),rgba(2,6,14,.42)),url('${cover}')` }}>
            <div>
              <span>WAVEHUBX</span>
              <h1>{tournament.name}</h1>
              <strong>COMPETE. IMPROVE. WIN.</strong>
            </div>
          </header>

          <section className="prejoin-summary">
            <div>
              <Icon name="users" />
              <Field label="Registration" value={statusText} />
            </div>
            <div>
              <Icon name="calendar" />
              <Field label="Tournament Date" value={date} />
            </div>
            <div>
              <Icon name="users" />
              <Field label="Players" value={`${tournament.registeredCount} / ${tournament.maxPlayers}`} />
            </div>
            <div>
              <Icon name="trophy" />
              <Field label="საპრიზო ფონდი" value={tournament.prize} />
            </div>
            <div>
              <Icon name="ticket" />
              <Field label="შესვლის საფასური" value={entryFee} />
            </div>
          </section>

          <section className="prejoin-details">
            <nav>
              {(
                [
                  ['general', 'info', 'General'],
                  ['prize', 'trophy', 'საპრიზო ფონდი'],
                  ['rules', 'file', 'Rules'],
                  ['teams', 'users', 'გუნდები'],
                ] as const
              ).map(([key, icon, label]) => (
                <button key={key} type="button" className={tab === key ? 'active' : undefined} aria-pressed={tab === key} onClick={() => setTab(key)}>
                  <Icon name={icon} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>

            <div className="prejoin-grid">
              {tab === 'general' && (
                <>
                  <div className="prejoin-facts">
                    {Object.entries(FACT_ICONS).map(([key, icon]) => (
                      <Field key={key} label={LABEL[key]} value={key === 'entryFee' ? entryFee : details[key]} icon={icon} />
                    ))}
                  </div>
                  <div className="prejoin-about">
                    <h2>About Tournament</h2>
                    <p style={{ whiteSpace: 'pre-line' }}>{tournament.description}</p>
                    <div>
                      <small>Organizer</small>
                      <strong>{details.organizer || 'WaveHub Official'}</strong>
                      <Link href={me ? '/support' : '/login?next=/support'}>Contact Organizer</Link>
                    </div>
                  </div>
                  <div className="prejoin-info">
                    <h2>Tournament Info</h2>
                    {INFO_KEYS.map((key) => (
                      <Field key={key} label={LABEL[key]} value={details[key]} />
                    ))}
                  </div>
                </>
              )}

              {tab === 'prize' && (
                <aside className="prize-total">
                  <small>Total Prize Value</small>
                  <strong>{tournament.prize}</strong>
                  <i></i>
                  <p>საპრიზო ფონდს ორგანიზატორი გადასცემს გამარჯვებულებს ტურნირის შედეგების მიხედვით.</p>
                </aside>
              )}

              {tab === 'rules' && (
                <section className="rules-panel">
                  <h2>Tournament Rules</h2>
                  {rules.length > 0 ? (
                    rules.map((rule, index) => (
                      <article key={index} className="rule-row">
                        <b>{index + 1}</b>
                        <strong>Rule {index + 1}</strong>
                        <p>{rule}</p>
                      </article>
                    ))
                  ) : (
                    <p className="rules-pending">Tournament rules have not been published by the organizer yet.</p>
                  )}
                </section>
              )}

              {tab === 'teams' && (
                <section className="teams-panel">
                  <header className="teams-toolbar">
                    <h2>
                      Registered Players <strong>{tournament.registeredCount}</strong>
                      <span>/ {tournament.maxPlayers}</span>
                    </h2>
                  </header>
                  <p className="rules-pending">
                    {isRegistered ? 'თქვენ დარეგისტრირებული ხართ ამ ტურნირზე.' : 'გუნდებისა და ბრეკეტის განაწილებას ორგანიზატორი გამოაქვეყნებს რეგისტრაციის დასრულების შემდეგ.'}
                  </p>
                </section>
              )}
            </div>
          </section>

          <section className="prejoin-register">
            <div>
              <strong>Ready to Compete?</strong>
              <span>Secure your spot and battle for glory.</span>
            </div>
            <div>
              <small>Spots left</small>
              <strong>
                {Math.max(0, tournament.maxPlayers - tournament.registeredCount)} / {tournament.maxPlayers}
              </strong>
            </div>
            <div>
              <small>Entry fee</small>
              <strong>{entryFee}</strong>
            </div>
            <button id="tdRegisterNow" type="button" disabled={registering || isRegistered || full || (!open && !!me)} onClick={register}>
              {registering ? 'იჯავშნება…' : registerLabel}
            </button>
          </section>
          {registerError && (
            <p className="seller-status error" role="alert">
              {registerError}
            </p>
          )}
        </section>
      </section>
    </Layout>
  )
}
