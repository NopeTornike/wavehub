/* eslint-disable @next/next/no-img-element */
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { AdminRewards, AdminRewardTask, RewardPeriod, RewardTrigger } from '@wavehub/shared-types'
import { REWARD_TRIGGERS } from '@wavehub/shared-types'
import AdminLayout from '../../components/AdminLayout'
import { api, errorMessage } from '../../lib/api'
import { kaDayMonth } from '../../lib/dates'

// Admin → User Hub rewards (owner 2026-11-10, round-6/02): write the daily tasks / achievements and
// their XP, set the 7-day streak bonus and the weekly prizes for places 1–3, see this week's top 10,
// mark prizes as handed over. Completion is always checked from real activity — staff choose WHAT
// counts (the trigger), never who completed it.

const TRIGGER_LABELS: Record<RewardTrigger, string> = {
  login: 'შესვლა საიტზე (დღეში ერთხელ)',
  visit_marketplace: 'მარკეტის გვერდის ნახვა',
  visit_tournaments: 'ტურნირების გვერდის ნახვა',
  visit_coaching: 'ქოუჩინგის გვერდის ნახვა',
  purchase: 'პროდუქტის ყიდვა (შეკვეთა)',
  topup: 'ბალანსის შევსება (BOG)',
  follow: 'ვინმეს Follow (გამყიდველი / ქოუჩი)',
  follow_coach: 'ქოუჩის Follow',
  review: 'შეფასების დაწერა',
  book_session: 'ქოუჩინგის სესიის დაჯავშნა',
  tournament_join: 'ტურნირზე რეგისტრაცია',
  list_item: 'განცხადების დამატება',
}

type Draft = { title: string; description: string; trigger: RewardTrigger; target: string; xp: string; period: RewardPeriod; isActive: boolean; sortOrder: string }
const EMPTY: Draft = { title: '', description: '', trigger: 'login', target: '1', xp: '50', period: 'daily', isActive: true, sortOrder: '0' }
const toDraft = (t: AdminRewardTask): Draft => ({
  title: t.title,
  description: t.description ?? '',
  trigger: t.trigger,
  target: String(t.target),
  xp: String(t.xp),
  period: t.period,
  isActive: t.isActive,
  sortOrder: String(t.sortOrder),
})
const int = (v: string, min: number) => Math.max(min, Math.floor(Number(v) || 0))
const payload = (d: Draft) => ({
  title: d.title.trim(),
  description: d.description.trim() || null,
  trigger: d.trigger,
  target: int(d.target, 1),
  xp: int(d.xp, 1),
  period: d.period,
  isActive: d.isActive,
  sortOrder: int(d.sortOrder, 0),
})

function TaskFields({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  return (
    <div className="stack-form-grid">
      <label className="field">
        სათაური (ჩანს მომხმარებელს)
        <input maxLength={80} value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} placeholder="Visit Marketplace" required />
      </label>
      <label className="field">
        ტიპი
        <select value={draft.period} onChange={(e) => onChange({ ...draft, period: e.target.value as RewardPeriod })}>
          <option value="daily">დღიური დავალება (ყოველდღე თავიდან)</option>
          <option value="once">მიღწევა (ერთხელ, სამუდამოდ)</option>
        </select>
      </label>
      <label className="field">
        რა ითვლება შესრულებად
        <select value={draft.trigger} onChange={(e) => onChange({ ...draft, trigger: e.target.value as RewardTrigger })}>
          {REWARD_TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {TRIGGER_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        რამდენჯერ ({draft.period === 'daily' ? 'ერთ დღეში' : 'სულ'})
        <input inputMode="numeric" value={draft.target} onChange={(e) => onChange({ ...draft, target: e.target.value.replace(/\D/g, '') })} />
      </label>
      <label className="field">
        XP
        <input inputMode="numeric" value={draft.xp} onChange={(e) => onChange({ ...draft, xp: e.target.value.replace(/\D/g, '') })} />
      </label>
      <label className="field">
        რიგი
        <input inputMode="numeric" value={draft.sortOrder} onChange={(e) => onChange({ ...draft, sortOrder: e.target.value.replace(/\D/g, '') })} />
      </label>
      <label className="field rw-wide">
        აღწერა (არასავალდებულო)
        <input maxLength={200} value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} />
      </label>
      <label className="rw-check">
        <input type="checkbox" checked={draft.isActive} onChange={(e) => onChange({ ...draft, isActive: e.target.checked })} /> აქტიური
      </label>
    </div>
  )
}

// Monday of the week before this one (Tbilisi), for the manual "settle last week" button.
function lastWeekStart(): string {
  const day = new Date(Date.now() + 4 * 3_600_000)
  const weekday = (day.getUTCDay() + 6) % 7
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - weekday - 7)).toISOString().slice(0, 10)
}

