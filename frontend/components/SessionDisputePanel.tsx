import { useEffect, useState, type FormEvent } from 'react'
import { CoachingSessionStatus, type PublicCoachingSession, type PublicSessionDispute } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'

// Session dispute (backend/src/coaching/coaching-session-disputes.*): a participant opens one while
// the session is in progress or awaiting confirmation; the money is frozen until WaveHub staff
// refund the student or pay the coach. Both sides and staff talk here, with evidence files.
const S = CoachingSessionStatus

function fmt(value: string): string {
  const t = new Date(new Date(value).getTime() + 4 * 3600_000)
  return `${String(t.getUTCDate()).padStart(2, '0')}.${String(t.getUTCMonth() + 1).padStart(2, '0')} ${t.toISOString().slice(11, 16)}`
}

export default function SessionDisputePanel({ session, onChanged }: { session: PublicCoachingSession; onChanged: () => void }) {
  const [dispute, setDispute] = useState<PublicSessionDispute | null | undefined>(undefined)
  const [opening, setOpening] = useState(false)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .getSessionDispute(session.id)
      .then((r) => {
        if (!cancelled) setDispute(r.dispute)
      })
      .catch(() => {
        if (!cancelled) setDispute(null)
      })
    return () => {
      cancelled = true
    }
  }, [session.id, session.status])

  if (dispute === undefined) return null
  const canOpen = !dispute && (session.status === S.InProgress || session.status === S.AwaitingConfirmation)
  if (!dispute && !canOpen) return null

  const run = async (fn: () => Promise<PublicSessionDispute>, after?: () => void) => {
    setBusy(true)
    setError('')
    try {
      setDispute(await fn())
      after?.()
    } catch (err) {
      setError(errorMessage(err, 'მოქმედება ვერ შესრულდა.'))
    } finally {
      setBusy(false)
    }
  }

  const open = (event: FormEvent) => {
    event.preventDefault()
    if (reason.trim().length < 10) return setError('აღწერე პრობლემა მინიმუმ 10 სიმბოლოთი.')
    void run(
      () => api.openSessionDispute(session.id, reason.trim()),
      () => {
        setOpening(false)
        onChanged()
      },
    )
  }

  const send = (event: FormEvent) => {
    event.preventDefault()
    if (!message.trim()) return
    void run(() => api.sendSessionDisputeMessage(session.id, message.trim()), () => setMessage(''))
  }

  if (!dispute) {
    return (
      <section className="sd-panel">
        {!opening ? (
          <button type="button" className="sd-open-link" onClick={() => setOpening(true)}>
            პრობლემაა? გახსენი დავა
          </button>
        ) : (
          <form className="sd-form" onSubmit={open}>
            <h2>დავის გახსნა</h2>
            <p className="note">დავის გახსნისას თანხა იყინება — არც ქოუჩს ერიცხება, არც ავტომატურად დასტურდება — სანამ WaveHub-ის გუნდი არ მიიღებს გადაწყვეტილებას.</p>
            <label className="field">
              რა მოხდა?
              <textarea rows={4} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="მაგ. ქოუჩი 30 წუთით დაგვიანდა და სესია 20 წუთში დაასრულა." />
            </label>
            {error && (
              <p className="seller-status error" role="alert">
                {error}
              </p>
            )}
            <div className="sd-actions">
              <button type="submit" className="sd-danger" disabled={busy}>
                {busy ? 'იგზავნება…' : 'დავის გახსნა'}
              </button>
              <button type="button" className="sd-ghost" onClick={() => setOpening(false)}>
                გაუქმება
              </button>
            </div>
          </form>
        )}
      </section>
    )
  }

  const resolved = dispute.status === 'resolved'
  return (
    <section className={`sd-panel sd-thread${resolved ? ' resolved' : ''}`}>
      <header>
        <h2>{resolved ? 'დავა გადაწყდა' : 'დავა განიხილება'}</h2>
        <span>გახსნა @{dispute.openedByUsername} · {fmt(dispute.createdAt)}</span>
      </header>
      <p className="sd-reason">{dispute.reason}</p>
      {resolved && (
        <p className="sd-outcome">
          {dispute.resolution === 'refund_student' ? 'გადაწყვეტილება: თანხა დაუბრუნდა სტუდენტს.' : 'გადაწყვეტილება: თანხა ჩაერიცხა ქოუჩს.'}
          {dispute.resolutionNote && <> {dispute.resolutionNote}</>}
        </p>
      )}
      <ol className="sd-messages">
        {dispute.messages.map((m) => (
          <li key={m.id} className={m.isStaff ? 'staff' : undefined}>
            <strong>{m.isStaff ? 'WaveHub გუნდი' : `@${m.senderUsername}`}</strong>
            <time>{fmt(m.createdAt)}</time>
            {m.body && <p>{m.body}</p>}
            {m.fileUrl && (
              <a href={m.fileUrl} target="_blank" rel="noreferrer">
                {m.fileType?.startsWith('image/') ? '🖼 სურათი' : '📎 ფაილი'}
              </a>
            )}
          </li>
        ))}
        {dispute.messages.length === 0 && <li className="sd-empty">ჯერ შეტყობინება არ არის — დაწერე შენი მხარე და დაურთე მტკიცებულება.</li>}
      </ol>
      {!resolved && (
        <form className="sd-reply" onSubmit={send}>
          <textarea rows={2} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="დაწერე შეტყობინება…" />
          <div className="sd-actions">
            <button type="submit" disabled={busy || !message.trim()}>
              გაგზავნა
            </button>
            <label className={`sd-ghost${busy ? ' disabled' : ''}`}>
              მტკიცებულების დართვა
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,application/zip"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void run(() => api.uploadSessionDisputeEvidence(session.id, file))
                }}
              />
            </label>
          </div>
          <small className="note">JPG, PNG, WEBP, PDF ან ZIP, მაქს. 20MB.</small>
        </form>
      )}
      {error && (
        <p className="seller-status error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
