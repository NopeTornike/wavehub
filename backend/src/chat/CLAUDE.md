# chat

## Purpose
Two things share this module now. **Order-scoped chat** (build-plan Phase 6's "narrow scope
first"): auto-created when an order is purchased, carries real buyer/seller messages plus system
messages at order-lifecycle events. **Direct (non-order) messaging** (2026-09-16, LAUNCH_PLAN.md
§4): real coordination messaging between two users who have (or have had) a real order or
coaching session together — not a cold-messaging feature, and not a channel for negotiating price
or resolving a delivery problem (that stays on Order chat/disputes or Support). This was flagged
as the natural next step back when Order chat first shipped ("no Direct conversations... yet") —
this is that step, reusing the same `Conversation`/`Message` entities and the `ConversationType`
enum's already-scaffolded `Direct` value rather than a second, parallel table.

## Key files
- `conversation.entity.ts` — `Conversation`. `type: Order` rows: `orderId` set and unique (one per
  order), auto-created by `OrdersService.purchase`, `buyerId`/`sellerId` are the order's real
  parties. `type: Direct` rows: `orderId` is null, `buyerId`/`sellerId` just record who started the
  conversation vs. who they messaged — **not semantic roles**, see the gotcha below.
- `message.entity.ts` — `Message`: `senderId` is `null` exactly for `type: System` rows (Order chat
  only — a Direct conversation never has a system message); every other message has a real sender.
- `chat.service.ts` — Order chat: `ensureConversation` (idempotent, called by
  `OrdersService.purchase`), `listMessages`/`postMessage`, `postSystemMessage` (lifecycle events,
  no-ops if the conversation somehow doesn't exist rather than throwing). Direct messaging:
  `getOrCreateDirectConversation` (the "transacted users only" gate, idempotent under race),
  `listMyDirectConversations`, `listDirectMessages`/`postDirectMessage` (both participant-gated).
- `direct-messages.controller.ts` — `DirectMessagesController` (`/direct-messages`). The only
  controller in this module — Order chat still has none, see the gotcha below.
- `dto/send-message.dto.ts` — `SendMessageDto` (`body`, 1–2000 chars), reused by both Order chat
  and Direct messages. `dto/start-direct-conversation.dto.ts` — `StartDirectConversationDto`
  (`recipientUserId`, a UUID).

## Data model
`conversations`, `messages` (migration: `CreateChatSchema`, then `EnableDirectConversations` which
made `orderId` nullable and added a partial unique index — see the gotcha below).
`messages.conversationId` cascades on delete; `conversations.orderId` has a `FOREIGN KEY` to
`orders` but no `ON DELETE` action (orders are never hard-deleted).

## Conventions & gotchas
- **Order chat deliberately has no `ChatController`.** Its routes live on `OrdersController`
  (`GET`/`POST /orders/:id/messages`) so they reuse the participant-ownership check that already
  exists there (`order.buyerId !== userId && order.sellerId !== userId` → 403) instead of
  duplicating it in a module that would otherwise need to depend on `orders` just to re-derive who's
  allowed to read a conversation. `OrdersService.listMessages`/`sendMessage` are the thin wrappers
  that do the check and then delegate to `ChatService`. **Direct messaging is the opposite** — it
  has its own real `DirectMessagesController`, because its participant check
  (`getDirectConversationForParticipant`) is self-contained inside `ChatService` and has no other
  module's existing check to reuse.
- **`ChatModule` still has no *module-level* dependency on `orders`/`coaching`/`users`** — Order
  chat's methods take `orderId`/`buyerId`/`sellerId` as plain params from the caller, same as
  always. Direct messaging's eligibility check needed real read access to `Order`/`CoachingSession`/
  `User` data, so `ChatModule` registers those three as plain entities via
  `TypeOrmModule.forFeature` (see `chat.module.ts`) — an **entity-level**, read-only dependency,
  not a module import of `OrdersModule`/`CoachingModule`/`UsersModule`. This keeps the existing
  one-directional `OrdersModule`/`CoachingModule` → `ChatModule` import shape intact (no circular
  risk) while still letting `ChatService#haveTransactedTogether` query real data instead of trusting
  a caller-supplied "yes they transacted" flag.
- **Direct conversation `buyerId`/`sellerId` are NOT semantic roles.** They just record who called
  `getOrCreateDirectConversation` first (`buyerId`) vs. who they messaged (`sellerId`) — a coach
  messaging their own buyer still ends up with the coach as `buyerId` if the coach happened to
  click "Message" first. Always compute "the other participant" relative to the viewer
  (`toConversationSummary`/`getDirectConversationForParticipant` do this correctly) — never assume
  `buyerId` means "the buyer" outside an actual `type: Order` row.
- **The "transacted together" check is real, not a client-supplied claim.**
  `haveTransactedTogether(userA, userB)` queries `Order` (either direction — either could be buyer)
  and, separately, `CoachingSession` joined through `Coach` to compare against `coach.userId` (since
  `CoachingSession.coachId` is a Coach *profile* id, not a user id — the same distinction
  `backend/src/coaching/CLAUDE.md` documents). `PublicCoachingSession` gained a `coachUserId` field
  alongside this so the frontend's "Message the coach" button has a real user id to pass, not just
  the coach's profile id.
- **At most one Direct conversation per unordered user pair, enforced at the DB level, not just in
  application code.** `getOrCreateDirectConversation` looks for an existing row first, but a
  concurrent race is still possible — the `UQ_direct_conversation_pair` partial unique index
  (`WHERE type = 'direct'`, keyed on `LEAST`/`GREATEST(buyerId, sellerId)` so insertion order
  doesn't matter) is the actual guard; a `23505` violation is caught and the now-existing row is
  re-fetched, same pattern as `TournamentsService.register()`'s duplicate-registration guard.
  Verified for real: starting a conversation twice (once as each party) returns the identical
  conversation id both times, and a direct `psql` count confirms exactly one row exists.
- **Every call site in `OrdersService` treats Order chat as best-effort.** A chat failure must never
  roll back or block a real order state change (that's money-adjacent state, chat isn't).
  `purchase()` calls `ensureConversation`/`postSystemMessage` *after* its own transaction commits,
  in a try/catch that only logs; every other lifecycle method goes through `OrdersService`'s private
  `postSystemMessage(orderId, body)` helper, same try/catch/log pattern. Direct messaging's own
  notification call (`postDirectMessage`) follows the identical best-effort try/catch/log shape.
- **System message copy and Direct-messaging UI copy are both in Georgian**, matching the rest of
  the product's user-facing text (see `frontend/CLAUDE.md`).
- **`Message.status` (`Sent`/`Delivered`/`Seen`) is defined but nothing ever sets it past the
  default `Sent`** — read receipts are out of scope, for Order chat and Direct messages alike.
- **No content filtering on Direct messages, by design.** LAUNCH_PLAN.md §4's "coordination only,
  not a transaction channel" rule is enforced as UI policy (a persistent notice in the thread linking
  to Support — see `frontend/pages/messages/index.tsx`), not by parsing message bodies for
  transaction language — parsing free text for policy violations is unreliable and was explicitly
  ruled out when this was designed.

## Related modules
- `backend/src/orders/` — Order chat's primary caller; every lifecycle transition that should
  produce a system message is listed in the gotcha above.
- `backend/src/disputes/` — also posts system notices via `postSystemMessage`, same best-effort
  pattern.
- `backend/src/coaching/` — read-only entity dependency for the Direct-messaging eligibility check
  (`CoachingSession` joined through `Coach`); see the gotcha above for the `coachId`-vs-`coachUserId`
  distinction.
- `backend/src/notifications/` — `NotificationType.NewMessage` is shared by both Order chat
  (`postMessage`, metadata: `{ orderId }`) and Direct messages (`postDirectMessage`, metadata:
  `{ conversationId }`) — `frontend/components/NotificationBell.tsx`'s `targetForNotification`
  branches on whichever metadata key is present.
- `packages/shared-types/` — `ConversationType`/`MessageType`/`MessageStatus` enums, `PublicMessage`
  and (new) `PublicConversationSummary` response shapes.

## Status
**Order chat**: `ensureConversation` + one system message per lifecycle transition are wired into
every `OrdersService` mutation; real buyer/seller messaging has a frontend at
`frontend/pages/orders/[id].tsx` (`.chat-panel`, polls every 5s). System messages render
centered/muted; the viewer's own messages align right; everyone else's align left with a
`@username` prefix.

**Direct messaging (2026-09-16) — shipped and verified against the live Postgres instance and
through a real two-browser-session click-through**, not just curl: logged in as `testbuyer` and
`testseller` (a real, pre-existing completed order links them), clicked "Message the seller" on the
order detail page, confirmed a real `type: direct, orderId: null` conversation was created and
landed on `/messages?conversation=<id>`, sent a message, confirmed it in the DB, then in a second
browser session logged in as `testseller` and confirmed the conversation and message appeared on
their `/messages` inbox (correctly aligned as "theirs", contact-list preview showing the real last
message), replied, and confirmed `testbuyer`'s open tab picked up the reply via its 5s poll with no
reload. Also confirmed via curl: a non-transacted user (`testadmin`) messaging `testbuyer` gets a
real 403 (`ForbiddenException`), and calling `start` twice for the same pair returns the identical
conversation id both times (idempotent, backed by the DB's partial unique index — confirmed via
`psql` that exactly one row exists after both calls). Also confirmed the notification bell: the
recipient's unread count incremented, and clicking the "ახალი შეტყობინება" notification deep-linked
correctly to `/messages?conversation=<id>` and marked it read.

Frontend: `frontend/pages/messages/index.tsx` (a single two-pane inbox page — contacts list +
thread, not route-per-conversation, matching `messages.html`'s own single-page design; all its CSS
— `.direct-messages-shell`/`.direct-message-contacts`/`.direct-message-thread`/
`.direct-message-bubble`/etc. — was already present in `global.css` from the original design-pivot
copy, nothing new to extract), a "Message the buyer/seller" button on `orders/[id].tsx` and
"Message the buyer/coach" on `coaching-sessions/[id].tsx` (both call
`api.startDirectConversation` then route to `/messages?conversation=<id>`), and a new
"შეტყობინებები" Sidebar nav item (`sidebar-message-icon.svg`, copied from `origin/main`'s assets —
distinct from the existing `message-icon.svg` already used for Support). 10 new unit tests
(`chat.service.spec.ts`) cover the eligibility gate (self-message rejected, non-existent recipient
rejected, no-shared-order-or-session rejected, order-based and session-based eligibility both
accepted), idempotent creation regardless of who initiates second, the participant-only gate on
`listDirectMessages`/`postDirectMessage`, and `listMyDirectConversations`'s "other participant
relative to the viewer" resolution.

**Not built**: read receipts, message editing/deletion, message reporting (that's
`backend/src/reviews/`'s `ReviewReport` pattern, not mirrored here for either chat kind), and no way
to discover a transacted-but-never-contacted-yet counterpart except from an order/session detail
page's "Message" button (there's no "search for a user to message" flow, deliberately — messaging
only ever starts from a concrete order/session, matching the "transacted users only" gate).
