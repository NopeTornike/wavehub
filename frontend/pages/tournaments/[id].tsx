import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type CSSProperties } from 'react'
import type { MyTournamentEntry, PublicTournamentMatch, PublicTournamentSummary, PublicTournamentTeam, TournamentPlayerLookup } from '@wavehub/shared-types'
import { TOURNAMENT_DETAIL_KEYS, TournamentStatus, TournamentTeamStatus } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useShell } from '../../lib/shell'
import { formatDay, TIcon, TOURNAMENT_BADGE, tournamentCover, tournamentFormat } from '../../lib/tournaments'
import { PHOTO_SOURCE_MAX_BYTES } from '../../lib/image-resize'

// docs/design-mockups 01 (Prize Pool), 03 (General), 11 (Teams), 13 (Rules): hero with the WAVEHUBX
// mark and slogan, the five-fact summary, the four tabs, the Ready-to-Compete bar and the
// Other Tournaments carousel. All real: facts/prizes/rules are what tournament staff entered
// (unset facts say "To be announced"), teams are the real registrations (squad captains register a
// roster; staff verify it), counts come from the API. Solo tournaments register in one click;
// squad tournaments open the team form. Matches, once staff record them, are one click away.

type Tab = 'general' | 'prize' | 'rules' | 'teams'

const FACTS: Array<[key: string, icon: string]> = [
  ['format', 'users'],
  ['mode', 'crosshair'],
  ['region', 'globe'],
  ['platform', 'gamepad'],
  ['checkInTime', 'clock'],
  ['startTime', 'clock'],
  ['registrationDeadline', 'calendar'],
  ['entryFee', 'shield'],
]
const INFO_KEYS = ['teamSize', 'minimumRank', 'bracketType', 'matches', 'whoCanJoin', 'communication']
const LABEL = Object.fromEntries(TOURNAMENT_DETAIL_KEYS.map(([k, l]) => [k, l]))
const TBA = 'To be announced'

// "Title: description" per line (docs/design-mockups/13); a line without a colon is a description.
function parseRules(text: string | null): Array<{ title: string; description: string }> {
  return (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const at = line.indexOf(':')
      return at > 0 && at <= 60 ? { title: line.slice(0, at).trim(), description: line.slice(at + 1).trim() } : { title: `Rule ${index + 1}`, description: line }
    })
}

function Fact({ label, value, icon }: { label: string; value?: string; icon?: string }) {
  return (
    <p className={icon ? 'prejoin-fact' : undefined}>
      {icon && <TIcon name={icon} />}
      <span>
        <small>{label}</small>
        <strong>{value || TBA}</strong>
      </span>
    </p>
  )
}

function SummaryCell({ icon, label, value, sub, tone }: { icon: string; label: string; value: ReactNode; sub?: string; tone?: string }) {
  return (
    <div>
      <TIcon name={icon} />
      <p>
        <span>
          <small>{label}</small>
          <strong className={tone}>{value}</strong>
          {sub && <em className="wt-sub">{sub}</em>}
        </span>
      </p>
    </div>
  )
}

// Mirrors the backend's DISCORD_CONTACT: an invite link or a Discord username.
const DISCORD_CONTACT = /^(https:\/\/(discord\.gg|(www\.)?discord\.com\/invite)\/[A-Za-z0-9-]{2,40}|[a-z0-9_.]{2,32})$/

