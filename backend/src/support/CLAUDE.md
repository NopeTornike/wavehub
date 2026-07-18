# support

## Purpose
Support ticketing — user-facing help requests, staff replies, staff-only internal notes, and
Saved Reply canned templates. Build-plan Phase 11d. SPECIFICATION.md §5.13.7 flags this as a real
gap between the contract's "Support Request, Contact Form" line item and what §5.13.6 (Support
Specialist) actually describes: priority, SLA tracking, internal notes, saved replies, escalation —
a full ticket system, not a bare contact form.

## Key files
- `ticket.entity.ts` — `Ticket`: `requesterId`, `subject`, `category` (`TicketCategory`),
  `priority` (`TicketPriority`, default Medium), `status` (`TicketStatus`, default Open),
  `orderId` (nullable — "Order-related Help"), `assignedToId` (nullable — which staff member owns
  it right now), `closedAt` (nullable, set/cleared by `SupportService#updateTicket`)
- `ticket-message.entity.ts` — `TicketMessage`: one table for both real replies and staff-only
  internal notes, distinguished by `isInternalNote`. A ticket's opening description is stored as
  its first `TicketMessage` row (see `createTicket`), not a separate `Ticket.description` column —
  keeps the thread view (`getMine`/`getForAdmin`) from needing a special case for "the first
  message."
