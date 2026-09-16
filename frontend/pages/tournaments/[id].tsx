import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicTournamentSummary } from '@wavehub/shared-types'
import { TournamentStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const STATUS_LABELS: Record<TournamentStatus, string> = {
  [TournamentStatus.Open]: 'OPEN',
  [TournamentStatus.Upcoming]: 'UPCOMING',
  [TournamentStatus.Completed]: 'COMPLETED',
}

type Tab = 'general' | 'prize' | 'rules' | 'players'

// Markup pulled from tournament-detail.html (see LAUNCH_PLAN.md §2b). "Rules" and "Top Players"
// panels are static content in the prototype itself too (not per-tournament data) — kept as-is
// rather than fabricating dynamic content the backend doesn't have.
export default function TournamentDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me, refresh } = useAuth()

  const [tournament, setTournament] = useState<PublicTournamentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('general')
  const [isRegistered, setIsRegistered] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState('')

  const load = () => {
    if (!id) return
    setLoading(true)
    setError('')
    Promise.all([api.getTournament(id), me ? api.listMyTournamentRegistrations() : Promise.resolve<string[]>([])])
      .then(([data, myIds]) => {
        setTournament(data)
        setIsRegistered(myIds.includes(id))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'ტურნირი ვერ მოიძებნა.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, me])

  if (loading) {
    return (
      <Layout>
        <div className="tournament-detail-page">
          <div className="marketplace-empty">იტვირთება…</div>
        </div>
      </Layout>
    )
  }

  if (error || !tournament) {
    return (
      <Layout>
        <div className="tournament-detail-page td-not-found">
          <strong>{error || 'ტურნირი ვერ მოიძებნა.'}</strong>
          <Link href="/tournaments">All Tournaments</Link>
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
      setRegisterError(err instanceof ApiError ? err.message : 'რეგისტრაცია ვერ მოხერხდა.')
    } finally {
      setRegistering(false)
    }
  }

  const full = tournament.registeredCount >= tournament.maxPlayers
  const registerLabel = isRegistered
    ? 'REGISTERED ✓'
    : full
      ? 'TOURNAMENT FULL'
      : tournament.status === TournamentStatus.Open
        ? 'REGISTER NOW ›'
        : STATUS_LABELS[tournament.status]

  return (
    <Layout>
      <section className="tournament-detail-page">
        <Link className="tournament-detail-back" href="/tournaments">
          ← All Tournaments
        </Link>

        <div
          className="tournament-detail-hero"
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

        <section className="tournament-detail-summary">
          <div>
            <b>▣</b>
            <span>
              <small>REGISTRATION</small>
              <strong className={tournament.status === TournamentStatus.Open ? 'is-open' : ''}>{STATUS_LABELS[tournament.status]}</strong>
            </span>
          </div>
          <div>
            <b>□</b>
            <span>
              <small>TOURNAMENT DATE</small>
              <strong>{new Date(tournament.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
            </span>
          </div>
          <div>
            <b>♙</b>
            <span>
              <small>PLAYERS</small>
              <strong>
                {tournament.registeredCount} / {tournament.maxPlayers}
              </strong>
              <em>REGISTERED</em>
            </span>
          </div>
          <div>
            <b>♛</b>
            <span>
              <small>PRIZE POOL</small>
              <strong className="is-pink">{tournament.prize}</strong>
            </span>
          </div>
          <div>
            <b>◇</b>
            <span>
              <small>ENTRY FEE</small>
              <strong className="is-open">FREE</strong>
            </span>
          </div>
          <button type="button" disabled={registering || isRegistered || full || tournament.status !== TournamentStatus.Open} onClick={register}>
            {registering ? 'იჯავშნება…' : registerLabel} {!isRegistered && !full && tournament.status === TournamentStatus.Open && <span>›</span>}
          </button>
        </section>

        {registerError && <p className="tournament-detail-notice" style={{ color: 'var(--red)' }}>{registerError}</p>}

        <div className="tournament-detail-tabs" role="tablist">
          <button className={tab === 'general' ? 'active' : ''} type="button" onClick={() => setTab('general')}>
            ⓘ <span>GENERAL</span>
          </button>
          <button className={tab === 'prize' ? 'active' : ''} type="button" onClick={() => setTab('prize')}>
            ♛ <span>PRIZE POOL</span>
          </button>
          <button className={tab === 'rules' ? 'active' : ''} type="button" onClick={() => setTab('rules')}>
            ▤ <span>RULES</span>
          </button>
          <button className={tab === 'players' ? 'active' : ''} type="button" onClick={() => setTab('players')}>
            ♕ <span>TOP PLAYERS</span>
          </button>
        </div>

        {tab === 'general' && (
          <section className="tournament-detail-panel active">
            <div className="tournament-general-info">
              <h2>ABOUT TOURNAMENT</h2>
              <p>{tournament.description}</p>
            </div>
          </section>
        )}

        {tab === 'prize' && (
          <section className="tournament-detail-panel active">
            <div className="td-simple-panel">
              <span>♛</span>
              <div>
                <h2>PRIZE POOL</h2>
                <strong>{tournament.prize}</strong>
                <p>The announced prize pool will be awarded according to the tournament results.</p>
              </div>
            </div>
          </section>
        )}

        {tab === 'rules' && (
          <section className="tournament-detail-panel active">
            <div className="td-simple-panel">
              <span>▤</span>
              <div>
                <h2>TOURNAMENT RULES</h2>
                <ul>
                  <li>Use only your registered WaveHub account.</li>
                  <li>Check in before the registration deadline.</li>
                  <li>Fair play and respectful conduct are required.</li>
                  <li>Organizer decisions apply to disputed match results.</li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {tab === 'players' && (
          <section className="tournament-detail-panel active">
            <div className="td-simple-panel">
              <span>♕</span>
              <div>
                <h2>TOP PLAYERS</h2>
                <p>Standings will appear after the tournament begins.</p>
              </div>
            </div>
          </section>
        )}
      </section>
    </Layout>
  )
}
