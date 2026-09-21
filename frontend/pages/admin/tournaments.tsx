import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { PublicGame, PublicTournamentSummary } from '@wavehub/shared-types'
import { TournamentStatus } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'

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

type TournamentForm = typeof emptyForm

// Mirrors backend/src/tournaments/dto (Create/UpdateTournamentDto) so the admin sees a Georgian
// hint before the round-trip instead of a raw class-validator message. Returns '' when valid.
function validate(form: TournamentForm): string {
  if (!form.gameId) return 'აირჩიეთ თამაში.'
  const name = form.name.trim()
  if (name.length < 3 || name.length > 70) return 'სახელი უნდა იყოს 3–70 სიმბოლო.'
  const description = form.description.trim()
  if (description.length < 10 || description.length > 3000) return 'აღწერა უნდა იყოს 10–3000 სიმბოლო.'
  const prize = form.prize.trim()
  if (prize.length < 1 || prize.length > 60) return 'პრიზი უნდა იყოს 1–60 სიმბოლო.'
  if (!form.startDate) return 'მიუთითეთ დაწყების თარიღი.'
  if (!Number.isInteger(form.maxPlayers) || form.maxPlayers < 2) return 'მოთამაშეების მაქსიმუმი უნდა იყოს მთელი რიცხვი, მინიმუმ 2.'
  return ''
}

