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
    <div className="container">
      <div className="card">
        <h1>WaveHub - რეგისტრაცია</h1>
        <p className="note">პლატფორმა თამაშებისა და ექაუნთების ყიდვა/გაყიდვისთვის</p>
        <form className="register-form" onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              autoComplete="username"
              className="input"
              name="username"
              placeholder="შეიყვანეთ უნიკალური username"
              required
              value={form.username}
              onChange={onChange}
            />
            {usernameError && <div className="status-text status-error">{usernameError}</div>}
            {form.username && isValidUsername(form.username) && checkingUsername && (
              <div className="status-text status-info">შემოწმება...</div>
            )}
            {form.username && isValidUsername(form.username) && usernameAvailable === true && (
              <div className="status-text status-success">Username თავისუფალია</div>
            )}
          </div>
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
              value={form.email}
              onChange={onChange}
            />
          </div>
          <div className="row-two">
            <div className="form-group">
              <label htmlFor="firstName">სახელი</label>
              <input
                id="firstName"
                autoComplete="given-name"
                className="input"
                name="firstName"
                placeholder="სახელი"
                required
                value={form.firstName}
                onChange={onChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">გვარი</label>
              <input
                id="lastName"
                autoComplete="family-name"
                className="input"
                name="lastName"
                placeholder="გვარი"
                required
                value={form.lastName}
                onChange={onChange}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="password">პაროლი</label>
            <input
              id="password"
              autoComplete="new-password"
              className="input"
              name="password"
              type="password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="პაროლი"
              required
              value={form.password}
              onChange={onChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">პაროლის გამეორება</label>
            <input
              id="confirmPassword"
              autoComplete="new-password"
              className="input"
              name="confirmPassword"
              type="password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="პაროლის გამეორება"
              required
              value={form.confirmPassword}
              onChange={onChange}
            />
          </div>

          {error && <div className="status-text status-error">{error}</div>}
          {success && <div className="status-text status-success">{success}</div>}

          <button
            className="glow-on-hover button"
            type="submit"
            disabled={Boolean(usernameError) || checkingUsername || !form.username || submitting}
          >
            Sign up
          </button>
          <div className="note">მომავალში Gmail-ით რეგისტრაცია დაემატება</div>
        </form>
      </div>
    </div>
  )
}
