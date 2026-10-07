import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { PublicSavedReply, PublicTicket } from '@wavehub/shared-types'
import { TicketPriority, TicketStatus } from '@wavehub/shared-types'
import AdminLayout from '../../../components/AdminLayout'
import ChatThread from '../../../components/ChatThread'
import { displayName } from '../../../components/Avatar'
import { api, errorMessage } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { CategoryIcon, TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS, formatTicketDate } from '../../../lib/support'

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  [TicketPriority.Low]: 'დაბალი',
  [TicketPriority.Medium]: 'საშუალო',
  [TicketPriority.High]: 'მაღალი',
  [TicketPriority.Urgent]: 'გადაუდებელი',
}

export default function AdminTicketDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me } = useAuth()

  const [ticket, setTicket] = useState<PublicTicket | null>(null)
  const [savedReplies, setSavedReplies] = useState<PublicSavedReply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<'reply' | 'note'>('reply')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .adminGetTicket(id)
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

  useEffect(() => {
    let cancelled = false
    api
      .adminListSavedReplies()
      .then((data) => {
        if (!cancelled) setSavedReplies(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const changeStatus = async (status: TicketStatus) => {
    if (!id) return
    setBusy(true)
    setError('')
    try {
      setTicket(await api.adminUpdateTicket(id, { status }))
    } catch (err) {
      setError(errorMessage(err, 'სტატუსის შეცვლა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  const changePriority = async (priority: TicketPriority) => {
    if (!id) return
    setBusy(true)
    setError('')
    try {
      setTicket(await api.adminUpdateTicket(id, { priority }))
    } catch (err) {
      setError(errorMessage(err, 'პრიორიტეტის შეცვლა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  const assignToMe = async () => {
    if (!id || !me) return
    setBusy(true)
    setError('')
    try {
      setTicket(await api.adminUpdateTicket(id, { assignedToId: me.id }))
    } catch (err) {
      setError(errorMessage(err, 'მინიჭება ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  // The requester, from their own messages (the thread header).
  const requesterMsg = ticket?.messages.find((m) => !m.fromSupport) ?? null
  const requester = requesterMsg
    ? { username: requesterMsg.senderUsername, firstName: requesterMsg.senderFirstName, lastName: requesterMsg.senderLastName, avatarUrl: requesterMsg.senderAvatarUrl }
    : null

  const sendComposer = async () => {
    if (!id || !draft.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const updated = mode === 'note' ? await api.adminAddTicketInternalNote(id, draft.trim()) : await api.adminReplyTicket(id, draft.trim())
      setTicket(updated)
      setDraft('')
    } catch (err) {
      setError(errorMessage(err, mode === 'note' ? 'შენიშვნის დამატება ვერ მოხერხდა.' : 'პასუხის გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }
  const submitComposer = (event: FormEvent) => {
    event.preventDefault()
    void sendComposer()
  }
  const composerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendComposer()
    }
  }

  // Staff composer (owner 2026-10-07: "too basic"): one box inside the chat, switched between a
  // reply the user sees and an internal note only staff see, with the saved replies beside it.
  const composer = ticket && (
    <form className={`atk-composer${mode === 'note' ? ' is-note' : ''}`} onSubmit={submitComposer}>
      <div className="atk-composer-bar">
        <div className="atk-mode" role="tablist" aria-label="შეტყობინების ტიპი">
          <button type="button" role="tab" aria-selected={mode === 'reply'} className={mode === 'reply' ? 'active' : undefined} onClick={() => setMode('reply')}>
            პასუხი მომხმარებელს
          </button>
          <button type="button" role="tab" aria-selected={mode === 'note'} className={mode === 'note' ? 'active' : undefined} onClick={() => setMode('note')}>
            🔒 შიდა შენიშვნა
          </button>
        </div>
        {mode === 'reply' && savedReplies.length > 0 && (
          <select
            className="atk-saved"
            aria-label="მზა პასუხი"
            value=""
            onChange={(e) => {
              const reply = savedReplies.find((r) => r.id === e.target.value)
              if (reply) setDraft(reply.body)
            }}
          >
            <option value="">მზა პასუხი…</option>
            {savedReplies.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        )}
      </div>
      {mode === 'note' && <p className="atk-note-hint">შიდა შენიშვნას მომხმარებელი ვერ ხედავს — მხოლოდ პერსონალისთვისაა.</p>}
      <div className="direct-message-form atk-form">
        <textarea
          maxLength={5000}
          placeholder={mode === 'note' ? 'დაწერეთ შიდა შენიშვნა...' : 'დაწერეთ პასუხი...'}
          aria-label={mode === 'note' ? 'შიდა შენიშვნა' : 'პასუხი მომხმარებელს'}
          disabled={busy}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={composerKey}
        />
        <button type="submit" disabled={busy || !draft.trim()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="dm-send-icon" src="/assets/ui/send-pink.png" alt="" aria-hidden="true" />
          {busy ? 'იგზავნება…' : mode === 'note' ? 'დამატება' : 'გაგზავნა'}
        </button>
      </div>
    </form>
  )

  return (
    <AdminLayout title="ბილეთი">
      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : error && !ticket ? (
        <div className="status-text status-error" role="alert">{error}</div>
      ) : ticket ? (
        <>
          <header className="atk-head">
            <span className="atk-icon">
              <CategoryIcon category={ticket.category} />
            </span>
            <div className="atk-title">
              <h1>{ticket.subject}</h1>
              <p>
                <span>{TICKET_CATEGORY_LABELS[ticket.category]}</span>
                <span>{`გახსნილია ${formatTicketDate(ticket.createdAt)}`}</span>
                <span>{ticket.assignedToId ? (ticket.assignedToId === me?.id ? 'შენზეა მინიჭებული' : 'მინიჭებულია') : 'არავისზეა მინიჭებული'}</span>
              </p>
            </div>
            <div className="atk-chips">
              <em className={`sp-status ${ticket.status}`}>{TICKET_STATUS_LABELS[ticket.status]}</em>
              <em className={`atk-priority ${ticket.priority}`}>{PRIORITY_LABELS[ticket.priority]}</em>
            </div>
            <div className="atk-controls">
              <label>
                <span>სტატუსი</span>
                <select value={ticket.status} disabled={busy} onChange={(e) => changeStatus(e.target.value as TicketStatus)}>
                  {Object.values(TicketStatus).map((s) => (
                    <option key={s} value={s}>
                      {TICKET_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>პრიორიტეტი</span>
                <select value={ticket.priority} disabled={busy} onChange={(e) => changePriority(e.target.value as TicketPriority)}>
                  {Object.values(TicketPriority).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>
              {ticket.assignedToId !== me?.id && (
                <button type="button" className="button atk-assign" disabled={busy} onClick={assignToMe}>
                  ჩემზე აღება
                </button>
              )}
            </div>
          </header>
          {error && (
            <div className="status-text status-error" role="alert">
              {error}
            </div>
          )}

          {/* The site's message-chat look (owner 2026-10-07): the requester in the header, support
              replies on the right, internal notes marked. */}
          <ChatThread
            title={requester ? displayName(requester) : 'მომხმარებელი'}
            subtitle={requester ? `@${requester.username}` : undefined}
            headAvatarUrl={requester?.avatarUrl ?? null}
            headHref={requester ? `/u/${requester.username}` : undefined}
            messages={ticket.messages.map((m) => {
              const name = displayName({ firstName: m.senderFirstName, lastName: m.senderLastName, username: m.senderUsername })
              return {
                id: m.id,
                mine: m.fromSupport,
                name: m.isInternalNote ? `🔒 შიდა შენიშვნა — ${name}` : m.fromSupport ? `Support — ${name}` : name,
                avatarUrl: m.senderAvatarUrl,
                avatarFallback: m.fromSupport ? '/assets/whx-icon-192.png' : undefined,
                body: m.body,
                createdAt: m.createdAt,
                note: m.isInternalNote,
              }
            })}
            draft={draft}
            onDraft={setDraft}
            onSend={() => void sendComposer()}
            composer={composer}
          />
        </>
      ) : null}
    </AdminLayout>
  )
}
