import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicSavedReply, PublicTicket } from '@wavehub/shared-types'
import { TicketPriority, TicketStatus } from '@wavehub/shared-types'
import AdminLayout from '../../../components/AdminLayout'
import { api, ApiError } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'

const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.Open]: 'ღიაა',
  [TicketStatus.InProgress]: 'მუშავდება',
  [TicketStatus.Escalated]: 'ესკალირებულია',
  [TicketStatus.Closed]: 'დახურულია',
}

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

  const [replyDraft, setReplyDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')

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
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'ბილეთის ჩატვირთვა ვერ მოხერხდა.')
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

  const sendReply = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || !replyDraft.trim()) return
    setBusy(true)
    setError('')
    try {
      const updated = await api.adminReplyTicket(id, replyDraft.trim())
      setTicket(updated)
      setReplyDraft('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'პასუხის გაგზავნა ვერ მოხერხდა.')
    } finally {
      setBusy(false)
    }
  }

  const sendNote = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || !noteDraft.trim()) return
    setBusy(true)
    setError('')
    try {
      const updated = await api.adminAddTicketInternalNote(id, noteDraft.trim())
      setTicket(updated)
      setNoteDraft('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'შენიშვნის დამატება ვერ მოხერხდა.')
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (status: TicketStatus) => {
    if (!id) return
    setBusy(true)
    setError('')
    try {
      setTicket(await api.adminUpdateTicket(id, { status }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'სტატუსის შეცვლა ვერ მოხერხდა.')
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
      setError(err instanceof ApiError ? err.message : 'პრიორიტეტის შეცვლა ვერ მოხერხდა.')
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
      setError(err instanceof ApiError ? err.message : 'მინიჭება ვერ მოხერხდა.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminLayout>
      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : error && !ticket ? (
        <div className="status-text status-error">{error}</div>
      ) : ticket ? (
        <>
          <h1 className="page-title">{ticket.subject}</h1>
          {error && <div className="status-text status-error">{error}</div>}

          <div className="admin-row-actions" style={{ marginBottom: 20 }}>
            <select value={ticket.status} disabled={busy} onChange={(e) => changeStatus(e.target.value as TicketStatus)}>
              {Object.values(TicketStatus).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <select value={ticket.priority} disabled={busy} onChange={(e) => changePriority(e.target.value as TicketPriority)}>
              {Object.values(TicketPriority).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            {ticket.assignedToId !== me?.id && (
              <button type="button" className="button" disabled={busy} onClick={assignToMe}>
                ჩემზე აღება
              </button>
            )}
          </div>

          <div className="chat-panel">
            <div className="chat-messages">
              {ticket.messages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-message${message.isInternalNote ? ' chat-message-system' : message.senderId === me?.id ? ' chat-message-mine' : ''}`}
                >
                  <strong>{message.isInternalNote ? '🔒 შიდა შენიშვნა — ' : ''}@{message.senderUsername}: </strong>
                  {message.body}
                </div>
              ))}
            </div>
          </div>

          {savedReplies.length > 0 && (
            <div className="form-group" style={{ marginTop: 16 }}>
              <label htmlFor="savedReply">მზა პასუხი</label>
              <select
                id="savedReply"
                className="input"
                value=""
                onChange={(e) => {
                  const reply = savedReplies.find((r) => r.id === e.target.value)
                  if (reply) setReplyDraft(reply.body)
                }}
              >
                <option value="">— აირჩიეთ —</option>
                {savedReplies.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <form onSubmit={sendReply} style={{ marginTop: 12 }}>
            <div className="form-group">
              <label htmlFor="replyDraft">პასუხი მომხმარებელს</label>
              <textarea id="replyDraft" className="input" value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} />
            </div>
            <button type="submit" className="button glow-on-hover" disabled={busy || !replyDraft.trim()}>
              პასუხის გაგზავნა
            </button>
          </form>

          <form onSubmit={sendNote} style={{ marginTop: 20 }}>
            <div className="form-group">
              <label htmlFor="noteDraft">შიდა შენიშვნა (მხოლოდ პერსონალისთვის)</label>
              <textarea id="noteDraft" className="input" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
            </div>
            <button type="submit" className="button" disabled={busy || !noteDraft.trim()}>
              შენიშვნის დამატება
            </button>
          </form>
        </>
      ) : null}
    </AdminLayout>
  )
}
