# frontend

## Purpose
The Next.js app — **this is the one real frontend going forward** (confirmed decision, see root
`CLAUDE.md`). The static HTML/JS prototype at the repo root is UI/UX reference only; port ideas from
it into real components here, don't extend it further.

**2026-07-22 design pivot**: the user asked for this app's UI to visually match the static
prototype's actual design exactly, not just take loose inspiration from it — "UI should be a copy
of Tornike's [main branch]." `frontend/styles/global.css` is now a direct copy of the repo-root
`styles.css` (11,600+ lines — the prototype's real, actively-maintained design system: colors,
the sidebar app-shell layout, every page-specific component class), not the smaller custom
dark-purple theme this app used before. `frontend/public/assets/` is a copy of the repo-root
`assets/` folder for the same reason. `components/Layout.tsx`/`Sidebar.tsx`/`Topbar.tsx` now
implement the sidebar app-shell structure from `index.html` (`.app-shell` > `.sidebar` +
`.main-panel` > `.topbar`), replacing the old top-nav `Header`/`Footer` pair (`Header.tsx` deleted
— `Footer.tsx` still exists and is rendered inside `.main-panel`, but hasn't been restyled to
match the prototype's own footer yet).
**Still in progress, page by page** (see the build plan's progress log for the up-to-date list):
most page *content* (coaching, admin, support, etc.) still uses this app's own older component
classes (`.page`, `.card`, `.filter-bar`, `.admin-*`, etc.) rather than the prototype's exact
per-page markup — those old classes were preserved verbatim at the bottom of `global.css` (see
the "Legacy WaveHub-app component classes" comment block in that file) specifically so nothing
visually broke while this migration happens incrementally, but they are **not** the prototype's
real design, just a functional bridge. A page is only "done" for this pivot once its actual JSX
uses the prototype's real class names/structure. Do not assume a page matches the static site
just because it renders without errors — check it against the corresponding `.html` file at the
repo root.
**Done so far**: the app shell (`Sidebar`/`Topbar`/`Layout`), all 5 auth pages (`login`,
`register`, `forgot-password`, `reset-password`, `verify-email` — now use `.auth-page-shell`/
`.auth-card`/`.auth-tabs`/`.auth-form` from `auth.html`), and `marketplace.tsx`/
`listings/[id].tsx` (now use `.marketplace-head`/`.marketplace-toolbar`/`.marketplace-grid`/
`.marketplace-card` from `marketplace.html` and `.detail-page`/`.detail-layout`/
`.detail-buy-panel`/`.detail-gallery-card`/`.detail-reviews-card`/`.public-review-card` from
`detail.html`). Two deliberate deviations from the prototype worth knowing about if you touch
these pages again:
- **Card variant**: `marketplace.html`'s live cards are actually `.product-showcase-card`
  (rarity-glow borders, Level/Views stat overlay, seller-avatar-with-photo) — but that markup
  needs `accountStatus`/`views`/`likes`/`favoriteCount` fields the real `Listing`/`User` entities
  don't have. Used the plainer `.marketplace-card` variant instead (still real, defined CSS in
  `styles.css`, just the "dead code" branch on the static page since every static-prototype
  listing happens to be an account/skin) — visually consistent with the design system, just a
  simpler card shape. Revisit if/when the backend grows rarity/view-count fields.
  - **Pagination**: `marketplace.html` has no pagination (it renders every localStorage listing at
  once); the real backend paginates. Kept a plain prev/next `.button` pair below the grid — not
  part of the prototype, added because the feature has to exist somewhere.
`orders/index.tsx` (now uses `.orders-page-head`/`.orders-summary`/`.orders-tabs`/`.orders-list`/
`.order-card`+`.order-thumb`+`.order-copy`+`.order-side` from `orders.html`) and `wallet.tsx`
(now uses `.wallet-page-head`/`.wallet-dashboard-hero`/`.wallet-hero-breakdown`/`.wallet-layout`/
`.wallet-buy-panel`/`.wallet-history-section`/`.wallet-transaction-card` from `wallet.html`) are
also done. One class-collision fix this required: the real `orders.html` design defines its own
`.order-card` (a 3-column grid: thumb/copy/side) — but `.order-card` was already in use elsewhere
in this app (`wallet.tsx`'s withdrawal-request list, `support/index.tsx`, `admin/tickets.tsx`,
`admin/disputes.tsx`) as a flat flex-row card from the *legacy* bridge section of `global.css`.
Since both rules shared the same class name, cascade order meant the legacy one was silently
winning everywhere, including on the real orders.html-style card once it got built. Fixed by
renaming the legacy CSS rule to `.legacy-order-card` and updating its 4 other consumers to match
— `orders/index.tsx` is now the only page using the real `.order-card`. If you port one of those
4 remaining pages later, decide then whether it should adopt the real `.order-card` shape too (it
needs a `.order-thumb` child) or keep `.legacy-order-card`.
`wallet.tsx`'s withdrawal-request panel and orders/[id].tsx's delivery/chat/dispute panels have no
equivalent in the static prototype at all (no seller-payout or order-detail page exists there) —
left on legacy classes, not part of this pivot's scope.
**Deliberately deferred**: `profile.html` (560 lines) is two different things bolted together —
(a) an own-account dashboard with listing/coaching-session edit modals, which has no equivalent
anywhere in the real app yet (there's no seller "my listings" management UI at all — a gap
predating this pivot, see `backend/src/listings/CLAUDE.md`), so porting it isn't a visual-port
task, it's new seller-dashboard feature work; (b) a public seller-profile viewer
(`.public-profile-hero`/`.public-profile-stats`/`.public-profile-overview`, reached via
`profile.html?user=username`) that *is* portable but needs a public `GET /users/:username`-style
backend endpoint that doesn't exist yet (only `/auth/me` and admin-only user routes do). Tracked
as a separate task (see the build plan) rather than silently dropped or faked with placeholder
data.

## Key files
- `lib/auth.tsx` — `AuthProvider` + `useAuth()`. The single place that calls `api.me()` on load;
  every page reads `{ user, checked, refresh, logout }` from `useAuth()` instead of calling
  `api.me()` itself. `checked` distinguishes "haven't checked session yet" from "checked, logged
  out" — needed by any page that redirects when logged out, so it doesn't bounce a still-loading
  visitor. Call `refresh()` after anything that changes the session server-side without a full page
  navigation (e.g. `login.tsx` calls it right after a successful login, before its `router.push`,
  since Next keeps the same React tree across client-side navigation — without this the header
  would keep showing "logged out" after login until a hard reload)
- `pages/_app.tsx` — wraps every page in `AuthProvider`
- `pages/index.tsx` — minimal home page, links into `/marketplace`
- `pages/marketplace.tsx` — browse grid with category/game/type filters + pagination, wrapped in
  `Layout`
- `pages/listings/[id].tsx` — listing detail: gallery, description, requirements/FAQ (service),
  package picker (service) or stock/price (item), reviews with sort. The "buy" button calls
  `api.purchase()` for real (redirects to `/login?next=...` first if logged out) and, for a service
  listing with a `requirementsSchema`, renders a form for it before allowing purchase — the answers
  are sent as `requirementsAnswers`, validated server-side by
  `backend/src/orders/requirements-validator.ts`
- `pages/orders/index.tsx` — buyer/seller tab list of the viewer's orders (`api.listOrdersAsBuyer`/
  `listOrdersAsSeller`)
