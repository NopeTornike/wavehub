import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { AdminTicketSummary } from '@wavehub/shared-types'
import { TicketCategory, TicketStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { CategoryIcon, TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS, formatTicketDate } from '../../lib/support'

// Support has no page in the static prototype, so it uses the prototype's page-head + dark card
// language (`sp-` CSS at the end of global.css). The category is a chip grid rather than a native
// <select>, whose OS-drawn option list ignored the dark theme.

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
        if (!cancelled) setError(errorMessage(err, 'ბილეთების ჩატვირთვა ვერ მოხერხდა.'))
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
    if (subject.trim().length < 3) return setCreateError('თემა: მინიმუმ 3 სიმბოლო.')
    if (!description.trim()) return setCreateError('აღწერეთ პრობლემა.')
    setCreating(true)
    try {
      const ticket = await api.createTicket({ subject: subject.trim(), category, description: description.trim() })
      router.push(`/support/${ticket.id}`)
    } catch (err) {
      setCreateError(errorMessage(err, 'ბილეთის შექმნა ვერ მოხერხდა.'))
    } finally {
      setCreating(false)
    }
  }

  const openCount = tickets.filter((t) => t.status !== TicketStatus.Closed).length

  return (
    <Layout title="დახმარება" noIndex>
      <div className="sp-page">
        <header className="sp-head">
          <div>
            <p className="sp-kicker">დახმარების ცენტრი</p>
            <h1>დახმარება</h1>
            <p>გახსენით ბილეთი ან ნახეთ თქვენი წინა მიმოწერა</p>
          </div>
        </header>

        <div className="sp-layout">
          <form className="sp-card sp-form" onSubmit={createTicket}>
            <h2>ახალი ბილეთი</h2>
            <label className="sp-field">
              <span>თემა</span>
              <input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} placeholder="მოკლედ აღწერეთ საკითხი" />
            </label>
            <fieldset className="sp-field">
              <legend>კატეგორია</legend>
              <div className="sp-categories" role="radiogroup">
                {Object.values(TicketCategory).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={category === c}
                    className={category === c ? 'active' : undefined}
                    onClick={() => setCategory(c)}
                  >
                    <CategoryIcon category={c} />
                    <span>{TICKET_CATEGORY_LABELS[c]}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="sp-field">
              <span>აღწერა</span>
              <textarea rows={6} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="რა მოხდა? მიუთითეთ შეკვეთა ან თარიღი, თუ საჭიროა." />
            </label>
            {createError && (
              <p className="sp-error" role="alert">
                {createError}
              </p>
            )}
            <button type="submit" className="sp-primary" disabled={creating}>
              {creating ? 'იგზავნება…' : 'გაგზავნა'}
            </button>
          </form>

          <section className="sp-card sp-tickets">
            <header>
              <h2>ჩემი ბილეთები</h2>
              {tickets.length > 0 && (
                <span className="sp-count">
                  {openCount} <span>ღია</span>
                </span>
              )}
            </header>
            {error && (
              <p className="sp-error" role="alert">
                {error}
              </p>
            )}
            {loading ? (
              <p className="sp-empty">იტვირთება…</p>
            ) : tickets.length === 0 ? (
              <p className="sp-empty">ბილეთები ჯერ არ არის.</p>
            ) : (
              <ul className="sp-ticket-list">
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link href={`/support/${ticket.id}`} className="sp-ticket">
                      <span className="sp-ticket-icon">
                        <CategoryIcon category={ticket.category} />
                      </span>
                      <span className="sp-ticket-copy">
                        <strong>{ticket.subject}</strong>
                        <small>
                          <span>{TICKET_CATEGORY_LABELS[ticket.category]}</span> · {formatTicketDate(ticket.updatedAt)}
                        </small>
                      </span>
                      <em className={`sp-status ${ticket.status}`}>{TICKET_STATUS_LABELS[ticket.status]}</em>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Layout>
  )
}