type PlayerRow = { player: string; inGameName: string; inGameId: string; account: TournamentPlayerLookup | null; checking: boolean; problem: string }
const IN_GAME_ID = /^[\p{L}\p{N}#_.:\- ]{2,40}$/u

// Registration form for every tournament (no one-click sign-up): each player gives their in-game
// name and in-game ID. Squads: the captain (the signed-in user, always player 1) adds teammates by
// WaveHub username or account ID; each one is looked up and shown with their profile photo before
// the team is sent, and gets a notification once registered.
function RegistrationModal({
  tournament,
  me,
  onClose,
  onDone,
}: {
  tournament: PublicTournamentSummary
  me: { id: string; username: string; avatarUrl?: string | null }
  onClose: () => void
  onDone: () => void
}) {
  const squad = tournament.teamSize > 1
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [coach, setCoach] = useState('')
  // Discord invite link or username (client feedback #6) — how staff reach the team/player.
  const [discord, setDiscord] = useState('')
  const [rows, setRows] = useState<PlayerRow[]>(() =>
    Array.from({ length: tournament.teamSize }, (_, i) => ({
      player: i === 0 ? me.username : '',
      inGameName: '',
      inGameId: '',
      account: i === 0 ? { id: me.id, username: me.username, avatarUrl: me.avatarUrl ?? null } : null,
      checking: false,
      problem: '',
    })),
  )
  const [logo, setLogo] = useState<File | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const patchRow = (index: number, patch: Partial<PlayerRow>) => setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const lookup = async (index: number) => {
    const query = rows[index].player.trim().replace(/^@/, '')
    if (!query) return patchRow(index, { account: null, problem: '' })
    if (rows[index].account && rows[index].account?.username.toLowerCase() === query.toLowerCase()) return
    patchRow(index, { checking: true, problem: '', account: null })
    try {
      const account = await api.lookupTournamentPlayer(query)
      const duplicate = rows.some((row, i) => i !== index && row.account?.id === account.id)
      patchRow(index, { checking: false, account: duplicate ? null : account, problem: duplicate ? 'ეს მოთამაშე უკვე დამატებულია.' : '' })
    } catch {
      patchRow(index, { checking: false, account: null, problem: 'WaveHub-ის აქტიური ანგარიში ვერ მოიძებნა.' })
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const players = rows.map((row) => ({ ...row, inGameName: row.inGameName.trim(), inGameId: row.inGameId.trim() }))
    if (players.some((p) => !p.inGameName)) return setError('შეიყვანეთ ყველა მოთამაშის თამაშის სახელი.')
    if (players.some((p) => !IN_GAME_ID.test(p.inGameId))) return setError('თამაშის ID: 2–40 სიმბოლო (ასოები, ციფრები, #, -, _, ., :).')
    if (new Set(players.map((p) => p.inGameName.toLowerCase())).size !== players.length) return setError('მოთამაშეების სახელები არ უნდა მეორდებოდეს.')
    if (squad) {
      if (players.some((p) => !p.account)) return setError('დაამატეთ და შეამოწმეთ ყველა თანაგუნდელის WaveHub ანგარიში.')
      if (tag && !/^[A-Za-z0-9]{1,6}$/.test(tag)) return setError('ტეგი: 1–6 ლათინური ასო ან ციფრი.')
      if (logo && (!['image/png', 'image/jpeg', 'image/webp'].includes(logo.type) || logo.size > PHOTO_SOURCE_MAX_BYTES)) {
        return setError('ლოგო: JPG, PNG ან WEBP, მაქსიმუმ 20MB — ავტომატურად მცირდება 2MB-მდე.')
      }
    }
    if (!DISCORD_CONTACT.test(discord.trim())) return setError('Discord: ჩაწერეთ მოსაწვევი ბმული (https://discord.gg/…) ან Discord-ის მომხმარებლის სახელი.')
    if (!agreed) return setError('დაეთანხმეთ ტურნირის წესებს.')
    setBusy(true)
    try {
      if (squad) {
        await api.registerTournamentTeam(tournament.id, {
          name: name.trim(),
          discord: discord.trim(),
          tag: tag.trim() || undefined,
          coachName: coach.trim() || undefined,
          players: players.map((p) => ({ player: p.account!.id, inGameName: p.inGameName, inGameId: p.inGameId })),
        })
        if (logo) await api.uploadMyTeamLogo(tournament.id, logo).catch(() => undefined)
      } else {
        await api.registerForTournament(tournament.id, { inGameName: players[0].inGameName, inGameId: players[0].inGameId, discord: discord.trim() })
      }
      onDone()
    } catch (err) {
      setError(errorMessage(err, 'რეგისტრაცია ვერ მოხერხდა.'))
      setBusy(false)
    }
  }

  return (
    <div className="seller-modal" role="dialog" aria-modal="true" aria-labelledby="teamModalTitle">
      <div className="seller-modal-panel listing-builder-panel">
        <div className="seller-modal-head">
          <div>
            <p className="section-kicker">{tournament.name}</p>
            <h2 id="teamModalTitle">{squad ? 'გუნდის რეგისტრაცია' : 'რეგისტრაცია'}</h2>
          </div>
          <button className="seller-close-button" type="button" aria-label="დახურვა" onClick={onClose}>
            x
          </button>
        </div>
        <form className="seller-form listing-builder-form" onSubmit={submit}>
          {squad && (
            <section className="listing-builder-section">
              <h3>გუნდი</h3>
              <div className="listing-builder-grid">
                <label>
                  <span>გუნდის სახელი *</span>
                  <input required minLength={2} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label>
                  <span>ტეგი (მაგ. WRD)</span>
                  <input maxLength={6} value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} />
                </label>
                <label>
                  <span>ქოუჩი (არასავალდებულო)</span>
                  <input maxLength={30} value={coach} onChange={(e) => setCoach(e.target.value)} />
                </label>
                <label>
                  <span>ლოგო (არასავალდებულო)</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </section>
          )}
          <section className="listing-builder-section">
            <h3>Discord</h3>
            <label className="tr-discord-field">
              <span>{squad ? 'გუნდის Discord — მოსაწვევი ბმული ან კაპიტნის username *' : 'შენი Discord — username ან მოსაწვევი ბმული *'}</span>
              <input required maxLength={120} value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="https://discord.gg/… ან username" autoComplete="off" />
              <small>ადმინისტრაცია ამ Discord-ით დაგიკავშირდებათ ტურნირის დეტალებზე.</small>
            </label>
          </section>
          <section className="listing-builder-section">
            <h3>{squad ? `მოთამაშეები (${tournament.teamSize})` : 'მოთამაშე'}</h3>
            {squad && <p className="tr-hint">დაამატეთ თანაგუნდელები WaveHub-ის მომხმარებლის სახელით ან ID-ით — მათი პროფილი ავტომატურად დაემატება გუნდს.</p>}
            <div className="tr-players">
              {rows.map((row, index) => (
                <div key={index} className="tr-player">
                  <div className="tr-player-account">
                    {index === 0 ? (
                      <span className="tr-player-label">{squad ? 'კაპიტანი (შენ)' : 'შენი ანგარიში'}</span>
                    ) : (
                      <label>
                        <span>მოთამაშე {index + 1} — WaveHub username ან ID *</span>
                        <span className="tr-lookup">
                          <input
                            value={row.player}
                            maxLength={60}
                            placeholder="@username"
                            onChange={(e) => patchRow(index, { player: e.target.value, account: null, problem: '' })}
                            onBlur={() => void lookup(index)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                void lookup(index)
                              }
                            }}
                          />
                          <button type="button" className="secondary-seller-action" disabled={row.checking || !row.player.trim()} onClick={() => void lookup(index)}>
                            {row.checking ? '…' : 'შემოწმება'}
                          </button>
                        </span>
                      </label>
                    )}
                    {row.account && (
                      <a className="tr-account" href={`/u/${encodeURIComponent(row.account.username)}`} target="_blank" rel="noreferrer">
                        <i style={row.account.avatarUrl ? { backgroundImage: `url("${row.account.avatarUrl}")` } : undefined}>
                          {row.account.avatarUrl ? '' : row.account.username.slice(0, 1).toUpperCase()}
                        </i>
                        <span>@{row.account.username}</span>
                        <b>✓</b>
                      </a>
                    )}
                    {row.problem && <small className="tr-problem">{row.problem}</small>}
                  </div>
                  <label>
                    <span>თამაშის სახელი (nickname) *</span>
                    <input required maxLength={30} value={row.inGameName} onChange={(e) => patchRow(index, { inGameName: e.target.value })} />
                  </label>
                  <label>
                    <span>თამაშის ID *</span>
                    <input required maxLength={40} inputMode="text" value={row.inGameId} onChange={(e) => patchRow(index, { inGameId: e.target.value })} />
                  </label>
                </div>
              ))}
            </div>
            <label className="tr-agree">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>ვეთანხმები ტურნირის წესებს{squad ? ' და ვადასტურებ, რომ თანაგუნდელები თანახმა არიან მონაწილეობაზე' : ''}.</span>
            </label>
            <p className="seller-status">
              {squad ? 'გუნდი დადასტურდება ტურნირის ადმინისტრაციის მიერ. ' : ''}თამაშის ID-ს ხედავს მხოლოდ ადმინისტრაცია და შენი გუნდი.
            </p>
            {error && (
              <p className="seller-status error" role="alert">
                {error}
              </p>
            )}
          </section>
          <div className="seller-modal-actions listing-builder-actions">
            <button className="secondary-seller-action" type="button" onClick={onClose}>
              გაუქმება
            </button>
            <button className="seller-submit-button" type="submit" disabled={busy}>
              {busy ? 'იგზავნება…' : squad ? 'გუნდის რეგისტრაცია' : 'რეგისტრაცია'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TournamentDetail() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { user: me } = useAuth()
  const { games } = useShell()
  const meId = me?.id
  const [tournament, setTournament] = useState<PublicTournamentSummary | null>(null)
  const [teams, setTeams] = useState<PublicTournamentTeam[]>([])
  const [matches, setMatches] = useState<PublicTournamentMatch[]>([])
  const [others, setOthers] = useState<PublicTournamentSummary[]>([])
  const [mine, setMine] = useState<MyTournamentEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('general')
  const [teamQuery, setTeamQuery] = useState('')
  const [teamSort, setTeamSort] = useState<'verified' | 'name'>('verified')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [teamModal, setTeamModal] = useState(false)
  const carousel = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    if (!id) return
    Promise.all([
      api.getTournament(id),
      api.listTournamentTeams(id).catch(() => []),
      api.listTournamentMatches(id).catch(() => []),
      meId ? api.listMyTournaments().catch(() => []) : Promise.resolve<MyTournamentEntry[]>([]),
    ])
      .then(([data, teamRows, matchRows, myRows]) => {
        setTournament(data)
        setTeams(teamRows)
        setMatches(matchRows)
        setMine(myRows.find((row) => row.tournament.id === id) ?? null)
        setError('')
      })
      .catch((err) => setError(errorMessage(err, 'ტურნირი ვერ მოიძებნა.')))
      .finally(() => setLoading(false))
  }, [id, meId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api
      .browseTournaments({ limit: 12 })
      .then((res) => setOthers(res.items.filter((t) => t.id !== id)))
      .catch(() => undefined)
  }, [id])

  const slugById = useMemo(() => new Map(games.map((g) => [g.gameId, g.slug])), [games])

  if (loading || error || !tournament) {
    return (
      <Layout title="ტურნირი" noIndex={!loading}>
        <section className="tournament-results-page">
          {loading ? (
            <div className="marketplace-empty">იტვირთება…</div>
          ) : (
            <div className="wt-empty">
              <TIcon name="trophy" />
              <strong>ტურნირი ვერ მოიძებნა</strong>
              <p>
                {error || 'შესაძლოა ტურნირი წაშლილია.'} <Link href="/tournaments">ყველა ტურნირი</Link>
              </p>
            </div>
          )}
        </section>
      </Layout>
    )
  }

  const t = tournament
  const details = t.details ?? {}
  const entryFee = details.entryFee || 'უფასო'
  const squad = t.teamSize > 1
  const captain = Boolean(mine && me && mine.team.captainUsername === me.username)
  const full = t.registeredCount + t.teamSize > t.maxPlayers
  const open = t.status === TournamentStatus.Open
  const editable = t.status === TournamentStatus.Open || t.status === TournamentStatus.Upcoming
  const cover = tournamentCover(t, slugById) ?? '/assets/pubg-photo.jpeg'
  const [statusLabel] = TOURNAMENT_BADGE[t.status]
  const spotsLeft = Math.max(0, t.maxPlayers - t.registeredCount)
  const rules = parseRules(t.rules)
  const prizes = t.prizes ?? { places: [], specialRewards: [], note: null }

  const register = () => {
    if (!me) {
      router.push(`/login?next=/tournaments/${t.id}`)
      return
    }
    setActionError('')
    setTeamModal(true)
  }

  const withdraw = async () => {
    if (!window.confirm('ნამდვილად გსურთ ტურნირიდან გასვლა?')) return
    setBusy(true)
    setActionError('')
    try {
      await api.withdrawFromTournament(t.id)
      load()
    } catch (err) {
      setActionError(errorMessage(err, 'გასვლა ვერ მოხერხდა.'))
    } finally {
      setBusy(false)
    }
  }

  const q = teamQuery.trim().toLowerCase()
  const shownTeams = teams
    .filter((team) => !q || [team.name, team.tag, team.captainUsername, team.coachName, ...team.members].filter(Boolean).join(' ').toLowerCase().includes(q))
    .sort((a, b) =>
      teamSort === 'name'
        ? a.name.localeCompare(b.name)
        : Number(b.status === TournamentTeamStatus.Verified) - Number(a.status === TournamentTeamStatus.Verified) || a.createdAt.localeCompare(b.createdAt),
    )

  let registerButton: ReactNode
  if (mine) {
    registerButton = (
      <Link id="tdRegisterNow" className="wt-register-link" href="/tournaments/hub">
        {mine.team.status === TournamentTeamStatus.Pending ? 'მოლოდინში — ჰაბი' : 'დარეგისტრირებული ✓'} <TIcon name="chevron" />
      </Link>
    )
  } else {
    registerButton = (
      <button id="tdRegisterNow" type="button" disabled={busy || full || !open} onClick={register}>
        {busy
          ? 'იგზავნება…'
          : full
            ? 'ადგილები ამოიწურა'
            : !open
              ? t.status === TournamentStatus.Upcoming
                ? 'რეგისტრაცია მალე'
                : 'რეგისტრაცია დახურულია'
              : squad
                ? 'გუნდის რეგისტრაცია'
                : 'რეგისტრაცია'}
        {open && !full && <TIcon name="chevron" />}
      </button>
    )
  }

  const scrollOthers = (dir: 1 | -1) => carousel.current?.scrollBy({ left: dir * carousel.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <Layout title={t.name} description={`${t.gameName} — ${t.description}`.slice(0, 200)}>
      <section className="tournament-results-page wt-page" id="tournamentDetailPage">
        <section className="prejoin-page">
          {/* An uploaded cover is shown as-is (staff design it, often with its own text); the
              title then sits under it. Only the fallback game art gets the overlaid title. */}
          {t.coverImageUrl ? (
            <>
              <header className="prejoin-hero wt-hero has-photo" style={{ backgroundImage: `url('${cover}')` }} aria-hidden="true"></header>
              <div className="wt-hero-title">
                <h1>{t.name}</h1>
                {details.slogan && <strong>{details.slogan}</strong>}
              </div>
            </>
          ) : (
            <header className="prejoin-hero wt-hero" style={{ backgroundImage: `linear-gradient(180deg,rgba(2,6,14,.05),rgba(2,6,14,.55)),url('${cover}')` }}>
              <div>
                <span className="wt-hero-brand">WAVEHUBX</span>
                <h1>{t.name}</h1>
                <strong>{details.slogan || 'COMPETE. IMPROVE. WIN.'}</strong>
              </div>
            </header>
          )}

          <section className="prejoin-summary">
            <SummaryCell
              icon="user"
              label="რეგისტრაცია"
              value={statusLabel.toUpperCase()}
              tone={open ? 'open' : undefined}
              sub={details.registrationDeadline ? `ბოლო ვადა: ${details.registrationDeadline}` : undefined}
            />
            <SummaryCell icon="calendar" label="ტურნირის თარიღი" value={formatDay(t.startDate)} sub={details.startTime || undefined} />
            <SummaryCell
              icon="users"
              label={squad ? 'გუნდები' : 'მოთამაშეები'}
              value={squad ? `${t.teamCount} / ${t.maxTeams}` : `${t.registeredCount} / ${t.maxPlayers}`}
              sub="დარეგისტრირებული"
            />
            <SummaryCell icon="trophy" label="საპრიზო ფონდი" value={t.prize} tone="pink" />
            <SummaryCell icon="shield" label="შესვლის საფასური" value={entryFee} tone="pink" />
          </section>

          <section className="prejoin-details">
            <nav aria-label="ტურნირის განყოფილებები">
              {(
                [
                  ['general', 'info', 'ზოგადი'],
                  ['prize', 'trophy', 'საპრიზო ფონდი'],
                  ['rules', 'layers', 'წესები'],
                  ['teams', 'users', squad ? 'გუნდები' : 'მოთამაშეები'],
                ] as const
              ).map(([key, icon, label]) => (
                <button key={key} type="button" className={tab === key ? 'active' : undefined} aria-pressed={tab === key} onClick={() => setTab(key)}>
                  <TIcon name={icon} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>

            <div className="prejoin-grid">
              {tab === 'general' && (
                <>
                  <div className="prejoin-facts">
                    {FACTS.map(([key, icon]) => (
                      <Fact key={key} label={LABEL[key]} value={key === 'entryFee' ? entryFee : key === 'format' ? tournamentFormat(t) : details[key]} icon={icon} />
                    ))}
                  </div>
                  <div className="prejoin-about">
                    <h2>ტურნირის შესახებ</h2>
                    <p style={{ whiteSpace: 'pre-line' }}>{t.description}</p>
                    <div>
                      <small>ორგანიზატორი</small>
                      <strong>{details.organizer || 'WaveHubX Official'}</strong>
                      <Link href={me ? '/support' : '/login?next=/support'}>ორგანიზატორთან დაკავშირება</Link>
                    </div>
                  </div>
                  <div className="prejoin-info">
                    <h2>ტურნირის ინფორმაცია</h2>
                    {INFO_KEYS.map((key) => (
                      <Fact key={key} label={LABEL[key]} value={key === 'teamSize' ? details.teamSize || (squad ? `${t.teamSize} მოთამაშე` : 'Solo') : details[key]} />
                    ))}
                  </div>
                </>
              )}

              {tab === 'prize' && (
                <>
                  <aside className="prize-total">
                    <small>ჯამური საპრიზო ფონდი</small>
                    <strong>{t.prize}</strong>
                    {prizes.specialRewards.length > 0 && <b>+ ბონუს ჯილდოები</b>}
                    <i></i>
                    <p>{prizes.note || 'საპრიზო ფონდს ორგანიზატორი გადასცემს გამარჯვებულებს შედეგების დადასტურების შემდეგ.'}</p>
                    <span>
                      <TIcon name="trophy" />
                    </span>
                  </aside>
                  <section className="prize-breakdown">
                    <h2>პრიზების განაწილება</h2>
                    {prizes.places.length > 0 ? (
                      <>
                        <div className="prize-rows">
                          {prizes.places.map((place, index) => (
                            <article key={index} className={`prize-row place-${Math.min(index + 1, 3)}`}>
                              <span className="prize-place-icon">
                                <TIcon name="trophy" />
                              </span>
                              <strong>{place.place}</strong>
                              <span className="prize-amount">
                                <TIcon name="layers" />
                                {place.amount}
                              </span>
                              {place.rewards.map((reward) => (
                                <span key={reward} className="prize-extra">
                                  <TIcon name="star" />
                                  {reward}
                                </span>
                              ))}
                            </article>
                          ))}
                        </div>
                        {prizes.specialRewards.length > 0 && (
                          <>
                            <h3>სპეციალური ჯილდოები</h3>
                            <div className="special-rewards">
                              {prizes.specialRewards.map((reward) => (
                                <span key={reward}>
                                  <TIcon name="star" />
                                  {reward}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                        <p className="prize-note">
                          <TIcon name="info" />
                          ჯილდოები შეიძლება მოიცავდეს თანხას, პროდუქტებს, ვაუჩერებს ან გამოცდილებებს — ტურნირის მიხედვით.
                        </p>
                      </>
                    ) : (
                      <p className="rules-pending">ადგილების მიხედვით განაწილებას ორგანიზატორი გამოაქვეყნებს.</p>
                    )}
                  </section>
                </>
              )}

              {tab === 'rules' && (
                <section className="rules-panel">
                  <h2>ტურნირის წესები</h2>
                  {rules.length > 0 ? (
                    <>
                      {rules.map((rule, index) => (
                        <article key={index} className="rule-row">
                          <b>{index + 1}</b>
                          <strong>{rule.title}</strong>
                          <p>{rule.description}</p>
                        </article>
                      ))}
                      <p className="wt-rules-note">
                        <TIcon name="info" />
                        რეგისტრაციით ეთანხმებით ტურნირის ყველა წესს.
                      </p>
                    </>
                  ) : (
                    <p className="rules-pending">ორგანიზატორს ტურნირის წესები ჯერ არ გამოუქვეყნებია.</p>
                  )}
                </section>
              )}

              {tab === 'teams' && (
                <section className="teams-panel">
                  <header className="teams-toolbar">
                    <h2>
                      {squad ? 'დარეგისტრირებული გუნდები' : 'დარეგისტრირებული მოთამაშეები'} <strong>{squad ? t.teamCount : t.registeredCount}</strong>
                      <span>/ {squad ? `${t.maxTeams} გუნდი` : `${t.maxPlayers}`}</span>
                    </h2>
                    <div>
                      <label>
                        <span className="sr-only">გუნდების ძიება</span>
                        <input id="teamSearch" type="search" placeholder="მოძებნე გუნდები..." value={teamQuery} onChange={(e) => setTeamQuery(e.target.value)} />
                      </label>
                      <select id="teamSort" aria-label="დალაგება" value={teamSort} onChange={(e) => setTeamSort(e.target.value as 'verified' | 'name')}>
                        <option value="verified">ჯერ დადასტურებული</option>
                        <option value="name">სახელით A-Z</option>
                      </select>
                    </div>
                  </header>
                  {shownTeams.length === 0 ? (
                    <p className="rules-pending">{teams.length === 0 ? 'ჯერ არავინ დარეგისტრირებულა — იყავი პირველი.' : 'ვერაფერი მოიძებნა.'}</p>
                  ) : (
                    <div className="team-table">
                      <div className="team-table-head">
                        <span>#</span>
                        <span>{squad ? 'გუნდი' : 'მოთამაშე'}</span>
                        <span>მოთამაშეები</span>
                        <span>შემადგენლობა</span>
                        <span>სტატუსი</span>
                        <span>მოქმედება</span>
                      </div>
                      <div className="team-list">
                        {shownTeams.map((team, index) => (
                          <article key={team.id} className="team-row">
                            <span className="team-number">{String(index + 1).padStart(2, '0')}</span>
                            <div className="team-identity">
                              <div
                                className="team-mark"
                                style={(() => {
                                  // A squad's logo; a solo entry shows the player's own photo (client feedback #6b).
                                  const photo = team.logoUrl ?? (squad ? null : team.players[0]?.avatarUrl ?? null)
                                  return photo ? { backgroundImage: `url("${photo}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined
                                })()}
                              >
                                {team.logoUrl || (!squad && team.players[0]?.avatarUrl) ? '' : (team.tag || team.name).slice(0, 3).toUpperCase()}
                              </div>
                              <div className="team-name">
                                <strong>{team.name}</strong>
                                {team.tag && <b>{team.tag}</b>}
                                <small>
                                  კაპიტანი: @{team.captainUsername}
                                  {team.coachName ? ` · ქოუჩი: ${team.coachName}` : ''}
                                </small>
                              </div>
                            </div>
                            <div className="team-members">
                              {team.members.map((member, i) => {
                                const player = team.players.find((p) => p.inGameName === member) ?? (i === 0 ? team.players[0] : undefined)
                                return player?.username ? (
                                  <Link key={member} href={`/u/${encodeURIComponent(player.username)}`} title={`@${player.username}`}>
                                    <i className={player.avatarUrl ? 'has-photo' : undefined} style={player.avatarUrl ? ({ '--avatar': `url("${player.avatarUrl}")` } as CSSProperties) : undefined}>
                                      {player.avatarUrl ? '' : member.slice(0, 1).toUpperCase()}
                                    </i>
                                    <small>{member}</small>
                                  </Link>
                                ) : (
                                  <span key={member}>
                                    <i>{member.slice(0, 1).toUpperCase()}</i>
                                    <small>{member}</small>
                                  </span>
                                )
                              })}
                            </div>
                            <div className="team-size">
                              <strong>
                                {team.members.length} / {t.teamSize}
                              </strong>
                              <small>მოთამაშე</small>
                            </div>
                            <b className={`team-state ${team.status === TournamentTeamStatus.Verified ? 'verified' : 'pending'}`}>
                              {team.status === TournamentTeamStatus.Verified ? 'Verified' : 'Pending'}
                            </b>
                            <Link className="team-view" href={`/tournaments/${t.id}/matches?team=${team.id}`}>
                              მატჩები
                            </Link>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          </section>

          <section className="prejoin-register">
            <div>
              <strong>{mine ? 'შენ მონაწილეობ!' : 'მზად ხარ შეჯიბრისთვის?'}</strong>
              <span>{mine ? `გუნდი: ${mine.team.name}` : 'დაიკავე ადგილი და იბრძოლე დიდებისთვის!'}</span>
            </div>
            <div>
              <small>დარჩენილი ადგილები</small>
              <strong>{squad ? `${Math.max(0, t.maxTeams - t.teamCount)} / ${t.maxTeams}` : `${spotsLeft} / ${t.maxPlayers}`}</strong>
            </div>
            <div>
              <small>შესვლის საფასური</small>
              <strong>{entryFee}</strong>
            </div>
            {registerButton}
          </section>
          {matches.length > 0 && (
            <p className="wt-matches-link">
              <Link href={`/tournaments/${t.id}/matches`}>
                მატჩები და შედეგები ({matches.length}) <TIcon name="chevron" />
              </Link>
            </p>
          )}
          {(actionError || mine) && (
            <p className={`seller-status${actionError ? ' error' : ''} wt-register-note`} role={actionError ? 'alert' : undefined}>
              {actionError || (mine?.team.status === TournamentTeamStatus.Pending ? 'გუნდი ელოდება ადმინისტრაციის დადასტურებას. ' : 'რეგისტრაცია დადასტურებულია. ')}
              {mine && !captain && !actionError && 'გუნდიდან გასვლა შეუძლია კაპიტანს. '}
              {mine && captain && editable && (
                <button type="button" className="wt-link-button" disabled={busy} onClick={() => void withdraw()}>
                  ტურნირიდან გასვლა
                </button>
              )}
            </p>
          )}

          {others.length > 0 && (
            <section className="wt-other" aria-labelledby="otherTournamentsTitle">
              <header>
                <h2 id="otherTournamentsTitle">სხვა ტურნირები</h2>
                <Link href="/tournaments">
                  ყველა ტურნირი <TIcon name="arrow" />
                </Link>
              </header>
              <div className="wt-other-wrap">
                <button type="button" className="wt-carousel-btn prev" aria-label="წინა" onClick={() => scrollOthers(-1)}>
                  <TIcon name="chevronLeft" />
                </button>
                <div className="wt-other-track" ref={carousel}>
                  {others.map((other) => {
                    const [label, tone] = TOURNAMENT_BADGE[other.status]
                    const otherCover = tournamentCover(other, slugById)
                    return (
                      <article key={other.id} className="wt-other-card">
                        <Link
                          className="wt-other-cover"
                          href={`/tournaments/${other.id}`}
                          style={otherCover ? { backgroundImage: `url('${otherCover}')` } : undefined}
                          aria-label={other.name}
                        >
                          <span className={`wt-badge ${tone}`}>{label}</span>
                        </Link>
                        <h3>{other.name}</h3>
                        <p className="wt-card-meta">
                          <span>
                            <TIcon name="calendar" />
                            {formatDay(other.startDate)}
                          </span>
                          <span>
                            <TIcon name="users" />
                            {tournamentFormat(other)}
                          </span>
                          <span className="wt-pink">
                            <TIcon name="trophy" />
                            {other.prize}
                          </span>
                        </p>
                        <Link className="wt-other-button" href={`/tournaments/${other.id}`}>
                          დეტალების ნახვა <TIcon name="chevron" />
                        </Link>
                      </article>
                    )
                  })}
                </div>
                <button type="button" className="wt-carousel-btn next" aria-label="შემდეგი" onClick={() => scrollOthers(1)}>
                  <TIcon name="chevron" />
                </button>
              </div>
            </section>
          )}
        </section>
      </section>

      {teamModal && me && (
        <RegistrationModal
          tournament={t}
          me={me}
          onClose={() => setTeamModal(false)}
          onDone={() => {
            // Success page with the next steps (client feedback #6).
            setTeamModal(false)
            void router.push(`/tournaments/${t.id}/registered`)
          }}
        />
      )}
    </Layout>
  )
}
