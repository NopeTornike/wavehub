import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'

// Redeem a promo code (backend/src/marketing/): adds spendable WaveCoin credit, once per account.
// The credit can be spent on orders and coaching but is never withdrawable cash.
export default function PromoCodeForm({ onRedeemed }: { onRedeemed?: () => void }) {
  const { refresh } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const value = code.trim()
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(value)) return setStatus({ kind: 'error', text: 'კოდი 3–30 სიმბოლოა: ასოები, ციფრები, - ან _.' })
    setBusy(true)
    setStatus({ kind: '', text: '' })
    try {
      const res = await api.redeemPromoCode(value)
      setStatus({ kind: 'success', text: `+${res.amountWaveCoin} WaveCoin დაემატა ბალანსს.` })
      setCode('')
      await refresh()
      onRedeemed?.()
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'კოდი ვერ გამოიყენე.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="promo-form" onSubmit={submit}>
      <label htmlFor="promoCode">
        <strong>პრომო კოდი</strong>
        <small>ბონუსი ემატება ბალანსს — გამოიყენე შესყიდვებისა და ქოუჩინგისთვის (არ გაიტანება).</small>
      </label>
      <div>
        <input id="promoCode" value={code} maxLength={30} placeholder="მაგ. WELCOME5" autoComplete="off" onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <button type="submit" disabled={busy || !code.trim()}>
          {busy ? 'მოწმდება…' : 'გამოყენება'}
        </button>
      </div>
      {status.text && (
        <p className={status.kind === 'error' ? 'promo-error' : 'promo-ok'} role={status.kind === 'error' ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}
    </form>
  )
}
