# Design mockups — the target design (received 2026-09-24)

The 18 images in this folder are the owner's target design ("final result must be that"). They
supersede the static prototype on `main` wherever the two differ. Every number, name and photo in
them is **sample content**: WaveHub renders the same layout with real data — entered by users or
admins, or computed from real rows — never with invented values (root `CLAUDE.md` rule #6). Where a
mockup element has no real data source yet, the plan below builds one.

| # | Mockup | Route | Data source / what had to be built |
|---|---|---|---|
| 01 | Tournament detail — Prize Pool tab | `/tournaments/[id]` | admin-entered prize breakdown (places, amounts, rewards, special rewards) |
| 03 | Tournament detail — General tab | `/tournaments/[id]` | `details` facts, slogan, sub-lines (deadline, time) |
| 11 | Tournament detail — Teams tab | `/tournaments/[id]` | team registration (captain, tag, logo, members, coach) + admin verification |
| 13 | Tournament detail — Rules tab | `/tournaments/[id]` | rules as "Title: description" lines |
| 02 | My Tournaments | `/tournaments`, `/tournaments/mine` | tournaments + the user's registrations; in-progress status |
| 08 | Tournament match history | `/tournaments/[id]/matches` | admin-entered matches (stage, teams, map, best-of, time, score) |
| 07 | Match details | `/tournaments/[id]/matches/[matchId]` | admin-entered per-player stats; top performers computed |
| 10 | Tournament hub | `/tournaments/hub` | the user's registrations, next match, wins/win rate, bracket from matches |
| 04 | Steam games list | `/steam-keys` | digital-key listings; genre/tagline attributes, search, sort, pagination |
| 05 | Steam game detail | `/listings/[id]` (digital key) | gallery, compare-at price, sold count, related listings |
| 06 | Coaching list (mobile) | `/coaching` | coach photo, tier badge, rank, rating, response time, tags |
| 14 | Coach profile | `/coaching/[id]` | coach-entered video/quote/style/games; students/sessions/success computed |
| 12 | Public profile | `/u/[username]` | follows, Wave score/rank, game profile, badges (computed), review distribution |
| 09 | User dashboard | `/dashboard` | next session countdown, coaching progress, orders, tournaments, wallet, rank |
| 15, 17 | Home — Coaching & Tournaments | `/` | top-rated coaches, featured tournament |
| 16, 18 | Home — hero, services, marketplace | `/` | game counts, featured listings |

Build order: tournaments (01, 02, 03, 07, 08, 10, 11, 13) → Steam (04, 05) → coaching (06, 14) →
home (15–18) → profile (12) → dashboard (09). Progress is tracked in `frontend/CLAUDE.md`.
