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
    <div className="container">
      <div className="card">
        <h1>ახალი პაროლის დაყენება</h1>
        {!token && (
          <p className="status-text status-error">
            ბმული არასწორია. <Link href="/forgot-password">მოითხოვეთ ახალი</Link>.
          </p>
        )}
        <form className="register-form" onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="newPassword">ახალი პაროლი</label>
            <input
              id="newPassword"
              autoComplete="new-password"
              className="input"
              name="newPassword"
              type="password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="ახალი პაროლი"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">გაიმეორეთ პაროლი</label>
            <input
              id="confirmPassword"
              autoComplete="new-password"
              className="input"
              name="confirmPassword"
              type="password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="გაიმეორეთ პაროლი"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          {error && <div className="status-text status-error">{error}</div>}
          {success && <div className="status-text status-success">{success}</div>}

          <button className="glow-on-hover button" type="submit" disabled={submitting || !token}>
            პაროლის შეცვლა
          </button>
          <Link className="note" href="/login">
            შესვლაზე დაბრუნება
          </Link>
        </form>
      </div>
    </div>
  )
}
