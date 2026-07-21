import type {
  AuthMeResponse,
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
  WithdrawMethod,
  WithdrawStatus,
  DisputeResolution,
  AdminUserSummary,
  AdminDisputeSummary,
  AdminWithdrawRequestSummary,
  AdminListingSummary,
  AdminReviewSummary,
  PublicPlatformSettings,
  UserStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  PublicTicket,
  AdminTicketSummary,
  PublicSavedReply,
  PublicCoachSummary,
  PublicCoachDetail,
  AdminCoachSummary,
} from '@wavehub/shared-types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    // Required so the backend's httpOnly session cookie is sent/received cross-origin during
    // local dev (frontend on :3000, backend on :4000) and in any deployment where they're on
    // different subdomains.
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
    throw new ApiError(res.status, data?.error || message || 'Request failed')
  }

  return data as T
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

  // --- Marketplace (listings/categories/games/reviews) ---
  // Note: unlike the auth endpoints above, these are NOT wrapped in `{ ok: true, ... }` — they
  // return exactly what ListingsController/ReviewsController hand back (see backend/src/listings/
  // CLAUDE.md and backend/src/reviews/CLAUDE.md). Don't assume a uniform envelope across the API.
  listCategories: () => request<PublicCategory[]>('/categories'),

  listGames: () => request<PublicGame[]>('/games'),

  browseListings: (filters: {
    categoryId?: string
    gameId?: string
    type?: ListingType
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

  createReview: (payload: { orderId: string; rating: number; body?: string; tags?: string[] }) =>
    request<PublicReview>('/reviews', { method: 'POST', body: JSON.stringify(payload) }),

  // --- Orders --- (also not wrapped in `{ ok: true, ... }`, same as the marketplace endpoints)
  purchase: (payload: { listingId: string; packageId?: string; requirementsAnswers?: Record<string, unknown> }) =>
    request<PublicOrderDetail>('/orders', { method: 'POST', body: JSON.stringify(payload) }),

  listOrdersAsBuyer: () => request<PublicOrderSummary[]>('/orders/as-buyer'),

  listOrdersAsSeller: () => request<PublicOrderSummary[]>('/orders/as-seller'),

  getOrder: (id: string) => request<PublicOrderDetail>(`/orders/${id}`),

  startOrder: (id: string) => request<unknown>(`/orders/${id}/start`, { method: 'POST' }),

  deliverOrder: (id: string) => request<unknown>(`/orders/${id}/deliver`, { method: 'POST' }),

  addDeliveryFile: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_URL}/orders/${id}/delivery-files`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
      throw new ApiError(res.status, data?.error || message || 'Upload failed')
    }
    return data
  },

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

  addDisputeEvidence: async (orderId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_URL}/orders/${orderId}/dispute/evidence`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
      throw new ApiError(res.status, data?.error || message || 'Upload failed')
    }
    return data as PublicDispute
  },

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

  getUnreadNotificationCount: () => request<{ count: number }>('/notifications/unread-count'),

  markNotificationRead: (id: string) =>
    request<PublicNotification>(`/notifications/${id}/read`, { method: 'POST' }),

  markAllNotificationsRead: () => request<{ ok: true }>('/notifications/read-all', { method: 'POST' }),

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

  adminGetPlatformSettings: () => request<PublicPlatformSettings>('/admin/platform-settings'),

  adminUpdatePlatformSettings: (patch: {
    platformFeePercent?: number
    minWithdrawalWaveCoin?: number
    maintenanceMode?: boolean
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

  getMyCoachApplication: () => request<unknown>('/coaches/mine'),

  browseCoaches: (filters: { gameId?: string; limit?: number; offset?: number } = {}) => {
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

  adminSuspendCoach: (id: string) => request<AdminCoachSummary>(`/coaches/${id}/suspend`, { method: 'POST' }),

  adminRestoreCoach: (id: string) => request<AdminCoachSummary>(`/coaches/${id}/restore`, { method: 'POST' }),
}
