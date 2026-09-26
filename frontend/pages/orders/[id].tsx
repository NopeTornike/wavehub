import { useRouter } from 'next/router'
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import type { PublicDispute, PublicMessage, PublicOrderDetail } from '@wavehub/shared-types'
import { AdminRole, DisputeResolution, DisputeStatus, ListingType, MessageType, OrderStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const MESSAGE_POLL_MS = 5000

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

const DISPUTABLE_STATUSES = [OrderStatus.Paid, OrderStatus.InProgress, OrderStatus.Delivered]

const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  [DisputeStatus.Open]: 'გახსნილია',
  [DisputeStatus.UnderReview]: 'განიხილება',
  [DisputeStatus.WaitingForEvidence]: 'მტკიცებულებების მოლოდინში',
  [DisputeStatus.Resolved]: 'გადაწყვეტილია',
  [DisputeStatus.Closed]: 'დახურულია',
}

// Only Super Admin can resolve (see backend/src/disputes/disputes.controller.ts#resolve) — the
// three outcomes DisputesService actually implements.
const RESOLUTION_LABELS: Record<DisputeResolution, string> = {
  [DisputeResolution.ReleaseToSeller]: 'თანხის გადარიცხვა გამყიდველზე',
  [DisputeResolution.RefundBuyer]: 'თანხის დაბრუნება მყიდველზე',
  [DisputeResolution.CancelOrder]: 'შეკვეთის გაუქმება',
}

