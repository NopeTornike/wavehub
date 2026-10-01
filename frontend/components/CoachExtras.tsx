import { useState } from 'react'
import type { PublicCoachPackage, RequirementField } from '@wavehub/shared-types'
import { errorMessage, type CoachPackageInput } from '../lib/api'
import { cleanRequirements, RequirementsEditor, validateServiceExtras } from './ServiceEditors'

// The parts of a coach profile that have their own endpoints: the uploaded intro video, the
// fixed-price packages and the pre-booking questions. Used by the coach's own editor
// (pages/coaching/profile.tsx) and by Admin → Coaches (pages/admin/coaches.tsx), which pass the
// matching api calls. Bounds mirror the backend: video MP4/WebM ≤50MB; ≤6 packages (name 2–60,
// description ≤300, 15–480 min, 1–100000 GEL); ≤10 questions.

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_PACKAGES = 6

type Status = { kind: '' | 'error' | 'success'; text: string }
type PackageRow = { name: string; description: string; durationMinutes: number; priceWaveCoin: number }

function StatusLine({ status }: { status: Status }) {
  if (!status.text) return null
  return (
    <p className={`seller-status ${status.kind}`} role={status.kind === 'error' ? 'alert' : undefined}>
      {status.text}
    </p>
  )
}

export function CoachVideoEditor({
  videoFileUrl,
  onUpload,
  onClear,
}: {
  videoFileUrl: string | null
  onUpload: (file: File) => Promise<{ videoFileUrl: string }>
  onClear: () => Promise<unknown>
}) {
  const [url, setUrl] = useState(videoFileUrl)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: '', text: '' })

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!['video/mp4', 'video/webm'].includes(file.type) || file.size > MAX_VIDEO_BYTES) {
      return setStatus({ kind: 'error', text: 'ვიდეო: MP4 ან WebM, მაქსიმუმ 50MB.' })
    }
    setBusy(true)
    setStatus({ kind: '', text: 'იტვირთება…' })
    try {
      const res = await onUpload(file)
      setUrl(res.videoFileUrl)
      setStatus({ kind: 'success', text: 'ვიდეო ატვირთულია.' })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'ატვირთვა ვერ მოხერხდა.') })
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    if (!window.confirm('წავშალოთ ატვირთული ვიდეო?')) return
    setBusy(true)
    try {
      await onClear()
      setUrl(null)
      setStatus({ kind: 'success', text: 'ვიდეო წაიშალა.' })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'წაშლა ვერ მოხერხდა.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ce-section">
      <h3>გაცნობითი ვიდეო</h3>
      <p className="ce-hint">ატვირთე MP4 ან WebM ფაილი (მაქს. 50MB). ატვირთული ვიდეო ჩანს პროფილზე YouTube/Vimeo ბმულის ნაცვლად.</p>
      {url && <video className="ce-video" src={url} controls preload="metadata" />}
      <div className="ce-actions">
        <label className={`button ce-file${busy ? ' disabled' : ''}`}>
          {url ? 'ვიდეოს შეცვლა' : 'ვიდეოს ატვირთვა'}
          <input
            type="file"
            accept="video/mp4,video/webm"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              void upload(file)
            }}
          />
        </label>
        {url && (
          <button type="button" className="button ghost" disabled={busy} onClick={() => void clear()}>
            წაშლა
          </button>
        )}
      </div>
      <StatusLine status={status} />
    </section>
  )
}

