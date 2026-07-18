import { useEffect, useState } from 'react'
import type { PublicPlatformSettings } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, ApiError } from '../../lib/api'

// Super Admin only server-side (see backend/src/settings/platform-settings.controller.ts) — any
// other role's GET/POST here 403s, surfaced via the error banner below like every other admin page.
export default function AdminSettings() {
  const [settings, setSettings] = useState<PublicPlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [platformFeePercent, setPlatformFeePercent] = useState(10)
  const [minWithdrawalWaveCoin, setMinWithdrawalWaveCoin] = useState(20)
  const [maintenanceMode, setMaintenanceMode] = useState(false)

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
        setMinWithdrawalWaveCoin(data.minWithdrawalWaveCoin)
        setMaintenanceMode(data.maintenanceMode)
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

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      const updated = await api.adminUpdatePlatformSettings({
        platformFeePercent,
        minWithdrawalWaveCoin,
        maintenanceMode,
      })
      setSettings(updated)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'შენახვა ვერ მოხერხდა.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <h1 className="page-title">პლატფორმის პარამეტრები</h1>
      <p className="page-subtitle">საკომისიო, გატანის მინიმუმი და ტექნიკური სამუშაოების რეჟიმი</p>

      {error && <div className="status-text status-error">{error}</div>}
      {saved && <div className="status-text status-success">შენახულია.</div>}

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : !settings ? null : (
        <form className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={save}>
          <div className="form-group">
            <label htmlFor="platformFeePercent">პლატფორმის საკომისიო (%)</label>
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
            <label htmlFor="minWithdrawalWaveCoin">გატანის მინიმალური ოდენობა (WC)</label>
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
              ეს პარამეტრი ინახება, მაგრამ ჯერ არ არის აღსრულებული არცერთ endpoint-ზე — ჩართვას ჯერ
              პრაქტიკული ეფექტი არ ექნება. იხილეთ backend/src/settings/CLAUDE.md.
            </p>
          </div>

          <button type="submit" className="button glow-on-hover" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            შენახვა
          </button>
        </form>
      )}
    </AdminLayout>
  )
}
