import { useRef, useState } from 'react'
import type { MyTournamentEntry, PublicTournamentMatch } from '@wavehub/shared-types'
import { TournamentMatchStage, TournamentStatus, TournamentTeamStatus } from '@wavehub/shared-types'
import Avatar from '../Avatar'
import { api, errorMessage } from '../../lib/api'
import { groupStandings, matchWinner, mySide, TeamMark, TIcon } from '../../lib/tournaments'

// The hub's "my team" cards (owner 2026-11-10, docs/design-mockups/round-6/06 + 07). They replace the
// four stat tiles. Everything is computed from the matches staff recorded for this tournament.

export function MyTeamStatusCard({ entry, matches }: { entry: MyTournamentEntry; matches: PublicTournamentMatch[] }) {
  const { tournament, team } = entry
  const mine = new Set([team.id])
  const tables = groupStandings(matches, tournament.pointsPerWin, tournament.pointsPerLoss)
  const group = tables.find(([, rows]) => rows.some((r) => r.team.id === team.id))
  const groupRow = group?.[1].find((r) => r.team.id === team.id) ?? null
  const place = group ? group[1].findIndex((r) => r.team.id === team.id) + 1 : null

  // Wins / losses across every recorded match of this tournament; points from the group table.
  const played = matches.filter((m) => matchWinner(m) && mySide(m, mine))
  const wins = played.filter((m) => matchWinner(m) === mySide(m, mine)).length
  const losses = played.length - wins
  const points = groupRow?.points ?? wins * tournament.pointsPerWin + losses * tournament.pointsPerLoss
  const target = tournament.qualifyPoints
  const last = [...played].sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? ''))[0] ?? null
  const lastWon = last ? matchWinner(last) === mySide(last, mine) : false
  const lastWinner = last ? (matchWinner(last) === 'a' ? last.teamA : last.teamB) : null

  const state =
    tournament.status === TournamentStatus.Completed
      ? ['დასრულებული', 'done']
      : team.status === TournamentTeamStatus.Verified
        ? ['აქტიური', 'on']
        : team.status === TournamentTeamStatus.Rejected
          ? ['უარყოფილი', 'off']
          : ['მოლოდინში', 'wait']

  return (
    <section className="mt-card mt-status" aria-label="ჩემი გუნდი">
      <header className="mt-status-head">
        <TeamMark team={team} className="lg" />
        <span className="mt-status-name">
          <strong>ჩემი გუნდი</strong>
          <em>
            {team.name}
            {team.status === TournamentTeamStatus.Verified && <TIcon name="shieldCheck" className="mt-verified" />}
          </em>
        </span>
        <span className={`mt-state ${state[1]}`}>
          <i aria-hidden="true"></i>
          {state[0]}
        </span>
      </header>

      <div className="mt-tiles">
        <span>
          <TIcon name="trophy" className="pink" />
          <b>{points}</b>
          <small>ქულები</small>
        </span>
        <span>
          <TIcon name="checkCircle" className="green" />
          <b>{wins}</b>
          <small>მოგება</small>
        </span>
        <span>
          <TIcon name="xCircle" className="red" />
          <b>{losses}</b>
          <small>წაგება</small>
        </span>
      </div>

      {target !== null && target > 0 && (
        <div className="mt-goal">
          <p>
            <TIcon name="target" />
            <span>ჯგუფიდან გასვლის ზღვარი</span>
            <b>{target} ქულა</b>
          </p>
          <div className="mt-bar" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(points, target)}>
            <i style={{ width: `${Math.min(100, Math.round((points / target) * 100))}%` }}></i>
            <small>
              <b>{points}</b> / {target}
            </small>
          </div>
        </div>
      )}

      {last && (
        <div className={`mt-last ${lastWon ? 'won' : 'lost'}`}>
          <span className="mt-last-icon">
            <TIcon name={lastWon ? 'trophy' : 'xCircle'} />
          </span>
          <span>
            <strong>{lastWon ? 'გილოცავთ, თქვენ გაიმარჯვეთ!' : `წააგეთ — გამარჯვებული: ${lastWinner?.name ?? 'TBD'}`}</strong>
            <em>
              {last.teamA?.name ?? 'TBD'} <b>{last.scoreA}:{last.scoreB}</b> {last.teamB?.name ?? 'TBD'}
              {lastWon && last.stage === TournamentMatchStage.Group && tournament.pointsPerWin > 0 && <i>+{tournament.pointsPerWin} ქულა</i>}
            </em>
          </span>
        </div>
      )}

      <div className="mt-next">
        <span>
          <TIcon name="gamepad" />
          შემდეგი მოქმედება
        </span>
        <a className="mt-next-btn" href="#bracket">
          იხილეთ Bracket <TIcon name="chevron" />
        </a>
      </div>

      <footer className="mt-foot">
        <span className="mt-place">
          <span className="mt-place-icon">
            <TIcon name="bars" />
          </span>
          <span>
            <small>თქვენი ადგილი ჯგუფში:</small>
            <b>
              N: <em>{place ?? '—'}</em>
            </b>
          </span>
        </span>
        <span className="mt-note">
          <TIcon name="info" />
          <small>
            მოგება = {tournament.pointsPerWin} ქულა, წაგება = {tournament.pointsPerLoss} ქულა. ქულების სისტემა განისაზღვრება ტურნირის წესებით.
          </small>
        </span>
      </footer>
    </section>
  )
}

