import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import type { AdminGame, GameImageKind } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'
import { GAME_ART } from '../../lib/games'

// Admin → Games (backend/src/listings/admin-games.controller.ts): add a game, rename it, hide/show
// it everywhere public, set its order, and upload its three pieces of art. A game is never deleted
// (listings/coaches/tournaments reference it) — hiding it is the "remove". The slug is fixed at
// creation because URLs and the bundled art map key on it.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ART: Array<{ kind: GameImageKind; label: string; hint: string }> = [
  { kind: 'tile', label: 'მთავარის ფილა', hint: 'მთავარი გვერდის თამაშების ბადე' },
  { kind: 'cover', label: 'ქავერი', hint: 'მარკეტის ბარათები და განცხადების გვერდი' },
  { kind: 'icon', label: 'იკონი', hint: 'პატარა ლოგო სათაურთან' },
]

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// What is shown now for a kind: the upload, else the art bundled with the site for seeded games.
function currentArt(game: AdminGame, kind: GameImageKind): { url: string | null; uploaded: boolean } {
  const uploaded = kind === 'tile' ? game.tileUrl : kind === 'cover' ? game.coverUrl : game.iconUrl && !game.iconUrl.startsWith('/assets/') ? game.iconUrl : null
  if (uploaded) return { url: uploaded, uploaded: true }
  const bundled = GAME_ART[game.slug]?.[kind] ?? (kind === 'icon' ? game.iconUrl : null)
  return { url: bundled ?? null, uploaded: false }
}

