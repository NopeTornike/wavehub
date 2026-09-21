import { assertConserved, buyItem } from './flows';
import { balanceOf, createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Money-safety under concurrency for the order lifecycle: whichever request wins, funds move once.
describe('order lifecycle races (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;
  let buyer: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'oadmin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'oseller');
    buyer = await registerUser(ctx, 'obuyer');
    await credit(ctx, buyer, 5000);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('concurrent accepts release the seller payout exactly once', async () => {
    const before = await balanceOf(ctx, seller);
    const id = await buyItem(ctx, seller, buyer, admin, 100, 'delivered');
    const results = await Promise.all(Array.from({ length: 5 }, () => buyer.client.post(`/orders/${id}/accept`)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await balanceOf(ctx, seller)).toBe(before + 90);
  });

  it('concurrent buyer cancels refund exactly once', async () => {
    const before = await balanceOf(ctx, buyer);
    const id = await buyItem(ctx, seller, buyer, admin, 70, 'paid');
    const results = await Promise.all(Array.from({ length: 5 }, () => buyer.client.post(`/orders/${id}/cancel-as-buyer`)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await balanceOf(ctx, buyer)).toBe(before);
  });

  it('a buyer cancel racing a seller cancel refunds once', async () => {
    const before = await balanceOf(ctx, buyer);
    const id = await buyItem(ctx, seller, buyer, admin, 55, 'paid');
    await Promise.all([buyer.client.post(`/orders/${id}/cancel-as-buyer`), seller.client.post(`/orders/${id}/cancel-as-seller`)]);
    expect(await balanceOf(ctx, buyer)).toBe(before);
  });

  it('an accept racing a dispute ends in exactly one consistent outcome', async () => {
    const buyerBefore = await balanceOf(ctx, buyer);
    const sellerBefore = await balanceOf(ctx, seller);
    const id = await buyItem(ctx, seller, buyer, admin, 100, 'delivered');
    const [acc] = await Promise.all([
      buyer.client.post(`/orders/${id}/accept`),
      seller.client.post(`/orders/${id}/dispute`, { reason: 'Buyer is refusing to accept a valid delivery.' }),
    ]);
    const status = (await buyer.client.get(`/orders/${id}`)).body.status;
    if (acc.status === 200) {
      expect(status).toBe('completed');
      expect(await balanceOf(ctx, seller)).toBe(sellerBefore + 90);
    } else {
      expect(status).toBe('disputed');
      expect(await balanceOf(ctx, seller)).toBe(sellerBefore);
      const r = await admin.client.post(`/orders/${id}/dispute/resolve`, { resolution: 'refund_buyer', note: 'race' });
      expect(r.status).toBe(200);
      expect(await balanceOf(ctx, buyer)).toBe(buyerBefore);
    }
    expect((await ctx.dataSource.query(`SELECT COUNT(*)::int c FROM wallet_ledger_entries WHERE "orderId" = $1 AND type = 'order_release'`, [id]))[0].c).toBeLessThanOrEqual(1);
  });
});
