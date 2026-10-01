import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { ItemAttributes, ItemAttributeValue, ListingForEdit } from '@wavehub/shared-types'
import { ListingStatus, ListingType } from '@wavehub/shared-types'
import { api, errorMessage, type ListingEditPayload, type PackageInput } from '../lib/api'
import { LISTING_STATUS_LABELS, LISTING_TYPE_LABELS } from '../lib/labels'
import GAME_DETAILS from '../lib/game-details.json'

// The full listing editor (bug 9, 2026-10-01). Two callers:
// - the seller, `/sell/items/[id]` (mode 'owner'): their own item listing. Editing a live listing
//   (or adding a photo to it) sends it back to review; while a review is pending it's read-only.
// - Super Admin, `/admin/listings/[id]` (mode 'admin'): any listing of any type, applied as-is,
//   audit-logged server-side.
// Covers title, price, description, the game details entered at creation (item attributes — every
// existing key keeps its type), photos (add / main / remove, max 6) and, in admin mode, a service's
// packages. Bounds mirror UpdateListingDto / CreatePackageDto.

type Mode = 'owner' | 'admin'
type DetailField = { id: string; label: string; type?: string; tag?: string; options?: Array<{ value: string | null; label: string }> }
const DETAIL_FORMS = GAME_DETAILS as unknown as Record<string, { fields: DetailField[] }>

// Labels for the core keys the sell form stores (per-game keys get theirs from game-details.json).
const CORE_LABELS: Record<string, string> = {
  kind: 'ტიპი (account / skin)',
  accountStatus: 'ანგარიშის სტატუსი',
  accountLevel: 'ანგარიშის დონე',
  platform: 'პლატფორმა',
  region: 'რეგიონი',
  loginMethod: 'შესვლის მეთოდი',
  emailChangeable: 'ელფოსტის შეცვლა შესაძლებელია',
  linkedAccounts: 'მიბმული ანგარიშები',
  fullAccess: 'სრული წვდომა',
  originalEmail: 'ორიგინალი ელფოსტა',
  twoFactor: 'ორფაქტორიანი დაცვა',
  deliveryMethod: 'მიწოდების მეთოდი',
  deliveryTime: 'მიწოდების დრო',
}
const MAX_IMAGES = 6

type AttrKind = 'string' | 'number' | 'boolean'
type AttrRow = { key: string; label: string; kind: AttrKind; value: string; options?: string[] }

function attrRows(listing: ListingForEdit): AttrRow[] {
  const attrs = (listing.itemAttributes ?? {}) as Record<string, unknown>
  const gameFields = listing.game ? (DETAIL_FORMS[listing.game.slug]?.fields ?? []) : []
  const rows: AttrRow[] = []
  const seen = new Set<string>()
  for (const [key, raw] of Object.entries(attrs)) {
    if (raw === null || raw === undefined) continue
    const field = gameFields.find((f) => f.id === key)
    const kind: AttrKind = typeof raw === 'number' ? 'number' : typeof raw === 'boolean' ? 'boolean' : 'string'
    rows.push({
      key,
      label: field?.label ?? CORE_LABELS[key] ?? key,
      kind,
      value: kind === 'boolean' ? (raw ? 'yes' : 'no') : String(raw),
      options: field?.tag === 'select' ? (field.options ?? []).map((o) => o.value ?? o.label).filter(Boolean) : undefined,
    })
    seen.add(key)
  }
  // The game's optional details the seller left empty at creation can be filled in now.
  for (const field of gameFields) {
    if (seen.has(field.id)) continue
    rows.push({
      key: field.id,
      label: field.label,
      kind: field.type === 'number' ? 'number' : 'string',
      value: '',
      options: field.tag === 'select' ? (field.options ?? []).map((o) => o.value ?? o.label).filter(Boolean) : undefined,
    })
  }
  return rows
}

function rowsToAttributes(rows: AttrRow[]): ItemAttributes | string {
  const out: Record<string, ItemAttributeValue> = {}
  for (const row of rows) {
    const value = row.value.trim()
    if (!value) continue
    if (row.kind === 'boolean') out[row.key] = value === 'yes'
    else if (row.kind === 'number') {
      const n = Number(value)
      if (!Number.isFinite(n)) return `${row.label}: უნდა იყოს რიცხვი.`
      out[row.key] = n
    } else {
      if (value.length > 300) return `${row.label}: მაქს. 300 სიმბოლო.`
      out[row.key] = value
    }
  }
  return out as ItemAttributes
}

