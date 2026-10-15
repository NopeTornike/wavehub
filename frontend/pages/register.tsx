/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { UserStatus } from '@wavehub/shared-types'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import PageHead from '../components/PageHead'
import AuthShell from '../components/auth/AuthShell'
import AuthIcon from '../components/auth/AuthIcons'
import PasswordInput from '../components/auth/PasswordInput'
import { useAuthModal } from '../lib/auth-modal'
import { useAuth } from '../lib/auth'
import EmailCodeForm from '../components/EmailCodeForm'

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
  const [agreed, setAgreed] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const { openLogin } = useAuthModal()
  const { user, refresh } = useAuth()
  const router = useRouter()
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

    if (!agreed) {
      setError('რეგისტრაციისთვის დაეთანხმე მომსახურების პირობებს და კონფიდენციალურობის პოლიტიკას.')
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
      setRegisteredEmail(form.email.trim().toLowerCase())
      setSuccess('ok')
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
    <AuthShell
      topAction={
        <button type="button" className="ax-top-link" onClick={() => openLogin('/')}>
          შესვლა
        </button>
      }
    >
      <PageHead title="რეგისტრაცია" description="შექმენით WaveHubX ანგარიში და დაიწყეთ გაყიდვა ან შეძენა." noIndex />
      <img className="ax-logo" src="/assets/logo-wavehubx-main.png" alt="WaveHubX" />
      <h1 className="ax-heading">
        შემოგვიერთდი <span>WaveHubX</span>-ზე
      </h1>
      <p className="ax-lead">შექმენი ანგარიში და დაიწყე შენი მოგზაურობა გეიმინგ მარკეტში.</p>

      {success && user?.status === UserStatus.PendingVerification ? (
        <VerifyEmailSteps email={registeredEmail} onVerified={() => void router.push('/')} />
      ) : success && user ? (
        <p className="ax-ok" role="status">
          ელფოსტა დადასტურებულია — ანგარიში აქტიურია.
        </p>
      ) : (
        <form className="ax-form" onSubmit={submit} noValidate>
          <div className="ax-split">
            <label className="ax-field">
              <span className="ax-sr">სახელი</span>
              <AuthIcon name="user" />
              <input autoComplete="given-name" name="firstName" placeholder="სახელი" required value={form.firstName} onChange={onChange} />
            </label>
            <label className="ax-field">
              <span className="ax-sr">გვარი</span>
              <AuthIcon name="user" />
              <input autoComplete="family-name" name="lastName" placeholder="გვარი" required value={form.lastName} onChange={onChange} />
            </label>
          </div>
          <label className="ax-field">
            <span className="ax-sr">Username</span>
            <AuthIcon name="user" />
            <input autoComplete="username" name="username" placeholder="Username" required value={form.username} onChange={onChange} />
          </label>
          {usernameError && <p className="ax-hint bad">{usernameError}</p>}
          {form.username && isValidUsername(form.username) && checkingUsername && <p className="ax-hint">შემოწმება...</p>}
          {form.username && isValidUsername(form.username) && usernameAvailable === true && <p className="ax-hint good">Username თავისუფალია</p>}
          <label className="ax-field">
            <span className="ax-sr">ელფოსტა</span>
            <AuthIcon name="mail" />
            <input autoComplete="email" name="email" type="email" placeholder="ელფოსტა" required value={form.email} onChange={onChange} />
          </label>
          <PasswordInput name="password" label="პაროლი" placeholder="პაროლი (მინ. 8 სიმბოლო)" autoComplete="new-password" value={form.password} onChange={onChange} />
          <PasswordInput name="confirmPassword" label="პაროლის დადასტურება" placeholder="გაიმეორე პაროლი" autoComplete="new-password" value={form.confirmPassword} onChange={onChange} />
          <label className="ax-check ax-terms">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              ვეთანხმები <Link href="/pages/terms">მომსახურების პირობებს</Link> და <Link href="/pages/privacy">კონფიდენციალურობის პოლიტიკას</Link>
            </span>
          </label>
          {error && (
            <p className="ax-error" role="alert">
              {error}
            </p>
          )}
          <button className="ax-submit" type="submit" disabled={Boolean(usernameError) || checkingUsername || !form.username || submitting}>
            {submitting ? 'იქმნება…' : 'ანგარიშის შექმნა'} <AuthIcon name="arrow" />
          </button>
          <p className="ax-switch">
            უკვე გაქვს ანგარიში?{' '}
            <button type="button" onClick={() => openLogin('/')}>
              შესვლა
            </button>
          </p>
        </form>
      )}
    </AuthShell>
  )
}

// After registering (owner 2026-10-15: "people don't understand how to confirm"): what happened,
// where the email is (incl. Spam / Promotions), the code box, and a resend with a cooldown.
function VerifyEmailSteps({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])
  const resend = async () => {
    setSending(true)
    setMessage(null)
    try {
      await api.resendVerification()
      setMessage({ kind: 'ok', text: 'ახალი კოდი გამოგზავნილია. გამოიყენე ბოლო წერილის კოდი.' })
      setCooldown(60)
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err, 'წერილის გაგზავნა ვერ მოხერხდა.') })
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="ax-verify">
      <h2>დაადასტურე ელფოსტა</h2>
      <ol>
        <li>
          <b>1</b>
          <span>
            გამოგიგზავნეთ წერილი მისამართზე <strong>{email || 'შენს ელფოსტაზე'}</strong>.
          </span>
        </li>
        <li>
          <b>2</b>
          <span>გახსენი წერილი WaveHubX-ისგან. თუ Inbox-ში არ ჩანს, შეამოწმე Spam და Promotions საქაღალდეები — მოსვლას შეიძლება რამდენიმე წუთი დასჭირდეს.</span>
        </li>
        <li>
          <b>3</b>
          <span>შეიყვანე წერილში მოცემული 6-ციფრიანი კოდი აქ (ან დააჭირე წერილში ღილაკს).</span>
        </li>
      </ol>
      <EmailCodeForm onVerified={onVerified} />
      <button type="button" className="ax-resend" onClick={() => void resend()} disabled={sending || cooldown > 0}>
        {sending ? 'იგზავნება…' : cooldown > 0 ? `კოდის თავიდან გაგზავნა (${cooldown}წმ)` : 'წერილი არ მოვიდა? კოდის თავიდან გაგზავნა'}
      </button>
      {message && (
        <p className={message.kind === 'ok' ? 'ax-ok' : 'ax-error'} role="status">
          {message.text}
        </p>
      )}
    </div>
  )
}
