import { useCallback, useEffect, useState } from 'react'
import type { SellerListingKeySummary } from '@wavehub/shared-types'
import { KeyInventoryStatus } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'
import { kaDateTime } from '../lib/dates'

const MAX_KEYS_PER_UPLOAD = 500
const SHOWN_AT_FIRST = 50
const STATUS_LABEL: Record<KeyInventoryStatus, string> = {
  [KeyInventoryStatus.Available]: 'ხელმისაწვდომი',
  [KeyInventoryStatus.Sold]: 'გაყიდული',
  [KeyInventoryStatus.Revoked]: 'გაუქმებული',
}

// Steam game stock for staff (Admin → Steam, Admin → Listings) — any Steam publisher can add keys to
// a game another staff member created (client feedback #5). Keys may be pasted one per line or
// separated by spaces/commas; the page never shows a key back, only statuses and dates.
export default function AdminKeyInventory({ listingId, onChange }: { listingId: string; onChange?: (available: number) => void }) {
  const [keys, setKeys] = useState<SellerListingKeySummary[] | null>(null)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })
  const [busy, setBusy] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const reload = useCallback(
    () =>
      api
        .adminListListingKeys(listingId)
        .then((rows) => {
          setKeys(rows)
          onChange?.(rows.filter((k) => k.status === KeyInventoryStatus.Available).length)
        })
        .catch((err) => setStatus({ kind: 'error', text: errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.') })),
    [listingId, onChange],
  )
  useEffect(() => {
    void reload()
  }, [reload])

  const parsed = [...new Set(text.split(/[\s,;]+/).map((k) => k.trim()).filter(Boolean))]
  const upload = async () => {
    if (parsed.length === 0) return
    if (parsed.length > MAX_KEYS_PER_UPLOAD) return setStatus({ kind: 'error', text: `ერთ ჯერზე მაქსიმუმ ${MAX_KEYS_PER_UPLOAD} გასაღები.` })
    const bad = parsed.findIndex((k) => k.length < 4 || k.length > 200)
    if (bad !== -1) return setStatus({ kind: 'error', text: `გასაღები #${bad + 1} უნდა იყოს 4–200 სიმბოლო.` })
    setBusy(true)
    try {
      const res = await api.adminAddListingKeys(listingId, parsed)
      setText('')
      setStatus({ kind: 'success', text: `დაემატა ${res.added} გასაღები.` })
      await reload()
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'ატვირთვა ვერ მოხერხდა.') })
    } finally {
      setBusy(false)
    }
  }
  const revoke = async (keyId: string) => {
    if (!window.confirm('გასაღები გაუქმდება და აღარ გაიყიდება. გავაგრძელოთ?')) return
    try {
      await api.adminRemoveListingKey(listingId, keyId)
      await reload()
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'გაუქმება ვერ მოხერხდა.') })
    }
  }

  const count = (s: KeyInventoryStatus) => keys?.filter((k) => k.status === s).length ?? 0
  const visible = keys ? (showAll ? keys : keys.slice(0, SHOWN_AT_FIRST)) : []
  return (
    <section className="detail-section admin-key-inventory">
      <h2>გასაღებები</h2>
      <div className="aki-counts">
        <span className="ok">
          <b>{count(KeyInventoryStatus.Available)}</b> ხელმისაწვდომი
        </span>
        <span>
          <b>{count(KeyInventoryStatus.Sold)}</b> გაყიდული
        </span>
        <span>
          <b>{count(KeyInventoryStatus.Revoked)}</b> გაუქმებული
        </span>
      </div>
      {status.text && <div className={`status-text status-${status.kind === 'error' ? 'error' : 'success'}`}>{status.text}</div>}
      <label className="field">
        გასაღებების დამატება <small>{`თითო ხაზზე, ან გამოყავით სფეისით/მძიმით (მაქს. ${MAX_KEYS_PER_UPLOAD})`}</small>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY'} spellCheck={false} autoComplete="off" />
      </label>
      <div className="aki-upload">
        <span className="note" aria-live="polite">{`ამოცნობილია ${parsed.length} გასაღები`}</span>
        <button type="button" className="button" disabled={busy || parsed.length === 0} onClick={() => void upload()}>
          {busy ? 'იტვირთება…' : parsed.length > 1 ? `${parsed.length} გასაღების ატვირთვა` : 'გასაღების ატვირთვა'}
        </button>
      </div>
      {keys && keys.length > 0 && (
        <>
          <ul className="admin-key-list">
            {visible.map((k) => (
              <li key={k.id}>
                <span className={`aki-status ${k.status}`}>{STATUS_LABEL[k.status]}</span>
                <small>
                  {`დამატებულია ${kaDateTime(k.createdAt)}`}
                  {k.soldAt ? ` · გაყიდულია ${kaDateTime(k.soldAt)}` : ''}
                </small>
                {k.status === KeyInventoryStatus.Available && (
                  <button type="button" className="button ghost" onClick={() => void revoke(k.id)}>
                    გაუქმება
                  </button>
                )}
              </li>
            ))}
          </ul>
          {keys.length > SHOWN_AT_FIRST && (
            <button type="button" className="button ghost aki-more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'ნაკლების ჩვენება' : `ყველას ჩვენება (${keys.length})`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