export function CoachPackagesEditor({ initial, onSave }: { initial: PublicCoachPackage[]; onSave: (list: CoachPackageInput[]) => Promise<PublicCoachPackage[]> }) {
  const [rows, setRows] = useState<PackageRow[]>(() =>
    initial.map((p) => ({ name: p.name, description: p.description ?? '', durationMinutes: p.durationMinutes, priceWaveCoin: p.priceWaveCoin })),
  )
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: '', text: '' })
  const patch = (i: number, change: Partial<PackageRow>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...change } : r)))

  const save = async () => {
    for (const [i, r] of rows.entries()) {
      if (r.name.trim().length < 2 || r.name.trim().length > 60) return setStatus({ kind: 'error', text: `პაკეტი #${i + 1}: სახელი 2–60 სიმბოლო.` })
      if (r.description.length > 300) return setStatus({ kind: 'error', text: `პაკეტი #${i + 1}: აღწერა მაქს. 300 სიმბოლო.` })
      if (!Number.isInteger(r.durationMinutes) || r.durationMinutes < 15 || r.durationMinutes > 480) return setStatus({ kind: 'error', text: `პაკეტი #${i + 1}: ხანგრძლივობა 15–480 წუთი.` })
      if (!Number.isInteger(r.priceWaveCoin) || r.priceWaveCoin < 1 || r.priceWaveCoin > 100000) return setStatus({ kind: 'error', text: `პაკეტი #${i + 1}: ფასი 1–100000 GEL.` })
    }
    setBusy(true)
    try {
      const saved = await onSave(rows.map((r) => ({ name: r.name.trim(), description: r.description.trim() || undefined, durationMinutes: r.durationMinutes, priceWaveCoin: r.priceWaveCoin })))
      setRows(saved.map((p) => ({ name: p.name, description: p.description ?? '', durationMinutes: p.durationMinutes, priceWaveCoin: p.priceWaveCoin })))
      setStatus({ kind: 'success', text: 'პაკეტები შენახულია.' })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'შენახვა ვერ მოხერხდა.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ce-section">
      <h3>პაკეტები</h3>
      <p className="ce-hint">ფიქსირებული ფასის შეთავაზებები საათობრივი ფასის გვერდით (მაგ. „მატჩის ანალიზი — 45 წთ — 25 GEL“). მაქს. {MAX_PACKAGES}.</p>
      <div className="sv-rows">
        {rows.length === 0 && <p className="sv-muted">პაკეტები არ არის — მყიდველი ჯავშნის საათობრივი ფასით.</p>}
        {rows.map((r, i) => (
          <div key={i} className="sv-row ce-package">
            <label className="sp-field">
              <span>სახელი</span>
              <input maxLength={60} value={r.name} placeholder="მაგ. მატჩის ანალიზი" onChange={(e) => patch(i, { name: e.target.value })} />
            </label>
            <label className="sp-field">
              <span>წუთი</span>
              <input type="number" min={15} max={480} step={5} value={r.durationMinutes} onChange={(e) => patch(i, { durationMinutes: Number(e.target.value) })} />
            </label>
            <label className="sp-field">
              <span>ფასი (GEL)</span>
              <input type="number" min={1} step={1} value={r.priceWaveCoin} onChange={(e) => patch(i, { priceWaveCoin: Number(e.target.value) })} />
            </label>
            <label className="sp-field sv-wide">
              <span>აღწერა (არასავალდებულო)</span>
              <input maxLength={300} value={r.description} onChange={(e) => patch(i, { description: e.target.value })} />
            </label>
            <button type="button" className="sv-remove" aria-label="პაკეტის წაშლა" onClick={() => setRows((list) => list.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        {rows.length < MAX_PACKAGES && (
          <button type="button" className="sv-add" onClick={() => setRows((list) => [...list, { name: '', description: '', durationMinutes: 60, priceWaveCoin: 20 }])}>
            + პაკეტის დამატება
          </button>
        )}
      </div>
      <div className="ce-actions">
        <button type="button" className="button" disabled={busy} onClick={() => void save()}>
          {busy ? 'ინახება…' : 'პაკეტების შენახვა'}
        </button>
      </div>
      <StatusLine status={status} />
    </section>
  )
}

export function CoachQuestionsEditor({ initial, onSave }: { initial: RequirementField[]; onSave: (list: RequirementField[]) => Promise<unknown> }) {
  const [fields, setFields] = useState<RequirementField[]>(initial)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: '', text: '' })

  const save = async () => {
    const problem = validateServiceExtras(fields, [])
    if (problem) return setStatus({ kind: 'error', text: problem })
    setBusy(true)
    try {
      await onSave(cleanRequirements(fields))
      setStatus({ kind: 'success', text: 'კითხვები შენახულია.' })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'შენახვა ვერ მოხერხდა.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ce-section">
      <h3>კითხვები ჯავშნამდე</h3>
      <p className="ce-hint">რას უნდა უპასუხოს მოსწავლემ ჯავშნისას (მაგ. მიმდინარე რანგი, მიზანი, თამაშის ID). პასუხებს ხედავ მხოლოდ შენ.</p>
      <RequirementsEditor value={fields} onChange={setFields} />
      <div className="ce-actions">
        <button type="button" className="button" disabled={busy} onClick={() => void save()}>
          {busy ? 'ინახება…' : 'კითხვების შენახვა'}
        </button>
      </div>
      <StatusLine status={status} />
    </section>
  )
}
