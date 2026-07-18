# notifications

## Purpose
The in-app notification center, plus the hook points that populate it. Build-plan Phase 10 —
explicitly "threads through, not standalone": this module owns the `Notification` entity and the
mark-read/list endpoints, but the actual event emission happens inside five other modules that call
into it.

## Key files
- `notification.entity.ts` — `Notification`: `type` (`NotificationType`), `title`/`body` (plain
  text, not templated — each hook site writes its own Georgian copy), `metadata` (jsonb — whatever
  id a frontend needs to deep-link: `orderId`/`disputeId`/`reviewId`/`withdrawRequestId`), `readAt`
- `notifications.service.ts` — `emit` (the one place a row is created; takes an optional
  `alsoEmail` to bundle a transactional email via `EmailService` in the same call — **not used by
  any hook site yet**, see Status), `listMine`, `getUnreadCount`, `markRead` (ownership-checked —
  see the gotcha below), `markAllRead`
- `notifications.controller.ts` — `GET notifications`, `GET notifications/unread-count`,
  `POST notifications/:id/read`, `POST notifications/read-all`

## Data model
`notifications` (migration: `CreateNotifications`), a partial index
(`WHERE "readAt" IS NULL`) on `userId` for the unread-count query. `ON DELETE CASCADE` from
`users` — a deleted user's notifications go with them (no user deletion flow exists yet, but the
constraint is there for whenever one does).

## Conventions & gotchas
- **`markRead`'s ownership check is the entire reason it's not a generic `update()`.** The build
  plan calls this exact bug class out explicitly: "mark-as-read is scoped to the requesting user
  only (explicit authz test — this bug class is easy to miss)." See
  `notifications.service.spec.ts` for the test that would catch a regression here.
- **`NotificationType` only covers the subset of SPECIFICATION.md §5.12's full event catalog that
  actually has a hook point wired up.** The spec's full list also includes account events
  (registration, password change, email verified) and marketplace events (service approved/
  rejected/paused) — neither is wired, since those live in `backend/src/auth/` (Phase 1) and
  `backend/src/listings/` (Phase 3), both earlier than the "Phases 5–9" range the build plan
  scoped this hook-wiring pass to. Don't assume every notification type a user might expect exists
  — check this file's Status section for the real list.
- **Every hook site follows the same best-effort shape**: a private `notify(...)` helper (or an
  inline try/catch, for the two-line cases) wrapping `NotificationsService.emit(...)`, logged and
  swallowed on failure. A notification must never be the thing that blocks or rolls back the real
  action that triggered it — same principle as `backend/src/chat/`'s `postSystemMessage` callers,
  which predate this module and set the pattern.
- **`emit`'s `alsoEmail` param exists but nothing passes it yet.** SPECIFICATION.md §5.12 calls for
  matching transactional emails on "the key ones" (new order, delivery submitted, order completed,
  withdrawal approved, dispute updates) — wiring that up needs the recipient's email address, which
  would mean pulling `UsersService` into five hook modules that don't otherwise need it. Deferred
  as a real, documented gap rather than guessed at now — see Status.
- **`ChatService.postMessage` notifies the recipient, not the sender**, and **not** for system
  messages (`postSystemMessage` has no notification hook — those are already visible via the chat
  panel's own polling, and firing a notification for every order-lifecycle chat notice would be
  noisy). Only real buyer/seller messages trigger a `NewMessage` notification.

## Related modules
- `backend/src/orders/` — `OrderPaid`/`OrderStarted`/`OrderDelivered`/`OrderRevisionRequested`/
  `OrderCompleted`/`OrderCancelled`, via a private `notify` helper mirroring `postSystemMessage`.
- `backend/src/disputes/` — `DisputeOpened` (to the counterpart, not the opener),
  `DisputeResolved` (to both parties).
- `backend/src/reviews/` — `ReviewPosted`, to the seller, best-effort outside the review's own
  transaction.
- `backend/src/withdrawals/` — `WithdrawalStatusChanged`, to the seller, on every `process()` call.
- `backend/src/chat/` — `NewMessage`, to the recipient only.
- `backend/src/email/` — `EmailService`, imported for the unused `alsoEmail` bundling path.
- `packages/shared-types/` — `NotificationType` enum, `PublicNotification` response shape.

## Status
Core infrastructure (entity, service, controller, migration) and all five Phase 5–9 hook points are
implemented and unit-tested — 161 backend tests total as of the last update (7 new in
`notifications.service.spec.ts`, plus new assertions in `chat.service.spec.ts` for the
notify-the-recipient behavior). Not verified against a live Postgres transaction (no DB available
in the sandbox this was built in). Frontend exists: a bell icon in `Header` (unread badge, polls
every 20s) opens a dropdown panel (`frontend/components/NotificationBell.tsx`) listing recent
notifications with mark-read (on click, before deep-linking) and mark-all-read — see
`frontend/CLAUDE.md`. Not yet built: account-event and marketplace-event notification types (see
the gotcha above), the `alsoEmail` transactional-email bundling (interface exists, unused), and a
dedicated "all notifications" page (the bell dropdown only shows the most recent page, there's no
`/notifications` route in `frontend/` — `listMine`'s pagination params exist but nothing beyond the
default first page is ever requested).
