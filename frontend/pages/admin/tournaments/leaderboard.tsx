import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { PublicGame, TournamentLeaderboardEntry } from '@wavehub/shared-types'
import AdminLayout from '../../../components/AdminLayout'
import Avatar from '../../../components/Avatar'
import { api, errorMessage } from '../../../lib/api'
import { COUNTRIES, countryLabel, flagEmoji } from '../../../lib/countries'

// Admin → Tournaments → Leaderboard (owner 2026-11-10, round-6/10): staff type the numbers — players
// as @username, teams by name with an optional logo — and switch the public block on / off. The
// public page shows the top 3 players and top 5 teams by points (then wins, kills).
// 2026-11-19: players and teams are managed on separate tabs, and each row has what the Tournament
// Ranking page (/tournaments/ranking, Top 10) shows: nickname, country, W-L-D record.

type Kind = 'player' | 'team'
type Draft = { kind: Kind; gameId: string; name: string; nickname: string; country: string; wins: string; losses: string; draws: string; kills: string; points: string }
const EMPTY: Draft = { kind: 'player', gameId: '', name: '', nickname: '', country: '', wins: '0', losses: '0', draws: '0', kills: '0', points: '0' }

const toDraft = (e: TournamentLeaderboardEntry): Draft => ({
  kind: e.kind,
  gameId: e.gameId ?? '',
  name: e.kind === 'player' && e.username ? `@${e.username}` : e.name,
  nickname: e.nickname ?? '',
  country: e.country ?? '',
  wins: String(e.wins),
  losses: String(e.losses),
  draws: String(e.draws),
  kills: String(e.kills),
  points: String(e.points),
})

function payload(d: Draft) {
  const n = (v: string) => Math.max(0, Math.floor(Number(v) || 0))
  return {
    kind: d.kind,
    gameId: d.gameId || null,
    name: d.name.trim(),
    nickname: d.nickname.trim() || null,
    country: d.country || null,
    wins: n(d.wins),
    losses: n(d.losses),
    draws: n(d.draws),
    kills: n(d.kills),
    points: n(d.points),
  }
}

