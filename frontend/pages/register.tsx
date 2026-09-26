import Link from 'next/link'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import AuthCardTop from '../components/AuthCardTop'
import LanguageSwitcher from '../components/LanguageSwitcher'
import PageHead from '../components/PageHead'
import { useAuth } from '../lib/auth'

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
  const { refresh } = useAuth()
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
      setSuccess(
        'რეგისტრაცია წარმატებით დასრულდა! დამადასტურებელი წერილი გამოგიგზავნეთ ელფოსტაზე — სანამ ბმულზე არ გადახვალთ, ყიდვა, გაყიდვა და ბალანსის შევსება ვერ იქნება ხელმისაწვდომი.',
      )
      // Registration also logs the new account in (session cookie) — sync the shared auth state so
      // the topbar and the verify-your-email banner show up without a reload.
      await refresh()
      setForm({ username: '', email: '', firstName: '', lastName: '', password: '', confirmPassword: '' })
      setUsernameAvailable(null)
      setUsernameError('')
      latestUsername.current = ''
    } catch (err) {
      setError(errorMessage(err, 'სერვერთან დაკავშირება ვერ მოხერხდა.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page-shell">
      <LanguageSwitcher floating />
      <PageHead title="რეგისტრაცია" description="შექმენით WaveHub ანგარიში და დაიწყეთ გაყიდვა ან შეძენა." noIndex />
      <section className="auth-card" aria-labelledby="authTitle">
        <AuthCardTop />

        <div className="auth-card-head">
          <p className="section-kicker">WaveHub ანგარიში</p>
          <h1 id="authTitle">შედით ან შექმენით ანგარიში</h1>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="ავტორიზაცია">
          <Link className="auth-tab" href="/login" role="tab" aria-selected="false">
            შესვლა
          </Link>
          <button className="auth-tab active" type="button" role="tab" aria-selected="true">
            რეგისტრაცია
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>მომხმარებლის სახელი</span>
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
            <span>ელფოსტა</span>
            <input autoComplete="email" name="email" type="email" placeholder="you@example.com" required value={form.email} onChange={onChange} />
          </label>
          <div className="auth-split">
            <label>
              <span>სახელი</span>
              <input autoComplete="given-name" name="firstName" placeholder="სახელი" required value={form.firstName} onChange={onChange} />
            </label>
            <label>
              <span>გვარი</span>
              <input autoComplete="family-name" name="lastName" placeholder="გვარი" required value={form.lastName} onChange={onChange} />
            </label>
          </div>
          <label>
            <span>პაროლი</span>
            <input
              autoComplete="new-password"
              name="password"
              type="password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="მინიმუმ 8 სიმბოლო"
              required
              value={form.password}
              onChange={onChange}
            />
          </label>
          <label>
            <span>პაროლის დადასტურება</span>
            <input
              autoComplete="new-password"
              name="confirmPassword"
              type="password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="გაიმეორეთ პაროლი"
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
            ანგარიშის შექმნა
          </button>
        </form>

        <Link className="auth-back-link" href="/marketplace">
          მარკეტფლეისზე დაბრუნება
        </Link>
      </section>
    </main>
  )
}
