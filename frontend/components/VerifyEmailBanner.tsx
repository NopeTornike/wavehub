import { useEffect, useState } from 'react'
import { UserStatus } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'

// The backend's VerifiedEmailGuard (backend/src/auth/verified-email.guard.ts) answers 403 to
// every money-moving / marketplace-mutating route while an account is `pending_verification`
// (registration auto-logs the user in, so this state is the normal first-session experience).
// This banner explains that up front — once, globally — instead of letting each page discover it
// through a raw English 403. Rendered by Layout, so every app page shows it; bare auth pages don't.
const RESEND_COOLDOWN_SECONDS = 60 // the backend throttles resend-verification to 5 requests/minute

export default function VerifyEmailBanner() {
  const { user, refresh } = useAuth()
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [rechecking, setRechecking] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  if (!user || user.status !== UserStatus.PendingVerification) return null

  const resend = async () => {
    setMessage(null)
    setSending(true)
    try {
      await api.resendVerification()
      setMessage({ kind: 'ok', text: 'დამადასტურებელი წერილი გამოგზავნილია. შეამოწმეთ ელფოსტა (სპამის საქაღალდეც).' })
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err, 'წერილის გაგზავნა ვერ მოხერხდა.') })
    } finally {
      setSending(false)
    }
  }

  // For someone who clicked the link in another tab/device: re-read the session so the banner (and
  // every gated action) unlocks without a hard reload.
  const recheck = async () => {
    setMessage(null)
    setRechecking(true)
    await refresh()
    setRechecking(false)
    setMessage({ kind: 'error', text: 'ელფოსტა ჯერ არ არის დადასტურებული. გახსენით წერილში მითითებული ბმული.' })
  }

  return (
    <div className="verify-banner" role="region" aria-label="ელფოსტის დადასტურება">
      <div className="verify-banner-copy">
        <strong>დაადასტურეთ თქვენი ელფოსტა</strong>
        <span>
          სანამ ელფოსტას არ დაადასტურებთ, ვერ შეძლებთ შეკვეთის გაფორმებას, განცხადების შექმნას, ბალანსის შევსებას,
          თანხის გატანას, სესიის დაჯავშნას, ტურნირზე რეგისტრაციას და მიმოწერის დაწყებას.
        </span>
        {message && (
          <span className={message.kind === 'ok' ? 'verify-banner-ok' : 'verify-banner-error'} role="status">
            {message.text}
          </span>
        )}
      </div>
      <div className="verify-banner-actions">
        <button type="button" onClick={resend} disabled={sending || cooldown > 0}>
          {sending ? 'იგზავნება…' : cooldown > 0 ? `თავიდან გაგზავნა (${cooldown}წმ)` : 'წერილის გამოგზავნა'}
        </button>
        <button type="button" className="secondary" onClick={recheck} disabled={rechecking}>
          {rechecking ? 'მოწმდება…' : 'უკვე დავადასტურე'}
        </button>
      </div>
    </div>
  )
}
