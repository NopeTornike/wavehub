import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicCategory, PublicGame } from '@wavehub/shared-types'
import Layout from '../../../components/Layout'
import { api, ApiError } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'

// Steam Keys (LAUNCH_PLAN.md §2d). No generic "create any listing" page exists yet for Service/Item
// (see frontend/CLAUDE.md) — this is scoped to DigitalKey listings specifically, matching the plan's
// "bulk key-upload form" ask, not an attempt to build the missing seller dashboard for every type.
export default function MyDigitalKeyListings() {
  const router = useRouter()
  const { user, checked } = useAuth()

  const [listings, setListings] = useState<any[]>([])
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [games, setGames] = useState<PublicGame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [categoryId, setCategoryId] = useState('')
  const [gameId, setGameId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priceWaveCoin, setPriceWaveCoin] = useState(10)
  const [attested, setAttested] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    if (checked && !user) {
      router.push('/login?next=/sell/digital-keys')
    }
  }, [checked, user, router])

  const reload = () => {
    setLoading(true)
    api
      .listMyListings()
      .then((rows) => setListings((rows as any[]).filter((row) => row.type === 'digital_key')))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!user) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch-on-login, not an external subscription
    reload()
    api.listCategories().then(setCategories).catch(() => undefined)
    api.listGames().then(setGames).catch(() => undefined)
  }, [user])

  const create = async () => {
    setCreateError('')
    if (!categoryId) {
      setCreateError('აირჩიეთ კატეგორია.')
      return
    }
    if (!attested) {
      setCreateError('საჭიროა დაადასტუროთ გასაღებების ხელახალი გაყიდვის უფლება.')
      return
    }
    setCreating(true)
    try {
      const listing: any = await api.createDigitalKeyListing({
        categoryId,
        gameId: gameId || undefined,
        title,
        description,
        priceWaveCoin,
        resaleRightsAttested: true,
      })
      router.push(`/sell/digital-keys/${listing.id}`)
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'შექმნა ვერ მოხერხდა.')
    } finally {
      setCreating(false)
    }
  }

  if (!user) {
    return (
      <Layout>
        <div className="page">
          <div className="page-inner">
            <div className="empty-state">იტვირთება…</div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page">
        <div className="page-inner">
          <h1 className="page-title">ჩემი გასაღებების ლისტინგები</h1>
          <p className="page-subtitle">Steam-ის (ან სხვა) აქტივაციის გასაღებების გაყიდვა</p>

          <div className="admin-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, marginBottom: 32 }}>
            <h2 style={{ fontSize: '1rem', margin: 0 }}>ახალი ლისტინგი</h2>
            {createError && <div className="status-text status-error">{createError}</div>}
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">აირჩიეთ კატეგორია</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
              <option value="">თამაში (არასავალდებულო)</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <input placeholder="სათაური" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea
              placeholder="აღწერა (მინ. 50 სიმბოლო)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
            <input
              type="number"
              min={1}
              placeholder="ფასი (WC)"
              value={priceWaveCoin}
              onChange={(e) => setPriceWaveCoin(Number(e.target.value))}
            />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
              <span>ვადასტურებ, რომ მაქვს ამ გასაღებების ხელახალი გაყიდვის კანონიერი უფლება.</span>
            </label>
            <button type="button" className="button" disabled={creating} onClick={create}>
              {creating ? 'იქმნება…' : 'ლისტინგის შექმნა'}
            </button>
          </div>

          <h2 style={{ fontSize: '1rem' }}>ჩემი ლისტინგები</h2>
          {error && <div className="status-text status-error">{error}</div>}
          {loading ? (
            <div className="empty-state">იტვირთება…</div>
          ) : listings.length === 0 ? (
            <div className="empty-state">ლისტინგები არ არის.</div>
          ) : (
            <div className="order-list">
              {listings.map((listing) => (
                <Link key={listing.id} href={`/sell/digital-keys/${listing.id}`} className="admin-row">
                  <div className="admin-row-main">
                    <strong>{listing.title}</strong>
                    <span className="note" style={{ margin: 0 }}>
                      {listing.status} · {listing.priceWaveCoin} WC
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
