import { useEffect, useState } from 'react'
import type { PublicPlatformSettings, SupportPermissions } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'

// Super Admin only server-side (see backend/src/settings/platform-settings.controller.ts) — any
// other role's GET/POST here 403s, surfaced via the error banner below like every other admin page.
export default function AdminSettings() {
  const [settings, setSettings] = useState<PublicPlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [platformFeePercent, setPlatformFeePercent] = useState(10)
  const [coachingFeePercent, setCoachingFeePercent] = useState(10)
  const [minWithdrawalWaveCoin, setMinWithdrawalWaveCoin] = useState(20)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  // What the Support Specialist role may do beyond its defaults (both off by default).
  const [supportPerms, setSupportPerms] = useState<SupportPermissions>({ walletAdjust: false, walletAdjustMax: 100, suspendUsers: false })

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api
      .adminGetPlatformSettings()
      .then((data) => {
        if (cancelled) return
        setSettings(data)
        setPlatformFeePercent(data.platformFeePercent)
        setCoachingFeePercent(data.coachingFeePercent)
        setMinWithdrawalWaveCoin(data.minWithdrawalWaveCoin)
        setMaintenanceMode(data.maintenanceMode)
        if (data.supportPermissions) setSupportPerms(data.supportPermissions)
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
  }, [])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaved(false)
    if (!Number.isInteger(supportPerms.walletAdjustMax) || supportPerms.walletAdjustMax < 1 || supportPerms.walletAdjustMax > 100000) {
      setError('Support-ის ლიმიტი: მთელი რიცხვი, 1–100000 GEL.')
      return
    }
    setSaving(true)
    try {
      const updated = await api.adminUpdatePlatformSettings({
        platformFeePercent,
        coachingFeePercent,
        minWithdrawalWaveCoin,
        maintenanceMode,
        supportPermissions: supportPerms,
      })
      setSettings(updated)
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err, 'შენახვა ვერ მოხერხდა.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout title="პლატფორმის პარამეტრები">
      <h1 className="page-title">პლატფორმის პარამეტრები</h1>
      <p className="page-subtitle">საკომისიო, გატანის მინიმუმი, ტექნიკური სამუშაოების რეჟიმი და Support-ის უფლებები</p>

      {error && <div className="status-text status-error" role="alert">{error}</div>}
      {saved && <div className="status-text status-success" role="status">შენახულია.</div>}

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : !settings ? null : (
        <form className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={save}>
          <div className="form-group">
            <label htmlFor="platformFeePercent">მარკეტფლეისის საკომისიო (%) — იხდის მყიდველი</label>
            <input
              id="platformFeePercent"
              className="input"
              type="number"
              min={0}
              max={100}
              value={platformFeePercent}
              onChange={(event) => setPlatformFeePercent(Number(event.target.value))}
            />
            <p className="note">
              ეხება მხოლოდ ახალ შეკვეთებს — უკვე გაფორმებული შეკვეთები ინახავენ იმ დროის განაკვეთს, როცა
              შეიქმნენ.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="coachingFeePercent">ქოუჩინგის საკომისიო (%) — იკავებს ქოუჩის შემოსავლიდან</label>
            <input
              id="coachingFeePercent"
              className="input"
              type="number"
              min={0}
              max={100}
              value={coachingFeePercent}
              onChange={(event) => setCoachingFeePercent(Number(event.target.value))}
            />
            <p className="note">ეხება მხოლოდ ახალ ჯავშნებს — დაჯავშნილი სესიები ინახავენ დაჯავშნის დროის განაკვეთს.</p>
          </div>

          <div className="form-group">
            <label htmlFor="minWithdrawalWaveCoin">გატანის მინიმალური ოდენობა (GEL)</label>
            <input
              id="minWithdrawalWaveCoin"
              className="input"
              type="number"
              min={1}
              value={minWithdrawalWaveCoin}
              onChange={(event) => setMinWithdrawalWaveCoin(Number(event.target.value))}
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(event) => setMaintenanceMode(event.target.checked)}
                style={{ marginRight: 8 }}
              />
              ტექნიკური სამუშაოების რეჟიმი
            </label>
            <p className="note">
              ჩართვისას საიტი უარყოფს ცვლილებებს ყველასგან, გარდა ადმინისტრაციისა.
            </p>
          </div>

          <fieldset className="form-group sp-perms">
            <legend>Support-ის უფლებები</legend>
            <p className="note">
              რას შეუძლია Support Specialist როლს ნაგულისხმევის გარდა. Support ვერასდროს გამოიყენებს ამას საკუთარ ან სხვა
              თანამშრომლის ანგარიშზე; ყველა მოქმედება იწერება აუდიტში.
            </p>
            <label>
              <input
                type="checkbox"
                checked={supportPerms.walletAdjust}
                onChange={(event) => setSupportPerms({ ...supportPerms, walletAdjust: event.target.checked })}
                style={{ marginRight: 8 }}
              />
              ბალანსის დამატება / ჩამოჭრა
            </label>
            <label htmlFor="supportWalletMax" className="sp-perms-sub">
              მაქსიმუმი ერთ ოპერაციაზე (GEL)
              <input
                id="supportWalletMax"
                className="input"
                type="number"
                min={1}
                max={100000}
                disabled={!supportPerms.walletAdjust}
                value={supportPerms.walletAdjustMax}
                onChange={(event) => setSupportPerms({ ...supportPerms, walletAdjustMax: Number(event.target.value) })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={supportPerms.suspendUsers}
                onChange={(event) => setSupportPerms({ ...supportPerms, suspendUsers: event.target.checked })}
                style={{ marginRight: 8 }}
              />
              მომხმარებლის შეჩერება / აღდგენა <small>(დაბლოკვა რჩება მხოლოდ Super Admin-ს)</small>
            </label>
          </fieldset>

          <button type="submit" className="button glow-on-hover" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            შენახვა
          </button>
        </form>
      )}
    </AdminLayout>
  )
}
