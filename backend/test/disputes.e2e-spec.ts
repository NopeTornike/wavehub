import { assertConserved, buyItem, clearHold } from './flows';
import { balanceOf, createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

describe('disputes (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;
  let buyer: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'dadmin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'dseller');
    buyer = await registerUser(ctx, 'dbuyer');
    outsider = await registerUser(ctx, 'dout');
    await credit(ctx, buyer, 10000);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  const reason = 'The item was not what was described in the listing.';

  it('only a party may open a dispute, only on an in-flight order, only once', async () => {
    const orderId = await buyItem(ctx, seller, buyer, admin, 100, 'in_progress');
    expect((await outsider.client.post(`/orders/${orderId}/dispute`, { reason })).status).toBe(403);
    expect((await buyer.client.post(`/orders/${orderId}/dispute`, { reason: 'short' })).status).toBe(400);

    const opened = await buyer.client.post(`/orders/${orderId}/dispute`, { reason });
    expect(opened.status).toBeLessThan(300);
    expect(opened.body.status).toBe('open');
    expect((await buyer.client.get(`/orders/${orderId}`)).body.status).toBe('disputed');
    expect((await buyer.client.post(`/orders/${orderId}/dispute`, { reason })).status).toBe(403); // one per order

    const notes = (await seller.client.get('/notifications')).body;
    expect(JSON.stringify(notes)).toContain('dispute_opened');

    const completed = await buyItem(ctx, seller, buyer, admin, 50, 'completed');
    expect((await buyer.client.post(`/orders/${completed}/dispute`, { reason })).status).toBe(403);
  });

  it('refuses a dispute on a delivered order once the 7-day window has passed', async () => {
    const orderId = await buyItem(ctx, seller, buyer, admin, 30, 'delivered');
    await ctx.dataSource.query(`UPDATE orders SET "deliveredAt" = now() - interval '8 days' WHERE id = $1`, [orderId]);
    expect((await buyer.client.post(`/orders/${orderId}/dispute`, { reason })).status).toBe(403);
  });

  it('lets both parties (and only them) post messages and evidence', async () => {
    const orderId = await buyItem(ctx, seller, buyer, admin, 40, 'delivered');
    await buyer.client.post(`/orders/${orderId}/dispute`, { reason });

    expect((await buyer.client.post(`/orders/${orderId}/dispute/messages`, { body: 'Here is my side.' })).status).toBeLessThan(300);
    const reply = await seller.client.post(`/orders/${orderId}/dispute/messages`, { body: 'And mine.' });
    expect(reply.body.messages).toHaveLength(2);
    expect((await outsider.client.post(`/orders/${orderId}/dispute/messages`, { body: 'hi' })).status).toBe(403);
    expect((await outsider.client.get(`/orders/${orderId}/dispute`)).status).toBe(403);

    const png = await buyer.client.upload(`/orders/${orderId}/dispute/evidence`, Buffer.from('89504e470d0a1a0a0000000d49484452','hex'), 'proof.png', 'image/png');
    expect(png.status).toBe(200);
    expect(png.body.evidence).toHaveLength(1);
    const exe = await buyer.client.upload(`/orders/${orderId}/dispute/evidence`, Buffer.from('MZ'), 'evil.exe', 'application/x-msdownload');
    expect(exe.status).toBe(403);
    expect((await outsider.client.upload(`/orders/${orderId}/dispute/evidence`, Buffer.from('x'), 'p.png', 'image/png')).status).toBe(403);
  });

  it('resolution is admin-only, Super-Admin-only among staff', async () => {
    const orderId = await buyItem(ctx, seller, buyer, admin, 25, 'paid');
    await seller.client.post(`/orders/${orderId}/dispute`, { reason });
    const body = { resolution: 'refund_buyer', note: 'Refunding.' };

    expect((await buyer.client.post(`/orders/${orderId}/dispute/resolve`, body)).status).toBe(403);
    const support = await registerUser(ctx, 'dsupport');
    await makeAdmin(ctx, support, 'operation_lead');
    expect((await support.client.post(`/orders/${orderId}/dispute/resolve`, body)).status).toBe(403);
    expect((await support.client.get('/disputes')).status).toBe(403);

    const queue = await admin.client.get('/disputes');
    expect(queue.body.map((d: any) => d.orderId)).toContain(orderId);
    expect((await admin.client.get(`/disputes/${orderId}`)).status).toBe(200);
  });

  it('refund_buyer returns the exact escrow, restores stock, pays the seller nothing', async () => {
    const buyerBefore = await balanceOf(ctx, buyer);
    const sellerBefore = await balanceOf(ctx, seller);
    const orderId = await buyItem(ctx, seller, buyer, admin, 200, 'delivered');
    expect(await balanceOf(ctx, buyer)).toBe(buyerBefore - 200);
    const stockOf = async () =>
      Number((await ctx.dataSource.query(`SELECT l."stockQuantity" s FROM listings l JOIN orders o ON o."listingId" = l.id WHERE o.id = $1`, [orderId]))[0].s);
    const stockBefore = await stockOf();

    await buyer.client.post(`/orders/${orderId}/dispute`, { reason });
    await assertConserved(ctx); // funds are still escrowed mid-dispute
    const res = await admin.client.post(`/orders/${orderId}/dispute/resolve`, { resolution: 'refund_buyer', note: 'Seller did not deliver.' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
    expect(res.body.resolution).toBe('refund_buyer');

    expect(await balanceOf(ctx, buyer)).toBe(buyerBefore);
    expect(await balanceOf(ctx, seller)).toBe(sellerBefore);
    expect((await buyer.client.get(`/orders/${orderId}`)).body.status).toBe('refunded');
    expect(await stockOf()).toBe(stockBefore + 1);
    expect(JSON.stringify((await buyer.client.get('/notifications')).body)).toContain('dispute_resolved');

    // Resolving again must not move money again.
    expect((await admin.client.post(`/orders/${orderId}/dispute/resolve`, { resolution: 'release_to_seller', note: 'again' })).status).toBe(403);
    expect(await balanceOf(ctx, buyer)).toBe(buyerBefore);
    expect(await balanceOf(ctx, seller)).toBe(sellerBefore);
    const audit = await ctx.dataSource.query(`SELECT 1 FROM audit_logs WHERE action = 'dispute.resolve' AND "entityType" = 'dispute'`);
    expect(audit.length).toBeGreaterThan(0);
  });

  it('release_to_seller pays price minus fee, completes the order, and a dispute blocks withdrawals until resolved', async () => {
    const sellerBefore = await balanceOf(ctx, seller);
    const orderId = await buyItem(ctx, seller, buyer, admin, 100, 'delivered');
    await seller.client.post(`/orders/${orderId}/dispute`, { reason });

    await clearHold(ctx, seller);
    const w = await seller.client.post('/withdrawals', { amountWaveCoin: 20, method: 'bank_transfer', payoutDetails: { iban: 'GE00' } });
    expect(w.status).toBe(403); // active dispute

    const res = await admin.client.post(`/orders/${orderId}/dispute/resolve`, { resolution: 'release_to_seller', note: 'Delivered fine.' });
    expect(res.status).toBe(200);
    expect(await balanceOf(ctx, seller)).toBe(sellerBefore + 90);
    expect((await buyer.client.get(`/orders/${orderId}`)).body.status).toBe('completed');
    // Payout is subject to the same 7-day hold as a normal completion.
    const wallet = (await seller.client.get('/wallet/balance')).body;
    expect(wallet.pendingClearance).toBeGreaterThanOrEqual(90);
  });

  it('cancel_order refunds the buyer in full and lands on cancelled', async () => {
    const before = await balanceOf(ctx, buyer);
    const orderId = await buyItem(ctx, seller, buyer, admin, 60, 'in_progress');
    await buyer.client.post(`/orders/${orderId}/dispute`, { reason });
    const res = await admin.client.post(`/orders/${orderId}/dispute/resolve`, { resolution: 'cancel_order', note: 'Mutual cancel.' });
    expect(res.status).toBe(200);
    expect(await balanceOf(ctx, buyer)).toBe(before);
    expect((await buyer.client.get(`/orders/${orderId}`)).body.status).toBe('cancelled');
  });

  it('concurrent resolutions of one dispute move money exactly once', async () => {
    const before = await balanceOf(ctx, buyer);
    const orderId = await buyItem(ctx, seller, buyer, admin, 80, 'paid');
    await buyer.client.post(`/orders/${orderId}/dispute`, { reason });
    const results = await Promise.all(
      Array.from({ length: 4 }, () => admin.client.post(`/orders/${orderId}/dispute/resolve`, { resolution: 'refund_buyer', note: 'race' })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await balanceOf(ctx, buyer)).toBe(before);
  });
});
