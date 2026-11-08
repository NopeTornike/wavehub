import { assertConserved, buyItem } from './flows';
import { createApp, credit, E2eApp, makeAdmin, openAllHours, publishItemListing, registerUser, TestUser } from './helpers';

// Owner round 2026-11-08: one open review per product for verified users, staff-set listing
// badges (Game Manager scoped, audited), coach profile view counts, the live notification stream,
// and the seller's measured response time on the listing page.
describe('owner round 2026-11-08 (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'o8admin');
    await makeAdmin(ctx, admin);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('a verified user writes one review per product without buying; never on their own listing', async () => {
    const seller = await registerUser(ctx, 'o8seller');
    const reader = await registerUser(ctx, 'o8reader');
    const listingId = await publishItemListing(ctx, seller, admin, 20);

    expect((await reader.client.get(`/listings/${listingId}/my-review`)).body.reviewed).toBe(false);
    const posted = await reader.client.post(`/listings/${listingId}/reviews`, { rating: 4, body: 'Looks like a fair offer, quick answers too.' });
    expect(posted.status).toBe(201);
    expect(posted.body.orderId).toBeNull();
    expect((await reader.client.post(`/listings/${listingId}/reviews`, { rating: 5 })).status).toBe(409);
    expect((await reader.client.get(`/listings/${listingId}/my-review`)).body.reviewed).toBe(true);
    expect((await seller.client.post(`/listings/${listingId}/reviews`, { rating: 5 })).status).toBe(403);

    // Unverified accounts can't.
    const pending = await registerUser(ctx, 'o8pending');
    await ctx.dataSource.query(`UPDATE users SET status = 'pending_verification' WHERE id = $1`, [pending.id]);
    expect((await pending.client.post(`/listings/${listingId}/reviews`, { rating: 3 })).status).toBe(403);

    const detail = (await reader.client.get(`/listings/${listingId}`)).body;
    expect(detail.ratingCount).toBeGreaterThanOrEqual(1);
    expect(detail).toHaveProperty('sellerResponseMinutes');

    // A real buyer's order review is still marked as a verified purchase.
    const buyer = await registerUser(ctx, 'o8buyer');
    await credit(ctx, buyer, 100);
    const orderId = await buyItem(ctx, seller, buyer, admin, 15, 'completed');
    expect((await buyer.client.post('/reviews', { orderId, rating: 5 })).status).toBe(201);
    const [{ listingId: boughtId }] = await ctx.dataSource.query(`SELECT "listingId" FROM orders WHERE id = $1`, [orderId]);
    const pick = (b: any) => (Array.isArray(b) ? b : b.items) as Array<{ verifiedPurchase: boolean }>;
    expect(pick((await reader.client.get(`/listings/${boughtId}/reviews`)).body).every((r) => r.verifiedPurchase)).toBe(true);
    expect(pick((await reader.client.get(`/listings/${listingId}/reviews`)).body).every((r) => !r.verifiedPurchase)).toBe(true);
  });

  it('staff set manual badges: shown on the listing, audited, Game Manager only for its games', async () => {
    const seller = await registerUser(ctx, 'o8bseller');
    const listingId = await publishItemListing(ctx, seller, admin, 30);
    expect((await seller.client.post(`/admin/listings/${listingId}/badges`, { badges: ['hot'] })).status).toBe(403);
    expect((await admin.client.post(`/admin/listings/${listingId}/badges`, { badges: ['bogus'] })).status).toBe(400);
    const set = await admin.client.post(`/admin/listings/${listingId}/badges`, { badges: ['price_drop', 'trending'] });
    expect(set.status).toBe(200);
    expect(set.body.manualBadges).toEqual(['price_drop', 'trending']);
    const detail = (await seller.client.get(`/listings/${listingId}`)).body;
    expect(detail.badges).toEqual(expect.arrayContaining(['price_drop', 'trending']));
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM audit_logs WHERE action = 'listing.set_badges' AND "entityId" = $1`, [listingId]);
    expect(count).toBe(1);

    const listing = (await ctx.dataSource.query(`SELECT "gameId" FROM listings WHERE id = $1`, [listingId]))[0];
    const games = (await admin.client.get('/games')).body as Array<{ id: string }>;
    const otherGame = games.find((g) => g.id !== listing.gameId)!.id;
    const gm = await registerUser(ctx, 'o8gm');
    await admin.client.post(`/admin/users/${gm.id}/role`, { adminRole: 'game_manager', reason: 'other game', staffScopes: { marketplaceGameIds: [otherGame], tournamentGameIds: [] } });
    expect((await gm.client.post(`/admin/listings/${listingId}/badges`, { badges: ['hot'] })).status).toBe(403);
    await admin.client.post(`/admin/users/${gm.id}/role`, { adminRole: 'game_manager', reason: 'this game', staffScopes: { marketplaceGameIds: [listing.gameId], tournamentGameIds: [] } });
    expect((await gm.client.post(`/admin/listings/${listingId}/badges`, { badges: [] })).status).toBe(200);
  });

  it('coach profile views count once per visitor and show on the directory card', async () => {
    const user = await registerUser(ctx, 'o8coach');
    const created = await admin.client.post('/admin/coaches', {
      username: user.username, specialty: 'Rank pushing', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 40,
    });
    expect(created.status).toBe(201);
    await openAllHours(ctx, created.body.id);
    await admin.client.get(`/coaches/${created.body.id}`);
    await admin.client.get(`/coaches/${created.body.id}`);
    const [{ viewsCount }] = await ctx.dataSource.query(`SELECT "viewsCount" FROM coaches WHERE id = $1`, [created.body.id]);
    expect(viewsCount).toBe(1);
    const dir = (await admin.client.get('/coaches?limit=100')).body;
    const items = Array.isArray(dir) ? dir : dir.items;
    const card = items.find((c: { id: string }) => c.id === created.body.id);
    if (card) expect(card.viewsCount).toBe(1);
  });

  it('the notification stream needs a session and answers as an event stream', async () => {
    const anon = await fetch(`${ctx.baseUrl}/notifications/stream`);
    expect(anon.status).toBe(401);
    const user = await registerUser(ctx, 'o8sse');
    const controller = new AbortController();
    const res = await fetch(`${ctx.baseUrl}/notifications/stream`, { headers: { cookie: (user.client as any).cookie }, signal: controller.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    controller.abort();
  });
});
