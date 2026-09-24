# tournaments

## Current model (2026-09-24 — supersedes the "first version" description below)
Built for docs/design-mockups 01–03, 07, 08, 10, 11, 13. Staff post a tournament, **teams** register,
staff **verify teams** and **record matches** (scores + per-player stats). Still no automated
matchmaking/bracket generation or prize payout — everything shown is what staff or captains entered.
- **Teams** (`tournament-team.entity.ts`, `tournament_teams`): every registration is a team.
  `tournaments.teamSize` (1 = solo). Solo: `POST tournaments/:id/register` creates a verified
  one-player team named after the user. Squad: `POST tournaments/:id/teams` (`RegisterTeamDto`:
  name, tag, coachName, `members` = exactly `teamSize` in-game names, no duplicates) — the caller
  is the captain, the team starts `pending`. Team names are unique per tournament
  (case-insensitive index); one team per captain per tournament. The captain's
  `tournament_registrations` row carries `teamId` (ON DELETE CASCADE), so "my tournaments" stays one
  query. `POST tournaments/:id/teams/mine/logo` (byte-sniffed image, 2MB), `POST
  tournaments/:id/withdraw` (only while `open`/`upcoming`). Capacity = `maxPlayers` players
  (= `floor(maxPlayers/teamSize)` teams); rejected teams don't count.
- **Registration runs in a transaction with `SELECT … FOR UPDATE` on the tournament row** — the old
  count-then-insert could overfill a tournament under concurrent requests (e2e
  `tournaments.e2e-spec.ts` fires 5 parallel registrations at a 2-player tournament).
- **Matches** (`tournament-match.entity.ts`, `tournament_matches`): stage
  (group/round/quarterfinal/semifinal/final), groupName, roundLabel, teamA/teamB (must belong to the
  tournament, not the same team; ON DELETE SET NULL → shows "TBD"), map, bestOf, scheduledAt,
  status (scheduled/live/completed), scoreA/B, `stats` jsonb `{a,b: {coach, players:[{name, kills,
  kd, damage, rating, assists, mvp}]}}` (bounded nested DTOs, missing stats stored as null).
- **Prize breakdown**: `tournaments.prizes` jsonb (`TournamentPrizes`: places with amount + rewards,
  specialRewards, note) via nested `PrizesDto`.
- **Rules**: still text, one rule per line, rendered as "Title: description".
- **Status** gained `in_progress`. `teamSize` can't change once teams exist (409).
- Public: `GET tournaments/:id/teams` (pending + verified; captain *username* only),
  `GET tournaments/:id/matches`, `GET tournaments/:id/matches/:matchId`. Own:
  `GET me/tournaments` (`MyTournamentEntry[]`), `GET me/tournament-matches` (matches of the caller's
  teams — captain only; squad members are in-game names, not linked accounts). Admin (same
  `TOURNAMENT_MANAGEMENT_ROLES`, all audit-logged): `GET admin/tournaments/:id/teams`,
  `POST admin/tournaments/:id/teams/:teamId/status`, `POST/POST/DELETE admin/tournaments/:id/matches[/:matchId]`.
- Migration `1784354000000-TournamentTeamsAndMatches` (moves existing registrations into verified
  one-player teams).
- Frontend: `/tournaments`, `/tournaments/mine`, `/tournaments/hub`, `/tournaments/[id]`,
  `/tournaments/[id]/matches`, `/tournaments/[id]/matches/[matchId]`, admin
  `components/admin/TournamentOps.tsx` — see `frontend/CLAUDE.md`.
- Tests: `tournaments.service.spec.ts` (17 unit), `test/tournaments.e2e-spec.ts` (roster/capacity/
  verification/privacy, matches, team-size lock, concurrency).

## Purpose
Admin-posted tournaments that users browse and self-register into. LAUNCH_PLAN.md §2b's confirmed
"right first version": no bracket/matchmaking engine, no automated prize payout — an admin creates
a tournament (game, name, description, prize as free text, start date, player cap, cover image),
users register with one click, and that's the whole lifecycle for this first version. Prize
distribution and match results are handled manually/off-platform, same as the static prototype
this was ported from.

