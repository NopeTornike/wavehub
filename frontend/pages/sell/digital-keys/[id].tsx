import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { SellerListingKeySummary } from '@wavehub/shared-types'
import Layout from '../../../components/Layout'
import { api, ApiError } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'

const STATUS_LABELS: Record<string, string> = {
  available: 'ხელმისაწვდომი',
  sold: 'გაყიდულია',
  revoked: 'გაუქმებულია',
}

export default function ManageDigitalKeyListing() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user, checked } = useAuth()

  const [listing, setListing] = useState<any>(null)
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

  const reload = () => {
    if (!id) return
    setLoading(true)
    setError('')
    Promise.all([
      api.listMyListings().then((rows) => (rows as any[]).find((row) => row.id === id) ?? null),
      api.listListingKeys(id),
    ])
      .then(([found, keyRows]) => {
        setListing(found)
        setKeys(keyRows)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!user || !id) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id])

  const uploadKeys = async () => {
    if (!id) return
    const parsed = keysText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (parsed.length === 0) return
    setUploadError('')
    setUploading(true)
    try {
      await api.addListingKeys(id, parsed)
      setKeysText('')
      reload()
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'ატვირთვა ვერ მოხერხდა.')
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
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'გაგზავნა ვერ მოხერხდა.')
    } finally {
      setSubmitting(false)
    }
  }

  const removeKey = async (keyId: string) => {
    if (!id) return
    setBusyKeyId(keyId)
    try {
      await api.removeListingKey(id, keyId)
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'წაშლა ვერ მოხერხდა.')
    } finally {
      setBusyKeyId(null)
    }
  }

  if (!user || loading) {
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

  if (error && !listing) {
    return (
      <Layout>
        <div className="page">
          <div className="page-inner">
            <div className="status-text status-error">{error}</div>
          </div>
        </div>
      </Layout>
    )
  }

  const availableCount = keys.filter((k) => k.status === 'available').length

  return (
    <Layout>
      <div className="page">
        <div className="page-inner">
          <Link href="/sell/digital-keys">← ჩემი ლისტინგები</Link>
          <h1 className="page-title" style={{ marginTop: 12 }}>
            {listing?.title}
          </h1>
          <p className="page-subtitle">
            სტატუსი: {listing?.status} · ფასი: {listing?.priceWaveCoin} WC · ხელმისაწვდომი გასაღები: {availableCount}
          </p>

          {error && <div className="status-text status-error">{error}</div>}

          {(listing?.status === 'draft' || listing?.status === 'rejected') && (
            <div className="admin-row" style={{ marginBottom: 24 }}>
              <div className="admin-row-main">
                <strong>გასაგზავნია განსახილველად</strong>
                <span className="note" style={{ margin: 0 }}>
                  გამოაქვეყნეთ ლისტინგი მას შემდეგ, რაც დაამატებთ გასაღებებს.
                </span>
              </div>
              <button type="button" className="button" disabled={submitting} onClick={submitForReview}>
                {submitting ? 'იგზავნება…' : 'გაგზავნა განხილვისთვის'}
              </button>
            </div>
          )}

          <div className="admin-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, marginBottom: 32 }}>
            <h2 style={{ fontSize: '1rem', margin: 0 }}>გასაღებების დამატება</h2>
            <p className="note" style={{ margin: 0 }}>
              ჩასვით ერთი გასაღები თითო ხაზზე.
            </p>
            {uploadError && <div className="status-text status-error">{uploadError}</div>}
            <textarea
              placeholder={'XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY'}
              value={keysText}
              onChange={(e) => setKeysText(e.target.value)}
              rows={6}
            />
            <button type="button" className="button" disabled={uploading} onClick={uploadKeys}>
              {uploading ? 'იტვირთება…' : 'გასაღებების ატვირთვა'}
            </button>
          </div>

          <h2 style={{ fontSize: '1rem' }}>ინვენტარი ({keys.length})</h2>
          {keys.length === 0 ? (
            <div className="empty-state">გასაღებები ჯერ არ დამატებულა.</div>
          ) : (
            <div className="order-list">
              {keys.map((k) => (
                <div key={k.id} className="admin-row">
                  <div className="admin-row-main">
                    <strong>{STATUS_LABELS[k.status] ?? k.status}</strong>
                    <span className="note" style={{ margin: 0 }}>
                      დამატებულია: {new Date(k.createdAt).toLocaleString('ka-GE')}
                      {k.soldAt && ` · გაყიდულია: ${new Date(k.soldAt).toLocaleString('ka-GE')}`}
                    </span>
                  </div>
                  {k.status === 'available' && (
                    <div className="admin-row-actions">
                      <button type="button" className="button" disabled={busyKeyId === k.id} onClick={() => removeKey(k.id)}>
                        წაშლა
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
