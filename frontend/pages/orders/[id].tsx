import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicOrderDetail } from '@wavehub/shared-types'
import { OrderStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PendingPayment]: 'გადახდის მოლოდინში',
  [OrderStatus.Paid]: 'გადახდილია',
  [OrderStatus.InProgress]: 'მიმდინარეობს',
  [OrderStatus.Delivered]: 'მიწოდებულია',
  [OrderStatus.Completed]: 'დასრულებულია',
  [OrderStatus.Cancelled]: 'გაუქმებულია',
  [OrderStatus.Refunded]: 'თანხა დაბრუნებულია',
  [OrderStatus.Disputed]: 'დავის პროცესშია',
  [OrderStatus.Expired]: 'ვადაგასულია',
}

export default function OrderDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me } = useAuth()

  const [order, setOrder] = useState<PublicOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  const [revisionReason, setRevisionReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewSubmitted, setReviewSubmitted] = useState(false)

  const reload = () => {
    if (!id) return Promise.resolve()
    return api.getOrder(id).then(setOrder)
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .getOrder(id)
      .then((data) => {
        if (!cancelled) setOrder(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'შეკვეთის ჩატვირთვა ვერ მოხერხდა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const runAction = async (action: () => Promise<unknown>) => {
    setActionError('')
    setBusy(true)
    try {
      await action()
      await reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'მოქმედება ვერ შესრულდა.')
    } finally {
      setBusy(false)
    }
  }

  const uploadFile = async (event: FormEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file || !id) return
    await runAction(() => api.addDeliveryFile(id, file))
    event.currentTarget.value = ''
  }

  const submitReview = async (event: FormEvent) => {
    event.preventDefault()
    if (!id) return
    setActionError('')
    setBusy(true)
    try {
      await api.createReview({ orderId: id, rating: reviewRating, body: reviewBody || undefined })
      setReviewSubmitted(true)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'შეფასების გაგზავნა ვერ მოხერხდა.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="page">
          <div className="page-inner empty-state">იტვირთება…</div>
        </div>
      </Layout>
    )
  }

  if (error || !order) {
    return (
      <Layout>
        <div className="page">
          <div className="page-inner empty-state">{error || 'შეკვეთა ვერ მოიძებნა.'}</div>
        </div>
      </Layout>
    )
  }

  const isBuyer = me?.id === order.buyer.id
  const isSeller = me?.id === order.seller.id

  return (
    <Layout>
      <div className="page">
        <div className="page-inner" style={{ maxWidth: 760 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 className="page-title" style={{ marginBottom: 4 }}>
                {order.listing.title}
              </h1>
              <span className="note">
                {order.orderNumber}
                {order.package ? ` · ${order.package.name}` : ''}
              </span>
            </div>
            <span className={`order-status order-status-${order.status}`}>{STATUS_LABELS[order.status]}</span>
          </div>

          <div className="order-section">
            <h2>დეტალები</h2>
            <p>
              მყიდველი: @{order.buyer.username} · გამყიდველი: @{order.seller.username}
            </p>
            <p>ფასი: {order.priceWaveCoin} WC</p>
            {isSeller && (
              <p className="note">
                პლატფორმის საკომისიო: {order.platformFeeWaveCoin} WC · თქვენი შემოსავალი:{' '}
                {order.sellerPayoutWaveCoin} WC
              </p>
            )}
            {order.deliveryDueAt && (
              <p className="note">მიწოდების ვადა: {new Date(order.deliveryDueAt).toLocaleString('ka-GE')}</p>
            )}
            {order.autoCompleteAt && order.status === OrderStatus.Delivered && (
              <p className="note">
                ავტომატურად დასრულდება: {new Date(order.autoCompleteAt).toLocaleString('ka-GE')}
              </p>
            )}
            {order.cancellationReason && <p className="note">გაუქმების მიზეზი: {order.cancellationReason}</p>}
            {order.revisionReason && <p className="note">გადასამუშავებელი შენიშვნა: {order.revisionReason}</p>}
          </div>

          {order.requirementsAnswers && Object.keys(order.requirementsAnswers).length > 0 && (
            <div className="order-section">
              <h2>მყიდველის პასუხები</h2>
              <ul>
                {Object.entries(order.requirementsAnswers).map(([key, value]) => (
                  <li key={key}>
                    {key}: {String(value)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="order-section">
            <h2>მიწოდებული ფაილები</h2>
            {order.deliveryFiles.length === 0 ? (
              <p className="note">ფაილები ჯერ არ არის.</p>
            ) : (
              <div className="delivery-file-list">
                {order.deliveryFiles.map((file) => (
                  <div key={file.id} className="delivery-file-item">
                    <a href={file.fileUrl} target="_blank" rel="noreferrer">
                      {file.fileUrl.split('/').pop()}
                    </a>
                    <span className="note" style={{ margin: 0 }}>
                      {new Date(file.createdAt).toLocaleDateString('ka-GE')}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {isSeller && (order.status === OrderStatus.InProgress || order.status === OrderStatus.Delivered) && (
              <div style={{ marginTop: 12 }}>
                <input type="file" onChange={uploadFile} disabled={busy} />
              </div>
            )}
          </div>

          {actionError && (
            <div className="status-text status-error" style={{ marginTop: 16 }}>
              {actionError}
            </div>
          )}

          <div className="order-actions">
            {isSeller && order.status === OrderStatus.Paid && (
              <button className="button glow-on-hover" disabled={busy} onClick={() => runAction(() => api.startOrder(order.id))}>
                სამუშაოს დაწყება
              </button>
            )}
            {isSeller && order.status === OrderStatus.InProgress && (
              <button className="button glow-on-hover" disabled={busy} onClick={() => runAction(() => api.deliverOrder(order.id))}>
                მიწოდებულად მონიშვნა
              </button>
            )}
            {isBuyer && order.status === OrderStatus.Paid && (
              <button className="button" disabled={busy} onClick={() => runAction(() => api.cancelOrderAsBuyer(order.id))}>
                გაუქმება
              </button>
            )}
            {isSeller && (order.status === OrderStatus.Paid || order.status === OrderStatus.InProgress) && (
              <form
                style={{ display: 'flex', gap: 8 }}
                onSubmit={(event) => {
                  event.preventDefault()
                  runAction(() => api.cancelOrderAsSeller(order.id, cancelReason))
                }}
              >
                <input
                  className="input"
                  placeholder="გაუქმების მიზეზი"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  required
                />
                <button className="button" type="submit" disabled={busy}>
                  გაუქმება
                </button>
              </form>
            )}
            {isBuyer && order.status === OrderStatus.Delivered && (
              <>
                <button className="button glow-on-hover" disabled={busy} onClick={() => runAction(() => api.acceptDelivery(order.id))}>
                  მიღების დადასტურება
                </button>
                <form
                  style={{ display: 'flex', gap: 8 }}
                  onSubmit={(event) => {
                    event.preventDefault()
                    runAction(() => api.requestRevision(order.id, revisionReason))
                  }}
                >
                  <input
                    className="input"
                    placeholder="რა უნდა შესწორდეს?"
                    value={revisionReason}
                    onChange={(event) => setRevisionReason(event.target.value)}
                    required
                  />
                  <button className="button" type="submit" disabled={busy}>
                    გადამუშავება
                  </button>
                </form>
              </>
            )}
          </div>

          {isBuyer && order.status === OrderStatus.Completed && !reviewSubmitted && (
            <div className="order-section">
              <h2>შეფასების დატოვება</h2>
              <form onSubmit={submitReview}>
                <div className="form-group">
                  <label htmlFor="rating">შეფასება</label>
                  <select
                    id="rating"
                    className="input"
                    value={reviewRating}
                    onChange={(event) => setReviewRating(Number(event.target.value))}
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} ★
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="body">კომენტარი</label>
                  <textarea
                    id="body"
                    className="input"
                    value={reviewBody}
                    onChange={(event) => setReviewBody(event.target.value)}
                    placeholder="მინიმუმ 10 სიმბოლო (არასავალდებულო)"
                  />
                </div>
                <button className="button glow-on-hover" type="submit" disabled={busy}>
                  გაგზავნა
                </button>
              </form>
            </div>
          )}
          {reviewSubmitted && <p className="status-text status-success">მადლობა შეფასებისთვის!</p>}
        </div>
      </div>
    </Layout>
  )
}
