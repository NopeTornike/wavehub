import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { PublicWalletBalance, PublicWalletTransaction, PublicWithdrawRequest } from '@wavehub/shared-types'
import { CoachingSessionStatus, OrderStatus, WalletLedgerStatus, WalletLedgerType, WithdrawMethod, WithdrawStatus } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'

// The prototype's wallet.html (wallet.js), on real data. Hero + the four summary cards:
//   Available Balance = the spendable WaveCoin balance; In Escrow = the buyer's money currently held
//   for open orders and scheduled coaching sessions; Pending Payouts = earnings still inside the
//   7-day hold plus withdrawal requests awaiting processing; Total Purchased = WaveCoin bought
//   through BOG top-ups (the prototype shows the balance again there).
// The top-up bar is the real BOG checkout (WaveCoin is credited by the signed callback, never by this
// page). The withdrawal bar and request list have no prototype counterpart — sellers need them —
// and reuse the same bar/table design. Transaction History's category tabs are static labels on
// the prototype; here they really filter the ledger.

const TOPUP_AMOUNTS = [10, 25, 50, 100]

const WITHDRAW_METHOD_LABELS: Record<WithdrawMethod, string> = {
  [WithdrawMethod.BankTransfer]: 'საბანკო გადარიცხვა',
  [WithdrawMethod.PayPal]: 'PayPal',
  [WithdrawMethod.Wise]: 'Wise',
}

const WITHDRAW_STATUS: Record<WithdrawStatus, [string, string]> = {
  [WithdrawStatus.Pending]: ['მოლოდინში', 'pending'],
  [WithdrawStatus.Processing]: ['მუშავდება', 'pending'],
  [WithdrawStatus.Completed]: ['შესრულებული', 'completed'],
  [WithdrawStatus.Rejected]: ['უარყოფილი', 'failed'],
  [WithdrawStatus.Cancelled]: ['გაუქმებული', 'failed'],
}

const TX_LABELS: Record<WalletLedgerType, string> = {
  [WalletLedgerType.Topup]: 'WaveCoin-ის შევსება',
  [WalletLedgerType.OrderEscrowHold]: 'შესყიდვა',
  [WalletLedgerType.OrderRelease]: 'შეკვეთის შემოსავალი',
  [WalletLedgerType.OrderRefund]: 'შეკვეთის თანხის დაბრუნება',
  [WalletLedgerType.SessionEscrowHold]: 'ქოუჩინგის სესია',
  [WalletLedgerType.SessionRelease]: 'სესიის შემოსავალი',
  [WalletLedgerType.SessionRefund]: 'სესიის თანხის დაბრუნება',
  [WalletLedgerType.Withdrawal]: 'თანხის გატანა',
  [WalletLedgerType.AdminAdjustment]: 'ადმინისტრაციული კორექტირება',
  [WalletLedgerType.PlatformFee]: 'პლატფორმის საკომისიო',
}

// A ledger row's own `status` is not a reliable display label: escrow holds stay `held` and
// earnings stay `pending` after the fact (see backend/src/wallet/CLAUDE.md — nothing re-labels
// them). Every non-reversed row has already moved the balance, so it reads as done; only a live
// withdrawal reservation is still in flight.
function txStatus(tx: PublicWalletTransaction): [string, string] {
  if (tx.status === WalletLedgerStatus.Reversed) return ['გაუქმებული', 'failed']
  if (tx.type === WalletLedgerType.Withdrawal && tx.status === WalletLedgerStatus.Held) return ['დაკავებული', 'pending']
  return ['შესრულებული', 'completed']
}

type Category = 'all' | 'income' | 'expense' | 'escrow' | 'withdrawals' | 'refunds'

const CATEGORIES: Array<[Category, string]> = [
  ['all', 'ყველა'],
  ['income', 'შემოსავალი'],
  ['expense', 'ხარჯი'],
  ['escrow', 'Escrow'],
  ['withdrawals', 'გატანები'],
  ['refunds', 'თანხის დაბრუნება'],
]

