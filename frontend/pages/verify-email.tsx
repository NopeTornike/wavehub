import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'

type Status = 'pending' | 'verifying' | 'success' | 'error'

export default function VerifyEmail() {
  const router = useRouter()
  const token = typeof router.query.token === 'string' ? router.query.token : ''

  const [status, setStatus] = useState<Status>('pending')
  const [error, setError] = useState('')
  const [resendMessage, setResendMessage] = useState('')
  const attempted = useRef(false)

  useEffect(() => {
    if (!router.isReady || !token || attempted.current) {
      return
    }
    attempted.current = true

    setStatus('verifying')
    api
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error')
        setError(err instanceof ApiError ? err.message : 'ვერიფიკაცია ვერ მოხერხდა.')
      })
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
      <section className="auth-card" aria-labelledby="authTitle">
        <div className="auth-card-top">
          <Link className="auth-brand" href="/" aria-label="Back to WaveHub">
            <img src="/assets/logo-wavehubx-cropped.png" alt="WaveHubX" />
          </Link>
        </div>
        <div className="auth-card-head">
          <p className="section-kicker">WaveHub account</p>
          <h1 id="authTitle">Email-ის დადასტურება</h1>
        </div>

        {(!router.isReady || status === 'pending' || status === 'verifying') && (
          <p className="auth-status" aria-live="polite">
            მოწმდება...
          </p>
        )}

        {router.isReady && !token && (
          <p className="auth-status" aria-live="polite" style={{ color: 'var(--red)' }}>
            ბმული არასწორია — token ვერ მოიძებნა.
          </p>
        )}

        {status === 'success' && (
          <>
            <p className="auth-status" aria-live="polite" style={{ color: 'var(--green)' }}>
              Email წარმატებით დადასტურდა!
            </p>
            <Link className="auth-back-link" href="/login">
              შესვლა
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
