import { useState } from 'react'
import type { AdminTournamentMatch, MatchTeamResult, PublicTournamentSummary, PublicTournamentTeam } from '@wavehub/shared-types'
import { brBracket, brMatchPoints, brMatchTeams, TournamentMatchStage, TournamentMatchStatus, TournamentTeamStatus } from '@wavehub/shared-types'
import { api, errorMessage } from '../../lib/api'

// Staff tools for battle-royale tournaments (owner 2026-11-14, Gio; PUBG): teams go into groups
// (A, B, …), each group plays its own lobby matches, results are typed as place + kills per team
// (points = placement table + 1 per kill, computed by the server), the top N of each group play the
// semifinal and the top N of the semifinal play the final. backend/src/tournaments/CLAUDE.md.

const GROUP_NAMES = 'ABCDEFGH'.split('')

export function TeamGroupSelect({ tournamentId, team, onSaved }: { tournamentId: string; team: PublicTournamentTeam; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <label className="to-group-select">
      ჯგუფი
      <select
        value={team.groupName ?? ''}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true)
          setError('')
          try {
            await api.adminSetTournamentTeamGroup(tournamentId, team.id, e.target.value || null)
            onSaved()
          } catch (err) {
            setError(errorMessage(err, 'ვერ შეინახა.'))
          } finally {
            setBusy(false)
          }
        }}
      >
        <option value="">—</option>
        {GROUP_NAMES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      {error && <small className="status-error">{error}</small>}
    </label>
  )
}

