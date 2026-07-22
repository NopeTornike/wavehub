import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'

// `next` must be a same-origin relative path (starting with exactly one `/`) — never redirect to
// an absolute/protocol-relative URL taken from a query param, that's an open-redirect vector.
function safeNextPath(next: unknown): string {
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
    return next
  }
  return '/'
}

// Matches auth.html's structure — that page combines login+register as two tabs in one form
// shell; here it's two real Next.js routes (/login, /register) instead, with the tab buttons just
// linking between them so it looks and feels the same.
export default function Login() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const trimmedUsername = username.trim().toLowerCase()
    if (!trimmedUsername || !password) {
      setError('გთხოვთ შეიყვანოთ username და პაროლი.')
      return
    }

    setSubmitting(true)
    try {
      await api.login({ username: trimmedUsername, password })
      setPassword('')
      await refresh()
      router.push(safeNextPath(router.query.next))
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
          <h1 id="authTitle">Log in or create account</h1>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Authentication">
          <button className="auth-tab active" type="button" role="tab" aria-selected="true">
            Log in
          </button>
          <Link className="auth-tab" href="/register" role="tab" aria-selected="false">
            Register
          </Link>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>Username</span>
            <input
              autoComplete="username"
              name="username"
              placeholder="your_username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              name="password"
              placeholder="Password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p className="auth-status" aria-live="polite" style={{ color: 'var(--red)' }}>
              {error}
            </p>
          )}
          <button className="auth-submit-button" type="submit" disabled={submitting}>
            Log in
          </button>
        </form>

        <Link className="auth-back-link" href="/forgot-password">
          დაგავიწყდათ პაროლი?
        </Link>
        <Link className="auth-back-link" href="/marketplace">
          Back to marketplace
        </Link>
      </section>
    </main>
  )
}
