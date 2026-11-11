import { CommunityService } from '../src/community/community.service';
import { assertConserved, buyItem } from './flows';
import { createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Owner 2026-11-10 (docs/design-mockups/round-6/03): the marketplace sellers leaderboard — live
// products / sales / rating, tabs, periods, totals, and the Super Admin on/off switch.
describe('seller leaderboard (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  const fresh = () => ((ctx.app.get(CommunityService) as unknown as { leaderboardCache: Map<string, unknown> }).leaderboardCache.clear());

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'slbadmin');
    await makeAdmin(ctx, admin);
  });
  afterAll(async () => {
    await admin.client.post('/admin/platform-settings', { features: { sellerLeaderboard: true } });
    await assertConserved(ctx);
    await ctx.close();
  });

  it('counts real sales and reviews, sorts each tab, respects the switch', async () => {
    const before = (await admin.client.get('/stats/seller-leaderboard?period=7d')).body;
    expect(before.visible).toBe(true);

    const seller = await registerUser(ctx, 'slbseller');
    const buyer = await registerUser(ctx, 'slbbuyer');
    await credit(ctx, buyer, 500);
    const o1 = await buyItem(ctx, seller, buyer, admin, 20, 'completed');
    await buyItem(ctx, seller, buyer, admin, 30, 'completed');
    await buyItem(ctx, seller, buyer, admin, 10, 'paid'); // not completed → not a sale
    expect((await buyer.client.post('/reviews', { orderId: o1, rating: 4 })).status).toBe(201);

    fresh();
    const after = (await buyer.client.get('/stats/seller-leaderboard?period=7d')).body;
    expect(after.totals.sales).toBe(before.totals.sales + 2);
    expect(after.totals.ratingCount).toBe(before.totals.ratingCount + 1);
    expect(after.rows.length).toBeLessThanOrEqual(5);
    // Nothing private in a public row.
    for (const row of after.rows) {
      expect(Object.keys(row).sort()).toEqual(['avatarUrl', 'firstName', 'lastName', 'products', 'rank', 'rating', 'ratingCount', 'sales', 'username', 'verified']);
    }

    for (const sort of ['overall', 'products', 'sales', 'rating'] as const) {
      const board = (await buyer.client.get(`/stats/seller-leaderboard?sort=${sort}&period=all`)).body;
      expect(board.sort).toBe(sort);
      const key = sort === 'products' ? 'products' : sort === 'rating' ? 'rating' : 'sales';
      const values = board.rows.map((r: Record<string, number>) => r[key] ?? 0);
      expect([...values].sort((a, b) => b - a)).toEqual(values);
      if (sort === 'rating') expect(board.rows.every((r: { ratingCount: number }) => r.ratingCount > 0)).toBe(true);
      const mine = board.rows.find((r: { username: string }) => r.username === seller.username);
      if (mine) expect(mine).toMatchObject({ sales: 2, ratingCount: 1, rating: 4 });
    }
    // The seller's own numbers, straight from the service ordering by sales with only them able to tie.
    const rows = await ctx.dataSource.query(`SELECT count(*)::int AS n FROM orders WHERE "sellerId" = $1 AND status = 'completed'`, [seller.id]);
    expect(rows[0].n).toBe(2);

    // Bad query values fall back to defaults instead of erroring.
    const odd = await buyer.client.get('/stats/seller-leaderboard?sort=drop&period=forever');
    expect(odd.status).toBe(200);
    expect(odd.body).toMatchObject({ sort: 'overall', period: 'all' });

    // Off: nothing is computed or shown; a non-Super-Admin can't flip it.
    expect((await buyer.client.post('/admin/platform-settings', { features: { sellerLeaderboard: false } })).status).toBe(403);
    expect((await admin.client.post('/admin/platform-settings', { features: { sellerLeaderboard: false } })).status).toBeLessThan(300);
    const off = (await buyer.client.get('/stats/seller-leaderboard')).body;
    expect(off).toMatchObject({ visible: false, rows: [] });
    expect((await buyer.client.get('/platform/features')).body.sellerLeaderboard).toBe(false);
  });
});
