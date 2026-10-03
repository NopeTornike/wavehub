import { balanceOf, createApp, credit, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';
import { assertConserved } from './flows';

describe('marketplace spine (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;
  let buyer: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'admin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'seller');
    buyer = await registerUser(ctx, 'buyer');
    await credit(ctx, buyer, 1000);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('an unapproved listing is invisible to the public and un-purchasable', async () => {
    const cats = await seller.client.get('/categories');
    const games = await seller.client.get('/games');
    const draft = await seller.client.post('/listings', {
      type: 'item', categoryId: cats.body[0].id, gameId: games.body[0].id, title: 'Draft only item',
      description: 'Not yet submitted for review at all, but long enough to pass validation.', priceWaveCoin: 50, stockQuantity: 1, isUnique: true,
    });
    expect(draft.status).toBeLessThan(300);
    const before = await balanceOf(ctx, buyer);
    const buy = await buyer.client.post('/orders', { listingId: draft.body.id });
    expect(buy.status).toBeGreaterThanOrEqual(400);
    expect(await balanceOf(ctx, buyer)).toBe(before);
  });

  it('non-admins cannot approve listings', async () => {
    const id = (await seller.client.get('/listings/mine')).body[0]?.id;
    expect(id).toBeDefined();
    expect((await buyer.client.post(`/listings/${id}/approve`)).status).toBe(403);
  });

  it('runs purchase → start → deliver → accept with exact escrow + buyer-paid 10% fee math and a withdrawal hold', async () => {
    const listingId = await publishItemListing(ctx, seller, admin, 100);
    const buyerBefore = await balanceOf(ctx, buyer);

    const purchase = await buyer.client.post('/orders', { listingId });
    expect(purchase.status).toBeLessThan(300);
    const orderId = purchase.body.id;
    // The buyer pays the fee on top (owner decision 2026-10-03): 100 + 10 = 110 into escrow, and the
    // public quote shown before buying matches what was charged.
    expect(purchase.body.platformFeeWaveCoin).toBe(10);
    expect(purchase.body.buyerTotalWaveCoin).toBe(110);
    expect(purchase.body.sellerPayoutWaveCoin).toBe(100);
    expect(purchase.body.feePaidBy).toBe('buyer');
    expect(await balanceOf(ctx, buyer)).toBe(buyerBefore - 110); // escrow debit

    // Only the seller may start/deliver; only the buyer may accept.
    expect((await buyer.client.post(`/orders/${orderId}/start`)).status).toBe(403);
    expect((await seller.client.post(`/orders/${orderId}/start`)).status).toBe(200);
    expect((await seller.client.post(`/orders/${orderId}/deliver`)).status).toBe(200);
    expect((await seller.client.post(`/orders/${orderId}/accept`)).status).toBe(403);

    const sellerBalBefore = (await seller.client.get('/wallet/balance')).body;
    const accept = await buyer.client.post(`/orders/${orderId}/accept`);
    expect(accept.status).toBe(200);

    const wallet = (await seller.client.get('/wallet/balance')).body;
    // The full price (100) earned, but inside the 7-day hold so none is withdrawable yet.
    expect(wallet.totalEarned - sellerBalBefore.totalEarned).toBe(100);
    expect(wallet.availableToWithdraw).toBe(sellerBalBefore.availableToWithdraw);
    const w = await seller.client.post('/withdrawals', {
      amountWaveCoin: 50, method: 'bank_transfer', payoutDetails: { iban: 'GE00XX0000000000000000' },
    });
    expect(w.status).toBeGreaterThanOrEqual(400);

    // Accepting twice must not double-release.
    expect((await buyer.client.post(`/orders/${orderId}/accept`)).status).toBeGreaterThanOrEqual(400);
  });

  it("charges the exact fee, never rounded — the owner's example: 80 GEL at 6% = 4.80, total 84.80", async () => {
    expect((await admin.client.post('/admin/platform-settings', { platformFeePercent: 6 })).status).toBe(200);
    try {
      const listingId = await publishItemListing(ctx, seller, admin, 80);
      const quote = await fetch(`${ctx.baseUrl}/order-quote?listingId=${listingId}`).then((r) => r.json());
      expect(quote).toEqual({ priceWaveCoin: 80, feePercent: 6, feeWaveCoin: 4.8, totalWaveCoin: 84.8 });

      const exact = await registerUser(ctx, 'exact');
      await credit(ctx, exact, 100);
      const order = await exact.client.post('/orders', { listingId });
      expect(order.status).toBeLessThan(300);
      expect(order.body).toMatchObject({ priceWaveCoin: 80, platformFeeWaveCoin: 4.8, buyerTotalWaveCoin: 84.8, sellerPayoutWaveCoin: 80 });
      expect(await balanceOf(ctx, exact)).toBe(15.2);
      expect((await exact.client.get('/auth/me')).body.user.wavecoinBalance).toBe(15.2);

      // A refund returns the exact 84.80…
      expect((await exact.client.post(`/orders/${order.body.id}/cancel-as-buyer`)).status).toBe(200);
      expect(await balanceOf(ctx, exact)).toBe(100);

      // …and completion pays the seller the full 80 while the platform keeps exactly 4.80.
      const again = await exact.client.post('/orders', { listingId: await publishItemListing(ctx, seller, admin, 80) });
      const sellerBefore = await balanceOf(ctx, seller);
      await seller.client.post(`/orders/${again.body.id}/start`);
      await seller.client.post(`/orders/${again.body.id}/deliver`);
      expect((await exact.client.post(`/orders/${again.body.id}/accept`)).status).toBe(200);
      expect(await balanceOf(ctx, seller)).toBe(sellerBefore + 80);
      expect(await balanceOf(ctx, exact)).toBe(15.2);
      const tx = (await exact.client.get('/wallet/transactions')).body;
      expect(tx.some((t: { amountWaveCoin: number }) => t.amountWaveCoin === -84.8)).toBe(true);
    } finally {
      await admin.client.post('/admin/platform-settings', { platformFeePercent: 10 });
    }
  });

  it('quotes price + buyer fee publicly before purchase, as whole coins', async () => {
    const listingId = await publishItemListing(ctx, seller, admin, 100);
    const quote = await fetch(`${ctx.baseUrl}/order-quote?listingId=${listingId}`).then((r) => r.json());
    expect(quote).toEqual({ priceWaveCoin: 100, feePercent: 10, feeWaveCoin: 10, totalWaveCoin: 110 });
    expect((await fetch(`${ctx.baseUrl}/order-quote?listingId=not-a-uuid`)).status).toBe(400);
    expect((await fetch(`${ctx.baseUrl}/order-quote?listingId=00000000-0000-4000-8000-000000000000`)).status).toBe(404);
  });

  it('refuses a purchase the buyer can afford only without the fee', async () => {
    const tight = await registerUser(ctx, 'tight');
    await credit(ctx, tight, 50);
    const listingId = await publishItemListing(ctx, seller, admin, 50);
    expect((await tight.client.post('/orders', { listingId })).status).toBeGreaterThanOrEqual(400);
    expect(await balanceOf(ctx, tight)).toBe(50);
  });

  it('refuses a purchase the buyer cannot afford and leaves balances untouched', async () => {
    const poor = await registerUser(ctx, 'poor');
    const listingId = await publishItemListing(ctx, seller, admin, 500);
    const res = await poor.client.post('/orders', { listingId });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await balanceOf(ctx, poor)).toBe(0);
  });

  it("a seller can't buy their own listing", async () => {
    const listingId = await publishItemListing(ctx, seller, admin, 20);
    await credit(ctx, seller, 100);
    expect((await seller.client.post('/orders', { listingId })).status).toBeGreaterThanOrEqual(400);
  });

  it('buyer cancel before start refunds the full escrow', async () => {
    const listingId = await publishItemListing(ctx, seller, admin, 40);
    const before = await balanceOf(ctx, buyer);
    const purchase = await buyer.client.post('/orders', { listingId });
    expect(await balanceOf(ctx, buyer)).toBe(before - 44); // 40 + 4 buyer fee
    const cancel = await buyer.client.post(`/orders/${purchase.body.id}/cancel-as-buyer`);
    expect(cancel.status).toBe(200);
    expect(await balanceOf(ctx, buyer)).toBe(before);
  });
});
