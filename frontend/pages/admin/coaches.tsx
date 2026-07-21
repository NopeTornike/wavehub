import { useEffect, useState } from 'react'
import type { AdminCoachSummary } from '@wavehub/shared-types'
import { VerificationStatus } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, ApiError } from '../../lib/api'

const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  [VerificationStatus.NotVerified]: 'დაუდასტურებელი',
  [VerificationStatus.Pending]: 'განხილვაშია',
  [VerificationStatus.Verified]: 'დადასტურებულია',
  [VerificationStatus.Rejected]: 'უარყოფილია',
}

export default function AdminCoaches() {
  const [pending, setPending] = useState<AdminCoachSummary[]>([])
  const [all, setAll] = useState<AdminCoachSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    setError('')
    Promise.all([api.adminListPendingCoaches(), api.adminListAllCoaches()])
      .then(([p, a]) => {
        setPending(p)
        setAll(a)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([api.adminListPendingCoaches(), api.adminListAllCoaches()])
      .then(([p, a]) => {
        if (cancelled) return
        setPending(p)
        setAll(a)
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

  const approve = async (id: string) => {
    setBusyId(id)
    try {
      await api.adminApproveCoach(id)
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'დამტკიცება ვერ მოხერხდა.')
    } finally {
      setBusyId(null)
    }
  }

  const reject = async (id: string) => {
    const reason = window.prompt('უარყოფის მიზეზი:')
    if (!reason) return
    setBusyId(id)
    try {
      await api.adminRejectCoach(id, reason)
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'უარყოფა ვერ მოხერხდა.')
    } finally {
      setBusyId(null)
    }
  }

  const toggleSuspend = async (coach: AdminCoachSummary) => {
    setBusyId(coach.id)
    try {
      if (coach.status === 'suspended') await api.adminRestoreCoach(coach.id)
      else await api.adminSuspendCoach(coach.id)
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'მოქმედება ვერ შესრულდა.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout>
      <h1 className="page-title">მწვრთნელები</h1>
      <p className="page-subtitle">ვერიფიკაციის მოთხოვნები და აქტიური მწვრთნელები</p>

      {error && <div className="status-text status-error">{error}</div>}

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : (
        <>
          <h2 style={{ fontSize: '1rem' }}>ვერიფიკაციის მოლოდინში</h2>
          {pending.length === 0 ? (
            <div className="empty-state">მოთხოვნები არ არის.</div>
          ) : (
            <div className="order-list" style={{ marginBottom: 32 }}>
              {pending.map((coach) => (
                <div key={coach.id} className="admin-row">
                  <div className="admin-row-main">
                    <strong>{coach.specialty}</strong>
                    <span className="note" style={{ margin: 0 }}>
                      @{coach.username} · {coach.gameName ?? 'ზოგადი'} · {coach.hourlyRateWaveCoin} WC/სთ
                    </span>
                  </div>
                  <div className="admin-row-actions">
                    <button type="button" className="button" disabled={busyId === coach.id} onClick={() => approve(coach.id)}>
                      დამტკიცება
                    </button>
                    <button type="button" className="button" disabled={busyId === coach.id} onClick={() => reject(coach.id)}>
                      უარყოფა
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 style={{ fontSize: '1rem' }}>ყველა მწვრთნელი</h2>
          {all.length === 0 ? (
            <div className="empty-state">მწვრთნელები არ არის.</div>
          ) : (
            <div className="order-list">
              {all.map((coach) => (
                <div key={coach.id} className="admin-row">
                  <div className="admin-row-main">
                    <strong>{coach.specialty}</strong>
                    <span className="note" style={{ margin: 0 }}>
                      @{coach.username} · {VERIFICATION_LABELS[coach.verificationStatus]} · {coach.status}
                    </span>
                  </div>
                  {coach.verificationStatus === VerificationStatus.Verified && (
                    <div className="admin-row-actions">
                      <button type="button" className="button" disabled={busyId === coach.id} onClick={() => toggleSuspend(coach)}>
                        {coach.status === 'suspended' ? 'აღდგენა' : 'შეჩერება'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  )
}