Entirely new scope — `SPECIFICATION.md` has zero mentions of tournaments, so there was no existing
product decision to reconcile; `TOURNAMENT_MANAGEMENT_ROLES` reuses `backend/src/coaching/
CLAUDE.md`'s `COACH_MANAGEMENT_ROLES` trio (`OperationLead`, `MainAdministrator`,
`MarketplaceCoachingOpsManager`) as the closest existing precedent rather than inventing a new
role grouping for one small feature.

## Key files
- `tournament.entity.ts` — `Tournament`: `gameId` (FK to the existing `Game` taxonomy, required —
  unlike `Coach.gameId` this is not nullable, every tournament is for exactly one game), `name`
  (varchar 70), `description` (text), `prize` (varchar 60, deliberately free text — "5,000 WC",
  "1000 GEL", "Steam Wallet Code" all need to fit, not a WaveCoin amount column), `status`
  (`TournamentStatus`: `Open`/`Upcoming`/`Completed`, default `Upcoming`), `startDate` (date),
  `maxPlayers` (integer, default 64), `coverImageUrl` (nullable varchar, same `StorageService`
  pattern as `ListingImage`/`Coach` photos).
- `tournament-registration.entity.ts` — `TournamentRegistration`: `tournamentId`/`userId` FKs,
  both `onDelete: 'CASCADE'` (deleting a tournament or a user cleans up registrations
  automatically — verified in a real browser check: deleting a tournament with a live registration
  removed the registration row too, no orphan left behind), `@Unique(['tournamentId', 'userId'])`
  is the actual duplicate-registration guard, `registeredAt`.
- `tournaments.service.ts` — `TournamentsService`. Public: `browse` (game/status filter +
  pagination), `getOrThrow`, `register`, `listMyRegisteredIds`. Admin: `create`/`update`/
  `setCoverImage`/`remove`. **`toPublic()` deliberately does not include an "am I registered"
  field on the shared public shape** — see the gotcha below.
- `tournaments.controller.ts` — `TournamentsController`. `GET tournaments/mine` **must stay
  registered before** `GET tournaments/:id` — same Express route-ordering gotcha documented
  throughout this codebase (`backend/src/coaching/CLAUDE.md`, `backend/src/listings/CLAUDE.md`).
  Admin routes (`POST admin/tournaments`, `POST admin/tournaments/:id`, `POST
  admin/tournaments/:id/cover`, `DELETE admin/tournaments/:id`) are gated by `AdminGuard` +
  `@RequireAdminRole(...TOURNAMENT_MANAGEMENT_ROLES)` and audit-logged on every mutation, matching
  the non-negotiable rule in root `CLAUDE.md`.

## Data model
`tournaments` + `tournament_registrations` (migration: `CreateTournaments`). No seed data in the
migration — a fabricated tournament would violate root `CLAUDE.md` rule #6 ("never show fabricated
data as if real"); the one tournament visible in dev (`WaveHub PUBG Mobile Cup`) was created
through the real admin UI during verification, not seeded.

## Conventions & gotchas
- **No "am I registered" field on `PublicTournamentSummary`.** This was actually written once (a
  hardcoded `isRegistered: false`) and then removed — `AuthGuard` (`backend/src/auth/
  auth.guard.ts`) has no optional-auth mode anywhere in this codebase, so a public, cacheable
  `GET /tournaments` endpoint has no way to know who's asking. The real per-viewer state comes from
  a second, authenticated call: `GET /tournaments/mine` returns just the caller's own registered
  tournament ids, and the frontend cross-references the two client-side
  (`frontend/pages/tournaments/[id].tsx`). Don't re-add a personalized field to the public shape —
  add a new `/mine`-style endpoint instead, same pattern as `backend/src/coaching-sessions/
  CLAUDE.md`'s `mine-as-buyer`/`mine-as-coach`.
- **`register()` enforces three things, in order**: `status === Open`, `registeredCount <
  maxPlayers`, then attempts the insert and catches a Postgres `23505` unique-violation (the
  `@Unique(['tournamentId','userId'])` constraint) to turn a race-condition duplicate into a clean
  `ForbiddenException('You are already registered for this tournament')` instead of a raw 500 —
  same pattern as `ReviewsService`'s duplicate-review guard.
- **Entry is always free.** There's no WaveCoin charge on `register()` — the frontend's detail page
  hardcodes "ENTRY FEE: FREE" rather than reading it from anywhere, matching this version's scope
  (no prize-payout money movement either, see Purpose above). If paid tournament entry ever becomes
  a real requirement, it needs a `WalletService` debit call here, an entry-fee column, and a
  refund-on-tournament-cancellation path — none of which exist yet.
