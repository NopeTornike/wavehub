import type {
  AuthMeResponse,
  PublicUser,
  PublicCategory,
  PublicGame,
  PublicListingSummary,
  PublicListingDetail,
  PublicReview,
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
}
