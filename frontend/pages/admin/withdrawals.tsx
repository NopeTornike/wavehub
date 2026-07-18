import { useEffect, useState } from 'react'
import type { AdminWithdrawRequestSummary } from '@wavehub/shared-types'
import { WithdrawMethod, WithdrawStatus } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, ApiError } from '../../lib/api'

const METHOD_LABELS: Record<WithdrawMethod, string> = {
  [WithdrawMethod.BankTransfer]: 'საბანკო გადარიცხვა',
  [WithdrawMethod.PayPal]: 'PayPal',
  [WithdrawMethod.Wise]: 'Wise',
}

export default function AdminWithdrawals() {
  const [items, setItems] = useState<AdminWithdrawRequestSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    api
      .adminListPendingWithdrawals()
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const process = async (id: string, status: WithdrawStatus.Completed | WithdrawStatus.Rejected) => {
    let note: string | undefined
    if (status === WithdrawStatus.Rejected) {
      const reason = window.prompt('უარყოფის მიზეზი:')
      if (!reason) return
      note = reason
    } else {
      note = window.prompt('შენიშვნა (არასავალდებულო, მაგ. გადარიცხვის ID):') || undefined
    }
    setBusyId(id)
    try {
      await api.adminProcessWithdrawal(id, status, note)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'მოქმედება ვერ შესრულდა.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout>
      <h1 className="page-title">გატანის მოთხოვნები</h1>
      <p className="page-subtitle">გადარიცხეთ ხელით და მონიშნეთ როგორც შესრულებული, ან უარყავით</p>

      {error && <div className="status-text status-error">{error}</div>}

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">გატანის მოლოდინში მოთხოვნები არ არის.</div>
      ) : (
        <div className="order-list">
          {items.map((item) => (
            <div key={item.id} className="admin-row">
              <div className="admin-row-main">
                <strong>{item.amountWaveCoin} WC</strong>
                <span className="note" style={{ margin: 0 }}>
                  @{item.sellerUsername} · {METHOD_LABELS[item.method]}
                </span>
                <span className="note" style={{ margin: 0 }}>
                  {Object.entries(item.payoutDetails)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(' · ')}
                </span>
              </div>
              <div className="admin-row-actions">
                <button
                  type="button"
                  className="button"
                  disabled={busyId === item.id}
                  onClick={() => process(item.id, WithdrawStatus.Completed)}
                >
                  შესრულებულია
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busyId === item.id}
                  onClick={() => process(item.id, WithdrawStatus.Rejected)}
                >
                  უარყოფა
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