function TournamentFields({
  idPrefix,
  form,
  games,
  onChange,
}: {
  idPrefix: string
  form: TournamentForm
  games: PublicGame[]
  onChange: (next: TournamentForm) => void
}) {
  return (
    <>
      <div className="stack-form-grid">
        <label className="field" htmlFor={`${idPrefix}-game`}>
          თამაში
          <select id={`${idPrefix}-game`} value={form.gameId} onChange={(e) => onChange({ ...form, gameId: e.target.value })} required>
            <option value="">აირჩიეთ თამაში</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor={`${idPrefix}-name`}>
          სახელი
          <input id={`${idPrefix}-name`} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} required />
        </label>
      </div>
      <label className="field" htmlFor={`${idPrefix}-description`}>
        აღწერა
        <textarea id={`${idPrefix}-description`} rows={3} value={form.description} onChange={(e) => onChange({ ...form, description: e.target.value })} required />
      </label>
      <div className="stack-form-grid">
        <label className="field" htmlFor={`${idPrefix}-prize`}>
          პრიზი <small>მაგ. 5,000 WC</small>
          <input id={`${idPrefix}-prize`} value={form.prize} onChange={(e) => onChange({ ...form, prize: e.target.value })} required />
        </label>
        <label className="field" htmlFor={`${idPrefix}-status`}>
          სტატუსი
          <select id={`${idPrefix}-status`} value={form.status} onChange={(e) => onChange({ ...form, status: e.target.value as TournamentStatus })}>
            {Object.values(TournamentStatus).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor={`${idPrefix}-date`}>
          დაწყების თარიღი
          <input id={`${idPrefix}-date`} type="date" value={form.startDate} onChange={(e) => onChange({ ...form, startDate: e.target.value })} required />
        </label>
        <label className="field" htmlFor={`${idPrefix}-max`}>
          მაქს. მოთამაშეები
          <input id={`${idPrefix}-max`} type="number" min={2} step={1} value={form.maxPlayers} onChange={(e) => onChange({ ...form, maxPlayers: Number(e.target.value) })} required />
        </label>
      </div>
    </>
  )
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
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const [coverTargetId, setCoverTargetId] = useState<string | null>(null)

  // Quiet refresh (no spinner flash) — used after every mutation.
  const reload = () =>
    api
      .browseTournaments({ limit: 100 })
      .then((res) => {
        setItems(res.items)
        setError('')
      })
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))

  useEffect(() => {
    let cancelled = false
    Promise.all([api.listGames(), api.browseTournaments({ limit: 100 })])
      .then(([g, t]) => {
        if (cancelled) return
        setGames(g)
        setItems(t.items)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const createTournament = async (event: FormEvent) => {
    event.preventDefault()
    const problem = validate(form)
    if (problem) {
      setFormError(problem)
      return
    }
    setFormError('')
    setCreating(true)
    try {
      await api.adminCreateTournament({
        gameId: form.gameId,
        name: form.name.trim(),
        description: form.description.trim(),
        prize: form.prize.trim(),
        status: form.status,
        startDate: form.startDate,
        maxPlayers: form.maxPlayers,
      })
      setForm(emptyForm)
      await reload()
    } catch (err) {
      setFormError(errorMessage(err, 'შექმნა ვერ მოხერხდა.'))
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (t: PublicTournamentSummary) => {
    setEditingId(t.id)
    setEditError('')
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

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingId) return
    const problem = validate(editForm)
    if (problem) {
      setEditError(problem)
      return
    }
    setEditError('')
    setSavingEdit(true)
    try {
      await api.adminUpdateTournament(editingId, {
        gameId: editForm.gameId,
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        prize: editForm.prize.trim(),
        status: editForm.status,
        startDate: editForm.startDate,
        maxPlayers: editForm.maxPlayers,
      })
      setEditingId(null)
      await reload()
    } catch (err) {
      setEditError(errorMessage(err, 'განახლება ვერ მოხერხდა.'))
    } finally {
      setSavingEdit(false)
    }
  }

  const remove = async (t: PublicTournamentSummary) => {
    if (!window.confirm(`წაშალოთ ტურნირი „${t.name}“?`)) return
    setBusyId(t.id)
    try {
      await api.adminDeleteTournament(t.id)
      await reload()
    } catch (err) {
      setError(errorMessage(err, 'წაშლა ვერ მოხერხდა.'))
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
      await reload()
    } catch (err) {
      setError(errorMessage(err, 'სურათის ატვირთვა ვერ მოხერხდა.'))
    } finally {
      setBusyId(null)
      setCoverTargetId(null)
    }
  }

  return (
    <AdminLayout title="ტურნირები">
      <h1 className="page-title">ტურნირები</h1>
      <p className="page-subtitle">ტურნირების შექმნა, რედაქტირება და მართვა</p>

      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}

      <form className="stack-form" onSubmit={createTournament}>
        <h2>ახალი ტურნირი</h2>
        {formError && (
          <div className="status-text status-error" role="alert">
            {formError}
          </div>
        )}
        <TournamentFields idPrefix="new" form={form} games={games} onChange={setForm} />
        <button type="submit" className="button" disabled={creating}>
          {creating ? 'იქმნება…' : 'ტურნირის შექმნა'}
        </button>
      </form>

      <input type="file" accept="image/*" ref={coverInputRef} className="sr-only" tabIndex={-1} aria-label="ტურნირის ქოვერის სურათი" onChange={onCoverChosen} />

      <h2 style={{ fontSize: '1rem' }}>ყველა ტურნირი</h2>
      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">ტურნირები არ არის.</div>
      ) : (
        <div className="order-list">
          {items.map((t) =>
            editingId === t.id ? (
              <form key={t.id} className="stack-form" style={{ marginBottom: 0 }} onSubmit={saveEdit}>
                <h2>რედაქტირება: {t.name}</h2>
                {editError && (
                  <div className="status-text status-error" role="alert">
                    {editError}
                  </div>
                )}
                <TournamentFields idPrefix={`edit-${t.id}`} form={editForm} games={games} onChange={setEditForm} />
                <div className="admin-row-actions">
                  <button type="submit" className="button" disabled={savingEdit}>
                    {savingEdit ? 'ინახება…' : 'შენახვა'}
                  </button>
                  <button type="button" className="button" onClick={() => setEditingId(null)}>
                    გაუქმება
                  </button>
                </div>
              </form>
            ) : (
              <div key={t.id} className="admin-row">
                <div className="admin-row-main">
                  <strong>{t.name}</strong>
                  <span className="note" style={{ margin: 0 }}>
                    {t.gameName} · {STATUS_LABELS[t.status]} · {t.registeredCount}/{t.maxPlayers} · {t.prize} ·{' '}
                    {new Date(t.startDate).toLocaleDateString('ka-GE', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {!t.coverImageUrl && ' · ქოვერის გარეშე'}
                  </span>
                </div>
                <div className="admin-row-actions">
                  <button type="button" className="button" disabled={busyId === t.id} onClick={() => pickCover(t.id)}>
                    სურათი
                  </button>
                  <button type="button" className="button" disabled={busyId === t.id} onClick={() => startEdit(t)}>
                    რედაქტირება
                  </button>
                  <button type="button" className="button" disabled={busyId === t.id} onClick={() => remove(t)}>
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
