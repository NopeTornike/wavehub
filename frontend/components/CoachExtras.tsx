import { useState } from 'react'
import { DEFAULT_COACH_AVAILABILITY, tbilisiLocal, type CoachAvailability, type CoachAvailabilityRange, type PublicCoachPackage, type RequirementField } from '@wavehub/shared-types'
import { errorMessage, type CoachPackageInput } from '../lib/api'
import { cleanRequirements, RequirementsEditor, validateServiceExtras } from './ServiceEditors'

// The parts of a coach profile that have their own endpoints: the uploaded intro video, the
// fixed-price packages and the pre-booking questions. Used by the coach's own editor
// (pages/coaching/profile.tsx) and by Admin → Coaches (pages/admin/coaches.tsx), which pass the
// matching api calls. Bounds mirror the backend: video MP4/WebM ≤50MB; ≤6 packages (name 2–60,
// description ≤300, 15–480 min, 1–100000 GEL); ≤10 questions.

export const LANGUAGE_OPTIONS: Array<[string, string]> = [
  ['ka', 'ქართული'],
  ['en', 'English'],
  ['ru', 'Русский'],
  ['tr', 'Türkçe'],
  ['de', 'Deutsch'],
  ['uk', 'Українська'],
]

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_PACKAGES = 6

type Status = { kind: '' | 'error' | 'success'; text: string }
type PackageRow = { name: string; description: string; sessionsCount: number; durationMinutes: number; priceWaveCoin: number }

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
    initial.map((p) => ({ name: p.name, description: p.description ?? '', sessionsCount: p.sessionsCount ?? 1, durationMinutes: p.durationMinutes, priceWaveCoin: p.priceWaveCoin })),
  )
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: '', text: '' })
  const patch = (i: number, change: Partial<PackageRow>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...change } : r)))

  const save = async () => {
    for (const [i, r] of rows.entries()) {
      if (r.name.trim().length < 2 || r.name.trim().length > 60) return setStatus({ kind: 'error', text: `პაკეტი #${i + 1}: სახელი 2–60 სიმბოლო.` })
      if (r.description.length > 300) return setStatus({ kind: 'error', text: `პაკეტი #${i + 1}: აღწერა მაქს. 300 სიმბოლო.` })
      if (!Number.isInteger(r.sessionsCount) || r.sessionsCount < 1 || r.sessionsCount > 10) return setStatus({ kind: 'error', text: `პაკეტი #${i + 1}: სესიების რაოდენობა 1–10.` })
      if (!Number.isInteger(r.durationMinutes) || r.durationMinutes < 15 || r.durationMinutes > 480) return setStatus({ kind: 'error', text: `პაკეტი #${i + 1}: ხანგრძლივობა 15–480 წუთი.` })
      if (!Number.isInteger(r.priceWaveCoin) || r.priceWaveCoin < 1 || r.priceWaveCoin > 100000) return setStatus({ kind: 'error', text: `პაკეტი #${i + 1}: ფასი 1–100000 GEL.` })
    }
    setBusy(true)
    try {
      const saved = await onSave(rows.map((r) => ({ name: r.name.trim(), description: r.description.trim() || undefined, sessionsCount: r.sessionsCount, durationMinutes: r.durationMinutes, priceWaveCoin: r.priceWaveCoin })))
      setRows(saved.map((p) => ({ name: p.name, description: p.description ?? '', sessionsCount: p.sessionsCount ?? 1, durationMinutes: p.durationMinutes, priceWaveCoin: p.priceWaveCoin })))
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
      <p className="ce-hint">ფიქსირებული ფასის შეთავაზებები საათობრივი ფასის გვერდით (მაგ. „ზრდა — 3 სესია × 60 წთ — 100 GEL“). სტუდენტი ჯავშნისას იმდენ დროს ირჩევს, რამდენი სესიაცაა პაკეტში. მაქს. {MAX_PACKAGES}.</p>
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
              <span>სესიები</span>
              <input type="number" min={1} max={10} step={1} value={r.sessionsCount} onChange={(e) => patch(i, { sessionsCount: Number(e.target.value) })} />
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
          <button type="button" className="sv-add" onClick={() => setRows((list) => [...list, { name: '', description: '', sessionsCount: 1, durationMinutes: 60, priceWaveCoin: 20 }])}>
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

// Weekly working hours + days off + minimum notice (coaches.availability, Tbilisi time). The
// booking calendar only offers starts inside these hours and the backend refuses anything outside.
const WEEK: Array<[number, string]> = [
  [1, 'ორშაბათი'],
  [2, 'სამშაბათი'],
  [3, 'ოთხშაბათი'],
  [4, 'ხუთშაბათი'],
  [5, 'პარასკევი'],
  [6, 'შაბათი'],
  [0, 'კვირა'],
]
const HALF_HOURS = Array.from({ length: 49 }, (_, i) => i * 30)
const NOTICE_OPTIONS = [0, 1, 2, 3, 6, 12, 24, 48, 72]
const MAX_DAYS_OFF = 90

export function hm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function CoachHoursEditor({ initial, onSave }: { initial: CoachAvailability | null; onSave: (value: CoachAvailability | null) => Promise<unknown> }) {
  const [isDefault, setIsDefault] = useState(initial === null)
  const [hours, setHours] = useState<CoachAvailability>(() => initial ?? DEFAULT_COACH_AVAILABILITY)
  const [dayOff, setDayOff] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: '', text: '' })
  const [today] = useState(() => tbilisiLocal(Date.now()).date)

  const edit = (change: (h: CoachAvailability) => CoachAvailability) => {
    setHours(change)
    setStatus({ kind: '', text: '' })
  }
  const rangesOf = (day: number) => hours.weekly.filter((r) => r.day === day)
  const setDay = (day: number, ranges: Array<Omit<CoachAvailabilityRange, 'day'>>) =>
    edit((h) => ({ ...h, weekly: [...h.weekly.filter((r) => r.day !== day), ...ranges.map((r) => ({ day, from: r.from, to: r.to }))] }))
  const copyToAll = (day: number) => {
    const ranges = rangesOf(day)
    edit((h) => ({ ...h, weekly: WEEK.flatMap(([d]) => ranges.map((r) => ({ day: d, from: r.from, to: r.to }))) }))
  }

  const problem = (): string | null => {
    for (const [day, label] of WEEK) {
      const ranges = rangesOf(day).sort((a, b) => a.from - b.from)
      for (const [i, r] of ranges.entries()) {
        if (r.from >= r.to) return `${label}: დასრულება უნდა იყოს დაწყების შემდეგ.`
        if (i > 0 && r.from < ranges[i - 1].to) return `${label}: დროები ერთმანეთს ფარავს.`
      }
    }
    return null
  }

  const save = async (value: CoachAvailability | null) => {
    if (value) {
      const p = problem()
      if (p) return setStatus({ kind: 'error', text: p })
    }
    setBusy(true)
    try {
      await onSave(value ? { ...value, daysOff: value.daysOff.filter((d) => d >= today) } : null)
      setIsDefault(value === null)
      if (!value) setHours(DEFAULT_COACH_AVAILABILITY)
      setStatus({ kind: 'success', text: value ? 'სამუშაო საათები შენახულია.' : 'დაბრუნდა სტანდარტული საათები.' })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'შენახვა ვერ მოხერხდა.') })
    } finally {
      setBusy(false)
    }
  }

  const timeSelect = (value: number, onChange: (v: number) => void, min: number, max: number, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {HALF_HOURS.filter((m) => m >= min && m <= max).map((m) => (
        <option key={m} value={m}>
          {hm(m)}
        </option>
      ))}
    </select>
  )

  return (
    <section className="ce-section ce-hours">
      <h3>სამუშაო საათები</h3>
      <p className="ce-hint">
        როდის შეუძლიათ მოსწავლეებს შენთან სესიის დაჯავშნა (თბილისის დრო). ჯავშნის კალენდარში მხოლოდ ეს დროები გამოჩნდება.
        {isDefault && ' ახლა მოქმედებს სტანდარტული განრიგი: ყოველდღე 10:00–24:00.'}
      </p>
      <div className="ce-week">
        {WEEK.map(([day, label]) => {
          const ranges = rangesOf(day)
          return (
            <div key={day} className={`ce-day${ranges.length ? '' : ' off'}`}>
              <label className="ce-day-toggle">
                <input type="checkbox" checked={ranges.length > 0} onChange={(e) => setDay(day, e.target.checked ? [{ from: 600, to: 1440 }] : [])} />
                <strong>{label}</strong>
              </label>
              <div className="ce-ranges">
                {ranges.length === 0 && <span className="ce-closed">დასვენება</span>}
                {ranges.map((r, i) => (
                  <span key={i} className="ce-range">
                    {timeSelect(r.from, (from) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, from } : x))), 0, 1410, `${label} — დაწყება`)}
                    <span aria-hidden="true">–</span>
                    {timeSelect(r.to, (to) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, to } : x))), 30, 1440, `${label} — დასრულება`)}
                    <button type="button" className="sv-remove" aria-label="დროის წაშლა" onClick={() => setDay(day, ranges.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="ce-day-actions">
                {ranges.length > 0 && ranges.length < 4 && (
                  <button type="button" className="ce-link" onClick={() => setDay(day, [...ranges, { from: Math.min(1410, ranges[ranges.length - 1].to), to: 1440 }])}>
                    + დრო
                  </button>
                )}
                {ranges.length > 0 && (
                  <button type="button" className="ce-link" onClick={() => copyToAll(day)}>
                    ყველა დღეზე
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="ce-hours-extra">
        <label className="sp-field">
          <span>მინიმალური წინასწარი შეტყობინება</span>
          <select value={hours.noticeHours} onChange={(e) => edit((h) => ({ ...h, noticeHours: Number(e.target.value) }))}>
            {NOTICE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'არ არის საჭირო' : `${n} საათით ადრე`}
              </option>
            ))}
          </select>
        </label>
        <div className="sp-field">
          <span>დასვენების დღეები</span>
          <div className="ce-dayoff-add">
            <input type="date" min={today} value={dayOff} onChange={(e) => setDayOff(e.target.value)} aria-label="დასვენების დღე" />
            <button
              type="button"
              className="button ghost"
              disabled={!dayOff || dayOff < today || hours.daysOff.includes(dayOff) || hours.daysOff.length >= MAX_DAYS_OFF}
              onClick={() => {
                edit((h) => ({ ...h, daysOff: [...h.daysOff, dayOff].sort() }))
                setDayOff('')
              }}
            >
              დამატება
            </button>
          </div>
          <div className="ce-chips">
            {hours.daysOff.filter((d) => d >= today).length === 0 && <span className="sv-muted">არ არის</span>}
            {hours.daysOff
              .filter((d) => d >= today)
              .map((d) => (
                <span key={d} className="ce-chip">
                  {d.split('-').reverse().join('.')}
                  <button type="button" aria-label="დასვენების დღის წაშლა" onClick={() => edit((h) => ({ ...h, daysOff: h.daysOff.filter((x) => x !== d) }))}>
                    ×
                  </button>
                </span>
              ))}
          </div>
        </div>
      </div>

      <div className="ce-actions">
        <button type="button" className="button" disabled={busy} onClick={() => void save(hours)}>
          {busy ? 'ინახება…' : 'საათების შენახვა'}
        </button>
        {!isDefault && (
          <button type="button" className="button ghost" disabled={busy} onClick={() => void save(null)}>
            სტანდარტულზე დაბრუნება
          </button>
        )}
      </div>
      <StatusLine status={status} />
    </section>
  )
}
