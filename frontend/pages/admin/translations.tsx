import { useEffect, useMemo, useState } from 'react'
import type { AdminUiTranslation } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'
import { builtInTranslations, TRANSLATIONS_CHANGED } from '../../lib/i18n'

// Admin → Translations (Super Admin + Main Administrator, owner 2026-10-28): find any text on the site
// and change its English and / or Georgian wording. Rows are the built-in strings (the Georgian the
// app renders → its English) plus anything staff already edited. Saving applies to every visitor on
// their next page load (and to this tab right away); clearing both fields restores the built-in
// text. Audit-logged on the server. Text like "{0} active orders" keeps its {0}, {1}… placeholders.
const PAGE = 40

type Row = { key: string; builtInEn: string | null; edit: AdminUiTranslation | null }

function RowEditor({ row, onSaved }: { row: Row; onSaved: (saved: AdminUiTranslation) => void }) {
  const [ka, setKa] = useState(row.edit?.ka ?? '')
  const [en, setEn] = useState(row.edit?.en ?? '')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })
  const dirty = ka !== (row.edit?.ka ?? '') || en !== (row.edit?.en ?? '')
  const placeholders = (row.key.match(/\{\d\}/g) ?? []).sort().join('')
  const save = async (next: { ka: string; en: string }) => {
    const missing = (value: string) => value && (value.match(/\{\d\}/g) ?? []).sort().join('') !== placeholders
    if (placeholders && (missing(next.ka) || missing(next.en))) return setStatus({ kind: 'error', text: `შეინარჩუნეთ ჩანაცვლების ნიშნები: ${placeholders}` })
    setBusy(true)
    setStatus({ kind: '', text: '' })
    try {
      const saved = await api.adminSaveTranslation({ key: row.key, en: next.en.trim() || null, ka: next.ka.trim() || null })
      onSaved(saved)
      setStatus({ kind: 'success', text: saved.en || saved.ka ? 'შენახულია.' : 'დაბრუნდა საწყის ტექსტზე.' })
      window.dispatchEvent(new Event(TRANSLATIONS_CHANGED))
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'შენახვა ვერ მოხერხდა.') })
    } finally {
      setBusy(false)
    }
  }
  return (
    <article className="tr-row" data-i18n-keep="">
      <p className="tr-source">
        <small>საწყისი ტექსტი</small>
        <span>{row.key}</span>
      </p>
      <label className="field">
        ქართული {row.edit?.ka && <em className="tr-edited">შეცვლილია</em>}
        <textarea rows={2} maxLength={4000} placeholder={row.key} value={ka} onChange={(e) => setKa(e.target.value)} />
      </label>
      <label className="field">
        English {row.edit?.en && <em className="tr-edited">შეცვლილია</em>}
        <textarea rows={2} maxLength={4000} placeholder={row.builtInEn ?? '— (თარგმანი არ აქვს)'} value={en} onChange={(e) => setEn(e.target.value)} />
      </label>
      <div className="tr-actions">
        <button type="button" className="button" disabled={busy || !dirty} onClick={() => void save({ ka, en })}>
          {busy ? 'ინახება…' : 'შენახვა'}
        </button>
        {row.edit && (
          <button
            type="button"
            className="button ghost"
            disabled={busy}
            onClick={() => {
              setKa('')
              setEn('')
              void save({ ka: '', en: '' })
            }}
          >
            საწყისზე დაბრუნება
          </button>
        )}
        {status.text && <span className={`status-text ${status.kind === 'error' ? 'status-error' : 'status-success'}`}>{status.text}</span>}
      </div>
    </article>
  )
}

export default function AdminTranslations() {
  const [edits, setEdits] = useState<AdminUiTranslation[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [onlyEdited, setOnlyEdited] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [newKey, setNewKey] = useState('')

  useEffect(() => {
    api
      .adminListTranslations()
      .then(setEdits)
      .catch((err) => {
        setEdits([])
        setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.'))
      })
  }, [])

  const rows = useMemo<Row[]>(() => {
    const builtIn = builtInTranslations()
    const byKey = new Map((edits ?? []).map((e) => [e.key, e]))
    const keys = new Set([...Object.keys(builtIn), ...byKey.keys()])
    const q = query.trim().toLowerCase()
    const list: Row[] = []
    for (const key of keys) {
      const edit = byKey.get(key) ?? null
      if (onlyEdited && !edit) continue
      const en = builtIn[key] ?? null
      if (q && ![key, en ?? '', edit?.en ?? '', edit?.ka ?? ''].some((t) => t.toLowerCase().includes(q))) continue
      list.push({ key, builtInEn: en, edit })
    }
    // Edited first, then the shorter (more UI-like) strings.
    return list.sort((a, b) => Number(!!b.edit) - Number(!!a.edit) || a.key.length - b.key.length)
  }, [edits, query, onlyEdited])

  const onSaved = (saved: AdminUiTranslation) =>
    setEdits((list) => {
      const rest = (list ?? []).filter((e) => e.key !== saved.key)
      return saved.en || saved.ka ? [saved, ...rest] : rest
    })

  return (
    <AdminLayout title="თარგმანები">
      <h1 className="page-title">თარგმანები</h1>
      <p className="note">
        მოძებნეთ ნებისმიერი ტექსტი საიტზე და შეცვალეთ ქართული ან ინგლისური ვერსია. ცვლილება ყველა ვიზიტორთან გვერდის შემდეგ ჩატვირთვაზე გამოჩნდება. ორივე ველის
        გასუფთავება საწყის ტექსტს აბრუნებს. ტექსტში {'{0}'}, {'{1}'} ნიშნები ცვლადებია (რიცხვი, სახელი) — დატოვეთ ისინი.
      </p>
      {error && (
        <div className="status-text status-error" role="alert">
          {error}
        </div>
      )}
      <div className="tr-toolbar">
        <input type="search" placeholder="ძიება ქართულად ან ინგლისურად…" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }} aria-label="ძიება" />
        <label>
          <input type="checkbox" checked={onlyEdited} onChange={(e) => setOnlyEdited(e.target.checked)} /> მხოლოდ შეცვლილი
        </label>
        <span className="note">{edits === null ? 'იტვირთება…' : `${rows.length} ტექსტი`}</span>
      </div>
      <details className="tr-new">
        <summary>ტექსტი სიაში არ არის?</summary>
        <p className="note">ჩაწერეთ ზუსტად ის ქართული ტექსტი, რაც საიტზე ჩანს.</p>
        <input value={newKey} maxLength={2000} onChange={(e) => setNewKey(e.target.value)} placeholder="ქართული ტექსტი როგორც საიტზეა" />
        {newKey.trim() && <RowEditor key={`new:${newKey.trim()}`} row={{ key: newKey.trim(), builtInEn: builtInTranslations()[newKey.trim()] ?? null, edit: (edits ?? []).find((e) => e.key === newKey.trim()) ?? null }} onSaved={onSaved} />}
      </details>
      <div className="tr-list">
        {rows.slice(0, limit).map((row) => (
          <RowEditor key={row.key} row={row} onSaved={onSaved} />
        ))}
      </div>
      {rows.length > limit && (
        <button type="button" className="button ghost tr-more" onClick={() => setLimit((l) => l + PAGE)}>
          მეტის ჩვენება ({rows.length - limit})
        </button>
      )}
    </AdminLayout>
  )
}
