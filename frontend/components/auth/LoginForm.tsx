import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import AuthIcon from './AuthIcons'
import PasswordInput from './PasswordInput'

// `next` must be a same-origin relative path (starting with exactly one `/`) — never redirect to
// an absolute/protocol-relative URL taken from a query param, that's an open-redirect vector.
export function safeNextPath(next: unknown): string {
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) return next
  return ''
}

// The login form (owner design 2026-10-15): one form for the /login page, the desktop side drawer
// and the phone card. Username or email, password with show/hide, "Remember me" (off = the session
// ends with the browser), forgot password, sign-up link.
export default function LoginForm({ next, onDone, onSignUp }: { next?: string; onDone?: () => void; onSignUp?: () => void }) {
  const router = useRouter()
  const { refresh } = useAuth()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const value = login.trim().toLowerCase()
    if (!value || !password) {
      setError('შეიყვანეთ ელფოსტა ან Username და პაროლი.')
      return
    }
    setSubmitting(true)
    try {
      await api.login({ username: value, password, remember })
      setPassword('')
      await refresh()
      onDone?.()
      const target = safeNextPath(next)
      if (target) void router.push(target)
    } catch (err) {
      setError(errorMessage(err, 'სერვერთან დაკავშირება ვერ მოხერხდა.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="ax-form" onSubmit={submit} noValidate>
      <label className="ax-field">
        <span className="ax-sr">ელფოსტა ან Username</span>
        <AuthIcon name="mail" />
        <input name="username" autoComplete="username" placeholder="ელფოსტა ან Username" required value={login} onChange={(e) => setLogin(e.target.value)} />
      </label>
      <PasswordInput name="password" label="პაროლი" placeholder="პაროლი" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div className="ax-row">
        <label className="ax-check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>დამიმახსოვრე</span>
        </label>
        <Link href="/forgot-password" onClick={onDone}>
          დაგავიწყდა პაროლი?
        </Link>
      </div>
      {error && (
        <p className="ax-error" role="alert">
          {error}
        </p>
      )}
      <button className="ax-submit" type="submit" disabled={submitting}>
        {submitting ? 'შესვლა…' : 'შესვლა'} <AuthIcon name="arrow" />
      </button>
      <p className="ax-switch">
        არ გაქვს ანგარიში?{' '}
        {onSignUp ? (
          <button type="button" onClick={onSignUp}>
            რეგისტრაცია
          </button>
        ) : (
          <Link href="/register">რეგისტრაცია</Link>
        )}
      </p>
    </form>
  )
}
