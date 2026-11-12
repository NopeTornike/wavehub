import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { MatchRoomView, MyTournamentEntry, PublicTournamentMatch, PublicTournamentSummary } from '@wavehub/shared-types'
import { TournamentMatchStatus, TournamentStatus } from '@wavehub/shared-types'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { kaDayMonth, kaTime } from '../../lib/dates'
import { pollWhileVisible } from '../../lib/visible-poll'
import { STAGE_LABEL, TeamMark, TIcon, tournamentPrimaryHref } from '../../lib/tournaments'

// Home countdown card, right under the hero banner (owner 2026-11-10 / 2026-11-12,
// docs/design-mockups/round-6/11). What it counts down to, first match wins:
//   1. the signed-in player's next scheduled match (or one that started under 2h ago) — teams,
//      Room ID / password / seat from the game-room endpoint, locked (🔒) until staff open the room;
//   2. the start of a tournament the player's team is registered in (their team vs "TBA");
//   3. the start of the featured open / upcoming tournament, with a register button.
// A tournament's start = its startDate + the "startTime" detail (Tbilisi time). A start that has
// already passed on a tournament that hasn't begun shows "--" and "to be announced" (rule #6).
const AFTER_START_MS = 2 * 3_600_000
const LIVE: TournamentStatus[] = [TournamentStatus.Open, TournamentStatus.Upcoming, TournamentStatus.InProgress]

function nextMatch(matches: PublicTournamentMatch[], now: number): PublicTournamentMatch | null {
  return (
    matches
      .filter((m) => m.status !== TournamentMatchStatus.Completed && m.scheduledAt && m.teamA && m.teamB)
      .filter((m) => now - new Date(m.scheduledAt!).getTime() <= AFTER_START_MS)
      .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0] ?? null
  )
}

// startDate (YYYY-MM-DD) + "18:00 (GMT+4)" → the moment it starts, Tbilisi time.
export function tournamentStart(t: PublicTournamentSummary): Date | null {
  const day = /^(\d{4}-\d{2}-\d{2})/.exec(t.startDate ?? '')?.[1]
  if (!day) return null
  const time = /(\d{1,2})[:.](\d{2})/.exec(t.details?.startTime ?? '')
  const hh = time ? time[1].padStart(2, '0') : '00'
  const mm = time ? time[2] : '00'
  const at = new Date(`${day}T${hh}:${mm}:00+04:00`)
  return Number.isNaN(at.getTime()) ? null : at
}

// Prefer the soonest start still ahead; otherwise keep the list's own order.
function soonest<T>(items: T[], startOf: (item: T) => Date | null, now: number): T | null {
  const ahead = items
    .map((item) => ({ item, at: startOf(item)?.getTime() ?? null }))
    .filter((x): x is { item: T; at: number } => x.at !== null && x.at > now)
    .sort((a, b) => a.at - b.at)
  return ahead[0]?.item ?? items[0] ?? null
}

const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0')

// Clock boxes: hours / minutes / seconds, or days / hours / minutes from 100 hours out.
function clockUnits(left: number | null): [string, string][] {
  if (left === null) return [['--', 'საათი'], ['--', 'წუთი'], ['--', 'წამი']]
  const h = Math.floor(left / 3_600_000)
  if (h >= 100) {
    return [
      [pad(Math.floor(h / 24)), 'დღე'],
      [pad(h % 24), 'საათი'],
      [pad(Math.floor((left % 3_600_000) / 60_000)), 'წუთი'],
    ]
  }
  return [
    [pad(h), 'საათი'],
    [pad(Math.floor((left % 3_600_000) / 60_000)), 'წუთი'],
    [pad(Math.floor((left % 60_000) / 1000)), 'წამი'],
  ]
}

// The game's wordmark in the mockup's style: first word boxed, the rest under it.
function GameMark({ name }: { name: string }) {
  const [first, ...rest] = name.trim().split(/\s+/)
  return (
    <span className="mc-game" aria-hidden="true">
      <b>{first}</b>
      {rest.length > 0 && <small>{rest.join(' ')}</small>}
    </span>
  )
}