function EntryFields({ draft, games, onChange }: { draft: Draft; games: PublicGame[]; onChange: (d: Draft) => void }) {
  return (
    <div className="stack-form-grid">
      <label className="field">
        თამაში
        <select value={draft.gameId} onChange={(e) => onChange({ ...draft, gameId: e.target.value })}>
          <option value="">ყველა / არ არის მითითებული</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {draft.kind === 'player' ? '@username' : 'გუნდის სახელი'}
        <input maxLength={40} value={draft.name} placeholder={draft.kind === 'player' ? '@nikapro' : 'Titan Esports'} onChange={(e) => onChange({ ...draft, name: e.target.value })} required />
      </label>
      <label className="field">
        მეტსახელი (არასავალდებულო)
        <input maxLength={40} value={draft.nickname} placeholder="The Tiger" onChange={(e) => onChange({ ...draft, nickname: e.target.value })} />
      </label>
      <label className="field">
        ქვეყანა
        <select value={draft.country} onChange={(e) => onChange({ ...draft, country: e.target.value })}>
          <option value="">— არ არის მითითებული</option>
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {flagEmoji(code)} {name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        მოგებები (Wins)
        <input inputMode="numeric" value={draft.wins} onChange={(e) => onChange({ ...draft, wins: e.target.value.replace(/\D/g, '') })} />
      </label>
      <label className="field">
        წაგებები (Losses)
        <input inputMode="numeric" value={draft.losses} onChange={(e) => onChange({ ...draft, losses: e.target.value.replace(/\D/g, '') })} />
      </label>
      <label className="field">
        ფრეები (Draws)
        <input inputMode="numeric" value={draft.draws} onChange={(e) => onChange({ ...draft, draws: e.target.value.replace(/\D/g, '') })} />
      </label>
      <label className="field">
        მკვლელობები (Kills)
        <input inputMode="numeric" value={draft.kills} onChange={(e) => onChange({ ...draft, kills: e.target.value.replace(/\D/g, '') })} />
      </label>
      <label className="field">
        ქულები (Points)
        <input inputMode="numeric" value={draft.points} onChange={(e) => onChange({ ...draft, points: e.target.value.replace(/\D/g, '') })} />
      </label>
    </div>
  )
}

export default function AdminTournamentLeaderboard() {
  const [games, setGames] = useState<PublicGame[]>([])
  const [entries, setEntries] = useState<TournamentLeaderboardEntry[] | null>(null)
  const [visible, setVisible] = useState(true)
  const [tab, setTab] = useState<Kind>('player')
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [logoFor, setLogoFor] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .adminListLeaderboard()
      .then((res) => {
        setEntries(res.entries)
        setVisible(res.visible)
      })
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
  }, [])

  useEffect(() => {
    load()
    api
      .listGames()
      .then(setGames)
      .catch(() => undefined)
  }, [load])

  const run = async (label: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    setError('')
    setNote('')
    try {
      await fn()
      if (done) setNote(done)
      load()
    } catch (err) {
      setError(errorMessage(err, label))
    } finally {
      setBusy(false)
    }
  }

  const add = (event: FormEvent) => {
    event.preventDefault()
    void run('დამატება ვერ მოხერხდა.', async () => {
      await api.adminSaveLeaderboardEntry(payload({ ...draft, kind: tab }))
      setDraft({ ...EMPTY, kind: tab, gameId: draft.gameId })
    }, 'დაემატა ✓')
  }

  const saveEdit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    void run('შენახვა ვერ მოხერხდა.', async () => {
      await api.adminSaveLeaderboardEntry(payload(editDraft), editing)
      setEditing(null)
    }, 'შენახულია ✓')
  }

  const players = (entries ?? []).filter((e) => e.kind === 'player')
  const teams = (entries ?? []).filter((e) => e.kind === 'team')

  const list = (rows: TournamentLeaderboardEntry[], title: string) => (
    <section className="lb-admin-list">
      <h2>
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="note">ჯერ ცარიელია.</p>
      ) : (
        rows.map((e, i) =>
          editing === e.id ? (
            <form key={e.id} className="stack-form lb-admin-edit" onSubmit={saveEdit}>
              <EntryFields draft={editDraft} games={games} onChange={setEditDraft} />
              <div className="admin-row-actions">
                <button type="submit" className="button" disabled={busy}>
                  შენახვა
                </button>
                <button type="button" className="button" onClick={() => setEditing(null)}>
                  გაუქმება
                </button>
              </div>
            </form>
          ) : (
            <div key={e.id} className="admin-row lb-admin-row">
              <span className="lb-admin-rank">{i + 1}</span>
              <Avatar name={e.name} src={e.imageUrl} size={40} ring={false} />
              <div className="admin-row-main">
                <strong>
                  {e.kind === 'player' && e.username ? `@${e.username}` : e.name}
                  {e.nickname && <em className="lb-admin-nick"> “{e.nickname}”</em>}
                </strong>
                <span className="note" style={{ margin: 0 }}>
                  {e.country ? `${flagEmoji(e.country)} ${countryLabel(e.country)} · ` : ''}
                  {e.gameName ?? 'ყველა თამაში'} · W-L-D {e.wins}-{e.losses}-{e.draws} · Kills {e.kills} · Pts {e.points}
                </span>
              </div>
              <div className="admin-row-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setEditing(e.id)
                    setEditDraft(toDraft(e))
                  }}
                >
                  რედაქტირება
                </button>
                {e.kind === 'team' && (
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => {
                      setLogoFor(e.id)
                      fileRef.current?.click()
                    }}
                  >
                    ლოგო
                  </button>
                )}
                <button
                  type="button"
                  className="button danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('წავშალოთ ჩანაწერი?')) void run('წაშლა ვერ მოხერხდა.', () => api.adminDeleteLeaderboardEntry(e.id), 'წაიშალა')
                  }}
                >
                  წაშლა
                </button>
              </div>
            </div>
          ),
        )
      )}
    </section>
  )

  return (
    <AdminLayout title="ლიდერბორდი">
      <p className="lb-admin-back">
        <Link href="/admin/tournaments">‹ ტურნირები</Link>
      </p>
      <h1 className="page-title">ტურნირების ლიდერბორდი</h1>
      <p className="page-subtitle">
        ხელით შეყვანილი შედეგები, ქულების მიხედვით. /tournaments გვერდზე ჩანს Top 3 მოთამაშე და Top 5 გუნდი, <Link href="/tournaments/ranking">Tournament Ranking</Link> გვერდზე — Top 10 ცალ-ცალკე.
      </p>

      <div className={`lb-admin-switch ${visible ? 'on' : ''}`}>
        <span>
          <strong>{visible ? 'ჩანს საიტზე' : 'დამალულია'}</strong>
          <small>{visible ? 'ლიდერბორდი ჩანს ტურნირების გვერდზე.' : 'ტურნირების გვერდზე ლიდერბორდი არ ჩანს.'}</small>
        </span>
        <button type="button" className="button" disabled={busy || entries === null} onClick={() => void run('ვერ შეიცვალა.', () => api.adminSetLeaderboardVisible(!visible))}>
          {visible ? 'დამალვა' : 'ჩვენება'}
        </button>
      </div>

      {error && (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      )}
      {note && <p className="status-text">{note}</p>}

      <div className="lb-admin-tabs" role="tablist" aria-label="ლიდერბორდი">
        {(['player', 'team'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? 'active' : undefined}
            onClick={() => {
              setTab(k)
              setEditing(null)
              setDraft({ ...EMPTY, kind: k, gameId: draft.gameId })
            }}
          >
            {k === 'player' ? `მოთამაშეები (${players.length})` : `გუნდები (${teams.length})`}
          </button>
        ))}
      </div>

      <form className="stack-form" onSubmit={add}>
        <h2>{tab === 'player' ? 'მოთამაშის დამატება' : 'გუნდის დამატება'}</h2>
        <EntryFields draft={draft} games={games} onChange={setDraft} />
        <div className="admin-row-actions">
          <button type="submit" className="button" disabled={busy || !draft.name.trim()}>
            {busy ? 'ინახება…' : 'დამატება'}
          </button>
        </div>
      </form>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          const id = logoFor
          e.target.value = ''
          if (file && id) void run('ლოგოს ატვირთვა ვერ მოხერხდა.', () => api.adminUploadLeaderboardLogo(id, file), 'ლოგო განახლდა ✓')
        }}
      />

      {entries === null ? (
        <p className="empty-state">იტვირთება…</p>
      ) : (
        <>
          {tab === 'player' ? list(players, 'მოთამაშეები') : list(teams, 'გუნდები')}
        </>
      )}
    </AdminLayout>
  )
}
