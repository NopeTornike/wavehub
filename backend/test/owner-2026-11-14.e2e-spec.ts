import { assertConserved, buyItem } from './flows';
import { balanceOf, createApp, credit, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';

// Owner batch 2026-11-14: editing a reward task never un-does it, the new task triggers (GEL
// amounts, favourites, …), personal promo codes, and Super Admin "set balance to 0".
describe('owner 2026-11-14 (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'o14admin');
    await makeAdmin(ctx, admin);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  type Task = { id: string; title: string; trigger: string; target: number; done: boolean; progress: number };
  const find = (list: Task[], id: string) => list.find((t) => t.id === id)!;

  it('editing a finished task keeps it done and never pays twice; GEL and favourite triggers count', async () => {
    const player = await registerUser(ctx, 'o14player');
    const seller = await registerUser(ctx, 'o14seller');
    const mk = async (body: Record<string, unknown>) => (await admin.client.post('/admin/rewards/tasks', { xp: 10, period: 'daily', ...body })).body.id as string;
    const topupTask = await mk({ title: 'Top up 40 GEL', trigger: 'topup_amount', target: 40 });
    const favTask = await mk({ title: 'Favourite 2 products', trigger: 'favorite_listing', target: 2 });
    const buyTask = await mk({ title: 'Buy anything', trigger: 'purchase', target: 1 });
    expect((await admin.client.post('/admin/rewards/tasks', { title: 'bad', trigger: 'nope', target: 1, xp: 1, period: 'daily' })).status).toBe(400);

    await credit(ctx, player, 25);
    let hub = (await player.client.get('/rewards/hub')).body;
    expect(find(hub.daily, topupTask)).toMatchObject({ done: false, progress: 25, target: 40 });
    await credit(ctx, player, 20);

    const l1 = await publishItemListing(ctx, seller, admin, 5);
    const l2 = await publishItemListing(ctx, seller, admin, 6);
    expect((await player.client.post(`/listings/${l1}/favorite`, {})).status).toBeLessThan(300);
    expect((await player.client.post(`/listings/${l2}/favorite`, {})).status).toBeLessThan(300);
    await buyItem(ctx, seller, player, admin, 10, 'paid');

    hub = (await player.client.get('/rewards/hub')).body;
    expect(find(hub.daily, topupTask).done).toBe(true);
    expect(find(hub.daily, favTask).done).toBe(true);
    expect(find(hub.daily, buyTask).done).toBe(true);
    const xpBefore = hub.xp.total;

    // Edit everything about the finished task — including daily → once — it stays done, no new XP.
    expect((await admin.client.post(`/admin/rewards/tasks/${buyTask}`, { title: 'Buy 3 things', trigger: 'buy_skin', target: 3, xp: 99, period: 'once' })).status).toBeLessThan(300);
    expect((await admin.client.post(`/admin/rewards/tasks/${topupTask}`, { title: 'Top up 80 GEL', trigger: 'topup_amount', target: 80, xp: 10, period: 'daily' })).status).toBeLessThan(300);
    hub = (await player.client.get('/rewards/hub')).body;
    expect(find(hub.achievements, buyTask).done).toBe(true);
    expect(find(hub.daily, topupTask).done).toBe(true);
    expect(hub.justEarned).toEqual([]);
    expect(hub.xp.total).toBe(xpBefore);

    for (const id of [topupTask, favTask, buyTask]) await admin.client.request('DELETE', `/admin/rewards/tasks/${id}`);
  });

  it('a personal promo code works only for its account; caps hold', async () => {
    const owner = await registerUser(ctx, 'o14promo');
    const friend = await registerUser(ctx, 'o14friend');
    expect((await admin.client.post('/admin/promo-codes', { code: 'NOBODY1', amountWaveCoin: 3, maxRedemptions: 1, assignedUsername: '@no_such_user_xyz' })).status).toBe(400);
    const created = await admin.client.post('/admin/promo-codes', { code: 'PERSONAL1', amountWaveCoin: 3, maxRedemptions: 1, assignedUsername: `@${owner.username}` });
    expect(created.status).toBe(201);
    expect(created.body.assignedUser).toMatchObject({ username: owner.username });

    const shared = await friend.client.post('/promo-codes/redeem', { code: 'PERSONAL1' });
    expect(shared.status).toBe(404);
    expect((await owner.client.post('/promo-codes/redeem', { code: 'personal1' })).status).toBeLessThan(300);
    expect((await owner.client.post('/promo-codes/redeem', { code: 'PERSONAL1' })).status).toBe(403);

    // Clearing the assignee makes it public again; the 1-use cap is already spent.
    const cleared = await admin.client.patch(`/admin/promo-codes/${created.body.id}`, { assignedUsername: '' });
    expect(cleared.body.assignedUser).toBeNull();
    expect((await friend.client.post('/promo-codes/redeem', { code: 'PERSONAL1' })).status).toBe(403);

    // A 2-use public code: the first two accounts only.
    await admin.client.post('/admin/promo-codes', { code: 'TWOUSES', amountWaveCoin: 2, maxRedemptions: 2 });
    const third = await registerUser(ctx, 'o14third');
    expect((await owner.client.post('/promo-codes/redeem', { code: 'TWOUSES' })).status).toBeLessThan(300);
    expect((await friend.client.post('/promo-codes/redeem', { code: 'TWOUSES' })).status).toBeLessThan(300);
    expect((await third.client.post('/promo-codes/redeem', { code: 'TWOUSES' })).status).toBe(403);
  });

  it('Super Admin sets a balance to exactly 0 (audited); others cannot', async () => {
    const user = await registerUser(ctx, 'o14zero');
    await credit(ctx, user, 30);
    await ctx.dataSource.query(`UPDATE users SET "wavecoinBalance" = "wavecoinBalance" + 0.5 WHERE id = $1`, [user.id]);
    await ctx.dataSource.query(
      `INSERT INTO wallet_ledger_entries ("userId", type, "amountWaveCoin", "balanceAfter", status, reference) VALUES ($1, 'admin_adjustment', 0.5, 30.5, 'available', $2)`,
      [user.id, `e2e-tetri-${user.id}`],
    );
    const support = await registerUser(ctx, 'o14support');
    await makeAdmin(ctx, support, 'support_specialist');
    expect((await support.client.post(`/admin/users/${user.id}/wallet-zero`, { reason: 'cleanup test' })).status).toBe(403);
    expect((await admin.client.post(`/admin/users/${user.id}/wallet-zero`, { reason: 'x' })).status).toBe(400);

    const res = await admin.client.post(`/admin/users/${user.id}/wallet-zero`, { reason: 'Owner asked to clear it' });
    expect(res.status).toBe(200);
    expect(await balanceOf(ctx, user)).toBe(0);
    const [entry] = await ctx.dataSource.query(`SELECT "amountWaveCoin" FROM wallet_ledger_entries WHERE "userId" = $1 AND reference LIKE 'admin-zero-%'`, [user.id]);
    expect(Number(entry.amountWaveCoin)).toBe(-30.5);
    const audit = await ctx.dataSource.query(`SELECT 1 FROM audit_logs WHERE action = 'user.wallet_zero' AND "entityId" = $1`, [user.id]);
    expect(audit).toHaveLength(1);
    expect((await admin.client.post(`/admin/users/${user.id}/wallet-zero`, { reason: 'Owner asked again' })).status).toBe(400);
  });
});
