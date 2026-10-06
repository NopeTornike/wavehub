import Link from 'next/link'
import { useRouter } from 'next/router'
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { PublicCoachSummary } from '@wavehub/shared-types'
import Layout from '../../components/Layout'
import { api, errorMessage } from '../../lib/api'
import { gameIcon } from '../../lib/games'
import { useShell } from '../../lib/shell'
import { useCoachingFromPrice } from '../../lib/coaching-price'
import StepsGuide from '../../components/StepsGuide'
import { BannerPlacement } from '@wavehub/shared-types'
import HomeBanners from '../../components/HomeBanners'

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
// Rank is coach-entered; response time is the coach's measured median (docs/design-mockups/06);
// "Fast Responder" / "Top Rated" tags appear only when earned (≤10 min median / ≥4.8 from 5+ reviews).
// The topbar search filters the loaded page by name / specialty / game, as coaching.js does.
//
// 2026-10-02: the page follows docs/design-mockups/06 (`cl-` CSS at the end of global.css): two-line
// heading, sort + Grid/List toggle, game chips, and the mockup's coach card (photo with the real
// online pill, plan badge, rank, rating, response time, game, price + Book Session, tag chips). The
// filter panel stays beside the grid on desktop and folds behind a "Filters" button below 1000px.
// Left out because there is no data for it: the mockup's "Top 1%" tag and a tier for coaches without
// a plan badge.

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
  const fromPrice = useCoachingFromPrice()
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
  const [filtersOpen, setFiltersOpen] = useState(false)
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
  const activeFilters = checkedGames.length + (maxRate < PRICE_MAX ? 1 : 0) + (language !== 'all' ? 1 : 0)
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
      <HomeBanners placement={BannerPlacement.CoachingTop} />
      {/* Booking guide (client feedback #8 — same form as the marketplace's). */}
      <StepsGuide
        id="coachStepsTitle"
        title="როგორ მუშაობს"
        accent="ქოუჩინგი"
        steps={['აირჩიე ქოუჩი', 'დაჯავშნე სესია', 'დაადასტურე გადახდა', 'დაელოდე ქოუჩს', 'ჩაატარე და შეაფასე']}
      />
      {/* .coaching-body scopes coaching.html's --coach-* variables (it's the prototype's <body> class). */}
      <div className="coaching-body">
        <div className={`cl-shell${filtersOpen ? ' filters-open' : ''}`}>
          <aside className="coach-filter-panel" id="coachFilterPanel" aria-label="ქოუჩების ფილტრები">
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
              {/* Hourly-rate filter only while no platform package is active (packages cost the same for every coach). */}
              {fromPrice === null && (
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
              )}
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

          <section className="cl-browse" aria-labelledby="coachBrowseTitle">
            <header className="cl-head">
              <div>
                <h1 id="coachBrowseTitle">
                  იპოვე საუკეთესო ქოუჩი
                  <span>თამაშის დონის ასამაღლებლად</span>
                </h1>
              </div>
              <nav className="cl-links" aria-label="ქოუჩინგის ბმულები">
                <Link href="/coaching-sessions">ჩემი სესიები</Link>
                <Link href="/coaching/profile">ქოუჩის პროფილი</Link>
                <Link className="cl-apply" href="/coaching/apply">
                  გახდი ქოუჩი
                </Link>
              </nav>
            </header>

            <div className="cl-toolbar">
              <button type="button" className={`cl-filter-toggle${filtersOpen ? ' active' : ''}`} aria-expanded={filtersOpen} aria-controls="coachFilterPanel" onClick={() => setFiltersOpen((v) => !v)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
                  <circle cx="16" cy="7" r="2" />
                  <circle cx="8" cy="17" r="2" />
                </svg>
                ფილტრები
                {activeFilters > 0 && <b>{activeFilters}</b>}
              </button>
              <label className="cl-sort">
                <span className="sr-only">ქოუჩების დალაგება</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
                  <circle cx="16" cy="7" r="2" />
                  <circle cx="8" cy="17" r="2" />
                </svg>
                <select id="coachSort" value={sort} onChange={(event) => refilter(() => setSort(event.target.value))}>
                  {SORTS.filter(([value]) => fromPrice === null || !value.startsWith('price')).map(([value, label]) => (
                    <option key={value} value={value}>
                      დალაგება: {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="cl-view" role="group" aria-label="ხედის რეჟიმი">
                <button className={view === 'grid' ? 'active' : undefined} type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
                    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
                    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
                    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
                  </svg>
                  ბადე
                </button>
                <button className={view === 'list' ? 'active' : undefined} type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
                  </svg>
                  სია
                </button>
              </div>
            </div>

            <div className="cl-chips" id="coachGameTabs" role="group" aria-label="თამაშის ფილტრი">
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

            <p className="cl-count">
              <strong id="coachResultCount">{result?.total ?? 0} ქოუჩი მოიძებნა</strong>
            </p>

            {error && (
              <p className="seller-status error" role="alert">
                {error}
              </p>
            )}

            <div className={`cl-grid${view === 'list' ? ' is-list' : ''}`} id="coachGrid">
              {shown.map((coach) => {
                const name = `${coach.firstName} ${coach.lastName}`.trim()
                const href = `/coaching/${coach.id}`
                const icon = gameIcon(coach.gameSlug)
                return (
                  <article
                    key={coach.id}
                    className="cl-card"
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
                    <div className="cl-card-top">
                      <div className={`cl-photo${coach.avatarUrl ? ' has-image' : ''}`} style={coach.avatarUrl ? { backgroundImage: `url("${coach.avatarUrl}")` } : undefined}>
                        {!coach.avatarUrl && <span aria-hidden="true">{`${coach.firstName[0] ?? ''}${coach.lastName[0] ?? ''}`.toUpperCase()}</span>}
                        {coach.online && (
                          <em className="cl-online">
                            <i aria-hidden="true"></i>ონლაინ
                          </em>
                        )}
                      </div>
                      <div className="cl-info">
                        <div className="cl-name-row">
                          <h2>{name}</h2>
                          {coach.profileBadge && (
                            <span className="cl-tier">
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M6 4h12l4 6-10 11L2 10l4-6Z" />
                                <path d="M2 10h20M9 4l-2 6 5 11 5-11-2-6" />
                              </svg>
                              {coach.profileBadge}
                            </span>
                          )}
                        </div>
                        <p className="cl-specialty" title={coach.specialty}>
                          {coach.specialty}
                        </p>
                        {coach.rank && (
                          <p className="cl-line cl-rank">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <circle cx="12" cy="9" r="5.5" />
                              <path d="m9 14-1.5 7 4.5-2.5 4.5 2.5L15 14" />
                            </svg>
                            <span>{coach.rank}</span>
                          </p>
                        )}
                        <p className="cl-line cl-rating">
                          {coach.ratingAvg ? (
                            <>
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
                              </svg>
                              <strong>{Number(coach.ratingAvg).toFixed(1)}</strong>
                              <span>({coach.ratingCount})</span>
                            </>
                          ) : (
                            <span>შეფასების გარეშე</span>
                          )}
                        </p>
                        {coach.responseMinutes !== null && (
                          <p className="cl-line cl-response">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
                            </svg>
                            <span>
                              საშ. პასუხის დრო: ~{coach.responseMinutes < 60 ? `${coach.responseMinutes} წთ` : `${Math.round(coach.responseMinutes / 60)} სთ`}
                            </span>
                          </p>
                        )}
                        <p className="cl-line cl-game">
                          <span className="cl-game-icon">{icon ? <img src={icon} alt="" aria-hidden="true" /> : (coach.gameName ?? 'WH').slice(0, 2).toUpperCase()}</span>
                          <span>{coach.gameName ?? 'ზოგადი'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="cl-buy">
                      <p className="cl-price">
                        <strong>{fromPrice !== null ? `${fromPrice}₾` : coach.hourlyRateWaveCoin}</strong>
                        <span>{fromPrice !== null ? '-დან' : 'GEL/სთ'}</span>
                      </p>
                      <Link className="cl-book" href={`${href}/book`} aria-label={`სესიის დაჯავშნა — ${name}`}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="3" y="5" width="18" height="16" rx="2" />
                          <path d="M16 3v4M8 3v4M3 10h18" />
                        </svg>
                        სესიის დაჯავშნა
                        <b aria-hidden="true">›</b>
                      </Link>
                    </div>

                    <div className="cl-tags">
                      {coach.responseMinutes !== null && coach.responseMinutes <= 10 && (
                        <span className="fast">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
                          </svg>
                          Fast Responder
                        </span>
                      )}
                      <span>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 3 4.5 6v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9V6L12 3Z" />
                          <path d="m9 12 2.2 2.2L15.2 10" />
                        </svg>
                        ვერიფიცირებული ქოუჩი
                      </span>
                      {coach.ratingAvg && Number(coach.ratingAvg) >= 4.8 && coach.ratingCount >= 5 && (
                        <span>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8.5 20h7" />
                          </svg>
                          Top Rated
                        </span>
                      )}
                      {coach.languages.map((lang) => (
                        <span key={lang}>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" />
                          </svg>
                          {lang.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="cl-empty" id="coachEmpty" hidden={result === null || shown.length > 0}>
              ქოუჩი ვერ მოიძებნა.
            </div>
            {result === null && <div className="cl-empty">იტვირთება…</div>}

            {result !== null && result.total > 0 && page >= totalPages && (
              <div className="cl-empty cl-end">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.2" />
                  <path d="M5.5 20a6.5 6.5 0 0 1 13 0M4.5 9.5a2.2 2.2 0 1 1 2.6-3M19.5 9.5a2.2 2.2 0 1 0-2.6-3M2.5 16.5a3.6 3.6 0 0 1 3-3M21.5 16.5a3.6 3.6 0 0 0-3-3" />
                </svg>
                <strong>მეტი ქოუჩი ვერ მოიძებნა</strong>
                <span>ახალი ქოუჩები მალე შემოგვიერთდებიან.</span>
                <i aria-hidden="true"></i>
              </div>
            )}

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
