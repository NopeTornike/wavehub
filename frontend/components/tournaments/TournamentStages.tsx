import Link from 'next/link'
import { useId } from 'react'
import type { ReactNode } from 'react'
import type { PublicTournamentSummary, TournamentTeamRef } from '@wavehub/shared-types'
import { kaDayMonth } from '../../lib/dates'
import type { DashRow } from '../../lib/tournament-dashboard'
import { TeamMark, TIcon } from '../../lib/tournaments'

// Building blocks of the Tournament Dashboard and the My Tournament hub (owner 2026-11-14, Gio;
// docs/design-mockups/round-7/31, 33-38): the game banner, the Group Stage » Semifinals » Final
// stepper, standings tables (top N green), status pills, laurels and the drawn trophy. The layout
// follows the mockups 1:1; colours are the site's pink / violet (green only for qualifying rows,
// gold only for the champion).

// "18:00 (GMT+4)" — tournament times are Tbilisi times whatever the viewer's clock says.
export function tbilisiTime(value: string | Date): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  try {
    const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
    return `${t} (GMT+4)`
  } catch {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
}
export const dayMonth = (value: string | Date) => kaDayMonth(value)

// The game's wordmark: first word boxed, the rest small under it ("PUBG / MOBILE").
export function GameWordmark({ name }: { name: string }) {
  const [first, ...rest] = name.trim().split(/\s+/)
  return (
    <span className="td-game" aria-hidden="true">
      <b>{first}</b>
      {rest.length > 0 && <small>{rest.join(' ')}</small>}
    </span>
  )
}

export function TournamentBanner({
  tournament,
  cover,
  stats,
  href,
}: {
  tournament: PublicTournamentSummary
  cover: string | null
  stats?: { teams: number; groups: number } | null
  href?: string
}) {
  const body = (
    <>
      <span className="td-banner-art" style={cover ? { backgroundImage: `url('${cover}')` } : undefined} aria-hidden="true"></span>
      <span className="td-banner-copy">
        <span className="td-banner-title">
          <GameWordmark name={tournament.gameName} />
          <strong>
            {tournament.gameName}
            <br />
            Tournament
          </strong>
        </span>
        {stats && (
          <span className="td-banner-stats">
            <span>
              <TIcon name="users" /> {stats.teams} Teams
            </span>
            <i aria-hidden="true"></i>
            <span>
              <TIcon name="grid" /> {stats.groups} {stats.groups === 1 ? 'Group' : 'Groups'}
            </span>
          </span>
        )}
      </span>
    </>
  )
  return href ? (
    <Link className="td-banner" href={href} aria-label={tournament.name}>
      {body}
    </Link>
  ) : (
    <section className="td-banner" aria-label={tournament.name}>
      {body}
    </section>
  )
}

export type StageKey = 'group' | 'semifinal' | 'final'
export type StepInfo = { key: StageKey; label: string; icon: string; done: boolean }

export function StageStepper({ steps, active, onSelect }: { steps: StepInfo[]; active: StageKey; onSelect: (key: StageKey) => void }) {
  return (
    <nav className="td-steps" aria-label="ტურნირის ეტაპები">
      {steps.map((step, i) => (
        <span key={step.key} className="td-step-wrap">
          {i > 0 && (
            <i className="td-step-sep" aria-hidden="true">
              <TIcon name="doubleChevron" />
            </i>
          )}
          <button type="button" className={`td-step${step.key === active ? ' active' : ''}${step.done ? ' done' : ''}`} aria-current={step.key === active ? 'step' : undefined} onClick={() => onSelect(step.key)}>
            <TIcon name={step.icon} />
            <span>{step.label}</span>
            {step.done && <TIcon name="checkCircle" className="td-step-check" />}
          </button>
        </span>
      ))}
    </nav>
  )
}

export function StatusPill({ kind, children }: { kind: 'live' | 'upcoming' | 'done' | 'plain'; children?: ReactNode }) {
  if (kind === 'live')
    return (
      <span className="td-pill live">
        <i aria-hidden="true"></i>LIVE
      </span>
    )
  return (
    <span className={`td-pill ${kind}`}>
      {kind === 'upcoming' && <TIcon name="clock" />}
      {kind === 'done' && <TIcon name="checkCircle" />}
      {children ?? (kind === 'upcoming' ? 'Upcoming' : kind === 'done' ? 'Completed' : '')}
    </span>
  )
}

export function InfoNote({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <p className={`td-note${strong ? ' strong' : ''}`}>
      <TIcon name="info" />
      <span>{children}</span>
    </p>
  )
}

