import { shrinkPhoto } from './image-resize'
import type {
  OrderQuote,
  AdminAnalytics,
  AdminRole,
  AdminGame,
  FaqEntry,
  ListingForEdit,
  PublicPackage,
  RequirementField,
  AuthMeResponse,
  GameImageKind,
  GameListingCount,
  ItemAttributes,
  MyProfile,
  OnlineStats,
  SellerRanks,
  WaveRank,
  PublicUser,
  PublicCategory,
  PublicGame,
  PublicListingSummary,
  PublicListingDetail,
  PublicReview,
  PublicOrderSummary,
  PublicOrderDetail,
  PublicMessage,
  PublicDispute,
  PublicWalletBalance,
  PublicWalletTransaction,
  PublicWithdrawRequest,
  PublicNotification,
  ListingType,
  ListingStatus,
  VerificationStatus,
  WithdrawMethod,
  WithdrawStatus,
  DisputeResolution,
  AdminUserSummary,
  AdminDisputeSummary,
  AdminWithdrawRequestSummary,
  AdminListingSummary,
  AdminReviewSummary,
  AdminReviewRow,
  AdminCoachingPackage,
  AdminPromoCode,
  PromoRedemptionResult,
  PublicBanner,
  AdminBanner,
  PublicSessionDispute,
  AdminSessionDisputeSummary,
  SessionDisputeResolution,
  ReportTargetType,
  ReportReason,
  ReportStatus,
  AdminUserReport,
  TrustOverview,
  TrustUserSummary,
  TrustUserDetail,
  OrderReviewState,
  PendingReview,
  PublicPlatformSettings,
  StaffPermissions,
  SupportPermissions,
  UserStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  PublicTicket,
  AdminTicketSummary,
  PublicSavedReply,
  PublicCoachSummary,
  PublicCoachDetail,
  PublicCoachReview,
  MyCoachProfile,
  PublicCoachPackage,
  AdminCoachSummary,
  PublicCoachingSession,
  PublicContentPage,
  PublicUserProfile,
  AdminContentPage,
  ContentPageStatus,
  PublicTournamentSummary,
  TournamentStatus,
  PublicTournamentTeam,
  TournamentPlayerLookup,
  PublicUserSearchResult,
  PublicTournamentMatch,
  MyTournamentEntry,
  TournamentPrizes,
  TournamentTeamStatus,
  TournamentMatchStage,
  TournamentMatchStatus,
  MatchTeamStats,
  PublicConversationSummary,
  SellerListingKeySummary,
  PublicSubscriptionPlan,
  PublicUserSubscription,
  AdminSubscriptionPlanSummary,
  AdminUserSubscriptionSummary,
  SubscriptionAudience,
  SubscriptionPerks,
} from '@wavehub/shared-types'

// Admin match create/update body (backend MatchDto) — every field optional, null clears.
export type TournamentMatchInput = Partial<{
  stage: TournamentMatchStage
  groupName: string | null
  roundLabel: string | null
  teamAId: string | null
  teamBId: string | null
  map: string | null
  bestOf: number
  scheduledAt: string | null
  status: TournamentMatchStatus
  scoreA: number | null
  scoreB: number | null
  stats: { a?: MatchTeamStats | null; b?: MatchTeamStats | null }
}>

// Raw Listing entity as returned to its own seller by GET /listings/mine, POST /listings and
// POST /listings/:id/submit (not a Public* shape — see the comment above listMyListings). Only the
// fields the seller pages actually read are declared.
export interface MyListing {
  id: string
  type: ListingType
  status: ListingStatus
  title: string
  priceWaveCoin: number | null
  rejectionReason?: string | null
  description?: string
  createdAt?: string
  game?: { name: string; slug: string } | null
  images?: Array<{ id: string; url: string }>
  itemAttributes?: ItemAttributes | null
}

// PATCH listings/:id (seller) and admin/listings/:id (Super Admin) — every field optional.
export type ListingEditPayload = {
  title?: string
  description?: string
  priceWaveCoin?: number
  attributes?: ItemAttributes
  requirementsSchema?: RequirementField[]
  faq?: FaqEntry[]
}
export type PackageInput = { name: string; priceWaveCoin: number; deliveryTimeDays: number; features: string[]; revisionsIncluded: number }

// What PATCH coaches/mine/profile (and the admin equivalent) accept — packages and the uploaded
// video have their own endpoints.
export type CoachProfilePatch = Partial<Omit<MyCoachProfile, 'id' | 'verificationStatus' | 'videoFileUrl'>>

// Raw Coach entity as returned to its own owner by GET /coaches/mine (null when the user never
// applied) — only the fields the apply page reads.
export interface MyCoachApplication {
  verificationStatus: VerificationStatus
  rejectionReason: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

// The exact message backend/src/auth/verified-email.guard.ts throws (403) on every money-moving /
// marketplace-mutating route for an account still in `pending_verification`. Matched by text
// because the guard returns a plain ForbiddenException with no machine-readable code.
const EMAIL_NOT_VERIFIED_MESSAGE = 'Please verify your email address before doing this'

export function isEmailNotVerifiedError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.message.includes(EMAIL_NOT_VERIFIED_MESSAGE)
}

