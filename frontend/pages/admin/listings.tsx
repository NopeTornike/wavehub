import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { AdminListingSummary, ListingForEdit } from '@wavehub/shared-types'
import { AdminRole, ListingType } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'
import { LISTING_STATUS_LABELS } from '../../lib/labels'
import { useAuth } from '../../lib/auth'

// Super Admin can open any listing in the full editor (/admin/listings/[id]).
function useCanEditListings() {
  return useAuth().user?.adminRole === AdminRole.SuperAdmin
}

function EditLink({ id }: { id: string }) {
  return (
    <Link className="button ghost" href={`/admin/listings/${id}`}>
      რედაქტირება
    </Link>
  )
}

const TYPE_LABELS: Record<ListingType, string> = {
  [ListingType.Service]: 'სერვისი',
  [ListingType.Item]: 'ნივთი',
  [ListingType.DigitalKey]: 'გასაღები',
}

export default function AdminListings() {
  const [tab, setTab] = useState<'queue' | 'all'>('queue')
  return (
    <AdminLayout title="განცხადებები">
      <div className="al-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'queue'} className={tab === 'queue' ? 'active' : ''} onClick={() => setTab('queue')}>
          დასამტკიცებელი
        </button>
        <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>
          ყველა განცხადება · რჩეული
        </button>
      </div>
      {tab === 'queue' ? <ReviewQueue /> : <AllListings />}
    </AdminLayout>
  )
}

// Every listing in any status, searchable by title or seller; staff pick which active ones the home
// page's "Featured Items" rail shows (POST admin/listings/:id/featured, audit-logged).
function AllListings() {
  const canEdit = useCanEditListings()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [onlyFeatured, setOnlyFeatured] = useState(false)
  const [items, setItems] = useState<AdminListingSummary[] | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    api
      .adminSearchListings({ q: search || undefined, featured: onlyFeatured ? true : undefined, limit: 100 })
      .then((data) => {
        if (cancelled) return
        setItems(data)
        setError('')
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
      })
    return () => {
      cancelled = true
    }
  }, [search, onlyFeatured])

  const toggle = async (item: AdminListingSummary) => {
    setBusyId(item.id)
    setError('')
    try {
      const res = await api.adminSetListingFeatured(item.id, !item.isFeatured)
      setItems((prev) => (prev ?? []).map((row) => (row.id === item.id ? { ...row, isFeatured: res.isFeatured } : row)))
    } catch (err) {
      setError(errorMessage(err, 'შენახვა ვერ მოხერხდა.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <h1 className="page-title">ყველა განცხადება</h1>
      <p className="page-subtitle">
        აირჩიე, რომელი აქტიური განცხადებები გამოჩნდეს მთავარ გვერდზე „რჩეულ პროდუქტებში“. მთავარ გვერდზე ჩანს პირველი 3.
      </p>
      <div className="al-toolbar">
        <input type="search" placeholder="სათაური ან გამყიდველი…" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} aria-label="ძიება" />
        <label className="al-check">
          <input type="checkbox" checked={onlyFeatured} onChange={(e) => setOnlyFeatured(e.target.checked)} />
          <span>მხოლოდ რჩეული</span>
        </label>
      </div>
      {error && <div className="status-text status-error" role="alert">{error}</div>}
      {items === null ? (
        <div className="empty-state">იტვირთება…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">განცხადებები ვერ მოიძებნა.</div>
      ) : (
        <div className="order-list">
          {items.map((item) => (
            <div key={item.id} className={`admin-row${item.isFeatured ? ' al-featured' : ''}`}>
              <div className="admin-row-main">
                <strong>
                  {item.isFeatured && <span className="al-star" aria-hidden="true">★ </span>}
                  {item.title}
                </strong>
                <span className="note" style={{ margin: 0 }}>
                  @{item.sellerUsername} · {TYPE_LABELS[item.type]} · {LISTING_STATUS_LABELS[item.status]}
                  {item.gameName ? ` · ${item.gameName}` : ''}
                  {item.priceWaveCoin != null ? ` · ${item.priceWaveCoin} GEL` : ''}
                </span>
              </div>
              <div className="admin-row-actions">
                <a className="button ghost" href={`/listings/${item.id}`} target="_blank" rel="noreferrer noopener">
                  ნახვა
                </a>
                {canEdit && <EditLink id={item.id} />}
                <button type="button" className="button" disabled={busyId === item.id} aria-pressed={Boolean(item.isFeatured)} onClick={() => void toggle(item)}>
                  {item.isFeatured ? 'რჩეულიდან ამოღება' : 'რჩეულად მონიშვნა'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function ReviewQueue() {
  const canEdit = useCanEditListings()
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
    <>
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
                {canEdit && <EditLink id={item.id} />}
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
    </>
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
