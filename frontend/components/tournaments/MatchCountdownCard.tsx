/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { MatchRoomView, PublicTournamentMatch } from '@wavehub/shared-types'
import { TournamentMatchStatus } from '@wavehub/shared-types'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useShell } from '../../lib/shell'
import { gameIcon } from '../../lib/games'
import { kaDayMonth, kaTime } from '../../lib/dates'
import { pollWhileVisible } from '../../lib/visible-poll'
import { STAGE_LABEL, TeamMark, TIcon } from '../../lib/tournaments'

// Home: the signed-in player's next match (owner 2026-11-10, docs/design-mockups/round-6/11). It
// appears 24 hours before a match staff scheduled for one of the player's teams and counts down to
// it. Room ID, password and "your seat" come from the game-room endpoint: locked (🔒) until staff
// open that team's room, and never shown to anyone outside the two teams.
const WINDOW_MS = 24 * 3_600_000
// A started match stays on the card for a while (players may still be joining the room).
const AFTER_START_MS = 2 * 3_600_000

function pick(matches: PublicTournamentMatch[], now: number): PublicTournamentMatch | null {
  return (
    matches
      .filter((m) => m.status !== TournamentMatchStatus.Completed && m.scheduledAt && m.teamA && m.teamB)
      .filter((m) => {
        const at = new Date(m.scheduledAt!).getTime()
        return at - now <= WINDOW_MS && now - at <= AFTER_START_MS
      })
      .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0] ?? null
  )
}

const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0')

export default function MatchCountdownCard() {
  const { user } = useAuth()
  const { games } = useShell()
  const userId = user?.id
  const [matches, setMatches] = useState<PublicTournamentMatch[]>([])
  const [room, setRoom] = useState<MatchRoomView | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!userId) return
    const load = () =>
      api
        .listMyTournamentMatches()
        .then(setMatches)
        .catch(() => undefined)
    load()
    return pollWhileVisible(load, 120_000)
  }, [userId])

  const match = userId ? pick(matches, now) : null
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
    if (!matchId) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [matchId])

  if (!match || !match.scheduledAt) return null
  const at = new Date(match.scheduledAt)
  const left = Math.max(0, at.getTime() - now)
  const started = left === 0
  const h = Math.floor(left / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  const slug = room ? games.find((g) => g.name === room.gameName)?.slug : null
  const icon = gameIcon(slug)
  const open = room?.status === 'available' && room.room
  const locked = (label: string) => (
    <span className="mc-locked" title="ადმინისტრაცია გახსნის მატჩამდე">
      <TIcon name="lock" /> {label}
    </span>
  )

  return (
    <section className="mc-card" aria-label="შენი მომავალი მატჩი">
      <header className="mc-head">
        <span className="mc-brand">
          {icon ? <img src={icon} alt="" /> : <TIcon name="gamepad" />}
          <span>
            <b>WAVEHUBX</b>
            <em>TOURNAMENT</em>
          </span>
        </span>
        <Link className="mc-name" href={`/tournaments/hub?t=${match.tournamentId}`}>
          <TIcon name="trophy" />
          <span>{match.tournamentName}</span>
        </Link>
      </header>

      <p className="mc-label">{started ? 'მატჩი დაიწყო — შედი ოთახში!' : 'მატჩის დაწყებამდე დარჩენილია:'}</p>
      <div className="mc-clock" role="timer" aria-live="off">
        {[
          [pad(h), 'საათი'],
          [pad(m), 'წუთი'],
          [pad(s), 'წამი'],
        ].map(([v, label], i) => (
          <span key={label} className="mc-unit">
            {i > 0 && <i aria-hidden="true">:</i>}
            <span>
              <b>{v}</b>
              <small>{label}</small>
            </span>
          </span>
        ))}
      </div>

      <div className="mc-facts">
        <span>
          <TIcon name="calendar" />
          <span>
            <small>დაწყება:</small>
            <b>
              {kaDayMonth(at)}, {kaTime(at)}
            </b>
          </span>
        </span>
        <span>
          <TIcon name="bars" />
          <span>
            <small>ეტაპი:</small>
            <b>{match.roundLabel ? `${STAGE_LABEL[match.stage]} · ${match.roundLabel}` : STAGE_LABEL[match.stage]}</b>
          </span>
        </span>
        <span>
          <TIcon name="users" />
          <span>
            <small>Room ID:</small>
            <b>{open && room.room?.roomId ? room.room.roomId : locked('დაბლოკილია')}</b>
          </span>
        </span>
      </div>

      <div className="mc-vs">
        <span className="mc-team">
          <TeamMark team={match.teamA} />
          <strong>{match.teamA?.name}</strong>
        </span>
        <b className="mc-vs-mark">VS</b>
        <span className="mc-team b">
          <strong>{match.teamB?.name}</strong>
          <TeamMark team={match.teamB} />
        </span>
      </div>

      <div className="mc-secret">
        <span>
          <TIcon name="key" />
          <small>პაროლი:</small>
          <b>{open && room.room?.password ? room.room.password : locked('დაბლოკილია')}</b>
        </span>
        <span>
          <TIcon name="seat" />
          <small>თქვენი ადგილი:</small>
          <b>{open && room.room?.slot ? room.room.slot : locked('დაბლოკილია')}</b>
        </span>
      </div>
      {room?.teamPending && <p className="mc-note">შენი გუნდი ჯერ არ არის დადასტურებული — ოთახის მონაცემები დადასტურების შემდეგ გამოჩნდება.</p>}
    </section>
  )
}
