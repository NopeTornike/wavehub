import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicTicket } from '@wavehub/shared-types'
import { TicketCategory, TicketStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  [TicketCategory.Payment]: 'გადახდა',
  [TicketCategory.OrderStatus]: 'შეკვეთის სტატუსი',
  [TicketCategory.Refund]: 'თანხის დაბრუნება',
  [TicketCategory.Verification]: 'ვერიფიკაცია',
  [TicketCategory.Marketplace]: 'მარკეტფლეისი',
  [TicketCategory.Coaching]: 'კოუჩინგი',
  [TicketCategory.Technical]: 'ტექნიკური',
  [TicketCategory.Other]: 'სხვა',
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.Open]: 'ღიაა',
  [TicketStatus.InProgress]: 'მუშავდება',
  [TicketStatus.Escalated]: 'ესკალირებულია',
  [TicketStatus.Closed]: 'დახურულია',
}

export default function SupportTicketDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me, checked } = useAuth()

  const [ticket, setTicket] = useState<PublicTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (checked && !me) {
      router.push(`/login?next=/support/${id ?? ''}`)
    }
  }, [checked, me, id, router])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .getMyTicket(id)
      .then((data) => {
        if (!cancelled) setTicket(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'ბილეთის ჩატვირთვა ვერ მოხერხდა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const reply = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || !draft.trim()) return
    setSending(true)
    setError('')
    try {
      const updated = await api.replyToTicket(id, draft.trim())
      setTicket(updated)
      setDraft('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'პასუხის გაგზავნა ვერ მოხერხდა.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Layout>
      <div className="detail-page">
        {loading ? (
          <div className="marketplace-empty">იტვირთება…</div>
        ) : error && !ticket ? (
          <div className="marketplace-empty">{error}</div>
        ) : ticket ? (
          <>
            <div className="detail-title-block">
              <p className="section-kicker">დახმარების ბილეთი</p>
              <h1>{ticket.subject}</h1>
              <p className="detail-lead">
                {CATEGORY_LABELS[ticket.category]} ·{' '}
                <span className={`order-status order-status-${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
              </p>
            </div>

            {error && <div className="status-text status-error">{error}</div>}

            <section className="detail-section detail-reviews-card">
              <div className="chat-panel">
                <div className="chat-messages">
                  {ticket.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`chat-message${message.senderId === me?.id ? ' chat-message-mine' : ''}`}
                    >
                      {message.senderId !== me?.id && <strong>@{message.senderUsername} </strong>}
                      {message.body}
                    </div>
                  ))}
                </div>
                <form className="chat-form" onSubmit={reply}>
                  <input
                    className="input"
                    placeholder="დაწერეთ პასუხი…"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={sending}
                  />
                  <button className="button glow-on-hover" type="submit" disabled={sending || !draft.trim()}>
                    გაგზავნა
                  </button>
                </form>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </Layout>
  )
}
