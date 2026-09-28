import { createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';
import { assertConserved, buyItem } from './flows';

// Super Admin statistics (backend/src/analytics/) against real Postgres: access is Super Admin
// only, the range is validated, and real sales move the figures by exactly what happened.
describe('admin analytics (e2e)', () => {
  let ctx: E2eApp;
  let superAdmin: TestUser;
  let ops: TestUser;
  let seller: TestUser;
  let buyer: TestUser;
  const today = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    ctx = await createApp();
    [superAdmin, ops, seller, buyer] = await Promise.all([
      registerUser(ctx, 'anasuper'),
      registerUser(ctx, 'anaops'),
      registerUser(ctx, 'anaseller'),
      registerUser(ctx, 'anabuyer'),
    ]);
    await makeAdmin(ctx, superAdmin);
    await makeAdmin(ctx, ops, 'operation_lead');
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('is Super Admin only and validates the range', async () => {
    expect((await buyer.client.get('/admin/analytics')).status).toBe(403);
    expect((await ops.client.get('/admin/analytics')).status).toBe(403);
    expect((await superAdmin.client.get('/admin/analytics?from=2026-13-01')).status).toBe(400);
    expect((await superAdmin.client.get('/admin/analytics?from=2026-05-02&to=2026-05-01')).status).toBe(400);
    expect((await superAdmin.client.get('/admin/analytics?from=2000-01-01&to=2026-01-01')).status).toBe(400);
    expect((await superAdmin.client.get('/admin/analytics?limit=5')).status).toBe(400);

    const month = await superAdmin.client.get('/admin/analytics');
    expect(month.status).toBe(200);
    expect(month.body.bucket).toBe('day');
    expect(month.body.series).toHaveLength(30); // default range: the last 30 days, zero-filled
    expect(month.body.to).toBe(today);
    const year = await superAdmin.client.get(`/admin/analytics?from=2025-10-01&to=2026-09-30`);
    expect(year.body.bucket).toBe('month');
    expect(year.body.series).toHaveLength(12);
  });

  it('reflects real sales exactly, with no private data', async () => {
    const q = `/admin/analytics?from=${today}&to=${today}`;
    const before = (await superAdmin.client.get(q)).body;

    await credit(ctx, buyer, 200);
    await buyItem(ctx, seller, buyer, superAdmin, 50, 'completed');
    await buyItem(ctx, seller, buyer, superAdmin, 30, 'paid');
    const cancelled = await buyItem(ctx, seller, buyer, superAdmin, 20, 'paid');
    expect((await buyer.client.post(`/orders/${cancelled}/cancel-as-buyer`)).status).toBeLessThan(300);

    const after = (await superAdmin.client.get(q)).body;
    const d = (path: (x: any) => number) => path(after) - path(before);
    expect(d((x) => x.sales.orders)).toBe(3);
    expect(d((x) => x.sales.gmv)).toBe(80); // the cancelled 20 is excluded
    expect(d((x) => x.sales.completedOrders)).toBe(1);
    expect(d((x) => x.sales.completedValue)).toBe(50);
    expect(d((x) => x.sales.platformFees)).toBe(5); // 10% of the completed 50
    expect(d((x) => x.sales.refundedOrders)).toBe(1);
    expect(d((x) => x.sales.refundedValue)).toBe(20);
    expect(d((x) => x.sales.inEscrow)).toBe(30);
    expect(d((x) => x.series[0].gmv)).toBe(80);
    expect(d((x) => x.series[0].orders)).toBe(3);

    const sellerRow = after.topSellers.find((s: { username: string }) => s.username === seller.username);
    expect(sellerRow).toMatchObject({ orders: 3, gmv: 80, platformFees: 5 });
    const itemRow = after.byType.find((t: { key: string }) => t.key === 'item');
    expect(itemRow.gmv - (before.byType.find((t: { key: string }) => t.key === 'item')?.gmv ?? 0)).toBe(80);
    expect(after.users.sellersWithSales).toBeGreaterThanOrEqual(1);

    expect(JSON.stringify(after)).not.toMatch(/"(email|passwordHash|wavecoinBalance|payoutDetails)"/);
  });
});
