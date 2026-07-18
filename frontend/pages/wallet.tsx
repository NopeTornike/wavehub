import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import Layout from '../components/Layout'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'

const TOPUP_AMOUNTS = [10, 25, 50, 100]

export default function Wallet() {
  const router = useRouter()
  const { user, checked, refresh } = useAuth()
  const [amount, setAmount] = useState(25)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (checked && !user) {
      router.push('/login?next=/wallet')
    }
  }, [checked, user, router])

  useEffect(() => {
    // The balance shown was fetched once on app load — after a successful BOG top-up redirect back
    // here, re-fetch it so the new balance actually shows instead of the stale pre-top-up number.
    if (router.query.topup === 'success') {
      refresh()
    }
  }, [router.query.topup, refresh])

  const topUp = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const origin = window.location.origin
      const result = await api.createBogTopupOrder({
        amountGel: amount,
        successUrl: `${origin}/wallet?topup=success`,
        failUrl: `${origin}/wallet?topup=fail`,
      })
      window.location.href = result.redirectUrl
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'გადახდის დაწყება ვერ მოხერხდა.')
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <div className="page">
        <div className="page-inner" style={{ maxWidth: 520 }}>
          <h1 className="page-title">საფულე</h1>
          <p className="page-subtitle">თქვენი WaveCoin ბალანსი</p>

          {router.query.topup === 'success' && (
            <div className="status-text status-success">
              გადახდა დადასტურებულია — ბალანსი განახლდება რამდენიმე წამში.
            </div>
          )}
          {router.query.topup === 'fail' && (
            <div className="status-text status-error">გადახდა ვერ შესრულდა. სცადეთ თავიდან.</div>
          )}

          {!checked ? (
            <div className="empty-state">იტვირთება…</div>
          ) : user ? (
            <>
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="wallet-balance">{user.wavecoinBalance} WC</div>
                <p className="note">1 WaveCoin = 1 ლარი</p>
              </div>

              <div className="card">
                <h2 style={{ marginTop: 0 }}>ბალანსის შევსება</h2>
                <form onSubmit={topUp}>
                  <div className="filter-bar">
                    {TOPUP_AMOUNTS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`button${amount === value ? ' glow-on-hover' : ''}`}
                        onClick={() => setAmount(value)}
                      >
                        {value} ₾
                      </button>
                    ))}
                  </div>
                  <div className="form-group">
                    <label htmlFor="amount">თანხა (₾)</label>
                    <input
                      id="amount"
                      className="input"
                      type="number"
                      min={1}
                      value={amount}
                      onChange={(event) => setAmount(Number(event.target.value))}
                    />
                  </div>
                  {error && <div className="status-text status-error">{error}</div>}
                  <button className="button glow-on-hover" type="submit" disabled={submitting || amount < 1}>
                    {submitting ? 'გადამისამართება…' : `შევსება — ${amount} ₾`}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="empty-state">გადამისამართება…</div>
          )}
        </div>
      </div>
    </Layout>
  )
}
