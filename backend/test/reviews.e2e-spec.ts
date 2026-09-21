import { assertConserved, buyItem } from './flows';
import { createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

describe('reviews (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;
  let buyerA: TestUser;
  let buyerB: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'radmin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'rseller');
    buyerA = await registerUser(ctx, 'rbuyera');
    buyerB = await registerUser(ctx, 'rbuyerb');
    outsider = await registerUser(ctx, 'rout');
    await credit(ctx, buyerA, 5000);
    await credit(ctx, buyerB, 5000);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  const body = 'Great experience overall, would buy again.';
  const sellerRating = async () => {
    const [r] = await ctx.dataSource.query(`SELECT "sellerRatingAvg" a, "sellerRatingCount" c FROM users WHERE id = $1`, [seller.id]);
    return { avg: r.a === null ? null : Number(r.a), count: Number(r.c) };
  };
  const listingRating = async (orderId: string) => {
    const [r] = await ctx.dataSource.query(
      `SELECT l."ratingAvg" a, l."ratingCount" c FROM listings l JOIN orders o ON o."listingId" = l.id WHERE o.id = $1`, [orderId],
    );
    return { avg: r.a === null ? null : Number(r.a), count: Number(r.c) };
  };

  it('only the buyer of a COMPLETED order may review, with validated input', async () => {
    const inFlight = await buyItem(ctx, seller, buyerA, admin, 20, 'delivered');
    expect((await buyerA.client.post('/reviews', { orderId: inFlight, rating: 5, body })).status).toBe(403);

    const done = await buyItem(ctx, seller, buyerA, admin, 20, 'completed');
    expect((await outsider.client.post('/reviews', { orderId: done, rating: 5, body })).status).toBe(403);
    expect((await seller.client.post('/reviews', { orderId: done, rating: 5, body })).status).toBe(403);
    expect((await buyerA.client.post('/reviews', { orderId: done, rating: 0 })).status).toBe(400);
    expect((await buyerA.client.post('/reviews', { orderId: done, rating: 6 })).status).toBe(400);
    expect((await buyerA.client.post('/reviews', { orderId: done, rating: 4, body: 'short' })).status).toBe(400);
    expect((await buyerA.client.post('/reviews', { orderId: done, rating: 4, tags: ['Not A Tag'] })).status).toBe(400);
    expect((await buyerA.client.post('/reviews', { orderId: '00000000-0000-4000-8000-000000000000', rating: 4 })).status).toBe(404);
    expect(await ctx.dataSource.query(`SELECT 1 FROM reviews WHERE "orderId" = $1`, [done])).toHaveLength(0);
  });

  it('allows one review per order (also under concurrency) and maintains rating aggregates', async () => {
    const o1 = await buyItem(ctx, seller, buyerA, admin, 20, 'completed');
    const before = await sellerRating();
    const race = await Promise.all(
      Array.from({ length: 4 }, () => buyerA.client.post('/reviews', { orderId: o1, rating: 5, body, tags: ['Fast Delivery'] })),
    );
    expect(race.filter((r) => r.status < 300)).toHaveLength(1);
    expect(race.filter((r) => r.status === 403)).toHaveLength(3);
    expect(await ctx.dataSource.query(`SELECT 1 FROM reviews WHERE "orderId" = $1`, [o1])).toHaveLength(1);
    expect((await sellerRating()).count).toBe(before.count + 1);
    expect(await listingRating(o1)).toEqual({ avg: 5, count: 1 });
    expect(JSON.stringify((await seller.client.get('/notifications')).body)).toContain('review_posted');

    // A second buyer rates the same seller lower — the seller aggregate is the mean over all.
    const o2 = await buyItem(ctx, seller, buyerB, admin, 20, 'completed');
    expect((await buyerB.client.post('/reviews', { orderId: o2, rating: 2 })).status).toBeLessThan(300);
    const s = await sellerRating();
    expect(s.count).toBe(before.count + 2);
    const [{ avg }] = await ctx.dataSource.query(`SELECT AVG(rating)::float avg FROM reviews WHERE "sellerId" = $1`, [seller.id]);
    expect(s.avg).toBeCloseTo(avg, 1);
  });

  it('a seller may reply once, and only to their own reviews', async () => {
    const o = await buyItem(ctx, seller, buyerA, admin, 20, 'completed');
    const rev = (await buyerA.client.post('/reviews', { orderId: o, rating: 4, body })).body;
    expect((await outsider.client.post(`/reviews/${rev.id}/reply`, { body: 'Thanks' })).status).toBe(403);
    expect((await buyerA.client.post(`/reviews/${rev.id}/reply`, { body: 'Thanks' })).status).toBe(403);
    expect((await seller.client.post(`/reviews/${rev.id}/reply`, { body: 'Thank you!' })).status).toBe(200);
    expect((await seller.client.post(`/reviews/${rev.id}/reply`, { body: 'Again' })).status).toBe(403);
  });

  it('moderation: hide/restore/remove adjust aggregates and follow the role matrix', async () => {
    const o = await buyItem(ctx, seller, buyerB, admin, 20, 'completed');
    const rev = (await buyerB.client.post('/reviews', { orderId: o, rating: 1, body })).body;
    const withBad = await sellerRating();

    const support = await registerUser(ctx, 'rsupport');
    await makeAdmin(ctx, support, 'support_specialist');
    const tso = await registerUser(ctx, 'rtso');
    await makeAdmin(ctx, tso, 'trust_safety_officer');
    expect((await seller.client.post(`/reviews/${rev.id}/hide`)).status).toBe(403);
    expect((await support.client.post(`/reviews/${rev.id}/hide`)).status).toBe(403);
    expect((await tso.client.post(`/reviews/${rev.id}/remove`)).status).toBe(403); // delete is Super Admin only

    expect((await tso.client.post(`/reviews/${rev.id}/hide`)).status).toBe(200);
    const hidden = await sellerRating();
    expect(hidden.count).toBe(withBad.count - 1);
    expect(hidden.avg!).toBeGreaterThan(withBad.avg!);
    const pub = await buyerA.client.get(`/listings/${(await ctx.dataSource.query(`SELECT "listingId" l FROM orders WHERE id = $1`, [o]))[0].l}/reviews`);
    expect(pub.body.map((r: any) => r.id)).not.toContain(rev.id);

    expect((await tso.client.post(`/reviews/${rev.id}/restore`)).status).toBe(200);
    expect(await sellerRating()).toEqual(withBad);
    expect((await admin.client.post(`/reviews/${rev.id}/remove`)).status).toBe(200);
    expect((await sellerRating()).count).toBe(withBad.count - 1);
    expect(await ctx.dataSource.query(`SELECT 1 FROM audit_logs WHERE action = 'review.hide'`)).not.toHaveLength(0);
  });

  it('a report cannot resurrect a hidden/deleted review, and reported reviews reach the moderation queue', async () => {
    const o = await buyItem(ctx, seller, buyerA, admin, 20, 'completed');
    const rev = (await buyerA.client.post('/reviews', { orderId: o, rating: 3, body })).body;
    await admin.client.post(`/reviews/${rev.id}/hide`);
    expect((await outsider.client.post(`/reviews/${rev.id}/report`, { reason: 'spam' })).status).toBe(200);
    const [row] = await ctx.dataSource.query(`SELECT status FROM reviews WHERE id = $1`, [rev.id]);
    expect(row.status).toBe('hidden');

    const o2 = await buyItem(ctx, seller, buyerB, admin, 20, 'completed');
    const rev2 = (await buyerB.client.post('/reviews', { orderId: o2, rating: 3, body })).body;
    await outsider.client.post(`/reviews/${rev2.id}/report`, { reason: 'fake' });
    const queue = (await admin.client.get('/reviews/reported')).body;
    expect(queue.map((r: any) => r.id)).toContain(rev2.id);
    expect((await outsider.client.get('/reviews/reported')).status).toBe(403);
  });
});
