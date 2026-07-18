import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { AdminTicketSummary } from '@wavehub/shared-types'
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

export default function SupportIndex() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const [tickets, setTickets] = useState<AdminTicketSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<TicketCategory>(TicketCategory.Other)
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    if (checked && !user) {
      router.push('/login?next=/support')
    }
  }, [checked, user, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api
      .listMyTickets()
      .then((data) => {
        if (!cancelled) setTickets(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'ბილეთების ჩატვირთვა ვერ მოხერხდა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const createTicket = async (event: FormEvent) => {
    event.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      const ticket = await api.createTicket({ subject, category, description })
      router.push(`/support/${ticket.id}`)
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'ბილეთის შექმნა ვერ მოხერხდა.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Layout>
      <div className="page">
        <div className="page-inner">
          <h1 className="page-title">დახმარება</h1>
          <p className="page-subtitle">გახსენით ბილეთი ან ნახეთ თქვენი წინა მიმოწერა</p>

          <form className="card" style={{ padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={createTicket}>
            <h2 style={{ fontSize: '1rem', margin: 0 }}>ახალი ბილეთი</h2>
            {createError && <div className="status-text status-error">{createError}</div>}
            <div className="form-group">
              <label htmlFor="subject">თემა</label>
              <input id="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={3} />
            </div>
            <div className="form-group">
              <label htmlFor="category">კატეგორია</label>
              <select id="category" className="input" value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
                {Object.values(TicketCategory).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="description">აღწერა</label>
              <textarea id="description" className="input" value={description} onChange={(e) => setDescription(e.target.value)} required minLength={1} />
            </div>
            <button type="submit" className="button glow-on-hover" disabled={creating} style={{ alignSelf: 'flex-start' }}>
              გაგზავნა
            </button>
          </form>

          {error && <div className="status-text status-error">{error}</div>}

          {loading ? (
            <div className="empty-state">იტვირთება…</div>
          ) : tickets.length === 0 ? (
            <div className="empty-state">ბილეთები ჯერ არ არის.</div>
          ) : (
            <div className="order-list">
              {tickets.map((ticket) => (
                <Link key={ticket.id} href={`/support/${ticket.id}`} className="order-card">
                  <div className="order-card-main">
                    <strong>{ticket.subject}</strong>
                    <span className="note" style={{ margin: 0 }}>{CATEGORY_LABELS[ticket.category]}</span>
                  </div>
                  <span className={`order-status order-status-${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
