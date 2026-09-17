import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'

const apiUrls = [
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  'http://127.0.0.1:4000',
]

type RegistrationPayload = {
  username: string
  firstName: string
  lastName: string
  password: string
}

async function fetchWithTimeout(url: string, options: RequestInit) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 2500)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function registerOnServer(payload: RegistrationPayload) {
  for (const apiUrl of Array.from(new Set(apiUrls))) {
    try {
      const res = await fetchWithTimeout(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
        return { ok: false, error: data?.error || message || 'შეცდომა სერვერზე' }
      }

      return { ok: true, local: false }
    } catch (err) {
      console.warn('Registration API is unavailable:', err)
    }
  }

  return { ok: false, offline: true }
}

export default function Register() {
  const [form, setForm] = useState({
    username: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestUsername = useRef('')

  const isValidUsername = (username: string) => /^[a-z0-9_-]+$/.test(username)

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
      const res = await fetchWithTimeout(
        `${apiUrls[0]}/auth/check-username?username=${encodeURIComponent(username)}`,
        {},
      )
      const data = await res.json()

      if (latestUsername.current !== username) {
        return
      }

      if (data?.available !== undefined) {
        setUsernameAvailable(data.available)
        setUsernameError(data.available ? '' : 'Username უკვე გამოყენებულია')
      } else {
        setUsernameAvailable(null)
        setUsernameError('')
      }
    } catch (err) {
      console.warn('Username API is unavailable:', err)
      if (latestUsername.current === username) {
        setUsernameAvailable(null)
        setUsernameError('Username-ის შემოწმების სერვერი მიუწვდომელია')
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

    if (!form.firstName || !form.lastName || !form.password || !form.confirmPassword) {
      setError('გთხოვთ შეავსოთ ყველა ველი.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('პაროლები არ ემთხვევა.')
      return
    }

    if (form.password.length < 6) {
      setError('პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო.')
      return
    }

    const payload = {
      username: form.username,
      firstName: form.firstName,
      lastName: form.lastName,
      password: form.password,
    }
    const serverResult = await registerOnServer(payload)
    const result = serverResult

    if (!result.ok) {
      setError(result.offline ? 'რეგისტრაციის სერვერი მიუწვდომელია. სცადეთ მოგვიანებით.' : result.error || 'შეცდომა რეგისტრაციისას')
      return
    }

    setSuccess('რეგისტრაცია წარმატებით დასრულდა')
    setForm({ username: '', firstName: '', lastName: '', password: '', confirmPassword: '' })
    setUsernameAvailable(null)
    setUsernameError('')
    latestUsername.current = ''
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
              minLength={6}
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
              minLength={6}
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
            disabled={Boolean(usernameError) || checkingUsername || !form.username}
          >
            Sign up
          </button>
          <div className="note">მომავალში Gmail-ით რეგისტრაცია დაემატება</div>
        </form>
      </div>
    </div>
  )
}
