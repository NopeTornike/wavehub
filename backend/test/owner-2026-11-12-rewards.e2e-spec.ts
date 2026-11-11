import { addDays, levelFor, RewardsService, streakFrom, tbilisiDay, weekStartOf } from '../src/rewards/rewards.service';
import { assertConserved, buyItem } from './flows';
import { createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Owner 2026-11-10 (docs/design-mockups/round-6/02): User Hub — staff tasks checked from real
// activity, once per day / once ever, 7-day streak bonus, weekly top 10, top-3 prize boxes.
describe('rewards hub (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  const today = tbilisiDay(Date.now());

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'rwadmin');
    await makeAdmin(ctx, admin);
  });
  afterAll(async () => {
    await admin.client.post('/admin/rewards/settings', { enabled: true });
    await assertConserved(ctx);
    await ctx.close();
  });

  it('calendar helpers', () => {
    expect(weekStartOf('2026-11-12')).toBe('2026-11-09'); // Thursday → Monday
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09');
    expect(levelFor(0)).toMatchObject({ level: 1, nextLevelAt: 100 });
    expect(levelFor(350)).toMatchObject({ level: 3, levelFloor: 300, nextLevelAt: 600 });
    expect(streakFrom(['2026-11-12', '2026-11-11', '2026-11-09'], '2026-11-12')).toEqual({ days: 2, todayDone: true });
    expect(streakFrom(['2026-11-11', '2026-11-10'], '2026-11-12')).toEqual({ days: 2, todayDone: false });
  });

  it('credits real activity once, keeps staff off the board, pays the 7-day bonus once', async () => {
    const player = await registerUser(ctx, 'rwplayer');
    const seller = await registerUser(ctx, 'rwseller');
    const first = (await player.client.get('/rewards/hub')).body;
    expect(first.enabled).toBe(true);
    const login = first.daily.find((t: { trigger: string }) => t.trigger === 'login');
    expect(login).toMatchObject({ done: true, xp: 50 });
    expect(first.justEarned).toEqual(expect.arrayContaining([{ title: login.title, xp: 50 }]));
    const market = first.daily.find((t: { trigger: string }) => t.trigger === 'visit_marketplace');
    expect(market.done).toBe(false);

    // A page visit + a real purchase; an unknown page is refused.
    expect((await player.client.post('/rewards/visit', { page: 'marketplace' })).status).toBe(200);
    expect((await player.client.post('/rewards/visit', { page: 'wallet' })).status).toBe(400);
    await credit(ctx, player, 100);
    await buyItem(ctx, seller, player, admin, 20, 'paid');

    const second = (await player.client.get('/rewards/hub')).body;
    expect(second.daily.find((t: { trigger: string }) => t.trigger === 'visit_marketplace').done).toBe(true);
    const firstPurchase = second.achievements.find((t: { title: string }) => t.title === 'First Purchase');
    expect(firstPurchase.done).toBe(true);
    expect(second.justEarned.map((e: { title: string }) => e.title).sort()).toEqual(['First Purchase', market.title].sort());
    // Asking again credits nothing new.
    const third = (await player.client.get('/rewards/hub')).body;
    expect(third.justEarned).toEqual([]);
    expect(third.xp.total).toBe(50 + 75 + 500);
    const [{ n }] = await ctx.dataSource.query(`SELECT count(*)::int AS n FROM reward_xp WHERE "userId" = $1`, [player.id]);
    expect(n).toBe(3);

    // Leaderboard: the player is on it; staff never are.
    await admin.client.get('/rewards/hub');
    (ctx.app.get(RewardsService) as unknown as { boardCache: Map<string, unknown> }).boardCache.clear();
    const board = (await player.client.get('/rewards/hub')).body;
    expect(board.leaderboard.some((r: { username: string }) => r.username === player.username)).toBe(true);
    expect(board.leaderboard.some((r: { username: string }) => r.username === admin.username)).toBe(false);
    expect(board.me.place).toBeGreaterThan(0);
    expect(Object.keys(board.leaderboard[0]).sort()).toEqual(['avatarUrl', 'firstName', 'lastName', 'place', 'username', 'verified', 'xp']);

    // Six earlier check-in days + today = a 7-day streak → bonus once.
    for (let i = 1; i <= 6; i += 1) {
      await ctx.dataSource.query(`INSERT INTO reward_visits ("userId", day, page) VALUES ($1, $2, 'login') ON CONFLICT DO NOTHING`, [player.id, addDays(today, -i)]);
    }
    const streak = (await player.client.get('/rewards/hub')).body;
    expect(streak.streak).toMatchObject({ days: 7, todayDone: true, position: 7, bonusXp: 200 });
    expect(streak.justEarned).toEqual([{ title: '7-Day Streak Reward', xp: 200 }]);
    expect((await player.client.get('/rewards/hub')).body.justEarned).toEqual([]);
    const notes = await ctx.dataSource.query(`SELECT 1 FROM notifications WHERE "userId" = $1 AND type = 'reward_streak'`, [player.id]);
    expect(notes).toHaveLength(1);
  });

  it('staff manage tasks and prizes; a finished week pays its top 3 exactly once', async () => {
    const outsider = await registerUser(ctx, 'rwout');
    expect((await outsider.client.get('/admin/rewards')).status).toBe(403);

    const created = await admin.client.post('/admin/rewards/tasks', { title: 'Top up your wallet', trigger: 'topup', target: 1, xp: 120, period: 'daily' });
    expect(created.status).toBe(201);
    expect((await admin.client.post('/admin/rewards/tasks', { title: 'Bad', trigger: 'hack', target: 1, xp: 1, period: 'daily' })).status).toBe(400);
    const topper = await registerUser(ctx, 'rwtop');
    await credit(ctx, topper, 30);
    const hub = (await topper.client.get('/rewards/hub')).body;
    expect(hub.daily.find((t: { id: string }) => t.id === created.body.id)).toMatchObject({ done: true, xp: 120 });
    expect((await admin.client.request('DELETE', `/admin/rewards/tasks/${created.body.id}`)).status).toBe(200);
    // The XP stays after the task is deleted.
    const [{ xp }] = await ctx.dataSource.query(`SELECT COALESCE(sum(xp), 0)::int AS xp FROM reward_xp WHERE "userId" = $1 AND title = 'Top up your wallet'`, [topper.id]);
    expect(xp).toBe(120);

    for (const place of [1, 2, 3]) {
      expect((await admin.client.post(`/admin/rewards/prizes/${place}`, { title: `Prize ${place}`, description: `${place} place` })).status).toBe(200);
    }
    // Last week's XP for three players (backdated), plus a staff member with more who must not win.
    const lastWeek = addDays(weekStartOf(today), -7);
    const [a, b, c] = await Promise.all(['rwwa', 'rwwb', 'rwwc'].map((p) => registerUser(ctx, p)));
    const at = `${addDays(lastWeek, 2)}T10:00:00Z`;
    for (const [u, amount] of [[a, 900], [b, 700], [c, 500], [admin, 5000]] as const) {
      await ctx.dataSource.query(`INSERT INTO reward_xp ("userId", key, title, xp, "createdAt") VALUES ($1, $2, 'seed', $3, $4)`, [u.id, `seed:${lastWeek}`, amount, at]);
    }
    expect((await admin.client.post('/admin/rewards/finalize', { weekStart: today === weekStartOf(today) ? addDays(today, 1) : today })).status).toBe(400);
    const fin = await admin.client.post('/admin/rewards/finalize', { weekStart: lastWeek });
    expect(fin.body).toEqual({ created: 3 });
    expect((await admin.client.post('/admin/rewards/finalize', { weekStart: lastWeek })).body).toEqual({ created: 0 });
    expect(await ctx.app.get(RewardsService).finalizeLastWeek()).toBe(0);

    const winA = (await a.client.get('/rewards/hub')).body.wins[0];
    expect(winA).toMatchObject({ place: 1, xp: 900, openedAt: null, prize: { title: 'Prize 1' } });
    expect((await b.client.post(`/rewards/wins/${winA.id}/open`)).status).toBe(404);
    const opened = await a.client.post(`/rewards/wins/${winA.id}/open`);
    expect(opened.status).toBe(200);
    expect(opened.body.openedAt).toBeTruthy();
    expect((await c.client.get('/rewards/hub')).body.wins[0]).toMatchObject({ place: 3, prize: { title: 'Prize 3' } });
    const winnerNotes = await ctx.dataSource.query(`SELECT 1 FROM notifications WHERE "userId" = $1 AND type = 'reward_weekly_prize'`, [b.id]);
    expect(winnerNotes).toHaveLength(1);

    const overview = (await admin.client.get('/admin/rewards')).body;
    expect(overview.winners.filter((w: { weekStart: string }) => w.weekStart === lastWeek).map((w: { username: string }) => w.username)).toEqual([a.username, b.username, c.username]);
    expect((await admin.client.post(`/admin/rewards/wins/${winA.id}/delivered`, { delivered: true })).status).toBe(200);
    expect((await a.client.get('/rewards/hub')).body.wins[0].deliveredAt).toBeTruthy();

    // Switched off: the hub is empty and nothing is credited.
    await admin.client.post('/admin/rewards/settings', { enabled: false, streakBonusXp: 300 });
    const off = (await outsider.client.get('/rewards/hub')).body;
    expect(off).toMatchObject({ enabled: false, daily: [], leaderboard: [] });
    const [{ m }] = await ctx.dataSource.query(`SELECT count(*)::int AS m FROM reward_xp WHERE "userId" = $1`, [outsider.id]);
    expect(m).toBe(0);
    await admin.client.post('/admin/rewards/settings', { enabled: true, streakBonusXp: 200 });
    const audits = await ctx.dataSource.query(`SELECT count(*)::int AS n FROM audit_logs WHERE action LIKE 'rewards.%'`);
    expect(audits[0].n).toBeGreaterThanOrEqual(8);
  });
});
