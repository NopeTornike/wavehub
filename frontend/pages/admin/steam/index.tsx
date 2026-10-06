/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { AdminSteamGameSummary, PublicCategory, PublicGame } from '@wavehub/shared-types'
import { ListingStatus } from '@wavehub/shared-types'
import AdminLayout from '../../../components/AdminLayout'
import SteamFactsFields, { EMPTY_STEAM_FACTS, steamFactsToAttributes } from '../../../components/SteamFactsFields'
import { api, errorMessage } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { LISTING_STATUS_LABELS } from '../../../lib/labels'
import { canPublishSteam } from '../../../lib/roles'

// Admin → Steam (2026-10-07): the whole Steam catalogue for every Steam publisher — not only the
// games this account created (the old /sell/digital-keys showed "your listings" only, so staff
// couldn't see or stock games someone else had added). Stock, sales and status at a glance; a game
// is managed on /admin/steam/[id]. New games are created here.
const FILTERS: Array<[string, string]> = [
  ['all', 'ყველა'],
  [ListingStatus.Active, 'აქტიური'],
  [ListingStatus.Paused, 'შეჩერებული'],
  [ListingStatus.Draft, 'დრაფტი'],
  ['out', 'მარაგი ამოწურულია'],
]

export default function AdminSteamGames() {
  const router = useRouter()
  const { user } = useAuth()
  const [games, setGames] = useState<AdminSteamGameSummary[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  // "/admin/steam?new=1" (seller modal link) opens the new-game panel — the query string only
  // exists once the router is ready on a static page.
  const wantsNew = router.isReady && router.query.new === '1'
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wantsNew) setCreating(true)
  }, [wantsNew])

  useEffect(() => {
    api
      .adminListSteamGames()
      .then(setGames)
      .catch((err) => {
        setGames([])
        setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
      })
  }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (games ?? []).filter((g) => {
      if (q && !g.title.toLowerCase().includes(q)) return false
      if (filter === 'out') return g.availableKeys === 0
      return filter === 'all' || g.status === filter
    })
  }, [games, query, filter])

  const totals = useMemo(() => {
    const list = games ?? []
    return {
      games: list.length,
      live: list.filter((g) => g.status === ListingStatus.Active).length,
      stock: list.reduce((sum, g) => sum + g.availableKeys, 0),
      sold: list.reduce((sum, g) => sum + g.soldKeys, 0),
      out: list.filter((g) => g.availableKeys === 0).length,
    }
  }, [games])

  if (user && !canPublishSteam(user)) {
    return (
      <AdminLayout title="Steam თამაშები">
        <div className="empty-state">Steam თამაშების მართვა შეუძლიათ მხოლოდ ოპერაციების / ადმინისტრაციის როლებს.</div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Steam თამაშები">
      <header className="adm-head">
        <div>
          <h1>Steam თამაშები</h1>
          <p>ყველა Steam თამაში, მარაგი და გაყიდვები. გასაღებებს, ფოტოებს და დეტალებს თამაშის გვერდზე მართავ.</p>
        </div>
        <button type="button" className="button st-new" onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
          {creating ? 'დახურვა' : '+ ახალი თამაში'}
        </button>
      </header>

      {creating && <CreateSteamGame onCreated={(id) => void router.push(`/admin/steam/${id}`)} />}

      <div className="adm-kpis st-kpis">
        <div className="adm-kpi">
          <span className="adm-kpi-top">თამაშები</span>
          <b>{games ? totals.games : '—'}</b>
          <small>{`${totals.live} აქტიური`}</small>
        </div>
        <div className="adm-kpi">
          <span className="adm-kpi-top">მარაგში</span>
          <b>{games ? totals.stock : '—'}</b>
          <small>ხელმისაწვდომი გასაღები</small>
        </div>
        <div className="adm-kpi">
          <span className="adm-kpi-top">გაყიდული</span>
          <b>{games ? totals.sold : '—'}</b>
          <small>გასაღები სულ</small>
        </div>
        <div className={`adm-kpi${totals.out ? ' alert' : ''}`}>
          <span className="adm-kpi-top">ამოწურული</span>
          <b>{games ? totals.out : '—'}</b>
          <small>თამაში გასაღების გარეშე</small>
        </div>
      </div>

      <div className="st-toolbar">
        <input type="search" placeholder="მოძებნე თამაში…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="თამაშის ძებნა" />
        <div className="st-filters" role="tablist" aria-label="სტატუსი">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'active' : undefined} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}

      {games === null ? (
        <div className="empty-state">იტვირთება…</div>
      ) : shown.length === 0 ? (
        <div className="empty-state">{games.length === 0 ? 'Steam თამაშები ჯერ არ არის — დაამატე პირველი.' : 'ამ ფილტრით თამაში ვერ მოიძებნა.'}</div>
      ) : (
        <div className="st-list">
          <div className="st-row st-row-head" aria-hidden="true">
            <span>თამაში</span>
            <span>სტატუსი</span>
            <span>ფასი</span>
            <span>მარაგი</span>
            <span>გაყიდული</span>
            <span></span>
          </div>
          {shown.map((g) => (
            <article key={g.id} className="st-row">
              <Link className="st-game" href={`/admin/steam/${g.id}`}>
                <span className="st-cover" style={g.coverUrl ? { backgroundImage: `url("${g.coverUrl}")` } : undefined}>
                  {g.coverUrl ? '' : <img src="/assets/steam-logo.png" alt="" aria-hidden="true" />}
                </span>
                <span>
                  <strong>{g.title}</strong>
                  <small>{`დაამატა @${g.createdByUsername}`}</small>
                </span>
              </Link>
              <span className={`st-status ${g.status}`}>{LISTING_STATUS_LABELS[g.status] ?? g.status}</span>
              <span className="st-cell" data-label="ფასი">
                {g.priceWaveCoin ?? '—'} GEL
              </span>
              <span className={`st-cell st-stock${g.availableKeys === 0 ? ' empty' : ''}`} data-label="მარაგი">
                {g.availableKeys}
              </span>
              <span className="st-cell" data-label="გაყიდული">
                {g.soldKeys}
              </span>
              <span className="st-actions">
                <Link className="button" href={`/admin/steam/${g.id}`}>
                  მართვა
                </Link>
                {g.status === ListingStatus.Active && (
                  <Link className="button ghost" href={`/listings/${g.id}`} target="_blank">
                    საიტზე
                  </Link>
                )}
              </span>
            </article>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

// The "new game" panel: Steam category (fixed), optional game, title, description, price, store
// facts and the resale-rights confirmation. Keys, photos and publishing follow on the game's page.
function CreateSteamGame({ onCreated }: { onCreated: (id: string) => void }) {
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [games, setGames] = useState<PublicGame[]>([])
  const [gameId, setGameId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState(10)
  const [attested, setAttested] = useState(false)
  const [facts, setFacts] = useState(EMPTY_STEAM_FACTS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.listCategories().then(setCategories).catch(() => undefined)
    api.listGames().then(setGames).catch(() => undefined)
  }, [])
  const steamCategory = categories.find((c) => c.slug === 'steam-games') ?? null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    // Mirrors CreateListingDto (title 5–100, description 50–5000, integer price >= 1).
    if (!steamCategory) return setError('Steam-ის კატეგორია ვერ მოიძებნა.')
    if (title.trim().length < 5 || title.trim().length > 100) return setError('სათაური უნდა იყოს 5–100 სიმბოლო.')
    if (description.trim().length < 50 || description.trim().length > 5000) return setError('აღწერა უნდა იყოს 50–5000 სიმბოლო.')
    if (!Number.isInteger(price) || price < 1) return setError('ფასი უნდა იყოს მთელი რიცხვი, მინიმუმ 1 GEL.')
    if (!attested) return setError('დაადასტურე გასაღებების გაყიდვის უფლება.')
    const attributes = steamFactsToAttributes(facts, price)
    if (typeof attributes === 'string') return setError(attributes)
    setBusy(true)
    try {
      const listing = await api.createDigitalKeyListing({
        categoryId: steamCategory.id,
        gameId: gameId || undefined,
        title: title.trim(),
        description: description.trim(),
        priceWaveCoin: price,
        resaleRightsAttested: true,
        attributes,
      })
      onCreated(listing.id)
    } catch (err) {
      setError(errorMessage(err, 'შექმნა ვერ მოხერხდა.'))
      setBusy(false)
    }
  }

  return (
    <form className="stack-form st-create" onSubmit={submit}>
      <h2>ახალი Steam თამაში</h2>
      <p className="note">შექმნის შემდეგ თამაშის გვერდზე დაამატე გასაღებები და ფოტოები, მერე გამოაქვეყნე.</p>
      <div className="st-two">
        <label className="field">
          სათაური <small>5–100 სიმბოლო</small>
          <input maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="field">
          ფასი (GEL) <small>ერთი გასაღების ფასი</small>
          <input type="number" min={1} step={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
        </label>
      </div>
      <label className="field">
        თამაშის კატეგორია <small>არასავალდებულო</small>
        <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
          <option value="">—</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        აღწერა <small>{`მინიმუმ 50 სიმბოლო (${description.trim().length}/50)`}</small>
        <textarea rows={4} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </label>
      <SteamFactsFields facts={facts} onChange={setFacts} />
      <label className="field check">
        <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
        ვადასტურებ, რომ ამ გასაღებების გაყიდვის უფლება გვაქვს
      </label>
      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}
      <button type="submit" className="button" disabled={busy}>
        {busy ? 'იქმნება…' : 'თამაშის შექმნა'}
      </button>
    </form>
  )
}
