import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'

// Type the 6-digit code from the verification email. Gmail disables every link in a message it puts
// in Spam, so the button in the email can be dead — the code always works. Signed-in pending
// accounts only (the backend checks it against that account's newest email).
export default function EmailCodeForm({ onVerified }: { onVerified?: () => void }) {
  const { refresh } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) return setError('კოდი 6 ციფრია.')
    setBusy(true)
    setError('')
    try {
      await api.verifyEmailCode(code)
      await refresh()
      onVerified?.()
    } catch (err) {
      setError(errorMessage(err, 'კოდი არასწორია ან ვადაგასულია.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="email-code-form" onSubmit={submit}>
      <label htmlFor="emailCode">წერილში მოცემული 6-ციფრიანი კოდი</label>
      <div>
        <input
          id="emailCode"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <button type="submit" disabled={busy || code.length !== 6}>
          {busy ? 'მოწმდება…' : 'დადასტურება'}
        </button>
      </div>
      {error && (
        <span className="email-code-error" role="alert">
          {error}
        </span>
      )}
    </form>
  )
}
