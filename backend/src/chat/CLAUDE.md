# chat

## Purpose
Order-scoped chat (build-plan Phase 6's "narrow scope first" — no Direct/non-order chat yet).
Auto-created when an order is purchased; carries both real messages between buyer and seller and
system messages posted at order-lifecycle events (started, delivered, revision requested,
cancelled, completed).

## Key files
- `conversation.entity.ts` — `Conversation`: one row per order (`orderId` is `unique`), always
  `type: 'order'` for now
- `message.entity.ts` — `Message`: `senderId` is `null` exactly for `type: System` rows; every
  other message has a real sender
- `chat.service.ts` — `ensureConversation` (idempotent, called by `OrdersService.purchase`),
  `listMessages`/`postMessage` (real user messages), `postSystemMessage` (lifecycle events,
  no-ops if the conversation somehow doesn't exist rather than throwing)
- `dto/send-message.dto.ts` — `SendMessageDto` (`body`, 1–2000 chars)
- No `chat.controller.ts` — see the gotcha below

## Data model
`conversations`, `messages` (migration: `CreateChatSchema`). `messages.conversationId` cascades on
delete; `conversations.orderId` has a `FOREIGN KEY` to `orders` but no `ON DELETE` action (orders
are never hard-deleted).

## Conventions & gotchas
- **There is deliberately no `ChatController`.** Chat routes live on `OrdersController`
  (`GET`/`POST /orders/:id/messages`) so they reuse the participant-ownership check that already
  exists there (`order.buyerId !== userId && order.sellerId !== userId` → 403) instead of
  duplicating it in a module that would otherwise need to depend on `orders` just to re-derive who's
  allowed to read a conversation. `OrdersService.listMessages`/`sendMessage` are the thin wrappers
  that do the check and then delegate to `ChatService`.
- **`ChatModule` has no dependency on `orders` at all** — every method takes `orderId` (and
  `buyerId`/`sellerId` for `ensureConversation`) as plain string params supplied by the caller,
  rather than looking up an `Order` itself. This is what keeps `OrdersModule → ChatModule` a
  one-directional import with no risk of a circular dependency.
- **Every call site in `OrdersService` treats chat as best-effort.** A chat failure must never roll
  back or block a real order state change (that's money-adjacent state, chat isn't). `purchase()`
  calls `ensureConversation`/`postSystemMessage` *after* its own transaction commits, in a
  try/catch that only logs; every other lifecycle method (`startOrder`, `deliverOrder`,
  `addDeliveryFile`, `requestRevision`, `completeOrder`, `cancelOrder`) goes through
  `OrdersService`'s private `postSystemMessage(orderId, body)` helper, which wraps the same
  try/catch/log pattern. Don't call `ChatService` directly from a new lifecycle method without
  going through that helper.
- **System message copy is in Georgian**, matching the rest of the product's user-facing text (see
  `frontend/CLAUDE.md`) even though nothing renders these yet (see Status).
- **`Message.status` (`Sent`/`Delivered`/`Seen`) is defined but nothing ever sets it past the
  default `Sent`** — read receipts are out of scope for this narrow-first pass, per the build plan.

## Related modules
- `backend/src/orders/` — the only caller. Every lifecycle transition that should produce a system
  message is listed in the gotcha above; if you add a new order status transition, decide whether
  it needs one too.
- `packages/shared-types/` — `ConversationType`/`MessageType`/`MessageStatus` enums, `PublicMessage`
  response shape.

## Status
Backend-only. `ensureConversation` + one system message per lifecycle transition are wired into
every `OrdersService` mutation; real buyer/seller messaging (`GET`/`POST /orders/:id/messages`)
works but has no frontend yet — no chat UI in `frontend/pages/orders/[id].tsx` (build-plan Phase 6
said "start with polling, not WebSockets" — that's still true whenever the frontend piece happens).
Not verified against a live Postgres transaction (no DB available in the sandbox this was built
in). No Direct (non-order) conversations, no read receipts, no message editing/deletion, no
message reporting (that's `backend/src/reviews/`'s `ReviewReport` pattern, not yet mirrored here).
