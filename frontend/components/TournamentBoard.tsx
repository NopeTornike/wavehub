import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import type { PublicTournamentSummary } from '@wavehub/shared-types'
import { useShell } from '../lib/shell'
import { isActiveTournament, TIcon, TOURNAMENT_BADGE, tournamentCover, tournamentDates, tournamentFormat } from '../lib/tournaments'

// docs/design-mockups/02-my-tournaments.jpg: heading with the trophy mark and a game picker, the
// All / Active / Completed tabs with counts, an "Active" group of large cards (cover left, status
// badge, format · server, dates, View Tournament) and a "Completed" group of compact cards, each
// group collapsible, and the slogan strip. Used for every tournament (/tournaments) and for the
// signed-in user's own (/tournaments/mine).

type Tab = 'all' | 'active' | 'completed'
const COLLAPSED = { active: 4, completed: 6 }

function Meta({ t }: { t: PublicTournamentSummary }) {
  return (
    <>
      <p className="wt-card-meta">
        <span>
          <TIcon name="users" />
          {tournamentFormat(t)}
        </span>
        <i aria-hidden="true"></i>
        <span>
          <TIcon name="globe" />
          {t.details?.region || t.gameName}
        </span>
      </p>
      <p className="wt-card-meta">
        <span>
          <TIcon name="calendar" />
          {tournamentDates(t)}
        </span>
      </p>
    </>
  )
}

function Badge({ t }: { t: PublicTournamentSummary }) {
  const [label, tone] = TOURNAMENT_BADGE[t.status]
  return (
    <span className={`wt-badge ${tone}`}>
      <i aria-hidden="true"></i>
      {label}
    </span>
  )
}

export default function TournamentBoard({
  title,
  subtitle,
  tournaments,
  actions,
  emptyTitle,
  emptyText,
}: {
  title: string
  subtitle: string
  tournaments: PublicTournamentSummary[] | null
  actions?: ReactNode
  emptyTitle: string
  emptyText: ReactNode
}) {
  const { games } = useShell()
  const [tab, setTab] = useState<Tab>('all')
  const [game, setGame] = useState('all')
  const [expanded, setExpanded] = useState({ active: false, completed: false })
  const slugById = useMemo(() => new Map(games.map((g) => [g.gameId, g.slug])), [games])

  const filtered = (tournaments ?? []).filter((t) => game === 'all' || t.gameId === game)
  const active = filtered.filter(isActiveTournament)
  const completed = filtered.filter((t) => !isActiveTournament(t))
  const cover = (t: PublicTournamentSummary) => tournamentCover(t, slugById)
  const coverStyle = (t: PublicTournamentSummary) => {
    const url = cover(t)
    return url ? { backgroundImage: `linear-gradient(90deg,rgba(3,6,14,.02),rgba(3,6,14,.35)),url('${url}')` } : undefined
  }

  const groupHead = (kind: 'active' | 'completed', count: number, total: number) => (
    <header className="wt-group-head">
      <h2>
        <i className={`wt-dot ${kind}`} aria-hidden="true"></i>
        {kind === 'active' ? 'აქტიური ტურნირები' : 'დასრულებული ტურნირები'} <b>{count}</b>
      </h2>
      {total > COLLAPSED[kind] && (
        <button type="button" onClick={() => setExpanded((e) => ({ ...e, [kind]: !e[kind] }))} aria-expanded={expanded[kind]}>
          {expanded[kind] ? 'ნაკლების ნახვა' : 'ყველას ნახვა'} <TIcon name="chevron" className={expanded[kind] ? 'up' : ''} />
        </button>
      )}
    </header>
  )

  const shownActive = expanded.active ? active : active.slice(0, COLLAPSED.active)
  const shownCompleted = expanded.completed ? completed : completed.slice(0, COLLAPSED.completed)
  const nothing = tournaments !== null && (tab === 'active' ? active.length : tab === 'completed' ? completed.length : filtered.length) === 0

  return (
    <section className="wt-board">
      <header className="wt-board-head">
        <span className="wt-board-mark" aria-hidden="true">
          <TIcon name="trophy" />
        </span>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="wt-board-actions">
          {actions}
          <label className="wt-game-select">
            <TIcon name="gamepad" />
            <span className="sr-only">თამაში</span>
            <select value={game} onChange={(e) => setGame(e.target.value)}>
              <option value="all">ყველა თამაში</option>
              {games.map((g) => (
                <option key={g.gameId} value={g.gameId}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="wt-tabs" role="tablist" aria-label="ტურნირების ფილტრი">
        <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : undefined} onClick={() => setTab('all')}>
          ყველა ტურნირი
        </button>
        <button type="button" role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? 'active' : undefined} onClick={() => setTab('active')}>
          <i className="wt-dot active" aria-hidden="true"></i>აქტიური <b>{active.length}</b>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'completed'} className={tab === 'completed' ? 'active' : undefined} onClick={() => setTab('completed')}>
          <i className="wt-dot completed" aria-hidden="true"></i>დასრულებული <b>{completed.length}</b>
        </button>
      </div>

      {tournaments === null && <div className="marketplace-empty">იტვირთება…</div>}

      {tab !== 'completed' && active.length > 0 && (
        <section className="wt-group">
          {groupHead('active', active.length, active.length)}
          <div className="wt-active-grid">
            {shownActive.map((t) => (
              <article key={t.id} className="wt-card-lg">
                <Link className="wt-card-cover" href={`/tournaments/${t.id}`} style={coverStyle(t)} aria-label={t.name}></Link>
                <div className="wt-card-body">
                  <Badge t={t} />
                  <h3>
                    <Link href={`/tournaments/${t.id}`}>{t.name}</Link>
                  </h3>
                  <Meta t={t} />
                  <Link className="wt-card-button" href={`/tournaments/${t.id}`}>
                    ტურნირის ნახვა <TIcon name="arrow" />
                  </Link>
                </div>
                <TIcon name="chevron" className="wt-card-chevron" />
              </article>
            ))}
          </div>
        </section>
      )}

      {tab !== 'active' && completed.length > 0 && (
        <section className="wt-group">
          {groupHead('completed', completed.length, completed.length)}
          <div className="wt-completed-grid">
            {shownCompleted.map((t) => (
              <Link key={t.id} className="wt-card-sm" href={`/tournaments/${t.id}`}>
                <div className="wt-card-cover" style={coverStyle(t)} aria-hidden="true"></div>
                <div className="wt-card-body">
                  <Badge t={t} />
                  <strong>{t.name}</strong>
                  <Meta t={t} />
                </div>
                <TIcon name="chevron" className="wt-card-chevron" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {nothing && (
        <div className="wt-empty">
          <TIcon name="trophy" />
          <strong>{emptyTitle}</strong>
          <p>{emptyText}</p>
        </div>
      )}

      <footer className="wt-slogan">
        <span aria-hidden="true">
          <TIcon name="trophy" />
        </span>
        დიდი ბრძოლები. დიდი გამარჯვებები. <b>WaveHubX</b>
      </footer>
    </section>
  )
}