- `pages/orders/[id].tsx` — order detail: status, price/fee breakdown (fee only shown to the
  seller), requirements answers, delivery files (+ upload widget for the seller while
  `InProgress`/`Delivered`), a chat panel, and every status-gated action (start/deliver for the
  seller; accept/request-revision/cancel for the buyer; cancel-with-reason for the seller) — the
  viewer's role is inferred by comparing `useAuth()`'s user id against `order.buyer.id`/
  `order.seller.id`, not a separate flag. A completed order shows a review form
  (`api.createReview`) if the viewer is the buyer — the backend's `orderId` unique constraint is
  the actual duplicate-review guard, this page doesn't try to pre-check that itself. The chat panel
  polls `api.listMessages` every `MESSAGE_POLL_MS` (5s) rather than using WebSockets — matches the
  build plan's explicit call for Order Chat (`backend/src/chat/CLAUDE.md`); a sent message is
  appended to local state immediately on success rather than waiting for the next poll tick, so
  sending feels instant even though received messages lag up to 5s behind. There's also a dispute
  section: `api.getDispute` is fetched once on load (a 404 just means none exists yet, handled
  silently, not shown as an error) — if none exists and the order's status is disputable
  (`DISPUTABLE_STATUSES`, mirroring `backend/src/disputes/`'s `OPENABLE_STATUSES`), an "open a
  dispute" form renders; once one exists, a dispute panel renders instead (status, reason,
  resolution note once resolved, a message thread reusing the chat panel's CSS classes, and an
  evidence file list + upload widget, both locked once the dispute is `Resolved`/`Closed`) — no
  polling on this one, since `openDispute`/`sendDisputeMessage`/`uploadDisputeEvidence` each
  refresh `dispute` from their own response instead of needing a separate re-fetch. The message-
  send/evidence-upload forms are further gated to `isBuyer || isSeller` (a Super Admin viewing an
  order they aren't a party to can read the thread but not post into it — those endpoints are
  participant-only server-side and would 403). If a Super Admin and `dispute.status === 'open'`, a
  resolve form also renders (a required note + one button per `DisputeResolution` — release to
  seller / refund buyer / cancel order), calling `api.adminResolveDispute`. `reloadDispute` tries
  the participant-only `api.getDispute` first and falls back to the admin-only
  `api.adminGetDispute` (no participant check) on failure, so a non-participant Super Admin can
  still see the thread instead of getting stuck on the resulting 403
