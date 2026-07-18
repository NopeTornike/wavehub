import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'

// `next` must be a same-origin relative path (starting with exactly one `/`) — never redirect to
// an absolute/protocol-relative URL taken from a query param, that's an open-redirect vector.
function safeNextPath(next: unknown): string {
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
    return next
  }
  return '/'
}

export default function Login() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const trimmedUsername = username.trim().toLowerCase()
    if (!trimmedUsername || !password) {
      setError('გთხოვთ შეიყვანოთ username და პაროლი.')
      return
    }

    setSubmitting(true)
    try {
      const result = await api.login({ username: trimmedUsername, password })
      setPassword('')
      setSuccess(`შესვლა წარმატებით დასრულდა: ${result.user.firstName} ${result.user.lastName}`)
      router.push(safeNextPath(router.query.next))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'სერვერთან დაკავშირება ვერ მოხერხდა.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h1>WaveHub - შესვლა</h1>
        <p className="note">შედით username-ით და პაროლით</p>
        <form className="register-form" onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              autoComplete="username"
              className="input"
              name="username"
              placeholder="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">პაროლი</label>
            <input
              id="password"
              autoComplete="current-password"
              className="input"
              name="password"
              placeholder="პაროლი"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error && <div className="status-text status-error">{error}</div>}
          {success && <div className="status-text status-success">{success}</div>}

          <button className="glow-on-hover button" type="submit" disabled={submitting}>
            შესვლა
          </button>
          <Link className="note" href="/register">
            რეგისტრაცია
          </Link>
          <Link className="note" href="/forgot-password">
            დაგავიწყდათ პაროლი?
          </Link>
        </form>
      </div>
    </div>
  )
}
