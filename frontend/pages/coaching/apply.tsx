import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicGame } from '@wavehub/shared-types'
import { VerificationStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage, type MyCoachApplication } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export default function ApplyAsCoach() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const userId = user?.id

  const [games, setGames] = useState<PublicGame[]>([])
  const [existing, setExisting] = useState<MyCoachApplication | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [gameId, setGameId] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [bio, setBio] = useState('')
  const [hourlyRate, setHourlyRate] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (checked && !user) {
      router.push('/login?next=/coaching/apply')
    }
  }, [checked, user, router])

  useEffect(() => {
    api.listGames().then(setGames).catch(() => undefined)
  }, [])

  // An existing application decides what this page shows: pending/verified → status only (the
  // backend rejects re-applying in those states), rejected → the reason plus the form again.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    api
      .getMyCoachApplication()
      .then((row) => {
        if (!cancelled) setExisting(row)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingExisting(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    // Mirrors ApplyCoachDto (specialty 3–200, bio 20–3000, integer rate >= 1).
    if (specialty.trim().length < 3) return setError('სპეციალობა უნდა იყოს მინიმუმ 3 სიმბოლო.')
    if (bio.trim().length < 20) return setError('ბიოგრაფია უნდა იყოს მინიმუმ 20 სიმბოლო.')
    if (!Number.isInteger(hourlyRate) || hourlyRate < 1) return setError('საათობრივი ფასი უნდა იყოს მთელი რიცხვი, მინიმუმ 1 WC.')
    setSubmitting(true)
    try {
      await api.applyAsCoach({
        gameId: gameId || undefined,
        specialty: specialty.trim(),
        bio: bio.trim(),
        hourlyRateWaveCoin: hourlyRate,
      })
      setSubmitted(true)
    } catch (err) {
      setError(errorMessage(err, 'განაცხადის გაგზავნა ვერ მოხერხდა.'))
    } finally {
      setSubmitting(false)
    }
  }

  const status = existing?.verificationStatus
  const showForm = !submitted && (status === undefined || status === VerificationStatus.Rejected || status === VerificationStatus.NotVerified)

  return (
    <Layout title="გახდი მწვრთნელი" description="გახდით ვერიფიცირებული მწვრთნელი WaveHub-ზე და გაყიდეთ სესიები." noIndex>
      <div className="page">
        <div className="page-inner">
          <h1 className="page-title">გახდი მწვრთნელი</h1>
          <p className="page-subtitle">შეავსეთ განაცხადი — განიხილება ადმინისტრაციის მიერ</p>

          {!user || loadingExisting ? (
            <div className="empty-state">იტვირთება…</div>
          ) : (
            <>
              {(submitted || status === VerificationStatus.Pending) && (
                <div className="status-text status-success" role="status">
                  განაცხადი გაგზავნილია — ველოდებით ვერიფიკაციას.
                </div>
              )}
              {status === VerificationStatus.Verified && !submitted && (
                <div className="status-text status-success" role="status">
                  თქვენ უკვე ვერიფიცირებული მწვრთნელი ხართ. სესიებს იხილავთ გვერდზე „ჩემი სესიები“.
                </div>
              )}
              {status === VerificationStatus.Rejected && !submitted && (
                <div className="status-text status-error" role="status">
                  წინა განაცხადი უარყოფილია{existing?.rejectionReason ? `: ${existing.rejectionReason}` : ''}. შეგიძლიათ შეასწოროთ და თავიდან გააგზავნოთ.
                </div>
              )}

              {showForm && (
                <form className="stack-form" style={{ marginTop: 16 }} onSubmit={submit}>
                  {error && (
                    <div className="status-text status-error" role="alert">
                      {error}
                    </div>
                  )}
                  <label className="field">
                    ძირითადი თამაში
                    <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
                      <option value="">— აირჩიეთ —</option>
                      {games.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    სპეციალობა
                    <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} required minLength={3} maxLength={200} />
                  </label>
                  <label className="field">
                    ბიოგრაფია <small>მინიმუმ 20 სიმბოლო ({bio.trim().length}/20)</small>
                    <textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} required minLength={20} maxLength={3000} />
                  </label>
                  <label className="field">
                    ფასი საათში (WC)
                    <input type="number" min={1} step={1} value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} required />
                  </label>
                  <button type="submit" className="button glow-on-hover" disabled={submitting}>
                    {submitting ? 'იგზავნება…' : 'განაცხადის გაგზავნა'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
