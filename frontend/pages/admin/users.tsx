import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { AdminUserSummary, StaffPermissions } from '@wavehub/shared-types'
import { AdminRole, UserStatus } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { gel } from '../../lib/money'
import AdminBadgeManager from '../../components/AdminBadgeManager'

const ROLE_LABELS: Record<AdminRole, string> = {
  [AdminRole.SuperAdmin]: 'Super Admin',
  [AdminRole.OperationLead]: 'Operation Lead',
  [AdminRole.MainAdministrator]: 'Main Administrator',
  [AdminRole.MarketplaceCoachingOpsManager]: 'Marketplace & Coaching Ops',
  [AdminRole.TrustSafetyOfficer]: 'Trust & Safety',
  [AdminRole.SupportSpecialist]: 'Support Specialist',
}

// Management tools for one user, each with a mandatory reason (audit-logged server-side):
// WaveCoin adjustment (Super Admin; Support when a Super Admin enabled it, up to `walletMax`) and
// staff role (Super Admin only). Mirrors WalletAdjustmentDto / SetAdminRoleDto bounds.
function SuperAdminPanel({
  item,
  onUpdated,
  canSetRole,
  walletMax,
}: {
  item: AdminUserSummary
  onUpdated: (u: AdminUserSummary) => void
  canSetRole: boolean
  walletMax: number | null
}) {
  const [amount, setAmount] = useState('')
  const [walletReason, setWalletReason] = useState('')
  const [role, setRole] = useState<string>(item.adminRole ?? '')
  const [roleReason, setRoleReason] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  const run = async (key: string, fn: () => Promise<AdminUserSummary>, done: string) => {
    setBusy(key)
    setMessage(null)
    try {
      onUpdated(await fn())
      setMessage({ kind: 'success', text: done })
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err, 'მოქმედება ვერ შესრულდა.') })
    } finally {
      setBusy('')
    }
  }

  const adjust = (event: FormEvent) => {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isInteger(value) || value === 0 || Math.abs(value) > 100000) return setMessage({ kind: 'error', text: 'თანხა: მთელი რიცხვი, არა 0, მაქს. ±100000.' })
    if (walletMax !== null && Math.abs(value) > walletMax) return setMessage({ kind: 'error', text: `შენი ლიმიტია ±${walletMax} GEL ერთ ოპერაციაზე.` })
    if (walletReason.trim().length < 5) return setMessage({ kind: 'error', text: 'მიზეზი: მინიმუმ 5 სიმბოლო.' })
    if (!window.confirm(`${value > 0 ? 'დავამატოთ' : 'ჩამოვაჭრათ'} ${Math.abs(value)} GEL მომხმარებელს @${item.username}?`)) return
    void run('wallet', async () => {
      const updated = await api.adminAdjustWallet(item.id, value, walletReason.trim())
      setAmount('')
      setWalletReason('')
      return updated
    }, 'ბალანსი განახლდა.')
  }

  const saveRole = (event: FormEvent) => {
    event.preventDefault()
    if (roleReason.trim().length < 3) return setMessage({ kind: 'error', text: 'მიზეზი: მინიმუმ 3 სიმბოლო.' })
    void run('role', async () => {
      const updated = await api.adminSetUserRole(item.id, (role || null) as AdminRole | null, roleReason.trim())
      setRoleReason('')
      return updated
    }, 'როლი განახლდა.')
  }

  return (
    <div className="au-panel">
      <form className="au-form" onSubmit={adjust}>
        <strong>
          <span>ბალანსი:</span> {gel(item.wavecoinBalance)} GEL
        </strong>
        <input type="number" step={1} placeholder="+100 ან -50" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="თანხა (GEL)" />
        <input maxLength={300} placeholder="მიზეზი (ჩანს აუდიტში)" value={walletReason} onChange={(e) => setWalletReason(e.target.value)} aria-label="მიზეზი" />
        <button type="submit" className="button" disabled={busy === 'wallet'}>
          ბალანსის შეცვლა
        </button>
      </form>
      {walletMax !== null && <p className="au-note">შენი ლიმიტი: ±{walletMax} GEL ერთ ოპერაციაზე (Super Admin-ის მიერ დადგენილი).</p>}
      {canSetRole && (
      <form className="au-form" onSubmit={saveRole}>
        <strong>ადმინ როლი</strong>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="ადმინ როლი">
          <option value="">— არ აქვს —</option>
          {Object.values(AdminRole).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <input maxLength={300} placeholder="მიზეზი (ჩანს აუდიტში)" value={roleReason} onChange={(e) => setRoleReason(e.target.value)} aria-label="მიზეზი" />
        <button type="submit" className="button" disabled={busy === 'role' || role === (item.adminRole ?? '')}>
          როლის შენახვა
        </button>
      </form>
      )}
      {message && (
        <p className={`status-text ${message.kind === 'error' ? 'status-error' : 'status-success'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <p className="au-note">ბალანსის დამატება მყიდველს აძლევს დასახარჯ ბალანსს — ის არ ითვლება გასატან შემოსავლად.</p>
    </div>
  )
}

const STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.PendingVerification]: 'დაუდასტურებელი',
  [UserStatus.Active]: 'აქტიური',
  [UserStatus.Suspended]: 'შეჩერებული',
  [UserStatus.Banned]: 'დაბლოკილი',
}

export default function AdminUsers() {
  const { user: me } = useAuth()
  const isSuperAdmin = me?.adminRole === AdminRole.SuperAdmin
  // Super-Admin-controlled powers (Support's switches); the backend re-checks every action.
  const [perms, setPerms] = useState<StaffPermissions | null>(null)
  useEffect(() => {
    if (!me?.adminRole) return
    api.adminMyPermissions().then(setPerms).catch(() => setPerms(null))
  }, [me?.adminRole])
  const isSupport = me?.adminRole === AdminRole.SupportSpecialist
  // Support never acts on its own or another staff account.
  const supportTarget = (item: AdminUserSummary) => !item.adminRole && item.id !== me?.id
  const canSuspend = (item: AdminUserSummary) =>
    isSuperAdmin ||
    me?.adminRole === AdminRole.OperationLead ||
    me?.adminRole === AdminRole.MainAdministrator ||
    (isSupport && !!perms?.suspendUsers && supportTarget(item))
  const canManage = (item: AdminUserSummary) => isSuperAdmin || (isSupport && !!perms?.walletAdjust && supportTarget(item))
  const [openId, setOpenId] = useState<string | null>(null)
  // Badge management (badges/ spec): Super Admin + the roles allowed to grant administration badges.
  const canBadge = !!me?.adminRole && [AdminRole.SuperAdmin, AdminRole.OperationLead, AdminRole.MainAdministrator, AdminRole.MarketplaceCoachingOpsManager].includes(me.adminRole)
  const [badgeId, setBadgeId] = useState<string | null>(null)
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
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
      .finally(() => setLoading(false))
  }

  // `?q=` (e.g. from Trust & Safety's "manage account") pre-fills and runs the search.
  const router = useRouter()
  const initialQ = typeof router.query.q === 'string' ? router.query.q : ''
  useEffect(() => {
    if (!router.isReady) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    if (initialQ) setQuery(initialQ)
    api
      .adminListUsers(initialQ ? { query: initialQ } : {})
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // Initial load (empty filters or ?q=) — the search form's submit handler below calls
    // `search()` directly for subsequent, filter-aware fetches.
  }, [router.isReady, initialQ])

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
      setError(errorMessage(err, 'მოქმედება ვერ შესრულდა.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout title="მომხმარებლები">
      <h1 className="page-title">მომხმარებლები</h1>
      <p className="page-subtitle">ძებნა, შეჩერება, აღდგენა და დაბლოკვა{isSuperAdmin ? ' · ბალანსი და ადმინ როლები' : ''}</p>

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

      {error && <div className="status-text status-error" role="alert">{error}</div>}

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
                <span className="note" style={{ margin: 0 }}>
                  {gel(item.wavecoinBalance)} GEL{item.adminRole ? ` · ${ROLE_LABELS[item.adminRole]}` : ''}
                </span>
              </div>
              <div className="admin-row-actions">
                {!canSuspend(item) ? null : item.status === UserStatus.Suspended ? (
                  <button type="button" className="button" disabled={busyId === item.id} onClick={() => restore(item.id)}>
                    აღდგენა
                  </button>
                ) : item.status !== UserStatus.Banned ? (
                  <button type="button" className="button" disabled={busyId === item.id} onClick={() => suspend(item.id)}>
                    შეჩერება
                  </button>
                ) : null}
                {!isSuperAdmin ? null : item.status === UserStatus.Banned ? (
                  <button type="button" className="button" disabled={busyId === item.id} onClick={() => unban(item.id)}>
                    განბლოკვა
                  </button>
                ) : (
                  <button type="button" className="button" disabled={busyId === item.id} onClick={() => ban(item.id)}>
                    დაბლოკვა
                  </button>
                )}
                {canManage(item) && (
                  <button type="button" className="button ghost" aria-expanded={openId === item.id} onClick={() => setOpenId(openId === item.id ? null : item.id)}>
                    {openId === item.id ? 'დახურვა' : 'მართვა'}
                  </button>
                )}
                {canBadge && (
                  <button type="button" className="button ghost" aria-expanded={badgeId === item.id} onClick={() => setBadgeId(badgeId === item.id ? null : item.id)}>
                    {badgeId === item.id ? 'ბეიჯების დახურვა' : 'ბეიჯები'}
                  </button>
                )}
              </div>
              {canBadge && badgeId === item.id && <AdminBadgeManager userId={item.id} myRole={me?.adminRole} />}
              {canManage(item) && openId === item.id && (
                <SuperAdminPanel
                  item={item}
                  canSetRole={isSuperAdmin}
                  walletMax={isSuperAdmin ? null : (perms?.walletAdjustMax ?? null)}
                  onUpdated={(updated) => setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
