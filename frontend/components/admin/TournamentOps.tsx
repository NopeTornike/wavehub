import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { MatchTeamStats, PublicTournamentMatch, PublicTournamentSummary, PublicTournamentTeam } from '@wavehub/shared-types'
import { TournamentMatchStage, TournamentMatchStatus, TournamentTeamStatus } from '@wavehub/shared-types'
import { api, errorMessage, type TournamentMatchInput } from '../../lib/api'
import { MATCH_STATUS_LABEL, STAGE_LABEL } from '../../lib/tournaments'

// Staff side of tournament teams and matches (backend admin/tournaments/:id/teams|matches): verify
// or reject registered teams, and record matches — stage, teams, map, best-of, time, status, score
// and per-player stats. Stats are typed one player per line:
//   name | kills | K/D | damage | rating | assists | mvp
// (empty cells stay empty; "mvp" / "*" in the last cell marks the MVP).

const TEAM_STATUS_LABEL: Record<TournamentTeamStatus, string> = {
  [TournamentTeamStatus.Pending]: 'მოლოდინში',
  [TournamentTeamStatus.Verified]: 'დადასტურებული',
  [TournamentTeamStatus.Rejected]: 'უარყოფილი',
}

type MatchForm = {
  stage: TournamentMatchStage
  groupName: string
  roundLabel: string
  teamAId: string
  teamBId: string
  map: string
  bestOf: number
  scheduledAt: string
  status: TournamentMatchStatus
  scoreA: string
  scoreB: string
  coachA: string
  coachB: string
  playersA: string
  playersB: string
}

const emptyMatch: MatchForm = {
  stage: TournamentMatchStage.Group,
  groupName: '',
  roundLabel: '',
  teamAId: '',
  teamBId: '',
  map: '',
  bestOf: 1,
  scheduledAt: '',
  status: TournamentMatchStatus.Scheduled,
  scoreA: '',
  scoreB: '',
  coachA: '',
  coachB: '',
  playersA: '',
  playersB: '',
}

