import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { AdminTicketSummary } from '@wavehub/shared-types'
import { TicketPriority, TicketStatus } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, ApiError } from '../../lib/api'

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

export default function AdminTickets() {
  const [status, setStatus] = useState<TicketStatus | ''>('')
  const [priority, setPriority] = useState<TicketPriority | ''>('')
  const [tickets, setTickets] = useState<AdminTicketSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    api
      .adminListTickets({ status: status || undefined, priority: priority || undefined })
      .then(setTickets)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api
      .adminListTickets({})
      .then((data) => {
        if (!cancelled) setTickets(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // Mount-only initial load — the filter form's submit handler calls load() directly afterward.
  }, [])

  return (
    <AdminLayout>
      <h1 className="page-title">დახმარების ბილეთები</h1>
      <p className="page-subtitle">ყველა მომხმარებლის ბილეთი</p>

      <form
        className="admin-search-bar"
        onSubmit={(e) => {
          e.preventDefault()
          load()
        }}
      >
        <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | '')}>
          <option value="">ყველა სტატუსი</option>
          {Object.values(TicketStatus).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority | '')}>
          <option value="">ყველა პრიორიტეტი</option>
          {Object.values(TicketPriority).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <button type="submit" className="button">
          ფილტრი
        </button>
      </form>

      {error && <div className="status-text status-error">{error}</div>}

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">ბილეთები არ არის.</div>
      ) : (
        <div className="order-list">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/admin/tickets/${ticket.id}`} className="order-card">
              <div className="order-card-main">
                <strong>{ticket.subject}</strong>
                <span className="note" style={{ margin: 0 }}>
                  @{ticket.requesterUsername} · {PRIORITY_LABELS[ticket.priority]}
                  {ticket.assignedToUsername ? ` · @${ticket.assignedToUsername}` : ''}
                </span>
              </div>
              <span className={`order-status order-status-${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
            </Link>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
