import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicWalletBalance, PublicWalletTransaction, PublicWithdrawRequest } from '@wavehub/shared-types'
import { WithdrawMethod, WithdrawStatus } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'

const TOPUP_AMOUNTS = [10, 25, 50, 100]

const WITHDRAW_METHOD_LABELS: Record<WithdrawMethod, string> = {
  [WithdrawMethod.BankTransfer]: 'საბანკო გადარიცხვა',
  [WithdrawMethod.PayPal]: 'PayPal',
  [WithdrawMethod.Wise]: 'Wise',
}

const WITHDRAW_STATUS_LABELS: Record<WithdrawStatus, string> = {
  [WithdrawStatus.Pending]: 'მოლოდინში',
  [WithdrawStatus.Processing]: 'მუშავდება',
  [WithdrawStatus.Completed]: 'შესრულებულია',
  [WithdrawStatus.Rejected]: 'უარყოფილია',
  [WithdrawStatus.Cancelled]: 'გაუქმებულია',
}

export default function Wallet() {
  const router = useRouter()
  const { user, checked, refresh } = useAuth()
  const [amount, setAmount] = useState(25)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [balance, setBalance] = useState<PublicWalletBalance | null>(null)
  const [transactions, setTransactions] = useState<PublicWalletTransaction[]>([])
  const [withdrawals, setWithdrawals] = useState<PublicWithdrawRequest[]>([])

  const [withdrawAmount, setWithdrawAmount] = useState(20)
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawMethod>(WithdrawMethod.PayPal)
  const [payoutDetails, setPayoutDetails] = useState<Record<string, string>>({})
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')

  useEffect(() => {
    if (checked && !user) {
      router.push('/login?next=/wallet')
    }
  }, [checked, user, router])

  const loadWalletData = () => {
    api.getWalletBalance().then(setBalance).catch(() => undefined)
    api.listWalletTransactions().then(setTransactions).catch(() => undefined)
    api.listMyWithdrawals().then(setWithdrawals).catch(() => undefined)
  }

  useEffect(() => {
    if (!user) return
    loadWalletData()
  }, [user])

  useEffect(() => {
    // The balance shown was fetched once on app load — after a successful BOG top-up redirect back
    // here, re-fetch it so the new balance actually shows instead of the stale pre-top-up number.
    if (router.query.topup === 'success') {
      refresh()
      loadWalletData()
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

  const submitWithdrawal = async (event: FormEvent) => {
    event.preventDefault()
    setWithdrawError('')
    setWithdrawBusy(true)
    try {
      await api.requestWithdrawal({ amountWaveCoin: withdrawAmount, method: withdrawMethod, payoutDetails })
      setPayoutDetails({})
      loadWalletData()
    } catch (err) {
      setWithdrawError(err instanceof ApiError ? err.message : 'მოთხოვნის გაგზავნა ვერ მოხერხდა.')
    } finally {
      setWithdrawBusy(false)
    }
  }

  const cancelWithdrawal = async (id: string) => {
    setWithdrawBusy(true)
    try {
      await api.cancelWithdrawal(id)
      loadWalletData()
    } catch (err) {
      setWithdrawError(err instanceof ApiError ? err.message : 'გაუქმება ვერ მოხერხდა.')
    } finally {
      setWithdrawBusy(false)
    }
  }

  const payoutFields =
    withdrawMethod === WithdrawMethod.BankTransfer
      ? [
          { key: 'accountHolder', label: 'ანგარიშის მფლობელი' },
          { key: 'iban', label: 'IBAN' },
          { key: 'swift', label: 'SWIFT' },
        ]
      : [{ key: 'email', label: 'ელფოსტა' }]

  return (
    <Layout>
      <div className="page">
        <div className="page-inner" style={{ maxWidth: 640 }}>
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

                {balance && (
                  <div className="balance-grid">
                    <div className="balance-stat">
                      <span className="note" style={{ margin: 0 }}>
                        გასატანად ხელმისაწვდომი
                      </span>
                      <span className="balance-stat-value">{balance.availableToWithdraw} WC</span>
                    </div>
                    <div className="balance-stat">
                      <span className="note" style={{ margin: 0 }}>
                        ლოდინში (7 დღე)
                      </span>
                      <span className="balance-stat-value">{balance.pendingClearance} WC</span>
                    </div>
                    <div className="balance-stat">
                      <span className="note" style={{ margin: 0 }}>
                        სულ გამომუშავებული
                      </span>
                      <span className="balance-stat-value">{balance.totalEarned} WC</span>
                    </div>
                    <div className="balance-stat">
                      <span className="note" style={{ margin: 0 }}>
                        გატანილი
                      </span>
                      <span className="balance-stat-value">{balance.totalWithdrawn} WC</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="card" style={{ marginBottom: 24 }}>
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

              <div className="card" style={{ marginBottom: 24 }}>
                <h2 style={{ marginTop: 0 }}>თანხის გატანა</h2>
                <p className="note">მინიმუმ 20 WC. სესხის დამუშავებას ახდენს ადმინისტრაცია ხელით.</p>
                <form onSubmit={submitWithdrawal}>
                  <div className="form-group">
                    <label htmlFor="withdrawAmount">თანხა (WC)</label>
                    <input
                      id="withdrawAmount"
                      className="input"
                      type="number"
                      min={20}
                      value={withdrawAmount}
                      onChange={(event) => setWithdrawAmount(Number(event.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="withdrawMethod">მეთოდი</label>
                    <select
                      id="withdrawMethod"
                      className="input"
                      value={withdrawMethod}
                      onChange={(event) => {
                        setWithdrawMethod(event.target.value as WithdrawMethod)
                        setPayoutDetails({})
                      }}
                    >
                      {Object.values(WithdrawMethod).map((method) => (
                        <option key={method} value={method}>
                          {WITHDRAW_METHOD_LABELS[method]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {payoutFields.map((field) => (
                    <div className="form-group" key={field.key}>
                      <label htmlFor={field.key}>{field.label}</label>
                      <input
                        id={field.key}
                        className="input"
                        value={payoutDetails[field.key] ?? ''}
                        onChange={(event) =>
                          setPayoutDetails((prev) => ({ ...prev, [field.key]: event.target.value }))
                        }
                        required
                      />
                    </div>
                  ))}
                  {withdrawError && <div className="status-text status-error">{withdrawError}</div>}
                  <button className="button" type="submit" disabled={withdrawBusy || withdrawAmount < 20}>
                    მოთხოვნის გაგზავნა
                  </button>
                </form>

                {withdrawals.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <h2 style={{ fontSize: '1rem' }}>გატანის მოთხოვნები</h2>
                    <div className="order-list">
                      {withdrawals.map((request) => (
                        <div key={request.id} className="order-card">
                          <div className="order-card-main">
                            <strong>{request.amountWaveCoin} WC</strong>
                            <span className="note" style={{ margin: 0 }}>
                              {WITHDRAW_METHOD_LABELS[request.method]}
                              {request.adminNote ? ` · ${request.adminNote}` : ''}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className={`withdraw-status-${request.status}`}>
                              {WITHDRAW_STATUS_LABELS[request.status]}
                            </span>
                            {request.status === WithdrawStatus.Pending && (
                              <button
                                className="button"
                                type="button"
                                disabled={withdrawBusy}
                                onClick={() => cancelWithdrawal(request.id)}
                              >
                                გაუქმება
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {transactions.length > 0 && (
                <div className="card">
                  <h2 style={{ marginTop: 0 }}>ტრანზაქციების ისტორია</h2>
                  <div className="transaction-list">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="transaction-item">
                        <span>{tx.type}</span>
                        <span>{tx.amountWaveCoin > 0 ? `+${tx.amountWaveCoin}` : tx.amountWaveCoin} WC</span>
                        <span className="note" style={{ margin: 0 }}>
                          {new Date(tx.createdAt).toLocaleDateString('ka-GE')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">გადამისამართება…</div>
          )}
        </div>
      </div>
    </Layout>
  )
}
