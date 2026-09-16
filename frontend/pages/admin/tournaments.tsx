import { useEffect, useRef, useState } from 'react'
import type { PublicGame, PublicTournamentSummary } from '@wavehub/shared-types'
import { TournamentStatus } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, ApiError } from '../../lib/api'

const STATUS_LABELS: Record<TournamentStatus, string> = {
  [TournamentStatus.Open]: 'რეგისტრაცია ღიაა',
  [TournamentStatus.Upcoming]: 'მოახლოებული',
  [TournamentStatus.Completed]: 'დასრულებული',
}

const emptyForm = {
  gameId: '',
  name: '',
  description: '',
  prize: '',
  status: TournamentStatus.Upcoming as TournamentStatus,
  startDate: '',
  maxPlayers: 64,
}

export default function AdminTournaments() {
  const [games, setGames] = useState<PublicGame[]>([])
  const [items, setItems] = useState<PublicTournamentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [savingEdit, setSavingEdit] = useState(false)

  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const [coverTargetId, setCoverTargetId] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    setError('')
    api
      .browseTournaments({ limit: 100 })
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([api.listGames(), api.browseTournaments({ limit: 100 })])
      .then(([g, t]) => {
        if (cancelled) return
        setGames(g)
        setItems(t.items)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const createTournament = async () => {
    setFormError('')
    if (!form.gameId) {
      setFormError('აირჩიეთ თამაში.')
      return
    }
    setCreating(true)
    try {
      await api.adminCreateTournament({
        gameId: form.gameId,
        name: form.name.trim(),
        description: form.description.trim(),
        prize: form.prize.trim(),
        status: form.status,
        startDate: form.startDate,
        maxPlayers: Number(form.maxPlayers),
      })
      setForm(emptyForm)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'შექმნა ვერ მოხერხდა.')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (t: PublicTournamentSummary) => {
    setEditingId(t.id)
    setEditForm({
      gameId: t.gameId,
      name: t.name,
      description: t.description,
      prize: t.prize,
      status: t.status,
      startDate: t.startDate.slice(0, 10),
      maxPlayers: t.maxPlayers,
    })
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSavingEdit(true)
    try {
      await api.adminUpdateTournament(editingId, {
        gameId: editForm.gameId,
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        prize: editForm.prize.trim(),
        status: editForm.status,
        startDate: editForm.startDate,
        maxPlayers: Number(editForm.maxPlayers),
      })
      setEditingId(null)
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'განახლება ვერ მოხერხდა.')
    } finally {
      setSavingEdit(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('წაშალოთ ეს ტურნირი?')) return
    setBusyId(id)
    try {
      await api.adminDeleteTournament(id)
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'წაშლა ვერ მოხერხდა.')
    } finally {
      setBusyId(null)
    }
  }

  const pickCover = (id: string) => {
    setCoverTargetId(id)
    coverInputRef.current?.click()
  }

  const onCoverChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !coverTargetId) return
    setBusyId(coverTargetId)
    try {
      await api.adminSetTournamentCover(coverTargetId, file)
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'სურათის ატვირთვა ვერ მოხერხდა.')
    } finally {
      setBusyId(null)
      setCoverTargetId(null)
    }
  }

  return (
    <AdminLayout>
      <h1 className="page-title">ტურნირები</h1>
      <p className="page-subtitle">ტურნირების შექმნა, რედაქტირება და მართვა</p>

      {error && <div className="status-text status-error">{error}</div>}

      <div className="admin-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', margin: 0 }}>ახალი ტურნირი</h2>
        {formError && <div className="status-text status-error">{formError}</div>}
        <select value={form.gameId} onChange={(e) => setForm({ ...form, gameId: e.target.value })}>
          <option value="">აირჩიეთ თამაში</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <input placeholder="სახელი" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <textarea
          placeholder="აღწერა"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
        />
        <input placeholder="პრიზი (მაგ. 5,000 WC)" value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value })} />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TournamentStatus })}>
          {Object.values(TournamentStatus).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <input
          type="number"
          min={2}
          placeholder="მაქს. მოთამაშეები"
          value={form.maxPlayers}
          onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) })}
        />
        <button type="button" className="button" disabled={creating} onClick={createTournament}>
          {creating ? 'იქმნება…' : 'ტურნირის შექმნა'}
        </button>
      </div>

      <input type="file" accept="image/*" ref={coverInputRef} style={{ display: 'none' }} onChange={onCoverChosen} />

      <h2 style={{ fontSize: '1rem' }}>ყველა ტურნირი</h2>
      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">ტურნირები არ არის.</div>
      ) : (
        <div className="order-list">
          {items.map((t) =>
            editingId === t.id ? (
              <div key={t.id} className="admin-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                <select value={editForm.gameId} onChange={(e) => setEditForm({ ...editForm, gameId: e.target.value })}>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
                <input value={editForm.prize} onChange={(e) => setEditForm({ ...editForm, prize: e.target.value })} />
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as TournamentStatus })}>
                  {Object.values(TournamentStatus).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <input type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
                <input
                  type="number"
                  min={2}
                  value={editForm.maxPlayers}
                  onChange={(e) => setEditForm({ ...editForm, maxPlayers: Number(e.target.value) })}
                />
                <div className="admin-row-actions">
                  <button type="button" className="button" disabled={savingEdit} onClick={saveEdit}>
                    {savingEdit ? 'ინახება…' : 'შენახვა'}
                  </button>
                  <button type="button" className="button" onClick={() => setEditingId(null)}>
                    გაუქმება
                  </button>
                </div>
              </div>
            ) : (
              <div key={t.id} className="admin-row">
                <div className="admin-row-main">
                  <strong>{t.name}</strong>
                  <span className="note" style={{ margin: 0 }}>
                    {t.gameName} · {STATUS_LABELS[t.status]} · {t.registeredCount}/{t.maxPlayers} · {t.prize} ·{' '}
                    {new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div className="admin-row-actions">
                  <button type="button" className="button" disabled={busyId === t.id} onClick={() => pickCover(t.id)}>
                    სურათი
                  </button>
                  <button type="button" className="button" disabled={busyId === t.id} onClick={() => startEdit(t)}>
                    რედაქტირება
                  </button>
                  <button type="button" className="button" disabled={busyId === t.id} onClick={() => remove(t.id)}>
                    წაშლა
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </AdminLayout>
  )
}