- `pages/wallet.tsx` — full wallet view: the derived balance breakdown (`api.getWalletBalance`
  — available/pending-clearance/earned/withdrawn, see `backend/src/withdrawals/CLAUDE.md` for how
  each number is computed), a WaveCoin top-up form (`api.createBogTopupOrder`, redirects the
  browser to BOG's hosted checkout page — WaveCoin is credited later by the backend's
  signature-verified callback, not by anything on this page; the `?topup=success|fail` query param
  after BOG redirects back is just a banner, and also triggers a `refresh()` + balance re-fetch so
  the new balance actually shows), a withdrawal request form (`api.requestWithdrawal` — method
  select with method-specific payout-detail fields: bank transfer asks for account holder/IBAN/
  SWIFT, PayPal and Wise both just ask for an email) with a list of the seller's own requests and a
  cancel button on `Pending` ones (`api.cancelWithdrawal`), and a raw transaction history list
  (`api.listWalletTransactions`)
- `pages/login.tsx`, `pages/register.tsx` — auth forms. `login.tsx` supports a `?next=` query param
  (validated with `safeNextPath` — must be a same-origin relative path starting with exactly one
  `/`, never an absolute/protocol-relative URL, to avoid an open redirect) and pushes there on
  successful login; other pages link to `/login?next=/wherever` when they need to force a login
  first (see `wallet.tsx`, `listings/[id].tsx`)
- `pages/forgot-password.tsx` — request a reset link by email
- `pages/reset-password.tsx` — landing page for the reset link (`?token=`), sets a new password
- `pages/verify-email.tsx` — landing page for the verification link (`?token=`), auto-verifies on
  load; offers a "resend" button on failure (only works if the visitor still has a valid session —
  see `api.resendVerification` in `lib/api.ts`)
- `components/Layout.tsx`, `components/Header.tsx`, `components/Footer.tsx` — shared chrome.
  `Header` reads identity from `useAuth()` (no fetch of its own) and, when logged in, renders
  `NotificationBell`. `Layout` is applied per-page, not globally in `_app.tsx` — the auth pages
  (`login`/`register`/etc.) intentionally render bare, without the marketing header/footer
- `components/NotificationBell.tsx` — bell icon with an unread-count badge (polls
  `api.getUnreadNotificationCount` every 20s) that opens a dropdown panel on click (fetches
  `api.listNotifications` fresh each time it opens, not cached). Clicking a notification marks it
  read (`api.markNotificationRead`) then navigates via `targetForNotification` — a small function
  that deep-links off `notification.metadata` (`orderId` → `/orders/:id`, `withdrawRequestId` →
  `/wallet`, else falls back to `/orders`). Closes on outside-click via a `mousedown` listener on
  `document`, matching no other existing pattern in this codebase (first dropdown-style UI) — see
  `backend/src/notifications/CLAUDE.md` for the backend side
