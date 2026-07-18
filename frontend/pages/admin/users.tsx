import { useEffect, useState } from 'react'
import type { AdminUserSummary } from '@wavehub/shared-types'
import { UserStatus } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, ApiError } from '../../lib/api'

const STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.PendingVerification]: 'დაუდასტურებელი',
  [UserStatus.Active]: 'აქტიური',
  [UserStatus.Suspended]: 'შეჩერებული',
  [UserStatus.Banned]: 'დაბლოკილი',
}

export default function AdminUsers() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const [items, setItems] = useState<AdminUserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const search = () => {
    setLoading(true)
    setError('')
    api
      .adminListUsers({ query: query || undefined, status: status || undefined })
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api
      .adminListUsers({})
      .then((res) => {
        if (!cancelled) setItems(res.items)
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
    // Mount-only initial load (empty filters) — the search form's submit handler below calls
    // `search()` directly for subsequent, filter-aware fetches.
  }, [])

  const suspend = async (id: string) => {
    const reason = window.prompt('შეჩერების მიზეზი:')
    if (!reason) return
    await runAction(id, () => api.adminSuspendUser(id, reason))
  }

  const restore = (id: string) => runAction(id, () => api.adminRestoreUser(id))

  const ban = async (id: string) => {
    const reason = window.prompt('დაბლოკვის მიზეზი:')
    if (!reason) return
    await runAction(id, () => api.adminBanUser(id, reason))
  }

  const unban = (id: string) => runAction(id, () => api.adminUnbanUser(id))

  const runAction = async (id: string, fn: () => Promise<AdminUserSummary>) => {
    setBusyId(id)
    try {
      const updated = await fn()
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'მოქმედება ვერ შესრულდა.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout>
      <h1 className="page-title">მომხმარებლები</h1>
      <p className="page-subtitle">ძებნა, შეჩერება, აღდგენა და დაბლოკვა</p>

      <form
        className="admin-search-bar"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
      >
        <input
          className="input"
          placeholder="მომხმარებელი, ელფოსტა ან სახელი"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as UserStatus | '')}>
          <option value="">ყველა სტატუსი</option>
          {Object.values(UserStatus).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="button">
          ძებნა
        </button>
      </form>

      {error && <div className="status-text status-error">{error}</div>}

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">მომხმარებელი ვერ მოიძებნა.</div>
      ) : (
        <div className="order-list">
          {items.map((item) => (
            <div key={item.id} className="admin-row">
              <div className="admin-row-main">
                <strong>@{item.username}</strong>
                <span className="note" style={{ margin: 0 }}>
                  {item.firstName} {item.lastName} · {item.email}
                </span>
                <span className="note" style={{ margin: 0 }}>
                  {STATUS_LABELS[item.status]}
                  {item.moderationReason ? ` — ${item.moderationReason}` : ''}
                </span>
              </div>
              <div className="admin-row-actions">
                {item.status === UserStatus.Suspended ? (
                  <button type="button" className="button" disabled={busyId === item.id} onClick={() => restore(item.id)}>
                    აღდგენა
                  </button>
                ) : item.status !== UserStatus.Banned ? (
                  <button type="button" className="button" disabled={busyId === item.id} onClick={() => suspend(item.id)}>
                    შეჩერება
                  </button>
                ) : null}
                {item.status === UserStatus.Banned ? (
                  <button type="button" className="button" disabled={busyId === item.id} onClick={() => unban(item.id)}>
                    განბლოკვა
                  </button>
                ) : (
                  <button type="button" className="button" disabled={busyId === item.id} onClick={() => ban(item.id)}>
                    დაბლოკვა
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
