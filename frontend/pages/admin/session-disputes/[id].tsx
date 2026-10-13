import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicCoachingSession, PublicSessionDispute, SessionDisputeResolution } from '@wavehub/shared-types'
import AdminLayout from '../../../components/AdminLayout'
import { api, errorMessage } from '../../../lib/api'
import { SESSION_STATUS_LABELS } from '../../../lib/labels'

// One coaching-session dispute for staff: the session facts (times, confirmations, money), the
// whole thread with evidence, a staff reply, and the Super Admin decision — refund the student or
// pay the coach. Both are final and audit-logged.
type Detail = PublicSessionDispute & { session: PublicCoachingSession }

function fmt(value: string | null): string {
  if (!value) return '—'
  const t = new Date(new Date(value).getTime() + 4 * 3600_000)
  return `${String(t.getUTCDate()).padStart(2, '0')}.${String(t.getUTCMonth() + 1).padStart(2, '0')}.${t.getUTCFullYear()} ${t.toISOString().slice(11, 16)}`
}

export default function AdminSessionDispute() {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [reply, setReply] = useState('')
  const [resolution, setResolution] = useState<SessionDisputeResolution>('refund_student')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    api
      .adminGetSessionDispute(id)
      .then(setD)
      .catch((err) => setError(errorMessage(err, 'დავა ვერ მოიძებნა.')))
  }, [id])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      setD(await api.adminGetSessionDispute(id))
    } catch (err) {
      setError(errorMessage(err, 'მოქმედება ვერ შესრულდა.'))
    } finally {
      setBusy(false)
    }
  }

  const sendReply = (e: FormEvent) => {
    e.preventDefault()
    if (!reply.trim()) return
    void run(async () => {
      await api.adminSessionDisputeMessage(id, reply.trim())
      setReply('')
    })
  }

  const resolve = (e: FormEvent) => {
    e.preventDefault()
    if (note.trim().length < 3) return setError('დაწერე გადაწყვეტილების მიზეზი.')
    const what = resolution === 'refund_student' ? 'სტუდენტს დაუბრუნდება სრული თანხა' : 'ქოუჩს ჩაერიცხება თანხა (საკომისიოს გამოკლებით)'
    if (!window.confirm(`${what}. ეს საბოლოოა. გავაგრძელოთ?`)) return
    void run(() => api.adminResolveSessionDispute(id, resolution, note.trim()))
  }

  const s = d?.session
  return (
    <AdminLayout title="სესიის დავა">
      <Link href="/admin/disputes" className="note">
        ← დავები
      </Link>
      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}
      {!d || !s ? (
        !error && <div className="empty-state">იტვირთება…</div>
      ) : (
        <>
          <h1 className="page-title">
            @{s.buyerUsername} ↔ ქოუჩი @{s.coachUsername}
          </h1>
          <p className="page-subtitle">
            {d.status === 'open' ? 'ღია დავა' : 'გადაწყვეტილია'} · გახსნა @{d.openedByUsername} · {fmt(d.createdAt)}
          </p>

          <section className="card asd-facts">
            <h2>სესია</h2>
            <dl>
              <dt>სტატუსი</dt>
              <dd>{SESSION_STATUS_LABELS[s.status]}</dd>
              <dt>დრო</dt>
              <dd>
                {fmt(s.scheduledAt)} · {s.durationMinutes} წთ{s.packageName ? ` · ${s.packageName}` : ''}
              </dd>
              <dt>ფასი</dt>
              <dd>
                {s.priceWaveCoin} GEL (ქოუჩს: {s.coachPayoutWaveCoin}, საკომისიო: {s.platformFeeWaveCoin})
              </dd>
              <dt>დაწყება დაადასტურა</dt>
              <dd>
                ქოუჩი: {fmt(s.coachStartConfirmedAt)} · სტუდენტი: {fmt(s.buyerStartConfirmedAt)}
              </dd>
              <dt>დაიწყო / დასრულებულად მოინიშნა</dt>
              <dd>
                {fmt(s.startedAt)} / {fmt(s.coachCompletedAt)}
              </dd>
              <dt>სტუდენტის მიზანი</dt>
              <dd>{s.goal ?? '—'}</dd>
            </dl>
          </section>

          <section className="card">
            <h2>საჩივარი</h2>
            <p className="arv-body">{d.reason}</p>
            {d.status === 'resolved' && (
              <p className="status-text status-success">
                {d.resolution === 'refund_student' ? 'თანხა დაუბრუნდა სტუდენტს.' : 'თანხა ჩაერიცხა ქოუჩს.'} {d.resolutionNote}
              </p>
            )}
          </section>

          <section className="card">
            <h2>მიმოწერა და მტკიცებულებები</h2>
            <ol className="sd-messages">
              {d.messages.map((m) => (
                <li key={m.id} className={m.isStaff ? 'staff' : undefined}>
                  <strong>{m.isStaff ? 'WaveHub გუნდი' : `@${m.senderUsername}`}</strong>
                  <time>{fmt(m.createdAt)}</time>
                  {m.body && <p>{m.body}</p>}
                  {m.fileUrl && (
                    <a href={m.fileUrl} target="_blank" rel="noreferrer">
                      {m.fileType?.startsWith('image/') ? '🖼 სურათის გახსნა' : '📎 ფაილის გახსნა'}
                    </a>
                  )}
                </li>
              ))}
              {d.messages.length === 0 && <li className="sd-empty">შეტყობინება ჯერ არ არის.</li>}
            </ol>
            {d.status === 'open' && (
              <form className="stack-form asd-reply" onSubmit={sendReply}>
                <label className="field">
                  პასუხი ორივე მხარეს (ხედავს სტუდენტიც და ქოუჩიც)
                  <textarea rows={2} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} />
                </label>
                <button className="button" type="submit" disabled={busy || !reply.trim()}>
                  გაგზავნა
                </button>
              </form>
            )}
          </section>

          {d.status === 'open' && (
            <form className="stack-form" onSubmit={resolve}>
              <h2>გადაწყვეტილება</h2>
              <label className="asd-choice">
                <input type="radio" name="resolution" checked={resolution === 'refund_student'} onChange={() => setResolution('refund_student')} />
                სტუდენტს დაუბრუნდეს {s.priceWaveCoin} GEL (სესია გაუქმდება)
              </label>
              <label className="asd-choice">
                <input type="radio" name="resolution" checked={resolution === 'pay_coach'} onChange={() => setResolution('pay_coach')} />
                ქოუჩს ჩაერიცხოს {s.coachPayoutWaveCoin} GEL (სესია დასრულდება)
              </label>
              <label className="field">
                მიზეზი (ორივე მხარე ნახავს)
                <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button className="button" type="submit" disabled={busy}>
                {busy ? 'სრულდება…' : 'გადაწყვეტილების მიღება'}
              </button>
            </form>
          )}
        </>
      )}
    </AdminLayout>
  )
}