- `components/AdminLayout.tsx` + `pages/admin/{index,listings,reviews,disputes,withdrawals,users}.tsx`
  — the admin panel. `AdminLayout` wraps `Layout`, redirects a logged-out visitor to login, shows a
  plain "access denied" state for a logged-in user with no `adminRole`, and otherwise renders a
  section nav (all six links shown to any staff account — see the gotcha below on why this doesn't
  mirror the backend's full per-role matrix). `admin/index.tsx` shows four stat tiles (pending
  listings/reported reviews/open disputes/pending withdrawals counts, each fetched independently via
  `Promise.allSettled` so one role-restricted section 403ing doesn't blank the whole dashboard).
  `admin/listings.tsx`/`reviews.tsx`/`withdrawals.tsx`/`users.tsx` are each a fetch-a-queue +
  act-on-a-row page (approve/reject, hide/remove/restore, process, suspend/restore/ban/unban) —
  `users.tsx` additionally has a search/status-filter form. `admin/disputes.tsx` is list-only
  (linking into `orders/[id].tsx`'s existing dispute panel, which has since gained a resolve form —
  see that page's entry below) since resolving needs the full evidence/message thread this list
  view intentionally doesn't duplicate. `admin/settings.tsx` is a simple view/edit form over
  `backend/src/settings/`'s platform fee %, minimum withdrawal, and a maintenance-mode checkbox
  that's stored but has no enforced effect yet (the form says so inline, matching that module's own
  Status section). `admin/tickets.tsx` (status/priority-filtered queue) and
  `admin/tickets/[id].tsx` (full thread, reply, internal-note form, a saved-reply picker that
  fills the reply textarea, status/priority/assign controls, an "assign to me" shortcut) are the
  staff side of `backend/src/support/`.
- `pages/support/index.tsx`, `pages/support/[id].tsx` — the user-facing side of support ticketing:
  open a new ticket (subject/category/description), list your own tickets, and a thread view that
  reuses the same `.chat-panel` CSS as order chat/disputes. Linked from `Header` as "დახმარება" for
  any logged-in user.
- `pages/coaching/index.tsx` (verified-coach directory, `.listing-grid`/`.listing-card` reused from
  the marketplace), `pages/coaching/[id].tsx` (profile detail — the "book a session" button is a
  visible, disabled placeholder since `backend/src/coaching/` has no session-booking model yet),
  `pages/coaching/apply.tsx` (become-a-coach application form) — linked from `Header` as
  "კოუჩინგი". `pages/admin/coaches.tsx` is the staff side: a pending-verification queue
  (approve/reject) plus a full coach list with suspend/restore for already-verified ones.
- `lib/api.ts` — the shared API client. **Every backend call goes through this**, not ad hoc
  `fetch()` per page — it centralizes the base URL, `credentials: 'include'` (required for the
  httpOnly session cookie to work cross-origin), and error unwrapping (`ApiError`). Note the
  marketplace/order/review methods return the raw backend shape, unlike the auth methods which are
  wrapped in `{ ok: true, ... }` — don't assume a uniform envelope. `addDeliveryFile` is the one
  method that doesn't go through the shared `request()` helper — it needs `FormData`/multipart, not
  a JSON body, so it does its own `fetch()` with the same `credentials: 'include'` + `ApiError`
  handling duplicated inline (small enough not to warrant a second shared helper yet)
- `styles/global.css` — CSS custom properties for a dark/purple gradient theme (`--bg`,
  `--gradient-start/mid/end`, etc.), plus the marketplace/detail-page classes (`.listing-grid`,
  `.listing-card`, `.filter-bar`, `.detail-layout`, `.package-list`, `.review-item`, etc.), the
  order/wallet classes (`.order-tabs`, `.order-card`, `.order-status` + its per-status color
  modifiers including `.order-status-disputed`, `.order-actions`, `.wallet-balance`,
  `.delivery-file-list`, `.balance-grid`/`.balance-stat`, `.withdraw-status-*`,
  `.transaction-list`/`.transaction-item`), and the chat classes (`.chat-panel`, `.chat-messages`,
  `.chat-message` + `-mine`/`-system` modifiers, `.chat-form`) — the dispute panel reuses these
  chat classes and `.delivery-file-list` rather than defining its own, since the shapes are
  visually identical; the withdrawal-request list on `wallet.tsx` reuses `.order-card`/`.order-list`
  for the same reason; and the notification classes (`.notification-bell`, `.notification-panel`,
  `.notification-item` + `.unread` modifier), which are new — nothing existing fit a dropdown

## Data model
N/A on the frontend itself. Talks to the NestJS backend (`backend/`) over HTTP; shared request/response
shapes and status enums come from `packages/shared-types` — `lib/api.ts` already imports `PublicUser`/
`AuthMeResponse` from there. Add new types there first before defining a local one.

## Conventions & gotchas
- All backend calls go through `lib/api.ts`. If you need a new endpoint, add a method there rather
  than calling `fetch()` directly in a page/component.
- `credentials: 'include'` is required on every request (already set inside `lib/api.ts`) — the
  session is an httpOnly cookie (see `backend/src/auth/CLAUDE.md`), not a token you can read/attach
  yourself. There is nothing in `localStorage` for auth anymore — if you find yourself reaching for
  `localStorage` to track "is the user logged in," call `api.me()` instead.
- Non-negotiable: don't fabricate data as if real (see root `CLAUDE.md` rule #6) — the repo-root
  static prototype has several `Math.random()` fake "online now" counters; do not port that pattern
  here.
- `next.config.js` sets `turbopack.root` to the **monorepo root** (`path.join(__dirname, '..')`),
  not this directory — required because npm workspaces hoists `next` and other deps into the root
  `node_modules`, and Turbopack needs its root scope to include wherever `next/package.json`
  actually resolves. If you ever see "couldn't find the Next.js package" during a build, check this
  first before touching dependencies.
- Lint runs via `eslint .` (flat config at `eslint.config.mjs`), **not** `next lint` — that command
  was removed in Next.js 16. Don't reintroduce it.
- `register.tsx` mirrors the backend's password policy constants (min length, letter+digit pattern)
  as local constants for instant client-side feedback — if `backend/src/auth/password-policy.ts`
  changes, update the mirrored constants here too (a shared-types export would be cleaner if this
  drifts again; not worth the indirection for two primitives yet).
- `marketplace.tsx` and `listings/[id].tsx` each have one `// eslint-disable-next-line
  react-hooks/set-state-in-effect` on the `setLoading(true)` at the top of their data-fetching
  effect — this is `eslint-plugin-react-hooks@7`'s new (React 19-era) rule flagging any synchronous
  `setState` at the start of an effect body. It's a real, standard "refetch when a dependency
  changes" pattern, not a bug; don't remove the disable comment without an actual redesign (e.g.
  `useTransition`) to replace it.
