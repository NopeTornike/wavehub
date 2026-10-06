import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import type { ItemAttributes, ListingForEdit } from '@wavehub/shared-types'
import { ListingStatus } from '@wavehub/shared-types'
import AdminLayout from '../../../components/AdminLayout'
import AdminKeyInventory from '../../../components/AdminKeyInventory'
import SteamFactsFields, { EMPTY_STEAM_FACTS, steamFactsFrom, steamFactsToAttributes } from '../../../components/SteamFactsFields'
import { api, errorMessage } from '../../../lib/api'
import { PHOTO_SOURCE_MAX_BYTES } from '../../../lib/image-resize'
import { LISTING_STATUS_LABELS } from '../../../lib/labels'

const MAX_PHOTOS = 6

// Admin → Steam → one game (2026-10-07): any Steam publisher manages any Steam game — keys (stock),
// photos and store details — and publishes or pauses it. Staff edits apply as-is (no re-review).
export default function AdminSteamGame() {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  const [game, setGame] = useState<ListingForEdit | null | undefined>(undefined)
  const [available, setAvailable] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [details, setDetails] = useState({ title: '', description: '', price: '' })
  const [facts, setFacts] = useState(EMPTY_STEAM_FACTS)
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  const apply = useCallback((g: ListingForEdit) => {
    setGame(g)
    setDetails({ title: g.title, description: g.description, price: String(g.priceWaveCoin ?? '') })
    setFacts(steamFactsFrom(g.itemAttributes as ItemAttributes | null))
  }, [])

  useEffect(() => {
    if (!id) return
    api
      .adminGetSteamGame(id)
      .then(apply)
      .catch((err) => {
        setGame(null)
        setError(errorMessage(err, 'თამაში ვერ მოიძებნა.'))
      })
  }, [id, apply])

  const run = async (fn: () => Promise<ListingForEdit | unknown>, ok: string) => {
    setBusy(true)
    setNotice(null)
    try {
      const result = await fn()
      if (result && typeof result === 'object' && 'itemAttributes' in result) apply(result as ListingForEdit)
      else apply(await api.adminGetSteamGame(id))
      setNotice({ kind: 'success', text: ok })
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error && !('status' in err) ? err.message : errorMessage(err, 'მოქმედება ვერ შესრულდა.') })
    } finally {
      setBusy(false)
    }
  }

  const saveDetails = () => {
    const title = details.title.trim()
    const description = details.description.trim()
    const price = Number(details.price)
    if (title.length < 5 || title.length > 100) return setNotice({ kind: 'error', text: 'სათაური უნდა იყოს 5–100 სიმბოლო.' })
    if (description.length < 50 || description.length > 5000) return setNotice({ kind: 'error', text: 'აღწერა უნდა იყოს 50–5000 სიმბოლო.' })
    if (!Number.isInteger(price) || price < 1) return setNotice({ kind: 'error', text: 'ფასი უნდა იყოს მთელი რიცხვი, მინიმუმ 1 GEL.' })
    const attributes = steamFactsToAttributes(facts, price)
    if (typeof attributes === 'string') return setNotice({ kind: 'error', text: attributes })
    void run(() => api.adminUpdateSteamGame(id, { title, description, priceWaveCoin: price, attributes }), 'დეტალები შენახულია.')
  }

  const addPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return
    void run(async () => {
      for (const file of Array.from(files)) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > PHOTO_SOURCE_MAX_BYTES) {
          throw new Error('ფოტო: JPG, PNG ან WEBP, მაქსიმუმ 20MB — დიდი ფოტო ავტომატურად მცირდება 2MB-მდე.')
        }
        await api.adminUploadSteamImage(id, file)
      }
    }, 'ფოტო დაემატა.')
  }

  if (game === undefined) {
    return (
      <AdminLayout title="Steam თამაში">
        <div className="empty-state">იტვირთება…</div>
      </AdminLayout>
    )
  }
  if (game === null) {
    return (
      <AdminLayout title="Steam თამაში">
        <Link className="st-back" href="/admin/steam">
          ← Steam თამაშები
        </Link>
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      </AdminLayout>
    )
  }

  const live = game.status === ListingStatus.Active
  const cover = game.images[0]?.url ?? null
  return (
    <AdminLayout title={`${game.title} — Steam`}>
      <Link className="st-back" href="/admin/steam">
        ← Steam თამაშები
      </Link>

      <header className="st-hero">
        <span className="st-hero-cover" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} aria-hidden="true" />
        <div className="st-hero-copy">
          <span className={`st-status ${game.status}`}>{LISTING_STATUS_LABELS[game.status] ?? game.status}</span>
          <h1>{game.title}</h1>
          <p>{`${game.priceWaveCoin ?? '—'} GEL · მარაგში ${available ?? '…'} გასაღები · დაამატა @${game.sellerUsername}`}</p>
          {game.status === ListingStatus.Rejected && game.rejectionReason && <p className="st-warn">{`მოხსნის მიზეზი: ${game.rejectionReason}`}</p>}
        </div>
        <div className="st-hero-actions">
          {live ? (
            <button type="button" className="button ghost" disabled={busy} onClick={() => void run(() => api.adminPauseSteamGame(id), 'თამაში შეჩერდა — მაღაზიაში აღარ ჩანს.')}>
              შეჩერება
            </button>
          ) : (
            <button
              type="button"
              className="button"
              disabled={busy || !available}
              title={available ? undefined : 'ჯერ დაამატე მინიმუმ ერთი გასაღები'}
              onClick={() => void run(() => api.adminPublishSteamGame(id), 'გამოქვეყნდა — თამაში ჩანს Steam გვერდზე.')}
            >
              გამოქვეყნება
            </button>
          )}
          {live && (
            <Link className="button ghost" href={`/listings/${game.id}`} target="_blank">
              საიტზე ნახვა
            </Link>
          )}
        </div>
      </header>
      {!live && !available && <p className="st-hint">გამოსაქვეყნებლად ჯერ დაამატე გასაღებები ქვემოთ.</p>}

      {notice && (
        <div className={`status-text ${notice.kind === 'error' ? 'status-error' : 'status-success'}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </div>
      )}

      <div className="st-grid">
        <AdminKeyInventory listingId={game.id} onChange={setAvailable} />

        <section className="detail-section st-photos">
          <h2>{`ფოტოები (${game.images.length}/${MAX_PHOTOS})`}</h2>
          <p className="note">პირველი ფოტო ქავერია — Steam გვერდზე და ბარათებზე ის ჩანს.</p>
          <div className="steam-photo-grid">
            {game.images.map((img, index) => (
              <figure key={img.id} style={{ backgroundImage: `url("${img.url}")` }}>
                <button type="button" aria-label="ფოტოს წაშლა" disabled={busy} onClick={() => void run(() => api.adminRemoveSteamImage(id, img.id), 'ფოტო წაიშალა.')}>
                  ×
                </button>
                {index === 0 ? (
                  <span className="steam-photo-main">მთავარი</span>
                ) : (
                  <button type="button" className="steam-photo-make-main" disabled={busy} onClick={() => void run(() => api.adminSetSteamCover(id, img.id), 'მთავარი ფოტო შეიცვალა.')}>
                    მთავარად დაყენება
                  </button>
                )}
              </figure>
            ))}
            {game.images.length < MAX_PHOTOS && (
              <label className="steam-photo-add">
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy} onChange={(e) => addPhotos(e.target.files)} />
                <span>{busy ? '…' : '+ ფოტო'}</span>
              </label>
            )}
          </div>
        </section>
      </div>

      <form
        className="stack-form detail-section st-details"
        onSubmit={(event) => {
          event.preventDefault()
          saveDetails()
        }}
      >
        <h2>დეტალები</h2>
        <div className="st-two">
          <label className="field">
            სათაური
            <input maxLength={100} value={details.title} onChange={(e) => setDetails((d) => ({ ...d, title: e.target.value }))} />
          </label>
          <label className="field">
            ფასი (GEL)
            <input type="number" min={1} step={1} value={details.price} onChange={(e) => setDetails((d) => ({ ...d, price: e.target.value }))} />
          </label>
        </div>
        <label className="field">
          აღწერა
          <textarea rows={5} maxLength={5000} value={details.description} onChange={(e) => setDetails((d) => ({ ...d, description: e.target.value }))} />
        </label>
        <SteamFactsFields facts={facts} onChange={setFacts} />
        <button type="submit" className="button" disabled={busy}>
          {busy ? 'ინახება…' : 'დეტალების შენახვა'}
        </button>
      </form>
    </AdminLayout>
  )
}
