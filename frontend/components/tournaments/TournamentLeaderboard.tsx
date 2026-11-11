import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { TournamentLeaderboard as Board, TournamentLeaderboardEntry } from '@wavehub/shared-types'
import Avatar from '../Avatar'
import { api } from '../../lib/api'
import { useShell } from '../../lib/shell'
import { TIcon } from '../../lib/tournaments'

// The tournament leaderboard (owner 2026-11-10, docs/design-mockups/round-6/10): top 3 players and
// top 5 teams. Staff type every number in Admin → Tournament leaderboard and can hide the whole block;
// when hidden (or empty) nothing renders.

const fmt = (n: number) => n.toLocaleString('en-US')

function Crown({ place }: { place: number }) {
  const tone = place === 1 ? ['#ffe27a', '#e0a100'] : place === 2 ? ['#f1f4ff', '#9aa3b8'] : ['#ffb27a', '#c2621f']
  return (
    <svg className={`tl-crown p${place}`} viewBox="0 0 48 40" aria-hidden="true">
      <defs>
        <linearGradient id={`tlc${place}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone[0]} />
          <stop offset="1" stopColor={tone[1]} />
        </linearGradient>
      </defs>
      <path d="M4 12l10 9 10-16 10 16 10-9-4 24H8L4 12Z" fill={`url(#tlc${place})`} stroke="rgba(0,0,0,.35)" strokeWidth="1.2" />
      <text x="24" y="31" textAnchor="middle" fontSize="15" fontWeight="900" fill="#2a1a05">
        {place}
      </text>
    </svg>
  )
}

function Stats({ e }: { e: TournamentLeaderboardEntry }) {
  return (
    <>
      <span title="მოგებები">
        <TIcon name="trophy" />
        {fmt(e.wins)}
      </span>
      <span title="მკვლელობები">
        <TIcon name="crosshair" />
        {fmt(e.kills)}
      </span>
      <span title="ქულები">
        <TIcon name="chart" />
        {fmt(e.points)}
      </span>
    </>
  )
}

function PlayerName({ e }: { e: TournamentLeaderboardEntry }) {
  return e.username ? <Link href={`/u/${e.username}`}>{e.name}</Link> : <span>{e.name}</span>
}

export default function TournamentLeaderboard() {
  const { games } = useShell()
  const [gameId, setGameId] = useState('')
  const [board, setBoard] = useState<Board | null>(null)

  useEffect(() => {
    let alive = true
    api
      .getTournamentLeaderboard(gameId || undefined)
      .then((b) => alive && setBoard(b))
      .catch(() => alive && setBoard(null))
    return () => {
      alive = false
    }
  }, [gameId])

  if (!board || !board.visible) return null
  // Hidden until staff enter something — unless a game filter is what emptied it.
  if (!gameId && board.players.length === 0 && board.teams.length === 0) return null
  // Podium order: 2, 1, 3.
  const podium = [board.players[1], board.players[0], board.players[2]].map((e, i) => (e ? { e, place: [2, 1, 3][i] } : null))

  return (
    <section className="tl-board" aria-labelledby="tlTitle">
      <header className="tl-head">
        <span className="tl-brand">
          <b>W</b>
          <span>
            WAVE<em>HUBX</em>
          </span>
        </span>
        <h2 id="tlTitle">
          <TIcon name="trophy" /> Leaderboard
        </h2>
        <label className="tl-filter">
          <TIcon name="gamepad" />
          <select value={gameId} onChange={(e) => setGameId(e.target.value)} aria-label="თამაში">
            <option value="">ყველა თამაში</option>
            {games.map((g) => (
              <option key={g.gameId} value={g.gameId}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="tl-body">
        <section className="tl-players" aria-label="Top 3 მოთამაშე">
          <header>
            <h3>
              <TIcon name="user" /> Top 3 მოთამაშე
            </h3>
            <small>ინდივიდუალური შედეგები</small>
          </header>
          {board.players.length === 0 ? (
            <p className="tl-empty">ამ თამაშზე მონაცემები ჯერ არ არის.</p>
          ) : (
            <div className="tl-podium">
              {podium.map((slot, i) =>
                slot ? (
                  <article key={slot.e.id} className={`tl-player p${slot.place}`}>
                    <Crown place={slot.place} />
                    <Avatar name={slot.e.name} src={slot.e.imageUrl} size={slot.place === 1 ? 92 : 76} ring={false} />
                    <strong>
                      <PlayerName e={slot.e} />
                      <TIcon name="shieldCheck" className="tl-check" />
                    </strong>
                    <p className="tl-stats">
                      <Stats e={slot.e} />
                    </p>
                  </article>
                ) : (
                  <span key={`empty-${i}`} className="tl-player empty" aria-hidden="true"></span>
                ),
              )}
            </div>
          )}
        </section>

        <section className="tl-teams" aria-label="Top 5 გუნდი">
          <header>
            <h3>
              <TIcon name="users" /> Top 5 გუნდი
            </h3>
            <small>გუნდური შედეგები</small>
          </header>
          {board.teams.length === 0 ? (
            <p className="tl-empty">ამ თამაშზე მონაცემები ჯერ არ არის.</p>
          ) : (
            <ol className="tl-team-list">
              {board.teams.map((e, i) => (
                <li key={e.id} className={i === 0 ? 'first' : undefined}>
                  <span className="tl-rank">{i < 3 ? <Crown place={i + 1} /> : <b>{i + 1}</b>}</span>
                  <Avatar name={e.name} src={e.imageUrl} size={44} ring={false} />
                  <strong>
                    {e.name}
                    <TIcon name="shieldCheck" className="tl-check" />
                  </strong>
                  <span className="tl-stats">
                    <Stats e={e} />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <footer className="tl-legend">
        <span>
          <TIcon name="trophy" />
          <span>
            <b>Wins</b>
            <small>მოგებული მატჩები</small>
          </span>
        </span>
        <span>
          <TIcon name="crosshair" />
          <span>
            <b>Kills</b>
            <small>მკვლელობები მატჩებში</small>
          </span>
        </span>
        <span>
          <TIcon name="chart" />
          <span>
            <b>Points</b>
            <small>ტურნირების ჯამური ქულა</small>
          </span>
        </span>
      </footer>
    </section>
  )
}