- Copy is in Georgian, matching the existing auth pages — keep new user-facing text in Georgian
  unless told otherwise.
- **`AdminLayout` shows every nav link to any user with a non-null `adminRole`, regardless of
  which specific role.** It does not replicate SPECIFICATION.md §5.13's full per-role CAN/CANNOT
  matrix client-side — each page's own API calls are the real enforcement (`AdminGuard` +
  `@RequireAdminRole(...)` server-side), and a role without access to a section just gets an
  `ApiError` with the backend's 403 message rendered in that page's error banner. Building a
  client-side mirror of the exact backend matrix was judged not worth the duplication/drift risk
  for a first pass — six roles with genuinely different per-capability access would need real
  upkeep to keep in sync. If this becomes confusing in practice (a role clicking into a section
  that immediately errors), revisit by hiding nav links per role rather than by duplicating the
  guard logic in a different form.
- Admin-panel mutation responses (`adminApproveListing`/`adminRejectListing`/`adminHideReview`/
  `adminRemoveReview`/`adminRestoreReview`) are typed `unknown` in `lib/api.ts`, not
  `PublicListingDetail`/`PublicReview` — those backend routes return the raw, unmapped TypeORM
  entity, not the `Public*` shape. The admin pages that call them only care that the call
  succeeded (they remove the row from local state on success), not the response body — don't add a
  `Public*` type to these calls without first fixing the backend to actually return that shape.

## Related modules
- `packages/shared-types/` — always check here first for an enum/type before defining one locally.
- `backend/src/auth/` — every endpoint `lib/api.ts` calls is defined there; check that module's doc
  for request/response shapes and behavior before changing either side.
