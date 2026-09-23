import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import type { SellerListingKeySummary } from '@wavehub/shared-types'
import { KeyInventoryStatus, ListingStatus } from '@wavehub/shared-types'
import Layout from '../../../components/Layout'
import { api, errorMessage, type MyListing } from '../../../lib/api'
import { KEY_STATUS_LABELS, LISTING_STATUS_LABELS } from '../../../lib/labels'
import { useAuth } from '../../../lib/auth'

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
            სტატუსი: {LISTING_STATUS_LABELS[listing.status] ?? listing.status} · ფასი: {listing.priceWaveCoin} WC · ხელმისაწვდომი გასაღები: {availableCount}
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
