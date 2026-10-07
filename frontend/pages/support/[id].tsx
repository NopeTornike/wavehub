import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { PublicTicket } from '@wavehub/shared-types'
import { TicketStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { displayName } from '../../components/Avatar'
import ChatThread from '../../components/ChatThread'
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

  const sendReply = async () => {
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
  // The header shows whoever from support answered last.
  const lastStaff = ticket ? [...ticket.messages].reverse().find((m) => m.fromSupport) ?? null : null

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

            {/* The site's message-chat look (client 2026-10-07): support as "Support — Name (XY)"
                with their photo (WHX logo without one). */}
            <ChatThread
              title={lastStaff ? supportLabel(lastStaff) : 'WaveHubX Support'}
              subtitle={TICKET_STATUS_LABELS[ticket.status]}
              headAvatarUrl={lastStaff?.senderAvatarUrl ?? null}
              headAvatarFallback="/assets/whx-icon-192.png"
              messages={ticket.messages.map((m) => ({
                id: m.id,
                mine: m.senderId === me?.id,
                name: m.senderId === me?.id ? 'თქვენ' : m.fromSupport ? supportLabel(m) : senderName(m),
                avatarUrl: m.senderAvatarUrl,
                avatarFallback: m.fromSupport ? '/assets/whx-icon-192.png' : undefined,
                body: m.body,
                createdAt: m.createdAt,
              }))}
              draft={draft}
              onDraft={setDraft}
              onSend={() => void sendReply()}
              sending={sending}
              placeholder="დაწერეთ პასუხი…"
              footer={
                <>
                  {error && (
                    <p className="sp-error" role="alert">
                      {error}
                    </p>
                  )}
                  {closed && <p className="sp-empty">ბილეთი დახურულია — პასუხი მას ხელახლა გახსნის.</p>}
                </>
              }
            />
          </>
        ) : null}
      </div>
    </Layout>
  )
}

function senderName(m: { senderFirstName: string; senderLastName: string; senderUsername: string }): string {
  return displayName({ firstName: m.senderFirstName, lastName: m.senderLastName, username: m.senderUsername })
}

// "Support — Nini Gagua (NG)": the staff member's name and initials (owner 2026-10-07).
function supportLabel(m: { senderFirstName: string; senderLastName: string; senderUsername: string }): string {
  const name = senderName(m)
  const initials = [m.senderFirstName, m.senderLastName].filter(Boolean).map((part) => part[0]?.toUpperCase()).join('')
  return `Support — ${name}${initials ? ` (${initials})` : ''}`
}