export default function AdminGames() {
  const [games, setGames] = useState<AdminGame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', slugTouched: false })
  const [edits, setEdits] = useState<Record<string, { name: string; sortOrder: number }>>({})

  useEffect(() => {
    api
      .adminListGames()
      .then(setGames)
      .catch((err) => setError(errorMessage(err, 'თამაშების ჩატვირთვა ვერ მოხერხდა.')))
      .finally(() => setLoading(false))
  }, [])

  const replace = (game: AdminGame) => setGames((list) => list.map((g) => (g.id === game.id ? { ...g, ...game } : g)))

  const run = async (key: string, action: () => Promise<void>, done: string) => {
    setBusy(key)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(done)
    } catch (err) {
      setError(errorMessage(err, 'მოქმედება ვერ შესრულდა.'))
    } finally {
      setBusy(null)
    }
  }

  const create = (event: FormEvent) => {
    event.preventDefault()
    const name = form.name.trim()
    if (name.length < 2 || name.length > 40) return setError('სახელი: 2–40 სიმბოლო.')
    if (!SLUG.test(form.slug) || form.slug.length < 2) return setError('Slug: პატარა ლათინური ასოები/ციფრები, სიტყვები გაყოფილი „-“-ით.')
    void run(
      'create',
      async () => {
        const game = await api.adminCreateGame({ name, slug: form.slug })
        setGames((list) => [...list, { ...game, listingCount: 0 }])
        setForm({ name: '', slug: '', slugTouched: false })
      },
      'თამაში დაემატა — ატვირთეთ მისი სურათები ქვემოთ.',
    )
  }

  const save = (game: AdminGame) => {
    const edit = edits[game.id]
    if (!edit) return
    const name = edit.name.trim()
    if (name.length < 2 || name.length > 40) return setError('სახელი: 2–40 სიმბოლო.')
    if (!Number.isInteger(edit.sortOrder) || edit.sortOrder < 0 || edit.sortOrder > 999) return setError('რიგითობა: 0–999.')
    void run(
      game.id,
      async () => {
        replace(await api.adminUpdateGame(game.id, { name, sortOrder: edit.sortOrder }))
        setEdits(({ [game.id]: _dropped, ...rest }) => rest)
      },
      'შენახულია.',
    )
  }

  const toggle = (game: AdminGame) =>
    run(game.id, async () => replace(await api.adminUpdateGame(game.id, { isActive: !game.isActive })), game.isActive ? 'თამაში დამალულია.' : 'თამაში კვლავ ჩანს.')

  const uploadArt = (game: AdminGame, kind: GameImageKind) => (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('მხოლოდ JPG, PNG ან WEBP სურათი, მაქსიმუმ 5MB.')
      return
    }
    void run(`${game.id}:${kind}`, async () => replace(await api.adminUploadGameImage(game.id, kind, file)), 'სურათი განახლდა.')
  }

  const clearArt = (game: AdminGame, kind: GameImageKind) =>
    run(`${game.id}:${kind}`, async () => replace(await api.adminClearGameImage(game.id, kind)), 'ატვირთული სურათი მოიხსნა.')

  return (
    <AdminLayout title="თამაშები">
      <h1 className="page-title">თამაშები</h1>
      <p className="page-subtitle">თამაშების კატალოგი — დამატება, დამალვა, რიგითობა და სურათები</p>

      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}
      {notice && <div className="status-text status-success">{notice}</div>}

      <form className="stack-form ag-create" onSubmit={create}>
        <h2>ახალი თამაში</h2>
        <div className="stack-form-grid">
          <label className="field">
            სახელი
            <input
              maxLength={40}
              value={form.name}
              placeholder="მაგ. Apex Legends"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slugTouched ? f.slug : slugify(e.target.value) }))}
            />
          </label>
          <label className="field">
            Slug <small>URL-ში; შექმნის შემდეგ არ იცვლება</small>
            <input maxLength={40} value={form.slug} placeholder="apex-legends" onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase(), slugTouched: true }))} />
          </label>
        </div>
        <button className="button glow-on-hover" type="submit" disabled={busy === 'create'}>
          {busy === 'create' ? 'იქმნება…' : 'თამაშის დამატება'}
        </button>
      </form>

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : (
        <div className="ag-list">
          {games.map((game) => {
            const edit = edits[game.id] ?? { name: game.name, sortOrder: game.sortOrder }
            const dirty = edit.name !== game.name || edit.sortOrder !== game.sortOrder
            return (
              <article key={game.id} className={`ag-card${game.isActive ? '' : ' hidden-game'}`}>
                <header>
                  <div className="ag-title">
                    <input aria-label="სახელი" maxLength={40} value={edit.name} onChange={(e) => setEdits((all) => ({ ...all, [game.id]: { ...edit, name: e.target.value } }))} />
                    <small>
                      <code>{game.slug}</code> · <span>{game.listingCount}</span> <span>განცხადება</span>
                    </small>
                  </div>
                  <label className="ag-order">
                    რიგი
                    <input type="number" min={0} max={999} value={edit.sortOrder} onChange={(e) => setEdits((all) => ({ ...all, [game.id]: { ...edit, sortOrder: Number(e.target.value) } }))} />
                  </label>
                  <em className={`ag-status ${game.isActive ? 'on' : 'off'}`}>{game.isActive ? 'ჩანს' : 'დამალულია'}</em>
                </header>
                <div className="ag-art">
                  {ART.map(({ kind, label, hint }) => {
                    const art = currentArt(game, kind)
                    return (
                      <div key={kind} className={`ag-art-slot ${kind}`}>
                        <span className="ag-thumb" style={art.url ? { backgroundImage: `url("${art.url}")` } : undefined}>
                          {art.url ? '' : '—'}
                        </span>
                        <strong>{label}</strong>
                        <small>{art.url ? (art.uploaded ? 'ატვირთული' : 'საიტის სტანდარტული') : hint}</small>
                        <div className="ag-art-actions">
                          <label className="button ag-small">
                            {busy === `${game.id}:${kind}` ? '…' : 'ატვირთვა'}
                            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadArt(game, kind)} />
                          </label>
                          {art.uploaded && (
                            <button type="button" className="button ag-small ghost" onClick={() => void clearArt(game, kind)}>
                              მოხსნა
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <footer>
                  <button type="button" className="button glow-on-hover" disabled={!dirty || busy === game.id} onClick={() => save(game)}>
                    შენახვა
                  </button>
                  <button type="button" className={`button ${game.isActive ? 'ghost' : 'glow-on-hover'}`} disabled={busy === game.id} onClick={() => void toggle(game)}>
                    {game.isActive ? 'დამალვა' : 'გამოჩენა'}
                  </button>
                </footer>
              </article>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
