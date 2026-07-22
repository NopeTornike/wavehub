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
      <section className="wallet-page-head">
        <h1>ჩემი საფულე</h1>
        <p>მართეთ ბალანსი, ტრანზაქციები და WaveCoin შევსება.</p>
      </section>

      {router.query.topup === 'success' && (
        <div className="status-text status-success">
          გადახდა დადასტურებულია — ბალანსი განახლდება რამდენიმე წამში.
        </div>
      )}
      {router.query.topup === 'fail' && (
        <div className="status-text status-error">გადახდა ვერ შესრულდა. სცადეთ თავიდან.</div>
      )}

      {!checked ? (
        <div className="marketplace-empty">იტვირთება…</div>
      ) : user ? (
        <>
          <section className="wallet-dashboard-hero">
            <div className="wallet-hero-balance">
              <span>საერთო ბალანსი</span>
              <h2>
                <strong>{user.wavecoinBalance} WC</strong>
              </h2>
              <small>1 WaveCoin = 1 ლარი</small>
            </div>
            <div className="wallet-hero-art" aria-hidden="true">
              <span className="wallet-hero-coin">W</span>
              <span className="wallet-hero-shape" />
            </div>
            <dl className="wallet-hero-breakdown">
              <div>
                <dt>
                  <i className="available" />
                  ხელმისაწვდომი გასატანად
                </dt>
                <dd>{balance?.availableToWithdraw ?? 0} WC</dd>
              </div>
              <div>
                <dt>
                  <i className="escrow" />
                  ლოდინში (7 დღე)
                </dt>
                <dd>{balance?.pendingClearance ?? 0} WC</dd>
              </div>
              <div>
                <dt>
                  <i className="pending" />
                  სულ გამომუშავებული
                </dt>
                <dd>{balance?.totalEarned ?? 0} WC</dd>
              </div>
              <div>
                <dt>
                  <i className="withdrawn" />
                  გატანილი
                </dt>
                <dd>{balance?.totalWithdrawn ?? 0} WC</dd>
              </div>
            </dl>
          </section>

          <section className="wallet-layout" aria-label="საფულის მართვა">
            <form className="wallet-buy-panel" onSubmit={topUp}>
              <div className="wallet-buy-heading">
                <span className="wallet-add-icon" aria-hidden="true">
                  +
                </span>
                <div>
                  <p className="section-kicker">ბალანსის შევსება</p>
                  <h2>შევსება BOG-ით</h2>
                </div>
              </div>
              <label>
                <span>თანხა (₾)</span>
                <span className="wallet-amount-stepper">
                  <button type="button" aria-label="შემცირება" onClick={() => setAmount(Math.max(1, amount - 1))}>
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={amount}
                    onChange={(event) => setAmount(Number(event.target.value))}
                  />
                  <button type="button" aria-label="გაზრდა" onClick={() => setAmount(amount + 1)}>
                    +
                  </button>
                </span>
              </label>
              <div className="wallet-quick-actions" aria-label="სწრაფი თანხები">
                {TOPUP_AMOUNTS.map((value) => (
                  <button key={value} type="button" onClick={() => setAmount(value)}>
                    {value} WC
                  </button>
                ))}
              </div>
              <div className="wallet-price-row">
                <span>ჯამი</span>
                <strong>{amount} GEL</strong>
              </div>
              {error && <div className="status-text status-error">{error}</div>}
              <button className="cart-checkout-button" type="submit" disabled={submitting || amount < 1}>
                {submitting ? 'გადამისამართება…' : 'გადახდა Bank of Georgia-ით'}
              </button>
            </form>

            <div className="wallet-buy-panel">
              <div className="wallet-buy-heading">
                <span className="wallet-add-icon" aria-hidden="true">
                  ↥
                </span>
                <div>
                  <p className="section-kicker">გამომუშავებული თანხა</p>
                  <h2>თანხის გატანა</h2>
                </div>
              </div>
              <p className="note">მინიმუმ 20 WC. მოთხოვნას ხელით ამუშავებს ადმინისტრაცია.</p>
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
                      <div key={request.id} className="legacy-order-card">
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
          </section>

          <section className="wallet-history-section" aria-labelledby="walletHistoryTitle">
            <div className="wallet-history-head">
              <div>
                <h2 id="walletHistoryTitle">ტრანზაქციების ისტორია</h2>
                <span>{transactions.length} ჩანაწერი</span>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="marketplace-empty">ტრანზაქციები ჯერ არ არის.</div>
            ) : (
              <div className="wallet-transaction-list">
                {transactions.map((tx) => {
                  const isCredit = tx.amountWaveCoin > 0
                  return (
                    <article key={tx.id} className="wallet-transaction-card">
                      <span className="wallet-transaction-icon completed">{isCredit ? '+' : '-'}</span>
                      <div className="wallet-transaction-copy">
                        <strong>{tx.type}</strong>
                        <span>{tx.status}</span>
                      </div>
                      <span className="wallet-transaction-reference">{tx.id.slice(0, 8)}</span>
                      <time className="wallet-transaction-date">
                        {new Date(tx.createdAt).toLocaleDateString('ka-GE')}
                      </time>
                      <strong className="wallet-transaction-amount">
                        {isCredit ? `+${tx.amountWaveCoin}` : tx.amountWaveCoin} WC
                      </strong>
                      <span className="wallet-transaction-status completed">{tx.status}</span>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="marketplace-empty">გადამისამართება…</div>
      )}
    </Layout>
  )
}
