import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { PublicGame, TournamentLeaderboardEntry } from '@wavehub/shared-types'
import AdminLayout from '../../../components/AdminLayout'
import Avatar from '../../../components/Avatar'
import { api, errorMessage } from '../../../lib/api'

// Admin → Tournaments → Leaderboard (owner 2026-11-10, round-6/10): staff type the numbers — players
// as @username, teams by name with an optional logo — and switch the public block on / off. The
// public page shows the top 3 players and top 5 teams by points (then wins, kills).

type Draft = { kind: 'player' | 'team'; gameId: string; name: string; wins: string; kills: string; points: string }
const EMPTY: Draft = { kind: 'player', gameId: '', name: '', wins: '0', kills: '0', points: '0' }

const toDraft = (e: TournamentLeaderboardEntry): Draft => ({
  kind: e.kind,
  gameId: e.gameId ?? '',
  name: e.kind === 'player' && e.username ? `@${e.username}` : e.name,
  wins: String(e.wins),
  kills: String(e.kills),
  points: String(e.points),
})

function payload(d: Draft) {
  const n = (v: string) => Math.max(0, Math.floor(Number(v) || 0))
  return { kind: d.kind, gameId: d.gameId || null, name: d.name.trim(), wins: n(d.wins), kills: n(d.kills), points: n(d.points) }
}

function EntryFields({ draft, games, onChange }: { draft: Draft; games: PublicGame[]; onChange: (d: Draft) => void }) {
  return (
    <div className="stack-form-grid">
      <label className="field">
        ტიპი
        <select value={draft.kind} onChange={(e) => onChange({ ...draft, kind: e.target.value as Draft['kind'] })}>
          <option value="player">მოთამაშე</option>
          <option value="team">გუნდი</option>
        </select>
      </label>
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
        მოგებები (Wins)
        <input inputMode="numeric" value={draft.wins} onChange={(e) => onChange({ ...draft, wins: e.target.value.replace(/\D/g, '') })} />
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
      await api.adminSaveLeaderboardEntry(payload(draft))
      setDraft({ ...EMPTY, kind: draft.kind, gameId: draft.gameId })
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
                <strong>{e.kind === 'player' && e.username ? `@${e.username}` : e.name}</strong>
                <span className="note" style={{ margin: 0 }}>
                  {e.gameName ?? 'ყველა თამაში'} · 🏆 {e.wins} · 🎯 {e.kills} · 📊 {e.points}
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
      <p className="page-subtitle">ხელით შეყვანილი შედეგები — /tournaments გვერდზე ჩანს Top 3 მოთამაშე და Top 5 გუნდი ქულების მიხედვით.</p>

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

      <form className="stack-form" onSubmit={add}>
        <h2>ჩანაწერის დამატება</h2>
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
          {list(players, 'მოთამაშეები')}
          {list(teams, 'გუნდები')}
        </>
      )}
    </AdminLayout>
  )
}
