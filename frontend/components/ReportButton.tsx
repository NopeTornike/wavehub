import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/router'
import type { ReportReason, ReportTargetType } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'

// "Report" for a user / listing / coach / review / message (backend/src/trust/). Goes to the
// Trust & Safety queue; the reporter is never shown to the reported person.
const REASONS: Array<[ReportReason, string]> = [
  ['fraud', 'თაღლითობა / გადახდა საიტის გარეთ'],
  ['scam_listing', 'ყალბი ან მატყუარა განცხადება'],
  ['harassment', 'შეურაცხყოფა ან მუქარა'],
  ['offensive', 'შეუფერებელი კონტენტი'],
  ['spam', 'სპამი'],
  ['fake_account', 'ყალბი ანგარიში'],
  ['other', 'სხვა'],
]

export default function ReportButton({ targetType, targetId, label = 'დაჩივრება', className }: { targetType: ReportTargetType; targetId: string; label?: string; className?: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('fraud')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })

  const start = () => {
    if (!user) return void router.push(`/login?next=${encodeURIComponent(router.asPath)}`)
    setStatus({ kind: '', text: '' })
    setOpen(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.createReport({ targetType, targetId, reason, details: details.trim() || undefined })
      setStatus({ kind: 'success', text: 'მადლობა — საჩივარი გადაეცა უსაფრთხოების გუნდს.' })
      setDetails('')
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'გაგზავნა ვერ მოხერხდა.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className ?? 'report-link'} onClick={start}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 21V4m0 0h11l-2 4 2 4H5" />
        </svg>
        {label}
      </button>
      {open && (
        <div className="report-overlay" role="dialog" aria-modal="true" aria-labelledby="reportTitle" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <form className="report-modal" onSubmit={submit}>
            <header>
              <h2 id="reportTitle">დაჩივრება</h2>
              <button type="button" aria-label="დახურვა" onClick={() => setOpen(false)}>
                ×
              </button>
            </header>
            {status.kind === 'success' ? (
              <p className="report-ok" role="status">
                {status.text}
              </p>
            ) : (
              <>
                <fieldset>
                  <legend>მიზეზი</legend>
                  {REASONS.map(([value, text]) => (
                    <label key={value}>
                      <input type="radio" name="reportReason" value={value} checked={reason === value} onChange={() => setReason(value)} />
                      <span>{text}</span>
                    </label>
                  ))}
                </fieldset>
                <label className="report-details">
                  დეტალები (არასავალდებულო)
                  <textarea rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="რა მოხდა? დაამატე ნებისმიერი დეტალი, რომელიც დაგვეხმარება." />
                </label>
                {status.kind === 'error' && (
                  <p className="report-error" role="alert">
                    {status.text}
                  </p>
                )}
                <button type="submit" className="report-submit" disabled={busy}>
                  {busy ? 'იგზავნება…' : 'გაგზავნა'}
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </>
  )
}
