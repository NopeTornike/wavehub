import { useState, type FormEvent } from 'react'

const apiUrls = [
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  'http://127.0.0.1:4000',
]
const sessionKey = 'wavehub.session'

type LoginPayload = {
  username: string
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

async function loginOnServer(payload: LoginPayload) {
  for (const apiUrl of Array.from(new Set(apiUrls))) {
    try {
      const res = await fetchWithTimeout(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
        return { ok: false, error: data?.error || message || 'Username ან პაროლი არასწორია' }
      }

      return { ok: true, user: data.user, local: false }
    } catch (err) {
      console.warn('Login API is unavailable:', err)
    }
  }

  return { ok: false, offline: true }
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const payload = {
      username: username.trim().toLowerCase(),
      password,
    }

    if (!payload.username || !payload.password) {
      setError('გთხოვთ შეიყვანოთ username და პაროლი.')
      return
    }

    const serverResult = await loginOnServer(payload)
    const result = serverResult

    if (!result.ok) {
      setError(result.offline ? 'ავტორიზაციის სერვერი მიუწვდომელია. სცადეთ მოგვიანებით.' : result.error || 'Username ან პაროლი არასწორია')
      return
    }

    window.localStorage.setItem(
      sessionKey,
      JSON.stringify({
        user: result.user,
        loggedInAt: new Date().toISOString(),
      }),
    )
    setPassword('')
    setSuccess(`შესვლა წარმატებით დასრულდა: ${result.user.firstName} ${result.user.lastName}`)
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

          <button className="glow-on-hover button" type="submit">
            შესვლა
          </button>
          <a className="note" href="/register">
            რეგისტრაცია
          </a>
        </form>
      </div>
    </div>
  )
}
