import Link from 'next/link'
import { useRouter } from 'next/router'
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { PublicCoachSummary } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { gameIcon } from '../../lib/games'
import { useShell } from '../../lib/shell'

/* eslint-disable @next/next/no-img-element */
// The prototype's coaching.html (coaching.js), on real data: the filter panel (Game checkboxes with
// Show More, Price Range, Language + Reset), the heading row with sort select and grid/list toggle,
// the game tabs (+ More), the result count, coach cards and 8-per-page pagination. Filtering,
// sorting and paging are server-side (GET /coaches). What's left out, per root rule #6:
//   - "Service Type", "Rank" and "Availability" filters and the card's rank line / response-time
//     line — coaches have no service-type, rank or availability data;
//   - the prototype's invented tags ("Fast Responder", "Top 1%") — the card's tag row carries real
//     ones: "Verified Coach" (every listed coach is verified), the plan badge, the languages.
// The avatar's green dot shows only when the coach is actually online (seen in the last 5 minutes).
// The topbar search filters the loaded page by name / specialty / game, as coaching.js does.

const PER_PAGE = 8
const GAMES_COLLAPSED = 5
const TABS_COLLAPSED = 6
const LANGUAGES: Array<[string, string]> = [
  ['en', 'English'],
  ['ka', 'ქართული'],
  ['ru', 'Русский'],
]
const PRICE_MIN = 5
const PRICE_MAX = 100
const SORTS: Array<[string, string]> = [
  ['rating', 'რეიტინგი'],
  ['price_asc', 'ფასი ↑'],
  ['price_desc', 'ფასი ↓'],
  ['reviews', 'შეფასებები'],
]

function pageList(total: number, active: number): number[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  return [...new Set([1, active - 1, active, active + 1, total])].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
}