- `backend/src/orders/`, `backend/src/wallet/`, `backend/src/withdrawals/`,
  `backend/src/payments/`, `backend/src/chat/`, `backend/src/disputes/`,
  `backend/src/notifications/` — back the orders/wallet/chat/dispute/notification pages; check
  those modules' docs for status-transition rules and response shapes before changing either side.
  Note `wallet.tsx`'s balance/transaction endpoints actually live in `backend/src/withdrawals/`'s
  controller, not `backend/src/wallet/`'s — see that module's doc.
- `backend/src/support/` — backs `pages/support/*.tsx` and `pages/admin/tickets*.tsx`.
- `backend/src/settings/` — backs `pages/admin/settings.tsx`.
- `backend/src/coaching/` — backs `pages/coaching/*.tsx` and `pages/admin/coaches.tsx`.

## Status
The full auth flow is real and fully wired to the backend end-to-end (no fallback/mock path):
register, login, logout, `/me`, email verification (with a working landing page + resend), password
reset (request + confirm, both with working pages). Marketplace browsing, checkout, order
management, and WaveCoin top-up are now real too: home page, filtered/paginated browse grid, a
listing detail page with packages/reviews and a working buy button (including the requirements
form for service listings), an order list + detail page with the full status-gated action set
(start/deliver/accept/revision/cancel/review), and a wallet page with the full derived balance
breakdown, BOG top-up, seller withdrawal requests, and transaction history — all backed by the
real `backend/src/listings/`, `backend/src/orders/`, `backend/src/reviews/`,
`backend/src/payments/`+`backend/src/wallet/`, and `backend/src/withdrawals/` endpoints, no mock
data. Session state is shared via `lib/auth.tsx`'s `AuthProvider`/`useAuth()` (replacing the
per-page `api.me()` duplication that used to exist in `Header`, `listings/[id].tsx`,
`orders/[id].tsx`, `orders/index.tsx`, and `wallet.tsx`). `orders/[id].tsx` also has a polling chat
panel (`backend/src/chat/CLAUDE.md`) and a dispute panel (open/discuss/attach evidence —
`backend/src/disputes/CLAUDE.md`). `Header` now shows a notification bell (unread badge, dropdown
panel, mark-read/mark-all-read — `NotificationBell`, `backend/src/notifications/CLAUDE.md`).
A real admin panel now exists: `AdminLayout` + `pages/admin/*.tsx` cover listing approval, review
moderation, dispute resolution, withdrawal payout processing, user search/suspend/restore/
ban/unban, platform settings, and support-ticket triage — see the Key files entry above and
`backend/src/admin/CLAUDE.md` for the backend side. This covers Phase 11c (core CRUD), 11d
(Support ticketing — both the staff queue and the user-facing `pages/support/*.tsx`), and part of
11f (platform settings). A first slice of Coaching (Phase 11b) has frontend too — the public
directory/profile/apply pages and the admin verification queue — but no session-booking UI, since
the backend has no booking model yet (see `backend/src/coaching/CLAUDE.md`). Trust & Safety/
Analytics (11e, 11g) have no frontend at all yet. No cart page
(checkout is a direct single-listing buy, not a multi-item cart — matches the WaveCoin/order model,
not an oversight), no seller dashboard / create-listing frontend, no coaching/profile/messages
pages yet. The repo-root static site remains the reference mockup for all of that until it's
ported here.

**Verification caveat**: this workspace has no Docker/Postgres available (a constraint noted
throughout this repo's `CLAUDE.md` files), so everything above was verified via
`npm run build`/`lint`/typecheck only, against real response *shapes* from `packages/shared-types` —
not against a running backend with real seeded data in an actual browser. **A live browser preview
of this app is also not reachable from this particular sandbox**: the session's primary working
directory is a sibling of this repo, and the sandbox blocks the shell from `cd`-ing into it to run
`npm run dev` (`shell-init: error retrieving current directory: getcwd: cannot access parent
directories: Operation not permitted`) — this is a harness-level restriction, not a project bug; a
session whose primary working directory is inside this repo shouldn't hit it. In particular, the
BOG top-up redirect and the full purchase→deliver→accept→review order lifecycle have never been
click-tested end-to-end. Do that (from a working directory inside this repo, `docker-compose up`,
seed a listing, walk a full buyer+seller journey through `/marketplace` → `/orders` → `/wallet`)
before trusting this in front of a real user.
