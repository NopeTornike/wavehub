import { useEffect, useState, type FormEvent } from 'react'
import type { AdminPromoCode } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'

// Admin → Promo codes (Super Admin): each code adds spendable WaveCoin credit, once per account,
// up to its cap, inside an optional window. The credit can't be withdrawn. Audit-logged.
const localInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 4 * 3600_000).toISOString().slice(0, 16) : '')
const fromLocal = (value: string) => (value ? new Date(`${value}:00+04:00`).toISOString() : null)
const fmt = (iso: string | null) => (iso ? localInput(iso).replace('T', ' ') : '—')

export default function AdminPromoCodes() {
  const [codes, setCodes] = useState<AdminPromoCode[] | null>(null)
  const [form, setForm] = useState({ code: '', amount: 5, max: 100, startsAt: '', expiresAt: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })

  useEffect(() => {
    api
      .adminListPromoCodes()
      .then(setCodes)
      .catch((err) => {
        setCodes([])
        setStatus({ kind: 'error', text: errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.') })
      })
  }, [])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(form.code.trim())) return setStatus({ kind: 'error', text: 'კოდი: 3–30 ასო, ციფრი, - ან _.' })
    setBusy(true)
    try {
      const created = await api.adminCreatePromoCode({
        code: form.code.trim(),
        amountWaveCoin: form.amount,
        maxRedemptions: form.max,
        startsAt: fromLocal(form.startsAt),
        expiresAt: fromLocal(form.expiresAt),
        note: form.note.trim() || null,
      })
      setCodes((list) => [created, ...(list ?? [])])
      setForm({ code: '', amount: 5, max: 100, startsAt: '', expiresAt: '', note: '' })
      setStatus({ kind: 'success', text: `კოდი ${created.code} შეიქმნა.` })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'შექმნა ვერ მოხერხდა.') })
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (c: AdminPromoCode) => {
    try {
      const next = await api.adminUpdatePromoCode(c.id, { active: !c.active })
      setCodes((list) => list?.map((x) => (x.id === c.id ? next : x)) ?? null)
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'ცვლილება ვერ მოხერხდა.') })
    }
  }

  // Only an unused code can be deleted; a redeemed one is the record of credit handed out (409).
  const remove = async (c: AdminPromoCode) => {
    if (!window.confirm(`კოდი ${c.code} სამუდამოდ წაიშლება. გავაგრძელოთ?`)) return
    try {
      await api.adminDeletePromoCode(c.id)
      setCodes((list) => list?.filter((x) => x.id !== c.id) ?? null)
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'გამოყენებული კოდი ვერ წაიშლება — გამორთე.') })
    }
  }

  const raiseCap = async (c: AdminPromoCode) => {
    const value = window.prompt(`ახალი ლიმიტი (ახლა ${c.maxRedemptions}, გამოყენებულია ${c.redeemedCount})`, String(c.maxRedemptions))
    if (!value) return
    try {
      const next = await api.adminUpdatePromoCode(c.id, { maxRedemptions: Number(value) })
      setCodes((list) => list?.map((x) => (x.id === c.id ? next : x)) ?? null)
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'ცვლილება ვერ მოხერხდა.') })
    }
  }

  return (
    <AdminLayout title="პრომო კოდები">
      <h1 className="page-title">პრომო კოდები</h1>
      <p className="page-subtitle">კოდი ბალანსს ამატებს თანხას (GEL) — ერთხელ თითო ანგარიშზე, მხოლოდ დადასტურებული ელფოსტით. ბონუსი იხარჯება, მაგრამ არ გაიტანება.</p>

      <form className="stack-form apc-form" onSubmit={create}>
        <h2>ახალი კოდი</h2>
        <div className="apc-grid">
          <label className="field">
            კოდი
            <input value={form.code} maxLength={30} placeholder="WELCOME5" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </label>
          <label className="field">
            თანხა (GEL)
            <input type="number" min={1} max={1000} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </label>
          <label className="field">
            მაქს. გამოყენება
            <input type="number" min={1} max={100000} value={form.max} onChange={(e) => setForm({ ...form, max: Number(e.target.value) })} />
          </label>
          <label className="field">
            იწყება (არასავალდ.)
            <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          </label>
          <label className="field">
            მთავრდება (არასავალდ.)
            <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </label>
          <label className="field">
            შენიშვნა (შიდა)
            <input value={form.note} maxLength={200} placeholder="მაგ. გაშვების კამპანია" onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
        </div>
        {status.text && (
          <p className={`status-text ${status.kind === 'error' ? 'status-error' : 'status-success'}`} role={status.kind === 'error' ? 'alert' : 'status'}>
            {status.text}
          </p>
        )}
        <button className="button" type="submit" disabled={busy}>
          {busy ? 'იქმნება…' : 'კოდის შექმნა'}
        </button>
      </form>

      {codes === null ? (
        <div className="empty-state">იტვირთება…</div>
      ) : codes.length === 0 ? (
        <div className="empty-state">კოდები ჯერ არ არის.</div>
      ) : (
        <div className="order-list">
          {codes.map((c) => (
            <div key={c.id} className="admin-row">
              <div className="admin-row-main">
                <strong>
                  {c.code} <span className={`arv-status ${c.active ? '' : 'hidden'}`}>{c.active ? 'აქტიური' : 'გამორთული'}</span>
                </strong>
                <span className="note">
                  +{c.amountWaveCoin} GEL · გამოყენებულია {c.redeemedCount}/{c.maxRedemptions} · {fmt(c.startsAt)} → {fmt(c.expiresAt)}
                  {c.note ? ` · ${c.note}` : ''}
                </span>
              </div>
              <div className="admin-row-actions">
                <button type="button" className="button ghost" onClick={() => void raiseCap(c)}>
                  ლიმიტი
                </button>
                <button type="button" className="button ghost" onClick={() => void toggle(c)}>
                  {c.active ? 'გამორთვა' : 'ჩართვა'}
                </button>
                {c.redeemedCount === 0 && (
                  <button type="button" className="button danger" onClick={() => void remove(c)}>
                    წაშლა
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
