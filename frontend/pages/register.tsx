import Link from 'next/link'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'

const USERNAME_PATTERN = /^[a-z0-9_-]+$/
// Mirrors backend/src/auth/password-policy.ts — keep these in sync if that changes.
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/

export default function Register() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestUsername = useRef('')

  const isValidUsername = (username: string) => USERNAME_PATTERN.test(username)

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name } = event.target
    let { value } = event.target

    if (name === 'username') {
      value = value.toLowerCase()
      latestUsername.current = value.trim()
      setUsernameAvailable(null)
      setUsernameError('')

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }

      if (value && !isValidUsername(value)) {
        setUsernameError('მხოლოდ ინგლისური პატარა სიმბოლოები.')
      }

      if (value && isValidUsername(value)) {
        debounceTimer.current = setTimeout(() => {
          checkUsername(value)
        }, 500)
      }
    }

    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const checkUsername = async (value: string) => {
    const username = value.trim().toLowerCase()
    if (!username) {
      setUsernameAvailable(null)
      return
    }

    setCheckingUsername(true)
    try {
      const data = await api.checkUsername(username)
      if (latestUsername.current !== username) {
        return
      }
      setUsernameAvailable(data.available)
      setUsernameError(data.available ? '' : 'Username უკვე გამოყენებულია')
    } catch {
      if (latestUsername.current === username) {
        setUsernameAvailable(null)
        setUsernameError('')
      }
    } finally {
      if (latestUsername.current === username) {
        setCheckingUsername(false)
      }
    }
  }

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.username) {
      setError('Username აუცილებელია')
      return
    }

    if (!isValidUsername(form.username)) {
      setError('Username უნდა შედგებოდეს მხოლოდ ინგლისური ასოებით, ციფრებით, ხაზით (_) და ტირეთი (-)')
      return
    }

    if (usernameAvailable === false) {
      setError('ეს Username უკვე გამოყენებულია')
      return
    }

    if (!form.email || !form.firstName || !form.lastName || !form.password || !form.confirmPassword) {
      setError('გთხოვთ შეავსოთ ყველა ველი.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('პაროლები არ ემთხვევა.')
      return
    }

    if (form.password.length < PASSWORD_MIN_LENGTH || !PASSWORD_PATTERN.test(form.password)) {
      setError(`პაროლი უნდა იყოს მინიმუმ ${PASSWORD_MIN_LENGTH} სიმბოლო და შეიცავდეს ასოსა და ციფრს.`)
      return
    }

    setSubmitting(true)
    try {
      await api.register({
        username: form.username,
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
      })
      setSuccess('რეგისტრაცია წარმატებით დასრულდა')
      setForm({ username: '', email: '', firstName: '', lastName: '', password: '', confirmPassword: '' })
      setUsernameAvailable(null)
      setUsernameError('')
      latestUsername.current = ''
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
          <Link className="auth-tab" href="/login" role="tab" aria-selected="false">
            Log in
          </Link>
          <button className="auth-tab active" type="button" role="tab" aria-selected="true">
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>Username</span>
            <input
              autoComplete="username"
              name="username"
              placeholder="choose_username"
              required
              value={form.username}
              onChange={onChange}
            />
          </label>
          {usernameError && (
            <p className="auth-status" style={{ color: 'var(--red)' }}>
              {usernameError}
            </p>
          )}
          {form.username && isValidUsername(form.username) && checkingUsername && <p className="auth-status">შემოწმება...</p>}
          {form.username && isValidUsername(form.username) && usernameAvailable === true && (
            <p className="auth-status" style={{ color: 'var(--green)' }}>
              Username თავისუფალია
            </p>
          )}
          {/* auth.html's own register form has no email field — added here because email
              verification is a non-negotiable rule (root CLAUDE.md §"Non-negotiable rules") the
              backend actually enforces; the static prototype never had a real backend behind it. */}
          <label>
            <span>Email</span>
            <input autoComplete="email" name="email" type="email" placeholder="you@example.com" required value={form.email} onChange={onChange} />
          </label>
          <div className="auth-split">
            <label>
              <span>First name</span>
              <input autoComplete="given-name" name="firstName" placeholder="First name" required value={form.firstName} onChange={onChange} />
            </label>
            <label>
              <span>Last name</span>
              <input autoComplete="family-name" name="lastName" placeholder="Last name" required value={form.lastName} onChange={onChange} />
            </label>
          </div>
          <label>
            <span>Password</span>
            <input
              autoComplete="new-password"
              name="password"
              type="password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="At least 8 characters"
              required
              value={form.password}
              onChange={onChange}
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              autoComplete="new-password"
              name="confirmPassword"
              type="password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="Repeat password"
              required
              value={form.confirmPassword}
              onChange={onChange}
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

          <button
            className="auth-submit-button"
            type="submit"
            disabled={Boolean(usernameError) || checkingUsername || !form.username || submitting}
          >
            Create account
          </button>
        </form>

        <Link className="auth-back-link" href="/marketplace">
          Back to marketplace
        </Link>
      </section>
    </main>
  )
}
