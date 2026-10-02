import { useEffect, useState, type FormEvent } from 'react'
import type { AdminCoachSummary, MyCoachProfile, PublicGame } from '@wavehub/shared-types'
import { VerificationStatus } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { CoachHoursEditor, CoachPackagesEditor, CoachQuestionsEditor, CoachVideoEditor, LANGUAGE_OPTIONS } from '../../components/CoachExtras'
import { api, errorMessage } from '../../lib/api'

// Staff side of coaching: the verification queue, the coach list (suspend/restore), "add coach"
// (an existing active account becomes a verified coach — POST /admin/coaches) and a per-coach
// edit panel (profile fields, uploaded video, packages, pre-booking questions — the same editors
// the coach uses on /coaching/profile). Every mutation is audit-logged server-side.

type CoachForm = { username: string; gameId: string; specialty: string; bio: string; rate: number; rank: string; languages: string[] }
const EMPTY_FORM: CoachForm = { username: '', gameId: '', specialty: '', bio: '', rate: 20, rank: '', languages: ['ka'] }

// Mirrors AdminCreateCoachDto / UpdateCoachProfileDto bounds.
function validateCoachForm(form: CoachForm, needUsername: boolean): string {
  if (needUsername && form.username.trim().replace(/^@/, '').length < 2) return 'მომხმარებლის სახელი: მინიმუმ 2 სიმბოლო.'
  if (form.specialty.trim().length < 3) return 'სპეციალობა: მინიმუმ 3 სიმბოლო.'
  if (form.bio.trim().length < 20) return 'ბიოგრაფია: მინიმუმ 20 სიმბოლო.'
  if (!Number.isInteger(form.rate) || form.rate < 1 || form.rate > 100000) return 'ფასი: მთელი რიცხვი, 1–100000 GEL.'
  return ''
}

function LanguageChips({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <fieldset className="field">
      <legend>ენები</legend>
      <div className="wc-chips">
        {LANGUAGE_OPTIONS.map(([code, label]) => {
          const on = value.includes(code)
          return (
            <button key={code} type="button" className={on ? 'active' : undefined} aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== code) : [...value, code])}>
              {label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function CoachFields({ form, setForm, games }: { form: CoachForm; setForm: (f: CoachForm) => void; games: PublicGame[] }) {
  return (
    <>
      <div className="stack-form-grid">
        <label className="field">
          სპეციალობა
          <input maxLength={200} value={form.specialty} placeholder="მაგ. რანკის აწევა, აიმის ვარჯიში" onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
        </label>
        <label className="field">
          ძირითადი თამაში
          <select value={form.gameId} onChange={(e) => setForm({ ...form, gameId: e.target.value })}>
            <option value="">ზოგადი</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          საათობრივი ფასი (GEL)
          <input type="number" min={1} max={100000} step={1} value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} />
        </label>
      </div>
      <label className="field">
        ბიოგრაფია <small>მინ. 20 სიმბოლო</small>
        <textarea rows={4} maxLength={3000} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
      </label>
      <LanguageChips value={form.languages} onChange={(languages) => setForm({ ...form, languages })} />
    </>
  )
}

// Edit an existing coach: loads GET /admin/coaches/:id/profile, saves profile fields via PATCH and
// the video / packages / questions through their own admin endpoints.
function CoachEditPanel({ coachId, games, onSaved }: { coachId: string; games: PublicGame[]; onSaved: () => void }) {
  const [profile, setProfile] = useState<MyCoachProfile | null>(null)
  const [form, setForm] = useState<CoachForm>(EMPTY_FORM)
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .adminGetCoachProfile(coachId)
      .then((p) => {
        if (cancelled) return
        setProfile(p)
        setForm({ username: '', gameId: p.gameId ?? '', specialty: p.specialty, bio: p.bio, rate: p.hourlyRateWaveCoin, rank: p.rank ?? '', languages: p.languages })
      })
      .catch((err) => {
        if (!cancelled) setStatus({ kind: 'error', text: errorMessage(err, 'პროფილის ჩატვირთვა ვერ მოხერხდა.') })
      })
    return () => {
      cancelled = true
    }
  }, [coachId])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const problem = validateCoachForm(form, false)
    if (problem) return setStatus({ kind: 'error', text: problem })
    setSaving(true)
    try {
      const next = await api.adminUpdateCoachProfile(coachId, {
        gameId: form.gameId || null,
        specialty: form.specialty.trim(),
        bio: form.bio.trim(),
        hourlyRateWaveCoin: form.rate,
        rank: form.rank.trim() || null,
        languages: form.languages,
        extraGameIds: (profile?.extraGameIds ?? []).filter((g) => g !== form.gameId),
      })
      setProfile(next)
      setStatus({ kind: 'success', text: 'პროფილი შენახულია.' })
      onSaved()
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'შენახვა ვერ მოხერხდა.') })
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return <div className="ce-panel">{status.text ? <p className="seller-status error" role="alert">{status.text}</p> : <p className="ce-hint">იტვირთება…</p>}</div>
  }

  return (
    <div className="ce-panel">
      <form className="stack-form" onSubmit={save}>
        <CoachFields form={form} setForm={setForm} games={games} />
        <label className="field">
          რანგი თამაშში <small>მაგ. Conqueror</small>
          <input maxLength={40} value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} />
        </label>
        {status.text && (
          <p className={`seller-status ${status.kind}`} role={status.kind === 'error' ? 'alert' : undefined}>
            {status.text}
          </p>
        )}
        <button className="button" type="submit" disabled={saving}>
          {saving ? 'ინახება…' : 'პროფილის შენახვა'}
        </button>
      </form>
      <CoachVideoEditor videoFileUrl={profile.videoFileUrl} onUpload={(file) => api.adminUploadCoachVideo(coachId, file)} onClear={() => api.adminClearCoachVideo(coachId)} />
      <CoachPackagesEditor initial={profile.packages} onSave={(list) => api.adminSetCoachPackages(coachId, list)} />
      <CoachHoursEditor initial={profile.availability} onSave={(availability) => api.adminUpdateCoachProfile(coachId, { availability })} />
      <CoachQuestionsEditor initial={profile.bookingQuestions} onSave={(bookingQuestions) => api.adminUpdateCoachProfile(coachId, { bookingQuestions })} />
    </div>
  )
}