export function TeamMembersCard({ entry, myUsername, onTeamChange }: { entry: MyTournamentEntry; myUsername: string | undefined; onTeamChange: () => void }) {
  const { team, tournament } = entry
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const isCaptain = !!myUsername && team.captainUsername?.toLowerCase() === myUsername.toLowerCase()
  // Older squads linked only the captain; their other players are in-game names.
  const linkedNames = new Set(team.players.map((p) => p.inGameName))
  const nameOnly = team.members.filter((name) => !linkedNames.has(name))

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setNote('')
    try {
      await api.uploadMyTeamLogo(tournament.id, file)
      setNote('ლოგო განახლდა.')
      onTeamChange()
    } catch (err) {
      setNote(errorMessage(err, 'ლოგოს ატვირთვა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section className="mt-card mt-members" aria-label="გუნდის წევრები">
      <header className="mt-members-head">
        <span className="mt-members-icon">
          <TIcon name="users" />
        </span>
        <h2>
          ჩემი გუნდი: <em>{team.name}</em>
        </h2>
        {isCaptain && (
          <>
            <button type="button" className="mt-edit" onClick={() => fileRef.current?.click()} disabled={busy}>
              <TIcon name="edit" /> {busy ? 'იტვირთება…' : 'გუნდის რედაქტირება'}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </>
        )}
      </header>
      {isCaptain && <p className="mt-edit-hint">{note || 'კაპიტანს შეუძლია გუნდის ლოგოს შეცვლა (PNG / JPG, 2MB-მდე).'}</p>}
      <div className="mt-roster">
        {team.players.map((p) => (
          <a key={p.username} className="mt-player" href={`/u/${p.username}`}>
            <span className="mt-ava">
              <Avatar name={p.inGameName || p.username} src={p.avatarUrl} size={72} ring={false} />
              {p.isCaptain && (
                <span className="mt-crown" title="კაპიტანი">
                  <TIcon name="crown" />
                </span>
              )}
            </span>
            <strong>{p.inGameName || p.username}</strong>
            <small>@{p.username}</small>
          </a>
        ))}
        {nameOnly.map((name) => (
          <span key={name} className="mt-player">
            <span className="mt-ava">
              <Avatar name={name} src={null} size={72} ring={false} />
            </span>
            <strong>{name}</strong>
            <small>—</small>
          </span>
        ))}
      </div>
    </section>
  )
}
