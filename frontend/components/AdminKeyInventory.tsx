import { useCallback, useEffect, useState } from 'react'
import type { SellerListingKeySummary } from '@wavehub/shared-types'
import { KeyInventoryStatus } from '@wavehub/shared-types'
import { api, errorMessage } from '../lib/api'

const MAX_KEYS_PER_UPLOAD = 500
const STATUS_LABEL: Record<KeyInventoryStatus, string> = {
  [KeyInventoryStatus.Available]: 'ხელმისაწვდომი',
  [KeyInventoryStatus.Sold]: 'გაყიდული',
  [KeyInventoryStatus.Revoked]: 'გაუქმებული',
}

// Steam game stock for staff (admin editor) — any Steam publisher can add keys to a game another
// staff member created (client feedback #5). Keys may be pasted one per line or separated by
// spaces/commas; the page never shows a key back, only statuses.
export default function AdminKeyInventory({ listingId }: { listingId: string }) {
  const [keys, setKeys] = useState<SellerListingKeySummary[] | null>(null)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => api.adminListListingKeys(listingId).then(setKeys).catch((err) => setStatus({ kind: 'error', text: errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.') })), [listingId])
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

  const available = keys?.filter((k) => k.status === KeyInventoryStatus.Available).length ?? 0
  return (
    <section className="detail-section admin-key-inventory">
      <h2>{`მარაგი — ${available} ხელმისაწვდომი გასაღები`}</h2>
      {status.text && <div className={`status-text status-${status.kind === 'error' ? 'error' : 'success'}`}>{status.text}</div>}
      <label className="field">
        გასაღებების დამატება <small>თითო ხაზზე, ან გამოყავით სფეისით/მძიმით (მაქს. {MAX_KEYS_PER_UPLOAD})</small>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY'} spellCheck={false} autoComplete="off" />
      </label>
      <p className="note" aria-live="polite">{`ამოცნობილია ${parsed.length} გასაღები`}</p>
      <button type="button" className="button" disabled={busy || parsed.length === 0} onClick={() => void upload()}>
        {busy ? 'იტვირთება…' : parsed.length > 1 ? `${parsed.length} გასაღების ატვირთვა` : 'გასაღების ატვირთვა'}
      </button>
      {keys && keys.length > 0 && (
        <ul className="admin-key-list">
          {keys.map((k) => (
            <li key={k.id}>
              <span>{STATUS_LABEL[k.status]}</span>
              <small>{new Date(k.createdAt).toLocaleString('ka-GE')}</small>
              {k.status === KeyInventoryStatus.Available && (
                <button type="button" className="button ghost" onClick={() => void revoke(k.id)}>
                  გაუქმება
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
