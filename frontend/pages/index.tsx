import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ListingType, TournamentStatus } from '@wavehub/shared-types'
import type { PublicBanner, PublicCoachSummary, PublicListingSummary, PublicTournamentSummary } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useShell } from '../lib/shell'
import { gameCover, gameDisplayName, gameTile } from '../lib/games'
import { listingKind, normalizeAccountStatus } from '../components/ProductCard'
import RankIcon from '../components/RankIcon'
import { useCoachingFromPrice } from '../lib/coaching-price'
import HomeBanners, { useBanners } from '../components/HomeBanners'
import { BannerVideo, useBannerRotation, useSwipe } from '../components/BannerSlides'
import { useFavorites } from '../lib/favorites'
import { gel } from '../lib/money'
import { kaDayMonth } from '../lib/dates'
import { tournamentPrimaryHref } from '../lib/tournaments'
import { BannerPlacement } from '@wavehub/shared-types'

// The static prototype's home page (index.html + its inline scripts), section for section and in
// the prototype's final DOM order (its script moves competition/steam/featured/how-it-works in
// front of the FAQ). Real data behind every dynamic part:
//   - game grid: the games table + live per-game active-listing counts (GET /stats/games)
//   - "Featured Items" (right rail on desktop, 3-card strip otherwise): the prototype takes seller
//     staff-picked listings (featured=true: admin isFeatured or a featured-perk seller), ordered (the
//     featuredListings perk boost, then isFeatured, then createdAt), so it's GET /listings as-is.
//     Like the prototype, `featured-items-fallback` goes on <body> when there are none.
//   - Top Coaches: real verified coaches, highest rated first. The prototype's three coach cards
//     (names, photos, ratings, "Online" pill, "Most booked") are hardcoded; this shows real coach
//     data only; the "Online" pill shows real presence and the badge is earned (most booked here,
//     plan badge, top rated, new).
//   - Featured Tournament: the next open (else upcoming) real tournament.
//   - "Steam Games" carousel: real digital-key listings with real WaveCoin prices.
// The mobile-only blocks (account overview, services grid) are included because the prototype's
// CSS shows them at phone widths; the account card uses the real user + Wave rank.
/* eslint-disable @next/next/no-img-element */

