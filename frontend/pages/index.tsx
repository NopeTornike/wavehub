import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ListingType, TournamentStatus } from '@wavehub/shared-types'
import type { PublicCoachSummary, PublicListingSummary, PublicTournamentSummary } from '@wavehub/shared-types'
import Layout from '../components/Layout'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useShell } from '../lib/shell'
import { gameCover, gameDisplayName, gameTile } from '../lib/games'
import { listingKind, normalizeAccountStatus } from '../components/ProductCard'

// The static prototype's home page (index.html + its inline scripts), section for section and in
// the prototype's final DOM order (its script moves competition/steam/featured/how-it-works in
// front of the FAQ). Real data behind every dynamic part:
//   - game grid: the games table + live per-game active-listing counts (GET /stats/games)
//   - "Featured Items" (right rail on desktop, 3-card strip otherwise): the prototype takes seller
//     listings ordered featured-first then newest — exactly the backend's browse ordering (the
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
  { label: 'მალე', href: null, icon: <><rect x="8" y="14" width="16" height="12" rx="2" /><path d="M11 14v-3a5 5 0 0 1 10 0v3" /></> },
]

const MOBILE_SERVICES: Array<{ label: React.ReactNode; href: string; icon: React.ReactNode }> = [
  { label: 'ქოუჩინგი', href: '/coaching', icon: <path d="M9 20v-5a7 7 0 0 1 14 0v5M9 17H6v7h4v-7H9Zm14 0h3v7h-4v-7h1ZM22 25c0 2-2 3-5 3" /> },
  { label: 'რანკის აწევა', href: '/marketplace', icon: <path d="m6 17 10-10 10 10M11 15v11h10V15M7 22h4M21 22h4" /> },
  { label: 'VOD ანალიზი', href: '/marketplace', icon: <><rect x="5" y="8" width="19" height="17" rx="2" /><path d="m24 13 5-3v13l-5-3M13 13l6 4-6 4v-8Z" /></> },
  { label: 'ლაივ ყურება', href: '/marketplace', icon: <><path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16Z" /><circle cx="16" cy="16" r="4" /></> },
  { label: <>პარამეტრების<br />ოპტიმიზაცია</>, href: '/marketplace', icon: <><circle cx="16" cy="16" r="6" /><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M25 7l-3 3M10 22l-3 3" /></> },
  { label: 'ანგარიშის აუდიტი', href: '/marketplace', icon: <><path d="m16 3 10 4v8c0 7-4 11-10 14C10 26 6 22 6 15V7l10-4Z" /><path d="m11 16 3 3 7-7" /></> },
  { label: 'გუნდის პოვნა', href: '/marketplace', icon: <><circle cx="16" cy="10" r="4" /><circle cx="7" cy="13" r="3" /><circle cx="25" cy="13" r="3" /><path d="M9 27v-3a7 7 0 0 1 14 0v3M2 26v-2a5 5 0 0 1 7-5M30 26v-2a5 5 0 0 0-7-5" /></> },
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
  return kind === 'account' ? 'ანგარიში' : kind === 'skin' ? 'სკინი' : kind === 'key' ? 'გასაღები' : 'სერვისი'
}

// Earned labels only (docs/design-mockups/15): the most-booked coach among those shown, a plan
// badge, top rated, or new.
function coachBadge(coach: PublicCoachSummary, mostBookedId: string | null) {
  if (coach.id === mostBookedId) return '🔥 ყველაზე მოთხოვნადი'
  if (coach.profileBadge) return `♛ ${coach.profileBadge}`
  const rating = coach.ratingAvg ? Number(coach.ratingAvg) : null
  if (rating !== null && rating >= 4.5 && coach.ratingCount > 0) return '✪ ტოპ რეიტინგი'
  if (coach.ratingCount === 0) return '✦ ახალი ქოუჩი'
  return '✓ გადამოწმებული'
}

function specialtyTags(specialty: string) {
  return specialty
    .split(/\s*(?:,|&|\/|\+| and )\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
}

const TOURNAMENT_STATUS: Record<TournamentStatus, string> = {
  [TournamentStatus.Open]: 'რეგისტრაცია ღიაა',
  [TournamentStatus.Upcoming]: 'რეგისტრაცია მალე',
  [TournamentStatus.InProgress]: 'მიმდინარე',
  [TournamentStatus.Completed]: 'დასრულებულია',
}

export default function Home() {
  const { user } = useAuth()
  const { games, waveRank } = useShell()
  const [featured, setFeatured] = useState<PublicListingSummary[] | null>(null)
  const [keys, setKeys] = useState<PublicListingSummary[]>([])
  const [coaches, setCoaches] = useState<PublicCoachSummary[]>([])
  const [tournament, setTournament] = useState<PublicTournamentSummary | null>(null)
  const [howStep, setHowStep] = useState(0)
  const steamTrack = useRef<HTMLDivElement>(null)
  const coachTrack = useRef<HTMLDivElement>(null)
  const [steamState, setSteamState] = useState({ atStart: true, atEnd: false, dot: 0 })
  const [coachDot, setCoachDot] = useState(0)
  const touchStartX = useRef(0)

  const slugByName = useMemo(() => new Map(games.map((g) => [g.name, g.slug])), [games])
  const slugById = useMemo(() => new Map(games.map((g) => [g.gameId, g.slug])), [games])
  const gridGames = games.slice(0, 8)

  useEffect(() => {
    api
      .browseListings({ limit: 3 })
      .then((res) => setFeatured(res.items))
      .catch(() => setFeatured([]))
    api
      .browseListings({ type: ListingType.DigitalKey, limit: 16 })
      .then((res) => setKeys(res.items))
      .catch(() => setKeys([]))
    api
      .browseCoaches({ limit: 12 })
      .then((res) =>
        setCoaches(
          [...res.items]
            .sort((a, b) => Number(b.ratingAvg ?? 0) - Number(a.ratingAvg ?? 0) || b.ratingCount - a.ratingCount)
            .slice(0, 3),
        ),
      )
      .catch(() => setCoaches([]))
    Promise.all([
      api.browseTournaments({ status: TournamentStatus.Open, limit: 1 }),
      api.browseTournaments({ status: TournamentStatus.Upcoming, limit: 1 }),
    ])
      .then(([open, upcoming]) => setTournament(open.items[0] ?? upcoming.items[0] ?? null))
      .catch(() => setTournament(null))
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
          <span className="home-featured-heart" aria-hidden="true">
            ♡
          </span>
        </Link>
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
              <span className="mobile-rank-icon" aria-hidden="true">
                ◆
              </span>
              <strong id="mobileProfileRank">{waveRank?.name ?? 'Wave Spark'}</strong>
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
              <span id="mobileWalletBalance">{user?.wavecoinBalance ?? 0}</span> WC
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
            <Link className="home-marketplace-cover" href="/marketplace" aria-label="Explore the WaveHubX marketplace">
              <img src="/assets/home-marketplace-cover.png" alt="WaveHubX neon gaming marketplace" />
              <span className="mobile-cover-cta">
                Explore Now <b aria-hidden="true">→</b>
              </span>
            </Link>

            <section className="home-explore" aria-labelledby="homeExploreTitle">
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

            <section className="mobile-home-services" aria-labelledby="mobile-services-title">
              <header>
                <h2 id="mobile-services-title">
                  <span aria-hidden="true">☆</span> სერვისები
                </h2>
                <Link href="/marketplace">
                  ყველას ნახვა <span aria-hidden="true">›</span>
                </Link>
              </header>
              <div className="mobile-service-grid">
                {MOBILE_SERVICES.map((service, index) => (
                  <Link key={index} href={service.href}>
                    <svg viewBox="0 0 32 32" aria-hidden="true">{service.icon}</svg>
                    <span>{service.label}</span>
                  </Link>
                ))}
                <Link href="/steam-keys">
                  <img className="mobile-service-steam-icon" src="/assets/steam-logo.png" alt="" aria-hidden="true" />
                  <span>Steam თამაშები</span>
                </Link>
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

            <div className="home-marketplace-game-grid" aria-label="Marketplace games">
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
                coaches.map((coach) => {
                  const slug = coach.gameSlug ?? (coach.gameName ? slugByName.get(coach.gameName) : undefined)
                  const cover = coach.avatarUrl ?? gameCover(slug)
                  const mostBookedId = coaches.reduce<PublicCoachSummary | null>((best, c) => (c.completedSessions > (best?.completedSessions ?? 0) ? c : best), null)?.id ?? null
                  const rating = coach.ratingAvg ? Number(coach.ratingAvg).toFixed(1) : null
                  return (
                    <Link key={coach.id} className="featured-coach" href={`/coaching/${coach.id}`} aria-label={`${coach.firstName} ${coach.lastName}`}>
                      <div
                        className="featured-coach-photo"
                        style={cover ? { backgroundImage: `linear-gradient(rgba(76, 13, 119, .2), rgba(10, 1, 20, .36)), url("${cover}")`, backgroundPosition: '15% center' } : undefined}
                      >
                        <span>{coachBadge(coach, mostBookedId)}</span>
                        {coach.online && (
                          <em className="featured-coach-online">
                            <i aria-hidden="true"></i>ონლაინ
                          </em>
                        )}
                      </div>
                      <div className="featured-coach-copy">
                        <div className="featured-coach-name">
                          <h4>{coach.firstName}</h4>
                          <b aria-label="Verified coach">✓</b>
                          <span>
                            <i>★</i> {rating ?? '—'}
                            <small>
                              ({coach.ratingCount} შეფასება)
                            </small>
                          </span>
                        </div>
                        <p>{coach.gameName ?? '—'}</p>
                        <ul>
                          {specialtyTags(coach.specialty).map((tag) => (
                            <li key={tag}>{tag}</li>
                          ))}
                        </ul>
                        <footer>
                          <strong>
                            {coach.hourlyRateWaveCoin} GEL <small>/ საათი</small>
                          </strong>
                          <span>სესიის დაჯავშნა →</span>
                        </footer>
                      </div>
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
              <div className="featured-tournament">
                <div
                  className="tournament-cover"
                  data-title={(() => {
                    // The cover's big two-line title (the design's "WAVE / CUP") is the real name.
                    const words = tournament.name.toUpperCase().split(/\s+/)
                    const half = Math.ceil(words.length / 2)
                    return `${words.slice(0, half).join(' ')}\n${words.slice(half).join(' ')}`.trim()
                  })()}
                  style={{
                    backgroundImage: `linear-gradient(0deg, rgba(9, 1, 18, .62), rgba(9, 4, 25, .08)), url("${tournament.coverImageUrl ?? gameCover(slugById.get(tournament.gameId)) ?? '/assets/cs2-marketplace-cover.png'}")`,
                  }}
                >
                  <span>რჩეული ტურნირი</span>
                  <b>{TOURNAMENT_STATUS[tournament.status]}</b>
                  <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M29 17h42v17c0 18-8 31-21 31S29 52 29 34V17Zm0 9H12v9c0 16 9 24 21 24m38-33h17v9c0 16-9 24-21 24M50 65v13m-18 8h36M39 78h22l5 8H34l5-8Z" /><path d="m50 27 4 8 9 1-6.5 6.3L58 51l-8-4.2-8 4.2 1.5-8.7L37 36l9-1 4-8Z" /></svg>
                </div>
                <div className="tournament-copy">
                  <h4>{tournament.name}</h4>
                  <p>
                    {tournament.gameName}
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
                      <dd>{new Date(tournament.startDate).toLocaleDateString('ka-GE', { month: 'short', day: 'numeric' })}</dd>
                    </div>
                  </dl>
                  <Link className="competition-button" href={`/tournaments/${tournament.id}`}>
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
              <Link key={listing.id} className="featured-item-card" href={`/listings/${listing.id}`}>
                <span className="featured-item-save" aria-hidden="true">
                  ♡
                </span>
                <span className="mobile-featured-product-image" style={image ? { backgroundImage: `url("${image}")` } : undefined}>
                  {image ? '' : (listing.game?.name ?? 'WH').slice(0, 2).toUpperCase()}
                </span>
                <strong>{listing.title}</strong>
                <small>{typeLabel(listing)}</small>
                <b>{listingPrice(listing)} GEL</b>
              </Link>
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
              ნახეთ, როგორ <em>WaveHubX</em> მუშაობს
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
            <Link href={user ? '/support' : '/login?next=/support'}>
              დაუკავშირდი საფორთს <strong aria-hidden="true">→</strong>
            </Link>
          </section>
        </div>
      </section>
    </Layout>
  )
}
