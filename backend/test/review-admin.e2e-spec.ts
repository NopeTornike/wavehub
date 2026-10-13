import { assertConserved, buyItem, completeSession } from './flows';
import { createApp, credit, E2eApp, makeAdmin, openAllHours, registerUser, TestUser } from './helpers';

// Product reviews from the buyer's side (order page state, "waiting for your review") and staff
// review management: every role can browse, only Super Admin edits/deletes, all audit-logged.
describe('reviews: buyer state + admin editing (e2e)', () => {
  let ctx: E2eApp;
  let superAdmin: TestUser;
  let ops: TestUser;
  let support: TestUser;
  let seller: TestUser;
  let buyer: TestUser;
  let listingId: string;
  let orderId: string;

  beforeAll(async () => {
    ctx = await createApp();
    superAdmin = await registerUser(ctx, 'rasuper');
    await makeAdmin(ctx, superAdmin);
    ops = await registerUser(ctx, 'raops');
    await makeAdmin(ctx, ops, 'marketplace_coaching_ops_manager');
    support = await registerUser(ctx, 'rasupport');
    await makeAdmin(ctx, support, 'support_specialist');
    seller = await registerUser(ctx, 'raseller');
    buyer = await registerUser(ctx, 'rabuyer');
    await credit(ctx, buyer, 500);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('the order page knows whether the order was reviewed; pending lists only unreviewed completed orders', async () => {
    orderId = await buyItem(ctx, seller, buyer, superAdmin, 50, 'completed');
    listingId = (await ctx.dataSource.query(`SELECT "listingId" FROM orders WHERE id = $1`, [orderId]))[0].listingId;
    const stranger = await registerUser(ctx, 'rastranger');
    expect((await stranger.client.get(`/reviews/order/${orderId}`)).status).toBe(403);
    expect((await buyer.client.get(`/reviews/order/${orderId}`)).body).toEqual({ review: null, status: null });
    expect((await buyer.client.get('/reviews/pending')).body).toEqual([expect.objectContaining({ orderId, listingId })]);
    expect((await stranger.client.get('/reviews/pending')).body).toEqual([]);
    // The completion notification asks for a review.
    const notes = (await buyer.client.get('/notifications')).body as Array<{ type: string; title: string }>;
    expect(notes.find((n) => n.type === 'order_completed')?.title).toContain('შეაფასე');

    expect((await buyer.client.post('/reviews', { orderId, rating: 2, body: 'Took a while but arrived.' })).status).toBe(201);
    const state = (await seller.client.get(`/reviews/order/${orderId}`)).body;
    expect(state.status).toBe('published');
    expect(state.review).toMatchObject({ rating: 2, body: 'Took a while but arrived.' });
    expect(Object.keys(state.review.buyer).sort()).toEqual(['avatarUrl', 'firstName', 'id', 'lastName', 'online', 'username']);
    expect((await buyer.client.get('/reviews/pending')).body).toEqual([]);
  });

  it('staff browse every review; only Super Admin edits — aggregates follow and the change is audit-logged', async () => {
    expect((await support.client.get('/admin/reviews')).status).toBe(403);
    const list = await ops.client.get(`/admin/reviews?q=${encodeURIComponent(buyer.username)}`);
    expect(list.status).toBe(200);
    const row = list.body.items.find((r: { subjectHref: string }) => r.subjectHref === `/listings/${listingId}`);
    expect(row).toMatchObject({ kind: 'product', rating: 2, buyerUsername: buyer.username, sellerUsername: seller.username, status: 'published' });
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|email|wavecoinBalance/);

    expect((await ops.client.request('PATCH', `/admin/reviews/product/${row.id}`, { rating: 5 })).status).toBe(403);
    expect((await superAdmin.client.request('PATCH', `/admin/reviews/product/${row.id}`, {})).status).toBe(400);
    expect((await superAdmin.client.request('PATCH', `/admin/reviews/product/${row.id}`, { rating: 9 })).status).toBe(400);
    expect((await superAdmin.client.request('PATCH', `/admin/reviews/product/${row.id}`, { rating: 4, body: 'Edited by staff: profanity removed.', sellerReply: 'Thanks!' })).status).toBe(200);

    const pub = (await buyer.client.get(`/listings/${listingId}/reviews`)).body;
    expect(pub[0]).toMatchObject({ rating: 4, body: 'Edited by staff: profanity removed.', sellerReply: 'Thanks!' });
    expect(Number((await buyer.client.get(`/listings/${listingId}`)).body.ratingAvg)).toBe(4);
    const audit = await ctx.dataSource.query(`SELECT metadata FROM audit_logs WHERE action = 'review.edit' AND "entityId" = $1`, [row.id]);
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata.before).toMatchObject({ rating: 2, body: 'Took a while but arrived.' });

    // Status filter + hide via the existing moderation route.
    expect((await ops.client.post(`/reviews/${row.id}/hide`)).status).toBe(200);
    const hidden = (await ops.client.get('/admin/reviews?status=hidden')).body.items.map((r: { id: string }) => r.id);
    expect(hidden).toContain(row.id);
    expect((await buyer.client.get(`/reviews/order/${orderId}`)).body.status).toBe('hidden');
    expect((await ops.client.post(`/reviews/${row.id}/restore`)).status).toBe(200);
  });

  it('coach reviews: listed, edited and deleted by Super Admin only, with the coach rating recomputed', async () => {
    const coachUser = await registerUser(ctx, 'racoach');
    const created = await ops.client.post('/admin/coaches', { username: coachUser.username, specialty: 'Aim training', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 20 });
    const coachId = created.body.id;
    await openAllHours(ctx, coachId);
    const session = (await buyer.client.post(`/coaches/${coachId}/bookings`, { durationMinutes: 60, slots: [new Date(Date.now() + 26 * 3600_000).toISOString()], goal: 'Better aim on long range.', discord: 'ra.buyer' })).body[0];
    await completeSession(ctx, coachUser, buyer, session.id);
    expect((await buyer.client.post(`/coaching-sessions/${session.id}/review`, { rating: 1, body: 'Did not help.' })).status).toBe(201);

    const list = (await ops.client.get('/admin/reviews?kind=coach')).body;
    const row = list.items.find((r: { subjectHref: string }) => r.subjectHref === `/coaching/${coachId}`);
    expect(row).toMatchObject({ kind: 'coach', rating: 1, buyerUsername: buyer.username, sellerUsername: coachUser.username });

    expect((await ops.client.request('PATCH', `/admin/reviews/coach/${row.id}`, { rating: 3 })).status).toBe(403);
    expect((await superAdmin.client.request('PATCH', `/admin/reviews/coach/${row.id}`, { sellerReply: 'x' })).status).toBe(400);
    expect((await superAdmin.client.request('PATCH', `/admin/reviews/coach/${row.id}`, { rating: 3, body: null })).status).toBe(200);
    let coach = (await buyer.client.get(`/coaches/${coachId}`)).body;
    expect([Number(coach.ratingAvg), coach.ratingCount]).toEqual([3, 1]);
    expect((await buyer.client.get(`/coaches/${coachId}/reviews`)).body[0]).toMatchObject({ rating: 3, body: null });

    expect((await ops.client.request('DELETE', `/admin/reviews/coach/${row.id}`)).status).toBe(403);
    expect((await superAdmin.client.request('DELETE', `/admin/reviews/coach/${row.id}`)).status).toBe(200);
    coach = (await buyer.client.get(`/coaches/${coachId}`)).body;
    expect(coach.ratingCount).toBe(0);
    expect(await ctx.dataSource.query(`SELECT 1 FROM audit_logs WHERE action IN ('coach_review.edit', 'coach_review.delete') AND "entityId" = $1`, [row.id])).toHaveLength(2);
  });
});