// The backend answers in English (its messages are API-facing, not UI copy). These are the ones a
// user can realistically hit through normal use, keyed by the exact text the backend sends;
// anything not listed falls through unchanged rather than being swallowed.
const KNOWN_MESSAGES: Record<string, string> = {
  'Invalid username or password': 'არასწორი username ან პაროლი.',
  'Username already taken': 'ეს username უკვე დაკავებულია.',
  'Email already registered': 'ეს ელფოსტა უკვე რეგისტრირებულია.',
  'Invalid or expired verification link': 'დადასტურების ბმული არასწორია ან ვადაგასულია.',
  'Invalid or expired reset link': 'პაროლის აღდგენის ბმული არასწორია ან ვადაგასულია.',
  'Not authenticated': 'გთხოვთ, გაიაროთ ავტორიზაცია.',
  'Session expired or invalid': 'სესია ამოიწურა. გთხოვთ, ხელახლა შეხვიდეთ.',
  'Account suspended or banned': 'თქვენი ანგარიში შეჩერებული ან დაბლოკილია.',
  'Server error': 'სერვერის შეცდომა. სცადეთ მოგვიანებით.',
  "You can't buy your own listing": 'საკუთარი განცხადების ყიდვა შეუძლებელია.',
  'A listing can have at most 6 images': 'განცხადებას მაქსიმუმ 6 სურათი შეიძლება ჰქონდეს.',
  'item listings require priceWaveCoin': 'მიუთითეთ ფასი.',
  'Insufficient WaveCoin balance for this purchase': 'WaveCoin-ის ბალანსი არ არის საკმარისი. შეავსეთ საფულე და სცადეთ თავიდან.',
  'Insufficient WaveCoin balance for this session': 'WaveCoin-ის ბალანსი არ არის საკმარისი. შეავსეთ საფულე და სცადეთ თავიდან.',
  'This item is out of stock': 'ეს ნივთი ამოიწურა.',
  'This key listing is out of stock': 'ამ განცხადების გასაღებები ამოიწურა.',
  'You can only cancel before the seller starts work': 'გაუქმება შესაძლებელია მხოლოდ გამყიდველის მიერ მუშაობის დაწყებამდე.',
  'You can only message users you have an order or coaching session with':
    'მიწერა შეგიძლიათ მხოლოდ იმ მომხმარებელს, ვისთანაც შეკვეთა ან სესია გაქვთ.',
  'This tournament is full': 'ტურნირზე ადგილები ამოიწურა.',
  'Registration is not open for this tournament': 'ამ ტურნირზე რეგისტრაცია ღია არ არის.',
  'You are already registered for this tournament': 'ამ ტურნირზე უკვე დარეგისტრირებული ხართ.',
  'This coach is not currently accepting sessions': 'ეს მწვრთნელი ამჟამად სესიებს არ იღებს.',
  'scheduledAt must be in the future': 'სესიის დრო მომავალში უნდა იყოს.',
  'Requested amount exceeds your available balance': 'მოთხოვნილი თანხა აღემატება ხელმისაწვდომ ბალანსს.',
  'Withdrawals are blocked while you have an active dispute': 'აქტიური დავის დროს თანხის გატანა შეზღუდულია.',
  'You must confirm you have the legal right to resell these keys': 'დაადასტურეთ, რომ გასაღებების გაყიდვის კანონიერი უფლება გაქვთ.',
  'File exceeds the 20MB size limit': 'ფაილი 20MB-ზე დიდია.',
  'Image exceeds the 5MB size limit': 'სურათი 5MB-ზე დიდია.',
  'Cover image exceeds the 5MB size limit': 'სურათი 5MB-ზე დიდია.',
  'File type not allowed (JPG, PNG, WEBP, PDF, ZIP only)': 'ფაილის ტიპი დაუშვებელია (მხოლოდ JPG, PNG, WEBP, PDF, ZIP).',
  'Only JPG, PNG, or WEBP images are allowed': 'დაშვებულია მხოლოდ JPG, PNG ან WEBP სურათები.',
  'User not found': 'მომხმარებელი ვერ მოიძებნა.',
  'Listing not found': 'განცხადება ვერ მოიძებნა.',
  'Order not found': 'შეკვეთა ვერ მოიძებნა.',
  'Coach not found': 'ქოუჩი ვერ მოიძებნა.',
  'Session not found': 'სესია ვერ მოიძებნა.',
  'Tournament not found': 'ტურნირი ვერ მოიძებნა.',
  'A team with this name is already registered': 'ამ სახელით გუნდი უკვე დარეგისტრირებულია.',
  'Player names must be different': 'მოთამაშეების სახელები არ უნდა მეორდებოდეს.',
  'This is a team tournament — register a team': 'ეს გუნდური ტურნირია — დაარეგისტრირეთ გუნდი.',
  'The tournament has started — contact support to withdraw': 'ტურნირი დაწყებულია — გასასვლელად მიმართეთ მხარდაჭერას.',
  'Match not found': 'მატჩი ვერ მოიძებნა.',
  'You already reviewed this session': 'ეს სესია უკვე შეაფასეთ.',
  'You cannot follow yourself': 'საკუთარი თავის გამოწერა შეუძლებელია.',
  'Only a completed session can be reviewed': 'შეფასება შესაძლებელია მხოლოდ დასრულებული სესიისთვის.',
  'You are not a coach': 'თქვენ ქოუჩის პროფილი არ გაქვთ.',
  'The video must be a YouTube or Vimeo link': 'ვიდეო უნდა იყოს YouTube ან Vimeo ბმული.',
  'Unknown game': 'უცნობი თამაში.',
  'The original price must be a whole number above the current price': 'ძველი ფასი უნდა იყოს მთელი რიცხვი და აღემატებოდეს მიმდინარე ფასს.',
  'Image not found': 'სურათი ვერ მოიძებნა.',
  'Team not found': 'გუნდი ვერ მოიძებნა.',
  'Conversation not found': 'საუბარი ვერ მოიძებნა.',
  'Plan not found': 'გეგმა ვერ მოიძებნა.',
  'Page not found': 'გვერდი ვერ მოიძებნა.',
  'BOG checkout could not be created.': 'გადახდის გვერდის შექმნა ვერ მოხერხდა. სცადეთ მოგვიანებით.',
}

function translateKnown(message: string): string {
  const exact = KNOWN_MESSAGES[message]
  if (exact) return exact
  const minWithdrawal = /^Minimum withdrawal is (\d+(?:\.\d+)?) WaveCoin/.exec(message)
  if (minWithdrawal) return `გატანის მინიმალური თანხაა ${minWithdrawal[1]} WaveCoin.`
  return message
}

// Turns anything thrown by `request()` into a Georgian, user-presentable string. Every page's
// catch block goes through this instead of reading `err.message` directly, so an unverified
// account, a throttled request or a dead network get one consistent explanation everywhere.
export function errorMessage(err: unknown, fallback: string): string {
  if (isEmailNotVerifiedError(err)) {
    return 'ამ მოქმედებისთვის საჭიროა ელფოსტის დადასტურება. გამოგზავნეთ დამადასტურებელი წერილი გვერდის ზედა ბანერიდან და გახსენით მასში მითითებული ბმული.'
  }
  if (err instanceof ApiError) {
    if (err.status === 0) return 'სერვერთან დაკავშირება ვერ მოხერხდა. შეამოწმეთ ინტერნეტი და სცადეთ ხელახლა.'
    if (err.status === 429) return 'ძალიან ბევრი მოთხოვნა. გთხოვთ, ცოტა ხანში სცადოთ ხელახლა.'
    return err.message ? translateKnown(err.message) : fallback
  }
  return fallback
}

async function send(path: string, init: RequestInit): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      // Required so the backend's httpOnly session cookie is sent/received cross-origin during
      // local dev (frontend on :3000, backend on :4000) and in any deployment where they're on
      // different subdomains.
      credentials: 'include',
    })
  } catch {
    // fetch() only rejects on a network-level failure (server down, offline, CORS block) —
    // surfaced as status 0, which errorMessage() maps to a Georgian "can't reach the server" text.
    throw new ApiError(0, 'Network error')
  }

  // An empty body (e.g. a handler returning null/undefined) is `null`, not `{}` — `{}` read as a real
  // object made SessionReview think a review already existed and hide the form (bug, 2026-10-02).
  const text = await res.text().catch(() => '')
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!res.ok) {
    // Two backend error shapes: Nest's built-in exceptions (`{ statusCode, message, error: 'Forbidden' }`
    // — the human text is in `message`, `error` is just the HTTP status name) and this app's own
    // `{ ok: false, error: '<text>' }` (no `message`). So `message` must win when present; reading
    // `error` first surfaced every built-in exception as a bare "Forbidden"/"Bad Request".
    data = data ?? {}
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
    throw new ApiError(res.status, message || data?.error || 'Request failed')
  }

  return data
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return (await send(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })) as T
}

// Multipart upload — no Content-Type header on purpose, the browser has to set the boundary itself.
async function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData()
  form.append('file', file)
  return (await send(path, { method: 'POST', body: form })) as T
}

