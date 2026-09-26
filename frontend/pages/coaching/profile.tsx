import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import type { MyCoachProfile, PublicGame } from '@wavehub/shared-types'
import { VerificationStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'

// A coach editing the content of their public profile (docs/design-mockups/14): specialty, bio,
// rate, rank, languages, main + extra games, intro video, quote and coaching-style points. Mirrors
// UpdateCoachProfileDto's bounds. The photo is the account avatar (Settings).

const LANGUAGE_OPTIONS: Array<[string, string]> = [
  ['ka', 'ქართული'],
  ['en', 'English'],
  ['ru', 'Русский'],
  ['tr', 'Türkçe'],
  ['de', 'Deutsch'],
  ['uk', 'Українська'],
]
const VIDEO_URL = /^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\/\S+$/

export default function CoachProfileEditor() {
  const router = useRouter()
  const { user, checked } = useAuth()
  const userId = user?.id
  const [games, setGames] = useState<PublicGame[]>([])
  const [profile, setProfile] = useState<MyCoachProfile | null>(null)
  const [missing, setMissing] = useState(false)
  const [form, setForm] = useState({ gameId: '', specialty: '', bio: '', rate: 10, rank: '', videoUrl: '', quote: '', style: '', languages: [] as string[], extraGameIds: [] as string[] })
  const [status, setStatus] = useState<{ kind: '' | 'error' | 'success'; text: string }>({ kind: '', text: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (checked && !user) router.replace('/login?next=/coaching/profile')
  }, [checked, user, router])

  useEffect(() => {
    api.listGames().then(setGames).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!userId) return
    api
      .getMyCoachProfile()
      .then((p) => {
        setProfile(p)
        setForm({
          gameId: p.gameId ?? '',
          specialty: p.specialty,
          bio: p.bio,
          rate: p.hourlyRateWaveCoin,
          rank: p.rank ?? '',
          videoUrl: p.videoUrl ?? '',
          quote: p.quote ?? '',
          style: p.coachingStyle.join('\n'),
          languages: p.languages,
          extraGameIds: p.extraGameIds,
        })
      })
      .catch(() => setMissing(true))
  }, [userId])

  const toggle = (key: 'languages' | 'extraGameIds', value: string, max: number) =>
    setForm((f) => {
      const list = f[key]
      if (list.includes(value)) return { ...f, [key]: list.filter((v) => v !== value) }
      return list.length >= max ? f : { ...f, [key]: [...list, value] }
    })

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const style = form.style
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (form.specialty.trim().length < 3) return setStatus({ kind: 'error', text: 'სპეციალობა: მინიმუმ 3 სიმბოლო.' })
    if (form.bio.trim().length < 20) return setStatus({ kind: 'error', text: 'ბიოგრაფია: მინიმუმ 20 სიმბოლო.' })
    if (!Number.isInteger(form.rate) || form.rate < 1) return setStatus({ kind: 'error', text: 'ფასი: მთელი რიცხვი, მინიმუმ 1 GEL.' })
    if (form.videoUrl.trim() && !VIDEO_URL.test(form.videoUrl.trim())) return setStatus({ kind: 'error', text: 'ვიდეო უნდა იყოს YouTube ან Vimeo ბმული (https://...).' })
    if (style.length > 6 || style.some((l) => l.length < 2 || l.length > 60)) return setStatus({ kind: 'error', text: 'სტილი: მაქს. 6 პუნქტი, თითო 2–60 სიმბოლო.' })
    setSaving(true)
    try {
      const next = await api.updateMyCoachProfile({
        gameId: form.gameId || null,
        specialty: form.specialty.trim(),
        bio: form.bio.trim(),
        hourlyRateWaveCoin: form.rate,
        rank: form.rank.trim() || null,
        videoUrl: form.videoUrl.trim() || null,
        quote: form.quote.trim() || null,
        coachingStyle: style,
        languages: form.languages,
        extraGameIds: form.extraGameIds.filter((g) => g !== form.gameId),
      })
      setProfile(next)
      setStatus({ kind: 'success', text: 'პროფილი შენახულია.' })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err, 'შენახვა ვერ მოხერხდა.') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout title="ქოუჩის პროფილი" noIndex>
      <div className="coaching-body">
        <div className="coach-profile-shell">
          <Link className="coach-profile-back" href="/coaching">
            <span aria-hidden="true">&lt;</span> ქოუჩინგი
          </Link>
          <div className="coach-heading-row">
            <div>
              <h1>ჩემი ქოუჩის პროფილი</h1>
              <p>
                ეს ინფორმაცია ჩანს შენს საჯარო პროფილზე. ფოტოს შეცვლა — <Link href="/profile">პარამეტრებში</Link>.
                {profile?.verificationStatus === VerificationStatus.Verified && (
                  <>
                    {' '}
                    · <Link href={`/coaching/${profile.id}`}>საჯარო პროფილის ნახვა</Link>
                  </>
                )}
              </p>
            </div>
          </div>
          {missing ? (
            <div className="coach-info-card coach-apply-card">
              <p>
                ქოუჩის პროფილი ჯერ არ გაქვს. <Link href="/coaching/apply">გახდი ქოუჩი</Link>
              </p>
            </div>
          ) : (
            <form className="coach-info-card coach-apply-card stack-form" onSubmit={save}>
              <div className="stack-form-grid">
                <label className="field">
                  სპეციალობა
                  <input maxLength={200} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
                </label>
                <label className="field">
                  რანგი თამაშში <small>მაგ. Conqueror</small>
                  <input maxLength={40} value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} />
                </label>
                <label className="field">
                  ძირითადი თამაში
                  <select value={form.gameId} onChange={(e) => setForm({ ...form, gameId: e.target.value })}>
                    <option value="">—</option>
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  საათობრივი ფასი (GEL)
                  <input type="number" min={1} step={1} value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} />
                </label>
              </div>
              <label className="field">
                ბიოგრაფია
                <textarea rows={4} maxLength={3000} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </label>
              <fieldset className="field">
                <legend>სხვა თამაშები (მაქს. 4)</legend>
                <div className="wc-chips">
                  {games
                    .filter((g) => g.id !== form.gameId)
                    .map((g) => (
                      <button key={g.id} type="button" className={form.extraGameIds.includes(g.id) ? 'active' : undefined} aria-pressed={form.extraGameIds.includes(g.id)} onClick={() => toggle('extraGameIds', g.id, 4)}>
                        {g.name}
                      </button>
                    ))}
                </div>
              </fieldset>
              <fieldset className="field">
                <legend>ენები</legend>
                <div className="wc-chips">
                  {LANGUAGE_OPTIONS.map(([code, label]) => (
                    <button key={code} type="button" className={form.languages.includes(code) ? 'active' : undefined} aria-pressed={form.languages.includes(code)} onClick={() => toggle('languages', code, 6)}>
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="field">
                გაცნობითი ვიდეო <small>YouTube / Vimeo ბმული</small>
                <input type="url" maxLength={300} value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
              </label>
              <label className="field">
                ციტატა <small>„გაიცანი შენი ქოუჩი“ ბარათისთვის</small>
                <textarea rows={2} maxLength={300} value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} />
              </label>
              <label className="field">
                ქოუჩინგის სტილი <small>თითო პუნქტი ცალკე ხაზზე (მაქს. 6)</small>
                <textarea rows={4} value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} />
              </label>
              {status.text && (
                <p className={`seller-status ${status.kind}`} role={status.kind === 'error' ? 'alert' : undefined}>
                  {status.text}
                </p>
              )}
              <button className="coach-book-primary" type="submit" disabled={saving || !profile}>
                {saving ? 'ინახება…' : 'შენახვა'}
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  )
}
