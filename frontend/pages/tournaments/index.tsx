import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { PublicTournamentSummary } from '@wavehub/shared-types'
import { TournamentStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { gameCover } from '../../lib/games'
import { useShell } from '../../lib/shell'

// The prototype's current tournaments.html (tournaments.js): hero, search + game filter + status
// tabs with live counts, "Active" / "Completed" groups of cards, and the benefits footer. Real
// tournaments from GET /tournaments. The prototype's cards show a team format and server that the
// real tournament model doesn't have, so those two fact slots carry real data instead — registered
// players and the game. Open and upcoming tournaments form the "active" group. The page title says
// "Tournaments" rather than the prototype's "My tournaments", because this page lists every
// tournament (registration status is on each tournament's own page). The prototype's inline
// "create tournament" admin panel lives at /admin/tournaments here.
/* eslint-disable @next/next/no-img-element */

type Tab = 'all' | 'active' | 'completed'

const STATUS_LABEL: Record<TournamentStatus, string> = {
  [TournamentStatus.Open]: 'რეგისტრაცია ღიაა',
  [TournamentStatus.Upcoming]: 'მალე',
  [TournamentStatus.Completed]: 'დასრულებული',
}

function isActive(t: PublicTournamentSummary) {
  return t.status !== TournamentStatus.Completed
}

function Card({ tournament, cover }: { tournament: PublicTournamentSummary; cover: string | null }) {
  const active = isActive(tournament)
  return (
    <article className={`tournament-card ${active ? 'active' : 'completed'}`}>
      <div
        className="tournament-card-cover"
        style={cover ? { backgroundImage: `linear-gradient(90deg,rgba(3,6,14,.05),rgba(3,6,14,.52)),url('${cover}')` } : undefined}
      ></div>
      <div className="tournament-card-copy">
        <span className={`tournament-card-status ${active ? 'active' : 'completed'}`}>
          <i></i>
          {STATUS_LABEL[tournament.status]}
        </span>
        <h3>{tournament.name}</h3>
        <div className="tournament-card-facts">
          <span>
            <svg viewBox="0 0 24 24"><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-2a4 4 0 0 0-3-3.87" /></svg>
            <strong>
              {tournament.registeredCount} / {tournament.maxPlayers} მოთამაშე
            </strong>
          </span>
          <span>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
            <strong>{tournament.gameName}</strong>
          </span>
          <span>
            <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
            <strong>{new Date(tournament.startDate).toLocaleDateString('ka-GE', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </span>
        </div>
        <Link className="tournament-view-button" href={`/tournaments/${tournament.id}`}>
          ტურნირის ნახვა <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </Link>
      </div>
    </article>
  )
}

export default function Tournaments() {
  const { games } = useShell()
  const [items, setItems] = useState<PublicTournamentSummary[] | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [game, setGame] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api
      .browseTournaments({ limit: 100 })
      .then((res) => setItems(res.items))
      .catch((err) => {
        setItems([])
        setError(errorMessage(err, 'ტურნირების ჩატვირთვა ვერ მოხერხდა.'))
      })
  }, [])

  const slugById = useMemo(() => new Map(games.map((g) => [g.gameId, g.slug])), [games])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (items ?? []).filter(
      (t) => (game === 'all' || t.gameId === game) && (!q || t.name.toLowerCase().includes(q) || t.gameName.toLowerCase().includes(q)),
    )
  }, [items, game, search])
  const active = filtered.filter(isActive)
  const completed = filtered.filter((t) => !isActive(t))
  const coverFor = (t: PublicTournamentSummary) => t.coverImageUrl ?? gameCover(slugById.get(t.gameId))

  const group = (kind: 'active' | 'completed', list: PublicTournamentSummary[]) =>
    list.length > 0 && (
      <section className={`tournament-group tournament-group-${kind}`}>
        <header>
          <h2>
            <i></i>
            {kind === 'active' ? 'აქტიური ტურნირები' : 'დასრულებული ტურნირები'} <strong>{list.length}</strong>
          </h2>
        </header>
        <div className="tournament-card-grid">
          {list.map((t) => (
            <Card key={t.id} tournament={t} cover={coverFor(t)} />
          ))}
        </div>
      </section>
    )

  return (
    <Layout title="ტურნირები" description="WaveHubX-ის აქტიური და დასრულებული ტურნირები — დარეგისტრირდით და იასპარეზეთ პრიზებისთვის.">
      <section className="tournaments-page">
        <header className="tournaments-hero">
          <span className="tournaments-hero-icon" aria-hidden="true">
            <img src="/assets/tournaments-icon.svg" alt="" />
          </span>
          <div>
            <h1>ტურნირები</h1>
            <p>ნახე ყველა აქტიური და დასრულებული ტურნირი.</p>
          </div>
        </header>

        <section className="tournament-toolbar" aria-label="Tournament filters">
          <label className="tournament-search">
            <span className="sr-only">ტურნირების ძიება</span>
            <input id="tournamentSearch" type="search" placeholder="მოძებნე ტურნირები..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <span aria-hidden="true">⌕</span>
          </label>
          <label className="tournament-game-filter">
            <span className="sr-only">თამაშით გაფილტვრა</span>
            <select id="tournamentGameFilter" value={game} onChange={(e) => setGame(e.target.value)}>
              <option value="all">ყველა თამაში</option>
              {games.map((g) => (
                <option key={g.gameId} value={g.gameId}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <div className="tournament-status-tabs" id="tournamentStatusTabs" aria-label="Quick status filter">
            <button className={tab === 'all' ? 'active' : undefined} type="button" onClick={() => setTab('all')}>
              ყველა ტურნირი <strong>{filtered.length}</strong>
            </button>
            <button className={tab === 'active' ? 'active' : undefined} type="button" onClick={() => setTab('active')}>
              <i></i>აქტიური <strong>{active.length}</strong>
            </button>
            <button className={tab === 'completed' ? 'active' : undefined} type="button" onClick={() => setTab('completed')}>
              <i></i>დასრულებული <strong>{completed.length}</strong>
            </button>
          </div>
        </section>

        <section className="tournaments-list-section" aria-labelledby="tournamentsListTitle">
          <h2 className="sr-only" id="tournamentsListTitle">ტურნირები</h2>
          {error && (
            <p className="status-text status-error" role="alert">
              {error}
            </p>
          )}
          <div className="tournaments-grid" id="tournamentsGrid">
            {items === null ? (
              <div className="marketplace-empty">იტვირთება…</div>
            ) : (
              <>
                {tab !== 'completed' && group('active', active)}
                {tab !== 'active' && group('completed', completed)}
              </>
            )}
          </div>
          <div
            className="marketplace-empty tournaments-empty"
            id="tournamentsEmpty"
            hidden={items === null || (tab === 'active' ? active.length : tab === 'completed' ? completed.length : filtered.length) > 0}
          >
            <strong>ტურნირი ჯერ არ არის</strong>
            <p>ადმინისტრაციის მიერ დამატებული ახალი ჩემპიონატები აქ გამოჩნდება.</p>
          </div>
        </section>

        <footer className="tournament-benefits" aria-label="Tournament benefits">
          <div>
            <span aria-hidden="true">♢</span>
            <p>
              <strong>უსაფრთხო და სამართლიანი თამაში</strong>
              <small>ორგანიზატორის მიერ დაცული წესები</small>
            </p>
          </div>
          <div>
            <span aria-hidden="true">♛</span>
            <p>
              <strong>დიდი პრიზები</strong>
              <small>Compete for real rewards</small>
            </p>
          </div>
          <div>
            <span aria-hidden="true">♙</span>
            <p>
              <strong>ყველასთვის</strong>
              <small>All skill levels welcome</small>
            </p>
          </div>
          <div>
            <span aria-hidden="true">♧</span>
            <p>
              <strong>24/7 მხარდაჭერა</strong>
              <small>We&apos;re here to help</small>
            </p>
          </div>
          <Link href="/pages/community-guidelines">
            როგორ მუშაობს ტურნირები <span aria-hidden="true">→</span>
          </Link>
        </footer>
      </section>
    </Layout>
  )
}
