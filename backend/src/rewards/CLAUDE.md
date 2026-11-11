# backend/src/rewards — User Hub rewards

Owner request 2026-11-10 (`docs/design-mockups/round-6/02`): daily tasks staff write, each with XP;
a 7-day streak; a weekly top-10; the weekly top 3 get staff-defined prizes through a prize box the
winner opens on `/hub`.

## Rules
- **Days are Tbilisi time** (UTC+4, no DST — `tbilisiDay`, `dayStartUtc`); **weeks run Monday–Sunday**
  (`weekStartOf`). All helpers are pure and exported (unit-tested in the e2e spec).
- **Tasks** (`reward_tasks`): title, optional description, `trigger`, `target`, `xp`, `period`
  (`daily` = repeats each day, `once` = an achievement over all time), `isActive`, `sortOrder`.
  Staff choose *what* counts, never *who* did it. Triggers and the rows they count
  (`RewardsService.counts`, one SQL per window):
  - `login` / `visit_marketplace` / `visit_tournaments` / `visit_coaching` — `reward_visits`, written by
    `POST rewards/checkin` (the shell, once a day per browser — `lib/rewards.ts`) and
    `POST rewards/visit {page}` (those three pages). Opening `/hub` counts as the check-in too.
    These are the only self-reported ones; each pays at most once a day.
  - `purchase` — orders as buyer, not pending/cancelled/refunded/expired; `topup` — positive `topup`
    ledger rows; `follow` / `follow_coach` — `user_follows` (coach = verified coach);
    `review` — reviews written; `book_session` — coaching sessions booked, not cancelled;
    `tournament_join` — teams the user captains or is a member of (team `createdAt`);
    `list_item` — listings created.
- **Crediting**: `GET rewards/hub` checks today's and yesterday's daily tasks and all achievements,
  and inserts `reward_xp` rows with a per-user unique `key` (`task:<id>:<day>`, `task:<id>:once`,
  `streak:<day>`) using `ON CONFLICT DO NOTHING` — a task pays once however many requests race. XP is
  credited only when the hub is opened (yesterday is re-checked, so a 23:59 task isn't lost); the
  ledger `createdAt` decides which week the XP counts for, so a finalized week never changes.
- **Levels**: level L starts at `50·L·(L−1)` XP (`levelFor`). The profile card's name is the user's
  real Wave rank.
- **Streak**: consecutive days with a `login` visit ending today (or yesterday). Every 7th day pays
  `platform_settings.rewardStreakBonusXp` (default 200) once and sends a `reward_streak`
  notification. The 7 boxes show the position in the current 7-day cycle.
- **Weekly leaderboard**: XP earned in the week, active **non-staff** accounts only, top 10, ties
  broken by who got there first; cached 30s per week. `me.place` is the caller's rank (null for staff).
- **Prizes**: `reward_prizes` (place 1–3: title, description, image — uploads keep transparency).
  An hourly cron (`7 * * * *`) settles last week: the top 3 with a configured prize get a
  `reward_wins` row (prize snapshotted) — unique `(weekStart, place)` makes it safe on several
  instances and repeat runs — plus a `reward_weekly_prize` notification and a staff-bell entry.
  `POST admin/rewards/finalize {weekStart}` runs it by hand (must be a finished Monday).
  The winner opens the box (`POST rewards/wins/:id/open`, winner only, 404 otherwise); staff hand
  the prize over themselves and mark it delivered. **No money moves automatically** — a prize is a
  description; if it's balance, staff add it through the normal audited wallet tools.
- **Switch**: `platform_settings.features.rewardsHub` (Admin → Rewards). Off → the hub returns
  `{ enabled: false }`, check-ins / visits are ignored, the cron does nothing, the sidebar link hides.

## API
- Player (session): `GET rewards/hub`, `POST rewards/checkin`, `POST rewards/visit`,
  `POST rewards/wins/:id/open`.
- Staff (Super Admin, Operation Lead, Main Administrator; every mutation audit-logged as
  `rewards.*`): `GET admin/rewards`, `POST admin/rewards/tasks`, `POST admin/rewards/tasks/:id`,
  `DELETE admin/rewards/tasks/:id` (earned XP stays — the ledger's `taskId` becomes NULL),
  `POST admin/rewards/prizes/:place` (empty title removes it), `POST admin/rewards/prizes/:place/image`,
  `POST admin/rewards/settings {streakBonusXp?, enabled?}`, `POST admin/rewards/wins/:id/delivered`,
  `POST admin/rewards/finalize`.

## Schema
Migration `1784396000000-RewardsHub`: `reward_tasks`, `reward_visits` (PK userId+day+page),
`reward_xp` (unique userId+key, index on createdAt), `reward_prizes`, `reward_wins` (unique
weekStart+place), `platform_settings.rewardStreakBonusXp`. Seeds the mockup's starter tasks (all
real checks; staff can edit or switch them off). Raw SQL throughout — no TypeORM entities.

## Tests
`backend/test/owner-2026-11-12-rewards.e2e-spec.ts`: helpers, once-per-day crediting, staff kept off
the board, the 7-day bonus once, task CRUD + validation, finalization exactly once, winner-only
opening, delivered flag, switch off, audit rows.

## Frontend
`/hub` (`pages/hub.tsx`, `uh-` CSS), `components/rewards/RewardChest.tsx` (the drawn chest; `open`
animates the lid), Admin → `pages/admin/rewards.tsx` (`rw-` CSS), `lib/rewards.ts`,
`lib/features.ts`. See `frontend/CLAUDE.md`.
