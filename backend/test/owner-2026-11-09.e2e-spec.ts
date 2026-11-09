import { assertConserved, buyItem } from './flows';
import { createApp, credit, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('fake-but-sniffable')]);

// Owner round 2026-11-09: staff cover a product with the Tournament Gift artwork or their own image
// (nobody can buy it while covered), pin products to the first places of the marketplace, a Game
// Manager sets the sale ("old") price, and the seller's profile shows more than three reviews.
describe('owner round 2026-11-09 (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'o9admin');
    await makeAdmin(ctx, admin);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('a gift or custom cover blocks buying until staff remove it; audited; Game Manager scoped', async () => {
    const seller = await registerUser(ctx, 'o9seller');
    const buyer = await registerUser(ctx, 'o9buyer');
    await credit(ctx, buyer, 100);
    const listingId = await publishItemListing(ctx, seller, admin, 20);

    expect((await seller.client.post(`/admin/listings/${listingId}/cover-overlay`, { overlay: 'gift' })).status).toBe(403);
    expect((await admin.client.post(`/admin/listings/${listingId}/cover-overlay`, { overlay: 'bogus' })).status).toBe(400);
    const set = await admin.client.post(`/admin/listings/${listingId}/cover-overlay`, { overlay: 'gift' });
    expect(set.status).toBe(200);
    expect(set.body.coverOverlay).toBe('gift');

    const detail = (await buyer.client.get(`/listings/${listingId}`)).body;
    expect(detail.coverOverlay).toBe('gift');
    expect((await buyer.client.get(`/order-quote?listingId=${listingId}`)).status).toBe(409);
    expect((await buyer.client.post('/orders', { listingId })).status).toBe(409);

    const custom = await admin.client.upload(`/admin/listings/${listingId}/cover-overlay/image`, PNG, 'cover.png', 'image/png');
    expect(custom.status).toBe(200);
    expect(custom.body.coverOverlay).toBe('custom');
    expect(custom.body.coverOverlayUrl).toMatch(/\/uploads\//);
    expect((await buyer.client.post('/orders', { listingId })).status).toBe(409);

    const off = await admin.client.post(`/admin/listings/${listingId}/cover-overlay`, { overlay: 'none' });
    expect(off.body.coverOverlay).toBeNull();
    expect((await buyer.client.post('/orders', { listingId })).status).toBe(201);

    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM audit_logs WHERE action IN ('listing.set_cover', 'listing.remove_cover') AND "entityId" = $1`, [listingId]);
    expect(count).toBe(3);

    const listing = (await ctx.dataSource.query(`SELECT "gameId" FROM listings WHERE id = $1`, [listingId]))[0];
    const games = (await admin.client.get('/games')).body as Array<{ id: string }>;
    const gm = await registerUser(ctx, 'o9gm');
    await admin.client.post(`/admin/users/${gm.id}/role`, { adminRole: 'game_manager', reason: 'other', staffScopes: { marketplaceGameIds: [games.find((g) => g.id !== listing.gameId)!.id], tournamentGameIds: [] } });
    const other = await publishItemListing(ctx, seller, admin, 25);
    await ctx.dataSource.query(`UPDATE listings SET "gameId" = $2 WHERE id = $1`, [other, listing.gameId]);
    expect((await gm.client.post(`/admin/listings/${other}/cover-overlay`, { overlay: 'gift' })).status).toBe(403);
  });

  it('pinned listings come first in the marketplace whatever the sort; only Ops/Super Admin pin', async () => {
    const seller = await registerUser(ctx, 'o9pinseller');
    const first = await publishItemListing(ctx, seller, admin, 7);
    const second = await publishItemListing(ctx, seller, admin, 9);
    expect((await seller.client.post(`/admin/listings/${second}/pin`, { pinned: true })).status).toBe(403);
    const pin = await admin.client.post(`/admin/listings/${second}/pin`, { pinned: true });
    expect(pin.status).toBe(200);
    expect(pin.body.pinnedAt).toBeTruthy();
    await admin.client.post(`/admin/listings/${first}/pin`, { pinned: true });

    for (const sort of ['', '&sort=price_asc', '&sort=oldest', '&sort=popular']) {
      const page = (await seller.client.get(`/listings?limit=5${sort}`)).body;
      expect(page.items.slice(0, 2).map((i: { id: string }) => i.id)).toEqual([second, first]);
      expect(page.items[0].pinnedAt).toBeTruthy();
    }
    await admin.client.post(`/admin/listings/${second}/pin`, { pinned: false });
    await admin.client.post(`/admin/listings/${first}/pin`, { pinned: false });
    const after = (await seller.client.get('/listings?limit=50')).body.items as Array<{ id: string; pinnedAt: string | null }>;
    expect(after.filter((i) => i.pinnedAt)).toHaveLength(0);
  });

  it('a Game Manager sets the price and sale price of its game listing', async () => {
    const seller = await registerUser(ctx, 'o9saleseller');
    const listingId = await publishItemListing(ctx, seller, admin, 30);
    const [{ gameId }] = await ctx.dataSource.query(`SELECT "gameId" FROM listings WHERE id = $1`, [listingId]);
    const gm = await registerUser(ctx, 'o9salegm');
    await admin.client.post(`/admin/users/${gm.id}/role`, { adminRole: 'game_manager', reason: 'pubg', staffScopes: { marketplaceGameIds: [gameId], tournamentGameIds: [] } });
    const current = (await gm.client.get(`/admin/listings/${listingId}`)).body;
    const res = await gm.client.patch(`/admin/listings/${listingId}`, { priceWaveCoin: 24, attributes: { ...(current.itemAttributes ?? {}), compareAtPrice: 40 } });
    expect(res.status).toBe(200);
    const detail = (await seller.client.get(`/listings/${listingId}`)).body;
    expect(detail.priceWaveCoin).toBe(24);
    expect(detail.itemAttributes.compareAtPrice).toBe(40);
    expect((await gm.client.patch(`/admin/listings/${listingId}`, { attributes: { compareAtPrice: 10 } })).status).toBe(400);
  });

  it("the seller's profile carries more than three reviews", async () => {
    const seller = await registerUser(ctx, 'o9revseller');
    const listingId = await publishItemListing(ctx, seller, admin, 12);
    for (let i = 0; i < 4; i += 1) {
      const reader = await registerUser(ctx, `o9rev${i}`);
      expect((await reader.client.post(`/listings/${listingId}/reviews`, { rating: 5 })).status).toBe(201);
    }
    const profile = (await admin.client.get(`/users/${seller.username}`)).body;
    expect(profile.reviews.count).toBe(4);
    expect(profile.reviews.cards).toHaveLength(4);
    expect(profile.reviews.latest).toHaveLength(4);
    expect((await admin.client.get(`/listings/${listingId}`)).body.ratingCount).toBe(4);
  });
  it('a Super Admin who is not a party can open a disputed order, read its chat and refund it', async () => {
    const seller = await registerUser(ctx, 'o9dseller');
    const buyer = await registerUser(ctx, 'o9dbuyer');
    const stranger = await registerUser(ctx, 'o9dstranger');
    const support = await registerUser(ctx, 'o9dsupport');
    await makeAdmin(ctx, support, 'support_specialist');
    await credit(ctx, buyer, 200);
    const orderId = await buyItem(ctx, seller, buyer, admin, 120, 'delivered');
    expect((await buyer.client.post(`/orders/${orderId}/dispute`, { reason: 'Cannot log in to the account I bought' })).status).toBe(201);

    const view = await admin.client.get(`/orders/${orderId}`);
    expect(view.status).toBe(200);
    expect(view.body.status).toBe('disputed');
    expect((await admin.client.get(`/orders/${orderId}/messages`)).status).toBe(200);
    expect((await admin.client.get(`/disputes/${orderId}`)).status).toBe(200);
    // Read-only: staff can't act as a party, and other people still can't see the order.
    expect((await admin.client.post(`/orders/${orderId}/messages`, { body: 'hi' })).status).toBe(403);
    expect((await stranger.client.get(`/orders/${orderId}`)).status).toBe(403);
    expect((await support.client.get(`/orders/${orderId}`)).status).toBe(403);

    const bal = async () => Number((await ctx.dataSource.query(`SELECT "wavecoinBalance" AS b FROM users WHERE id = $1`, [buyer.id]))[0].b);
    const before = await bal();
    const resolved = await admin.client.post(`/orders/${orderId}/dispute/resolve`, { resolution: 'refund_buyer', note: 'Account details did not work' });
    expect(resolved.status).toBe(200);
    const order = (await buyer.client.get(`/orders/${orderId}`)).body;
    expect(order.status).toBe('refunded');
    // The full payment (price + buyer fee) goes back to the buyer's balance; the seller gets nothing.
    const [{ sum }] = await ctx.dataSource.query(`SELECT COALESCE(SUM("amountWaveCoin"),0)::numeric AS sum FROM wallet_ledger_entries WHERE "orderId" = $1 AND "userId" = $2`, [orderId, seller.id]);
    expect(Number(sum)).toBe(0);
    expect((await bal()) - before).toBeCloseTo(Number(order.buyerTotalWaveCoin), 2);
  });
});
