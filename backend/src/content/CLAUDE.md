# content

## Purpose
Static/legal page CMS — scoped to the 10 pages `frontend/components/Footer.tsx` links to (About,
Contact, Terms of Service, Privacy Policy, Refund Policy, Delivery Policy, Dispute Resolution,
Community Guidelines, Coach Standards, Seller Standards — the last 5 added 2026-09-16, see Status).
Not the broader "Content Management" catalog from SPECIFICATION.md §5.13 (banners, news,
categories, badges, tags, promo codes) — that's real future scope (build-plan Phase 11f), not
modeled here. Built as the first concrete piece of task #79 ("build the CMS pages the static site
never had").

## Key files
- `content-page.entity.ts` — `ContentPage`: `slug` (unique, natural key), `title`, `body` (plain
  text/markdown, no rich-text editor or HTML sanitization pipeline), `status`
  (`ContentPageStatus.Draft`/`.Published`, from `@wavehub/shared-types`).
- `content.service.ts` — `getPublishedBySlug()` (public, 404s on draft or missing — a draft is
  invisible to non-admins, same as a paused listing), `listAll()`/`getBySlugAdmin()` (admin,
  includes drafts), `upsert()` (one method handles both create and edit-in-place, keyed by slug —
  an admin editing a page already knows its slug from the URL they're on, so there's no separate
  id-based update path to keep in sync).
- `content.controller.ts` — `GET content/:slug`, public, unauthenticated, published-only.
- `admin-content.controller.ts` — `GET admin/content`, `GET admin/content/:slug`,
  `POST admin/content` (upsert), all gated to `CONTENT_MANAGEMENT_ROLES` (see gotcha below),
  audit-logged on upsert.
- `dto/upsert-content-page.dto.ts` — `slug` (lowercase/digits/hyphens only), `title`, optional
  `body`/`status`.

## Data model
`content_pages` (migration: `CreateContentPages`) — originally seeded with 5 pages, all
`published`, generic starter copy explicitly telling the admin to replace it (not filler meant to
look like real legal text). `SyncRealContentPageCopy` (2026-09-16) replaced that placeholder copy
with real content and added 5 more pages — see Status.

## Conventions & gotchas
- **Role gate**: `CONTENT_MANAGEMENT_ROLES = [AdminRole.MainAdministrator]` (Super Admin passes
  implicitly, same as every other admin-guarded route). SPECIFICATION.md §5.13's "Content
  Management" CAN line appears on Super Admin's full catalog and explicitly on Main Administrator
  ("edit banners, edit FAQ, add news, edit categories, edit game info") — no other role's list
  includes it. Static/legal pages are treated as falling under that same capability rather than
  inventing a new permission just for them.
- **`upsert()` is a single route for both create and edit** — deliberate, not a shortcut: an admin
  editing an existing page already has its slug (it's in the URL), so a separate
  id-based-update-vs-create split would just be two paths to keep in sync for no real benefit at
  this scale (5–10 pages, not hundreds).
- Slug is validated to `[a-z0-9-]+` — this is also the exact string used in the public route
  (`/content/:slug`) and the frontend's `/pages/[slug]` route, so an admin can't accidentally create
  a slug that breaks routing.

## Related modules
- `backend/src/admin/` — `AdminGuard`/`@RequireAdminRole`/`AdminAuditService`, used by
  `admin-content.controller.ts`.
- `frontend/pages/pages/[slug].tsx` — the public page renderer, calls `GET content/:slug`.
- `frontend/pages/admin/content.tsx` — the admin list+edit UI, Main-Administrator/Super-Admin gated
  server-side (same "don't hide the nav link per role" convention as every other admin page — a
  role without access gets a 403 error banner instead).
- `frontend/components/Footer.tsx` — links to `/pages/about`, `/pages/terms-of-service`, etc.
  (Contact links to `/support` instead — see that file's own comment for why).
- `packages/shared-types/` — `ContentPageStatus`, `PublicContentPage`, `AdminContentPage`.

## Status
Fully built and verified against a real, running Postgres instance (not just unit-tested): the
`CreateContentPages` migration ran cleanly and seeded 5 pages, the backend booted with all routes
mapped, `GET /content/about` returned real seeded data and `GET /content/does-not-exist` correctly
404'd, and the full admin flow (login as a real Super Admin account, load `/admin/content`, see
all pages, click one, see its real title/body populate the edit form) was click-tested in an
actual browser. 199 backend tests still pass unmodified — this module has no unit tests of its own
yet (small, mostly-CRUD service; the real-Postgres + browser verification above was judged
sufficient for this first pass, same bar as the admin panel's other list/upsert endpoints).

**Real copy synced (2026-09-16)** — see `SyncRealContentPageCopy` migration and `LAUNCH_PLAN.md`
§2a. The 5 pages seeded by `CreateContentPages` had placeholder bodies ("Replace this placeholder
with your actual terms...") until this migration replaced them with the real, properly written
Georgian copy that exists on `origin/main`'s static prototype (`about.html`/`terms-of-service.html`/
`privacy-policy.html`/`refund-cancellation.html`/`contact-information.html`). The migration also
added 5 new pages that only existed on `main` before: `delivery-policy`, `dispute-resolution`,
`community-guidelines`, `coach-standards`, `seller-standards`. All 10 are wired into
`Footer.tsx` now (previously only the original 5 were). Extracted from the source HTML by
stripping tags down to plain text (one heading/paragraph/list item per line) — not a rich-text or
markdown conversion, so an admin editing this content through `/admin/content`'s plain `<textarea>`
should keep following that same one-line-per-block convention rather than pasting HTML.

Not built: rich-text editing, HTML sanitization, page history/versioning, or any of the broader
banners/news/categories/promo-code "Content Management" scope from SPECIFICATION.md §5.13 (Phase
11f, still ahead).