// Auto groups + lobby-match generator.
export function BrPanel({ tournament, teams, matches, onDone }: { tournament: PublicTournamentSummary; teams: PublicTournamentTeam[]; matches: AdminTournamentMatch[]; onDone: () => void }) {
  const verified = teams.filter((t) => t.status === TournamentTeamStatus.Verified)
  const groupsInUse = [...new Set(teams.map((t) => t.groupName).filter((g): g is string => !!g))].sort()
  const [groups, setGroups] = useState(Math.max(1, groupsInUse.length || Math.ceil(verified.length / 5) || 1))
  const [reset, setReset] = useState(false)
  const [stage, setStage] = useState<TournamentMatchStage>(TournamentMatchStage.Group)
  const [group, setGroup] = useState<string>('all')
  const [count, setCount] = useState(3)
  const [startAt, setStartAt] = useState('')
  const [gap, setGap] = useState(30)
  const [map, setMap] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const autoGroups = async () => {
    if (!window.confirm(reset ? `ყველა დადასტურებული გუნდი თავიდან გადანაწილდეს ${groups} ჯგუფში?` : `ჯგუფის გარეშე დარჩენილი გუნდები გადანაწილდეს ${groups} ჯგუფში?`)) return
    setBusy(true)
    setNote('')
    try {
      const res = await api.adminTournamentAutoGroups(tournament.id, groups, reset)
      setNote(`გადანაწილდა ${res.assigned} გუნდი ✓`)
      onDone()
    } catch (err) {
      setNote(errorMessage(err, 'გადანაწილება ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  const generate = async () => {
    if (!startAt) return setNote('მიუთითე პირველი მატჩის დრო.')
    const targets = stage !== TournamentMatchStage.Group ? [null] : group === 'all' ? groupsInUse : [group]
    if (stage === TournamentMatchStage.Group && targets.length === 0) return setNote('ჯერ გაანაწილე გუნდები ჯგუფებში.')
    setBusy(true)
    setNote('')
    try {
      let created = 0
      for (const g of targets) {
        const res = await api.adminTournamentBrMatches(tournament.id, { stage, groupName: g, count, startAt: new Date(startAt).toISOString(), intervalMinutes: gap, map: map.trim() || null })
        created += res.created
      }
      setNote(`შეიქმნა ${created} მატჩი ✓`)
      onDone()
    } catch (err) {
      setNote(errorMessage(err, 'შედგენა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  const perGroup = groupsInUse.map((g) => `${g}: ${teams.filter((t) => t.groupName === g).length}`).join(' · ')
  const groupMatches = matches.filter((m) => m.stage === TournamentMatchStage.Group).length

  return (
    <details className="field to-rr" open={groupMatches === 0}>
      <summary>⚡ Battle Royale — ჯგუფები და მატჩები</summary>
      <p className="note">
        ფორმატი: ჯგუფიდან Top {tournament.groupAdvance} → ნახევარფინალი, ნახევარფინალიდან Top {tournament.semifinalAdvance} → ფინალი. ქულა = ადგილი (1-ლი 10, მე-2 6, მე-3 5, მე-4 4, მე-5 3, მე-6 2, მე-7–8 1) + 1 ყოველ Kill-ზე.
      </p>
      <h3 className="to-sub">1. ჯგუფები {perGroup && <small>({perGroup})</small>}</h3>
      <div className="stack-form-grid">
        <label className="field">
          ჯგუფების რაოდენობა
          <input type="number" min={1} max={8} value={groups} onChange={(e) => setGroups(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} />
        </label>
        <label className="field to-check">
          <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} /> ყველა თავიდან გადანაწილდეს
        </label>
      </div>
      <div className="admin-row-actions">
        <button type="button" className="button" disabled={busy || verified.length === 0} onClick={() => void autoGroups()}>
          ავტომატური გადანაწილება ({verified.length} გუნდი)
        </button>
      </div>
      <p className="note">ან აირჩიე ჯგუფი თითო გუნდს ქვემოთ, გუნდების სიაში.</p>

      <h3 className="to-sub">2. მატჩების შედგენა</h3>
      <div className="stack-form-grid">
        <label className="field">
          ეტაპი
          <select value={stage} onChange={(e) => setStage(e.target.value as TournamentMatchStage)}>
            <option value={TournamentMatchStage.Group}>ჯგუფური ეტაპი</option>
            <option value={TournamentMatchStage.SemiFinal}>ნახევარფინალი</option>
            <option value={TournamentMatchStage.Final}>ფინალი</option>
          </select>
        </label>
        {stage === TournamentMatchStage.Group && (
          <label className="field">
            ჯგუფი
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="all">ყველა ჯგუფი ({groupsInUse.length})</option>
              {groupsInUse.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          მატჩების რაოდენობა
          <input type="number" min={1} max={12} value={count} onChange={(e) => setCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} />
        </label>
        <label className="field">
          პირველი მატჩის დრო
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </label>
        <label className="field">
          შუალედი (წუთი)
          <input type="number" min={0} max={1440} value={gap} onChange={(e) => setGap(Math.max(0, Math.min(1440, Number(e.target.value) || 0)))} />
        </label>
        <label className="field">
          რუკა
          <input maxLength={40} value={map} onChange={(e) => setMap(e.target.value)} placeholder="მაგ. Erangel" />
        </label>
      </div>
      <div className="admin-row-actions">
        <button type="button" className="button" disabled={busy} onClick={() => void generate()}>
          {busy ? 'იქმნება…' : 'მატჩების შედგენა'}
        </button>
      </div>
      {note && <p className="note">{note}</p>}
    </details>
  )
}

// One battle-royale match's results: place + kills for every team in it.
// Per-player lines of one team (owner 2026-11-19, Match Results page): one player per line,
// "name | kills | damage | assists | survival mm:ss" — @username links the account; only the name
// and kills are required.
type PlayerLine = { name: string; kills: number; damage: number | null; assists: number | null; survival: number | null }

function secondsText(s: number | null): string {
  return s === null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function playersToText(players: MatchTeamResult['players']): string {
  return players
    .map((p) => [p.userId && p.username ? `@${p.username}` : p.name, p.kills, p.damage ?? '', p.assists ?? '', secondsText(p.survival)].join(' | ').replace(/( \| )+$/, ''))
    .join('\n')
}

export function parsePlayers(text: string): { players: PlayerLine[]; error: string | null } {
  const players: PlayerLine[] = []
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const [i, line] of lines.entries()) {
    const [name = '', kills = '', damage = '', assists = '', survival = ''] = line.split('|').map((x) => x.trim())
    const num = (v: string, max: number) => (v === '' ? null : /^\d+$/.test(v) && Number(v) <= max ? Number(v) : NaN)
    const k = num(kills, 99)
    const d = num(damage.replace(/[,\s]/g, ''), 100000)
    const a = num(assists, 99)
    const m = survival === '' ? null : /^(\d{1,3}):([0-5]\d)$/.exec(survival)
    const sv = survival === '' ? null : m ? Number(m[1]) * 60 + Number(m[2]) : NaN
    if (!name || name.length > 40) return { players, error: `ხაზი ${i + 1}: მოთამაშის სახელი (1–40 სიმბოლო).` }
    if (k === null || Number.isNaN(k)) return { players, error: `ხაზი ${i + 1}: Kills — რიცხვი 0–99.` }
    if (Number.isNaN(d) || Number.isNaN(a)) return { players, error: `ხაზი ${i + 1}: Damage / Assists — მხოლოდ რიცხვი.` }
    if (Number.isNaN(sv) || (sv !== null && sv > 7200)) return { players, error: `ხაზი ${i + 1}: Survival — წთ:წმ, მაგ. 27:42.` }
    players.push({ name, kills: k, damage: d, assists: a, survival: sv })
  }
  if (players.length > 8) return { players, error: 'მაქსიმუმ 8 მოთამაშე გუნდში.' }
  return { players, error: null }
}

export function BrResultsEditor({
  tournament,
  match,
  matches,
  teams,
  onSaved,
}: {
  tournament: PublicTournamentSummary
  match: AdminTournamentMatch
  matches: AdminTournamentMatch[]
  teams: PublicTournamentTeam[]
  onSaved: () => void
}) {
  const live = teams.filter((t) => t.status !== TournamentTeamStatus.Rejected)
  const bracket = brBracket(matches, live, { groupAdvance: tournament.groupAdvance, semifinalAdvance: tournament.semifinalAdvance })
  const playing = brMatchTeams(match, bracket, live)
  const initial = new Map(match.results.map((r) => [r.team.id, r]))
  const [rows, setRows] = useState(() =>
    (playing.length ? playing : live.map((t) => t.id)).map((id) => ({
      teamId: id,
      on: playing.includes(id),
      placement: initial.get(id)?.placement ? String(initial.get(id)!.placement) : '',
      kills: initial.has(id) ? String(initial.get(id)!.kills) : '',
      players: playersToText(initial.get(id)?.players ?? []),
      showPlayers: false,
    })),
  )
  const [complete, setComplete] = useState(match.status !== TournamentMatchStatus.Completed)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const name = (id: string) => live.find((t) => t.id === id)?.name ?? match.results.find((r) => r.team.id === id)?.team.name ?? id
  const extra = live.filter((t) => !rows.some((r) => r.teamId === t.id))

  const teamOf = (id: string) => live.find((t) => t.id === id) ?? null
  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  // Typing player lines keeps the team's kills = their sum (still editable afterwards).
  const setPlayers = (i: number, text: string) => {
    const parsed = parsePlayers(text)
    const sum = parsed.players.reduce((n, p) => n + p.kills, 0)
    setRow(i, parsed.players.length && !parsed.error ? { players: text, kills: String(sum) } : { players: text })
  }

  const save = async () => {
    const active = rows.filter((r) => r.on)
    for (const r of active) {
      const { error } = parsePlayers(r.players)
      if (error) return setNote(`${name(r.teamId)} — ${error}`)
    }
    const lines = active.map((r) => ({
      teamId: r.teamId,
      placement: r.placement ? Number(r.placement) : null,
      kills: r.kills ? Number(r.kills) : 0,
      players: parsePlayers(r.players).players,
    }))
    const places = lines.map((l) => l.placement).filter((p): p is number => p !== null)
    if (new Set(places).size !== places.length) return setNote('ორ გუნდს ერთი და იგივე ადგილი აქვს.')
    setBusy(true)
    setNote('')
    try {
      await api.adminSetTournamentMatchResults(tournament.id, match.id, { results: lines, complete })
      setNote('შენახულია ✓')
      onSaved()
    } catch (err) {
      setNote(errorMessage(err, 'შენახვა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="to-br-results">
      <div className="to-br-head">
        <span>გუნდი</span>
        <span>ადგილი</span>
        <span>Kills</span>
        <span>ქულა</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.teamId} className={`to-br-row${r.on ? '' : ' off'}`}>
          <label>
            <input type="checkbox" checked={r.on} onChange={(e) => setRows((list) => list.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
            {name(r.teamId)}
          </label>
          <input
            inputMode="numeric"
            aria-label={`${name(r.teamId)} — ადგილი`}
            value={r.placement}
            disabled={!r.on}
            onChange={(e) => setRows((list) => list.map((x, j) => (j === i ? { ...x, placement: e.target.value.replace(/\D/g, '').slice(0, 3) } : x)))}
          />
          <input
            inputMode="numeric"
            aria-label={`${name(r.teamId)} — kills`}
            value={r.kills}
            disabled={!r.on}
            onChange={(e) => setRows((list) => list.map((x, j) => (j === i ? { ...x, kills: e.target.value.replace(/\D/g, '').slice(0, 3) } : x)))}
          />
          <b>{r.on ? brMatchPoints(r.placement ? Number(r.placement) : null, r.kills ? Number(r.kills) : 0) : '—'}</b>
          {r.on && (
            <button type="button" className="to-br-players-toggle" aria-expanded={r.showPlayers} onClick={() => setRow(i, { showPlayers: !r.showPlayers })}>
              მოთამაშეები{r.players.trim() ? ` (${r.players.split('\n').filter((l) => l.trim()).length})` : ''} {r.showPlayers ? '▴' : '▾'}
            </button>
          )}
          {r.on && r.showPlayers && (
            <div className="to-br-players">
              <small>ერთი მოთამაშე ერთ ხაზზე: სახელი | Kills | Damage | Assists | Survival (წთ:წმ). @username აკავშირებს ანგარიშს.</small>
              {(teamOf(r.teamId)?.players ?? []).length > 0 && (
                <span className="to-br-chips">
                  {teamOf(r.teamId)!.players.map((p) => (
                    <button
                      key={p.username + p.inGameName}
                      type="button"
                      className="to-chip"
                      onClick={() => setPlayers(i, `${r.players.trim() ? `${r.players.trim()}\n` : ''}@${p.username} | 0`)}
                    >
                      + @{p.username}
                    </button>
                  ))}
                </span>
              )}
              <textarea rows={4} value={r.players} placeholder={'@AlphaGio | 9 | 4623 | 3 | 27:42\nAlphaNika | 6 | 3218 | 2 | 27:10'} aria-label={`${name(r.teamId)} — მოთამაშეები`} onChange={(e) => setPlayers(i, e.target.value)} />
              {parsePlayers(r.players).error && <em className="to-br-error">{parsePlayers(r.players).error}</em>}
            </div>
          )}
        </div>
      ))}
      {extra.length > 0 && (
        <label className="field to-br-add">
          გუნდის დამატება
          <select
            value=""
            onChange={(e) => {
              const id = e.target.value
              if (id) setRows((list) => [...list, { teamId: id, on: true, placement: '', kills: '', players: '', showPlayers: false }])
            }}
          >
            <option value="">—</option>
            {extra.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.groupName ? ` (${t.groupName})` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="to-check">
        <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} /> მატჩი დასრულებულია
      </label>
      <div className="admin-row-actions">
        <button type="button" className="button" disabled={busy} onClick={() => void save()}>
          {busy ? 'ინახება…' : 'შედეგების შენახვა'}
        </button>
        {note && <small>{note}</small>}
      </div>
    </div>
  )
}