export default function OrderDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me, checked, refresh } = useAuth()

  const [order, setOrder] = useState<PublicOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [revealError, setRevealError] = useState('')
  const [revealing, setRevealing] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)

  const [revisionReason, setRevisionReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [reviewError, setReviewError] = useState('')

  const [messages, setMessages] = useState<PublicMessage[]>([])
  const [draftMessage, setDraftMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [chatError, setChatError] = useState('')

  const [dispute, setDispute] = useState<PublicDispute | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeDraftMessage, setDisputeDraftMessage] = useState('')
  const [disputeBusy, setDisputeBusy] = useState(false)
  const [disputeError, setDisputeError] = useState('')
  const [resolveNote, setResolveNote] = useState('')

  useEffect(() => {
    if (checked && !me && id) {
      router.push(`/login?next=${encodeURIComponent(`/orders/${id}`)}`)
    }
  }, [checked, me, id, router])

  const reload = () => {
    if (!id) return Promise.resolve()
    return api.getOrder(id).then(setOrder)
  }

  const isSuperAdmin = me?.adminRole === AdminRole.SuperAdmin

  const reloadDispute = () => {
    if (!id) return Promise.resolve()
    // 404 just means no dispute has ever been opened for this order — not an error state.
    // getDispute is participant-only server-side; a Super Admin viewing an order they're not the
    // buyer/seller of falls back to the admin-guarded route instead of getting stuck on the
    // resulting 403.
    return api
      .getDispute(id)
      .then(setDispute)
      .catch(() => {
        if (!isSuperAdmin) {
          setDispute(null)
          return
        }
        return api
          .adminGetDispute(id)
          .then(setDispute)
          .catch(() => setDispute(null))
      })
  }

  const resolveDispute = async (resolution: DisputeResolution) => {
    if (!id) return
    if (!resolveNote.trim()) {
      setDisputeError('დაამატეთ შენიშვნა გადაწყვეტილებამდე.')
      return
    }
    setDisputeError('')
    setDisputeBusy(true)
    try {
      const updated = await api.adminResolveDispute(id, resolution, resolveNote.trim())
      setDispute(updated)
      setResolveNote('')
      await reload()
      // Resolution can refund/release WaveCoin — the viewer may be a party to this order.
      await refresh()
    } catch (err) {
      setDisputeError(errorMessage(err, 'გადაწყვეტა ვერ შესრულდა.'))
    } finally {
      setDisputeBusy(false)
    }
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
        setError(errorMessage(err, 'შეკვეთის ჩატვირთვა ვერ მოხერხდა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    reloadDispute()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const openDispute = async (event: FormEvent) => {
    event.preventDefault()
    if (!id) return
    setDisputeError('')
    setDisputeBusy(true)
    try {
      const opened = await api.openDispute(id, disputeReason)
      setDispute(opened)
      setDisputeReason('')
      await reload()
    } catch (err) {
      setDisputeError(errorMessage(err, 'დავის გახსნა ვერ მოხერხდა.'))
    } finally {
      setDisputeBusy(false)
    }
  }

  const sendDisputeMessage = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || !disputeDraftMessage.trim()) return
    setDisputeError('')
    setDisputeBusy(true)
    try {
      const updated = await api.addDisputeMessage(id, disputeDraftMessage.trim())
      setDispute(updated)
      setDisputeDraftMessage('')
    } catch (err) {
      setDisputeError(errorMessage(err, 'შეტყობინების გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setDisputeBusy(false)
    }
  }

  const uploadDisputeEvidence = async (event: ChangeEvent<HTMLInputElement>) => {
    // React nulls `event.currentTarget` after the first await, so grab the input up front.
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file || !id) return
    setDisputeError('')
    setDisputeBusy(true)
    try {
      const updated = await api.addDisputeEvidence(id, file)
      setDispute(updated)
    } catch (err) {
      setDisputeError(errorMessage(err, 'ფაილის ატვირთვა ვერ მოხერხდა.'))
    } finally {
      setDisputeBusy(false)
      input.value = ''
    }
  }

  // Polling, not WebSockets — matches the build plan's explicit "narrow scope first" call for
  // Order Chat (see backend/src/chat/CLAUDE.md). Runs regardless of order status; only stops when
  // the id changes or the page unmounts.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = () => {
      api
        .listMessages(id)
        .then((data) => {
          if (!cancelled) setMessages(data)
        })
        .catch(() => undefined)
    }
    load()
    const interval = setInterval(load, MESSAGE_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [id])

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || !draftMessage.trim()) return
    setChatError('')
    setSendingMessage(true)
    try {
      const message = await api.sendMessage(id, draftMessage.trim())
      setMessages((prev) => [...prev, message])
      setDraftMessage('')
    } catch (err) {
      setChatError(errorMessage(err, 'შეტყობინების გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setSendingMessage(false)
    }
  }

  const runAction = async (action: () => Promise<unknown>) => {
    setActionError('')
    setBusy(true)
    try {
      await action()
      await reload()
      // Accepting a delivery releases escrow to the seller, cancelling refunds the buyer — either
      // way the viewer's own WaveCoin balance may just have changed, so re-sync the topbar.
      await refresh()
    } catch (err) {
      setActionError(errorMessage(err, 'მოქმედება ვერ შესრულდა.'))
    } finally {
      setBusy(false)
    }
  }

  const revealKey = async () => {
    if (!id) return
    setRevealError('')
    setRevealing(true)
    try {
      const { key } = await api.getOrderKey(id)
      setRevealedKey(key)
    } catch (err) {
      setRevealError(errorMessage(err, 'გასაღების ჩვენება ვერ მოხერხდა.'))
    } finally {
      setRevealing(false)
    }
  }

  const messageOtherParty = async (otherUserId: string) => {
    setActionError('')
    setBusy(true)
    try {
      const conversation = await api.startDirectConversation(otherUserId)
      router.push(`/messages?conversation=${conversation.id}`)
    } catch (err) {
      setActionError(errorMessage(err, 'საუბრის დაწყება ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  const uploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file || !id) return
    await runAction(() => api.addDeliveryFile(id, file))
    input.value = ''
  }

  const copyKey = async () => {
    if (!revealedKey) return
    try {
      await navigator.clipboard.writeText(revealedKey)
      setKeyCopied(true)
      setTimeout(() => setKeyCopied(false), 2000)
    } catch {
      setRevealError('კოპირება ვერ მოხერხდა — მონიშნეთ გასაღები და დააკოპირეთ ხელით.')
    }
  }

  const submitReview = async (event: FormEvent) => {
    event.preventDefault()
    if (!id) return
    setReviewError('')
    const body = reviewBody.trim()
    if (body && body.length < 10) {
      setReviewError('კომენტარი უნდა იყოს მინიმუმ 10 სიმბოლო (ან დატოვეთ ცარიელი).')
      return
    }
    setActionError('')
    setBusy(true)
    try {
      await api.createReview({ orderId: id, rating: reviewRating, body: body || undefined })
      setReviewSubmitted(true)
    } catch (err) {
      setActionError(errorMessage(err, 'შეფასების გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading || (checked && !me)) {
    return (
      <Layout title="შეკვეთა" noIndex>
        <div className="page">
          <div className="page-inner empty-state">იტვირთება…</div>
        </div>
      </Layout>
    )
  }

  if (error || !order) {
    return (
      <Layout title="შეკვეთა" noIndex>
        <div className="page">
          <div className="page-inner empty-state">{error || 'შეკვეთა ვერ მოიძებნა.'}</div>
        </div>
      </Layout>
    )
  }

  const isBuyer = me?.id === order.buyer.id
  const isSeller = me?.id === order.seller.id

  return (
    <Layout title={`შეკვეთა ${order.orderNumber}`} noIndex>
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
            <p>ფასი: {order.priceWaveCoin} GEL</p>
            {isSeller && (
              <p className="note">
                პლატფორმის საკომისიო: {order.platformFeeWaveCoin} GEL · თქვენი შემოსავალი:{' '}
                {order.sellerPayoutWaveCoin} GEL
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
            {isBuyer && (
              <button type="button" className="button" disabled={busy} onClick={() => messageOtherParty(order.seller.id)}>
                გამყიდველისთვის მესიჯის გაგზავნა
              </button>
            )}
            {isSeller && (
              <button type="button" className="button" disabled={busy} onClick={() => messageOtherParty(order.buyer.id)}>
                მყიდველისთვის მესიჯის გაგზავნა
              </button>
            )}
            {order.revisionReason && <p className="note">გადასამუშავებელი შენიშვნა: {order.revisionReason}</p>}
          </div>

          {isBuyer && order.listing.type === ListingType.DigitalKey && (
            <div className="order-section">
              <h2>გასაღები</h2>
              {revealError && <div className="status-text status-error" role="alert">{revealError}</div>}
              {revealedKey ? (
                <div className="key-reveal">
                  <code aria-label="თქვენი გასაღები">{revealedKey}</code>
                  <button type="button" className="button" onClick={copyKey}>
                    {keyCopied ? 'დაკოპირდა ✓' : 'კოპირება'}
                  </button>
                  <button type="button" className="button" onClick={() => setRevealedKey(null)}>
                    დამალვა
                  </button>
                </div>
              ) : (
                <>
                  <p className="note" style={{ marginTop: 0 }}>
                    გასაღები მხოლოდ თქვენთვის ჩანს. ნახეთ და შეინახეთ უსაფრთხო ადგილას.
                  </p>
                  <button type="button" className="button" disabled={revealing} onClick={revealKey}>
                    {revealing ? 'მიმდინარეობს…' : 'გასაღების ჩვენება'}
                  </button>
                </>
              )}
            </div>
          )}

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
                <input type="file" aria-label="მიწოდების ფაილის ატვირთვა" onChange={uploadFile} disabled={busy} />
              </div>
            )}
          </div>

          <div className="order-section">
            <h2>დისკუსია</h2>
            <div className="chat-panel">
              <div className="chat-messages" role="log" aria-live="polite" aria-label="შეკვეთის დისკუსია">
                {messages.length === 0 ? (
                  <p className="note" style={{ margin: 0 }}>
                    შეტყობინებები ჯერ არ არის.
                  </p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`chat-message${
                        message.type === MessageType.System
                          ? ' chat-message-system'
                          : message.senderId === me?.id
                            ? ' chat-message-mine'
                            : ''
                      }`}
                    >
                      {message.type !== MessageType.System && message.senderId !== me?.id && (
                        <strong>@{message.senderUsername} </strong>
                      )}
                      {message.body}
                      <span className="chat-message-meta">
                        {new Date(message.createdAt).toLocaleTimeString('ka-GE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <form className="chat-form" onSubmit={sendMessage}>
                <input
                  className="input"
                  placeholder="დაწერეთ შეტყობინება…"
                  aria-label="შეტყობინება"
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  disabled={sendingMessage}
                />
                <button className="button glow-on-hover" type="submit" disabled={sendingMessage || !draftMessage.trim()}>
                  გაგზავნა
                </button>
              </form>
            </div>
            {chatError && (
              <div className="status-text status-error" style={{ marginTop: 8 }}>
                {chatError}
              </div>
            )}
          </div>

          {(isBuyer || isSeller || isSuperAdmin) && (
            <div className="order-section">
              <h2>დავა</h2>
              {disputeError && <div className="status-text status-error" role="alert">{disputeError}</div>}

              {dispute ? (
                <>
                  <p>
                    სტატუსი: <strong>{DISPUTE_STATUS_LABELS[dispute.status]}</strong>
                  </p>
                  <p className="note">მიზეზი: {dispute.reason}</p>
                  {dispute.status === DisputeStatus.Resolved && (
                    <p className="note">გადაწყვეტილება: {dispute.resolutionNote}</p>
                  )}

                  <div className="chat-panel" style={{ marginTop: 12 }}>
                    <div className="chat-messages">
                      {dispute.messages.length === 0 ? (
                        <p className="note" style={{ margin: 0 }}>
                          შეტყობინებები ჯერ არ არის.
                        </p>
                      ) : (
                        dispute.messages.map((message) => (
                          <div
                            key={message.id}
                            className={`chat-message${message.senderId === me?.id ? ' chat-message-mine' : ''}`}
                          >
                            {message.senderId !== me?.id && <strong>@{message.senderUsername} </strong>}
                            {message.body}
                          </div>
                        ))
                      )}
                    </div>
                    {(isBuyer || isSeller) &&
                      dispute.status !== DisputeStatus.Resolved &&
                      dispute.status !== DisputeStatus.Closed && (
                        <form className="chat-form" onSubmit={sendDisputeMessage}>
                          <input
                            className="input"
                            placeholder="დაწერეთ შეტყობინება…"
                            aria-label="შეტყობინება დავაზე"
                            value={disputeDraftMessage}
                            onChange={(event) => setDisputeDraftMessage(event.target.value)}
                            disabled={disputeBusy}
                          />
                          <button
                            className="button glow-on-hover"
                            type="submit"
                            disabled={disputeBusy || !disputeDraftMessage.trim()}
                          >
                            გაგზავნა
                          </button>
                        </form>
                      )}
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <h2 style={{ fontSize: '1rem' }}>მტკიცებულებები</h2>
                    {dispute.evidence.length === 0 ? (
                      <p className="note">მტკიცებულებები ჯერ არ არის.</p>
                    ) : (
                      <div className="delivery-file-list">
                        {dispute.evidence.map((file) => (
                          <div key={file.id} className="delivery-file-item">
                            <a href={file.fileUrl} target="_blank" rel="noreferrer">
                              {file.fileUrl.split('/').pop()}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                    {(isBuyer || isSeller) &&
                      dispute.status !== DisputeStatus.Resolved &&
                      dispute.status !== DisputeStatus.Closed && (
                        <div style={{ marginTop: 8 }}>
                          <input type="file" aria-label="მტკიცებულების ატვირთვა" onChange={uploadDisputeEvidence} disabled={disputeBusy} />
                        </div>
                      )}
                  </div>

                  {isSuperAdmin && dispute.status === DisputeStatus.Open && (
                    <div className="order-section">
                      <h2 style={{ fontSize: '1rem' }}>დავის გადაწყვეტა</h2>
                      <div className="form-group">
                        <label htmlFor="resolveNote">შენიშვნა გადაწყვეტილებაზე</label>
                        <textarea
                          id="resolveNote"
                          className="input"
                          value={resolveNote}
                          onChange={(event) => setResolveNote(event.target.value)}
                          placeholder="დაასაბუთეთ გადაწყვეტილება — ჩანს ორივე მხარისთვის"
                        />
                      </div>
                      <div className="order-actions">
                        {Object.values(DisputeResolution).map((resolution) => (
                          <button
                            key={resolution}
                            type="button"
                            className="button"
                            disabled={disputeBusy || !resolveNote.trim()}
                            onClick={() => resolveDispute(resolution)}
                          >
                            {RESOLUTION_LABELS[resolution]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                (isBuyer || isSeller) &&
                DISPUTABLE_STATUSES.includes(order.status) && (
                  <form onSubmit={openDispute}>
                    <div className="form-group">
                      <label htmlFor="disputeReason">
                        თუ პრობლემა გაქვთ ამ შეკვეთასთან დაკავშირებით, შეგიძლიათ დავის გახსნა
                      </label>
                      <textarea
                        id="disputeReason"
                        className="input"
                        value={disputeReason}
                        onChange={(event) => setDisputeReason(event.target.value)}
                        placeholder="აღწერეთ პრობლემა (მინიმუმ 10 სიმბოლო)"
                        required
                      />
                    </div>
                    <button className="button" type="submit" disabled={disputeBusy || disputeReason.trim().length < 10}>
                      დავის გახსნა
                    </button>
                  </form>
                )
              )}
            </div>
          )}

          {actionError && (
            <div className="status-text status-error" role="alert" style={{ marginTop: 16 }}>
              {actionError}
            </div>
          )}

          <div className="order-actions">
            {isSeller && order.status === OrderStatus.Paid && (
              <button type="button" className="button glow-on-hover" disabled={busy} onClick={() => runAction(() => api.startOrder(order.id))}>
                სამუშაოს დაწყება
              </button>
            )}
            {isSeller && order.status === OrderStatus.InProgress && (
              <button type="button" className="button glow-on-hover" disabled={busy} onClick={() => runAction(() => api.deliverOrder(order.id))}>
                მიწოდებულად მონიშვნა
              </button>
            )}
            {isBuyer && order.status === OrderStatus.Paid && (
              <button type="button" className="button" disabled={busy} onClick={() => runAction(() => api.cancelOrderAsBuyer(order.id))}>
                გაუქმება
              </button>
            )}
            {isSeller && (order.status === OrderStatus.Paid || order.status === OrderStatus.InProgress) && (
              <form
                className="chat-form-row"
                onSubmit={(event) => {
                  event.preventDefault()
                  runAction(() => api.cancelOrderAsSeller(order.id, cancelReason))
                }}
              >
                <input
                  className="input"
                  placeholder="გაუქმების მიზეზი"
                  aria-label="გაუქმების მიზეზი"
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
                <button type="button" className="button glow-on-hover" disabled={busy} onClick={() => runAction(() => api.acceptDelivery(order.id))}>
                  მიღების დადასტურება
                </button>
                <form
                  className="chat-form-row"
                  onSubmit={(event) => {
                    event.preventDefault()
                    runAction(() => api.requestRevision(order.id, revisionReason))
                  }}
                >
                  <input
                    className="input"
                    placeholder="რა უნდა შესწორდეს?"
                    aria-label="რა უნდა შესწორდეს"
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
                {reviewError && (
                  <div className="status-text status-error" role="alert">
                    {reviewError}
                  </div>
                )}
                <button className="button glow-on-hover" type="submit" disabled={busy}>
                  გაგზავნა
                </button>
              </form>
            </div>
          )}
          {reviewSubmitted && <p className="status-text status-success" role="status">მადლობა შეფასებისთვის!</p>}
        </div>
      </div>
    </Layout>
  )
}
