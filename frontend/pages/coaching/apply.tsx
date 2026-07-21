import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicGame } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export default function ApplyAsCoach() {
  const router = useRouter()
  const { user, checked } = useAuth()

  const [games, setGames] = useState<PublicGame[]>([])
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

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.applyAsCoach({
        gameId: gameId || undefined,
        specialty,
        bio,
        hourlyRateWaveCoin: hourlyRate,
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'განაცხადის გაგზავნა ვერ მოხერხდა.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <div className="page">
        <div className="page-inner">
          <h1 className="page-title">გახდი მწვრთნელი</h1>
          <p className="page-subtitle">შეავსეთ განაცხადი — განიხილება ადმინისტრაციის მიერ</p>

          {submitted ? (
            <div className="status-text status-success">
              განაცხადი გაგზავნილია — ველოდებით ვერიფიკაციას.
            </div>
          ) : (
            <form className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={submit}>
              {error && <div className="status-text status-error">{error}</div>}
              <div className="form-group">
                <label htmlFor="game">ძირითადი თამაში</label>
                <select id="game" className="input" value={gameId} onChange={(e) => setGameId(e.target.value)}>
                  <option value="">— აირჩიეთ —</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="specialty">სპეციალობა</label>
                <input
                  id="specialty"
                  className="input"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  required
                  minLength={3}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bio">ბიოგრაფია (მინიმუმ 20 სიმბოლო)</label>
                <textarea id="bio" className="input" value={bio} onChange={(e) => setBio(e.target.value)} required minLength={20} />
              </div>
              <div className="form-group">
                <label htmlFor="rate">ფასი საათში (WC)</label>
                <input
                  id="rate"
                  className="input"
                  type="number"
                  min={1}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  required
                />
              </div>
              <button type="submit" className="button glow-on-hover" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
                განაცხადის გაგზავნა
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  )
}
