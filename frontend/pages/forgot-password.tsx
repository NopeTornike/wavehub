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
    <main className="auth-page-shell">
      <section className="auth-card" aria-labelledby="authTitle">
        <div className="auth-card-top">
          <Link className="auth-brand" href="/" aria-label="Back to WaveHub">
            <img src="/assets/logo-wavehubx-cropped.png" alt="WaveHubX" />
          </Link>
        </div>
        <div className="auth-card-head">
          <p className="section-kicker">WaveHub account</p>
          <h1 id="authTitle">პაროლის აღდგენა</h1>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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

          <button className="auth-submit-button" type="submit" disabled={submitting}>
            გამოგზავნა
          </button>
        </form>
        <Link className="auth-back-link" href="/login">
          შესვლაზე დაბრუნება
        </Link>
      </section>
    </main>
  )
}
