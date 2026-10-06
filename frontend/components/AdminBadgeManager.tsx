/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'
import type { AdminBadgeGrant } from '@wavehub/shared-types'
import { AdminRole, BADGE_CATALOG, BadgeKey, badgeIcon } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'

const SOURCE_LABEL: Record<AdminBadgeGrant['source'], string> = { system: 'სისტემა', admin: 'ადმინისტრაცია', coach: 'ქოუჩი' }

// Admin → Users → Badges for one user (owner spec "Badge Assignment Logic"). The server enforces
// who may grant what; this only offers the badges the viewer's role may grant (Chosen/Staff:
// Super Admin; automatic badges come from their triggers and only a Super Admin can revoke one).
export default function AdminBadgeManager({ userId, myRole }: { userId: string; myRole: AdminRole | null | undefined }) {
  const [grants, setGrants] = useState<AdminBadgeGrant[] | null>(null)
  const [pick, setPick] = useState<BadgeKey | ''>('')
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })
  const [busy, setBusy] = useState(false)
  const superAdmin = myRole === AdminRole.SuperAdmin

  useEffect(() => {
    let cancelled = false
    api
      .adminListUserBadges(userId)
      .then((rows) => {
        if (!cancelled) setGrants(rows)
      })
      .catch((err) => {
        if (!cancelled) setStatus({ kind: 'error', text: errorMessage(err, 'ბეიჯების ჩატვირთვა ვერ მოხერხდა.') })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const held = new Set((grants ?? []).map((g) => g.key))
  const grantable = (Object.values(BadgeKey) as BadgeKey[]).filter((key) => {
    const mode = BADGE_CATALOG[key].mode
    if (held.has(key) || mode === 'auto') return false
    return mode === 'super_admin' ? superAdmin : true
  })
  const canRevoke = (g: AdminBadgeGrant) => {
    const mode = BADGE_CATALOG[g.key]?.mode
    return mode === 'super_admin' || mode === 'auto' ? superAdmin : true
  }

  const run = async (fn: () => Promise<AdminBadgeGrant[]>, done: string) => {
    setBusy(true)
    setStatus({ kind: '', text: '' })
    try {
      setGrants(await fn())
      setStatus({ kind: 'success', text: done })
      setPick('')
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'ოპერაცია ვერ შესრულდა.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-badges">
      <h3>ბეიჯები</h3>
      {status.text && <p className={`status-text status-${status.kind === 'error' ? 'error' : 'success'}`}>{status.text}</p>}
      {grants === null ? (
        <p className="note">იტვირთება…</p>
      ) : grants.length === 0 ? (
        <p className="note">ბეიჯები ჯერ არ აქვს.</p>
      ) : (
        <ul className="admin-badge-list">
          {grants.map((g) => (
            <li key={g.key}>
              <img src={badgeIcon(g.key)} alt="" />
              <span>
                <strong>{g.label}</strong>
                <small>
                  {SOURCE_LABEL[g.source]}
                  {g.grantedByUsername ? ` · @${g.grantedByUsername}` : ''} · {new Date(g.grantedAt).toLocaleDateString('ka-GE')}
                </small>
              </span>
              {canRevoke(g) && (
                <button
                  type="button"
                  className="button ghost"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`მოვხსნათ ბეიჯი „${g.label}“?`)) void run(() => api.adminRevokeBadge(userId, g.key), 'ბეიჯი მოიხსნა.')
                  }}
                >
                  მოხსნა
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {grantable.length > 0 && (
        <form
          className="admin-badge-grant"
          onSubmit={(e) => {
            e.preventDefault()
            if (pick) void run(() => api.adminGrantBadge(userId, pick), 'ბეიჯი მიენიჭა.')
          }}
        >
          <select value={pick} onChange={(e) => setPick(e.target.value as BadgeKey)} aria-label="ბეიჯის არჩევა">
            <option value="">აირჩიე ბეიჯი…</option>
            {grantable.map((key) => (
              <option key={key} value={key}>
                {BADGE_CATALOG[key].label}
              </option>
            ))}
          </select>
          <button type="submit" className="button" disabled={busy || !pick}>
            მინიჭება
          </button>
        </form>
      )}
    </div>
  )
}
