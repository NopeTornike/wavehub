import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'

// Mirrors backend/src/auth/password-policy.ts — keep these in sync if that changes.
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/

export default function ResetPassword() {
  const router = useRouter()
  const token = typeof router.query.token === 'string' ? router.query.token : ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!token) {
      setError('ბმული არასწორია — გთხოვთ თავიდან მოითხოვოთ პაროლის აღდგენა.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('პაროლები არ ემთხვევა.')
      return
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH || !PASSWORD_PATTERN.test(newPassword)) {
      setError(`პაროლი უნდა იყოს მინიმუმ ${PASSWORD_MIN_LENGTH} სიმბოლო და შეიცავდეს ასოსა და ციფრს.`)
      return
    }

    setSubmitting(true)
    try {
      await api.resetPassword({ token, newPassword })
      setSuccess('პაროლი წარმატებით შეიცვალა. შეგიძლიათ შეხვიდეთ ახალი პაროლით.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'ბმულის ვადა ამოიწურა ან არასწორია — გთხოვთ თავიდან მოითხოვოთ პაროლის აღდგენა.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page-shell">
      <section className="auth-card" aria-labelledby="authTitle">
        <div className="auth-card-top">
          <Link className="auth-brand" href="/" aria-label="Back to WaveHub">
            <img src="/assets/logo-wavehubx-cropped.png" alt="WaveHubX" />
          </Link>
        </div>
        <div className="auth-card-head">
          <p className="section-kicker">WaveHub account</p>
          <h1 id="authTitle">ახალი პაროლის დაყენება</h1>
        </div>

        {!token && (
          <p className="auth-status" aria-live="polite" style={{ color: 'var(--red)' }}>
            ბმული არასწორია. <Link href="/forgot-password">მოითხოვეთ ახალი</Link>.
          </p>
        )}

        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>ახალი პაროლი</span>
            <input
              autoComplete="new-password"
              name="newPassword"
              type="password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="ახალი პაროლი"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label>
            <span>გაიმეორეთ პაროლი</span>
            <input
              autoComplete="new-password"
              name="confirmPassword"
              type="password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="გაიმეორეთ პაროლი"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>

          {error && (
            <p className="auth-status" aria-live="polite" style={{ color: 'var(--red)' }}>
              {error}
            </p>
          )}
          {success && (
            <p className="auth-status" aria-live="polite" style={{ color: 'var(--green)' }}>
              {success}
            </p>
          )}

          <button className="auth-submit-button" type="submit" disabled={submitting || !token}>
            პაროლის შეცვლა
          </button>
        </form>
        <Link className="auth-back-link" href="/login">
          შესვლაზე დაბრუნება
        </Link>
      </section>
    </main>
  )
}
