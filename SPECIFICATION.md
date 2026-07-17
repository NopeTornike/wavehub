# WaveHub — Product & Engineering Specification

This is the reference document for anyone (human or agent) working on this repo. It exists because the
source-of-truth product spec is a PDF that isn't in version control. This file distills that PDF into
something a coding agent can act on: what to build, what already exists, what's wrong in the existing
code, and what decisions are still open.

**If you're an agent picking up a task here: read the "Current implementation state" and "Non-negotiable
rules" sections before writing code. Don't rebuild something that already half-exists without checking
this file first, and don't extend the WaveCoin top-up flow further without flagging the open architecture
question below to the user.**

---

## 1. Product summary

WaveHub is a marketplace for gaming services — think Fiverr, scoped to gaming. Sellers list services
(rank boosting, coaching, duo/squad play, account setup) for specific games (PUBG Mobile, COD Mobile,
Free Fire, Mobile Legends, Roblox). Buyers purchase a package, the seller delivers, and money moves
through an escrow held by WaveHub until the buyer confirms delivery. WaveHub takes a platform fee
(10% in all spec examples, meant to be admin-configurable).

Core roles: **Buyer**, **Seller** (any user can become one), **Admin** (three tiers: Super Admin,
Support Admin, Finance Admin).

**Open question — confirm before continuing marketplace work:** the current prototype's commit history
("skin selling system added", account/skin-flavored UI) suggests it may have been built around selling
game accounts/skins rather than gaming *services*. Confirm with the product owner which the marketplace
is actually for before adding more listing/category UI — the data model differs (a skin/account listing
doesn't need Packages, Requirements forms, or Delivery Time the way a service does).

---

## 2. Current implementation state (as of branch `aslan-backend`, commit `3e71014`)

The repo currently contains **two disconnected codebases**:

### A. Static prototype (repo root, `*.html` / `*.js` / `styles.css`)
Plain HTML/CSS/vanilla JS, no build step, no framework. This is where almost all visible UI lives:
homepage (`index.html`), marketplace grid (`marketplace.html`), listing detail (`detail.html`), cart
(`cart.html`), coaching directory + booking (`coaching.html`, `coach-book-session.html`), auth
(`auth.html`), profile (`profile.html`), messages (`messages.html`), wallet (`wallet.html`).

**Everything in this prototype is fake/local.** All state — listings, cart, favorites, reviews, purchases,
wallet balances — is read/written to `localStorage` under keys like `wavehub.cart`, `wavehub.favorites`,
`wavehub.purchases`, `wavehub.sellerListings`, `wavehub.sellerReviews`, `wavehub.wallets`, `wavehub.users`,
`wavehub.session`. There is no server persistence for any of it. Treat this as a UI/UX reference for
layout and flow, not as working functionality — none of it is wired to a real backend except auth and
wallet top-up (see below).

Known issues in this layer:
- **Fake "online now" counts** via `Math.random()` in `script.js`, `marketplace.js`, `messages.js`,
  `wallet.js` — presented to users as real presence data. Remove; don't build more fake-data UI like this.
- `coaches-data.js` is a single hardcoded mock coach — no real multi-seller data source.
- Dead nav stubs: "Orders" link (`href="#"`, no `orders.html`, no order feature at all), "Favorites"
  link (`href="#"`, no dedicated page), "Streams"/"Blog" links on coaching pages.
- "Team Finder" and "LFG" nav links exist in `index.html` but are commented out — **this is correct**,
  the spec explicitly defers both to post-MVP. Leave them commented out; don't wire them up.

### B. NestJS backend (`backend/`) + Next.js frontend (`frontend/`)
Added later, not referenced by any commit message, disconnected from the static prototype above except
for two API calls (`auth.js` and `wallet.js` call it with a hardcoded localhost fallback).

- **Backend**: NestJS 11 + TypeORM + PostgreSQL. Only two feature areas exist:
  - `AuthModule` (`backend/src/auth/`): `POST /auth/register`, `POST /auth/login`,
    `GET /auth/check-username`. Passwords hashed with bcrypt (cost 10) — correct, keep doing this.
    **No session/token issuance exists** — login returns a plain user object and nothing server-side
    enforces auth afterward. There's no `/auth/me`, no guards, no Passport strategy, no cookie/JWT.
    Dual-mode: uses TypeORM `Repository<User>` if `DATABASE_HOST` is set, otherwise falls back to a
    JSON file at `backend/data/users.json`.
  - `PaymentsModule` (`backend/src/payments/`): `POST /payments/bog/create-order` — integrates with
    Bank of Georgia's e-commerce API to top up an internal currency called **WaveCoin**. This is the
    payment-model mismatch flagged in §3 below.
  - Only one DB entity exists: `User` (`id`, `username`, `firstName`, `lastName`, `passwordHash`,
    `role: 'buyer' | 'seller'`). No entities for listings, orders, escrow, disputes, reviews, wallet,
    withdrawals, notifications, or anything else in this spec.
  - No migrations — schema is driven by TypeORM `synchronize` (via `TYPEORM_SYNC` env). Fine for local
    dev, not for anything real; add migrations before this touches production data.
  - **Known bug**: `backend/package.json` pins `"typeorm": "^1.0.0"`, which resolves to the actual
    ancient/abandoned `typeorm@1.0.0` npm package — incompatible with `@nestjs/typeorm@11.x`, which
    expects TypeORM `^0.3.x`. This will very likely break `npm install`/build. Fix the pin before doing
    any backend work.
- **Frontend**: Next.js 16 (pages router) + React 18. Only `pages/login.tsx` and `pages/register.tsx`
  exist — no home page, no dashboard, nothing else. Both pages call the backend, but if it's unreachable
  they silently fall back to a **local-only account** stored in `localStorage`, hashed with client-side
  SHA-256 (`crypto.subtle.digest`). This is a different hashing scheme from the backend's bcrypt, so a
  "local" account can never subsequently log in against the real backend. **Remove this fallback pattern
  rather than extend it** — auth should have one real path, not a silent fake one.

### No tests, no CI exist anywhere in the repo.

---

## 3. Payment architecture — open decision, do not guess

Two incompatible models are in play:

- **What's built**: buyer tops up a WaveCoin balance via BOG (Bank of Georgia), presumably spends
  WaveCoin inside the site. No per-order escrow.
- **What the spec describes** (§7–9 below): buyer pays directly for a specific service purchase,
  WaveHub holds the money in **escrow** tied to that order, releases it to the seller on delivery
  confirmation (or 72h auto-complete, or admin dispute decision), minus a platform fee. Seller
  separately requests withdrawal of their accumulated balance via bank transfer/PayPal/Wise.

These aren't reconcilable by picking one bullet over another — they're different products. **Do not
build further payment/escrow/wallet features until the product owner confirms which model WaveHub is
actually running.** If the answer is "escrow per spec," the WaveCoin/BOG top-up code likely needs to be
either repurposed (WaveCoin becomes the escrow currency) or removed.

Separately, and regardless of that decision: **no specific payment provider (Stripe, PayPal,
Checkout.com, etc.) has been chosen for card/Apple Pay/Google Pay processing.** The source spec flags
this explicitly as undecided. This blocks real checkout implementation — raise it with the product owner
before building a checkout page that assumes a specific provider's SDK.

---

## 4. Non-negotiable engineering rules

These override anything in the source PDF that suggested otherwise (see §11 for why).

1. **Passwords are always hashed** (bcrypt or argon2). Never optional, never phase-gated. The backend
   already does this correctly for the DB path — keep it that way, and remove the client-side SHA-256
   local-account fallback instead of treating it as an acceptable alternative.
2. **No raw card data ever touches WaveHub's own servers or database.** Use a PCI-compliant processor's
   tokenization/hosted fields once a provider is chosen (§3).
3. **Every admin action is audit-logged** (who, what, when, why). The source spec contradicts itself on
   this (marks it optional in the payment-security section, then required in the admin-panel section) —
   treat it as required; it's cheap to build and necessary for dispute resolution and trust/safety.
4. **Email verification is required** before an account is fully active (`Pending Verification` →
   `Active`). The source spec also contradicts itself here (one bullet list marks it "not mandatory")
   — the detailed registration flow describing the Pending Verification state is the authoritative one.
5. **Real server-side auth session** (JWT or signed cookie) is required before building anything that
   depends on "who is logged in" — which is almost everything past registration (orders, chat, wallet,
   admin). This doesn't exist yet; it's the actual first building block, ahead of any feature work.
6. **Don't ship fake data as if real** (e.g. random "online now" counts). If presence/live data isn't
   built yet, don't fake it — omit the UI element or show a static/neutral state.

---

## 5. Feature specification by module

Each module below: target behavior (from the source spec), current status in this repo, and notes.
Fields/examples are illustrative, not exhaustive — this is meant to orient an agent, not replace design
docs for each screen.

### 5.1 User accounts & registration
**Target:** Register with username/email/password/confirm-password. Username and email must be unique,
password must meet a minimum-strength bar, user must accept Terms of Service and Privacy Policy.
Registration errors are field-specific ("Username already taken", "Passwords do not match", etc.). New
accounts get default avatar, `buyer` role, rank blank, rating 0.0, 0 reviews, status `Pending
Verification` until email is confirmed, then `Active`. Login, password reset, profile edit (photo,
bio), light/dark theme toggle, and a buyer dashboard (joined date, games played, wallet, settings) are
all part of MVP.
**Status:** Register/login endpoints exist server-side (bcrypt-hashed), but: no email verification flow,
no password-strength validation beyond min length 6, no ToS/Privacy acceptance checkbox, no session
token issuance, no password reset, no profile-photo upload, no theme toggle. The static prototype has
UI for most of this against localStorage only.

### 5.2 Seller profile
**Target:** Seller profile page with cover photo (optional, 1500×500 recommended), square avatar,
username, online/offline/last-seen status, a seller tier badge computed from completed-order count
(New Seller 0–10, Rising Seller 10–50, Pro Seller 50–200, Elite Seller 200+), stats block (rating, total
reviews, total sales, member since, main game, current/highest rank, platforms), bio, up to 3 featured
services, reviews section with a star-percentage breakdown, achievement badges (Verified Seller, Top
Rated Seller, Fast Delivery, Trusted Seller, 100/500 Orders Completed), and a "Message Seller" contact
action.
**Status:** Not built server-side. `profile.html`/`profile.js` in the static prototype has adjacent UI
(seller listings, session management) but none of the fields above are modeled or persisted.

### 5.3 Reviews & ratings
**Target:** Only the buyer who completed that specific order can leave a review, once, after order
status = Completed. Star rating (1–5) required; written review optional, 10–1000 chars; optional tags
(Fast Delivery, Good Communication, Friendly, Professional, Highly Skilled, Recommended). Seller may
post exactly one reply per review. Buyer cannot edit after submission — only admin can. Reviews have a
status (Published/Hidden/Reported/Deleted) and can be reported (Spam/Fake/Abusive/Other) by any user.
Seller rating = simple average of all their review stars; each service also tracks its own rating
independently. Sortable by Newest/Highest/Lowest on buyer-facing pages.
**Status:** Not built. `wavehub.sellerReviews` in localStorage is a rough placeholder in the static
prototype, not connected to orders (there are no real orders to gate reviews on).

### 5.4 Orders & purchase flow
**Target flow:** Service Page → Package Selection (Basic/Standard/Premium) → Requirements Form
(seller-defined custom fields, required ones block progress) → Order Summary → Terms Acceptance
(explicit checkboxes for ToS + Refund Policy) → Checkout (payment method select) → Payment → Order
Created (only after payment succeeds; auto-generated ID like `WH-000123`) → Escrow funded → seller
notified → buyer dropped into Order Chat. Order status lifecycle:
`Pending Payment → Paid → In Progress → Delivered → Completed`, with `Cancelled`/`Refunded`/`Disputed`/
`Expired` reachable off that path. Buyer dashboard has My/Active/Completed/Cancelled tabs with a
delivery countdown. Buyer actions depend on status: Contact Seller, Request Revision, Accept Delivery,
Open Dispute. A seller can't buy their own service. A seller in "Vacation Mode" blocks new purchases.
Checkout idle >30 min expires the session. Auto-complete after 72h of buyer inactivity on a delivered
order.
**Status:** Not built at all — no order concept exists anywhere except the "Orders" dead nav stub.
This is the structural core of the product; almost everything else (escrow, chat, reviews, disputes,
notifications) hangs off an Order entity that doesn't exist yet.

### 5.5 Payment & escrow
**Target:** See §3 for the architecture question this depends on. Once resolved: payment statuses
(Pending/Paid/Failed/Cancelled/Refunded), escrow statuses (Held/Released/Refunded/Frozen-during-dispute),
funds release triggers (buyer accepts delivery, OR 72h auto-complete, OR admin dispute decision),
platform fee is a configurable percentage (10% in all examples) taken off the top, receipts and
confirmation emails sent on success, no partial refunds in MVP.
**Status:** Only a WaveCoin top-up endpoint exists (see §3) — no escrow, no order-linked payment, no
fee calculation, no refund logic.

### 5.6 Wallet & withdrawals (seller-facing)
**Target:** Seller dashboard shows Available Balance, Pending Balance (funds still in a holding period),
Total Earnings, Withdrawn. MVP-recommended 7-day holding period after order completion before funds
become available (fraud/chargeback protection). Minimum withdrawal $20 (recommended default, should be
admin-configurable). Withdraw methods: Bank Transfer, PayPal, Wise. Withdraw request → Pending →
Processing → Completed (or Rejected/Cancelled by admin, with a required reject reason). Full transaction
history (order earnings, withdrawals, refunds, adjustments). Withdrawals are blocked while the seller
has an active dispute affecting that balance. Seller profile stores payout details (PayPal email / Wise
account / bank account+IBAN+SWIFT). A `Not Verified/Pending/Verified/Rejected` KYC status field should
exist on the seller profile now even though full document-upload KYC is Phase 2.
**Status:** Not built. The existing WaveCoin wallet is a different concept (top-up balance, not
seller earnings/payout) — see §3.

### 5.7 Disputes & refunds
**Target:** Either buyer or seller can open a dispute on an Active or Delivered order (not on
Completed/Cancelled/Refunded ones), within 7 days of delivery. Flow: Open Dispute → pick a reason
(buyer reasons: Service Not Delivered, Wrong Service, Poor Quality, Seller Unresponsive, Other; seller
reasons: Buyer Unresponsive, Buyer Abuse, False Claims, Requirements Changed, Other) → description
(min 20 chars) → evidence upload → submit. Opening a dispute freezes the related escrow. A dedicated
**Dispute Chat** exists with three participants (buyer, seller, admin) — treat this as required MVP
scope; the source spec has a contradictory one-line note calling it unavailable, but a full second pass
later in the same document specs it out in detail, which supersedes the earlier note. Dispute statuses:
Open/Under Review/Waiting For Evidence/Resolved/Closed. Admin sees order info, payment info, full chat
history, delivery files, and decides: Release Funds To Seller, Refund Buyer, Cancel Order, Warn User.
Refund statuses: Pending/Processing/Completed/Failed. No partial refunds in MVP. Deferred to Phase 2:
automatic chargeback detection, repeat-offender tracking/fraud flags.
**Status:** Not built at all.

### 5.8 Chat / messaging
**Target:** Two chat types — Direct Chat (buyer-initiated from a seller's profile, general) and Order
Chat (auto-created per order, tied to order ID, shows order status/deadline/package inline). Message
types: text, image, file (JPG/PNG/WEBP/PDF/ZIP, 20MB max), and auto-generated system messages ("Order
Started", "Delivery Submitted", "Revision Requested", "Dispute Opened"). Read receipts (Sent/Delivered/
Seen), typing indicators, online/last-seen status, unread counters, conversation search by
username/order ID. Buyers/sellers can block each other, **except** an active order's chat can never be
blocked. Reporting (Spam/Harassment/Fraud/Abuse/Other) from chat. Rate limiting (~10 msg/min), flood/
link-spam protection, file virus scanning, message audit logs. Admin can view all conversations and
delete messages / warn / mute / suspend users.
**Status:** `messages.html`/`messages.js` in the static prototype is a UI shell over
localStorage-modeled "offers," not real messaging, and has no concept of Order Chat since orders don't
exist yet.

### 5.9 Marketplace / service listings
**Target:** Sellers create services: pick a category (Rank Push, Coaching, Duo Play/Squad, Custom
Gaming Services, Account Setup Services) and a game (PUBG Mobile, COD Mobile, Free Fire, Mobile
Legends, Roblox), title (5–100 chars), rich description (50–5000 chars), 1–5 images, one or more
packages (name/price/delivery-time/features — Basic/Standard/Premium is the common pattern), a custom
requirements form for buyers to fill at purchase time (text/dropdown/number/textarea fields), and a
delivery time (1/2/3/5/7/14/30 days). Preview before publish. Status lifecycle: Draft → Pending Review
→ Active, with Paused/Rejected as admin-triggered states. Service page shows title, game, category,
seller card, rating, orders completed, description, packages, FAQ, reviews, related services. Ranking
in marketplace search favors higher rating, more views, faster seller response time, and gives new
listings a temporary boost. Admin can approve/reject/edit/pause/delete/feature any service.
**Status:** The static prototype has a rich-looking marketplace UI (`marketplace.html`/`marketplace.js`,
a "sell" modal) but it's backed entirely by `wavehub.sellerListings` in localStorage — no server
persistence, no admin moderation, no real category/game taxonomy enforcement, no requirements-form
builder.

### 5.10 Search & discovery
**Target:** Global search bar (every page) across service name/game/category/seller username, with
autocomplete suggestions. Results page with filters (game, category, price range, delivery time, seller
rating tier, verified-only toggle) and sorting (Recommended/Best Rating/Most Orders/Lowest-Highest
Price/Fastest Delivery/Newest). Per-game and per-category landing pages. Related-services and
recently-viewed sections. Trending (views+orders+rating) and Popular (orders+rating) sections on
homepage/marketplace. Empty state with suggested categories/popular services fallback. Admin-facing
search analytics (top searched terms, most viewed/clicked/converting services) and admin controls
(feature/hide/remove services; "boost" is Phase 2).
**Status:** Client-side filtering only, over the fake listing data; no backend search, no analytics.

### 5.11 Favorites
**Target:** Heart icon to save a service; dedicated "My Favorites" page.
**Status:** `wavehub.favorites` localStorage key exists and is referenced by icons/toggles across
pages, but there's no dedicated favorites page (nav link is a dead `href="#"`).

### 5.12 Notifications
**Target:** In-app notification center (bell icon, unread count, mark-as-read/mark-all-read) covering
account events (registration, password change, email verified), marketplace events (service approved/
rejected/paused), order events (new order, started, delivered, completed, revision requested,
cancelled), wallet events (withdrawal requested/approved/rejected, payment sent), chat events (new
message/attachment), and dispute events (opened/updated/resolved). Matching transactional emails for
the key ones (registration, password reset, new order, delivery submitted, order completed, withdrawal
approved, dispute updates).
**Status:** Not built.

### 5.13 Admin panel

**This section supersedes the lighter 3-role sketch in the original 80-page spec.** The client
provided six dedicated "Staff Management System" documents (2026-07 update) that define the real,
much larger admin panel scope: **Super Admin** plus five subordinate roles, each with an explicit
CAN and CANNOT list. Super Admin has unrestricted access to every capability below; every other
role's section lists its own subset verbatim from the source doc — don't infer a role's access from
its job title, use the explicit lists.

**Roles**: Super Admin, Operation Lead & Manager, Main Administrator, Marketplace & Coaching
Operations Manager, Trust & Safety Officer, Support Specialist.

#### 5.13.1 Super Admin — full catalog (every other role is a subset of this)

No restrictions — full access to every WaveHub function and system. This is the authoritative list
of every admin capability that exists anywhere in the product:

- **Dashboard**: full platform statistics, today's revenue, total revenue, active/completed/
  cancelled orders, active users/sellers/coaches, new registrations, verification requests, open
  disputes, support tickets, withdrawal requests, recent activity (Activity Log)
- **User Management**: view, search, filter, open profile, edit profile, **create a user account**,
  temporarily suspend, restore, permanently ban, remove ban, delete account, verify email, grant/
  remove verification, send warning, **change role**, view wallet, **add funds to wallet**,
  **deduct funds from wallet**, **adjust balance**, view order history, view payment history, add
  notes, increase rank/XP, view full action history
- **Seller Management**: view/edit profile, approve/reject seller verification, remove verification
  badge, suspend/restore marketplace access, view/edit/hide/delete listings, grant/remove featured
  status, view reviews, send warning, suspend/restore/ban account
- **Coach Management**: view/edit profile, approve/reject coach verification, remove verification
  badge, suspend/restore coaching access, view session history, view upcoming sessions, view
  reviews, send warning, suspend/restore/ban account
- **Coaching Management**: add/remove/edit a coach, change a coach's price, view all sessions,
  cancel a session, change session time, **reassign session to a different coach**, change session
  status
- **Marketplace Management**: add/edit/hide/delete listings, grant featured status, manage
  categories, manage tags
- **Digital Services Management**: view/approve/reject/edit/hide/delete services, manage featured
  status
- **Orders**: view all, search, filter, view details, change status, **Force Cancel**, refund, view
  delivery proof, view chat, open/close/resolve dispute, order notes, order timeline
- **Payments**: view all transactions + details, **Payment Logs**, refund, approve/reject payout,
  approve/reject withdrawal, **manage escrow**, **change commission**
- **Wallet**: view wallet, add funds, deduct funds, adjust balance
- **Reviews Management**: view all, hide, delete, monitor suspicious reviews
- **Reports**: view all + evidence, approve/reject report, warn/suspend/ban user
- **Support**: view all tickets, reply, add internal comment, change priority/status, close ticket
- **Disputes**: view all, review evidence, request more info, refund buyer, release funds to seller,
  make decision, close dispute
- **Content Management**: manage banners, games, categories, badges, tags, promo banners
- **Marketing**: create/edit/cancel promo codes
- **Analytics**: revenue analytics, order analytics, user analytics
- **Staff Management**: add/edit/delete staff, assign role, change permissions, view staff activity,
  temporarily disable a staff account
- **Security**: Activity Log, Audit Log
- **Platform Settings**: core platform settings, payment methods, commissions, escrow parameters,
  Maintenance Mode
- **Approval Center**: verification requests, seller applications, coach applications

#### 5.13.2 Operation Lead & Manager

Runs day-to-day operations; oversees admins/moderators/support. **No access to critical platform
settings, security systems, or top-level admin functions.**

Dashboard: today's operational stats, active/delayed/new orders, active disputes, verification
requests, support tickets, marketplace stats, coaching stats, online staff count, staff
productivity, recent activity, quick actions.

- **User Management** — CAN: view/search/open/edit profile, temp suspend, restore, send warning,
  approve/reject verification, view order history, view report history, add notes. **CANNOT**:
  delete account, change Super Admin/Staff roles, manually add/deduct wallet funds, reset 2FA.
- **Marketplace Management** — CAN: view/edit listings, hide rule-violating listings, delete
  listings, review featured requests, approve/reject seller verification, warn seller, temp suspend
  marketplace.
- **Coaching Management** — CAN: approve/reject coach verification, view/cancel sessions, warn
  coach, temp suspend coaching profile, coaching quality control.
- **Order Management** — CAN: view/search all orders, change status, cancel, open/review/close
  dispute, view delivery proof + chat, add order notes. **CANNOT**: Force Refund without critical
  financial approval.
- **Dispute Management** — CAN: view all, review evidence, request more info, prepare decision,
  escalate to Super Admin, close dispute.
- **Support Team Management** — CAN: view all tickets, redistribute tickets, change priority, SLA
  control, close ticket, evaluate support team performance.
- **Moderator Management** — CAN: control moderator work, review reports, verify complaints,
  control rule violations, confirm warnings.
- **Staff Management** — CAN: view staff list, redistribute work, evaluate staff, monitor activity,
  add internal comments. **CANNOT**: add staff, delete staff, change role, change permissions.
- **Analytics** — CAN: operational, order, marketplace, coaching, support, and staff-efficiency
  analysis.
- **Notifications** — CAN: send staff announcements, send system notifications to users, create
  announcements.
- **Approval Center** — CAN: review verification requests, seller applications, coach applications,
  featured requests, reports.
- **Reviews Management** — CAN: view all, hide, review suspicious reviews, review review-reports.
- **Digital Services Management** — CAN: view/approve/reject/edit services, hide rule-violating
  services, review featured requests.
- **Restrictions (explicit)**: cannot approve refunds independently (needs Super Admin or Finance
  Manager confirmation); cannot change Email/Notification templates; cannot change platform
  settings, commissions, or payment systems; cannot change API settings; cannot restore backups;
  cannot change critical System Health settings; cannot change staff roles/permissions; cannot
  manage the Super Admin account; cannot manually add/deduct wallet funds; cannot enable
  Maintenance Mode.

#### 5.13.3 Main Administrator

Handles routine day-to-day admin tasks — users, orders, marketplace, coaching, verifications,
reports, support. Makes operational decisions within their authority; escalates to Operation Lead
when needed.

Dashboard: active/new/delayed orders, new users, verification requests, active reports, open
disputes, support tickets, marketplace stats, coaching stats, recent activity, quick actions.

- **User Management** — CAN: view/search/open/edit profile, temp suspend, restore, send warning,
  verify email, approve/reject verification, view order/report history, add notes. **CANNOT**:
  delete account, change wallet balance, change role, reset 2FA.
- **Marketplace Management** — CAN: view/edit listings, hide, delete rule-violating listings, review
  featured requests, approve/reject seller verification, warn seller, temp suspend marketplace.
- **Coaching Management** — CAN: approve/reject coach verification, view/cancel sessions, warn
  coach, temp suspend coaching profile, review ratings.
- **Order Management** — CAN: view/search all orders, change status, cancel, view delivery proof +
  chat, add order notes, escalate order issue. **CANNOT**: Force Complete, Force Refund, Force
  Payout.
- **Dispute Management** — CAN: open dispute, review evidence, communicate with both parties,
  prepare recommendation, hand off to Operation Lead, close dispute (if authorized).
- **Reports Management** — CAN: view reports + evidence, issue warning, hide content, temp suspend
  account, record decision.
- **Support Management** — CAN: view all tickets, reply, redirect ticket, change priority/status,
  close ticket, add internal comment.
- **Content Management** — CAN: edit banners, edit FAQ, add news, edit categories, edit game info.
- **Analytics** — CAN: order, marketplace, coaching, user, and support stats.
- **Notifications** — CAN: send system announcements, individual user notifications, staff
  notifications.
- **Restrictions (explicit)**: cannot change platform settings or commissions; cannot change wallet
  balance or manually add/deduct funds; cannot approve payout or withdrawal; cannot change API
  settings; cannot manage backups; cannot add/remove staff or change staff roles/permissions; cannot
  enable Maintenance Mode; cannot change System Health settings; cannot override Super Admin/
  Operation Lead actions.

#### 5.13.4 Marketplace & Coaching Operations Manager

Owns day-to-day Marketplace and Coaching operations, quality control, and monitoring seller/coach
performance.

Dashboard: active seller/coach counts, new seller/coach applications, pending verification requests,
listings pending approval, low-rated sellers/coaches, active coaching sessions, today's marketplace/
coaching orders, average rating, rule-violation incidents, quick actions.

**Performance Alerts**: the system auto-flags a seller/coach as "needs attention" when: rating drops
below a threshold (example given: 4.2), cancelled-order rate exceeds the allowed limit, average
response time rises significantly, or several consecutive negative reviews land.

- **Seller Management** — CAN: view/edit profile, approve/reject verification, grant/remove
  verification badge, send warning, temp suspend, restore, view sales history, view ratings/
  reviews, view performance stats, add notes. **CANNOT**: permanently delete account, change
  financial balance, change role.
- **Coach Management** — CAN: view/edit profile, approve/reject verification, grant/remove
  verification badge, send warning, temp suspend, restore coaching, view session history, view
  ratings/reviews, view performance stats, add notes. **CANNOT**: permanently delete account, change
  financial balance.
- **Marketplace Listings** — CAN: view all, approve/reject, edit, hide, delete, review featured
  requests, suspend for rule violation, add internal comment.
- **Coaching Services** — CAN: view, approve, reject, edit, suspend, restore, add comment.
- **Marketplace & Coaching Orders** — CAN: view orders + details, control order status, view
  delivery proof + chat, flag problematic orders, add order notes, escalate to Main Administrator or
  Operation Lead. **CANNOT**: refund, Force Complete, Force Cancel.
- **Reviews** — CAN: view all, flag suspicious, hide offensive, forward deletion requests, analyze
  ratings.
- **Quality Control** — CAN: monitor Seller/Coach Quality Score, control cancellation rate,
  late-delivery rate, response time, customer satisfaction; weekly performance review.
- **Analytics** — CAN: marketplace/coaching analytics, seller/coach performance, best-selling
  services, most-demanded games, top-rated sellers/coaches.
- **Notifications** — CAN: notify sellers, notify coaches, marketplace listing announcements,
  coaching section announcements.
- **Restrictions (explicit)**: cannot change wallet balance; cannot refund; cannot approve payout or
  withdrawal; cannot change platform settings or commissions; cannot add/remove staff or change
  staff roles/permissions; cannot change API/security settings; cannot enable Maintenance Mode;
  cannot manage backups.

#### 5.13.5 Trust & Safety Officer

Owns platform safety, fairness, and rule enforcement — fraud prevention, suspicious-activity
detection, behavior monitoring, report review. **No access to financial operations, critical
platform settings, or staff permission changes.**

Dashboard: new/pending reports, suspicious users/sellers/coaches/listings/reviews, Chat Abuse
Alerts, Spam Alerts, Fraud Alerts, Fake Account Alerts, Ban Appeal Requests, security statistics,
recent activity, quick actions.

- **Report Management** — CAN: view all reports + details + evidence, request more info, approve/
  reject report, add internal comment, forward to Main Administrator or Operation Lead.
- **User Safety Control** — CAN: view profile, activity history, login history, IP history, device
  history, send warning, view Risk Score, request temporary suspension, recommend ban, add internal
  note. **CANNOT**: delete account, change wallet balance, change user role.
- **Marketplace Safety** — CAN: view/inspect listing, hide listing, recommend deletion, flag fake/
  scam listing, record rule violation, flag suspicious seller.
- **Coaching Safety** — CAN: inspect coach profile/services, detect rule violation, flag coach,
  recommend warning.
- **Chat Monitoring** — CAN: view reported chat, detect spam, flag offensive/threatening messages,
  detect fraudulent communication, rate chat.
- **Review Monitoring** — CAN: view all reviews, flag fake review, hide offensive review, flag
  rule-violating review, recommend deletion.
- **Risk Management** — CAN: monitor Risk Score, monitor suspicious activity, detect multi-account,
  IP anomalies, device anomalies, fraud patterns.
- **Ban Appeal Management** — CAN: receive appeal, review evidence, request more info, prepare
  recommendation, forward to Main Administrator or Operation Lead.
- **Evidence Center** — CAN: view photos/videos/files, chat history, order timeline, login timeline
  — all evidence for a case in one place.
- **Security Analytics** — CAN: fraud/spam/fake-account/ban/warning stats, most-frequent-violation
  analysis, Risk Score stats.
- **Notifications** — CAN: send warning, security notifications, request more info, official warning
  to user.
- **Restrictions (explicit)**: cannot change wallet balance; cannot refund; cannot approve payout or
  withdrawal; cannot change platform settings or commissions; cannot add/remove staff or change
  staff roles/permissions; cannot change API settings; cannot enable Maintenance Mode; cannot
  permanently delete a user; **cannot permanently ban a user independently** (recommends only).

#### 5.13.6 Support Specialist

Handles user help, ticket management, and first-line order issues. **Makes no administrative or
financial decisions** — resolves quickly or escalates to the right department.

Dashboard: new/active/"my"/high-priority/escalated/closed tickets, average response time, today's
stats, quick actions.

- **Support Tickets** — CAN: view every ticket available to them, open new ticket, reply, view/
  attach files, add internal comment, change status/priority, redirect to another department, close
  ticket, reopen ticket (if policy allows).
- **User Information** — CAN: view profile, order history, ticket history, internal notes, add new
  internal note. **CANNOT**: edit profile, suspend account, delete account, change role, manage
  wallet.
- **Order-related Help** — CAN: view order status, delivery proof, order chat; inform user; log
  problem; escalate to Main Administrator or Marketplace & Coaching Operations Manager. **CANNOT**:
  change order status, cancel order, Force Complete, refund.
- **Chat** — CAN: chat with user, use **Saved Replies**, send files, view conversation history.
- **Notifications** — CAN: send official notification to user, request more info, ticket-related
  notifications.
- **Internal Notes** — CAN: view/add internal note. **CANNOT**: delete or edit another staff
  member's note.
- **Internal Tasks** — CAN: view tasks assigned to them, change completion status, comment on task.
- **Escalation System** — CAN: escalate to Main Administrator, Trust & Safety Officer, or
  Marketplace & Coaching Operations Manager, with a stated reason and attached evidence.
- **Saved Replies are required** (canned response templates) — example categories given: payment
  problem, order status, refund process, verification, marketplace, coaching, technical problem.
- **Restrictions (explicit)**: cannot suspend or ban a user; cannot approve/reject verification;
  cannot change wallet balance; cannot refund; cannot approve payout or withdrawal; cannot change
  order status; cannot edit a marketplace listing; cannot suspend a coach or seller; cannot manage
  staff; cannot change platform settings; cannot send system-wide notifications; cannot make final
  decisions on reports.

#### 5.13.7 New entities/concepts this reveals (not previously anywhere in the spec or codebase)

- **Coach** as a user type distinct from Seller — own verification flow, own profile, own
  session-based (not order-based) delivery, own quality-score tracking. The original spec only had
  "Coaching" as one service *category* under Listings; this is a structurally different, parallel
  concept and needs its own data model, not a field on `Listing`.
- **Staff/permission system itself** — 6 named roles with explicit per-capability grants, not the
  3 loosely-defined roles the original spec sketched. `AdminRole` in `packages/shared-types` needs
  to grow from 3 values to 6 (done — see `backend/src/users/CLAUDE.md` for where it lands on the
  `User` entity once Phase 11 builds it).
- **Support ticketing system** — the contract's "Support Request, Contact Form" line item and the
  original spec together implied a bare contact form; this is a full ticket system: priority, SLA
  tracking, internal notes, saved replies, task assignment, multi-role escalation.
- **Promo Codes / Marketing** — create/edit/cancel promo codes. Not in the original spec at all.
- **Content Management beyond legal pages** — Banners, News, Games, Categories, Badges, Tags, Promo
  Banners, as distinct admin-managed content types (original spec's CMS only covered legal/static
  pages).
- **Platform Settings screen** — commission/fee editing, payment method management, escrow
  parameters, Maintenance Mode toggle, as a dedicated settings surface (the original spec had a
  single "Fee Percentage Setting" field; this is broader).
- **Fraud & Risk / Trust & Safety tooling** — Risk Score, multi-account detection, IP/device anomaly
  detection, Ban Appeals, Evidence Center, chat-abuse-specific monitoring. None of this existed in
  the original spec.
- **Approval Center** — a single aggregated queue for verification requests, seller/coach
  applications, and featured requests, rather than separate per-type approval screens.
- **Staff productivity/activity monitoring** — online staff count, staff efficiency analytics,
  internal task assignment/tracking. Internal-ops tooling with no prior spec mention.
- **Audit Log / Activity Log as two distinct things** — the original spec had one "audit log"
  concept; these docs separate "Activity Log" (broader activity feed) from "Audit Log" (admin
  action trail specifically). Worth confirming with the client whether this is a real distinction or
  just two names for the dashboard tiles.

**Status:** Not built — no admin surface exists anywhere in either codebase. This is now understood
to be one of the largest remaining pieces of the product, on par with or exceeding everything built
so far combined. See the build plan's Phase 11 entry for how this gets sequenced.

### 5.14 Static/legal pages
**Target:** About Us, Contact Us (form: name/email/subject/message), Terms of Service, Privacy Policy,
Refund Policy, Seller Guidelines, Community Guidelines — all admin-editable content, all linked from
the footer on every page.
**Status:** Not built.

### 5.15 Seller verification
**Target:** Verification status field on seller profile (Not Verified/Pending/Verified/Rejected).
Seller submits ID document + basic info (selfie step is explicitly Phase 2); admin approves/rejects.
**Status:** Not built.

### 5.16 Explicitly out of scope for MVP — do not build without checking with product owner
- Team Finder (create/search teams, recruitment posts) — nav links already correctly commented out.
- Looking For Group (LFG) posts.
- Partial refunds.
- Chargeback-protection automation (auto "Under Investigation" flagging).
- Repeat-offender/fraud-flag tracking dashboards.
- Selfie step of seller KYC verification.
- "Boost" (paid ranking boost) for services.

---

## 6. Where to look in this repo

| Area | Location |
|---|---|
| Static prototype pages/logic | repo root `*.html` / `*.js`, shared styling in `styles.css` |
| Fake data / mock state | `localStorage` keys documented in §2.A; `coaches-data.js` |
| Real backend (auth, BOG payments) | `backend/src/` — `auth/`, `payments/`, `users/user.entity.ts` |
| Backend entrypoint / CORS / global config | `backend/src/main.ts`, `backend/src/app.module.ts` |
| Backend env vars | `backend/.env.example` (incomplete — see gaps noted in audit history) |
| Next.js frontend (login/register only) | `frontend/pages/login.tsx`, `frontend/pages/register.tsx` |
| Local dev orchestration | `docker-compose.yml` (root), `backend/Dockerfile`, `frontend/Dockerfile` |
| Unrelated debris — should probably be removed | `tmp/imagegen/` (a vendored copy of Python's Pillow package) |

No `docs/` folder, no API documentation, no tests, no CI exist yet.

---

## 7. Suggested build order

This isn't a mandate, just a dependency-aware ordering based on what blocks what:

1. Fix the `typeorm` dependency pin; confirm backend actually installs/builds/runs.
2. Real auth session (JWT or signed cookie) + guards — almost everything else depends on knowing who's
   logged in server-side.
3. Resolve the payment-architecture question (§3) with the product owner before building Orders.
4. Order entity + purchase flow (§5.4) — the structural core everything else attaches to.
5. Escrow + payment integration once a provider is chosen (§5.5).
6. Order Chat (§5.8, narrow scope first — just the order-linked chat, not Direct Chat).
7. Reviews (§5.3, depends on Orders existing).
8. Disputes (§5.7, depends on Orders + Chat + Escrow).
9. Wallet/withdrawals (§5.6, depends on Escrow).
10. Notifications (§5.12) — thread through as each of the above lands, don't build it standalone first.
11. Admin panel (§5.13) — needs most of the above to have something to administer.
12. Search/discovery backend (§5.10), static/legal pages (§5.14), seller verification (§5.15).

---

## 8. Notes on the source spec

The source is an 80-page PDF (`wavehub mvp specification v2.pdf`, mixed Georgian/English), not checked
into this repo. This document is the distilled, contradiction-resolved version of it. Contradictions
found in the source and how they were resolved here:

- Password hashing marked "not required for MVP" in one bullet list → overridden, always required (§4.1).
- Email verification marked both required (in the detailed registration flow) and "not mandatory" (in a
  separate bullet list) → treated as required (§4.4).
- Audit logs marked "not necessary" in the payment-security section but required in the admin-panel
  section → treated as required (§4.3).
- Dispute chat marked "not available" in a short note but fully specified with statuses and three-party
  access later in the same document → the detailed version is treated as authoritative (§5.7).
- Footer link list is shorter in the "Home Page Structure" section than in the "Static Pages" section →
  use the longer, more complete list (§5.14) in both places.

If you find the original PDF and it's been updated, re-check this file against it — this is a snapshot,
not a live sync.
