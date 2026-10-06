/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicTicket } from '@wavehub/shared-types'
import { TicketStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import Avatar, { displayName } from '../../components/Avatar'
import { CategoryIcon, TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS, formatTicketDate } from '../../lib/support'

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
        if (!cancelled) setError(errorMessage(err, 'ბილეთის ჩატვირთვა ვერ მოხერხდა.'))
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
      setError(errorMessage(err, 'პასუხის გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setSending(false)
    }
  }

  const closed = ticket?.status === TicketStatus.Closed

  return (
    <Layout title="მხარდაჭერის ბილეთი" noIndex>
      <div className="sp-page">
        <Link className="sp-back" href="/support">
          <span aria-hidden="true">&lt;</span> დახმარება
        </Link>
        {loading ? (
          <p className="sp-card sp-empty">იტვირთება…</p>
        ) : error && !ticket ? (
          <p className="sp-card sp-empty">{error}</p>
        ) : ticket ? (
          <>
            <header className="sp-card sp-ticket-head">
              <span className="sp-ticket-icon">
                <CategoryIcon category={ticket.category} />
              </span>
              <div>
                <h1>{ticket.subject}</h1>
                <p>
                  <span>{TICKET_CATEGORY_LABELS[ticket.category]}</span> · {formatTicketDate(ticket.createdAt)}
                </p>
              </div>
              <em className={`sp-status ${ticket.status}`}>{TICKET_STATUS_LABELS[ticket.status]}</em>
            </header>

            <section className="sp-card sp-thread">
              <ol className="sp-messages">
                {ticket.messages.map((message) => {
                  const mine = message.senderId === me?.id
                  return (
                    <li key={message.id} className={mine ? 'mine' : undefined}>
                      {/* Who wrote it by photo + full name, the username small underneath (client
                          2026-10-07); staff as "WaveHubX Support — Name", WHX logo without a photo. */}
                      <header className="sp-sender">
                        {message.fromSupport && !message.senderAvatarUrl ? (
                          <img className="sp-sender-logo" src="/assets/whx-icon-48.png" alt="" aria-hidden="true" />
                        ) : (
                          <Avatar name={senderName(message)} src={message.senderAvatarUrl} size={36} />
                        )}
                        <span>
                          <strong>
                            {message.fromSupport ? `WaveHubX Support — ${senderName(message)}` : mine ? `${senderName(message)} (თქვენ)` : senderName(message)}
                          </strong>
                          {!message.fromSupport && <small>@{message.senderUsername}</small>}
                        </span>
                        <time dateTime={message.createdAt}>{formatTicketDate(message.createdAt)}</time>
                      </header>
                      <p>{message.body}</p>
                    </li>
                  )
                })}
              </ol>
              {error && (
                <p className="sp-error" role="alert">
                  {error}
                </p>
              )}
              {closed && <p className="sp-empty">ბილეთი დახურულია — პასუხი მას ხელახლა გახსნის.</p>}
              <form className="sp-reply" onSubmit={reply}>
                <input placeholder="დაწერეთ პასუხი…" maxLength={5000} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} />
                <button className="sp-primary" type="submit" disabled={sending || !draft.trim()}>
                  გაგზავნა
                </button>
              </form>
            </section>
          </>
        ) : null}
      </div>
    </Layout>
  )
}

function senderName(m: { senderFirstName: string; senderLastName: string; senderUsername: string }): string {
  return displayName({ firstName: m.senderFirstName, lastName: m.senderLastName, username: m.senderUsername })
}
