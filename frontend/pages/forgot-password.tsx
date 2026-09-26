import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import AuthCardTop from '../components/AuthCardTop'
import LanguageSwitcher from '../components/LanguageSwitcher'
import PageHead from '../components/PageHead'

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
      setError(errorMessage(err, 'სერვერთან დაკავშირება ვერ მოხერხდა.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page-shell">
      <LanguageSwitcher floating />
      <PageHead title="პაროლის აღდგენა" description="მოითხოვეთ პაროლის აღდგენის ბმული ელფოსტაზე." noIndex />
      <section className="auth-card" aria-labelledby="authTitle">
        <AuthCardTop />
        <div className="auth-card-head">
          <p className="section-kicker">WaveHub ანგარიში</p>
          <h1 id="authTitle">პაროლის აღდგენა</h1>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>ელფოსტა</span>
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
