import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!email.trim()) {
      setError('გთხოვთ შეიყვანოთ email.')
      return
    }

    setSubmitting(true)
    try {
      await api.requestPasswordReset(email.trim().toLowerCase())
      // Backend always resolves ok:true regardless of whether the email is registered
      // (avoids leaking which emails exist) — the UI reflects that same behavior.
      setSuccess('თუ ეს email დარეგისტრირებულია, პაროლის აღდგენის ბმული გამოგზავნილია.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'სერვერთან დაკავშირება ვერ მოხერხდა.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h1>პაროლის აღდგენა</h1>
        <p className="note">შეიყვანეთ თქვენი email და გამოგზავნით აღდგენის ბმულს</p>
        <form className="register-form" onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              autoComplete="email"
              className="input"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {error && <div className="status-text status-error">{error}</div>}
          {success && <div className="status-text status-success">{success}</div>}

          <button className="glow-on-hover button" type="submit" disabled={submitting}>
            გამოგზავნა
          </button>
          <Link className="note" href="/login">
            შესვლაზე დაბრუნება
          </Link>
        </form>
      </div>
    </div>
  )
}
