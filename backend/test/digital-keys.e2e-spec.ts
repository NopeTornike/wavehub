import { balanceOf, createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

describe('digital keys (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'admin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'keyseller');
  });
  afterAll(async () => ctx.close());

  async function keyListing(price: number, keys: string[]): Promise<string> {
    const cats = await seller.client.get('/categories');
    const games = await seller.client.get('/games');
    const created = await seller.client.post('/listings', {
      type: 'digital_key', categoryId: cats.body[0].id, gameId: games.body[0].id,
      title: `Key listing ${Math.random().toString(36).slice(2, 7)}`,
      description: 'Steam keys sold with confirmed resale rights, described in enough detail.', priceWaveCoin: price, resaleRightsAttested: true,
    });
    expect(created.status).toBeLessThan(300);
    const id = created.body.id;
    expect((await seller.client.post(`/listings/${id}/keys`, { keys })).status).toBeLessThan(300);
    expect((await seller.client.post(`/listings/${id}/submit`)).status).toBeLessThan(300);
    expect((await admin.client.post(`/listings/${id}/approve`)).status).toBeLessThan(300);
    return id;
  }

  it('never leaks a key before purchase, hands exactly one key to its buyer, and hides it from others', async () => {
    const id = await keyListing(30, ['AAAA-1111-SECRET', 'BBBB-2222-SECRET']);
    const pub = await seller.client.get(`/listings/${id}`);
    expect(JSON.stringify(pub.body)).not.toMatch(/SECRET/);
    expect(pub.body.stockQuantity).toBe(2);

    const buyer = await registerUser(ctx, 'keybuyer');
    const other = await registerUser(ctx, 'keyother');
    await credit(ctx, buyer, 100);
    const order = await buyer.client.post('/orders', { listingId: id });
    expect(order.status).toBeLessThan(300);
    expect(JSON.stringify(order.body)).not.toMatch(/SECRET/); // order payload itself never carries the key

    const key = await buyer.client.get(`/orders/${order.body.id}/key`);
    expect(key.status).toBe(200);
    expect(JSON.stringify(key.body)).toMatch(/SECRET/);
    expect((await other.client.get(`/orders/${order.body.id}/key`)).status).toBeGreaterThanOrEqual(400);
    expect((await seller.client.get(`/orders/${order.body.id}/key`)).status).toBeGreaterThanOrEqual(400);
    // Digital-key orders can't be plain-cancelled (disputes are the venue).
    expect((await buyer.client.post(`/orders/${order.body.id}/cancel-as-buyer`)).status).toBeGreaterThanOrEqual(400);
  });

  it('never oversells: 5 concurrent buyers, 2 keys → exactly 2 succeed and every loser is refunded nothing-lost', async () => {
    const id = await keyListing(10, ['CCCC-3333-KEY', 'DDDD-4444-KEY']);
    const buyers = await Promise.all([1, 2, 3, 4, 5].map((n) => registerUser(ctx, `race${n}`)));
    await Promise.all(buyers.map((b) => credit(ctx, b, 100)));

    const results = await Promise.all(buyers.map((b) => b.client.post('/orders', { listingId: id })));
    const won = results.filter((r) => r.status < 300);
    expect(won).toHaveLength(2);

    let totalBalance = 0;
    for (const b of buyers) totalBalance += await balanceOf(ctx, b);
    expect(totalBalance).toBe(5 * 100 - 2 * 10); // only the two winners paid

    const rows = await ctx.dataSource.query(
      `SELECT status, "orderId" FROM listing_key_inventory WHERE "listingId" = $1`, [id],
    );
    expect(rows.filter((r: any) => r.status === 'sold' && r.orderId)).toHaveLength(2);
    expect(rows.filter((r: any) => r.status === 'sold' && !r.orderId)).toHaveLength(0);
  });
});
