import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../lib/api'
import AuthCardTop from '../components/AuthCardTop'
import LanguageSwitcher from '../components/LanguageSwitcher'
import PageHead from '../components/PageHead'
import { useAuth } from '../lib/auth'
import { UserStatus } from '@wavehub/shared-types'
import EmailCodeForm from '../components/EmailCodeForm'

type Status = 'pending' | 'verifying' | 'success' | 'error'

export default function VerifyEmail() {
  const router = useRouter()
  const token = typeof router.query.token === 'string' ? router.query.token : ''

  const [status, setStatus] = useState<Status>('pending')
  const [error, setError] = useState('')
  const [resendMessage, setResendMessage] = useState('')
  const attempted = useRef(false)
  const { user, refresh } = useAuth()

  useEffect(() => {
    if (!router.isReady || !token || attempted.current) {
      return
    }
    attempted.current = true

    setStatus('verifying')
    api
      .verifyEmail(token)
      .then(() => {
        setStatus('success')
        // If the visitor is logged in in this browser, unlock the gated actions + hide the banner now.
        void refresh()
      })
      .catch((err) => {
        setStatus('error')
        setError(errorMessage(err, 'ვერიფიკაცია ვერ მოხერხდა.'))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `refresh` is stable; the attempt runs once
  }, [router.isReady, token])

  const resend = async () => {
    setResendMessage('')
    try {
      await api.resendVerification()
      setResendMessage('ვერიფიკაციის წერილი თავიდან გამოგზავნილია.')
    } catch {
      setResendMessage('გთხოვთ შეხვიდეთ სისტემაში ახალი ვერიფიკაციის წერილის მისაღებად.')
    }
  }

  return (
    <main className="auth-page-shell">
      <LanguageSwitcher floating />
      <PageHead title="ელფოსტის დადასტურება" description="დაადასტურეთ თქვენი ელფოსტა WaveHub-ზე." noIndex />
      <section className="auth-card" aria-labelledby="authTitle">
        <AuthCardTop />
        <div className="auth-card-head">
          <p className="section-kicker">WaveHub ანგარიში</p>
          <h1 id="authTitle">Email-ის დადასტურება</h1>
        </div>

        {(!router.isReady || (token && (status === 'pending' || status === 'verifying'))) && (
          <p className="auth-status" aria-live="polite">
            მოწმდება...
          </p>
        )}

        {router.isReady && !token && user?.status !== UserStatus.PendingVerification && status !== 'success' && (
          <p className="auth-status" aria-live="polite">
            {user ? 'ელფოსტა უკვე დადასტურებულია.' : 'შედით ანგარიშზე და შეიყვანეთ წერილში მოცემული 6-ციფრიანი კოდი, ან გახსენით წერილის ბმული.'}
          </p>
        )}

        {router.isReady && status !== 'success' && user?.status === UserStatus.PendingVerification && (
          <EmailCodeForm onVerified={() => setStatus('success')} />
        )}

        {status === 'success' && (
          <>
            <p className="auth-status" aria-live="polite" style={{ color: 'var(--green)' }}>
              Email წარმატებით დადასტურდა!
            </p>
            <Link className="auth-back-link" href={user ? '/marketplace' : '/login'}>
              {user ? 'მარკეტფლეისზე გადასვლა' : 'შესვლა'}
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="auth-status" aria-live="polite" style={{ color: 'var(--red)' }}>
              {error}
            </p>
            <button className="auth-submit-button" type="button" onClick={resend}>
              წერილის თავიდან გამოგზავნა
            </button>
            {resendMessage && (
              <p className="auth-status" aria-live="polite">
                {resendMessage}
              </p>
            )}
            <Link className="auth-back-link" href="/login">
              შესვლაზე დაბრუნება
            </Link>
          </>
        )}
      </section>
    </main>
  )
}