export default function CoachingDirectory() {
  const router = useRouter()
  const { games } = useShell()
  const [checkedGames, setCheckedGames] = useState<string[]>([])
  const [tab, setTab] = useState('all')
  const [maxRate, setMaxRate] = useState(PRICE_MAX)
  const [language, setLanguage] = useState('all')
  const [sort, setSort] = useState('rating')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [showAllGames, setShowAllGames] = useState(false)
  const [showAllTabs, setShowAllTabs] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [result, setResult] = useState<{ items: PublicCoachSummary[]; total: number } | null>(null)
  const [error, setError] = useState('')

  // Game tab and game checkboxes narrow the same field: a tab wins when one is picked.
  const gameIds = tab !== 'all' ? tab : checkedGames.join(',')

  useEffect(() => {
    let cancelled = false
    api
      .browseCoaches({
        gameIds: gameIds || undefined,
        maxRate: maxRate < PRICE_MAX ? maxRate : undefined,
        language: language !== 'all' ? language : undefined,
        sort,
        limit: PER_PAGE,
        offset: (page - 1) * PER_PAGE,
      })
      .then((res) => {
        if (cancelled) return
        setResult(res)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setResult({ items: [], total: 0 })
        setError(errorMessage(err, 'ქოუჩების ჩატვირთვა ვერ მოხერხდა.'))
      })
    return () => {
      cancelled = true
    }
  }, [gameIds, maxRate, language, sort, page])

  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () =>
      (result?.items ?? []).filter(
        (coach) => !q || [coach.firstName, coach.lastName, coach.username, coach.specialty, coach.gameName].filter(Boolean).join(' ').toLowerCase().includes(q),
      ),
    [result, q],
  )
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / PER_PAGE))

  const refilter = (apply: () => void) => {
    apply()
    setPage(1)
  }
  const reset = () =>
    refilter(() => {
      setCheckedGames([])
      setTab('all')
      setMaxRate(PRICE_MAX)
      setLanguage('all')
      setQuery('')
    })
  const toggleGame = (id: string) => refilter(() => setCheckedGames((current) => (current.includes(id) ? current.filter((g) => g !== id) : [...current, id])))
  const priceLabel = maxRate >= PRICE_MAX ? `${PRICE_MAX} GEL+` : `მაქს. ${maxRate} GEL`
  const priceProgress = ((maxRate - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100
  const fieldsetClass = (key: string) => (collapsed[key] ? 'is-collapsed' : undefined)
  const collapseButton = (key: string, label: string) => (
    <button className="coach-collapse" type="button" aria-label={label} aria-expanded={!collapsed[key]} onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}></button>
  )

  return (
    <Layout
      title="ქოუჩების ნახვა"
      description="ვერიფიცირებული გეიმინგ ქოუჩები WaveHub-ზე — დაჯავშნეთ სესია PUBG Mobile, COD Mobile, Free Fire და სხვა თამაშებისთვის."
      pageSearch={{ value: query, onChange: setQuery, placeholder: 'მოძებნე ქოუჩები...', label: 'ქოუჩების ძიება' }}
    >
      {/* .coaching-body scopes coaching.html's --coach-* variables (it's the prototype's <body> class). */}
      <div className="coaching-body">
        <div className="coach-shell">
          <aside className="coach-filter-panel" aria-label="ქოუჩების ფილტრები">
            <div className="coach-filter-head">
              <strong>ფილტრები</strong>
              <button id="resetFilters" type="button" onClick={reset}>
                გასუფთავება
              </button>
            </div>
            <form className="coach-filters" id="coachFilters" onSubmit={(event) => event.preventDefault()}>
              <fieldset className={fieldsetClass('game')}>
                <legend>
                  თამაში
                  {collapseButton('game', 'თამაშის ფილტრის ჩაკეცვა')}
                </legend>
                {(showAllGames ? games : games.slice(0, GAMES_COLLAPSED)).map((game) => (
                  <label key={game.gameId}>
                    <input type="checkbox" name="game" value={game.gameId} checked={checkedGames.includes(game.gameId)} onChange={() => toggleGame(game.gameId)} />{' '}
                    <span>{game.name}</span>
                  </label>
                ))}
                {games.length > GAMES_COLLAPSED && (
                  <button className="coach-show-more" type="button" onClick={() => setShowAllGames((v) => !v)}>
                    {showAllGames ? 'ნაკლების ნახვა' : 'მეტის ნახვა'}
                  </button>
                )}
              </fieldset>
              <fieldset className={fieldsetClass('price')}>
                <legend>ფასის დიაპაზონი</legend>
                <input
                  id="priceRange"
                  type="range"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  step={5}
                  value={maxRate}
                  aria-label="ქოუჩინგის მაქსიმალური ფასი"
                  aria-valuetext={priceLabel}
                  style={{ ['--price-progress' as string]: `${priceProgress}%` }}
                  onChange={(event) => refilter(() => setMaxRate(Number(event.target.value)))}
                />
                <div className="coach-range-labels">
                  <span>{PRICE_MIN} GEL</span>
                  <span id="priceRangeLabel">{priceLabel}</span>
                </div>
              </fieldset>
              <label className="coach-select-label">
                <span>ენა</span>
                <select id="languageFilter" value={language} onChange={(event) => refilter(() => setLanguage(event.target.value))}>
                  <option value="all">ნებისმიერი ენა</option>
                  {LANGUAGES.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </form>
          </aside>

          <section className="coach-browse" aria-labelledby="coachBrowseTitle">
            <div className="coach-heading-row">
              <div>
                <h1 id="coachBrowseTitle">
                  <span className="coach-heading-icon" aria-hidden="true"></span>ქოუჩების ნახვა
                </h1>
                <p>
                  იპოვე შესაფერისი ქოუჩი თამაშის დონის ასამაღლებლად · <Link href="/coaching/apply">გახდი ქოუჩი</Link> ·{' '}
                  <Link href="/coaching-sessions">ჩემი სესიები</Link>
                </p>
              </div>
              <div className="coach-sort-row">
                <label>
                  <span className="sr-only">ქოუჩების დალაგება</span>
                  <select id="coachSort" value={sort} onChange={(event) => refilter(() => setSort(event.target.value))}>
                    {SORTS.map(([value, label]) => (
                      <option key={value} value={value}>
                        დალაგება: {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="coach-view-toggle" aria-label="ხედის რეჟიმი">
                  <button className={view === 'grid' ? 'active' : undefined} type="button" data-view="grid" aria-label="ბადის ხედი" aria-pressed={view === 'grid'} onClick={() => setView('grid')}></button>
                  <button className={view === 'list' ? 'active' : undefined} type="button" data-view="list" aria-label="სიის ხედი" aria-pressed={view === 'list'} onClick={() => setView('list')}></button>
                </div>
              </div>
            </div>

            <div className="coach-game-tabs" id="coachGameTabs" role="group" aria-label="თამაშის ფილტრი">
              <button type="button" className={tab === 'all' ? 'active' : undefined} aria-pressed={tab === 'all'} onClick={() => refilter(() => setTab('all'))}>
                ყველა თამაში
              </button>
              {(showAllTabs ? games : games.slice(0, TABS_COLLAPSED)).map((game) => (
                <button key={game.gameId} type="button" className={tab === game.gameId ? 'active' : undefined} aria-pressed={tab === game.gameId} onClick={() => refilter(() => setTab(game.gameId))}>
                  {game.name}
                </button>
              ))}
              {games.length > TABS_COLLAPSED && (
                <button type="button" aria-expanded={showAllTabs} onClick={() => setShowAllTabs((v) => !v)}>
                  {showAllTabs ? 'ნაკლები' : 'მეტი'}
                </button>
              )}
            </div>

            <div className="coach-result-row">
              <span></span>
              <strong id="coachResultCount">{result?.total ?? 0} ქოუჩი მოიძებნა</strong>
            </div>

            {error && (
              <p className="seller-status error" role="alert">
                {error}
              </p>
            )}

            <div className={`coach-grid${view === 'list' ? ' is-list' : ''}`} id="coachGrid">
              {shown.map((coach) => {
                const name = `${coach.firstName} ${coach.lastName}`.trim()
                const href = `/coaching/${coach.id}`
                const icon = gameIcon(coach.gameSlug)
                return (
                  <article
                    key={coach.id}
                    className="coach-card"
                    tabIndex={0}
                    role="link"
                    aria-label={`${name} — პროფილი`}
                    onClick={(event) => {
                      if ((event.target as Element).closest('a, button')) return
                      router.push(href)
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      router.push(href)
                    }}
                  >
                    <div className="coach-card-main">
                      <div
                        className={`coach-avatar-ring${coach.avatarUrl ? ' has-image' : ''}`}
                        style={coach.avatarUrl ? { ['--coach-image' as string]: `url("${coach.avatarUrl}")` } : undefined}
                      >
                        <span aria-hidden="true">{coach.avatarUrl ? '' : `${coach.firstName[0] ?? ''}${coach.lastName[0] ?? ''}`.toUpperCase()}</span>
                        {coach.online && <i title="ონლაინ" aria-label="ონლაინ"></i>}
                      </div>
                      <div className="coach-card-copy">
                        <h2>{name}</h2>
                        <p className="coach-rating-line">
                          {coach.ratingAvg ? (
                            <>
                              <span aria-hidden="true">★</span> {Number(coach.ratingAvg).toFixed(1)} ({coach.ratingCount})
                            </>
                          ) : (
                            'შეფასების გარეშე'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="coach-game-row">
                      <span className="coach-game-icon">{icon ? <img src={icon} alt="" aria-hidden="true" /> : (coach.gameName ?? 'WH').slice(0, 2).toUpperCase()}</span>
                      <strong>{coach.gameName ?? 'ზოგადი'}</strong>
                      <span className="coach-service-pill" title={coach.specialty}>
                        {coach.specialty}
                      </span>
                    </div>

                    <div className="coach-price-row">
                      <p>
                        <strong>{coach.hourlyRateWaveCoin} WC/სთ</strong>
                      </p>
                      <Link href={href} aria-label={`სესიის დაჯავშნა — ${name}`}>
                        სესიის დაჯავშნა
                      </Link>
                    </div>

                    <div className="coach-card-tags">
                      <span className="standard">Verified Coach</span>
                      {coach.profileBadge && <span className="sessions">★ {coach.profileBadge}</span>}
                      {coach.languages.map((lang) => (
                        <span key={lang} className="language">
                          {lang.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="coach-empty" id="coachEmpty" hidden={result === null || shown.length > 0}>
              ქოუჩი ვერ მოიძებნა.
            </div>
            {result === null && <div className="coach-empty">იტვირთება…</div>}

            <nav className="coach-pagination" aria-label="ქოუჩების გვერდები" hidden={totalPages <= 1}>
              <button type="button" aria-label="წინა გვერდი" disabled={page === 1} onClick={() => setPage(page - 1)}>
                &lt;
              </button>
              {pageList(totalPages, page).map((p, index, list) => (
                <Fragment key={p}>
                  {index > 0 && p - list[index - 1] > 1 && <span aria-hidden="true">...</span>}
                  <button type="button" className={p === page ? 'active' : undefined} aria-current={p === page ? 'page' : undefined} onClick={() => setPage(p)}>
                    {p}
                  </button>
                </Fragment>
              ))}
              <button type="button" aria-label="შემდეგი გვერდი" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                &gt;
              </button>
            </nav>
          </section>
        </div>
      </div>
    </Layout>
  )
}
