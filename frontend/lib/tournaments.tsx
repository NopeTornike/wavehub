import type { ReactNode } from 'react'
import type { PublicTournamentMatch, PublicTournamentSummary, TournamentTeamRef } from '@wavehub/shared-types'
import { TournamentMatchStage, TournamentMatchStatus, TournamentStatus } from '@wavehub/shared-types'
import { gameCover } from './games'

// Shared pieces of the tournament pages (docs/design-mockups 01–03, 07, 08, 10, 11, 13).

export const TOURNAMENT_BADGE: Record<TournamentStatus, [label: string, tone: string]> = {
  [TournamentStatus.Open]: ['რეგისტრაცია ღიაა', 'open'],
  [TournamentStatus.Upcoming]: ['მალე', 'upcoming'],
  [TournamentStatus.InProgress]: ['მიმდინარე', 'live'],
  [TournamentStatus.Completed]: ['დასრულებული', 'completed'],
}

export const STAGE_LABEL: Record<TournamentMatchStage, string> = {
  [TournamentMatchStage.Group]: 'ჯგუფური ეტაპი',
  [TournamentMatchStage.Round]: 'რაუნდი',
  [TournamentMatchStage.QuarterFinal]: 'მეოთხედფინალი',
  [TournamentMatchStage.SemiFinal]: 'ნახევარფინალი',
  [TournamentMatchStage.Final]: 'ფინალი',
}

export const MATCH_STATUS_LABEL: Record<TournamentMatchStatus, string> = {
  [TournamentMatchStatus.Scheduled]: 'დაგეგმილი',
  [TournamentMatchStatus.Live]: 'მიმდინარე',
  [TournamentMatchStatus.Completed]: 'დასრულებული',
}

export function isActiveTournament(t: PublicTournamentSummary) {
  return t.status !== TournamentStatus.Completed
}

export function tournamentCover(t: PublicTournamentSummary, slugByGameId: Map<string, string>): string | null {
  return t.coverImageUrl ?? gameCover(slugByGameId.get(t.gameId))
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }

export function formatDay(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('ka-GE', DATE_FMT)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ka-GE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// "25 May, 2026" or "25 May – 28 May, 2026" when staff entered an end date (details.endDate).
export function tournamentDates(t: PublicTournamentSummary): string {
  const end = t.details?.endDate
  return end ? `${formatDay(t.startDate)} – ${formatDay(end)}` : formatDay(t.startDate)
}

// "Squad (4 Players)" as staff wrote it, else derived from the real team size.
export function tournamentFormat(t: PublicTournamentSummary): string {
  if (t.details?.format) return t.details.format
  return t.teamSize > 1 ? `${t.teamSize}v${t.teamSize}` : 'Solo'
}

export function teamInitials(team: Pick<TournamentTeamRef, 'name' | 'tag'> | null | undefined): string {
  if (!team) return '?'
  return (team.tag || team.name).slice(0, 3).toUpperCase()
}

export function TeamMark({ team, className = '' }: { team: TournamentTeamRef | null; className?: string }) {
  return (
    <span className={`wt-team-mark ${className}`.trim()} style={team?.logoUrl ? { backgroundImage: `url("${team.logoUrl}")` } : undefined} aria-hidden="true">
      {team?.logoUrl ? '' : teamInitials(team)}
    </span>
  )
}

// Winner side of a completed match, or null (not played / draw).
export function matchWinner(m: PublicTournamentMatch): 'a' | 'b' | null {
  if (m.status !== TournamentMatchStatus.Completed || m.scoreA === null || m.scoreB === null || m.scoreA === m.scoreB) return null
  return m.scoreA > m.scoreB ? 'a' : 'b'
}

const PATHS: Record<string, ReactNode> = {
  trophy: <><path d="M7 3h10v5a5 5 0 0 1-10 0V3Z" /><path d="M7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4M12 13v4m-4 4h8m-6-4h4" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5.5 5.5 0 0 1 3.5 6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  pin: <><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></>,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  map: <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" />,
  chart: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
  trend: <path d="m3 17 6-6 4 4 8-8m-5 0h5v5" />,
  grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  crosshair: <><circle cx="12" cy="12" r="7" /><path d="M12 2v5m0 10v5M2 12h5m10 0h5" /></>,
  burst: <path d="M12 2v5m0 10v5M2 12h5m10 0h5M5 5l3.5 3.5m7 7L19 19M5 19l3.5-3.5m7-7L19 5" />,
  hands: <path d="M7 11 4 14l5 5 3-3M17 11l3 3-5 5-3-3M8 10l4-4 4 4" />,
  bracket: <path d="M4 5h5v6H4m0 8h5v-6M9 8h4v8H9m4-4h7" />,
  gamepad: <><path d="M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6L14 14h-4l-1 1.6A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4Z" /><path d="M7 11v3m-1.5-1.5h3M16 12h.01M18 14h.01" /></>,
  shield: <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
}

export function TIcon({ name, className }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
