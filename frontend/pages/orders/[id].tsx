/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import type { PublicDispute, PublicMessage, PublicOrderDetail } from '@wavehub/shared-types'
import { AdminRole, DisputeResolution, DisputeStatus, ListingType, MessageType, OrderStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import OrderReview from '../../components/OrderReview'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { gel } from '../../lib/money'
import { gameCover } from '../../lib/games'
import { kaDateTime, kaTime } from '../../lib/dates'
import { LISTING_TYPE_LABELS } from '../../lib/labels'
import Avatar, { displayName } from '../../components/Avatar'
import VerifiedMark from '../../components/VerifiedMark'
import { usePlatformTimings } from '../../lib/timings'

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
// The dispute form's counter (design 2026-10-04: 0/500) — within the API's 10–2000 bound.
const DISPUTE_REASON_MAX = 500

function formatWhen(value: string) {
  return kaDateTime(value)
}

// Status pill colour, same rule as the orders list.
function orderTone(status: OrderStatus): 'ok' | 'wait' | 'bad' {
  if ([OrderStatus.Cancelled, OrderStatus.Refunded, OrderStatus.Disputed, OrderStatus.Expired].includes(status)) return 'bad'
  if (status === OrderStatus.PendingPayment) return 'wait'
  return 'ok'
}

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
  const timings = usePlatformTimings()

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
  // Evidence picked before the dispute exists — uploaded right after it opens.
  const [pendingEvidence, setPendingEvidence] = useState<File[]>([])

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
      let opened = await api.openDispute(id, disputeReason)
      for (const file of pendingEvidence) opened = await api.addDisputeEvidence(id, file)
      setDispute(opened)
      setDisputeReason('')
      setPendingEvidence([])
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

  // A photo/file in the order chat (design 2026-10-04: the composer's attach button).
  const sendAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file || !id) return
    setChatError('')
    setSendingMessage(true)
    try {
      const message = await api.sendOrderAttachment(id, file)
      setMessages((prev) => [...prev, message])
    } catch (err) {
      setChatError(errorMessage(err, 'ფაილის გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setSendingMessage(false)
      input.value = ''
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

  const otherParty = isBuyer ? order.seller : order.buyer
  const cover = order.listing.imageUrl ?? gameCover(order.listing.gameSlug)
  const isKey = order.listing.type === ListingType.DigitalKey
  // The auto-complete window: a delivered order's own stored one, otherwise the current setting.
  const autoHours =
    order.deliveredAt && order.autoCompleteAt
      ? Math.round((new Date(order.autoCompleteAt).getTime() - new Date(order.deliveredAt).getTime()) / 3_600_000)
      : (timings?.orderAutoCompleteHours ?? null)
  const isService = order.listing.type === ListingType.Service
  const disputeOpen = !!dispute && dispute.status !== DisputeStatus.Resolved && dispute.status !== DisputeStatus.Closed

  // The order's real history (design "შეკვეთის სტატუსი") — only steps that have happened carry a
  // time; the rest stay grey. Paid = created (WaveCoin orders are paid at checkout).
  const timeline: Array<{ label: string; at: string | null; tone?: 'bad' }> = [
    { label: 'შეკვეთა შექმნილია', at: order.createdAt },
    { label: 'გადახდა დადასტურდა', at: order.status === OrderStatus.PendingPayment ? null : order.createdAt },
    ...(order.cancelledAt
      ? [{ label: order.status === OrderStatus.Refunded ? 'თანხა დაბრუნდა' : 'გაუქმებულია', at: order.cancelledAt, tone: 'bad' as const }]
      : [
          { label: isKey ? 'გასაღები გადმოგეცათ' : 'გამყიდველმა მიაწოდა', at: order.deliveredAt },
          { label: 'დასრულებულია', at: order.completedAt },
        ]),
  ]

  // "შეკვეთის მიმდინარეობა": what each side does, per listing type (design screenshot "discussion").
  const progress: Array<{ icon: string; title: string; text: string }> = isBuyer
    ? [
        { icon: 'cart', title: 'შეკვეთა შექმნილია', text: 'თქვენი შეკვეთა წარმატებით შეიქმნა.' },
        { icon: 'card', title: 'თანხა წარმატებით გადაიხადეთ', text: 'თანხა დაცულია WaveHub-ზე, სანამ მიღებას არ დაადასტურებთ.' },
        isKey
          ? { icon: 'key', title: 'გასაღები ზემოთაა', text: 'გახსენით, გააქტიურეთ და შეამოწმეთ.' }
          : isService
            ? { icon: 'chat', title: 'მიწერეთ გამყიდველს ამ ჩატში', text: 'შეუთანხმდით დეტალებს და დროს.' }
            : { icon: 'chat', title: 'მიწერეთ გამყიდველს ამ ჩატში', text: 'სთხოვეთ ლოგინი და პაროლი.' },
        { icon: 'check-circle', title: 'შემოწმების შემდეგ', text: 'დაადასტურეთ მიღება.' },
      ]
    : [
        { icon: 'cart', title: 'ახალი შეკვეთა', text: 'მყიდველმა შეიძინა თქვენი განცხადება.' },
        { icon: 'card', title: 'თანხა დაცულია', text: 'WaveHub-ზე, მყიდველის დადასტურებამდე.' },
        { icon: 'chat', title: 'მიაწოდეთ მყიდველს', text: isService ? 'შეასრულეთ სერვისი და მიწერეთ ამ ჩატში.' : 'მონაცემები გაუგზავნეთ ამ ჩატში.' },
        { icon: 'check-circle', title: 'მყიდველის დადასტურების შემდეგ', text: 'თანხა ჩაგერიცხებათ ბალანსზე.' },
      ]
  const progressStep =
    order.status === OrderStatus.Completed ? 4 : order.status === OrderStatus.Delivered ? 3 : order.status === OrderStatus.PendingPayment ? 1 : 2

  const systemIcon = (body: string) => (/გადახდ|თანხ/.test(body) ? 'card' : /გასაღებ|მიწოდ/.test(body) ? 'bag' : /დასრულ/.test(body) ? 'check-circle' : 'gear')

  return (
    <Layout title={`შეკვეთა ${order.orderNumber}`} noIndex>
      <div className="od-page">
        <header className="od-head">
          <Link className="od-back" href="/orders" aria-label="შეკვეთებზე დაბრუნება">
            <img src="/assets/ui/arrow-left.png" alt="" />
          </Link>
          <div className="od-head-title">
            <h1>{order.listing.title}</h1>
            <span>{order.orderNumber}</span>
          </div>
          <span className={`oc-status ${orderTone(order.status)}`}>
            <i aria-hidden="true" />
            {STATUS_LABELS[order.status]}
          </span>
        </header>

        <section className="od-card od-product">
          <span className="od-product-cover" style={cover ? { backgroundImage: `url('${cover}')` } : undefined}>
            {cover ? '' : (order.listing.gameName ?? 'WH').slice(0, 2).toUpperCase()}
          </span>
          <div className="od-product-copy">
            {order.listing.gameName && <small>{order.listing.gameName.toUpperCase()}</small>}
            <strong>{order.listing.title}</strong>
            <span className="od-tag">
              <img src="/assets/ui/gamepad.png" alt="" aria-hidden="true" />
              {order.package?.name ?? LISTING_TYPE_LABELS[order.listing.type]}
            </span>
            <code># {order.orderNumber}</code>
          </div>
          <div className="od-product-price">
            <small>ფასი</small>
            <b>{order.priceWaveCoin} GEL</b>
          </div>
        </section>

        <section className="od-card">
          <h2 className="od-card-title">
            <img src="/assets/ui/user-notify.png" alt="" aria-hidden="true" />
            მონაწილეები
          </h2>
          {[
            { role: 'მყიდველი', user: order.buyer, seller: false },
            { role: 'გამყიდველი', user: order.seller, seller: true },
          ].map(({ role, user, seller }) => (
            <div key={role} className="od-person">
              <Link href={`/u/${user.username}`} className="od-person-main">
                <Avatar name={displayName(user)} src={user.avatarUrl} size={58} />
                <span>
                  <small>{role}</small>
                  <strong>
                    {displayName(user)}
                    {user.verified && <VerifiedMark size={16} />}
                  </strong>
                  <em>@{user.username}</em>
                </span>
              </Link>
              {seller ? (
                <Link className="od-role-pill seller" href={`/u/${user.username}`}>
                  <img src="/assets/ui/store.png" alt="" aria-hidden="true" />
                  გამყიდველი <span aria-hidden="true">›</span>
                </Link>
              ) : (
                <span className="od-role-pill buyer">
                  <img src="/assets/ui/user-blue.png" alt="" aria-hidden="true" />
                  მყიდველი
                </span>
              )}
            </div>
          ))}
        </section>

        <section className="od-card">
          <h2 className="od-card-title">
            <img src="/assets/ui/card.png" alt="" aria-hidden="true" />
            გადახდის დეტალები
          </h2>
          {/* Orders since 2026-10-03: the buyer pays the fee on top and the seller gets the full
              price; older orders (feePaidBy 'seller') took the fee out of the seller's payout. */}
          <dl className="od-money">
            <div>
              <dt>ფასი</dt>
              <dd>{order.priceWaveCoin} GEL</dd>
            </div>
            {(isSeller || isSuperAdmin || (isBuyer && order.feePaidBy === 'buyer')) && (
              <div>
                <dt>
                  {`მარკეტფლეისის საკომისიო (${order.platformFeePercent}%)`}
                  <span
                    className="od-info"
                    title={order.feePaidBy === 'buyer' ? 'საკომისიოს იხდის მყიდველი, გამყიდველი იღებს სრულ ფასს.' : 'ეს შეკვეთა გაფორმდა მანამ, სანამ საკომისიოს მყიდველი გადაიხდიდა — ის გამყიდველის შემოსავლიდან დაიქვითა.'}
                  >
                    <img src="/assets/ui/info.png" alt="" aria-hidden="true" />
                  </span>
                </dt>
                <dd>{`${order.feePaidBy === 'buyer' ? '+' : '−'}${gel(order.platformFeeWaveCoin)} GEL`}</dd>
              </div>
            )}
            {(isBuyer || isSuperAdmin) && (
              <div className="od-money-total">
                <dt>{isBuyer ? 'თქვენ გადაიხადეთ' : 'მყიდველმა გადაიხადა'}</dt>
                <dd>{gel(order.buyerTotalWaveCoin)} GEL</dd>
              </div>
            )}
            <div className={isSeller ? 'od-money-total' : undefined}>
              <dt>{isSeller ? 'თქვენ მიიღებთ' : 'გამყიდველი მიიღებს'}</dt>
              <dd>{order.sellerPayoutWaveCoin} GEL</dd>
            </div>
          </dl>
        </section>

        <section className="od-card">
          <h2 className="od-card-title">
            <img src="/assets/ui/clock.png" alt="" aria-hidden="true" />
            შეკვეთის სტატუსი
          </h2>
          <ol className="od-timeline">
            {timeline.map((step) => (
              <li key={step.label} className={`${step.at ? 'done' : ''}${step.tone === 'bad' ? ' bad' : ''}`}>
                <i aria-hidden="true">{step.at ? (step.tone === 'bad' ? '×' : '✓') : ''}</i>
                <span>{step.label}</span>
                <time>{step.at ? formatWhen(step.at) : '—'}</time>
              </li>
            ))}
          </ol>
          {order.deliveryDueAt && !order.completedAt && !order.cancelledAt && <p className="od-note">
              <img src="/assets/ui/info-pink.png" alt="" aria-hidden="true" />
              მიწოდების ვადა: {formatWhen(order.deliveryDueAt)}
            </p>}
          {order.cancellationReason && <p className="od-note">გაუქმების მიზეზი: {order.cancellationReason}</p>}
          {order.revisionReason && <p className="od-note">გადასამუშავებელი შენიშვნა: {order.revisionReason}</p>}
        </section>

        {/* Next step for this side (start / deliver / accept / revise / cancel). */}
        {(isBuyer || isSeller) && (
          <section className="od-actions">
            {isSeller && order.status === OrderStatus.Paid && (
              <button type="button" className="od-btn primary" disabled={busy} onClick={() => runAction(() => api.startOrder(order.id))}>
                <img className="od-icon-invert" src="/assets/ui/check-solid.png" alt="" aria-hidden="true" />
                სამუშაოს დაწყება
              </button>
            )}
            {isSeller && order.status === OrderStatus.InProgress && (
              <button type="button" className="od-btn primary" disabled={busy} onClick={() => runAction(() => api.deliverOrder(order.id))}>
                <img className="od-icon-invert" src="/assets/ui/check-solid.png" alt="" aria-hidden="true" />
                მიწოდებულად მონიშვნა
              </button>
            )}
            {isBuyer && order.status === OrderStatus.Delivered && (
              <button type="button" className="od-btn primary" disabled={busy} onClick={() => runAction(() => api.acceptDelivery(order.id))}>
                <img src="/assets/ui/check-circle-light.png" alt="" aria-hidden="true" />
                მიღების დადასტურება
              </button>
            )}
            {isBuyer && order.status === OrderStatus.Delivered && !isKey && (
              <form
                className="od-inline-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  runAction(() => api.requestRevision(order.id, revisionReason))
                }}
              >
                <input placeholder="რა უნდა შესწორდეს?" aria-label="რა უნდა შესწორდეს" value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} required />
                <button className="od-btn" type="submit" disabled={busy}>
                  გადამუშავება
                </button>
              </form>
            )}
            {isBuyer && order.status === OrderStatus.Paid && (
              <button type="button" className="od-btn" disabled={busy} onClick={() => runAction(() => api.cancelOrderAsBuyer(order.id))}>
                <img src="/assets/ui/x-circle.png" alt="" aria-hidden="true" />
                შეკვეთის გაუქმება
              </button>
            )}
            {isSeller && (order.status === OrderStatus.Paid || order.status === OrderStatus.InProgress) && (
              <form
                className="od-inline-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  runAction(() => api.cancelOrderAsSeller(order.id, cancelReason))
                }}
              >
                <input placeholder="გაუქმების მიზეზი" aria-label="გაუქმების მიზეზი" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} required />
                <button className="od-btn" type="submit" disabled={busy}>
                  <img src="/assets/ui/x-circle.png" alt="" aria-hidden="true" />
                  გაუქმება
                </button>
              </form>
            )}
            {actionError && (
              <div className="status-text status-error" role="alert">
                {actionError}
              </div>
            )}
          </section>
        )}

        {(isBuyer || isSeller) && (
          <>
            <button type="button" className="od-cta" disabled={busy} onClick={() => messageOtherParty(otherParty.id)}>
              <img src="/assets/ui/send-light.png" alt="" aria-hidden="true" />
              {isBuyer ? 'გამყიდველისთვის მესიჯის გაგზავნა' : 'მყიდველისთვის მესიჯის გაგზავნა'}
              <span aria-hidden="true">›</span>
            </button>
            <Link className="od-cta ghost" href="/support">
              <img src="/assets/ui/headset.png" alt="" aria-hidden="true" />
              მხარდაჭერა
              <span aria-hidden="true">›</span>
            </Link>
          </>
        )}

        {isBuyer && isKey && (
          <section className="od-card od-key">
            <h2>გასაღები</h2>
            {revealError && <div className="status-text status-error" role="alert">{revealError}</div>}
            {revealedKey ? (
              <div className="key-reveal">
                <code aria-label="თქვენი გასაღები">{revealedKey}</code>
                <button type="button" className="od-btn" onClick={copyKey}>
                  {keyCopied ? 'დაკოპირდა ✓' : 'კოპირება'}
                </button>
                <button type="button" className="od-btn" onClick={() => setRevealedKey(null)}>
                  დამალვა
                </button>
              </div>
            ) : (
              <>
                <p>გასაღები მხოლოდ თქვენთვის ჩანს. ნახეთ და შეინახეთ უსაფრთხო ადგილას.</p>
                <button type="button" className="od-key-button" disabled={revealing} onClick={revealKey}>
                  <img src="/assets/ui/key.png" alt="" aria-hidden="true" />
                  {revealing ? 'მიმდინარეობს…' : 'გასაღების ჩვენება'}
                  <span aria-hidden="true">›</span>
                </button>
              </>
            )}
          </section>
        )}

        {order.requirementsAnswers && Object.keys(order.requirementsAnswers).length > 0 && (
          <section className="od-card">
            <h2 className="od-card-title">
              <img src="/assets/ui/chat-square.png" alt="" aria-hidden="true" />
              მყიდველის პასუხები
            </h2>
            <dl className="od-answers">
              {Object.entries(order.requirementsAnswers).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {!isKey && (
          <section className="od-section">
            <h2 className="od-files-title">
              <img src="/assets/ui/paperclip.png" alt="" aria-hidden="true" />
              მიწოდებული ფაილები
            </h2>
            {order.deliveryFiles.length === 0 ? (
              <p className="od-empty-line">
                <img src="/assets/ui/file-light.png" alt="" aria-hidden="true" />
                ფაილები ჯერ არ არის.
              </p>
            ) : (
              <ul className="od-files">
                {order.deliveryFiles.map((file) => (
                  <li key={file.id}>
                    <img src="/assets/ui/file-light.png" alt="" aria-hidden="true" />
                    <span>{file.fileUrl.split('/').pop()}</span>
                    <a className="od-download" href={file.fileUrl} target="_blank" rel="noreferrer" aria-label="ჩამოტვირთვა">
                      ⤓
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {isSeller && (order.status === OrderStatus.InProgress || order.status === OrderStatus.Delivered) && (
              <label className={`dispute-upload${busy ? ' is-busy' : ''}`}>
                <input type="file" aria-label="მიწოდების ფაილის ატვირთვა" onChange={uploadFile} disabled={busy} />
                <span aria-hidden="true">⇪</span>
                <span>
                  <strong>ფაილის მიწოდება</strong>
                  <small>მყიდველი ფაილს შეკვეთის გვერდზე ნახავს</small>
                </span>
              </label>
            )}
          </section>
        )}

        <section className="od-section">
          <h2>დისკუსია</h2>
          {/* The step guide only while the order is still in motion — a finished order has nothing left to do. */}
          {(isBuyer || isSeller) && ![OrderStatus.Completed, OrderStatus.Cancelled, OrderStatus.Refunded].includes(order.status) && (
            <div className="od-progress">
              <h3>
                <img src="/assets/ui/info.png" alt="" aria-hidden="true" />
                შეკვეთის მიმდინარეობა
              </h3>
              <ol>
                {progress.map((step, index) => (
                  <li key={step.title} className={index + 1 <= progressStep ? 'reached' : undefined}>
                    <b>{index + 1}</b>
                    <span className="od-progress-icon">
                      <img src={`/assets/ui/${step.icon}.png`} alt="" aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{step.title}</strong>
                      <small>{step.text}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="od-chat">
            <div className="od-chat-log" role="log" aria-live="polite" aria-label="შეკვეთის დისკუსია">
              {messages.length === 0 ? (
                <p className="od-chat-empty">შეტყობინებები ჯერ არ არის.</p>
              ) : (
                messages.map((message) => {
                  const time = kaTime(message.createdAt)
                  if (message.type === MessageType.System) {
                    return (
                      <div key={message.id} className="od-msg-system">
                        <span className="od-msg-icon">
                          <img src={`/assets/ui/${systemIcon(message.body)}.png`} alt="" aria-hidden="true" />
                        </span>
                        <span>
                          {message.body}
                          <time>{time}</time>
                        </span>
                      </div>
                    )
                  }
                  const mine = message.senderId === me?.id
                  return (
                    <div key={message.id} className={`od-msg${mine ? ' mine' : ''}`}>
                      {!mine && <strong>{message.senderUsername}</strong>}
                      {message.type === MessageType.Image ? (
                        <a href={message.body} target="_blank" rel="noreferrer">
                          <img className="od-msg-image" src={message.body} alt="გაგზავნილი ფოტო" />
                        </a>
                      ) : message.type === MessageType.File ? (
                        <a className="od-msg-file" href={message.body} target="_blank" rel="noreferrer">
                          <img src="/assets/ui/file-light.png" alt="" aria-hidden="true" />
                          {message.body.split('/').pop()}
                        </a>
                      ) : (
                        <p>{message.body}</p>
                      )}
                      <time>{time}</time>
                    </div>
                  )
                })
              )}
            </div>
            {(isBuyer || isSeller) && (
              <form className="od-composer" onSubmit={sendMessage}>
                <label className={`od-attach${sendingMessage ? ' is-busy' : ''}`} aria-label="ფოტოს ან ფაილის გაგზავნა">
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,application/zip,.zip" onChange={sendAttachment} disabled={sendingMessage} />
                  <img src={isKey ? '/assets/ui/image.png' : '/assets/ui/paperclip-light.png'} alt="" aria-hidden="true" />
                </label>
                <input
                  placeholder={isBuyer && !isKey && !isService ? 'გამარჯობა, მომწერეთ ლოგინი და პაროლი შესამოწმებლად...' : 'შეტყობინების გაგზავნა...'}
                  aria-label="შეტყობინება"
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  disabled={sendingMessage}
                />
                <button className="od-send" type="submit" disabled={sendingMessage || !draftMessage.trim()} aria-label="გაგზავნა">
                  <img src="/assets/ui/send-light.png" alt="" aria-hidden="true" />
                </button>
              </form>
            )}
            {chatError && <div className="status-text status-error">{chatError}</div>}
          </div>
          {(isBuyer || isSeller) && (
            <p className="od-safety">
              <span>
                <img src="/assets/ui/shield-check.png" alt="" aria-hidden="true" />
              </span>
              {isBuyer ? 'დაადასტურეთ შეკვეთა მხოლოდ მონაცემების სრულად შემოწმების შემდეგ.' : 'თანხა ჩაგერიცხებათ მყიდველის მიერ მიღების დადასტურების შემდეგ.'}
            </p>
          )}
          {/* Delivered orders complete themselves after the staff-set window (Admin → Settings) — the
              buyer is told up front, with the exact time once delivered. */}
          {(isBuyer || isSeller) && autoHours !== null && [OrderStatus.Paid, OrderStatus.InProgress, OrderStatus.Delivered].includes(order.status) && (
            <p className="od-safety od-warn" role="note">
              <span>
                <img src="/assets/ui/warning.png" alt="" aria-hidden="true" />
              </span>
              <span className="od-warn-text">
                {isBuyer
                  ? `თუ ${autoHours} საათის განმავლობაში არ დაადასტურებთ შეკვეთას ან არ გახსნით დავას, შეკვეთა ავტომატურად ჩაითვლება დასრულებულად.`
                  : `მიწოდებიდან ${autoHours} საათში, თუ მყიდველი არ დაადასტურებს შეკვეთას ან არ გახსნის დავას, შეკვეთა ავტომატურად დასრულდება და თანხა ჩაგერიცხებათ.`}
                {order.status === OrderStatus.Delivered && order.autoCompleteAt && <strong>{`ავტომატური დასრულება: ${formatWhen(order.autoCompleteAt)}`}</strong>}
              </span>
            </p>
          )}
        </section>

        {(isBuyer || isSeller || isSuperAdmin) && (dispute || DISPUTABLE_STATUSES.includes(order.status)) && (
          <section className="od-section">
            <h2 className="od-icon-title">
              <span>
                <img src={dispute ? '/assets/ui/gavel-pink.png' : '/assets/ui/shield-alert.png'} alt="" aria-hidden="true" />
              </span>
              დავა
            </h2>
            {disputeError && <div className="status-text status-error" role="alert">{disputeError}</div>}

            {dispute ? (
              <>
                <dl className="od-dispute-facts">
                  <div>
                    <dt>
                      <img src="/assets/ui/alert-circle.png" alt="" aria-hidden="true" />
                      სტატუსი:
                    </dt>
                    <dd>
                      <span className="od-dispute-pill">{DISPUTE_STATUS_LABELS[dispute.status]}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <img src="/assets/ui/doc.png" alt="" aria-hidden="true" />
                      მიზეზი:
                    </dt>
                    <dd>{dispute.reason}</dd>
                  </div>
                  <div>
                    <dt>
                      <img src="/assets/ui/scales.png" alt="" aria-hidden="true" />
                      გადაწყვეტილება:
                    </dt>
                    <dd>{dispute.resolutionNote ?? 'მიმდინარეობს განხილვა'}</dd>
                  </div>
                </dl>

                <div className="od-dispute-thread">
                  {dispute.messages.length === 0 ? (
                    <p className="od-thread-empty">
                      <span>
                        <img src="/assets/ui/chat-square.png" alt="" aria-hidden="true" />
                      </span>
                      შეტყობინებები ჯერ არ არის.
                    </p>
                  ) : (
                    dispute.messages.map((message) => (
                      <div key={message.id} className={`od-msg${message.senderId === me?.id ? ' mine' : ''}`}>
                        {message.senderId !== me?.id && (
                          <strong className="od-msg-sender">
                            <Avatar
                              name={displayName({ firstName: message.senderFirstName, lastName: message.senderLastName, username: message.senderUsername })}
                              src={message.senderAvatarUrl}
                              size={24}
                            />
                            {displayName({ firstName: message.senderFirstName, lastName: message.senderLastName, username: message.senderUsername })}
                          </strong>
                        )}
                        <p>{message.body}</p>
                      </div>
                    ))
                  )}
                  {(isBuyer || isSeller) && disputeOpen && (
                    <form className="od-composer" onSubmit={sendDisputeMessage}>
                      <input
                        placeholder="დაწერეთ შეტყობინება დავაზე…"
                        aria-label="შეტყობინება დავაზე"
                        value={disputeDraftMessage}
                        onChange={(event) => setDisputeDraftMessage(event.target.value)}
                        disabled={disputeBusy}
                      />
                      <button className="od-send" type="submit" disabled={disputeBusy || !disputeDraftMessage.trim()} aria-label="გაგზავნა">
                        <img src="/assets/ui/send-light.png" alt="" aria-hidden="true" />
                      </button>
                    </form>
                  )}
                </div>

                <h2 className="od-icon-title">
                  <span>
                    <img src="/assets/ui/paperclip-pink.png" alt="" aria-hidden="true" />
                  </span>
                  მტკიცებულებები
                </h2>
                {dispute.evidence.length === 0 ? (
                  <p className="od-empty-line">
                    <img src="/assets/ui/file-light.png" alt="" aria-hidden="true" />
                    მტკიცებულებები ჯერ არ არის.
                  </p>
                ) : (
                  <ul className="od-files">
                    {dispute.evidence.map((file) => (
                      <li key={file.id}>
                        <img src="/assets/ui/file-light.png" alt="" aria-hidden="true" />
                        <span>{file.fileUrl.split('/').pop()}</span>
                        <a className="od-download" href={file.fileUrl} target="_blank" rel="noreferrer" aria-label="ჩამოტვირთვა">
                          ⤓
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {(isBuyer || isSeller) && disputeOpen && (
                  <label className={`od-evidence-button${disputeBusy ? ' is-busy' : ''}`}>
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,application/zip,.zip" aria-label="მტკიცებულების ატვირთვა" onChange={uploadDisputeEvidence} disabled={disputeBusy} />
                    <img src="/assets/ui/paperclip-light.png" alt="" aria-hidden="true" />
                    მტკიცებულების დამატება
                    <span aria-hidden="true">›</span>
                  </label>
                )}

                {isSuperAdmin && dispute.status === DisputeStatus.Open && (
                  <div className="od-card od-resolve">
                    <h3>დავის გადაწყვეტა</h3>
                    <textarea
                      id="resolveNote"
                      value={resolveNote}
                      onChange={(event) => setResolveNote(event.target.value)}
                      placeholder="დაასაბუთეთ გადაწყვეტილება — ჩანს ორივე მხარისთვის"
                      aria-label="შენიშვნა გადაწყვეტილებაზე"
                    />
                    <div className="od-resolve-actions">
                      {Object.values(DisputeResolution).map((resolution) => (
                        <button key={resolution} type="button" className="od-btn" disabled={disputeBusy || !resolveNote.trim()} onClick={() => resolveDispute(resolution)}>
                          {RESOLUTION_LABELS[resolution]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              (isBuyer || isSeller) && (
                <form className="od-dispute-form" onSubmit={openDispute}>
                  <p>თუ პრობლემა გაქვთ ამ შეკვეთასთან დაკავშირებით, შეგიძლიათ დავის გახსნა.</p>
                  <label className="od-textarea">
                    <span className="od-textarea-icon">
                      <img src="/assets/ui/pencil.png" alt="" aria-hidden="true" />
                    </span>
                    <textarea
                      id="disputeReason"
                      maxLength={DISPUTE_REASON_MAX}
                      value={disputeReason}
                      onChange={(event) => setDisputeReason(event.target.value)}
                      placeholder="აღწერეთ პრობლემა (მინიმუმ 10 სიმბოლო)"
                      aria-label="დავის მიზეზი"
                      required
                    />
                    <small>{`${disputeReason.length}/${DISPUTE_REASON_MAX}`}</small>
                  </label>
                  <button className="od-dispute-open" type="submit" disabled={disputeBusy || disputeReason.trim().length < 10}>
                    <img src="/assets/ui/gavel.png" alt="" aria-hidden="true" />
                    დავის გახსნა
                    <span aria-hidden="true">›</span>
                  </button>
                  <label className={`od-evidence-button${disputeBusy ? ' is-busy' : ''}`}>
                    <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,application/zip,.zip" aria-label="მტკიცებულების დამატება" onChange={(event) => setPendingEvidence(Array.from(event.target.files ?? []).slice(0, 5))} />
                    <img src="/assets/ui/paperclip-light.png" alt="" aria-hidden="true" />
                    {pendingEvidence.length ? `მტკიცებულება: ${pendingEvidence.length} ფაილი` : 'მტკიცებულების დამატება'}
                    <span aria-hidden="true">›</span>
                  </label>
                </form>
              )
            )}
          </section>
        )}

        {(isBuyer || isSeller) && (
          <section className="od-section" id="review">
            <h2 className="od-icon-title">
              <span>
                <img src="/assets/ui/star-notify.png" alt="" aria-hidden="true" />
              </span>
              შეფასება
            </h2>
            {order.status === OrderStatus.Completed ? (
              <OrderReview orderId={order.id} isBuyer={isBuyer} isSeller={isSeller} />
            ) : (
              <div className="od-review-empty">
                <span>
                  <img src="/assets/ui/star-notify.png" alt="" aria-hidden="true" />
                </span>
                <strong>შეფასება ჯერ არ არის.</strong>
                <small>შეკვეთის დასრულების შემდეგ შეძლებთ შეფასების დატოვებას.</small>
              </div>
            )}
          </section>
        )}

        <aside className="od-brand">
          <div>
            <img src="/assets/logo-wavehubx-main.png" alt="WaveHubX" />
            <p>ითამაშე. დაუკავშირდი. გამოიმუშავე.</p>
          </div>
          <p className="od-brand-info">
            <img src="/assets/ui/info-light.png" alt="" aria-hidden="true" />
            WaveHubX არის გეიმინგ მარკეტპლეისი. იყიდეთ, გაყიდეთ და გაიცვალეთ უნარები სანდო ქოუჩებთან — ყველაფერი ერთ სივრცეში.
          </p>
        </aside>
      </div>
    </Layout>
  )
}