export const api = {
  register: (payload: {
    username: string
    email: string
    firstName: string
    lastName: string
    password: string
  }) =>
    request<{ ok: true; user: PublicUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { username: string; password: string }) =>
    request<{ ok: true; user: PublicUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),

  me: () => request<AuthMeResponse & { ok: true }>('/auth/me'),

  checkUsername: (username: string) =>
    request<{ ok: true; available: boolean }>(
      `/auth/check-username?username=${encodeURIComponent(username)}`,
    ),

  requestPasswordReset: (email: string) =>
    request<{ ok: true }>('/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (payload: { token: string; newPassword: string }) =>
    request<{ ok: true }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyEmail: (token: string) =>
    request<{ ok: true }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  // Requires an active session (the backend guards this route) — only call it while logged in.
  resendVerification: () => request<{ ok: true }>('/auth/resend-verification', { method: 'POST' }),

  // The 6-digit code from the verification email (signed-in pending accounts).
  verifyEmailCode: (code: string) => request<{ ok: true }>('/auth/verify-email-code', { method: 'POST', body: JSON.stringify({ code }) }),

  // --- Marketplace (listings/categories/games/reviews) ---
  // Note: unlike the auth endpoints above, these are NOT wrapped in `{ ok: true, ... }` — they
  // return exactly what ListingsController/ReviewsController hand back (see backend/src/listings/
  // CLAUDE.md and backend/src/reviews/CLAUDE.md). Don't assume a uniform envelope across the API.
  listCategories: () => request<PublicCategory[]>('/categories'),

  listGames: () => request<PublicGame[]>('/games'),
  // --- Super Admin statistics --- (backend/src/analytics/): inclusive YYYY-MM-DD dates.
  adminGetAnalytics: (from: string, to: string) => request<AdminAnalytics>(`/admin/analytics?from=${from}&to=${to}`),
  // --- Admin game catalogue --- (backend/src/listings/admin-games.controller.ts)
  adminListGames: () => request<AdminGame[]>('/admin/games'),
  adminCreateGame: (payload: { name: string; slug: string; sortOrder?: number }) =>
    request<AdminGame>('/admin/games', { method: 'POST', body: JSON.stringify(payload) }),
  adminUpdateGame: (id: string, payload: { name?: string; isActive?: boolean; sortOrder?: number }) =>
    request<AdminGame>(`/admin/games/${id}`, { method: 'POST', body: JSON.stringify(payload) }),
  adminUploadGameImage: (id: string, kind: GameImageKind, file: File) => upload<AdminGame>(`/admin/games/${id}/images/${kind}`, file),
  adminClearGameImage: (id: string, kind: GameImageKind) => request<AdminGame>(`/admin/games/${id}/images/${kind}`, { method: 'DELETE' }),

  browseListings: (filters: {
    categoryId?: string
    gameId?: string
    // Game slug (e.g. `cs2`) — ignored server-side when gameId is also set.
    game?: string
    type?: ListingType
    // Case-insensitive search over title/description/game name.
    q?: string
    // Only listings from sellers with the featuredListings subscription perk.
    featured?: boolean
    sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'popular'
    // Steam games: a STEAM_GENRES key.
    genre?: string
    limit?: number
    offset?: number
  } = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value))
    })
    const query = params.toString()
    return request<{ items: PublicListingSummary[]; total: number }>(
      `/listings${query ? `?${query}` : ''}`,
    )
  },

  getListing: (id: string) => request<PublicListingDetail>(`/listings/${id}`),

  listReviewsForListing: (listingId: string, sort?: 'newest' | 'highest' | 'lowest') =>
    request<PublicReview[]>(
      `/listings/${listingId}/reviews${sort ? `?sort=${sort}` : ''}`,
    ),

  // --- Seller: digital key listings --- (backend/src/listings/) — no generic create-listing UI
  // exists yet for Service/Item (see frontend/CLAUDE.md); these are scoped to DigitalKey only,
  // matching LAUNCH_PLAN.md §2d's "bulk key-upload form" ask. `createDraft`/`findMine`/
  // `submitForReview` all return the raw TypeORM entity, not a `Public*` shape — typed `unknown`
  // here, same convention as the admin-mutation endpoints documented in frontend/CLAUDE.md (the
  // callers only care that the id/status they need is present, read via a narrow local cast).
  listMyListings: () => request<MyListing[]>('/listings/mine'),

  createDigitalKeyListing: (payload: {
    categoryId: string
    gameId?: string
    title: string
    description: string
    priceWaveCoin: number
    resaleRightsAttested: true
    attributes?: ItemAttributes
  }) =>
    request<MyListing>('/listings', {
      method: 'POST',
      body: JSON.stringify({ ...payload, type: 'digital_key' }),
    }),

  submitListingForReview: (id: string) => request<MyListing>(`/listings/${id}/submit`, { method: 'POST' }),

  // Item (account/skin) listing — the prototype's "Become a seller" form. `attributes` are the
  // public account/skin details (validated server-side: flat, short values, ≤40 keys).
  createItemListing: (payload: {
    categoryId: string
    gameId: string
    title: string
    description: string
    priceWaveCoin: number
    attributes: ItemAttributes
  }) =>
    request<MyListing>('/listings', {
      method: 'POST',
      body: JSON.stringify({ ...payload, type: 'item', isUnique: true, stockQuantity: 1 }),
    }),

  // --- Service listings --- (pages/sell/services/*): priced by 1–5 packages; the buyer answers
  // `requirementsSchema` when ordering. Editing a live service (incl. packages) re-queues review.
  createServiceListing: (payload: {
    categoryId: string
    gameId?: string
    title: string
    description: string
    requirementsSchema: RequirementField[]
    faq: FaqEntry[]
  }) => request<MyListing>('/listings', { method: 'POST', body: JSON.stringify({ ...payload, type: 'service' }) }),
  getMyListing: (id: string) => request<ListingForEdit>(`/listings/mine/${id}`),
  adminGetListing: (id: string) => request<ListingForEdit>(`/admin/listings/${id}`),
  adminSearchListings: (params: { q?: string; status?: string; featured?: boolean; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.status) qs.set('status', params.status)
    if (params.featured !== undefined) qs.set('featured', String(params.featured))
    if (params.limit) qs.set('limit', String(params.limit))
    const query = qs.toString()
    return request<AdminListingSummary[]>(`/admin/listings${query ? `?${query}` : ''}`)
  },
  // Staff moderation of live listings: take down (→ rejected, with a reason the seller sees),
  // restore, and Super-Admin delete (only never-ordered listings; 409 otherwise).
  adminTakeDownListing: (id: string, reason: string) =>
    request<unknown>(`/admin/listings/${id}/take-down`, { method: 'POST', body: JSON.stringify({ reason }) }),
  adminRestoreListing: (id: string) => request<unknown>(`/admin/listings/${id}/restore`, { method: 'POST' }),
  adminDeleteListing: (id: string) => request<{ ok: true }>(`/admin/listings/${id}`, { method: 'DELETE' }),
  adminSetListingFeatured: (id: string, isFeatured: boolean) =>
    request<{ id: string; isFeatured: boolean }>(`/admin/listings/${id}/featured`, { method: 'POST', body: JSON.stringify({ isFeatured }) }),
  addListingPackage: (id: string, payload: PackageInput) => request<PublicPackage>(`/listings/${id}/packages`, { method: 'POST', body: JSON.stringify(payload) }),
  removeListingPackage: (id: string, packageId: string) => request<void>(`/listings/${id}/packages/${packageId}`, { method: 'DELETE' }),

  // Seller edit/delete of their own listing. Editing a live listing sends it back to review;
  // delete only works for a listing that was never ordered (409 otherwise — pause it instead).
  updateListing: (id: string, payload: ListingEditPayload) =>
    request<MyListing>(`/listings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteListing: (id: string) => request<void>(`/listings/${id}`, { method: 'DELETE' }),

  pauseListing: (id: string) => request<MyListing>(`/listings/${id}/pause`, { method: 'POST' }),

  unpauseListing: (id: string) => request<MyListing>(`/listings/${id}/unpause`, { method: 'POST' }),

  // --- Own profile (Settings page) --- (backend/src/users/profile.controller.ts)
  getMyProfile: () => request<MyProfile>('/me/profile'),

  updateMyProfile: (payload: {
    firstName?: string
    lastName?: string
    bio?: string
    mainGameIds?: string[]
    location?: string
    tagline?: string
    platform?: string
    preferredRole?: string
    achievement?: string
    emailNotifications?: boolean
  }) =>
    request<MyProfile>('/me/profile', { method: 'PATCH', body: JSON.stringify(payload) }),

  uploadAvatar: async (file: File) => upload<MyProfile>('/me/avatar', await shrinkPhoto(file)),

  uploadListingImage: async (listingId: string, file: File) => upload<{ id: string; url: string }>(`/listings/${listingId}/images`, await shrinkPhoto(file)),

  // Makes this photo the listing's main (cover) photo everywhere it's shown.
  setListingCoverImage: (listingId: string, imageId: string) =>
    request<{ ok: true }>(`/listings/${listingId}/images/${imageId}/cover`, { method: 'POST' }),
  removeListingImage: (listingId: string, imageId: string) =>
    request<{ ok: boolean }>(`/listings/${listingId}/images/${imageId}`, { method: 'DELETE' }),

  // Super Admin edits any listing (no re-review; audit-logged) — same shapes as the seller calls.
  adminUpdateListing: (id: string, payload: ListingEditPayload) =>
    request<MyListing>(`/admin/listings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  adminUploadListingImage: async (listingId: string, file: File) => upload<{ id: string; url: string }>(`/admin/listings/${listingId}/images`, await shrinkPhoto(file)),

  adminSetListingCoverImage: (listingId: string, imageId: string) =>
    request<{ ok: true }>(`/admin/listings/${listingId}/images/${imageId}/cover`, { method: 'POST' }),

  adminRemoveListingImage: (listingId: string, imageId: string) =>
    request<{ ok: boolean }>(`/admin/listings/${listingId}/images/${imageId}`, { method: 'DELETE' }),

  adminAddListingPackage: (id: string, payload: PackageInput) =>
    request<PublicPackage>(`/admin/listings/${id}/packages`, { method: 'POST', body: JSON.stringify(payload) }),

  adminRemoveListingPackage: (id: string, packageId: string) => request<void>(`/admin/listings/${id}/packages/${packageId}`, { method: 'DELETE' }),

  // --- Favourites --- (backend/src/listings — `me/favorites*`, `listings/:id/favorite`)
  listFavorites: () => request<PublicListingSummary[]>('/me/favorites'),

  listFavoriteIds: () => request<string[]>('/me/favorites/ids'),

  addFavorite: (listingId: string) =>
    request<{ favorited: true; favoriteCount: number }>(`/listings/${listingId}/favorite`, { method: 'POST' }),

  removeFavorite: (listingId: string) =>
    request<{ favorited: false; favoriteCount: number }>(`/listings/${listingId}/favorite`, { method: 'DELETE' }),

  addListingKeys: (listingId: string, keys: string[]) =>
    request<{ added: number }>(`/listings/${listingId}/keys`, { method: 'POST', body: JSON.stringify({ keys }) }),

  listListingKeys: (listingId: string) => request<SellerListingKeySummary[]>(`/listings/${listingId}/keys`),

  removeListingKey: (listingId: string, keyId: string) =>
    request<void>(`/listings/${listingId}/keys/${keyId}`, { method: 'DELETE' }),

  createReview: (payload: { orderId: string; rating: number; body?: string; tags?: string[] }) =>
    request<PublicReview>('/reviews', { method: 'POST', body: JSON.stringify(payload) }),

  // { review, status } — never a bare null (an empty body would read as "already reviewed").
  getOrderReview: (orderId: string) => request<OrderReviewState>(`/reviews/order/${orderId}`),

  // The caller's completed orders still waiting for a review.
  listPendingReviews: () => request<PendingReview[]>('/reviews/pending'),

  replyToReview: (reviewId: string, body: string) =>
    request<unknown>(`/reviews/${reviewId}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),

  // --- Orders --- (also not wrapped in `{ ok: true, ... }`, same as the marketplace endpoints)
  purchase: (payload: { listingId: string; packageId?: string; requirementsAnswers?: Record<string, unknown> }) =>
    request<PublicOrderDetail>('/orders', { method: 'POST', body: JSON.stringify(payload) }),

  quoteOrder: (listingId: string, packageId?: string) =>
    request<OrderQuote>(`/order-quote?${new URLSearchParams(packageId ? { listingId, packageId } : { listingId })}`),

  listOrdersAsBuyer: () => request<PublicOrderSummary[]>('/orders/as-buyer'),

  listOrdersAsSeller: () => request<PublicOrderSummary[]>('/orders/as-seller'),

  getOrder: (id: string) => request<PublicOrderDetail>(`/orders/${id}`),

  // Buyer-only, DigitalKey orders only — a separate pull rather than part of getOrder's response,
  // see backend/src/orders/CLAUDE.md's getRevealedKey comment for why.
  getOrderKey: (id: string) => request<{ key: string }>(`/orders/${id}/key`),

  startOrder: (id: string) => request<unknown>(`/orders/${id}/start`, { method: 'POST' }),

  deliverOrder: (id: string) => request<unknown>(`/orders/${id}/deliver`, { method: 'POST' }),

  addDeliveryFile: (id: string, file: File) => upload<unknown>(`/orders/${id}/delivery-files`, file),

  acceptDelivery: (id: string) => request<unknown>(`/orders/${id}/accept`, { method: 'POST' }),

  requestRevision: (id: string, reason: string) =>
    request<unknown>(`/orders/${id}/request-revision`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  cancelOrderAsBuyer: (id: string) => request<unknown>(`/orders/${id}/cancel-as-buyer`, { method: 'POST' }),

  cancelOrderAsSeller: (id: string, reason: string) =>
    request<unknown>(`/orders/${id}/cancel-as-seller`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // --- Order chat --- (backend/src/chat/) — messages live under an order, not a separate
  // conversation id; the participant check happens server-side against the order.
  listMessages: (orderId: string) => request<PublicMessage[]>(`/orders/${orderId}/messages`),

  sendMessage: (orderId: string, body: string) =>
    request<PublicMessage>(`/orders/${orderId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  // --- Direct messages --- (backend/src/chat/direct-messages.controller.ts) — only between users
  // who share a real order or coaching session; the backend rejects a stranger with 403, this
  // client just surfaces whatever it returns.
  startDirectConversation: (recipientUserId: string) =>
    request<{ id: string }>('/direct-messages/start', { method: 'POST', body: JSON.stringify({ recipientUserId }) }),

  listDirectConversations: () => request<PublicConversationSummary[]>('/direct-messages'),

  getUnreadDirectMessageCount: () => request<{ count: number }>('/direct-messages/unread-count'),

  listDirectMessages: (conversationId: string) => request<PublicMessage[]>(`/direct-messages/${conversationId}/messages`),

  sendDirectMessage: (conversationId: string, body: string) =>
    request<PublicMessage>(`/direct-messages/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  // --- Disputes --- (backend/src/disputes/) — a dispute lives under an order too; opening one
  // moves the order to `disputed` status server-side.
  openDispute: (orderId: string, reason: string) =>
    request<PublicDispute>(`/orders/${orderId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getDispute: (orderId: string) => request<PublicDispute>(`/orders/${orderId}/dispute`),

  addDisputeMessage: (orderId: string, body: string) =>
    request<PublicDispute>(`/orders/${orderId}/dispute/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  addDisputeEvidence: (orderId: string, file: File) =>
    upload<PublicDispute>(`/orders/${orderId}/dispute/evidence`, file),

  // --- WaveCoin top-up via Bank of Georgia ---
  // Response shape is `{ ok: true, orderId, redirectUrl }` (see BogPaymentsController#createOrder /
  // BogPaymentsService#createWavecoinOrder) — redirect the browser to `redirectUrl` to hand off to
  // BOG's hosted checkout page; WaveCoin is credited later via the server-to-server callback, not
  // by anything this call does.
  createBogTopupOrder: (payload: { amountGel: number; successUrl: string; failUrl: string }) =>
    request<{ ok: true; orderId: string; redirectUrl: string }>('/payments/bog/create-order', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // --- Seller wallet balance/withdrawals --- (backend/src/withdrawals/) — these two GET routes
  // live under /wallet even though the module is called withdrawals; see withdrawals/CLAUDE.md for
  // why (the full balance view needs withdraw-request data wallet/ doesn't have).
  getWalletBalance: () => request<PublicWalletBalance>('/wallet/balance'),

  listWalletTransactions: (limit = 20, offset = 0) =>
    request<PublicWalletTransaction[]>(`/wallet/transactions?limit=${limit}&offset=${offset}`),

  requestWithdrawal: (payload: { amountWaveCoin: number; method: WithdrawMethod; payoutDetails: Record<string, string> }) =>
    request<PublicWithdrawRequest>('/withdrawals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listMyWithdrawals: () => request<PublicWithdrawRequest[]>('/withdrawals/mine'),

  cancelWithdrawal: (id: string) => request<PublicWithdrawRequest>(`/withdrawals/${id}/cancel`, { method: 'POST' }),

  // --- Notifications --- (backend/src/notifications/)
  listNotifications: (limit = 20, offset = 0) =>
    request<PublicNotification[]>(`/notifications?limit=${limit}&offset=${offset}`),

  getUnreadNotificationCount: () => request<{ count: number; latestAt: string | null }>('/notifications/unread-count'),

  markNotificationRead: (id: string) =>
    request<PublicNotification>(`/notifications/${id}/read`, { method: 'POST' }),

  markAllNotificationsRead: () => request<{ ok: true }>('/notifications/read-all', { method: 'POST' }),

  // --- Site shell / community --- (backend/src/community/)
  getOnlineStats: () => request<OnlineStats>('/stats/online'),

  getGameListingCounts: () => request<GameListingCount[]>('/stats/games'),

  getMyWaveRank: () => request<WaveRank>('/me/wave-rank'),

  getSellerRanks: () => request<SellerRanks>('/stats/seller-ranks'),

  // --- Admin panel --- (backend/src/admin/, plus admin-only routes on each domain module).
  // Server-side role checks are the real enforcement (AdminGuard/@RequireAdminRole) — the
  // frontend's role checks in components/AdminLayout.tsx only decide what to *show*, calling one
  // of these while unauthorized just gets a 403 from the backend.
  adminListPendingListings: () => request<AdminListingSummary[]>('/listings/pending-review'),

  // Return the raw (unmapped) Listing entity server-side, not PublicListingDetail — untyped as
  // `unknown`, same convention as the review moderation actions below.
  adminApproveListing: (id: string) => request<unknown>(`/listings/${id}/approve`, { method: 'POST' }),

  adminRejectListing: (id: string, reason: string) =>
    request<unknown>(`/listings/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  adminListReportedReviews: () => request<AdminReviewSummary[]>('/reviews/reported'),

  // These return the raw (unmapped) Review entity server-side, not PublicReview — matching
  // response shape untyped as `unknown`, same convention as orders' action endpoints below.
  adminHideReview: (id: string) => request<unknown>(`/reviews/${id}/hide`, { method: 'POST' }),

  adminRemoveReview: (id: string) => request<unknown>(`/reviews/${id}/remove`, { method: 'POST' }),

  adminRestoreReview: (id: string) => request<unknown>(`/reviews/${id}/restore`, { method: 'POST' }),

  // Every product + coach review (backend/src/reviews/admin-reviews.controller.ts). Editing and
  // deleting coach reviews are Super Admin only.
  adminListReviews: (params: { kind?: 'product' | 'coach'; status?: string; q?: string; page?: number }) => {
    const qs = new URLSearchParams()
    if (params.kind) qs.set('kind', params.kind)
    if (params.status) qs.set('status', params.status)
    if (params.q) qs.set('q', params.q)
    if (params.page) qs.set('page', String(params.page))
    return request<{ items: AdminReviewRow[]; total: number }>(`/admin/reviews?${qs.toString()}`)
  },

  adminEditReview: (kind: 'product' | 'coach', id: string, payload: { rating?: number; body?: string | null; sellerReply?: string | null }) =>
    request<{ ok: true }>(`/admin/reviews/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  adminDeleteCoachReview: (id: string) => request<{ ok: true }>(`/admin/reviews/coach/${id}`, { method: 'DELETE' }),

  adminListOpenDisputes: () => request<AdminDisputeSummary[]>('/disputes'),

  // Full thread for one dispute, no participant check — for an admin viewing a case they aren't
  // the buyer/seller of. Participants should keep using getDispute above (works for them too, but
  // this route is admin-guarded and would 403 a non-admin participant).
  adminGetDispute: (orderId: string) => request<PublicDispute>(`/disputes/${orderId}`),

  adminResolveDispute: (orderId: string, resolution: DisputeResolution, note: string) =>
    request<PublicDispute>(`/orders/${orderId}/dispute/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution, note }),
    }),

  adminListPendingWithdrawals: () => request<AdminWithdrawRequestSummary[]>('/withdrawals/pending'),

  adminProcessWithdrawal: (id: string, status: WithdrawStatus, note?: string) =>
    request<PublicWithdrawRequest>(`/withdrawals/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    }),

  adminListUsers: (params: { query?: string; status?: UserStatus; limit?: number; offset?: number } = {}) => {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') search.set(key, String(value))
    })
    const qs = search.toString()
    return request<{ items: AdminUserSummary[]; total: number }>(`/admin/users${qs ? `?${qs}` : ''}`)
  },

  adminSuspendUser: (id: string, reason: string) =>
    request<AdminUserSummary>(`/admin/users/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),

  adminRestoreUser: (id: string) => request<AdminUserSummary>(`/admin/users/${id}/restore`, { method: 'POST' }),

  adminBanUser: (id: string, reason: string) =>
    request<AdminUserSummary>(`/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) }),

  adminUnbanUser: (id: string) => request<AdminUserSummary>(`/admin/users/${id}/unban`, { method: 'POST' }),

  // Super Admin only (backend/src/users/admin-users.controller.ts): +/- spendable WaveCoin, and staff roles.
  adminAdjustWallet: (id: string, amountWaveCoin: number, reason: string) =>
    request<AdminUserSummary>(`/admin/users/${id}/wallet-adjustment`, { method: 'POST', body: JSON.stringify({ amountWaveCoin, reason }) }),
  adminSetUserRole: (id: string, adminRole: AdminRole | null, reason: string) =>
    request<AdminUserSummary>(`/admin/users/${id}/role`, { method: 'POST', body: JSON.stringify({ adminRole, reason }) }),

  adminGetPlatformSettings: () => request<PublicPlatformSettings>('/admin/platform-settings'),

  // The caller's Super-Admin-controlled powers (WaveCoin adjust + cap, suspend/restore).
  adminMyPermissions: () => request<StaffPermissions>('/admin/platform-settings/my-permissions'),

  adminUpdatePlatformSettings: (patch: {
    platformFeePercent?: number
    minWithdrawalWaveCoin?: number
    maintenanceMode?: boolean
    supportPermissions?: SupportPermissions
  }) =>
    request<PublicPlatformSettings>('/admin/platform-settings', {
      method: 'POST',
      body: JSON.stringify(patch),
    }),

  // --- Support ticketing --- (backend/src/support/)
  createTicket: (payload: { subject: string; category: TicketCategory; description: string; orderId?: string }) =>
    request<PublicTicket>('/tickets', { method: 'POST', body: JSON.stringify(payload) }),

  listMyTickets: () => request<AdminTicketSummary[]>('/tickets/mine'),

  getMyTicket: (id: string) => request<PublicTicket>(`/tickets/mine/${id}`),

  replyToTicket: (id: string, body: string) =>
    request<PublicTicket>(`/tickets/mine/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),

  adminListTickets: (filters: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: string } = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value))
    })
    const query = params.toString()
    return request<AdminTicketSummary[]>(`/admin/tickets${query ? `?${query}` : ''}`)
  },

  adminGetTicket: (id: string) => request<PublicTicket>(`/admin/tickets/${id}`),

  adminReplyTicket: (id: string, body: string) =>
    request<PublicTicket>(`/admin/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),

  adminAddTicketInternalNote: (id: string, body: string) =>
    request<PublicTicket>(`/admin/tickets/${id}/internal-note`, { method: 'POST', body: JSON.stringify({ body }) }),

  adminUpdateTicket: (id: string, patch: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: string | null }) =>
    request<PublicTicket>(`/admin/tickets/${id}/update`, { method: 'POST', body: JSON.stringify(patch) }),

  adminListSavedReplies: () => request<PublicSavedReply[]>('/admin/saved-replies'),

  // --- Coaching --- (backend/src/coaching/) — profile + directory + admin verification only;
  // session booking/payment don't exist yet, see backend/src/coaching/CLAUDE.md.
  applyAsCoach: (payload: { gameId?: string; specialty: string; bio: string; languages?: string[]; hourlyRateWaveCoin: number }) =>
    request<unknown>('/coaches/apply', { method: 'POST', body: JSON.stringify(payload) }),

  getMyCoachApplication: () => request<MyCoachApplication | null>('/coaches/mine'),

  browseCoaches: (
    filters: { gameId?: string; gameIds?: string; maxRate?: number; language?: string; sort?: string; limit?: number; offset?: number } = {},
  ) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value))
    })
    const query = params.toString()
    return request<{ items: PublicCoachSummary[]; total: number }>(`/coaches${query ? `?${query}` : ''}`)
  },

  getCoach: (id: string) => request<PublicCoachDetail>(`/coaches/${id}`),

  adminListPendingCoaches: () => request<AdminCoachSummary[]>('/coaches/pending-verification'),

  adminListAllCoaches: () => request<AdminCoachSummary[]>('/coaches/all'),

  adminApproveCoach: (id: string) => request<AdminCoachSummary>(`/coaches/${id}/approve`, { method: 'POST' }),

  adminRejectCoach: (id: string, reason: string) =>
    request<AdminCoachSummary>(`/coaches/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Super Admin only; a coach with any session history can't be deleted (409 — suspend instead).
  adminDeleteCoach: (id: string) => request<{ ok: true }>(`/admin/coaches/${id}`, { method: 'DELETE' }),
  adminSuspendCoach: (id: string) => request<AdminCoachSummary>(`/coaches/${id}/suspend`, { method: 'POST' }),

  adminRestoreCoach: (id: string) => request<AdminCoachSummary>(`/coaches/${id}/restore`, { method: 'POST' }),

  // --- Content / CMS --- (backend/src/content/)
  getContentPage: (slug: string) => request<PublicContentPage>(`/content/${slug}`),

  adminListContentPages: () => request<AdminContentPage[]>('/admin/content'),

  adminGetContentPage: (slug: string) => request<AdminContentPage>(`/admin/content/${slug}`),

  adminUpsertContentPage: (payload: { slug: string; title: string; body?: string; status?: ContentPageStatus }) =>
    request<AdminContentPage>('/admin/content', { method: 'POST', body: JSON.stringify(payload) }),

  // --- Public user profiles --- (backend/src/users/users.controller.ts)
  getUserProfile: (username: string) => request<PublicUserProfile>(`/users/${encodeURIComponent(username)}`),

  // --- Coaching sessions --- (backend/src/coaching/coaching-sessions.controller.ts)
  requestCoachingSession: (
    coachId: string,
    payload: { scheduledAt: string; durationMinutes?: number; packageId?: string; answers?: Record<string, string>; buyerMessage?: string },
  ) =>
    request<PublicCoachingSession>(`/coaches/${coachId}/sessions`, { method: 'POST', body: JSON.stringify(payload) }),

  listMySessionsAsBuyer: () => request<PublicCoachingSession[]>('/coaching-sessions/mine-as-buyer'),

  listMySessionsAsCoach: () => request<PublicCoachingSession[]>('/coaching-sessions/mine-as-coach'),

  getCoachingSession: (id: string) => request<PublicCoachingSession>(`/coaching-sessions/${id}`),

  completeCoachingSession: (id: string) => request<PublicCoachingSession>(`/coaching-sessions/${id}/complete`, { method: 'POST' }),

  cancelCoachingSession: (id: string) => request<PublicCoachingSession>(`/coaching-sessions/${id}/cancel`, { method: 'POST' }),

  // Lifecycle v2: both sides confirm the start; the student confirms the coach's "done".
  confirmCoachingSessionStart: (id: string) => request<PublicCoachingSession>(`/coaching-sessions/${id}/confirm-start`, { method: 'POST' }),

  confirmCoachingSessionComplete: (id: string) => request<PublicCoachingSession>(`/coaching-sessions/${id}/confirm-complete`, { method: 'POST' }),

  // The 6-step booking flow (/coaching/[id]/book).
  bookCoachSessions: (
    coachId: string,
    payload: { packageId?: string; durationMinutes?: number; slots: string[]; goal: string; challenges?: string; discord: string; answers?: Record<string, string> },
  ) => request<PublicCoachingSession[]>(`/coaches/${coachId}/bookings`, { method: 'POST', body: JSON.stringify(payload) }),

  coachBusyTimes: (coachId: string) => request<Array<{ start: string; end: string }>>(`/coaches/${coachId}/busy`),

  // --- Follows (docs/design-mockups/12) ---
  getFollowStatus: (username: string) => request<{ following: boolean }>(`/users/${encodeURIComponent(username)}/follow-status`),

  followUser: (username: string) => request<{ following: boolean; followers: number }>(`/users/${encodeURIComponent(username)}/follow`, { method: 'POST' }),

  unfollowUser: (username: string) => request<{ following: boolean; followers: number }>(`/users/${encodeURIComponent(username)}/follow`, { method: 'DELETE' }),

  // --- Coach profile content, reviews, favourites (docs/design-mockups 06/14) ---
  getMyCoachProfile: () => request<MyCoachProfile>('/coaches/mine/profile'),

  updateMyCoachProfile: (payload: CoachProfilePatch) =>
    request<MyCoachProfile>('/coaches/mine/profile', { method: 'PATCH', body: JSON.stringify(payload) }),

  uploadMyCoachVideo: (file: File) => upload<{ videoFileUrl: string }>('/coaches/mine/video', file),

  clearMyCoachVideo: () => request<{ ok: true }>('/coaches/mine/video', { method: 'DELETE' }),

  // Staff: add / edit coaches (Coach Management roles).
  adminCreateCoach: (payload: { username: string; gameId?: string; specialty: string; bio: string; languages?: string[]; hourlyRateWaveCoin: number }) =>
    request<AdminCoachSummary>('/admin/coaches', { method: 'POST', body: JSON.stringify(payload) }),

  adminGetCoachProfile: (id: string) => request<MyCoachProfile>(`/admin/coaches/${id}/profile`),

  adminUpdateCoachProfile: (id: string, payload: CoachProfilePatch) =>
    request<MyCoachProfile>(`/admin/coaches/${id}/profile`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // --- Session disputes (backend/src/coaching/coaching-session-disputes.*) ---
  getSessionDispute: (sessionId: string) => request<{ dispute: PublicSessionDispute | null }>(`/coaching-sessions/${sessionId}/dispute`),

  openSessionDispute: (sessionId: string, reason: string) =>
    request<PublicSessionDispute>(`/coaching-sessions/${sessionId}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) }),

  sendSessionDisputeMessage: (sessionId: string, body: string) =>
    request<PublicSessionDispute>(`/coaching-sessions/${sessionId}/dispute/messages`, { method: 'POST', body: JSON.stringify({ body }) }),

  uploadSessionDisputeEvidence: (sessionId: string, file: File) => upload<PublicSessionDispute>(`/coaching-sessions/${sessionId}/dispute/evidence`, file),

  adminListSessionDisputes: (status: 'open' | 'resolved' | 'all' = 'open') => request<AdminSessionDisputeSummary[]>(`/admin/session-disputes?status=${status}`),

  adminGetSessionDispute: (id: string) => request<PublicSessionDispute & { session: PublicCoachingSession }>(`/admin/session-disputes/${id}`),

  adminSessionDisputeMessage: (id: string, body: string) =>
    request<PublicSessionDispute>(`/admin/session-disputes/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),

  adminResolveSessionDispute: (id: string, resolution: SessionDisputeResolution, note: string) =>
    request<PublicSessionDispute>(`/admin/session-disputes/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution, note }) }),

  // --- Marketing: promo codes + banners (backend/src/marketing/) ---
  redeemPromoCode: (code: string) => request<PromoRedemptionResult>('/promo-codes/redeem', { method: 'POST', body: JSON.stringify({ code }) }),

  adminListPromoCodes: () => request<AdminPromoCode[]>('/admin/promo-codes'),

  adminCreatePromoCode: (payload: { code: string; amountWaveCoin: number; maxRedemptions: number; startsAt?: string | null; expiresAt?: string | null; note?: string | null }) =>
    request<AdminPromoCode>('/admin/promo-codes', { method: 'POST', body: JSON.stringify(payload) }),

  adminUpdatePromoCode: (id: string, payload: Partial<{ amountWaveCoin: number; maxRedemptions: number; startsAt: string | null; expiresAt: string | null; active: boolean; note: string | null }>) =>
    request<AdminPromoCode>(`/admin/promo-codes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  listBanners: () => request<PublicBanner[]>('/banners'),

  adminListBanners: () => request<AdminBanner[]>('/admin/banners'),

  adminCreateBanner: (payload: { title: string; subtitle?: string | null; linkUrl?: string | null; buttonLabel?: string | null; sortOrder?: number }) =>
    request<AdminBanner>('/admin/banners', { method: 'POST', body: JSON.stringify(payload) }),

  adminUpdateBanner: (id: string, payload: Partial<{ title: string; subtitle: string | null; linkUrl: string | null; buttonLabel: string | null; active: boolean; startsAt: string | null; endsAt: string | null; sortOrder: number }>) =>
    request<AdminBanner>(`/admin/banners/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  adminUploadBannerImage: (id: string, file: File) => upload<AdminBanner>(`/admin/banners/${id}/image`, file),

  // Only an unused code can be deleted (409 once redeemed — deactivate it instead).
  adminDeletePromoCode: (id: string) => request<{ ok: true }>(`/admin/promo-codes/${id}`, { method: 'DELETE' }),
  adminDeleteBanner: (id: string) => request<{ ok: true }>(`/admin/banners/${id}`, { method: 'DELETE' }),

  // --- Trust & Safety (backend/src/trust/) ---
  createReport: (payload: { targetType: ReportTargetType; targetId: string; reason: ReportReason; details?: string }) =>
    request<{ id: string; status: ReportStatus }>('/reports', { method: 'POST', body: JSON.stringify(payload) }),

  adminTrustOverview: () => request<TrustOverview>('/admin/trust/overview'),

  adminTrustReports: (status: ReportStatus | 'all' = 'open') => request<AdminUserReport[]>(`/admin/trust/reports?status=${status}`),

  adminHandleReport: (id: string, status: ReportStatus, staffNote?: string) =>
    request<AdminUserReport>(`/admin/trust/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status, staffNote }) }),

  adminTrustSearch: (q: string) => request<TrustUserSummary[]>(`/admin/trust/users?q=${encodeURIComponent(q)}`),

  adminTrustUser: (id: string) => request<TrustUserDetail>(`/admin/trust/users/${id}`),

  adminTrustNote: (id: string, body: string) => request<TrustUserDetail>(`/admin/trust/users/${id}/notes`, { method: 'POST', body: JSON.stringify({ body }) }),

  adminTrustWarn: (id: string, message: string) => request<TrustUserDetail>(`/admin/trust/users/${id}/warn`, { method: 'POST', body: JSON.stringify({ message }) }),

  adminTrustFlag: (id: string, flagged: boolean, reason: string) =>
    request<TrustUserDetail>(`/admin/trust/users/${id}/flag`, { method: 'POST', body: JSON.stringify({ flagged, reason }) }),

  // Platform coaching packages (Starter / Growth / Elite): public list; staff list; Super Admin edits.
  listCoachingPackages: () => request<PublicCoachPackage[]>('/coaching-packages'),

  adminListCoachingPackages: () => request<AdminCoachingPackage[]>('/admin/coaching-packages'),

  adminUpdateCoachingPackage: (id: string, payload: Partial<Pick<AdminCoachingPackage, 'name' | 'sessionsCount' | 'durationMinutes' | 'priceWaveCoin' | 'tagline' | 'description' | 'features' | 'active'>>) =>
    request<AdminCoachingPackage>(`/admin/coaching-packages/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  adminUploadCoachVideo: (id: string, file: File) => upload<{ videoFileUrl: string }>(`/admin/coaches/${id}/video`, file),

  adminClearCoachVideo: (id: string) => request<{ ok: true }>(`/admin/coaches/${id}/video`, { method: 'DELETE' }),

  listCoachReviews: (coachId: string) => request<PublicCoachReview[]>(`/coaches/${coachId}/reviews`),

  getCoachingSessionReview: (sessionId: string) =>
    request<{ review: PublicCoachReview | null }>(`/coaching-sessions/${sessionId}/review`).then((res) => res?.review ?? null),

  reviewCoachingSession: (sessionId: string, payload: { rating: number; body?: string }) =>
    request<PublicCoachReview>(`/coaching-sessions/${sessionId}/review`, { method: 'POST', body: JSON.stringify(payload) }),

  listFavoriteCoachIds: () => request<string[]>('/me/coach-favorites/ids'),

  favoriteCoach: (coachId: string) => request<{ ok: boolean }>(`/coaches/${coachId}/favorite`, { method: 'POST' }),

  unfavoriteCoach: (coachId: string) => request<{ ok: boolean }>(`/coaches/${coachId}/favorite`, { method: 'DELETE' }),

  // --- Tournaments --- (backend/src/tournaments/tournaments.controller.ts)
  // Staff views that include draft tournaments (backend/src/tournaments/tournaments.controller.ts).
  adminBrowseTournaments: (limit = 100) => request<{ items: PublicTournamentSummary[]; total: number }>(`/admin/tournaments?limit=${limit}`),
  adminListTournamentMatches: (id: string) => request<PublicTournamentMatch[]>(`/admin/tournaments/${id}/matches`),
  browseTournaments: (filters: { gameId?: string; status?: TournamentStatus; limit?: number; offset?: number } = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value))
    })
    const query = params.toString()
    return request<{ items: PublicTournamentSummary[]; total: number }>(`/tournaments${query ? `?${query}` : ''}`)
  },

  getTournament: (id: string) => request<PublicTournamentSummary>(`/tournaments/${id}`),

  listMyTournamentRegistrations: () => request<string[]>('/tournaments/mine'),

  registerForTournament: (id: string, payload: { inGameName: string; inGameId: string }) =>
    request<PublicTournamentSummary>(`/tournaments/${id}/register`, { method: 'POST', body: JSON.stringify(payload) }),
  // Public username search (topbar suggestions, marketplace search) — active accounts, ≤8.
  searchUsers: (q: string) => request<PublicUserSearchResult[]>(`/users/search?q=${encodeURIComponent(q)}`),

  lookupTournamentPlayer: (q: string) => request<TournamentPlayerLookup>(`/tournaments/player-lookup?q=${encodeURIComponent(q)}`),

  registerTournamentTeam: (
    id: string,
    payload: { name: string; tag?: string; coachName?: string; players: Array<{ player: string; inGameName: string; inGameId: string }> },
  ) =>
    request<PublicTournamentTeam>(`/tournaments/${id}/teams`, { method: 'POST', body: JSON.stringify(payload) }),

  uploadMyTeamLogo: async (id: string, file: File) => upload<PublicTournamentTeam>(`/tournaments/${id}/teams/mine/logo`, await shrinkPhoto(file)),

  withdrawFromTournament: (id: string) => request<{ ok: boolean }>(`/tournaments/${id}/withdraw`, { method: 'POST' }),

  listTournamentTeams: (id: string) => request<PublicTournamentTeam[]>(`/tournaments/${id}/teams`),

  listTournamentMatches: (id: string) => request<PublicTournamentMatch[]>(`/tournaments/${id}/matches`),

  getTournamentMatch: (id: string, matchId: string) => request<PublicTournamentMatch>(`/tournaments/${id}/matches/${matchId}`),

  listMyTournaments: () => request<MyTournamentEntry[]>('/me/tournaments'),

  listMyTournamentMatches: () => request<PublicTournamentMatch[]>('/me/tournament-matches'),

  adminListTournamentTeams: (id: string) => request<PublicTournamentTeam[]>(`/admin/tournaments/${id}/teams`),

  adminSetTournamentTeamStatus: (id: string, teamId: string, status: TournamentTeamStatus) =>
    request<PublicTournamentTeam>(`/admin/tournaments/${id}/teams/${teamId}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  adminCreateTournamentMatch: (id: string, payload: TournamentMatchInput) =>
    request<PublicTournamentMatch>(`/admin/tournaments/${id}/matches`, { method: 'POST', body: JSON.stringify(payload) }),

  adminUpdateTournamentMatch: (id: string, matchId: string, payload: TournamentMatchInput) =>
    request<PublicTournamentMatch>(`/admin/tournaments/${id}/matches/${matchId}`, { method: 'POST', body: JSON.stringify(payload) }),

  adminDeleteTournamentMatch: (id: string, matchId: string) =>
    request<{ ok: boolean }>(`/admin/tournaments/${id}/matches/${matchId}`, { method: 'DELETE' }),

  adminCreateTournament: (payload: {
    gameId: string
    name: string
    description: string
    prize: string
    status?: TournamentStatus
    startDate: string
    maxPlayers: number
    details?: Record<string, string>
    rules?: string
    teamSize?: number
    prizes?: TournamentPrizes
  }) => request<PublicTournamentSummary>('/admin/tournaments', { method: 'POST', body: JSON.stringify(payload) }),

  adminUpdateTournament: (
    id: string,
    payload: Partial<{
      gameId: string
      name: string
      description: string
      prize: string
      status: TournamentStatus
      startDate: string
      maxPlayers: number
      details: Record<string, string>
      rules: string
      teamSize: number
      prizes: TournamentPrizes
    }>,
  ) => request<PublicTournamentSummary>(`/admin/tournaments/${id}`, { method: 'POST', body: JSON.stringify(payload) }),

  adminSetTournamentCover: (id: string, file: File) =>
    upload<PublicTournamentSummary>(`/admin/tournaments/${id}/cover`, file),

  adminDeleteTournament: (id: string) => request<{ ok: boolean }>(`/admin/tournaments/${id}`, { method: 'DELETE' }),

  // --- Subscriptions --- (backend/src/subscriptions/subscriptions.controller.ts)
  listSubscriptionPlans: (audience?: SubscriptionAudience) =>
    request<PublicSubscriptionPlan[]>(`/subscriptions/plans${audience ? `?audience=${audience}` : ''}`),

  listMySubscriptions: () => request<PublicUserSubscription[]>('/subscriptions/mine'),

  checkoutSubscription: (payload: { planId: string; successUrl: string; failUrl: string }) =>
    request<{ orderId: string; redirectUrl: string }>('/subscriptions/checkout', { method: 'POST', body: JSON.stringify(payload) }),

  cancelSubscription: (id: string) => request<PublicUserSubscription>(`/subscriptions/${id}/cancel`, { method: 'POST' }),

  adminListSubscriptionPlans: () => request<AdminSubscriptionPlanSummary[]>('/admin/subscription-plans'),

  adminCreateSubscriptionPlan: (payload: {
    audience: SubscriptionAudience
    tier: string
    name: string
    description: string
    priceGel: number
    billingPeriodDays?: number
    perks?: SubscriptionPerks
    sortOrder?: number
    isActive?: boolean
  }) => request<AdminSubscriptionPlanSummary>('/admin/subscription-plans', { method: 'POST', body: JSON.stringify(payload) }),

  adminUpdateSubscriptionPlan: (
    id: string,
    payload: Partial<{
      tier: string
      name: string
      description: string
      priceGel: number
      billingPeriodDays: number
      perks: SubscriptionPerks
      sortOrder: number
      isActive: boolean
    }>,
  ) => request<AdminSubscriptionPlanSummary>(`/admin/subscription-plans/${id}`, { method: 'POST', body: JSON.stringify(payload) }),

  adminListLiveSubscriptions: () => request<AdminUserSubscriptionSummary[]>('/admin/subscriptions'),

  adminGrantSubscription: (payload: { userId: string; planId: string; periodDays?: number; reason: string }) =>
    request<{ id: string; currentPeriodEnd: string }>('/admin/subscriptions/grant', { method: 'POST', body: JSON.stringify(payload) }),

  adminRevokeSubscription: (id: string, reason: string) =>
    request<{ id: string; status: string }>(`/admin/subscriptions/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
}