- `saved-reply.entity.ts` — `SavedReply`: canned response templates, seven starter rows seeded by
  the migration (one per SPECIFICATION.md §5.13.6's example category list). No admin CRUD routes
  yet — see Status.
- `support.service.ts` — `SupportService`. User-facing: `createTicket`/`listMine`/`getMine`/
  `reply`. Admin-facing: `listAll`/`getForAdmin`/`staffReply`/`addInternalNote`/`updateTicket`/
  `listSavedReplies`.
- `support.controller.ts` — `SupportController` (`tickets/*`), `AuthGuard` only — a ticket's
  requester never needs an admin role, just a session.
- `admin-tickets.controller.ts` — `AdminTicketsController` (`admin/tickets/*`) and
  `AdminSavedRepliesController` (`admin/saved-replies`, its own controller — see gotcha below for
  why it isn't nested under the first one).
- `dto/create-ticket.dto.ts`, `dto/reply-ticket.dto.ts`, `dto/update-ticket.dto.ts`

## Data model
`support_tickets`, `support_ticket_messages` (`ON DELETE CASCADE` from tickets), `saved_replies`
(migration: `CreateSupportTickets`, which also seeds the seven starter Saved Replies).

## Conventions & gotchas
- **Internal notes are filtered at the query level, not just by omitting a field.**
  `SupportService#getMine`/`reply` (the requester-facing path) always query
  `TicketMessage` with `isInternalNote: false` explicitly — never fetch all messages and filter
  client-side or in the mapper. A bug that skipped the filter would leak staff-only notes straight
  to the ticket's requester.
- **`AdminSavedRepliesController` is a separate controller from `AdminTicketsController`, not a
  route nested under it.** `admin/tickets/saved-replies` would collide with `admin/tickets/:id`
  (same single-path-segment, Express-registration-order ambiguity documented in
  `backend/src/listings/CLAUDE.md`'s `pending-review` note) — rather than relying on careful route
  ordering within one controller, this gets its own top-level path (`admin/saved-replies`)
  entirely. Follow this pattern (a genuinely separate path, not a static route squeezed in before
  a `:id` route) for any future static sibling of an existing `:id` route in this repo.
- **Role gating splits "view" from "reply/internal-note" from "manage" more finely than most other
  admin modules** — read straight from SPECIFICATION.md §5.13's per-role Support sections, not
  inferred: view (`TICKET_VIEW_ROLES` in `admin-tickets.controller.ts`) = Operation Lead + Main
  Administrator + Support Specialist (+ Super Admin implicit). Reply/internal-note
  (`TICKET_REPLY_ROLES`) = Main Administrator + Support Specialist **only** — Operation Lead's own
  CAN list ("view all, redistribute, change priority, SLA control, close ticket, evaluate
  performance") never says "reply," unlike every other role with ticket access, so it's
  deliberately excluded here even though that reads a little oddly. Status/priority/assignment
  (`updateTicket`'s route) = Operation Lead + Main Administrator + Support Specialist — Operation
  Lead **is** allowed here, per its own "redistribute, change priority, close ticket." Don't
  collapse these three groups into one without re-checking the spec.
- **`updateTicket` is one route/method for status + priority + assignment**, not three — they're
  triage metadata edited together in practice, and one audit-log entry (`ticket.update`, with
  whatever changed in its `metadata`) is more useful than three near-simultaneous ones. Pass
  `assignedToId: null` explicitly to unassign; omit the field entirely to leave it untouched
  (`@IsOptional()` in class-validator treats `null` as "present but empty," not "absent" — this is
  the one place in this repo that distinction is actually load-bearing).
- **A closed ticket reopens automatically when its requester posts a new reply** —
  `SupportService#reply` flips `Closed → Open` and clears `closedAt` if the ticket was closed. This
  is the simplest reading of SPECIFICATION.md §5.13.6's "reopen ticket, if policy allows" that
  doesn't require inventing a separate explicit reopen action; revisit if a real support team wants
  reopening gated behind an actual policy check instead.
- **No file attachments** — SPECIFICATION.md §5.13.6 lists "view/attach files" for Support
  Specialist, but this module is text-only for now (same `StorageService` interface every other
  upload feature uses would be the natural fit if this gets built).
- **`TicketMessage.senderId` doubles as "who does this internal note belong to"** — there's no
  separate concept of note ownership. The spec's "cannot delete or edit another staff member's
  note" restriction (Support Specialist's CANNOT list) isn't enforced anywhere yet — there's no
  edit/delete route on `TicketMessage` at all, so it's moot until one exists.

## Related modules
- `backend/src/orders/` — an optional `orderId` link for order-related tickets, ownership-checked
  at creation (`createTicket` rejects an order that isn't the requester's).
- `backend/src/admin/` — `AdminGuard`/`@RequireAdminRole`/`AdminAuditService`, used by both admin
  controllers here.
- `backend/src/notifications/` — `TicketReplied` (new `NotificationType` value), fired both ways:
  to the requester when staff replies, to the assigned staff member when the requester replies.
- `packages/shared-types/` — `TicketCategory`/`TicketPriority`/`TicketStatus` enums,
  `PublicTicket`/`PublicTicketMessage`/`AdminTicketSummary`/`PublicSavedReply` response shapes.
- `frontend/pages/support/*.tsx` (user-facing) and `frontend/pages/admin/tickets*.tsx`
  (staff-facing) — see `frontend/CLAUDE.md`.

## Status
`createTicket`/`listMine`/`getMine`/`reply`/`listAll`/`getForAdmin`/`staffReply`/
`addInternalNote`/`updateTicket`/`listSavedReplies` are all implemented and unit-tested (ownership
guards, internal-note filtering via the reopen/status-transition behaviors, the
assign-vs-omit-vs-null distinction) — 189 backend tests total as of the last update. Not verified
against a live Postgres transaction (no DB available in the sandbox this was built in). Frontend
covers the full loop: `frontend/pages/support/index.tsx` (open a ticket + list own),
`frontend/pages/support/[id].tsx` (thread + reply), `frontend/pages/admin/tickets.tsx` (staff
queue with status/priority filters), `frontend/pages/admin/tickets/[id].tsx` (full staff view:
reply, internal note, saved-reply picker that fills the reply box, status/priority/assign
controls, "assign to me" shortcut). Not built: file attachments, admin CRUD for Saved Replies
(the seven seeded rows are the only ones that exist — adding more needs a direct DB insert today),
SLA breach alerting (only raw timestamps exist, no "average response time" stat or overdue
flagging), escalation as a distinct action (the closest equivalent is setting `status: escalated`
via `updateTicket`, not a dedicated route with its own semantics), and note-ownership enforcement
(see the gotcha above — moot until notes are editable/deletable at all).