const numOrNull = (value: string | undefined, int: boolean) => {
  const v = (value ?? '').trim()
  if (!v) return null
  const n = Number(v.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return int ? Math.round(n) : Math.round(n * 100) / 100
}

function parsePlayers(text: string, coach: string): MatchTeamStats | null {
  const players = text
    .split('\n')
    .map((line) => line.split('|').map((c) => c.trim()))
    .filter((cells) => cells[0])
    .slice(0, 10)
    .map(([name, kills, kd, damage, rating, assists, mvp]) => ({
      name: name.slice(0, 30),
      kills: numOrNull(kills, true),
      kd: numOrNull(kd, false),
      damage: numOrNull(damage, true),
      rating: numOrNull(rating, false),
      assists: numOrNull(assists, true),
      mvp: /^(mvp|\*|yes|1)$/i.test(mvp ?? ''),
    }))
  if (players.length === 0 && !coach.trim()) return null
  return { coach: coach.trim() || null, players }
}

function playersToText(stats: MatchTeamStats | null): string {
  return (stats?.players ?? [])
    .map((p) => [p.name, p.kills, p.kd, p.damage, p.rating, p.assists, p.mvp ? 'mvp' : ''].map((v) => (v === null || v === undefined ? '' : String(v))).join(' | ').replace(/( \| )+$/, ''))
    .join('\n')
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formFromMatch(m: PublicTournamentMatch): MatchForm {
  return {
    stage: m.stage,
    groupName: m.groupName ?? '',
    roundLabel: m.roundLabel ?? '',
    teamAId: m.teamA?.id ?? '',
    teamBId: m.teamB?.id ?? '',
    map: m.map ?? '',
    bestOf: m.bestOf,
    scheduledAt: toLocalInput(m.scheduledAt),
    status: m.status,
    scoreA: m.scoreA === null ? '' : String(m.scoreA),
    scoreB: m.scoreB === null ? '' : String(m.scoreB),
    coachA: m.stats.a?.coach ?? '',
    coachB: m.stats.b?.coach ?? '',
    playersA: playersToText(m.stats.a),
    playersB: playersToText(m.stats.b),
  }
}

function payload(form: MatchForm): TournamentMatchInput | string {
  if (form.teamAId && form.teamAId === form.teamBId) return 'გუნდი საკუთარ თავს ვერ ეთამაშება.'
  const scoreA = numOrNull(form.scoreA, true)
  const scoreB = numOrNull(form.scoreB, true)
  if ((scoreA !== null && (scoreA < 0 || scoreA > 99)) || (scoreB !== null && (scoreB < 0 || scoreB > 99))) return 'ანგარიში: 0–99.'
  return {
    stage: form.stage,
    groupName: form.groupName.trim() || null,
    roundLabel: form.roundLabel.trim() || null,
    teamAId: form.teamAId || null,
    teamBId: form.teamBId || null,
    map: form.map.trim() || null,
    bestOf: form.bestOf,
    scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
    status: form.status,
    scoreA,
    scoreB,
    stats: { a: parsePlayers(form.playersA, form.coachA), b: parsePlayers(form.playersB, form.coachB) },
  }
}

export default function TournamentOps({ tournament, onChanged }: { tournament: PublicTournamentSummary; onChanged: () => void }) {
  const [teams, setTeams] = useState<PublicTournamentTeam[]>([])
  const [matches, setMatches] = useState<PublicTournamentMatch[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<MatchForm>(emptyMatch)

  const load = useCallback(() => {
    Promise.all([api.adminListTournamentTeams(tournament.id), api.listTournamentMatches(tournament.id)])
      .then(([t, m]) => {
        setTeams(t)
        setMatches(m)
      })
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
  }, [tournament.id])

  useEffect(() => {
    load()
  }, [load])

  const setTeamStatus = async (team: PublicTournamentTeam, status: TournamentTeamStatus) => {
    setBusy(true)
    try {
      await api.adminSetTournamentTeamStatus(tournament.id, team.id, status)
      load()
      onChanged()
    } catch (err) {
      setError(errorMessage(err, 'სტატუსის შეცვლა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  const saveMatch = async (event: FormEvent) => {
    event.preventDefault()
    const body = payload(form)
    if (typeof body === 'string') return setError(body)
    setBusy(true)
    setError('')
    try {
      if (editing === 'new') await api.adminCreateTournamentMatch(tournament.id, body)
      else if (editing) await api.adminUpdateTournamentMatch(tournament.id, editing, body)
      setEditing(null)
      load()
    } catch (err) {
      setError(errorMessage(err, 'მატჩის შენახვა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  const deleteMatch = async (m: PublicTournamentMatch) => {
    if (!window.confirm('წავშალოთ მატჩი?')) return
    setBusy(true)
    try {
      await api.adminDeleteTournamentMatch(tournament.id, m.id)
      load()
    } catch (err) {
      setError(errorMessage(err, 'წაშლა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  const liveTeams = teams.filter((t) => t.status !== TournamentTeamStatus.Rejected)
  const teamOptions = (
    <>
      <option value="">TBD</option>
      {liveTeams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </>
  )

  return (
    <div className="stack-form" style={{ marginTop: 8 }}>
      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}

      <h2>გუნდები ({teams.length})</h2>
      {teams.length === 0 ? (
        <p className="note">ჯერ არავინ დარეგისტრირებულა.</p>
      ) : (
        <div className="order-list">
          {teams.map((team) => (
            <div key={team.id} className="admin-row">
              <div className="admin-row-main">
                <strong>
                  {team.name}
                  {team.tag ? ` [${team.tag}]` : ''} — {TEAM_STATUS_LABEL[team.status]}
                </strong>
                <span className="note" style={{ margin: 0 }}>
                  კაპიტანი @{team.captainUsername} · {team.members.join(', ')}
                  {team.coachName ? ` · ქოუჩი: ${team.coachName}` : ''}
                </span>
              </div>
              <div className="admin-row-actions">
                {team.status !== TournamentTeamStatus.Verified && (
                  <button type="button" className="button" disabled={busy} onClick={() => void setTeamStatus(team, TournamentTeamStatus.Verified)}>
                    დადასტურება
                  </button>
                )}
                {team.status !== TournamentTeamStatus.Rejected && (
                  <button type="button" className="button" disabled={busy} onClick={() => void setTeamStatus(team, TournamentTeamStatus.Rejected)}>
                    უარყოფა
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>მატჩები ({matches.length})</h2>
      {matches.map((m) =>
        editing === m.id ? null : (
          <div key={m.id} className="admin-row">
            <div className="admin-row-main">
              <strong>
                {m.teamA?.name ?? 'TBD'} vs {m.teamB?.name ?? 'TBD'} {m.scoreA !== null && m.scoreB !== null ? `(${m.scoreA}:${m.scoreB})` : ''}
              </strong>
              <span className="note" style={{ margin: 0 }}>
                {STAGE_LABEL[m.stage]}
                {m.groupName ? ` ${m.groupName}` : ''} · {MATCH_STATUS_LABEL[m.status]} · Bo{m.bestOf}
                {m.map ? ` · ${m.map}` : ''}
                {m.scheduledAt ? ` · ${new Date(m.scheduledAt).toLocaleString('ka-GE')}` : ''}
              </span>
            </div>
            <div className="admin-row-actions">
              <button
                type="button"
                className="button"
                onClick={() => {
                  setForm(formFromMatch(m))
                  setEditing(m.id)
                }}
              >
                რედაქტირება
              </button>
              <button type="button" className="button" disabled={busy} onClick={() => void deleteMatch(m)}>
                წაშლა
              </button>
            </div>
          </div>
        ),
      )}

      {editing ? (
        <form className="stack-form" onSubmit={saveMatch}>
          <h2>{editing === 'new' ? 'ახალი მატჩი' : 'მატჩის რედაქტირება'}</h2>
          <div className="stack-form-grid">
            <label className="field">
              ეტაპი
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as TournamentMatchStage })}>
                {Object.values(TournamentMatchStage).map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              ჯგუფი <small>მაგ. A (ჯგუფური ეტაპისთვის)</small>
              <input maxLength={10} value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} />
            </label>
            <label className="field">
              რაუნდის სახელი <small>მაგ. Round 1</small>
              <input maxLength={40} value={form.roundLabel} onChange={(e) => setForm({ ...form, roundLabel: e.target.value })} />
            </label>
            <label className="field">
              გუნდი A
              <select value={form.teamAId} onChange={(e) => setForm({ ...form, teamAId: e.target.value })}>
                {teamOptions}
              </select>
            </label>
            <label className="field">
              გუნდი B
              <select value={form.teamBId} onChange={(e) => setForm({ ...form, teamBId: e.target.value })}>
                {teamOptions}
              </select>
            </label>
            <label className="field">
              რუკა
              <input maxLength={40} value={form.map} onChange={(e) => setForm({ ...form, map: e.target.value })} />
            </label>
            <label className="field">
              Best of
              <input type="number" min={1} max={9} value={form.bestOf} onChange={(e) => setForm({ ...form, bestOf: Number(e.target.value) || 1 })} />
            </label>
            <label className="field">
              დრო
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            </label>
            <label className="field">
              სტატუსი
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TournamentMatchStatus })}>
                {Object.values(TournamentMatchStatus).map((s) => (
                  <option key={s} value={s}>
                    {MATCH_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              ანგარიში A
              <input inputMode="numeric" value={form.scoreA} onChange={(e) => setForm({ ...form, scoreA: e.target.value })} />
            </label>
            <label className="field">
              ანგარიში B
              <input inputMode="numeric" value={form.scoreB} onChange={(e) => setForm({ ...form, scoreB: e.target.value })} />
            </label>
          </div>
          <details className="field">
            <summary>მოთამაშეების სტატისტიკა (არასავალდებულო)</summary>
            <p className="note">თითო ხაზზე: სახელი | kills | K/D | damage | rating | assists | mvp</p>
            <div className="stack-form-grid">
              <label className="field">
                ქოუჩი A
                <input maxLength={30} value={form.coachA} onChange={(e) => setForm({ ...form, coachA: e.target.value })} />
              </label>
              <label className="field">
                ქოუჩი B
                <input maxLength={30} value={form.coachB} onChange={(e) => setForm({ ...form, coachB: e.target.value })} />
              </label>
              <label className="field">
                გუნდი A — მოთამაშეები
                <textarea rows={5} value={form.playersA} onChange={(e) => setForm({ ...form, playersA: e.target.value })} />
              </label>
              <label className="field">
                გუნდი B — მოთამაშეები
                <textarea rows={5} value={form.playersB} onChange={(e) => setForm({ ...form, playersB: e.target.value })} />
              </label>
            </div>
          </details>
          <div className="admin-row-actions">
            <button type="submit" className="button" disabled={busy}>
              {busy ? 'ინახება…' : 'შენახვა'}
            </button>
            <button type="button" className="button" onClick={() => setEditing(null)}>
              გაუქმება
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="button"
          onClick={() => {
            setForm(emptyMatch)
            setEditing('new')
          }}
        >
          + მატჩის დამატება
        </button>
      )}
    </div>
  )
}
