/* eslint-disable @next/next/no-img-element */
import { useState } from 'react'
import { api, errorMessage } from '../lib/api'

// "Pay with Bank of Georgia" where a purchase is short of balance (owner 2026-11-08: the listing page
// should have the wallet's BOG button, with the bank's logo). Tops up exactly the missing amount
// (rounded up to whole GEL, the top-up unit) and BOG sends the buyer back to this page, where the
// balance is re-read and the buy button works. The WaveCoin is credited by BOG's signed callback.
export function missingTopUp(total: number, balance: number): number {
  return Math.max(1, Math.ceil(total - balance))
}

import { gel } from '../lib/money'

/** The wallet's Bank of Georgia top-up card, sized for a buy panel: what's missing, then pay. */
export default function BogTopUpButton({ amount, balance, total, className = '' }: { amount: number; balance?: number; total?: number; className?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pay = async () => {
    setBusy(true)
    setError('')
    try {
      const here = `${window.location.origin}${window.location.pathname}`
      const result = await api.createBogTopupOrder({ amountGel: amount, successUrl: `${here}?topup=success`, failUrl: `${here}?topup=fail` })
      window.location.href = result.redirectUrl
    } catch (err) {
      setError(errorMessage(err, 'გადახდის დაწყება ვერ მოხერხდა.'))
      setBusy(false)
    }
  }

  return (
    <div className={`bog-topup ${className}`.trim()}>
      <div className="bog-topup-head">
        <span className="bog-topup-plus" aria-hidden="true">
          +
        </span>
        <div className="bog-topup-title">
          <strong>ბალანსის შევსება</strong>
          <small>ბალანსი არ გყოფნის ამ შესყიდვისთვის</small>
        </div>
      </div>
      {total !== undefined && balance !== undefined && (
        <dl className="bog-topup-rows">
          <div>
            <dt>გადასახდელი</dt>
            <dd>{gel(total)} GEL</dd>
          </div>
          <div>
            <dt>შენი ბალანსი</dt>
            <dd>{gel(balance)} GEL</dd>
          </div>
        </dl>
      )}
      <div className="bog-topup-total">
        <span>შესავსები თანხა</span>
        <strong>{amount} GEL</strong>
      </div>
      <button type="button" className="bog-topup-button" disabled={busy} onClick={() => void pay()}>
        {busy ? (
          <span>გადამისამართება…</span>
        ) : (
          <span className="bog-checkout-brand">
            <span>გადახდა</span>
            <img src="/assets/bog-logo.png" alt="Bank of Georgia" />
          </span>
        )}
        <b aria-hidden="true">→</b>
      </button>
      <p className="bog-topup-note">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 7 3v5c0 4.6-2.9 8.2-7 10-4.1-1.8-7-5.4-7-10V6l7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <span>Bank of Georgia-ს უსაფრთხო გადახდა. თანხა ბალანსზე ჩაირიცხება და დაბრუნდები ამ გვერდზე ყიდვის დასასრულებლად.</span>
      </p>
      {error && (
        <p className="seller-status error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