- `prize` is plain free text, not a WaveCoin amount — don't try to parse or sum it, and don't
  connect it to `WalletService` (see above).

## Related modules
- `backend/src/admin/` — `AdminGuard`/`@RequireAdminRole`/audit logging that every admin mutation
  here goes through.
- `backend/src/storage/` — backs `setCoverImage()`, identical shape to `ListingsService.addImage()`.
- `backend/src/coaching/` — the closest existing precedent for the admin-role grouping and the
  public-vs-`/mine` split; read that module's doc first if either pattern is unclear here.
- `packages/shared-types/` — `TournamentStatus`, `PublicTournamentSummary`/`PublicTournamentDetail`
  (currently identical shapes; kept as two names in case the detail view needs to grow fields the
  list view shouldn't carry).
- `frontend/pages/tournaments/{index,[id]}.tsx`, `frontend/pages/admin/tournaments.tsx` — see
  `frontend/CLAUDE.md` for what's built and how it's wired.

## Status
**Done (2026-09-16)** — backend and frontend both real, not mocked. Migrated and verified against
a live Postgres instance and through a real browser click-through (not just curl): logged in as
`testadmin`, created a tournament through the real admin UI (game/name/description/prize/status/
date/maxPlayers), uploaded a real cover image (`POST admin/tournaments/:id/cover`, confirmed via a
direct DB check that `coverImageUrl` pointed at the uploaded file), browsed the public
`/tournaments` list and confirmed the card grid + status-tab filter render correctly, opened the
detail page and clicked through all four tabs (General/Prize Pool/Rules/Top Players — the latter
two are static content, same as the static-prototype reference, not per-tournament data the
backend has), registered as a buyer and confirmed the "REGISTERED ✓" state updates immediately
with no reload, confirmed the registration row in a direct `psql` query, edited the tournament
through the admin UI and confirmed the change rendered, deleted a test tournament via the API and
confirmed via `psql` that its registration row was cascade-deleted too. 9 unit tests
(`tournaments.service.spec.ts`) cover `register()`'s three-step validation (status/capacity/
duplicate) and the admin CRUD methods.

**Found and fixed a real, pre-existing bug during this verification pass** (not scoped to
tournaments — it silently affected every uploaded image in the whole app): `helmet()`'s default
`Cross-Origin-Resource-Policy: same-origin` header on every response, including everything under
`/uploads`, was making the browser silently drop any `<img>`/`background-image` load of an
uploaded file from the frontend's origin (`ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` — not a CORS
error, so `read_network_requests` was the only way this surfaced; nothing about it showed up in
`read_console_messages`). Fixed in `backend/src/main.ts` by passing `crossOriginResourcePolicy: {
policy: 'cross-origin' }` into `helmet()` — safe because this app's frontend and backend are
deliberately cross-origin already (see `CORS_ORIGIN` right below that line). This likely means
every previously-"verified" image-upload feature in this app (listing photos, coach profile
photos) has silently never rendered in a real browser until now — worth a quick re-check next time
any of those pages are touched, since their own `CLAUDE.md` Status sections don't mention this.

## 2026-09 details + rules (supersedes "no per-tournament rules field")
Migration `1784353000000-TournamentDetails`: `details` jsonb (default `{}`) and `rules` text.
`details` is validated with listings' `@IsItemAttributes` (same bounds) and its known keys/labels
are `TOURNAMENT_DETAIL_KEYS` in shared-types (format, mode, region, platform, checkInTime,
startTime, registrationDeadline, entryFee, teamSize, minimumRank, bracketType, matches, whoCanJoin,
communication, organizer — the prototype's pre-join facts). `rules` ≤5000 chars, one rule per line.
Admin create/edit (`/admin/tournaments`) has a collapsible details form + rules textarea; the public
detail page (`tournaments/[id].tsx`, the prototype's pre-join layout) shows "To be announced" for any
unset fact, Entry Fee defaults to free, and the Rules tab lists the real rules (or the prototype's
"not published yet" line). Its Prize tab shows the real prize only and the Teams tab the real
registration count — the prototype's invented prize split and demo teams are not ported (rule #6).
Note: sending `{"details": {"__proto__": ...}}` is stripped by class-transformer and so saves `{}` —
harmless (no pollution), just clears the details.
