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
    <div className="container">
      <div className="card">
        <h1>Email-ის დადასტურება</h1>

        {(!router.isReady || status === 'pending' || status === 'verifying') && (
          <p className="status-text status-info">მოწმდება...</p>
        )}

        {router.isReady && !token && (
          <p className="status-text status-error">ბმული არასწორია — token ვერ მოიძებნა.</p>
        )}

        {status === 'success' && (
          <div>
            <p className="status-text status-success">Email წარმატებით დადასტურდა!</p>
            <Link className="note" href="/login">
              შესვლა
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p className="status-text status-error">{error}</p>
            <button className="glow-on-hover button" type="button" onClick={resend}>
              წერილის თავიდან გამოგზავნა
            </button>
            {resendMessage && <p className="status-text status-info">{resendMessage}</p>}
            <Link className="note" href="/login">
              შესვლაზე დაბრუნება
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