// # / Team / W-L / Pts. `advance` top rows are green (they go through); the final standings put
// Pts before W-L and colour 1st–3rd gold / silver / bronze.
export function StandingsTable({ rows, advance = 0, mine, variant = 'default', label }: { rows: DashRow[]; advance?: number; mine?: Set<string>; variant?: 'default' | 'final'; label: string }) {
  const final = variant === 'final'
  return (
    <div className={`td-table${final ? ' final' : ''}`} role="table" aria-label={label}>
      <div className="td-tr td-th" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">Team</span>
        <span role="columnheader">{final ? 'Pts' : 'W-L'}</span>
        <span role="columnheader">{final ? 'W-L' : 'Pts'}</span>
      </div>
      {rows.map((row, i) => {
        const cls = ['td-tr']
        if (final && i < 3) cls.push(`medal-${i + 1}`)
        else if (i < advance) cls.push('up')
        if (mine?.has(row.team.id)) cls.push('mine')
        return (
          <div key={row.team.id} className={cls.join(' ')} role="row">
            <span role="cell" className="td-rank">
              {final && i === 0 && <TIcon name="crown" className="td-rank-crown" />}
              <b>{i + 1}</b>
            </span>
            <span role="cell" className="td-team">
              <TeamMark team={row.team} />
              <strong>{row.team.name}</strong>
            </span>
            <span role="cell" className="td-num">
              {final ? row.points : `${row.wins} - ${row.losses}`}
            </span>
            <span role="cell" className="td-num">
              {final ? `${row.wins} - ${row.losses}` : row.points}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// A laurel branch; `flip` mirrors it for the right-hand side.
export function Laurel({ flip, className = '' }: { flip?: boolean; className?: string }) {
  const leaves = Array.from({ length: 7 }, (_, i) => {
    const a = ((112 + i * 22) * Math.PI) / 180
    const x = 30 + 22 * Math.cos(a)
    const y = 30 + 22 * Math.sin(a)
    const deg = (a * 180) / Math.PI + 90 + 32
    return <ellipse key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} rx="6" ry="2.6" transform={`rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})`} />
  })
  return (
    <svg className={`td-laurel ${className}`.trim()} viewBox="0 0 34 60" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M30 56C14 52 6 40 8.5 20" fill="none" strokeWidth="1.8" strokeLinecap="round" />
      <g transform="translate(-0.5 -2)">{leaves}</g>
    </svg>
  )
}

// A drawn gold cup (no stock art).
export function TrophyArt({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={`td-trophy ${className}`.trim()} viewBox="0 0 160 170" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9a6a12" />
          <stop offset=".35" stopColor="#ffe08a" />
          <stop offset=".55" stopColor="#f6c445" />
          <stop offset="1" stopColor="#8a5a0c" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2a52" />
          <stop offset="1" stopColor="#140d22" />
        </linearGradient>
        <radialGradient id={`${id}h`} cx=".5" cy=".45" r=".5">
          <stop offset="0" stopColor="#ffcf5a" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffcf5a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="80" cy="74" rx="78" ry="70" fill={`url(#${id}h)`} />
      {/* handles */}
      <path d="M44 34H24c0 26 12 40 30 44" fill="none" stroke={`url(#${id}g)`} strokeWidth="7" strokeLinecap="round" />
      <path d="M116 34h20c0 26-12 40-30 44" fill="none" stroke={`url(#${id}g)`} strokeWidth="7" strokeLinecap="round" />
      {/* cup */}
      <path d="M40 20h80v28c0 26-18 44-40 44S40 74 40 48V20Z" fill={`url(#${id}g)`} />
      <ellipse cx="80" cy="20" rx="40" ry="6" fill="#ffe9a8" />
      <ellipse cx="80" cy="20" rx="34" ry="3.6" fill="#b07a18" />
      <path d="M80 40l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#fff4cc" opacity=".55" />
      {/* stem + base */}
      <path d="M72 92h16l-2 18h-12z" fill={`url(#${id}g)`} />
      <path d="M58 110h44l4 12H54z" fill={`url(#${id}g)`} />
      <path d="M46 122h68v22H46z" fill={`url(#${id}b)`} stroke="#c9952a" strokeWidth="2" />
    </svg>
  )
}

// One finalist card: logo, name, "Group A – 1st" (or "TBD" while the slot is still open).
export function FinalistCard({ team, sub }: { team: TournamentTeamRef | null; sub: string | null }) {
  return (
    <div className={`td-finalist${team ? '' : ' tbd'}`}>
      <TeamMark team={team} className="lg" />
      <strong>{team?.name ?? 'TBD'}</strong>
      {sub && <small>{sub}</small>}
    </div>
  )
}

// Big clock boxes: HRS : MIN : SEC (DAYS : HRS : MIN from a day out).
export function ClockBoxes({ ms }: { ms: number | null }) {
  const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0')
  let units: [string, string][]
  if (ms === null) units = [['--', 'HRS'], ['--', 'MIN'], ['--', 'SEC']]
  else {
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    units =
      h >= 24
        ? [
            [pad(Math.floor(h / 24)), 'DAYS'],
            [pad(h % 24), 'HRS'],
            [pad(m), 'MIN'],
          ]
        : [
            [pad(h), 'HRS'],
            [pad(m), 'MIN'],
            [pad(Math.floor((ms % 60_000) / 1000)), 'SEC'],
          ]
  }
  return (
    <div className="td-clock" role="timer" aria-live="off">
      {units.map(([v, unit], i) => (
        <span key={unit} className="td-clock-unit">
          {i > 0 && <i aria-hidden="true">:</i>}
          <span>
            <b>{v}</b>
            <small>{unit}</small>
          </span>
        </span>
      ))}
    </div>
  )
}