const ESCROW_TYPES = [WalletLedgerType.OrderEscrowHold, WalletLedgerType.SessionEscrowHold]
const REFUND_TYPES = [WalletLedgerType.OrderRefund, WalletLedgerType.SessionRefund]
const ORDER_TYPES = [WalletLedgerType.OrderEscrowHold, WalletLedgerType.OrderRelease, WalletLedgerType.OrderRefund]
const OPEN_ORDER_STATUSES = [OrderStatus.Paid, OrderStatus.InProgress, OrderStatus.Delivered, OrderStatus.Disputed]

function inCategory(tx: PublicWalletTransaction, category: Category) {
  switch (category) {
    case 'income':
      return tx.amountWaveCoin > 0 && !REFUND_TYPES.includes(tx.type)
    case 'expense':
      return tx.amountWaveCoin < 0 && tx.type !== WalletLedgerType.Withdrawal
    case 'escrow':
      return ESCROW_TYPES.includes(tx.type)
    case 'withdrawals':
      return tx.type === WalletLedgerType.Withdrawal
    case 'refunds':
      return REFUND_TYPES.includes(tx.type)
    default:
      return true
  }
}

function formatDateTime(value: string) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ka-GE', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function Wallet() {
  const router = useRouter()
  const { user, checked, refresh } = useAuth()
  const userId = user?.id
  const [amount, setAmount] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [topupStatus, setTopupStatus] = useState<{ kind: '' | 'error'; text: string }>({ kind: '', text: '' })

  const [balance, setBalance] = useState<PublicWalletBalance | null>(null)
  const [transactions, setTransactions] = useState<PublicWalletTransaction[] | null>(null)
  const [withdrawals, setWithdrawals] = useState<PublicWithdrawRequest[]>([])
  const [escrow, setEscrow] = useState(0)
  const [category, setCategory] = useState<Category>('all')
  const [query, setQuery] = useState('')

  const [withdrawAmount, setWithdrawAmount] = useState(20)
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawMethod>(WithdrawMethod.PayPal)
  const [payoutDetails, setPayoutDetails] = useState<Record<string, string>>({})
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  const [withdrawStatus, setWithdrawStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })

  const loadWalletData = useCallback(() => {
    api.getWalletBalance().then(setBalance).catch(() => undefined)
    api
      .listWalletTransactions(100)
      .then(setTransactions)
      .catch(() => setTransactions([]))
    api.listMyWithdrawals().then(setWithdrawals).catch(() => undefined)
    Promise.all([api.listOrdersAsBuyer().catch(() => []), api.listMySessionsAsBuyer().catch(() => [])]).then(([orders, sessions]) => {
      const held =
        orders.filter((order) => OPEN_ORDER_STATUSES.includes(order.status)).reduce((sum, order) => sum + order.priceWaveCoin, 0) +
        sessions.filter((session) => session.status === CoachingSessionStatus.Scheduled).reduce((sum, session) => sum + session.priceWaveCoin, 0)
      setEscrow(held)
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    loadWalletData()
  }, [userId, loadWalletData])

  useEffect(() => {
    // After a successful BOG top-up redirect back here, re-fetch so the new balance shows instead of
    // the pre-top-up number fetched on app load.
    if (router.query.topup === 'success') {
      void refresh()
      loadWalletData()
    }
  }, [router.query.topup, refresh, loadWalletData])

  const topUp = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) {
      router.push('/login?next=/wallet')
      return
    }
    setTopupStatus({ kind: '', text: '' })
    if (!Number.isInteger(amount) || amount < 1) {
      setTopupStatus({ kind: 'error', text: 'თანხა უნდა იყოს მთელი რიცხვი, მინიმუმ 1 WC.' })
      return
    }
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
      setTopupStatus({ kind: 'error', text: errorMessage(err, 'გადახდის დაწყება ვერ მოხერხდა.') })
      setSubmitting(false)
    }
  }

  const submitWithdrawal = async (event: FormEvent) => {
    event.preventDefault()
    setWithdrawStatus({ kind: '', text: '' })
    if (!Number.isInteger(withdrawAmount) || withdrawAmount < 1) {
      setWithdrawStatus({ kind: 'error', text: 'თანხა უნდა იყოს მთელი რიცხვი.' })
      return
    }
    setWithdrawBusy(true)
    try {
      await api.requestWithdrawal({ amountWaveCoin: withdrawAmount, method: withdrawMethod, payoutDetails })
      setPayoutDetails({})
      setWithdrawStatus({ kind: 'success', text: 'მოთხოვნა გაიგზავნა — მას ადმინისტრაცია დაამუშავებს.' })
      loadWalletData()
      // A withdrawal request debits the WaveCoin balance shown in the topbar.
      await refresh()
    } catch (err) {
      setWithdrawStatus({ kind: 'error', text: errorMessage(err, 'მოთხოვნის გაგზავნა ვერ მოხერხდა.') })
    } finally {
      setWithdrawBusy(false)
    }
  }

  const cancelWithdrawal = async (id: string) => {
    setWithdrawBusy(true)
    try {
      await api.cancelWithdrawal(id)
      loadWalletData()
      // Cancelling returns the reserved amount to the WaveCoin balance shown in the topbar.
      await refresh()
    } catch (err) {
      setWithdrawStatus({ kind: 'error', text: errorMessage(err, 'გაუქმება ვერ მოხერხდა.') })
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

  const walletBalance = user?.wavecoinBalance ?? 0
  const pendingPayouts = (balance?.pendingClearance ?? 0) + (balance?.pendingWithdrawal ?? 0)
  const purchased = (transactions ?? []).filter((tx) => tx.type === WalletLedgerType.Topup).reduce((sum, tx) => sum + tx.amountWaveCoin, 0)
  const q = query.trim().toLowerCase()
  const shown = (transactions ?? []).filter(
    (tx) => inCategory(tx, category) && (!q || [TX_LABELS[tx.type], tx.orderId, tx.id, String(tx.amountWaveCoin)].filter(Boolean).join(' ').toLowerCase().includes(q)),
  )

  const summary: Array<[string, string, string, number, string]> = [
    ['available', '▣', 'ხელმისაწვდომი ბალანსი', walletBalance, 'მზადაა დასახარჯად'],
    ['escrow', '◇', 'ესქროუში', escrow, 'დაცული გადახდები'],
    ['pending', '◷', 'მოსალოდნელი გაცემები', pendingPayouts, 'დასრულების მოლოდინში'],
    ['purchased', '↥', 'სულ შეძენილი', purchased, 'BOG-ით შეძენილი WaveCoin'],
  ]

  return (
    <Layout
      title="საფულე"
      noIndex
      bodyClass="wallet-page"
      pageSearch={{ value: query, onChange: setQuery, placeholder: 'მოძებნე ტრანზაქციები...', label: 'ტრანზაქციების ძიება' }}
    >
      <section className="wallet-page-head" aria-labelledby="walletTitle">
        <h1 id="walletTitle">ჩემი საფულე</h1>
        <p>მართე ბალანსი, ტრანზაქციები და WaveCoin-ის შევსება.</p>
      </section>

      {router.query.topup === 'success' && (
        <p className="seller-status success" role="status">
          გადახდა მიღებულია — ბალანსი განახლდება, როგორც კი ბანკი დაადასტურებს.
        </p>
      )}
      {router.query.topup === 'fail' && (
        <p className="seller-status error" role="alert">
          გადახდა ვერ შესრულდა. სცადეთ თავიდან.
        </p>
      )}

      <section className="wallet-dashboard-hero" aria-labelledby="walletBalanceTitle">
        <div className="wallet-hero-balance">
          <span>საერთო ბალანსი</span>
          <h2 id="walletBalanceTitle">
            <strong id="walletBalanceLarge">{walletBalance} WC</strong>
          </h2>
          <small>1 WaveCoin = 1 GEL</small>
        </div>
        <div className="wallet-hero-art" aria-hidden="true">
          <span className="wallet-hero-coin">W</span>
          <span className="wallet-hero-shape"></span>
        </div>
        <dl className="wallet-hero-breakdown">
          {summary.map(([key, , label, value]) => (
            <div key={key}>
              <dt>
                <i className={key === 'purchased' ? 'withdrawn' : key}></i>
                {label}
              </dt>
              <dd>{value} WC</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="wallet-summary-grid" aria-label="საფულის შეჯამება">
        {summary.map(([key, icon, label, value, note]) => (
          <article key={key} className={`wallet-summary-card ${key}`}>
            <i>{icon}</i>
            <div>
              <span>{label}</span>
              <strong>{value} WC</strong>
              <small>{note}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="wallet-layout" aria-label="საფულის მართვა">
        <form className="wallet-buy-panel" id="walletBuyForm" onSubmit={topUp}>
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
            <span>WaveCoin-ის რაოდენობა</span>
            <span className="wallet-amount-stepper">
              <button type="button" aria-label="შემცირება" onClick={() => setAmount((value) => Math.max(1, value - 1))}>
                −
              </button>
              <input id="wavecoinAmount" type="number" min={1} max={10000} step={1} required value={amount} onChange={(event) => setAmount(Math.floor(Number(event.target.value)))} />
              <button type="button" aria-label="გაზრდა" onClick={() => setAmount((value) => value + 1)}>
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
            <strong id="walletBuyTotal">{Number.isFinite(amount) ? amount : 0} GEL</strong>
          </div>
          <button className="cart-checkout-button" id="buyWavecoinButton" type="submit" disabled={submitting}>
            {submitting ? 'გადამისამართება…' : checked && !user ? 'შესვლა და შევსება' : 'გადახდა Bank of Georgia-ით'}
          </button>
          <p className={`seller-status${topupStatus.kind ? ` ${topupStatus.kind}` : ''}`} id="walletStatus" aria-live="polite">
            {topupStatus.text}
          </p>
        </form>

        {user && (
          <form className="wallet-buy-panel wallet-withdraw-panel" onSubmit={submitWithdrawal}>
            <div className="wallet-buy-heading">
              <span className="wallet-add-icon" aria-hidden="true">
                ↥
              </span>
              <div>
                <p className="section-kicker">გამომუშავებული თანხა</p>
                <h2>თანხის გატანა</h2>
              </div>
            </div>
            <label>
              <span>თანხა (WC)</span>
              <input id="withdrawAmount" type="number" min={1} step={1} required value={withdrawAmount} onChange={(event) => setWithdrawAmount(Math.floor(Number(event.target.value)))} />
            </label>
            <label>
              <span>მეთოდი</span>
              <select
                id="withdrawMethod"
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
            </label>
            {payoutFields.map((field) => (
              <label key={field.key}>
                <span>{field.label}</span>
                <input
                  id={field.key}
                  type={field.key === 'email' ? 'email' : 'text'}
                  maxLength={120}
                  required
                  value={payoutDetails[field.key] ?? ''}
                  onChange={(event) => setPayoutDetails((prev) => ({ ...prev, [field.key]: event.target.value }))}
                />
              </label>
            ))}
            <button className="cart-checkout-button" type="submit" disabled={withdrawBusy}>
              მოთხოვნის გაგზავნა
            </button>
            <p className={`seller-status${withdrawStatus.kind ? ` ${withdrawStatus.kind}` : ''}`} aria-live="polite">
              {withdrawStatus.text ||
                `გასატანად ხელმისაწვდომია ${balance?.availableToWithdraw ?? 0} WC. გამომუშავებული თანხა ხელმისაწვდომი ხდება 7 დღის შემდეგ; მოთხოვნას ამუშავებს ადმინისტრაცია.`}
            </p>
          </form>
        )}
      </section>

      {withdrawals.length > 0 && (
        <section className="wallet-history-section" aria-labelledby="walletWithdrawalsTitle">
          <div className="wallet-history-head">
            <div>
              <h2 id="walletWithdrawalsTitle">გატანის მოთხოვნები</h2>
              <span>{withdrawals.length} ჩანაწერი</span>
            </div>
          </div>
          <div className="wallet-table-head" aria-hidden="true">
            <span>მეთოდი / შენიშვნა</span>
            <span>ID</span>
            <span>თარიღი და დრო</span>
            <span>თანხა</span>
            <span>სტატუსი</span>
          </div>
          <div className="wallet-transaction-list">
            {withdrawals.map((request) => {
              const [label, tone] = WITHDRAW_STATUS[request.status]
              return (
                <article key={request.id} className="wallet-transaction-card" data-type="debit" data-status={tone}>
                  <span className={`wallet-transaction-icon ${tone}`}>↥</span>
                  <div className="wallet-transaction-copy">
                    <strong>{WITHDRAW_METHOD_LABELS[request.method]}</strong>
                    <span>
                      {request.adminNote ||
                        (request.status === WithdrawStatus.Pending ? (
                          <button className="profile-record-action danger" type="button" disabled={withdrawBusy} onClick={() => void cancelWithdrawal(request.id)}>
                            გაუქმება
                          </button>
                        ) : (
                          'WaveHub'
                        ))}
                    </span>
                  </div>
                  <span className="wallet-transaction-reference">{request.id.slice(0, 8)}</span>
                  <time className="wallet-transaction-date" dateTime={request.createdAt}>
                    {formatDateTime(request.createdAt)}
                  </time>
                  <strong className="wallet-transaction-amount">-{request.amountWaveCoin} WC</strong>
                  <span className={`wallet-transaction-status ${tone}`}>{label}</span>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <section className="wallet-history-section" aria-labelledby="walletHistoryTitle">
        <div className="wallet-history-head">
          <div>
            <h2 id="walletHistoryTitle">ტრანზაქციების ისტორია</h2>
            <span id="walletTransactionCount">{transactions?.length ?? 0} ჩანაწერი</span>
          </div>
          <div className="wallet-history-tools">
            <span>ბოლო აქტივობა</span>
          </div>
        </div>
        <div className="wallet-history-tabs" role="tablist" aria-label="ტრანზაქციების კატეგორიები">
          {CATEGORIES.map(([key, label]) => {
            const Tag = category === key ? 'strong' : 'span'
            return (
              <Tag
                key={key}
                role="tab"
                tabIndex={0}
                aria-selected={category === key}
                style={{ cursor: 'pointer' }}
                onClick={() => setCategory(key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setCategory(key)
                  }
                }}
              >
                {label}
              </Tag>
            )
          })}
        </div>
        <div className="wallet-table-head" aria-hidden="true">
          <span>ტიპი / აღწერა</span>
          <span>შეკვეთა / ID</span>
          <span>თარიღი და დრო</span>
          <span>თანხა</span>
          <span>სტატუსი</span>
        </div>
        <div className="wallet-transaction-list" id="walletTransactionList">
          {shown.map((tx) => {
            const credit = tx.amountWaveCoin > 0
            const [label, tone] = txStatus(tx)
            const ref = tx.orderId ? `#${tx.orderId.slice(0, 8)}` : tx.id.slice(0, 8)
            return (
              <article key={tx.id} className="wallet-transaction-card" data-type={credit ? 'credit' : 'debit'} data-status={tone}>
                <span className={`wallet-transaction-icon ${tone}`}>{credit ? '+' : '-'}</span>
                <div className="wallet-transaction-copy">
                  <strong>{TX_LABELS[tx.type]}</strong>
                  <span>{tx.type === WalletLedgerType.Topup ? 'BOG' : 'WaveHub'}</span>
                </div>
                {tx.orderId && ORDER_TYPES.includes(tx.type) ? (
                  <Link className="wallet-transaction-reference" href={`/orders/${tx.orderId}`}>
                    {ref}
                  </Link>
                ) : (
                  <span className="wallet-transaction-reference">{ref}</span>
                )}
                <time className="wallet-transaction-date" dateTime={tx.createdAt}>
                  {formatDateTime(tx.createdAt)}
                </time>
                <strong className="wallet-transaction-amount">
                  {credit ? '+' : ''}
                  {tx.amountWaveCoin} WC
                </strong>
                <span className={`wallet-transaction-status ${tone}`}>{label}</span>
              </article>
            )
          })}
        </div>
        <div className="marketplace-empty" id="walletEmpty" hidden={!checked || (!!user && (transactions === null || shown.length > 0))}>
          {user ? 'ტრანზაქციები ჯერ არ არის.' : 'შედით, რომ ნახოთ საფულის ტრანზაქციები.'}
        </div>
      </section>
    </Layout>
  )
}
