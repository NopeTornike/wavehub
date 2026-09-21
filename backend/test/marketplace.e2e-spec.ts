import { balanceOf, createApp, credit, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';

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
  afterAll(async () => ctx.close());

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

  it('runs purchase → start → deliver → accept with exact escrow + 10% fee math and a withdrawal hold', async () => {
    const listingId = await publishItemListing(ctx, seller, admin, 100);
    const buyerBefore = await balanceOf(ctx, buyer);

    const purchase = await buyer.client.post('/orders', { listingId });
    expect(purchase.status).toBeLessThan(300);
    const orderId = purchase.body.id;
    expect(purchase.body.platformFeeWaveCoin).toBe(10);
    expect(await balanceOf(ctx, buyer)).toBe(buyerBefore - 100); // escrow debit

    // Only the seller may start/deliver; only the buyer may accept.
    expect((await buyer.client.post(`/orders/${orderId}/start`)).status).toBe(403);
    expect((await seller.client.post(`/orders/${orderId}/start`)).status).toBe(200);
    expect((await seller.client.post(`/orders/${orderId}/deliver`)).status).toBe(200);
    expect((await seller.client.post(`/orders/${orderId}/accept`)).status).toBe(403);

    const sellerBalBefore = (await seller.client.get('/wallet/balance')).body;
    const accept = await buyer.client.post(`/orders/${orderId}/accept`);
    expect(accept.status).toBe(200);

    const wallet = (await seller.client.get('/wallet/balance')).body;
    // 90 earned, but inside the 7-day hold so none is withdrawable yet.
    expect(wallet.totalEarned - sellerBalBefore.totalEarned).toBe(90);
    expect(wallet.availableToWithdraw).toBe(sellerBalBefore.availableToWithdraw);
    const w = await seller.client.post('/withdrawals', {
      amountWaveCoin: 50, method: 'bank_transfer', payoutDetails: { iban: 'GE00XX0000000000000000' },
    });
    expect(w.status).toBeGreaterThanOrEqual(400);

    // Accepting twice must not double-release.
    expect((await buyer.client.post(`/orders/${orderId}/accept`)).status).toBeGreaterThanOrEqual(400);
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
    expect(await balanceOf(ctx, buyer)).toBe(before - 40);
    const cancel = await buyer.client.post(`/orders/${purchase.body.id}/cancel-as-buyer`);
    expect(cancel.status).toBe(200);
    expect(await balanceOf(ctx, buyer)).toBe(before);
  });
});