const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  [VerificationStatus.NotVerified]: 'დაუდასტურებელი',
  [VerificationStatus.Pending]: 'განხილვაშია',
  [VerificationStatus.Verified]: 'დადასტურებულია',
  [VerificationStatus.Rejected]: 'უარყოფილია',
}

export default function AdminCoaches() {
  const [pending, setPending] = useState<AdminCoachSummary[]>([])
  const [all, setAll] = useState<AdminCoachSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [games, setGames] = useState<PublicGame[]>([])
  const [form, setForm] = useState<CoachForm>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Silent refresh (no loading state) so an open edit panel stays mounted.
  const reload = () => {
    Promise.all([api.adminListPendingCoaches(), api.adminListAllCoaches()])
      .then(([p, a]) => {
        setPending(p)
        setAll(a)
      })
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
  }

  useEffect(() => {
    api.listGames().then(setGames).catch(() => undefined)
  }, [])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setNotice('')
    const problem = validateCoachForm(form, true)
    if (problem) return setError(problem)
    setError('')
    setCreating(true)
    try {
      const coach = await api.adminCreateCoach({
        username: form.username.trim().replace(/^@/, ''),
        gameId: form.gameId || undefined,
        specialty: form.specialty.trim(),
        bio: form.bio.trim(),
        languages: form.languages,
        hourlyRateWaveCoin: form.rate,
      })
      setForm(EMPTY_FORM)
      setNotice(`@${coach.username} ახლა დადასტურებული ქოუჩია.`)
      setEditingId(coach.id)
      reload()
    } catch (err) {
      setError(errorMessage(err, 'ქოუჩის დამატება ვერ მოხერხდა.'))
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([api.adminListPendingCoaches(), api.adminListAllCoaches()])
      .then(([p, a]) => {
        if (cancelled) return
        setPending(p)
        setAll(a)
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

  const approve = async (id: string) => {
    setBusyId(id)
    try {
      await api.adminApproveCoach(id)
      reload()
    } catch (err) {
      setError(errorMessage(err, 'დამტკიცება ვერ მოხერხდა.'))
    } finally {
      setBusyId(null)
    }
  }

  const reject = async (id: string) => {
    const reason = window.prompt('უარყოფის მიზეზი:')
    if (!reason) return
    setBusyId(id)
    try {
      await api.adminRejectCoach(id, reason)
      reload()
    } catch (err) {
      setError(errorMessage(err, 'უარყოფა ვერ მოხერხდა.'))
    } finally {
      setBusyId(null)
    }
  }

  const toggleSuspend = async (coach: AdminCoachSummary) => {
    setBusyId(coach.id)
    try {
      if (coach.status === 'suspended') await api.adminRestoreCoach(coach.id)
      else await api.adminSuspendCoach(coach.id)
      reload()
    } catch (err) {
      setError(errorMessage(err, 'მოქმედება ვერ შესრულდა.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout title="მწვრთნელები">
      <h1 className="page-title">მწვრთნელები</h1>
      <p className="page-subtitle">ვერიფიკაციის მოთხოვნები და აქტიური მწვრთნელები</p>

      {error && <div className="status-text status-error" role="alert">{error}</div>}
      {notice && <div className="status-text status-success">{notice}</div>}

      <form className="stack-form" onSubmit={create}>
        <h2>ქოუჩის დამატება</h2>
        <p className="ce-hint">არსებული აქტიური ანგარიში ხდება დადასტურებული ქოუჩი. ვიდეო, პაკეტები და კითხვები ემატება შექმნის შემდეგ „რედაქტირებიდან“.</p>
        <label className="field">
          მომხმარებლის სახელი <small>WaveHub ანგარიში, მაგ. @player1</small>
          <input maxLength={60} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <CoachFields form={form} setForm={setForm} games={games} />
        <button className="button glow-on-hover" type="submit" disabled={creating}>
          {creating ? 'ემატება…' : 'ქოუჩის დამატება'}
        </button>
      </form>

      {loading ? (
        <div className="empty-state">იტვირთება…</div>
      ) : (
        <>
          <h2 style={{ fontSize: '1rem' }}>ვერიფიკაციის მოლოდინში</h2>
          {pending.length === 0 ? (
            <div className="empty-state">მოთხოვნები არ არის.</div>
          ) : (
            <div className="order-list" style={{ marginBottom: 32 }}>
              {pending.map((coach) => (
                <div key={coach.id} className="admin-row">
                  <div className="admin-row-main">
                    <strong>{coach.specialty}</strong>
                    <span className="note" style={{ margin: 0 }}>
                      @{coach.username} · {coach.gameName ?? 'ზოგადი'} · {coach.hourlyRateWaveCoin} GEL/სთ
                    </span>
                  </div>
                  <div className="admin-row-actions">
                    <button type="button" className="button" disabled={busyId === coach.id} onClick={() => approve(coach.id)}>
                      დამტკიცება
                    </button>
                    <button type="button" className="button" disabled={busyId === coach.id} onClick={() => reject(coach.id)}>
                      უარყოფა
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 style={{ fontSize: '1rem' }}>ყველა მწვრთნელი</h2>
          {all.length === 0 ? (
            <div className="empty-state">მწვრთნელები არ არის.</div>
          ) : (
            <div className="order-list">
              {all.map((coach) => (
                <div key={coach.id} className="ce-coach">
                  <div className="admin-row">
                    <div className="admin-row-main">
                      <strong>{coach.specialty}</strong>
                      <span className="note" style={{ margin: 0 }}>
                        @{coach.username} · {VERIFICATION_LABELS[coach.verificationStatus]} · {coach.status}
                      </span>
                    </div>
                    <div className="admin-row-actions">
                      <button type="button" className="button" aria-expanded={editingId === coach.id} onClick={() => setEditingId(editingId === coach.id ? null : coach.id)}>
                        {editingId === coach.id ? 'დახურვა' : 'რედაქტირება'}
                      </button>
                      {coach.verificationStatus === VerificationStatus.Verified && (
                        <button type="button" className="button" disabled={busyId === coach.id} onClick={() => toggleSuspend(coach)}>
                          {coach.status === 'suspended' ? 'აღდგენა' : 'შეჩერება'}
                        </button>
                      )}
                    </div>
                  </div>
                  {editingId === coach.id && <CoachEditPanel coachId={coach.id} games={games} onSaved={reload} />}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  )
}
