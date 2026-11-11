import { assertConserved, buyItem } from './flows';
import { createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Owner round 2026-11-10: Admin → Orders (+ staff bell on every sale).
describe('owner round 2026-11-10 (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'o10admin');
    await makeAdmin(ctx, admin);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('staff see who sold what in Admin → Orders and get a bell item per sale', async () => {
    const seller = await registerUser(ctx, 'o10seller');
    const buyer = await registerUser(ctx, 'o10buyer');
    const ops = await registerUser(ctx, 'o10ops');
    await makeAdmin(ctx, ops, 'marketplace_coaching_ops_manager');
    const support = await registerUser(ctx, 'o10support');
    await makeAdmin(ctx, support, 'support_specialist');
    await credit(ctx, buyer, 100);
    const orderId = await buyItem(ctx, seller, buyer, admin, 40);
    const [{ orderNumber }] = await ctx.dataSource.query(`SELECT "orderNumber" FROM orders WHERE id = $1`, [orderId]);

    const page = await ops.client.get(`/admin/orders?q=${orderNumber}`);
    expect(page.status).toBe(200);
    expect(page.body.total).toBe(1);
    const row = page.body.items[0];
    expect(row).toMatchObject({ id: orderId, orderNumber, status: 'paid' });
    expect(row.buyer.username).toBe(buyer.username);
    expect(row.seller.username).toBe(seller.username);
    expect(row.seller.email).toContain('@');
    expect((await admin.client.get(`/admin/orders?q=@${seller.username}&status=paid`)).body.items.map((r: { id: string }) => r.id)).toContain(orderId);
    expect((await admin.client.get(`/admin/orders?status=completed&q=${orderNumber}`)).body.total).toBe(0);

    expect((await support.client.get('/admin/orders')).status).toBe(403);
    expect((await buyer.client.get('/admin/orders')).status).toBe(403);
    // Order staff can open the order (read-only); support still can't.
    expect((await ops.client.get(`/orders/${orderId}`)).status).toBe(200);
    expect((await support.client.get(`/orders/${orderId}`)).status).toBe(403);

    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int AS count FROM notifications WHERE "userId" = ANY($1::uuid[]) AND type = 'staff_task' AND metadata ->> 'key' = $2`,
      [[admin.id, ops.id], `order:${orderId}`],
    );
    expect(count).toBe(2);
  });
});
