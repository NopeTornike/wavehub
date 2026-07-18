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
  ListingType,
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
}