export default function ListingEditor({ listingId, mode }: { listingId: string; mode: Mode }) {
  const admin = mode === 'admin'
  const [listing, setListing] = useState<ListingForEdit | null>(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({ title: '', description: '', price: '' })
  const [attrs, setAttrs] = useState<AttrRow[]>([])
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success' | 'pending'; text: string }>({ kind: '', text: '' })
  const [busy, setBusy] = useState(false)
  const [pkg, setPkg] = useState({ name: '', price: '', days: '3', revisions: '0', features: '' })

  const apply = useCallback((data: ListingForEdit) => {
    setListing(data)
    setForm({ title: data.title, description: data.description, price: data.priceWaveCoin === null ? '' : String(data.priceWaveCoin) })
    setAttrs(attrRows(data))
  }, [])

  const load = useCallback(
    () =>
      (admin ? api.adminGetListing(listingId) : api.getMyListing(listingId))
        .then((data) => {
          apply(data)
          setLoadError('')
        })
        .catch((err) => setLoadError(errorMessage(err, 'განცხადება ვერ ჩაიტვირთა.'))),
    [admin, listingId, apply],
  )

  useEffect(() => {
    void load()
  }, [load])

  if (loadError) return <div className="marketplace-empty">{loadError}</div>
  if (!listing) return <div className="marketplace-empty">იტვირთება…</div>

  const isService = listing.type === ListingType.Service
  const live = listing.status === ListingStatus.Active || listing.status === ListingStatus.Paused
  const locked = !admin && listing.status === ListingStatus.PendingReview
  const reviewNote = !admin && live ? ' შენახვის შემდეგ განცხადება ხელახლა გადის შემოწმებას.' : ''

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true)
    setStatus({ kind: 'pending', text: 'მუშავდება…' })
    try {
      await work()
      await load()
      setStatus({ kind: 'success', text: done })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'მოქმედება ვერ შესრულდა.') })
    } finally {
      setBusy(false)
    }
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    const title = form.title.trim()
    const description = form.description.trim()
    if (title.length < 5 || title.length > 100) return setStatus({ kind: 'error', text: 'სათაური: 5–100 სიმბოლო.' })
    if (description.length < 50 || description.length > 5000) return setStatus({ kind: 'error', text: 'აღწერა: 50–5000 სიმბოლო.' })
    const payload: ListingEditPayload = {}
    if (title !== listing.title) payload.title = title
    if (description !== listing.description) payload.description = description
    if (!isService) {
      const price = Number(form.price)
      if (!Number.isInteger(price) || price < 1) return setStatus({ kind: 'error', text: 'ფასი: მთელი რიცხვი, მინიმუმ 1 GEL.' })
      if (price !== listing.priceWaveCoin) payload.priceWaveCoin = price
      const attributes = rowsToAttributes(attrs)
      if (typeof attributes === 'string') return setStatus({ kind: 'error', text: attributes })
      if (JSON.stringify(attributes) !== JSON.stringify(listing.itemAttributes ?? {})) payload.attributes = attributes
    }
    if (Object.keys(payload).length === 0) return setStatus({ kind: 'success', text: 'ცვლილებები არ არის.' })
    void run(
      () => (admin ? api.adminUpdateListing(listing.id, payload) : api.updateListing(listing.id, payload)),
      admin ? 'შენახულია.' : live ? 'შენახულია — განცხადება ხელახლა გადის შემოწმებას.' : 'შენახულია.',
    )
  }

  const addPhotos = (files: FileList | null) => {
    const picked = Array.from(files ?? [])
    if (picked.length === 0) return
    if (listing.images.length + picked.length > MAX_IMAGES) return setStatus({ kind: 'error', text: `მაქსიმუმ ${MAX_IMAGES} ფოტო.` })
    if (picked.some((f) => !['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024)) {
      return setStatus({ kind: 'error', text: 'ფოტო: PNG, JPG ან WEBP, მაქსიმუმ 5MB.' })
    }
    void run(async () => {
      for (const file of picked) await (admin ? api.adminUploadListingImage(listing.id, file) : api.uploadListingImage(listing.id, file))
    }, admin || !live ? 'ფოტო დაემატა.' : 'ფოტო დაემატა — განცხადება ხელახლა გადის შემოწმებას.')
  }

  const addPackage = () => {
    const input: PackageInput = {
      name: pkg.name.trim(),
      priceWaveCoin: Number(pkg.price),
      deliveryTimeDays: Number(pkg.days),
      revisionsIncluded: Number(pkg.revisions),
      features: pkg.features.split(',').map((f) => f.trim()).filter(Boolean).slice(0, 8),
    }
    if (input.name.length < 2 || input.name.length > 50) return setStatus({ kind: 'error', text: 'პაკეტის სახელი: 2–50 სიმბოლო.' })
    if (!Number.isInteger(input.priceWaveCoin) || input.priceWaveCoin < 1) return setStatus({ kind: 'error', text: 'პაკეტის ფასი: მთელი რიცხვი, მინიმუმ 1 GEL.' })
    if (!Number.isInteger(input.deliveryTimeDays) || input.deliveryTimeDays < 1 || input.deliveryTimeDays > 90) return setStatus({ kind: 'error', text: 'მიწოდება: 1–90 დღე.' })
    void run(async () => {
      await api.adminAddListingPackage(listing.id, input)
      setPkg({ name: '', price: '', days: '3', revisions: '0', features: '' })
    }, 'პაკეტი დაემატა.')
  }

  const canSubmit = !admin && (listing.status === ListingStatus.Draft || listing.status === ListingStatus.Rejected)

  return (
    <div className="le-page">
      <header className="le-head">
        <div>
          <p className="section-kicker">
            {LISTING_TYPE_LABELS[listing.type]} · {listing.game?.name ?? 'WaveHub'}
            {admin ? ` · @${listing.sellerUsername}` : ''}
          </p>
          <h1>{admin ? 'განცხადების რედაქტირება (ადმინი)' : 'განცხადების რედაქტირება'}</h1>
        </div>
        <span className={`le-status s-${listing.status}`}>{LISTING_STATUS_LABELS[listing.status]}</span>
      </header>

      {admin && <p className="le-note">Super Admin: ცვლილებები ძალაში შედის მაშინვე (ხელახალი შემოწმების გარეშე) და ჩაიწერება აუდიტში.</p>}
      {locked && <p className="le-note warn">განცხადება შემოწმებაშია — რედაქტირება შესაძლებელი იქნება გადაწყვეტილების შემდეგ.</p>}
      {!admin && live && <p className="le-note">ეს განცხადება მარკეტშია. ცვლილებები და ახალი ფოტოები ხელახლა გადის შემოწმებას.</p>}
      {!admin && listing.status === ListingStatus.Rejected && (
        <p className="le-note warn">
          უარყოფილია{listing.rejectionReason ? `: ${listing.rejectionReason}` : ''}. შეასწორე და ხელახლა გაგზავნე.
        </p>
      )}

      <section className="le-card">
        <h2>ფოტოები</h2>
        <p className="le-hint">პირველი ფოტო მთავარია — ჩანს მარკეტის ბარათზე. მაქს. {MAX_IMAGES}.</p>
        <div className="steam-photo-grid">
          {listing.images.map((img, index) => (
            <figure key={img.id} style={{ backgroundImage: `url("${img.url}")` }}>
              <button
                type="button"
                aria-label="ფოტოს წაშლა"
                disabled={busy || locked}
                onClick={() => {
                  if (window.confirm('წავშალოთ ეს ფოტო?')) void run(() => (admin ? api.adminRemoveListingImage(listing.id, img.id) : api.removeListingImage(listing.id, img.id)), 'ფოტო წაიშალა.')
                }}
              >
                ×
              </button>
              {index === 0 ? (
                <span className="steam-photo-main">მთავარი</span>
              ) : (
                <button
                  type="button"
                  className="steam-photo-make-main"
                  disabled={busy || locked}
                  onClick={() => void run(() => (admin ? api.adminSetListingCoverImage(listing.id, img.id) : api.setListingCoverImage(listing.id, img.id)), 'მთავარი ფოტო შეიცვალა.')}
                >
                  მთავარად დაყენება
                </button>
              )}
            </figure>
          ))}
          {listing.images.length < MAX_IMAGES && !locked && (
            <label className="steam-photo-add">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={busy}
                onChange={(e) => {
                  addPhotos(e.target.files)
                  e.target.value = ''
                }}
              />
              <span>{busy ? '…' : '+ ფოტო'}</span>
            </label>
          )}
        </div>
      </section>

      <form className="le-card stack-form" onSubmit={save}>
        <h2>ძირითადი ინფორმაცია</h2>
        <fieldset disabled={locked || busy} className="le-fieldset">
          <label className="field">
            სათაური <small>5–100 სიმბოლო</small>
            <input maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          {!isService && (
            <label className="field">
              ფასი (GEL)
              <input type="number" min={1} step={1} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
          )}
          <label className="field">
            აღწერა <small>50–5000 სიმბოლო ({form.description.trim().length})</small>
            <textarea rows={6} maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          {!isService && attrs.length > 0 && (
            <>
              <h3>დეტალები</h3>
              <div className="le-attrs">
                {attrs.map((row, i) => {
                  const set = (value: string) => setAttrs((list) => list.map((r, j) => (j === i ? { ...r, value } : r)))
                  return (
                    <label key={row.key} className="field">
                      {row.label}
                      {row.kind === 'boolean' ? (
                        <select value={row.value} onChange={(e) => set(e.target.value)}>
                          <option value="yes">კი</option>
                          <option value="no">არა</option>
                        </select>
                      ) : row.options?.length ? (
                        <select value={row.value} onChange={(e) => set(e.target.value)}>
                          <option value="">—</option>
                          {[...new Set([...(row.value && !row.options.includes(row.value) ? [row.value] : []), ...row.options])].map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input type={row.kind === 'number' ? 'number' : 'text'} maxLength={300} value={row.value} onChange={(e) => set(e.target.value)} />
                      )}
                    </label>
                  )
                })}
              </div>
            </>
          )}
          <div className="le-actions">
            <button className="button" type="submit">
              შენახვა
            </button>
            {canSubmit && (
              <button type="button" className="button ghost" onClick={() => void run(() => api.submitListingForReview(listing.id), 'გაიგზავნა შესამოწმებლად.')}>
                შესამოწმებლად გაგზავნა
              </button>
            )}
          </div>
          {reviewNote && <p className="le-hint">{reviewNote.trim()}</p>}
        </fieldset>
      </form>

      {isService && (
        <section className="le-card">
          <h2>პაკეტები</h2>
          {listing.packages.length === 0 ? (
            <p className="le-hint">პაკეტები არ არის.</p>
          ) : (
            <ul className="le-packages">
              {listing.packages.map((p) => (
                <li key={p.id}>
                  <span>
                    <b>{p.name}</b> — {p.priceWaveCoin} GEL · {p.deliveryTimeDays} დღე
                  </span>
                  {admin && (
                    <button
                      type="button"
                      className="button ghost"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`წავშალოთ პაკეტი „${p.name}“?`)) void run(() => api.adminRemoveListingPackage(listing.id, p.id), 'პაკეტი წაიშალა.')
                      }}
                    >
                      წაშლა
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {admin ? (
            listing.packages.length < 5 && (
              <div className="le-attrs">
                <label className="field">
                  სახელი
                  <input maxLength={50} value={pkg.name} onChange={(e) => setPkg({ ...pkg, name: e.target.value })} />
                </label>
                <label className="field">
                  ფასი (GEL)
                  <input type="number" min={1} value={pkg.price} onChange={(e) => setPkg({ ...pkg, price: e.target.value })} />
                </label>
                <label className="field">
                  მიწოდება (დღე)
                  <input type="number" min={1} max={90} value={pkg.days} onChange={(e) => setPkg({ ...pkg, days: e.target.value })} />
                </label>
                <label className="field">
                  რევიზიები
                  <input type="number" min={0} max={20} value={pkg.revisions} onChange={(e) => setPkg({ ...pkg, revisions: e.target.value })} />
                </label>
                <label className="field">
                  რას მოიცავს <small>მძიმით</small>
                  <input value={pkg.features} onChange={(e) => setPkg({ ...pkg, features: e.target.value })} />
                </label>
                <div className="le-actions">
                  <button type="button" className="button" disabled={busy} onClick={addPackage}>
                    + პაკეტის დამატება
                  </button>
                </div>
              </div>
            )
          ) : (
            <p className="le-hint">
              პაკეტები, კითხვები და FAQ — <Link href={`/sell/services/${listing.id}`}>სერვისის მართვის გვერდზე</Link>.
            </p>
          )}
        </section>
      )}

      {status.text && (
        <p className={`seller-status ${status.kind === 'pending' ? '' : status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}
      <p className="le-links">
        {listing.status === ListingStatus.Active && <Link href={`/listings/${listing.id}`}>საჯარო გვერდის ნახვა</Link>}
        {admin ? <Link href="/admin/listings">← განცხადებები</Link> : <Link href="/profile">← ჩემი განცხადებები</Link>}
      </p>
    </div>
  )
}