export default function MatchCountdownCard({ tournaments = [] }: { tournaments?: PublicTournamentSummary[] }) {
  const { user } = useAuth()
  const userId = user?.id
  const [matches, setMatches] = useState<PublicTournamentMatch[]>([])
  const [entries, setEntries] = useState<MyTournamentEntry[]>([])
  const [room, setRoom] = useState<MatchRoomView | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!userId) return
    const load = () => {
      api.listMyTournamentMatches().then(setMatches).catch(() => undefined)
      api.listMyTournaments().then(setEntries).catch(() => undefined)
    }
    load()
    return pollWhileVisible(load, 120_000)
  }, [userId])

  const match = userId ? nextMatch(matches, now) : null
  const matchId = match?.id

  useEffect(() => {
    if (!matchId) return
    let alive = true
    const load = () =>
      api
        .getMyMatchRoom(matchId)
        .then((r) => alive && setRoom(r))
        .catch(() => alive && setRoom(null))
    load()
    const stop = pollWhileVisible(load, 30_000)
    return () => {
      alive = false
      stop()
    }
  }, [matchId])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const myEntries = userId ? entries.filter((e) => LIVE.includes(e.tournament.status)) : []
  const featuredList = tournaments.filter((t) => LIVE.includes(t.status))
  // A live countdown beats "to be announced": the player's own tournament with a start still ahead,
  // then the featured one with a start ahead, then either without one.
  const ahead = (t: PublicTournamentSummary) => {
    const at = tournamentStart(t)
    return t.status !== TournamentStatus.InProgress && !!at && at.getTime() > now
  }
  let entry: MyTournamentEntry | null = null
  let featured: PublicTournamentSummary | null = null
  if (!match) {
    entry = soonest(myEntries.filter((e) => ahead(e.tournament)), (e) => tournamentStart(e.tournament), now)
    if (!entry) featured = soonest(featuredList.filter(ahead), tournamentStart, now)
    if (!entry && !featured) entry = myEntries[0] ?? null
    if (!entry && !featured) featured = featuredList[0] ?? null
  }
  const tournament = match
    ? (myEntries.find((e) => e.tournament.id === match.tournamentId)?.tournament ?? null)
    : (entry?.tournament ?? featured)
  if (!match && !tournament) return null

  const gameName = room?.gameName ?? tournament?.gameName ?? ''
  const title = match?.tournamentName ?? tournament!.name
  const href = match ? `/tournaments/hub?t=${match.tournamentId}` : tournamentPrimaryHref(tournament!)

  // The moment counted down to, and the label above the clock.
  let at: Date | null
  let label: string
  if (match) {
    at = new Date(match.scheduledAt!)
    label = at.getTime() <= now ? 'მატჩი დაიწყო — შედი ოთახში!' : 'მატჩის დაწყებამდე დარჩენილია:'
  } else {
    at = tournamentStart(tournament!)
    const inProgress = tournament!.status === TournamentStatus.InProgress
    if (inProgress) label = 'ტურნირი მიმდინარეობს'
    else if (at && at.getTime() > now) label = 'ტურნირის დაწყებამდე დარჩენილია:'
    else label = 'ტურნირის დაწყების დრო მალე გამოცხადდება'
    if (inProgress || (at && at.getTime() <= now)) at = null
  }
  const left = at ? Math.max(0, at.getTime() - now) : null
  const when = match ? new Date(match.scheduledAt!) : at

  const stage = match
    ? STAGE_LABEL[match.stage]
    : tournament!.status === TournamentStatus.Open
      ? 'რეგისტრაცია'
      : tournament!.status === TournamentStatus.InProgress
        ? 'მიმდინარე'
        : 'მალე იწყება'

  const open = !!match && room?.status === 'available' && !!room.room
  const locked = (text = 'მალე') => (
    <span className="mc-locked" title="ადმინისტრაცია გახსნის მატჩამდე">
      <TIcon name="lock" /> {text}
    </span>
  )
  const myTeam = entry?.team ?? null

  return (
    <section className="mc-card" aria-label={match ? 'შენი მომავალი მატჩი' : 'ტურნირის დაწყება'}>
      <header className="mc-head">
        <span className="mc-brand">
          {gameName ? <GameMark name={gameName} /> : <TIcon name="gamepad" />}
          <span className="mc-wordmark">
            <b>WAVEHUBX</b>
            <em>TOURNAMENT</em>
          </span>
        </span>
        <Link className="mc-name" href={href}>
          <TIcon name="trophy" />
          <span>{title}</span>
        </Link>
      </header>

      <p className="mc-label">{label}</p>
      <div className="mc-clock" role="timer" aria-live="off">
        {clockUnits(left).map(([v, unit], i) => (
          <span key={unit} className="mc-unit">
            {i > 0 && <i aria-hidden="true">:</i>}
            <span>
              <b>{v}</b>
              <small>{unit}</small>
            </span>
          </span>
        ))}
      </div>

      <div className="mc-facts">
        <span>
          <TIcon name="calendar" />
          <span>
            <small>დაწყება:</small>
            <b>{when ? `${kaDayMonth(when)}, ${kaTime(when)}` : 'მალე'}</b>
          </span>
        </span>
        <span>
          <TIcon name="bars" />
          <span>
            <small>ეტაპი:</small>
            <b>{stage}</b>
          </span>
        </span>
        <span>
          <TIcon name="users" />
          <span>
            <small>Room ID:</small>
            <b>{open && room?.room?.roomId ? room.room.roomId : locked()}</b>
          </span>
        </span>
      </div>

      {match || myTeam ? (
        <>
          <div className="mc-vs">
            <span className="mc-team">
              <TeamMark team={match ? match.teamA : myTeam} />
              <strong>{match ? match.teamA?.name : myTeam!.name}</strong>
            </span>
            <b className="mc-vs-mark">VS</b>
            <span className={`mc-team b${match ? '' : ' is-tba'}`}>
              <strong>{match ? match.teamB?.name : 'TBA'}</strong>
              <TeamMark team={match ? match.teamB : null} />
            </span>
          </div>
          <div className="mc-secret">
            <span>
              <TIcon name="key" />
              <small>პაროლი:</small>
              <b>{open && room?.room?.password ? room.room.password : locked()}</b>
            </span>
            <span>
              <TIcon name="seat" />
              <small>თქვენი ადგილი:</small>
              <b>{open && room?.room?.slot ? room.room.slot : locked()}</b>
            </span>
          </div>
          {room?.teamPending && <p className="mc-note">შენი გუნდი ჯერ არ არის დადასტურებული — ოთახის მონაცემები დადასტურების შემდეგ გამოჩნდება.</p>}
        </>
      ) : (
        <div className="mc-cta">
          <span>
            <TIcon name="users" />
            <small>გუნდები:</small>
            <b>
              {tournament!.teamCount} / {tournament!.maxTeams}
            </b>
          </span>
          <Link className="mc-register" href={tournamentPrimaryHref(tournament!)}>
            {tournament!.status === TournamentStatus.Open ? 'დარეგისტრირდი' : 'დეტალები'} <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </section>
  )
}
