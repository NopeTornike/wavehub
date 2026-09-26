import { useEffect, useState } from 'react'
import type { AdminListingSummary, ListingForEdit } from '@wavehub/shared-types'
import { ListingType } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'

const TYPE_LABELS: Record<ListingType, string> = {
  [ListingType.Service]: 'სერვისი',
  [ListingType.Item]: 'ნივთი',
  [ListingType.DigitalKey]: 'გასაღები',
}

export default function AdminListings() {
  const [items, setItems] = useState<AdminListingSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  // Full content of the listing being reviewed (GET admin/listings/:id), keyed by id.
  const [previews, setPreviews] = useState<Record<string, ListingForEdit | 'loading'>>({})

  const togglePreview = async (id: string) => {
    if (previews[id]) {
      setPreviews(({ [id]: _closed, ...rest }) => rest)
      return
    }
    setPreviews((p) => ({ ...p, [id]: 'loading' }))
    try {
      const data = await api.adminGetListing(id)
      setPreviews((p) => ({ ...p, [id]: data }))
    } catch (err) {
      setPreviews(({ [id]: _failed, ...rest }) => rest)
      setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
    }
  }

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .adminListPendingListings()
      .then((data) => {
        if (!cancelled) setItems(data)
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

  const approve = async (id: string) => {
    setBusyId(id)
    try {
      await api.adminApproveListing(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(errorMessage(err, 'დამტკიცება ვერ მოხერხდა.'))
    } finally {
      setBusyId(null)
    }
  }

  const reject = async (id: string) => {
    const reason = window.prompt('უარყოფის მიზეზი:')
    if (!reason) return
    setBusyId(id)
    try {
      await api.adminRejectListing(id, reason)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(errorMessage(err, 'უარყოფა ვერ მოხერხდა.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout title="განცხადებები">
      <h1 className="page-title">დასამტკიცებელი განცხადებები</h1>
      <p className="page-subtitle">გამოქვეყნებამდე შემოწმებული განცხადებები</p>

      {error && <div className="status-text status-error" role="alert">{error}</div>}

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">ველოდები ახალ განცხადებებს.</div>
      ) : (
        <div className="order-list">
          {items.map((item) => (
            <div key={item.id} className="admin-row">
              <div className="admin-row-main">
                <strong>{item.title}</strong>
                <span className="note" style={{ margin: 0 }}>
                  @{item.sellerUsername} · {TYPE_LABELS[item.type]} · {item.categoryName}
                  {item.gameName ? ` · ${item.gameName}` : ''}
                </span>
              </div>
              <div className="admin-row-actions">
                <button type="button" className="button ghost" aria-expanded={Boolean(previews[item.id])} onClick={() => void togglePreview(item.id)}>
                  {previews[item.id] ? 'დახურვა' : 'დეტალები'}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busyId === item.id}
                  onClick={() => approve(item.id)}
                >
                  დამტკიცება
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busyId === item.id}
                  onClick={() => reject(item.id)}
                >
                  უარყოფა
                </button>
              </div>
              {previews[item.id] && <ListingPreview data={previews[item.id]} />}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

// What the moderator checks before approving: the full text, photos, and for a service its
// packages, buyer questions and FAQ; for items/keys the price and seller-entered facts.
function ListingPreview({ data }: { data: ListingForEdit | 'loading' }) {
  if (data === 'loading') return <div className="al-preview">იტვირთება…</div>
  return (
    <div className="al-preview">
      {data.images.length > 0 && (
        <div className="al-photos">
          {data.images.map((img) => (
            <a key={img.id} href={img.url} target="_blank" rel="noreferrer noopener" style={{ backgroundImage: `url("${img.url}")` }} aria-label="ფოტო" />
          ))}
        </div>
      )}
      <p className="al-description">{data.description}</p>
      {data.priceWaveCoin !== null && (
        <p>
          <span>ფასი:</span> <b>{data.priceWaveCoin} GEL</b>
        </p>
      )}
      {data.packages.length > 0 && (
        <div>
          <h4>პაკეტები</h4>
          <ul>
            {data.packages.map((p) => (
              <li key={p.id}>
                <b>{p.name}</b> — {p.priceWaveCoin} GEL · {p.deliveryTimeDays} <span>დღე</span> · {p.revisionsIncluded} <span>რევიზია</span>
                {p.features.length > 0 && <small> · {p.features.join(', ')}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.requirementsSchema.length > 0 && (
        <div>
          <h4>კითხვები მყიდველისთვის</h4>
          <ul>
            {data.requirementsSchema.map((f) => (
              <li key={f.key}>
                {f.label}
                {f.required ? ' *' : ''}
                {f.options?.length ? <small> ({f.options.join(', ')})</small> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.faq.length > 0 && (
        <div>
          <h4>FAQ</h4>
          <ul>
            {data.faq.map((e, i) => (
              <li key={i}>
                <b>{e.q}</b> — {e.a}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.itemAttributes && Object.keys(data.itemAttributes).length > 0 && (
        <div>
          <h4>დეტალები</h4>
          <ul>
            {Object.entries(data.itemAttributes).map(([k, v]) => (
              <li key={k}>
                <code>{k}</code>: {String(v)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
