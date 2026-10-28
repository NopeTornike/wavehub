import { useEffect, useState } from 'react'
import type { MatchRoomView } from '@wavehub/shared-types'
import { api } from '../lib/api'

// The tournament dashboard's "Game room" card (owner 2026-10-28): one per upcoming match, only for
// its players. Two states only — available (tap to open the details below) or locked 🔒 until staff
// open it. PUBG-style lobbies show Room ID / password / slot + "Open <game>"; a CS2-style match shows
// the server link + "Go to server". The server refuses anyone not on a verified team of the match
// (backend/src/tournaments/CLAUDE.md), and then the card isn't shown at all.
const POLL_MS = 30_000
// Server-side validated too; never follow anything but a Steam connect link or an https page.
const SAFE_LINK = /^(steam:\/\/connect\/|https:\/\/)/

function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (old browser / no permission): the value stays selectable.
    }
  }
  return (
    <div className="gr-box">
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
      <button type="button" onClick={() => void copy()} aria-label={`${label} — კოპირება`} title="კოპირება">
        {copied ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 5 5L20 7" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
          </svg>
        )}
      </button>
    </div>
  )
}

const PadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 8h10a5 5 0 0 1 4.6 7l-.8 1.8a2.4 2.4 0 0 1-4 .5L15 16H9l-1.8 1.3a2.4 2.4 0 0 1-4-.5L2.4 15A5 5 0 0 1 7 8Z" />
    <path d="M7 11v3M5.5 12.5h3M16 12h.01M18 13.5h.01" />
  </svg>
)

export default function GameRoomCard({ matchId }: { matchId: string }) {
  const [room, setRoom] = useState<MatchRoomView | null>(null)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () =>
      api
        .getMyMatchRoom(matchId)
        .then((r) => alive && setRoom(r))
        .catch(() => alive && setHidden(true))
    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [matchId])

  if (hidden || !room) return null
  const available = room.status === 'available' && !!room.room
  const server = available && room.room?.serverUrl && SAFE_LINK.test(room.room.serverUrl) ? room.room.serverUrl : null
  const launch = room.launchUrl && SAFE_LINK.test(room.launchUrl) ? room.launchUrl : null

  return (
    <section className={`wt-panel gr-card${available ? ' is-open' : ' is-locked'}`}>
      <button type="button" className="gr-head" aria-expanded={available && open} disabled={!available} onClick={() => setOpen((o) => !o)}>
        <span className="gr-icon">
          <PadIcon />
        </span>
        <strong>{server ? 'თამაშის სერვერი' : 'თამაშის ოთახი'}</strong>
        <em className={`gr-pill${available ? ' on' : ''}`}>{available ? 'ხელმისაწვდომია' : 'დაბლოკილია 🔒'}</em>
        {available && (
          <span className={`gr-chev${open ? ' up' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        )}
      </button>

      {!available ? (
        <div className="gr-locked">
          <span aria-hidden="true">🔒</span>
          <p>
            <strong>ოთახის ინფორმაცია ჯერ არ არის ხელმისაწვდომი</strong>
            <small>ორგანიზატორი გახსნის მატჩის დაწყებამდე. ამის შემდეგ აქ გამოჩნდება Room ID, პაროლი და თქვენი ადგილი.</small>
          </p>
        </div>
      ) : open ? (
        <div className="gr-body">
          {server ? (
            <>
              <p className="gr-lead">ამ მატჩის სერვერთან შესვლის ბმული.</p>
              <CopyBox label="სერვერის ბმული" value={server} />
              <a className="gr-launch" href={server}>
                სერვერზე გადასვლა <span aria-hidden="true">↗</span>
              </a>
              <p className="gr-note">დააკლიკეთ ბმულს ან დააკოპირეთ მისამართი და გახსენით Steam-ში.</p>
            </>
          ) : (
            <>
              <div className="gr-grid">
                {room.room?.roomId && <CopyBox label="Room ID" value={room.room.roomId} />}
                {room.room?.password && <CopyBox label="პაროლი" value={room.room.password} />}
                {room.room?.slot && <CopyBox label="თქვენი ადგილი" value={room.room.slot} />}
              </div>
              <p className="gr-note">მატჩის დაწყებამდე ოთახში შედით და დაიკავეთ თქვენი ადგილი.</p>
              {launch && (
                <a className="gr-launch" href={launch} target="_blank" rel="noopener noreferrer">
                  <PadIcon />
                  {`${room.gameName.toUpperCase()}-ის გახსნა`}
                  <span aria-hidden="true">›</span>
                </a>
              )}
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}
