import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import type { SellerListingKeySummary } from '@wavehub/shared-types'
import { KeyInventoryStatus, ListingStatus } from '@wavehub/shared-types'
import Layout from '../../../components/Layout'
import { api, errorMessage, type MyListing } from '../../../lib/api'
import { KEY_STATUS_LABELS, LISTING_STATUS_LABELS } from '../../../lib/labels'
import { useAuth } from '../../../lib/auth'
import SteamFactsFields, { EMPTY_STEAM_FACTS, steamFactsFrom, steamFactsToAttributes } from '../../../components/SteamFactsFields'

// Mirrors AddListingKeysDto: 1–500 keys per request, each 4–200 characters.
const MAX_KEYS_PER_UPLOAD = 500

export default function ManageDigitalKeyListing() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user, checked } = useAuth()
  const userId = user?.id

  const [listing, setListing] = useState<MyListing | null>(null)
  const [keys, setKeys] = useState<SellerListingKeySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keysText, setKeysText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyKeyId, setBusyKeyId] = useState<string | null>(null)
  const [facts, setFacts] = useState(EMPTY_STEAM_FACTS)
  const [factsStatus, setFactsStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })
  const [savingFacts, setSavingFacts] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)

  useEffect(() => {
    if (checked && !user) {
      router.push(`/login?next=/sell/digital-keys/${id ?? ''}`)
    }
  }, [checked, user, router, id])

  // Quiet reload: only the first load shows the full-page spinner, so the textarea/scroll position
  // isn't thrown away after every upload/remove.
  const reload = useCallback(() => {
    if (!id) return Promise.resolve()
    return Promise.all([api.listMyListings().then((rows) => rows.find((row) => row.id === id) ?? null), api.listListingKeys(id)])
      .then(([found, keyRows]) => {
        setListing(found)
        setFacts(steamFactsFrom(found?.itemAttributes))
        setKeys(keyRows)
        setError('')
      })
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!userId || !id) return
    void reload()
  }, [userId, id, reload])

  const uploadKeys = async () => {
    if (!id) return
    const parsed = keysText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (parsed.length === 0) {
      setUploadError('ჩასვით მინიმუმ ერთი გასაღები.')
      return
    }
    if (parsed.length > MAX_KEYS_PER_UPLOAD) {
      setUploadError(`ერთ ჯერზე მაქსიმუმ ${MAX_KEYS_PER_UPLOAD} გასაღების ატვირთვაა შესაძლებელი (ახლა: ${parsed.length}).`)
      return
    }
    const badLine = parsed.findIndex((key) => key.length < 4 || key.length > 200)
    if (badLine !== -1) {
      setUploadError(`გასაღები #${badLine + 1} უნდა იყოს 4–200 სიმბოლო.`)
      return
    }
    setUploadError('')
    setUploading(true)
    try {
      await api.addListingKeys(id, parsed)
      setKeysText('')
      await reload()
    } catch (err) {
      setUploadError(errorMessage(err, 'ატვირთვა ვერ მოხერხდა.'))
    } finally {
      setUploading(false)
    }
  }

  const submitForReview = async () => {
    if (!id) return
    setSubmitting(true)
    setError('')
    try {
      await api.submitListingForReview(id)
      await reload()
    } catch (err) {
      setError(errorMessage(err, 'გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setSubmitting(false)
    }
  }

  const removeKey = async (keyId: string) => {
    if (!id) return
    if (!window.confirm('წავშალოთ ეს გასაღები ინვენტარიდან?')) return
    setBusyKeyId(keyId)
    try {
      await api.removeListingKey(id, keyId)
      await reload()
    } catch (err) {
      setError(errorMessage(err, 'წაშლა ვერ მოხერხდა.'))
    } finally {
      setBusyKeyId(null)
    }
  }

  const saveFacts = async () => {
    if (!id || !listing) return
    const attributes = steamFactsToAttributes(facts, listing.priceWaveCoin ?? 0)
    if (typeof attributes === 'string') return setFactsStatus({ kind: 'error', text: attributes })
    setSavingFacts(true)
    try {
      await api.updateListing(id, { attributes })
      await reload()
      setFactsStatus({
        kind: 'success',
        text: listing.status === ListingStatus.Active || listing.status === ListingStatus.Paused ? 'შენახულია — განცხადება ხელახლა გადის შემოწმებას.' : 'შენახულია.',
      })
    } catch (err) {
      setFactsStatus({ kind: 'error', text: errorMessage(err, 'შენახვა ვერ მოხერხდა.') })
    } finally {
      setSavingFacts(false)
    }
  }

  const addPhotos = async (files: FileList | null) => {
    if (!id || !files || files.length === 0) return
    setPhotoBusy(true)
    setFactsStatus({ kind: '', text: '' })
    try {
      for (const file of Array.from(files)) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
          throw new Error('ფოტო უნდა იყოს PNG, JPG ან WEBP, მაქსიმუმ 5MB.')
        }
        await api.uploadListingImage(id, file)
      }
      await reload()
    } catch (err) {
      setFactsStatus({ kind: 'error', text: err instanceof Error && !('status' in err) ? err.message : errorMessage(err, 'ფოტოს ატვირთვა ვერ მოხერხდა.') })
    } finally {
      setPhotoBusy(false)
    }
  }

  const removePhoto = async (imageId: string) => {
    if (!id) return
    setPhotoBusy(true)
    try {
      await api.removeListingImage(id, imageId)
      await reload()
    } catch (err) {
      setFactsStatus({ kind: 'error', text: errorMessage(err, 'წაშლა ვერ მოხერხდა.') })
    } finally {
      setPhotoBusy(false)
    }
  }

  const title = 'გასაღებების მართვა'

  if (!user || loading) {
    return (
      <Layout title={title} noIndex>
        <div className="detail-page">
          <div className="marketplace-empty">იტვირთება…</div>
        </div>
      </Layout>
    )
  }

  if (!listing) {
    return (
      <Layout title={title} noIndex>
        <div className="detail-page">
          <Link className="detail-back-link" href="/sell/digital-keys">
            ← ჩემი განცხადებები
          </Link>
          <div className="status-text status-error" role="alert">
            {error || 'განცხადება ვერ მოიძებნა.'}
          </div>
        </div>
      </Layout>
    )
  }

  const availableCount = keys.filter((k) => k.status === KeyInventoryStatus.Available).length
  const canSubmit = listing.status === ListingStatus.Draft || listing.status === ListingStatus.Rejected

  return (
    <Layout title={`${listing.title} — ${title}`} noIndex>
      {/* Same net-new-page rationale as sell/digital-keys/index.tsx — `.detail-page` +
          `.detail-title-block` + `.detail-section`, replacing the legacy `.page`/`.page-inner`/
          `.page-title`/`.admin-row` bridge classes. */}
      <div className="detail-page">
        <Link className="detail-back-link" href="/sell/digital-keys">
          ← ჩემი განცხადებები
        </Link>

        <div className="detail-title-block">
          <p className="section-kicker">გასაღებების მართვა</p>
          <h1>{listing.title}</h1>
          <p>
            სტატუსი: {LISTING_STATUS_LABELS[listing.status] ?? listing.status} · ფასი: {listing.priceWaveCoin} GEL · ხელმისაწვდომი გასაღები: {availableCount}
          </p>
        </div>

        {error && (
          <div className="status-text status-error" role="alert">
            {error}
          </div>
        )}

        {canSubmit && (
          <section className="detail-section">
            <h2>{listing.status === ListingStatus.Rejected ? 'უარყოფილია — გაასწორეთ და თავიდან გაგზავნეთ' : 'გასაგზავნია განსახილველად'}</h2>
            <p className="note">
              გამოაქვეყნეთ განცხადება მას შემდეგ, რაც დაამატებთ გასაღებებს.
              {listing.status === ListingStatus.Rejected && listing.rejectionReason && ` მიზეზი: ${listing.rejectionReason}`}
            </p>
            <button type="button" className="detail-buy-button" disabled={submitting || availableCount === 0} onClick={submitForReview}>
              {submitting ? 'იგზავნება…' : 'გაგზავნა განხილვისთვის'}
            </button>
          </section>
        )}

        <section className="detail-section">
          <h2>თამაშის დეტალები და ფოტოები</h2>
          <p className="note">ჩანს Steam თამაშების გვერდზე. პირველი ფოტო — ქავერი (მაქს. 6).</p>
          <div className="steam-photo-grid">
            {(listing.images ?? []).map((img) => (
              <figure key={img.id} style={{ backgroundImage: `url("${img.url}")` }}>
                <button type="button" aria-label="ფოტოს წაშლა" disabled={photoBusy} onClick={() => void removePhoto(img.id)}>
                  ×
                </button>
              </figure>
            ))}
            {(listing.images?.length ?? 0) < 6 && (
              <label className="steam-photo-add">
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={photoBusy} onChange={(e) => void addPhotos(e.target.files)} />
                <span>{photoBusy ? '…' : '+ ფოტო'}</span>
              </label>
            )}
          </div>
          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault()
              void saveFacts()
            }}
          >
            <SteamFactsFields facts={facts} onChange={setFacts} />
            {factsStatus.text && (
              <p className={`seller-status ${factsStatus.kind}`} role={factsStatus.kind === 'error' ? 'alert' : undefined}>
                {factsStatus.text}
              </p>
            )}
            <button type="submit" className="detail-buy-button" disabled={savingFacts}>
              {savingFacts ? 'ინახება…' : 'დეტალების შენახვა'}
            </button>
          </form>
        </section>

        <section className="detail-section">
          <h2>გასაღებების დამატება</h2>
          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault()
              void uploadKeys()
            }}
          >
            {uploadError && (
              <div className="status-text status-error" role="alert">
                {uploadError}
              </div>
            )}
            <label className="field">
              გასაღებები <small>ჩასვით ერთი გასაღები თითო ხაზზე (მაქს. {MAX_KEYS_PER_UPLOAD})</small>
              <textarea
                placeholder={'XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY'}
                value={keysText}
                onChange={(e) => setKeysText(e.target.value)}
                rows={6}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <button type="submit" className="detail-buy-button" disabled={uploading}>
              {uploading ? 'იტვირთება…' : 'გასაღებების ატვირთვა'}
            </button>
          </form>
        </section>

        <section className="detail-section">
          <h2>ინვენტარი ({keys.length})</h2>
          {keys.length === 0 ? (
            <div className="orders-empty">გასაღებები ჯერ არ დამატებულა.</div>
          ) : (
            <div className="orders-list">
              {keys.map((k) => (
                // `.order-card` is a div here, not a Link — a key row has a destructive action
                // rather than a detail page to open. Never renders the key itself: the seller UI
                // only ever shows status + timestamps (see backend/src/listings/CLAUDE.md).
                <div key={k.id} className="order-card">
                  <span className="order-thumb" aria-hidden="true">
                    🔑
                  </span>
                  <div className="order-copy">
                    <div>
                      <span className="order-status">{KEY_STATUS_LABELS[k.status] ?? k.status}</span>
                    </div>
                    <span className="note" style={{ margin: 0 }}>
                      დამატებულია: {new Date(k.createdAt).toLocaleString('ka-GE')}
                      {k.soldAt && ` · გაყიდულია: ${new Date(k.soldAt).toLocaleString('ka-GE')}`}
                    </span>
                  </div>
                  <div className="order-side">
                    {k.status === KeyInventoryStatus.Available && (
                      <button type="button" className="button" disabled={busyKeyId === k.id} onClick={() => removeKey(k.id)}>
                        წაშლა
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