const HOW_STEPS = [
  {
    step: 'აღმოაჩინე',
    lead: 'დაიწყეთ მოგზაურობა თქვენს საყვარელ თამაშებში ათასობით გადამოწმებული განცხადებისა და ექსკლუზიური შეთავაზების დათვალიერებით.',
    features: [
      { icon: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4 4" /></svg>, title: 'დაათვალიერეთ ათასობით განცხადება', text: 'ერთ სივრცეში დაათვალიერეთ სანდო გამყიდველების ანგარიშები, სერვისები და ბუსტები.' },
      { icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.7 7 4v8l-7 4-7-4v-8l7-4Z" /><path d="m8.6 8.4 3.4 2 3.4-2M12 10.4v4" /></svg>, title: 'იპოვეთ საუკეთესო სერვისები და შეთავაზებები', text: 'გამოიყენეთ ფილტრები და კატეგორიები, რომ სწრაფად და მარტივად იპოვოთ ზუსტად ის, რაც გჭირდებათ.' },
      { icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.5 2.5c1 3.6-.8 5.1-2.2 7.1-1.1-1-.9-2.1-.8-3.3C6.6 8.4 5 11 5 14a7 7 0 0 0 14 0c0-2.8-1.4-5.4-3.8-7.2.1 2.5-.7 4-2 4.8.2-3.4-.1-6.5-.7-9.1Z" /></svg>, title: 'აღმოაჩინეთ ახალი შეთავაზებები ყოველდღე', text: 'ხშირად შემოგვიარეთ ახალი შეთავაზებების, დროებითი ფასდაკლებებისა და ექსკლუზიური აქციებისთვის.' },
    ],
  },
  {
    step: 'შეადარე და აირჩიე',
    lead: 'შეადარეთ გადამოწმებული შეთავაზებები ერთმანეთს და თავდაჯერებულად აირჩიეთ თქვენთვის საუკეთესო.',
    features: [
      { icon: '◎', title: 'შეადარეთ ფასები და მახასიათებლები', text: 'გადაწყვეტილებამდე ნათლად ნახეთ ფასები, მიწოდების ვადები და შეთავაზების დეტალები.' },
      { icon: '★', title: 'გადაამოწმეთ სანდო შეფასებები', text: 'გამყიდველის რეიტინგი და მყიდველების შეფასებები დაგეხმარებათ სწორ არჩევანში.' },
      { icon: '✓', title: 'აირჩიეთ იდეალური ვარიანტი', text: 'აირჩიეთ სერვისი, რომელიც საუკეთესოდ შეესაბამება თქვენს საჭიროებებს, ბიუჯეტსა და ვადებს.' },
    ],
  },
  {
    step: 'შეუკვეთე უსაფრთხოდ',
    lead: 'შეუკვეთეთ თავდაჯერებულად. თქვენი გადახდა დაცულია, სანამ ყველაფერი არ დასრულდება.',
    features: [
      { icon: '⌾', title: 'დაცული გადახდები', text: 'უსაფრთხო ესქროუ იცავს თქვენს თანხას ყოველი ტრანზაქციის განმავლობაში.' },
      { icon: '↗', title: 'თვალი ადევნეთ შეკვეთას', text: 'ადევნეთ თვალი პროგრესს და იყავით კავშირზე გამყიდველთან ერთი სივრციდან.' },
      { icon: '◇', title: 'მიიღეთ მხარდაჭერა ნებისმიერ დროს', text: 'ჩვენი მხარდაჭერის გუნდი მზადაა დაგეხმაროთ, როცა კი დაგჭირდებათ.' },
    ],
  },
  {
    step: 'მიიღე და დაადასტურე',
    lead: 'გადაამოწმეთ მიწოდება, დაადასტურეთ რომ ყველაფერი სწორადაა და უსაფრთხოდ დაასრულეთ შეკვეთა.',
    features: [
      { icon: '↓', title: 'მიიღეთ შეკვეთა', text: 'მიიღეთ ნივთი ან სერვისი შეთავაზებაზე მითითებულ ვადაში.' },
      { icon: '✓', title: 'შეამოწმეთ ყველაფერი', text: 'დარწმუნდით, რომ მიწოდებული ზუსტად ემთხვევა შეძენილს.' },
      { icon: '♡', title: 'დაადასტურეთ და შეაფასეთ', text: 'დაასრულეთ შეკვეთა და დატოვეთ შეფასება — ეს საზოგადოების ნდობას აძლიერებს.' },
    ],
  },
]

const FAQS = [
  { q: 'რა არის WaveHubX?', s: 'გაიგეთ რა არის WaveHubX და როგორ აერთიანებს ის გეიმერებს მთელ მსოფლიოში.', a: 'WaveHubX არის ერთიანი გეიმინგ ეკოსისტემა, სადაც მოთამაშეები ერთ უსაფრთხო პლატფორმაზე პოულობენ მარკეტის პროდუქტებს, ქოუჩებს, ციფრულ სერვისებსა და ტურნირებს.' },
  { q: 'როგორ გავხდე გამყიდველი ან ქოუჩი?', s: 'დაიწყეთ შემოსავლის მიღება WaveHubX-ზე თქვენი უნარების ან ნივთების შეთავაზებით.', a: 'შექმენით ანგარიში, შეავსეთ პროფილი და გამოიყენეთ გამყიდველის ან ქოუჩის რეგისტრაციის ხელსაწყოები. საჭირო ინფორმაციის გადამოწმების შემდეგ შეძლებთ შეთავაზებების გამოქვეყნებას.' },
  { q: 'როგორ მუშაობს ესქროს სისტემა?', s: 'გადახდას უსაფრთხოდ ვინახავთ, სანამ ორივე მხარე კმაყოფილი არ იქნება.', a: 'მყიდველის გადახდა უსაფრთხოდ ინახება, სანამ შეკვეთა აქტიურია. თანხა გამყიდველს ერიცხება შეთანხმებული პროდუქტის ან სერვისის მიწოდებისა და დასრულების შემდეგ.' },
  { q: 'ჩვეულებრივ რამდენ ხანს გრძელდება მიწოდება?', s: 'მიწოდების დრო დამოკიდებულია თქვენს მიერ არჩეული სერვისის ან პროდუქტის ტიპზე.', a: 'თითოეულ შეთავაზებაზე მითითებულია მოსალოდნელი მიწოდების დრო. მყისიერი პროდუქტები შეიძლება რამდენიმე წუთში მიიღოთ, ხოლო ქოუჩინგის სესიები და ინდივიდუალური სერვისები განრიგზეა დამოკიდებული.' },
  { q: 'დაცულია ჩემი გადახდა?', s: 'დიახ. თქვენი გადახდა დაცულია ჩვენი ესქროს სისტემით შეკვეთის დასრულებამდე.', a: 'დიახ. გადახდა დაცულია ტრანზაქციის განმავლობაში და არ გათავისუფლდება, სანამ შეკვეთა საჭირო დასრულების ეტაპს არ მიაღწევს.' },
  { q: 'შემიძლია თანხის დაბრუნების მოთხოვნა?', s: 'დიახ, პირობების შეუსრულებლობის შემთხვევაში შეგიძლიათ თანხის დაბრუნება მოითხოვოთ.', a: 'თუ შეკვეთა შეთანხმებულ პირობებს არ აკმაყოფილებს, შეკვეთის დეტალებით დაუკავშირდით მხარდაჭერას. საქმე განიხილება პლატფორმის თანხის დაბრუნების წესების შესაბამისად.' },
]

// docs/design-mockups/18 "Explore our services" row (desktop).
const EXPLORE_SERVICES: Array<{ label: string; href: string | null; icon: React.ReactNode }> = [
  { label: 'ქოუჩინგი', href: '/coaching', icon: <path d="M9 20v-5a7 7 0 0 1 14 0v5M9 17H6v7h4v-7H9Zm14 0h3v7h-4v-7h1ZM22 25c0 2-2 3-5 3" /> },
  { label: 'ნივთების მარკეტი', href: '/marketplace?type=skin', icon: <path d="m16 4 11 6v12l-11 6-11-6V10l11-6Zm0 0v24M5 10l11 6 11-6" /> },
  { label: 'ანგარიშების მარკეტი', href: '/marketplace?type=account', icon: <><circle cx="16" cy="11" r="5" /><path d="M6 27a10 10 0 0 1 20 0" /></> },
  { label: 'CS2 სკინები', href: '/marketplace?type=skin&game=cs2', icon: <path d="M4 18h9l2-4h11l2 3-8 1-2 4h-5l-1 3H6l1-4H4v-3Zm11-4 1-4h5" /> },
  { label: 'ტურნირები', href: '/tournaments', icon: <><path d="M10 5h12v6a6 6 0 0 1-12 0V5Zm0 3H5v2a5 5 0 0 0 5 5m12-7h5v2a5 5 0 0 1-5 5M16 17v5m-6 5h12m-9-5h6" /></> },
  { label: 'Steam თამაშები', href: '/steam-keys', icon: null },
  // Owner 2026-10-15: the services page (Sidebar → Services) takes the "soon" tile's place; "soon"
  // moves to the end.
  { label: 'ინდივიდუალური სერვისები', href: '/services', icon: <><path d="M6 9h20v16H6z" /><path d="M12 9V6h8v3M6 15h20" /><path d="m16 18 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4L16 18Z" /></> },
  { label: 'მალე', href: null, icon: <><rect x="8" y="14" width="16" height="12" rx="2" /><path d="M11 14v-3a5 5 0 0 1 10 0v3" /></> },
]

function listingPrice(listing: PublicListingSummary) {
  return listing.startingPriceWaveCoin ?? listing.priceWaveCoin ?? 0
}

// The prototype's featured-item image order (index.html#getFeaturedImage): the seller's own photo,
// then an account's rarity art (`<status>-account.png`), then the game's cover.
function listingImage(listing: PublicListingSummary, gameSlug: string | undefined) {
  const own = listing.images[0]?.url
  if (own) return own
  const status = listing.itemAttributes?.accountStatus
  if (listingKind(listing) === 'account' && status) return `/assets/${normalizeAccountStatus(status)}-account.png`
  return gameCover(gameSlug)
}

function typeLabel(listing: PublicListingSummary) {
  const kind = listingKind(listing)
  return kind === 'account' ? 'ანგარიში' : kind === 'skin' ? 'სკინი' : kind === 'item' ? 'ნივთი' : kind === 'key' ? 'გასაღები' : 'სერვისი'
}

// Earned labels only (docs/design-mockups/15): the most-booked coach among those shown, a plan
// badge, top rated, or new.
// Only a real distinction gets a pill (client 2026-10-07: a "new coach" pill on every card looked
// accidental, and "verified" already has its own pill).
function coachBadge(coach: PublicCoachSummary, mostBookedId: string | null): string | null {
  if (coach.id === mostBookedId) return '🔥 ყველაზე მოთხოვნადი'
  if (coach.profileBadge) return `♛ ${coach.profileBadge}`
  const rating = coach.ratingAvg ? Number(coach.ratingAvg) : null
  if (rating !== null && rating >= 4.5 && coach.ratingCount > 0) return '✪ ტოპ რეიტინგი'
  return null
}


// The ♡ on a featured card: a real favourite toggle (Tornike's 2026-10-03 fix — it used to be a
// decorative glyph inside the card link). Signed-out clicks go to login via the favourites context.
function FeaturedHeart({ listingId, className }: { listingId: string; className: string }) {
  const { isFavorite, toggle } = useFavorites()
  const saved = isFavorite(listingId)
  const label = saved ? 'რჩეულებიდან წაშლა' : 'რჩეულებში შენახვა'
  return (
    <button
      type="button"
      className={`${className}${saved ? ' saved' : ''}`}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void toggle(listingId)
      }}
    >
      {saved ? '♥' : '♡'}
    </button>
  )
}

export default function Home() {
  const fromPrice = useCoachingFromPrice()
  const { user } = useAuth()
  const { games, waveRank } = useShell()
  const [featured, setFeatured] = useState<PublicListingSummary[] | null>(null)
  const [keys, setKeys] = useState<PublicListingSummary[]>([])
  const [coaches, setCoaches] = useState<PublicCoachSummary[]>([])
  // Featured tournaments (owner 2026-10-24): up to three open / upcoming ones rotate every 6 seconds,
  // swipe or dots switch them, each card links to its own tournament.
  const [tournaments, setTournaments] = useState<PublicTournamentSummary[]>([])
  const [tourIndex, setTourIndex] = useState(0)
  const [tourHover, setTourHover] = useState(false)
  const tournament = tournaments.length ? tournaments[tourIndex % tournaments.length] : null
  const nextTour = useCallback(() => setTourIndex((i) => (tournaments.length ? (i + 1) % tournaments.length : 0)), [tournaments.length])
  const prevTour = useCallback(() => setTourIndex((i) => (tournaments.length ? (i - 1 + tournaments.length) % tournaments.length : 0)), [tournaments.length])
  const tourSwipe = useSwipe(prevTour, nextTour)
  useEffect(() => {
    if (tournaments.length < 2 || tourHover) return
    const timer = window.setTimeout(nextTour, 6000)
    return () => window.clearTimeout(timer)
  }, [tournaments.length, tourHover, tourIndex, nextTour])
  const [howStep, setHowStep] = useState(0)
  const steamTrack = useRef<HTMLDivElement>(null)
  const coachTrack = useRef<HTMLDivElement>(null)
  const [steamState, setSteamState] = useState({ atStart: true, atEnd: false, dot: 0 })
  const [coachDot, setCoachDot] = useState(0)
  // Home top hero from the CMS; several published ones rotate (photos 7s, videos to their end).
  const heroBanners = useBanners(BannerPlacement.HomeHero)
  const heroRotation = useBannerRotation(heroBanners)
  const hero = heroRotation.current
  const touchStartX = useRef(0)

  const slugByName = useMemo(() => new Map(games.map((g) => [g.name, g.slug])), [games])
  const slugById = useMemo(() => new Map(games.map((g) => [g.gameId, g.slug])), [games])
  // Every game, as a strip that slides sideways (owner 2026-10-15: "slide to the right through all
  // the games, like the Steam games").
  const gridGames = games
  const gamesTrack = useRef<HTMLDivElement>(null)
  const [gamesEdge, setGamesEdge] = useState({ atStart: true, atEnd: false })
  const updateGamesEdge = useCallback(() => {
    const track = gamesTrack.current
    if (!track) return
    setGamesEdge({ atStart: track.scrollLeft <= 4, atEnd: track.scrollLeft + track.clientWidth >= track.scrollWidth - 4 })
  }, [])
  useEffect(() => {
    updateGamesEdge()
    window.addEventListener('resize', updateGamesEdge)
    return () => window.removeEventListener('resize', updateGamesEdge)
  }, [updateGamesEdge, games.length])
  const scrollGames = (direction: number) => {
    const track = gamesTrack.current
    if (!track) return
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: 'smooth' })
  }

  useEffect(() => {
    api
      .browseListings({ featured: true, limit: 3 })
      .then((res) => setFeatured(res.items))
      .catch(() => setFeatured([]))
    api
      .browseListings({ type: ListingType.DigitalKey, limit: 16 })
      .then((res) => setKeys(res.items))
      .catch(() => setKeys([]))
    // Staff-featured coaches (Admin → Coaches, client feedback #2); the top-rated ones until staff
    // feature anyone.
    api
      .browseCoaches({ featured: true, limit: 3 })
      .then(async (featuredRes) => {
        if (featuredRes.items.length > 0) return featuredRes.items.slice(0, 3)
        const res = await api.browseCoaches({ limit: 12 })
        return [...res.items].sort((a, b) => Number(b.ratingAvg ?? 0) - Number(a.ratingAvg ?? 0) || b.ratingCount - a.ratingCount).slice(0, 3)
      })
      .then((items) => setCoaches(items))
      .catch(() => setCoaches([]))
    Promise.all([
      api.browseTournaments({ status: TournamentStatus.Open, limit: 3 }),
      api.browseTournaments({ status: TournamentStatus.Upcoming, limit: 3 }),
    ])
      .then(([open, upcoming]) => {
        const seen = new Set<string>()
        setTournaments([...open.items, ...upcoming.items].filter((t) => !seen.has(t.id) && !!seen.add(t.id)).slice(0, 3))
      })
      .catch(() => setTournaments([]))
  }, [])

  // featured-items-fallback: set on <body> by the prototype when there are no listings to feature.
  useEffect(() => {
    const fallback = featured !== null && featured.length === 0
    document.body.classList.toggle('featured-items-fallback', fallback)
    return () => document.body.classList.remove('featured-items-fallback')
  }, [featured])

  const updateSteam = () => {
    const track = steamTrack.current
    if (!track) return
    const max = Math.max(0, track.scrollWidth - track.clientWidth)
    const progress = max ? track.scrollLeft / max : 0
    setSteamState({ atStart: track.scrollLeft <= 2, atEnd: track.scrollLeft >= max - 2, dot: Math.round(progress * 2) })
  }

  useEffect(() => {
    updateSteam()
    window.addEventListener('resize', updateSteam)
    return () => window.removeEventListener('resize', updateSteam)
  }, [keys])

  const scrollSteam = (direction: number) => {
    const track = steamTrack.current
    if (!track) return
    const card = track.querySelector<HTMLElement>('.home-steam-card')
    const gap = parseFloat(getComputedStyle(track).columnGap) || 12
    const step = card ? card.getBoundingClientRect().width + gap : track.clientWidth
    const visible = step ? Math.max(1, Math.floor((track.clientWidth + gap) / step)) : 1
    track.scrollBy({ left: direction * step * visible, behavior: 'smooth' })
  }

  // The phone carousel opens on the middle coach, with neighbours visible left and right and manual
  // swiping either way (owner, 2026-10-07). No-op when every card fits (desktop grid).
  useEffect(() => {
    const track = coachTrack.current
    if (!track || coaches.length < 2) return
    const frame = requestAnimationFrame(() => {
      if (track.scrollWidth <= track.clientWidth + 2) return
      const middle = track.children[Math.floor(coaches.length / 2)] as HTMLElement | undefined
      if (!middle) return
      // Fires the track's onScroll, which moves the dot to the middle card too.
      track.scrollLeft = middle.offsetLeft + middle.offsetWidth / 2 - track.clientWidth / 2
    })
    return () => cancelAnimationFrame(frame)
  }, [coaches])

  const scrollCoaches = (direction: number) => {
    const track = coachTrack.current
    if (!track) return
    const step = track.querySelector<HTMLElement>('.featured-coach')?.offsetWidth || 260
    track.scrollBy({ left: direction * (step + 12), behavior: 'smooth' })
  }

  const updateCoachDot = () => {
    const track = coachTrack.current
    if (!track) return
    const center = track.scrollLeft + track.clientWidth / 2
    let best = { index: 0, distance: Infinity }
    Array.from(track.children).forEach((child, index) => {
      const el = child as HTMLElement
      const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center)
      if (distance < best.distance) best = { index, distance }
    })
    setCoachDot(best.index)
  }

  const showHow = (index: number) => setHowStep((index + HOW_STEPS.length) % HOW_STEPS.length)

  const featuredCard = (listing: PublicListingSummary) => {
    const slug = listing.game?.slug ?? undefined
    const image = listingImage(listing, slug)
    const href = `/listings/${listing.id}`
    return (
      <article key={listing.id} className="home-featured-card">
        <Link
          className="home-featured-image"
          href={href}
          aria-label={`View ${listing.title}`}
          style={image ? { backgroundImage: `linear-gradient(180deg, rgba(8, 5, 14, .02), rgba(8, 5, 14, .18)), url("${image}")` } : undefined}
        >
          {image ? '' : (listing.game?.name ?? 'WH').slice(0, 2).toUpperCase()}
        </Link>
        <FeaturedHeart listingId={listing.id} className="home-featured-heart" />
        <div className="home-featured-copy">
          <h3>
            <Link href={href}>{listing.title}</Link>
          </h3>
          <p>
            {listing.game?.name ?? 'Marketplace'} / {typeLabel(listing)}
          </p>
          <footer>
            <strong>{listingPrice(listing)} GEL</strong>
            <Link href={href}>დეტალების ნახვა</Link>
          </footer>
        </div>
      </article>
    )
  }

  return (
    <Layout
      bodyClass="home-page"
      description="WaveHubX — გეიმინგ მარკეტფლეისი: ანგარიშები, სერვისები, ქოუჩინგი, ტურნირები და ციფრული გასაღებები ერთ სივრცეში."
    >
      <section className="mobile-account-overview" aria-label="Account overview">
        <article className="mobile-account-card">
          <div className="mobile-account-avatar-wrap">
            <span className="mobile-account-avatar avatar avatar-hot" id="mobileProfileAvatar">
              {user ? (user.firstName?.[0] ?? user.username[0]).toUpperCase() : '?'}
            </span>
            <span className="mobile-account-level">
              Lv. <strong id="mobileProfileLevel">{waveRank?.level ?? 1}</strong>
            </span>
            {user && <span className="mobile-account-online" aria-label="ონლაინ"></span>}
          </div>
          <div className="mobile-account-copy">
            <h2>
              <span id="mobileProfileUsername">{user?.username ?? 'სტუმარი'}</span>
              {user?.status === 'active' && <i aria-label="Verified">✓</i>}
            </h2>
            <p>
              <RankIcon name={waveRank?.name} className="profile-rank-icon" />
              <strong id="mobileProfileRank">{waveRank?.name ?? 'Starter'}</strong>
            </p>
            <Link href={user ? '/profile' : '/login'}>
              პროფილის ნახვა <span aria-hidden="true">›</span>
            </Link>
          </div>
        </article>

        <Link className="mobile-account-shortcut mobile-wallet-shortcut" href={user ? '/wallet' : '/login?next=/wallet'}>
          <span className="mobile-shortcut-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 7.5h14.5a2 2 0 0 1 2 2v9H6a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3h11v5" /><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" /></svg>
          </span>
          <span>
            <small>ხელმისაწვდომი ბალანსი</small>
            <strong>
              <span id="mobileWalletBalance">{gel(user?.wavecoinBalance)}</span> GEL
            </strong>
          </span>
          <span className="mobile-shortcut-arrow" aria-hidden="true">
            ›
          </span>
        </Link>

        <Link className="mobile-account-shortcut mobile-orders-shortcut" href={user ? '/orders' : '/login?next=/orders'}>
          <span className="mobile-shortcut-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></svg>
          </span>
          <strong>ჩემი შეკვეთები</strong>
          <span className="mobile-shortcut-arrow" aria-hidden="true">
            ›
          </span>
        </Link>
      </section>

      <div className="home-dashboard-grid">
        <div className="home-dashboard-main">
          <section className="content-section home-marketplace-showcase" aria-labelledby="home-marketplace-title">
            {/* The top hero only renders a published CMS banner. The former static marketplace-cover
                fallback was removed at the owner's request. */}
            {hero && <HeroBanner banner={hero} rotation={heroRotation} banners={heroBanners} />}

            {/* The same services row on phones and desktop (owner 2026-10-15; phones had their own,
                different list). */}
            <section className="home-explore" aria-labelledby="homeExploreTitle">
              {/* Phones (round 4, 02.jpg): a card header — star, "Services", "View all". */}
              <div className="home-explore-head">
                <strong>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
                  </svg>
                  სერვისები
                </strong>
                <Link href="/services">
                  ყველას ნახვა <span aria-hidden="true">›</span>
                </Link>
              </div>
              <h2 id="homeExploreTitle">
                <i aria-hidden="true"></i> გაეცანი ჩვენს <b>სერვისებს</b> <i aria-hidden="true"></i>
              </h2>
              <div className="home-explore-grid">
                {EXPLORE_SERVICES.map((service) =>
                  service.href ? (
                    <Link key={service.label} href={service.href}>
                      {service.icon ? <svg viewBox="0 0 32 32" aria-hidden="true">{service.icon}</svg> : <img src="/assets/steam-logo.png" alt="" aria-hidden="true" />}
                      <span>{service.label}</span>
                    </Link>
                  ) : (
                    <span key={service.label} className="soon" aria-disabled="true">
                      <svg viewBox="0 0 32 32" aria-hidden="true">{service.icon}</svg>
                      <span>{service.label}</span>
                    </span>
                  ),
                )}
              </div>
            </section>

            <div className="home-marketplace-heading">
              <h2 id="home-marketplace-title">
                <img src="/assets/marketplace-icon.svg" alt="" />
                <span className="desktop-marketplace-title">მარკეტი</span>
                <span className="mobile-marketplace-title">პოპულარული თამაშები</span>
              </h2>
              <Link className="home-marketplace-heading-link" href="/marketplace">
                ყველას ნახვა <span aria-hidden="true">›</span>
              </Link>
            </div>

            <div className="home-games-carousel">
              <button className="home-steam-arrow home-steam-prev" type="button" aria-label="Previous games" disabled={gamesEdge.atStart} onClick={() => scrollGames(-1)}>
                ‹
              </button>
            <div className="home-marketplace-game-grid" aria-label="Marketplace games" ref={gamesTrack} onScroll={() => requestAnimationFrame(updateGamesEdge)}>
              {gridGames.map((game) => (
                <Link
                  key={game.slug}
                  className="home-marketplace-game-card"
                  href={`/marketplace?game=${game.slug}`}
                  data-marketplace-game={game.name}
                  aria-label={`${game.name}: ${game.activeListingCount}`}
                >
                  <span
                    className="home-marketplace-game-image"
                    aria-hidden="true"
                    style={gameTile(game.slug) ? { background: `url("${gameTile(game.slug)}") center / cover no-repeat` } : undefined}
                  ></span>
                  <span className="home-marketplace-game-info">
                    <strong>{gameDisplayName(game.name)}</strong>
                    <small data-marketplace-count="">
                      {game.activeListingCount.toLocaleString('en-US')} ნივთი
                    </small>
                    <i aria-hidden="true">›</i>
                  </span>
                </Link>
              ))}
            </div>
              <button className="home-steam-arrow home-steam-next" type="button" aria-label="Next games" disabled={gamesEdge.atEnd} onClick={() => scrollGames(1)}>
                ›
              </button>
            </div>

            <Link className="home-marketplace-view-all" href="/marketplace">
              ყველა თამაშის ნახვა <span aria-hidden="true">›</span>
            </Link>
          </section>
        </div>

        <aside className="home-right-rail" aria-label="Featured marketplace items" hidden={!featured || featured.length === 0}>
          <section className="home-featured-items" aria-labelledby="homeFeaturedTitle">
            <header className="home-featured-heading">
              <span className="home-featured-spark" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none"><path d="M16 2.5 18.9 13l10.6 3-10.6 3L16 29.5 13.1 19 2.5 16l10.6-3L16 2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="m24.5 4 .9 3.1 3.1.9-3.1.9-.9 3.1-.9-3.1-3.1-.9 3.1-.9.9-3.1Z" fill="currentColor" /></svg>
              </span>
              <h2 id="homeFeaturedTitle">რჩეული ნივთები</h2>
            </header>
            <div className="home-featured-list" id="homeFeaturedItems">
              {(featured ?? []).slice(0, 2).map(featuredCard)}
            </div>
            <p className="home-featured-empty" id="homeFeaturedEmpty" hidden={!!featured && featured.length > 0}>
              რჩეული მარკეტფლეისის ნივთები აქ გამოჩნდება.
            </p>
            <Link className="home-featured-view-all" href="/marketplace">
              ყველა ნივთის ნახვა <span aria-hidden="true">›</span>
            </Link>
          </section>
        </aside>
      </div>

      <HomeBanners />

      <section className="content-section home-competition-section" id="competition" aria-labelledby="competitionTitle">
        <header className="competition-heading">
          <h2 id="competitionTitle" data-i18n-keep="">
            <span aria-hidden="true">✦</span> Coaching <em>&amp;</em> Tournaments <span aria-hidden="true">✦</span>
          </h2>
          <span>ივარჯიშეთ საუკეთესოთა გვერდით. იბრძოლეთ გამარჯვებისთვის.</span>
        </header>

        <div className="competition-showcase">
          <article className="competition-panel coaching-preview">
            <header className="competition-panel-title">
              <span className="competition-title-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48"><path d="M9 28v-5a15 15 0 0 1 30 0v5M9 27H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h5V27H9Zm30 0h3a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5V27h2Zm-2 14c0 3-3 4-7 4" /></svg>
              </span>
              <div>
                <h3>საუკეთესო ქოუჩები</h3>
                <p>ინდივიდუალური სესიები. რეალური შედეგები.</p>
              </div>
              <Link className="competition-panel-all" href="/coaching">
                ყველას ნახვა <b aria-hidden="true">→</b>
              </Link>
            </header>

            <div className="featured-coaches" ref={coachTrack} onScroll={() => requestAnimationFrame(updateCoachDot)}>
              {coaches.length === 0 ? (
                <p className="home-featured-empty">ჯერ ქოუჩები არ არის.</p>
              ) : (
                coaches.map((coach, index) => {
                  const slug = coach.gameSlug ?? (coach.gameName ? slugByName.get(coach.gameName) : undefined)
                  const cover = coach.avatarUrl ?? gameCover(slug)
                  const mostBookedId = coaches.reduce<PublicCoachSummary | null>((best, c) => (c.completedSessions > (best?.completedSessions ?? 0) ? c : best), null)?.id ?? null
                  const rating = coach.ratingAvg ? Number(coach.ratingAvg).toFixed(1) : null
                  const badge = coachBadge(coach, mostBookedId)
                  return (
                    // Design 2026-10-07 ("thirdproblemfix", 1:1): the coach's photo fills the card;
                    // the badge and "Verified" pills sit on top, name / game / rating / tag / price at
                    // the bottom over a dark fade.
                    <Link
                      key={coach.id}
                      className={`featured-coach fc-card${index === coachDot ? ' is-active' : ''}${cover ? '' : ' no-photo'}`}
                      href={`/coaching/${coach.id}`}
                      aria-label={`${coach.firstName} ${coach.lastName}`}
                      style={cover ? { backgroundImage: `url("${cover}")` } : undefined}
                    >
                      <span className="fc-top">
                        {badge && <span className="fc-pill">{badge.replace(/^[^\p{L}]+/u, '').replace('ყველაზე მოთხოვნადი', 'პოპულარული')}</span>}
                        <span className="fc-pill fc-verified">
                          <b aria-hidden="true">♛</b> ვერიფიცირებული
                        </span>
                      </span>
                      {!cover && (
                        <span className="fc-initials" aria-hidden="true">
                          {`${coach.firstName.charAt(0)}${coach.lastName.charAt(0)}`.toUpperCase()}
                        </span>
                      )}
                      {coach.online && (
                        <em className="fc-online">
                          <i aria-hidden="true"></i>ონლაინ
                        </em>
                      )}
                      <span className="fc-bottom">
                        <span className="fc-name-row">
                          <span className="fc-name">
                            <strong>{coach.firstName}</strong>
                            <b className="fc-check" aria-label="ვერიფიცირებული ქოუჩი">✓</b>
                          </span>
                          {coach.ratingCount > 0 && rating && (
                            <span className="fc-rating">
                              <b aria-hidden="true">★</b>
                              {rating}
                              <small>{`(${coach.ratingCount} შეფასება)`}</small>
                            </span>
                          )}
                        </span>
                        {coach.gameName && <span className="fc-game">{coach.gameName}</span>}
                        <span className="fc-tag">
                          <span aria-hidden="true">🎓</span>
                          ქოუჩი
                        </span>
                        <span className="fc-price">
                          {fromPrice !== null ? (
                            <>
                              {fromPrice}₾ <small>-დან</small>
                            </>
                          ) : (
                            <>
                              {coach.hourlyRateWaveCoin} GEL <small>/ საათი</small>
                            </>
                          )}
                        </span>
                      </span>
                    </Link>
                  )
                })
              )}
            </div>

            <div className="featured-coach-carousel" aria-label="Coach carousel controls">
              <div className="featured-coach-dots" aria-hidden="true">
                {Array.from({ length: Math.max(1, coaches.length) }).map((_, index) => (
                  <i key={index} className={index === coachDot ? 'active' : undefined}></i>
                ))}
              </div>
              <div className="featured-coach-arrows">
                <button type="button" aria-label="Previous coach" onClick={() => scrollCoaches(-1)}>
                  ‹
                </button>
                <button type="button" aria-label="Next coach" onClick={() => scrollCoaches(1)}>
                  ›
                </button>
              </div>
            </div>

            <Link className="competition-button" href="/coaching">
              <span aria-hidden="true">☺</span> ყველა ქოუჩის ნახვა <b aria-hidden="true">→</b>
            </Link>
            <ul className="competition-perks">
              <li><b aria-hidden="true">◉</b><span>ინდივიდუალური ქოუჩინგი<small>პერსონალიზებული მხარდაჭერა</small></span></li>
              <li><b aria-hidden="true">◎</b><span>პროფესიონალური სტრატეგიები<small>ისწავლეთ საუკეთესოებისგან</small></span></li>
              <li><b aria-hidden="true">↗</b><span>პროგრესის მონიტორინგი<small>იხილეთ რეალური გაუმჯობესება</small></span></li>
              <li><b aria-hidden="true">♧</b><span>ნებისმიერი უნარის დონე<small>დამწყებიდან პროფესიონალამდე</small></span></li>
            </ul>
          </article>

          <div className="competition-bridge" aria-hidden="true">
            <svg className="coach-connection-lines" viewBox="0 0 260 100" preserveAspectRatio="none">
              <path d="M0 31 H43 Q66 31 66 39 V61 Q66 69 43 69 H0" />
            </svg>
            <span className="bridge-line bridge-top"></span>
            <span className="bridge-trophy">
              <svg viewBox="0 0 64 64"><path d="M20 10h24v11c0 10-5 17-12 17s-12-7-12-17V10Zm0 5H10v6c0 8 5 12 12 12m22-18h10v6c0 8-5 12-12 12M32 38v9m-10 7h20M26 47h12l3 7H23l3-7Z" /><path d="m32 16 2 4 5 .7-3.5 3.4.8 4.9-4.3-2.3-4.3 2.3.8-4.9-3.5-3.4 5-.7 2-4Z" /></svg>
            </span>
            <span className="bridge-line bridge-bottom"></span>
            <p>
              Train.
              <br />
              Improve.
              <br />
              Compete.
            </p>
          </div>

          <article className="competition-panel tournament-preview">
            <header className="competition-panel-title">
              <span className="competition-title-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48"><path d="M15 7h18v8c0 9-4 15-9 15s-9-6-9-15V7Zm0 5H7v4c0 7 4 10 10 10m16-14h8v4c0 7-4 10-10 10M24 30v7m-8 5h16m-12-5h8l2 5H18l2-5Z" /><path d="m24 12 1.5 3 3.5.5-2.5 2.5.6 3.5-3.1-1.7-3.1 1.7.6-3.5-2.5-2.5 3.5-.5 1.5-3Z" /></svg>
              </span>
              <div>
                <h3>რჩეული ტურნირი</h3>
                <p>ითამაშე. გაიმარჯვე. დატოვე კვალი.</p>
              </div>
              <Link className="competition-panel-all" href="/tournaments">
                ყველას ნახვა <b aria-hidden="true">→</b>
              </Link>
            </header>

            {tournament ? (
              <div className="featured-tournament" {...tourSwipe} onMouseEnter={() => setTourHover(true)} onMouseLeave={() => setTourHover(false)} aria-roledescription="carousel">
                <Link
                  key={tournament.id}
                  href={tournamentPrimaryHref(tournament)}
                  aria-label={tournament.name}
                  className={`tournament-cover tour-slide${tournament.coverImageUrl ? ' has-photo' : ''}`}
                  data-title={tournament.coverImageUrl ? undefined : (() => {
                    // The cover's big two-line title (the design's "WAVE / CUP") is the real name.
                    const words = tournament.name.toUpperCase().split(/\s+/)
                    const half = Math.ceil(words.length / 2)
                    return `${words.slice(0, half).join(' ')}\n${words.slice(half).join(' ')}`.trim()
                  })()}
                  style={{
                    backgroundImage: `linear-gradient(0deg, rgba(9, 1, 18, .62), rgba(9, 4, 25, .08)), url("${tournament.coverImageUrl ?? gameCover(slugById.get(tournament.gameId)) ?? '/assets/cs2-marketplace-cover.png'}")`,
                  }}
                />
                {tournaments.length > 1 && (
                  <span className="tour-dots">
                    {tournaments.map((t, i) => (
                      <button
                        key={t.id}
                        type="button"
                        aria-label={t.name}
                        aria-current={i === tourIndex % tournaments.length}
                        className={i === tourIndex % tournaments.length ? 'active' : undefined}
                        onClick={() => setTourIndex(i)}
                      />
                    ))}
                  </span>
                )}
                <div className="tournament-copy">
                  <h4>{tournament.name}</h4>
                  <p>
                    <span className="featured-tournament-game">{tournament.gameName}</span>
                    {[tournament.details?.format || (tournament.teamSize > 1 ? `${tournament.teamSize}v${tournament.teamSize}` : 'Solo'), tournament.details?.bracketType, tournament.details?.platform]
                      .filter(Boolean)
                      .map((fact) => (
                        <span key={fact} className="featured-tournament-tag">
                          {fact}
                        </span>
                      ))}
                  </p>
                  <dl>
                    <div>
                      <dt>
                        <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 7h18v8c0 9-4 15-9 15s-9-6-9-15V7Z" /><path d="M15 12H7v4c0 7 4 10 10 10m16-14h8v4c0 7-4 10-10 10M24 30v7m-8 5h16m-12-5h8l2 5H18l2-5Z" /><path d="m24 12 1.5 3 3.5.5-2.5 2.5.6 3.5-3.1-1.7-3.1 1.7.6-3.5-2.5-2.5 3.5-.5 1.5-3Z" /></svg>
                        <span>საპრიზო ფონდი</span>
                      </dt>
                      <dd>{tournament.prize}</dd>
                    </div>
                    <div>
                      <dt>
                        <svg viewBox="0 0 48 48" aria-hidden="true"><g transform="rotate(-24 24 24)"><path d="M8 15h32v8a5 5 0 0 0 0 10v8H8v-8a5 5 0 0 0 0-10v-8Z" /><path d="M29 15v5m0 5v5m0 5v6" /><path d="m19 23 1.7 3.4 3.8.6-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.6L19 23Z" /></g></svg>
                        <span>შესვლის საფასური</span>
                      </dt>
                      <dd>{tournament.details?.entryFee || 'უფასო'}</dd>
                    </div>
                    <div>
                      <dt>
                        <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="14" r="6" /><circle cx="10.5" cy="18" r="4.5" /><circle cx="37.5" cy="18" r="4.5" /><path d="M14 39v-4c0-7 4-11 10-11s10 4 10 11v4M2 38v-3c0-6 3-9 8-9 2 0 4 .7 5.4 2M46 38v-3c0-6-3-9-8-9-2 0-4 .7-5.4 2" /></svg>
                        <span>{tournament.teamSize > 1 ? 'გუნდები' : 'მოთამაშეები'}</span>
                      </dt>
                      <dd>{tournament.teamSize > 1 ? `${tournament.teamCount} / ${tournament.maxTeams}` : `${tournament.registeredCount} / ${tournament.maxPlayers}`}</dd>
                    </div>
                    <div>
                      <dt>
                        <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="10" width="34" height="32" rx="4" /><path d="M15 6v8m18-8v8M7 19h34M15 26h3m6 0h3m6 0h3m-21 8h3m6 0h3m6 0h3" /></svg>
                        <span>თარიღი</span>
                      </dt>
                      <dd>{kaDayMonth(tournament.startDate)}</dd>
                    </div>
                  </dl>
                  <Link className="competition-button tour-register" href={tournamentPrimaryHref(tournament)}>
                    დარეგისტრირდი <b aria-hidden="true">→</b>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="home-featured-empty">ჯერ ტურნირები არ არის.</p>
            )}
            <ul className="competition-perks tournament-perks">
              <li><b aria-hidden="true">⌁</b><span>დაძაბული მატჩები<small>მაღალი დონის შეჯიბრება</small></span></li>
              <li><b aria-hidden="true">◉</b><span>განავითარე შენი გუნდი<small>აჩვენე შენი უნარი</small></span></li>
              <li><b aria-hidden="true">✦</b><span>მოიგე ჯილდოები<small>ფულადი და ექსკლუზიური პრიზები</small></span></li>
              <li><b aria-hidden="true">◎</b><span>შემოუერთდი საზოგადოებას<small>ითამაშე. შეეჯიბრე. იყავი ნაწილი.</small></span></li>
            </ul>
          </article>
        </div>
      </section>

      <section className="content-section home-steam-section" id="homeSteamGames" aria-labelledby="homeSteamTitle">
        <header className="home-steam-heading">
          <div className="home-steam-title-wrap">
            <span className="home-steam-logo" aria-hidden="true">
              <img src="/assets/steam-logo.png" alt="" />
            </span>
            <div>
              <h2 id="homeSteamTitle">Steam თამაშები</h2>
              <p>იყიდეთ ციფრული გასაღებები და კოდები საუკეთესო ფასად. მყისიერი მიწოდება, 100% უსაფრთხოდ.</p>
            </div>
          </div>
          <Link href="/steam-keys">
            ყველას ნახვა <span aria-hidden="true">→</span>
          </Link>
        </header>

        <div className="home-steam-carousel">
          <button className="home-steam-arrow home-steam-prev" type="button" aria-label="Previous Steam games" disabled={steamState.atStart} onClick={() => scrollSteam(-1)}>
            ‹
          </button>
          <div className="home-steam-track" id="homeSteamTrack" ref={steamTrack} onScroll={() => requestAnimationFrame(updateSteam)}>
            {keys.length === 0 ? (
              <p className="home-featured-empty">ციფრული გასაღებები ჯერ არ არის.</p>
            ) : (
              keys.map((listing) => {
                const cover = listingImage(listing, listing.game?.slug)
                const inStock = (listing.stockQuantity ?? 0) > 0
                return (
                  <Link key={listing.id} className="home-steam-card" href={`/listings/${listing.id}`}>
                    <span
                      className="home-steam-cover"
                      aria-label={listing.title}
                      style={cover ? { backgroundImage: `linear-gradient(180deg, transparent 65%, #06050d), url("${cover}")` } : undefined}
                    ></span>
                    <span className="home-steam-platform">
                      <b className="steam-mark" aria-hidden="true">
                        S
                      </b>{' '}
                      Steam გასაღები
                    </span>
                    <strong>
                      <span className="home-steam-cart" aria-hidden="true">
                        🛒
                      </span>{' '}
                      {listingPrice(listing)} GEL
                    </strong>
                    <span className="home-steam-mobile-body">
                      <strong className="home-steam-mobile-title">{listing.title}</strong>
                      <span className="home-steam-mobile-description">{listing.game?.name ?? ''}</span>
                      <span className="home-steam-mobile-price-row">
                        <b>{listingPrice(listing)} GEL</b>
                        <i>
                          <span></span>
                          {inStock ? 'მარაგშია' : 'ამოიწურა'}
                        </i>
                      </span>
                      <span className="home-steam-mobile-details">
                        დეტალების ნახვა <b aria-hidden="true">→</b>
                      </span>
                    </span>
                  </Link>
                )
              })
            )}
          </div>
          <button className="home-steam-arrow home-steam-next" type="button" aria-label="Next Steam games" disabled={steamState.atEnd} onClick={() => scrollSteam(1)}>
            ›
          </button>
        </div>
        <div className="home-steam-dots" aria-hidden="true">
          {[0, 1, 2].map((dot) => (
            <i key={dot} className={dot === steamState.dot ? 'active' : undefined}></i>
          ))}
        </div>
      </section>

      <section className="featured-items" id="mobileFeaturedItems" aria-labelledby="mobileFeaturedItemsTitle">
        <header className="featured-items-heading">
          <div className="featured-items-title">
            <span className="featured-items-spark" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none"><path d="M16 2.5 18.9 13l10.6 3-10.6 3L16 29.5 13.1 19 2.5 16l10.6-3L16 2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="m24.5 4 .9 3.1 3.1.9-3.1.9-.9 3.1-.9-3.1-3.1-.9 3.1-.9.9-3.1Z" fill="currentColor" /></svg>
            </span>
            <h2 id="mobileFeaturedItemsTitle">რჩეული ნივთები</h2>
          </div>
          <Link href="/marketplace">
            ყველას ნახვა <span aria-hidden="true">→</span>
          </Link>
        </header>
        <div className="featured-items-grid" id="mobileFeaturedItemsList">
          {(featured ?? []).slice(0, 3).map((listing) => {
            const image = listingImage(listing, listing.game?.slug)
            return (
              <article key={listing.id} className="featured-item-card">
                <FeaturedHeart listingId={listing.id} className="featured-item-save" />
                <Link href={`/listings/${listing.id}`}>
                <span className="mobile-featured-product-image" style={image ? { backgroundImage: `url("${image}")` } : undefined}>
                  {image ? '' : (listing.game?.name ?? 'WH').slice(0, 2).toUpperCase()}
                </span>
                <strong>{listing.title}</strong>
                <small>{typeLabel(listing)}</small>
                <b>{listingPrice(listing)} GEL</b>
                <span className="featured-item-action">
                  დეტალების ნახვა <i aria-hidden="true">→</i>
                </span>
                </Link>
              </article>
            )
          })}
        </div>
        <p className="featured-items-empty" id="mobileFeaturedItemsEmpty" hidden={!featured || featured.length > 0}>
          ამ ეტაპზე Featured Item-ები არ არის.
        </p>
      </section>

      <section className="home-cta" aria-labelledby="homeCtaTitle">
        <span className="home-cta-mark" aria-hidden="true">
          <img src="/assets/logo-wavehubx-main.png" alt="" />
        </span>
        <div>
          <h2 id="homeCtaTitle">
            მზად ხარ <b>დონის ასაწევად?</b>
          </h2>
          <p>შემოუერთდი მოთამაშეებს, რომლებიც WaveHubX-ზე ვარჯიშობენ, ეჯიბრებიან და იმარჯვებენ.</p>
        </div>
        <Link className="home-cta-button" href={user ? '/marketplace' : '/register'}>
          {user ? 'მარკეტის დათვალიერება' : 'შემოუერთდი WaveHubX-ს'} <b aria-hidden="true">→</b>
        </Link>
      </section>

      <section className="content-section home-how-section" id="how-it-works" aria-labelledby="howTitle">
        <div className="how-page">
          <header className="how-hero">
            <p className="how-eyebrow">როგორ მუშაობს</p>
            <h1 id="howTitle">
              ნახეთ როგორ მუშაობს <em>WaveHubX</em>.
            </h1>
            <p>შეეხეთ ეტაპს, რომ მეტი გაიგოთ თითოეულის შესახებ.</p>
          </header>

          <div className="how-stepper" role="tablist" aria-label="How WaveHubX works">
            {HOW_STEPS.map((step, index) => (
              <button
                key={step.step}
                className={`how-step${index === howStep ? ' is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={index === howStep}
                data-step={index}
                onClick={() => showHow(index)}
              >
                <i>{index + 1}</i>
                <strong>{step.step}</strong>
              </button>
            ))}
          </div>

          <div
            className="how-slider"
            id="howSlider"
            aria-live="polite"
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0].clientX
            }}
            onTouchEnd={(event) => {
              const distance = event.changedTouches[0].clientX - touchStartX.current
              if (Math.abs(distance) > 45) showHow(howStep + (distance < 0 ? 1 : -1))
            }}
          >
            <div className="how-slides">
              {HOW_STEPS.map((step, index) => (
                <article key={step.step} className={`how-slide${index === howStep ? ' is-active' : ''}`} data-slide={index} hidden={index !== howStep}>
                  <div className="how-detail-copy">
                    <h2>{step.step}</h2>
                    <p>{step.lead}</p>
                    <div className="how-features">
                      {step.features.map((feature) => (
                        <div key={feature.title} className="how-feature">
                          <span>{feature.icon}</span>
                          <strong>{feature.title}</strong>
                          <small>{feature.text}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="content-section home-faq-section" id="faq" aria-labelledby="faqTitle">
        <div className="faq-page">
          <header className="faq-hero">
            <p className="faq-eyebrow">
              <span></span>
              <b>FAQ</b>
              <span></span>
            </p>
            <h1 id="faqTitle">
              ხშირად დასმული <em>კითხვები</em>
            </h1>
            <p>იპოვეთ პასუხები ყველაზე ხშირად დასმულ კითხვებზე.</p>
          </header>

          <div className="faq-grid">
            {FAQS.map((faq) => (
              <details key={faq.q} className="faq-card">
                <summary>
                  <span className="faq-question-mark">?</span>
                  <span className="faq-question-copy">
                    <strong>{faq.q}</strong>
                    <small>{faq.s}</small>
                  </span>
                  <i></i>
                </summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>

          <section className="faq-support-banner" aria-labelledby="faqSupportTitle">
            <span className="faq-support-icon" aria-hidden="true">
              •••
            </span>
            <div>
              <h2 id="faqSupportTitle">კითხვები კვლავ გაქვთ?</h2>
              <p>ჩვენი მხარდაჭერის გუნდი მზად არის დაგეხმაროთ.</p>
            </div>
            <Link href={user ? '/support/chat' : '/login?next=/support/chat'}>
              დაუკავშირდი საფორთს <strong aria-hidden="true">→</strong>
            </Link>
          </section>
        </div>
      </section>
    </Layout>
  )
}

// The home top banner from the CMS (owner 2026-10-07): the photo alone unless text was entered —
// then a big title, the smaller subtitle and (only when button text is set) the button, on the
// left like the previous banner. Without a button the whole banner is the link. A video banner
// (2026-10-24) plays muted with no photo behind it. Round 4 (02.jpg): a large centred play button
// (turns the sound on, then pauses / plays), a "▶ label ›" button and the dots centred under it. The
// mockup's "featured coach" block and kicker line are not shown: a banner has no such fields.
function HeroBanner({ banner, banners, rotation }: { banner: PublicBanner; banners: PublicBanner[]; rotation: ReturnType<typeof useBannerRotation> }) {
  const swipe = useSwipe(rotation.prev, rotation.next)
  const title = banner.title?.trim()
  const subtitle = banner.subtitle?.trim()
  const link = banner.linkUrl
  const external = !!link && !link.startsWith('/')
  // Video links use the entire banner as their trigger; their CMS CTA becomes a resume action
  // only while the video is paused, so it never obscures active playback.
  // An uploaded video (banner.videoUrl) plays in the banner itself (BannerVideo) and wins over a link.
  const isVideoLink = !banner.videoUrl && !!link && /(?:youtu\.be\/|youtube\.com\/|vimeo\.com\/|\.(?:mp4|webm)(?:[?#]|$))/i.test(link)
  const button = !banner.videoUrl && !isVideoLink && link && banner.buttonLabel?.trim()
  const kicker = banner.kicker?.trim()
  const videoCtaLabel = banner.buttonLabel?.trim() || 'ვიდეოს გაგრძელება'
  const [videoOpen, setVideoOpen] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const videoEmbed = (() => {
    if (!link || !isVideoLink) return null
    const youtube = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(link)
    if (youtube) return { provider: 'youtube' as const, src: `https://www.youtube.com/embed/${youtube[1]}?autoplay=1&mute=1&playsinline=1&enablejsapi=1&rel=0` }
    const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(link)
    if (vimeo) return { provider: 'vimeo' as const, src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1&playsinline=1` }
    return { provider: 'file' as const, src: link }
  })()

  const toggleMute = () => {
    const nextMuted = !muted
    setMuted(nextMuted)
    if (videoRef.current instanceof HTMLVideoElement) {
      videoRef.current.muted = nextMuted
      return
    }
    if (videoEmbed?.provider === 'youtube') {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: nextMuted ? 'mute' : 'unMute', args: [] }), '*')
    }
    if (videoEmbed?.provider === 'vimeo') {
      iframeRef.current?.contentWindow?.postMessage({ method: 'setVolume', value: nextMuted ? 0 : 1 }, '*')
    }
  }
  const resumeVideo = () => {
    setVideoPlaying(true)
    if (videoRef.current instanceof HTMLVideoElement) {
      void videoRef.current.play()
      return
    }
    if (videoEmbed?.provider === 'youtube') iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*')
    if (videoEmbed?.provider === 'vimeo') iframeRef.current?.contentWindow?.postMessage({ method: 'play' }, '*')
  }

  // Native video reports its state directly. YouTube and Vimeo expose the same state through
  // postMessage, allowing their pause controls to restore the banner CTA as well.
  useEffect(() => {
    if (!videoOpen || !videoEmbed || videoEmbed.provider === 'file') return
    const onMessage = (event: MessageEvent) => {
      let host = ''
      try {
        host = new URL(event.origin).hostname
      } catch {
        return
      }
      if (videoEmbed.provider === 'youtube' && /(^|\.)youtube\.com$/.test(host)) {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
          if (data?.event === 'onStateChange') setVideoPlaying(data.info === 1)
        } catch {
          // Ignore messages unrelated to the YouTube player.
        }
      }
      if (videoEmbed.provider === 'vimeo' && /(^|\.)vimeo\.com$/.test(host) && event.data?.event) {
        if (event.data.event === 'play') setVideoPlaying(true)
        if (event.data.event === 'pause' || event.data.event === 'ended') setVideoPlaying(false)
      }
    }
    window.addEventListener('message', onMessage)
    const timer = window.setTimeout(() => {
      if (videoEmbed.provider === 'youtube') iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }), '*')
      if (videoEmbed.provider === 'vimeo') {
        iframeRef.current?.contentWindow?.postMessage({ method: 'addEventListener', value: 'play' }, '*')
        iframeRef.current?.contentWindow?.postMessage({ method: 'addEventListener', value: 'pause' }, '*')
        iframeRef.current?.contentWindow?.postMessage({ method: 'addEventListener', value: 'ended' }, '*')
      }
    }, 0)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(timer)
    }
  }, [videoOpen, videoEmbed?.provider])
  const copy =
    title || subtitle || button || kicker ? (
      <span className="hero-banner-copy">
        {kicker && <em className="hero-banner-kicker">{kicker}</em>}
        {title && <strong>{title}</strong>}
        {subtitle && <small>{subtitle}</small>}
        {button &&
          (external ? (
            <a className="hero-banner-cta" href={link} target="_blank" rel="noopener noreferrer">
              {button} <b aria-hidden="true">↗</b>
            </a>
          ) : (
            <Link className="hero-banner-cta" href={link}>
              {banner.videoUrl && (
                <svg className="hero-banner-cta-play" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 5v14l12-7z" fill="currentColor" />
                </svg>
              )}
              {button} <b aria-hidden="true">{banner.videoUrl ? '›' : '→'}</b>
            </Link>
          ))}
      </span>
    ) : null
  const image = <img src={banner.imageUrl ?? ''} alt={title || 'WaveHubX'} />
  if (videoEmbed) {
    return (
      <div className={`home-marketplace-cover hero-banner hero-video-banner${videoOpen ? ' is-playing' : ''}`}>
        {videoOpen ? (
          videoEmbed.provider === 'file' ? (
            <video ref={videoRef} className="hero-banner-video" src={videoEmbed.src} autoPlay muted={muted} loop playsInline controls onPlay={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} onEnded={() => setVideoPlaying(false)} />
          ) : (
            <iframe ref={iframeRef} className="hero-banner-video" src={videoEmbed.src} title={title || 'WaveHubX video'} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          )
        ) : (
          <button
            type="button"
            className="hero-video-launch"
            aria-label={`${title || 'ვიდეო'} გახსნა`}
            onClick={() => {
              setVideoPlaying(true)
              setVideoOpen(true)
            }}
          >
            {image}
            <span className="hero-video-play" aria-hidden="true">▶</span>
          </button>
        )}
        {videoOpen && (
          <button type="button" className="hero-video-sound" aria-label={muted ? 'ხმის ჩართვა' : 'ხმის გამორთვა'} onClick={toggleMute}>
            {muted ? '🔇' : '🔊'}
          </button>
        )}
        {videoOpen && !videoPlaying && (
          <button type="button" className="hero-video-resume" onClick={resumeVideo}>
            {videoCtaLabel} <span aria-hidden="true">▶</span>
          </button>
        )}
      </div>
    )
  }
  const wholeLink = link && !button ? link : null
  return (
    <div className={`home-marketplace-cover hero-banner${banner.videoUrl ? ' is-video' : ''}`} {...swipe}>
      {banner.videoUrl ? (
        <BannerVideo
          key={banner.id}
          src={banner.videoUrl}
          className="hero-banner-video"
          loop={rotation.count < 2}
          paused={rotation.paused}
          onPausedChange={rotation.setPaused}
          onEnded={rotation.next}
          bigPlay
        />
      ) : (
        <img src={banner.imageUrl ?? ''} alt={title || 'WaveHubX'} />
      )}
      {wholeLink &&
        (external ? (
          <a className="home-banner-link" href={wholeLink} target="_blank" rel="noopener noreferrer" aria-label={title || 'WaveHubX'} />
        ) : (
          <Link className="home-banner-link" href={wholeLink} aria-label={title || 'WaveHubX'} />
        ))}
      {copy}
      {/* The featured coach (Admin → Banners, owner 2026-10-24 screenshot 02): their real photo, name
          and game, linking to the coach profile. Only verified, active coaches are sent. */}
      {banner.coach && (
        <Link className="hero-banner-coach" href={`/coaching/${banner.coach.id}`}>
          {banner.coach.avatarUrl ? <img src={banner.coach.avatarUrl} alt="" /> : <i aria-hidden="true">{banner.coach.name.slice(0, 1).toUpperCase()}</i>}
          <span>
            <small>რჩეული Coach</small>
            <strong>{banner.coach.name}</strong>
            {banner.coach.gameName && <em>{`${banner.coach.gameName} Coach`}</em>}
          </span>
        </Link>
      )}
      {rotation.count > 1 && (
        <span className="home-banner-dots hero-banner-dots">
          {banners.map((x, i) => (
            <button key={x.id} type="button" aria-label={`ბანერი ${i + 1}`} aria-current={i === rotation.index} className={i === rotation.index ? 'active' : undefined} onClick={() => rotation.setIndex(i)} />
          ))}
        </span>
      )}
    </div>
  )
}