export default function AdminRewardsPage() {
  const [data, setData] = useState<AdminRewards | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY)
  const [prizeDrafts, setPrizeDrafts] = useState<Record<number, { title: string; description: string }>>({})
  const [bonus, setBonus] = useState('200')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [imageFor, setImageFor] = useState<number | null>(null)

  const load = useCallback(() => {
    api
      .adminGetRewards()
      .then((d) => {
        setData(d)
        setBonus(String(d.streakBonusXp))
        const drafts: Record<number, { title: string; description: string }> = {}
        for (const place of [1, 2, 3]) {
          const p = d.prizes.find((x) => x.place === place)
          drafts[place] = { title: p?.title ?? '', description: p?.description ?? '' }
        }
        setPrizeDrafts(drafts)
      })
      .catch((err) => setError(errorMessage(err, 'ჩატვირთვა ვერ მოხერხდა.')))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const run = async (label: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    setError('')
    setNote('')
    try {
      await fn()
      if (done) setNote(done)
      load()
    } catch (err) {
      setError(errorMessage(err, label))
    } finally {
      setBusy(false)
    }
  }

  const add = (event: FormEvent) => {
    event.preventDefault()
    void run('დამატება ვერ მოხერხდა.', async () => {
      await api.adminSaveRewardTask(payload(draft))
      setDraft({ ...EMPTY, period: draft.period })
    }, 'დავალება დაემატა ✓')
  }

  const saveEdit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    void run('შენახვა ვერ მოხერხდა.', async () => {
      await api.adminSaveRewardTask(payload(editDraft), editing)
      setEditing(null)
    }, 'შენახულია ✓')
  }

  const taskList = (rows: AdminRewardTask[], title: string) => (
    <section className="rw-section">
      <h2>
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="note">ჯერ არ არის.</p>
      ) : (
        rows.map((t) =>
          editing === t.id ? (
            <form key={t.id} className="stack-form" onSubmit={saveEdit}>
              <TaskFields draft={editDraft} onChange={setEditDraft} />
              <div className="admin-row-actions">
                <button type="submit" className="button" disabled={busy}>
                  შენახვა
                </button>
                <button type="button" className="button" onClick={() => setEditing(null)}>
                  გაუქმება
                </button>
              </div>
            </form>
          ) : (
            <div key={t.id} className={`admin-row rw-row${t.isActive ? '' : ' off'}`}>
              <b className="rw-xp">+{t.xp} XP</b>
              <div className="admin-row-main">
                <strong>{t.title}</strong>
                <span className="note" style={{ margin: 0 }}>
                  {TRIGGER_LABELS[t.trigger]}
                  {t.target > 1 ? ` × ${t.target}` : ''} · {t.isActive ? 'აქტიური' : 'გამორთული'} · შესრულდა {t.completions}-ჯერ
                </span>
              </div>
              <div className="admin-row-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setEditing(t.id)
                    setEditDraft(toDraft(t))
                  }}
                >
                  რედაქტირება
                </button>
                <button
                  type="button"
                  className="button danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('წავშალოთ დავალება? უკვე მიღებული XP დარჩება.')) void run('წაშლა ვერ მოხერხდა.', () => api.adminDeleteRewardTask(t.id), 'წაიშალა')
                  }}
                >
                  წაშლა
                </button>
              </div>
            </div>
          ),
        )
      )}
    </section>
  )

  return (
    <AdminLayout title="User Hub · ჯილდოები">
      <h1 className="page-title">User Hub · ჯილდოები</h1>
      <p className="page-subtitle">დავალებები და XP, 7 დღიანი Streak, კვირის Top 3 პრიზები. შესრულება ავტომატურად მოწმდება რეალური აქტივობით.</p>

      {error && (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      )}
      {note && <p className="status-text">{note}</p>}

      {!data ? (
        <p className="empty-state">იტვირთება…</p>
      ) : (
        <>
          <div className={`lb-admin-switch ${data.enabled ? 'on' : ''}`}>
            <span>
              <strong>{data.enabled ? 'User Hub ჩართულია' : 'User Hub გამორთულია'}</strong>
              <small>{data.enabled ? 'მენიუში ჩანს „User Hub“, XP ირიცხება.' : 'გვერდი და მენიუს ბმული დამალულია, XP არ ირიცხება.'}</small>
            </span>
            <button type="button" className="button" disabled={busy} onClick={() => void run('ვერ შეიცვალა.', () => api.adminSaveRewardSettings({ enabled: !data.enabled }))}>
              {data.enabled ? 'გამორთვა' : 'ჩართვა'}
            </button>
          </div>

          <form
            className="stack-form rw-inline"
            onSubmit={(e) => {
              e.preventDefault()
              void run('შენახვა ვერ მოხერხდა.', () => api.adminSaveRewardSettings({ streakBonusXp: int(bonus, 0) }), 'შენახულია ✓')
            }}
          >
            <label className="field">
              7 დღიანი Streak-ის ბონუსი (XP)
              <input inputMode="numeric" value={bonus} onChange={(e) => setBonus(e.target.value.replace(/\D/g, ''))} />
            </label>
            <button type="submit" className="button" disabled={busy}>
              შენახვა
            </button>
          </form>

          <form className="stack-form" onSubmit={add}>
            <h2>დავალების დამატება</h2>
            <TaskFields draft={draft} onChange={setDraft} />
            <div className="admin-row-actions">
              <button type="submit" className="button" disabled={busy || !draft.title.trim()}>
                დამატება
              </button>
            </div>
          </form>

          {taskList(
            data.tasks.filter((t) => t.period === 'daily'),
            'დღიური დავალებები',
          )}
          {taskList(
            data.tasks.filter((t) => t.period === 'once'),
            'მიღწევები (Achievements)',
          )}

          <section className="rw-section">
            <h2>კვირის პრიზები (Top 1 / 2 / 3)</h2>
            <p className="note">
              კვირა ორშაბათიდან კვირამდეა (თბილისის დროით). კვირის დასრულებისას Top 3 ავტომატურად იღებს ამ პრიზებს (ცარიელი ადგილი პრიზს არ გასცემს) და უხსნის ყუთს
              User Hub-ში. პრიზი ხელით გადაეცით და მონიშნეთ „გადაცემულია“.
            </p>
            <div className="rw-prizes">
              {[1, 2, 3].map((place) => {
                const saved = data.prizes.find((p) => p.place === place)
                const d = prizeDrafts[place] ?? { title: '', description: '' }
                return (
                  <form
                    key={place}
                    className="stack-form rw-prize"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void run('შენახვა ვერ მოხერხდა.', () => api.adminSaveRewardPrize(place, d.title, d.description.trim() || null), `${place} ადგილის პრიზი შენახულია ✓`)
                    }}
                  >
                    <h3>{place} ადგილი</h3>
                    {saved?.imageUrl && <img src={saved.imageUrl} alt="" />}
                    <label className="field">
                      პრიზი
                      <input maxLength={80} value={d.title} placeholder="მაგ. 50 GEL ბალანსი" onChange={(e) => setPrizeDrafts({ ...prizeDrafts, [place]: { ...d, title: e.target.value } })} />
                    </label>
                    <label className="field">
                      აღწერა
                      <input maxLength={300} value={d.description} onChange={(e) => setPrizeDrafts({ ...prizeDrafts, [place]: { ...d, description: e.target.value } })} />
                    </label>
                    <div className="admin-row-actions">
                      <button type="submit" className="button" disabled={busy}>
                        {d.title.trim() ? 'შენახვა' : 'პრიზის მოხსნა'}
                      </button>
                      {saved && (
                        <button
                          type="button"
                          className="button"
                          disabled={busy}
                          onClick={() => {
                            setImageFor(place)
                            fileRef.current?.click()
                          }}
                        >
                          ფოტო
                        </button>
                      )}
                    </div>
                  </form>
                )
              })}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                const place = imageFor
                e.target.value = ''
                if (file && place) void run('ფოტოს ატვირთვა ვერ მოხერხდა.', () => api.adminUploadRewardPrizeImage(place, file), 'ფოტო განახლდა ✓')
              }}
            />
          </section>

          <section className="rw-section">
            <h2>ამ კვირის Top 10</h2>
            {data.leaderboard.length === 0 ? (
              <p className="note">ამ კვირაში XP ჯერ არავის აქვს.</p>
            ) : (
              <ol className="rw-board">
                {data.leaderboard.map((r) => (
                  <li key={r.username}>
                    <b>#{r.place}</b> <a href={`/u/${r.username}`}>@{r.username}</a> <span>{r.xp.toLocaleString('en-US')} XP</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rw-section" id="winners">
            <h2>გამარჯვებულები</h2>
            <p className="note">ავტომატურად ფიქსირდება ყოველ საათში დასრულებული კვირისთვის.</p>
            <div className="admin-row-actions rw-actions">
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() =>
                  void run('ვერ შესრულდა.', async () => {
                    const r = await api.adminFinalizeRewardWeek(lastWeekStart())
                    setNote(r.created ? `დაფიქსირდა ${r.created} გამარჯვებული ✓` : 'გასული კვირა უკვე დაფიქსირებულია ან XP არავის აქვს.')
                  })
                }
              >
                გასული კვირის დაფიქსირება ახლავე
              </button>
            </div>
            {data.winners.length === 0 ? (
              <p className="note">ჯერ არავინ.</p>
            ) : (
              data.winners.map((w) => (
                <div key={w.id} className="admin-row rw-row">
                  <b className="rw-xp">Top {w.place}</b>
                  <div className="admin-row-main">
                    <strong>
                      <a href={`/u/${w.username}`}>
                        {[w.firstName, w.lastName].filter(Boolean).join(' ') || w.username} (@{w.username})
                      </a>
                    </strong>
                    <span className="note" style={{ margin: 0 }}>
                      {kaDayMonth(new Date(`${w.weekStart}T12:00:00Z`))}-ის კვირა · {w.xp.toLocaleString('en-US')} XP · {w.prize.title} · {w.openedAt ? 'ყუთი გახსნილია' : 'ყუთი ჯერ არ გაუხსნია'}
                    </span>
                  </div>
                  <div className="admin-row-actions">
                    <button type="button" className={`button${w.deliveredAt ? '' : ' primary'}`} disabled={busy} onClick={() => void run('ვერ შეიცვალა.', () => api.adminSetRewardDelivered(w.id, !w.deliveredAt))}>
                      {w.deliveredAt ? 'გადაცემულია ✓ (გაუქმება)' : 'გადაცემულია'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </AdminLayout>
  )
}
