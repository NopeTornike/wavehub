import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicCategory, PublicGame } from '@wavehub/shared-types'
import { ListingType } from '@wavehub/shared-types'
import Layout from '../../../components/Layout'
import { api, errorMessage, type MyListing } from '../../../lib/api'
import { LISTING_STATUS_LABELS } from '../../../lib/labels'
import { useAuth } from '../../../lib/auth'

// Steam Keys (LAUNCH_PLAN.md §2d). No generic "create any listing" page exists yet for Service/Item
// (see frontend/CLAUDE.md) — this is scoped to DigitalKey listings specifically, matching the plan's
// "bulk key-upload form" ask, not an attempt to build the missing seller dashboard for every type.
export default function MyDigitalKeyListings() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const userId = user?.id

  const [listings, setListings] = useState<MyListing[]>([])
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

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    api
      .listMyListings()
      .then((rows) => {
        if (!cancelled) setListings(rows.filter((row) => row.type === ListingType.DigitalKey))
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    api.listCategories().then(setCategories).catch(() => undefined)
    api.listGames().then(setGames).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [userId])

  // Keys are items, not services — hide service-only categories, but fall back to everything if
  // the seed data has no item/both categories rather than presenting an empty dropdown.
  const itemCategories = categories.filter((c) => c.type !== 'service')
  const categoryOptions = itemCategories.length > 0 ? itemCategories : categories

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setCreateError('')
    // Mirrors CreateListingDto (title 5–100, description 50–5000, integer price >= 1).
    if (!categoryId) return setCreateError('აირჩიეთ კატეგორია.')
    if (title.trim().length < 5 || title.trim().length > 100) return setCreateError('სათაური უნდა იყოს 5–100 სიმბოლო.')
    if (description.trim().length < 50 || description.trim().length > 5000) return setCreateError('აღწერა უნდა იყოს 50–5000 სიმბოლო.')
    if (!Number.isInteger(priceWaveCoin) || priceWaveCoin < 1) return setCreateError('ფასი უნდა იყოს მთელი რიცხვი, მინიმუმ 1 WC.')
    if (!attested) return setCreateError('საჭიროა დაადასტუროთ გასაღებების ხელახალი გაყიდვის უფლება.')
    setCreating(true)
    try {
      const listing = await api.createDigitalKeyListing({
        categoryId,
        gameId: gameId || undefined,
        title: title.trim(),
        description: description.trim(),
        priceWaveCoin,
        resaleRightsAttested: true,
      })
      router.push(`/sell/digital-keys/${listing.id}`)
    } catch (err) {
      setCreateError(errorMessage(err, 'შექმნა ვერ მოხერხდა.'))
      setCreating(false)
    }
  }

  if (!user) {
    return (
      <Layout title="ჩემი გასაღებების განცხადებები" noIndex>
        <div className="detail-page">
          <div className="marketplace-empty">იტვირთება…</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="ჩემი გასაღებების განცხადებები" noIndex>
      {/* Steam Keys is net-new (LAUNCH_PLAN.md §2d) with no static-prototype page to port from, so
          this follows the design language already established for the app's other own-data pages
          (support/*, coaching-sessions/[id], pages/[slug]): `.detail-page` +
          `.detail-title-block` + `.detail-section` cards, and the `.order-card` row shape from
          orders/index.tsx for the listing list — replacing the legacy `.page`/`.page-inner`/
          `.page-title`/`.admin-row` bridge classes this page used before. */}
      <div className="detail-page">
        <div className="detail-title-block">
          <p className="section-kicker">გაყიდვა</p>
          <h1>ჩემი გასაღებების განცხადებები</h1>
          <p>Steam-ის (ან სხვა) აქტივაციის გასაღებების გაყიდვა</p>
        </div>

        <section className="detail-section">
          <h2>ახალი განცხადება</h2>
          <form className="stack-form" onSubmit={create}>
            {createError && (
              <div className="status-text status-error" role="alert">
                {createError}
              </div>
            )}
            <div className="stack-form-grid">
              <label className="field">
                კატეგორია
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                  <option value="">აირჩიეთ კატეგორია</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                თამაში <small>არასავალდებულო</small>
                <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
                  <option value="">—</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              სათაური <small>5–100 სიმბოლო</small>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required />
            </label>
            <label className="field">
              აღწერა <small>მინიმუმ 50 სიმბოლო ({description.trim().length}/50)</small>
              <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} required />
            </label>
            <label className="field">
              ფასი (WC) <small>ერთი გასაღების ფასი</small>
              <input type="number" min={1} step={1} value={priceWaveCoin} onChange={(e) => setPriceWaveCoin(Number(e.target.value))} required />
            </label>
            <label className="field check">
              <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
              <span>ვადასტურებ, რომ მაქვს ამ გასაღებების ხელახალი გაყიდვის კანონიერი უფლება.</span>
            </label>
            <button type="submit" className="detail-buy-button" disabled={creating}>
              {creating ? 'იქმნება…' : 'განცხადების შექმნა'}
            </button>
          </form>
        </section>

        <section className="detail-section">
          <h2>ჩემი განცხადებები</h2>
          {error && (
            <div className="status-text status-error" role="alert">
              {error}
            </div>
          )}
          {loading ? (
            <div className="marketplace-empty">იტვირთება…</div>
          ) : listings.length === 0 ? (
            <div className="orders-empty">განცხადებები ჯერ არ გაქვთ.</div>
          ) : (
            <div className="orders-list">
              {listings.map((listing) => (
                <Link key={listing.id} href={`/sell/digital-keys/${listing.id}`} className="order-card">
                  {/* No cover image on a digital-key listing — `.order-thumb` takes initials here,
                      the same fallback coaching-sessions/index.tsx uses. */}
                  <span className="order-thumb" aria-hidden="true">
                    {listing.title.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="order-copy">
                    <div>
                      <span className="order-status">{LISTING_STATUS_LABELS[listing.status] ?? listing.status}</span>
                    </div>
                    <strong>{listing.title}</strong>
                  </div>
                  <div className="order-side">
                    <strong>{listing.priceWaveCoin} WC</strong>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
