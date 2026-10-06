import { assertConserved, buyItem, completeSession } from './flows';
import { createApp, credit, E2eApp, makeAdmin, openAllHours, registerUser, TestUser } from './helpers';

// Client feedback batch (2026-10-04): badges (auto, staff, coach-granted), review likes, follow
// lists, featured coaches, separate coaching fee, staff Steam key stocking, tournament Discord,
// order-chat attachments and full names in conversations.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5a3a2e50000000049454e44ae426082', 'hex');

describe('client feedback batch (e2e)', () => {
  let ctx: E2eApp;
  let superAdmin: TestUser;
  let ops: TestUser;
  let support: TestUser;
  let seller: TestUser;
  let buyer: TestUser;
  let stranger: TestUser;
  const audits = async (action: string, id: string) =>
    Number((await ctx.dataSource.query(`SELECT count(*)::int n FROM audit_logs WHERE action = $1 AND "entityId" = $2`, [action, id]))[0].n);
  const badgesOf = async (u: TestUser) => ((await stranger.client.get(`/users/${u.username}`)).body.badges as Array<{ key: string }>).map((b) => b.key);

  beforeAll(async () => {
    ctx = await createApp();
    superAdmin = await registerUser(ctx, 'cfsuper');
    await makeAdmin(ctx, superAdmin);
    ops = await registerUser(ctx, 'cfops');
    await makeAdmin(ctx, ops, 'marketplace_coaching_ops_manager');
    support = await registerUser(ctx, 'cfsupport');
    await makeAdmin(ctx, support, 'support_specialist');
    seller = await registerUser(ctx, 'cfseller');
    buyer = await registerUser(ctx, 'cfbuyer');
    stranger = await registerUser(ctx, 'cfstranger');
    await credit(ctx, buyer, 2000);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('badges: first completed order is automatic; staff grants follow the per-badge role rules; all audited', async () => {
    const orderId = await buyItem(ctx, seller, buyer, superAdmin, 20, 'completed');
    expect(orderId).toBeTruthy();
    expect(await badgesOf(buyer)).toContain('first-order');
    expect(await badgesOf(seller)).toContain('first-order');

    const grant = (who: TestUser, key: string) => who.client.post(`/admin/users/${seller.id}/badges`, { badgeKey: key });
    expect((await grant(seller, 'official-seller')).status).toBe(403); // not staff
    expect((await grant(support, 'official-seller')).status).toBe(403); // staff, but not a badge role
    expect((await grant(ops, 'nonsense')).status).toBe(400);
    expect((await grant(ops, 'chosen')).status).toBe(403); // Super Admin only
    expect((await grant(ops, 'first-order')).status).toBe(400); // automatic
    expect((await grant(ops, 'official-seller')).status).toBe(200);
    expect((await grant(ops, 'official-seller')).status).toBe(409);
    expect((await grant(superAdmin, 'chosen')).status).toBe(200);
    expect(await badgesOf(seller)).toEqual(expect.arrayContaining(['official-seller', 'chosen']));
    expect(await audits('badge.grant', seller.id)).toBe(2);
    const notes = (await seller.client.get('/notifications')).body as Array<{ type: string }>;
    expect(notes.filter((n) => n.type === 'badge_granted').length).toBeGreaterThanOrEqual(3);

    // Revoking: staff can't take an automatic badge; Super Admin can.
    expect((await ops.client.del(`/admin/users/${seller.id}/badges/first-order`)).status).toBe(400);
    expect((await ops.client.del(`/admin/users/${seller.id}/badges/chosen`)).status).toBe(403);
    expect((await ops.client.del(`/admin/users/${seller.id}/badges/official-seller`)).status).toBe(200);
    expect((await ops.client.del(`/admin/users/${seller.id}/badges/official-seller`)).status).toBe(404);
    expect((await superAdmin.client.del(`/admin/users/${seller.id}/badges/first-order`)).status).toBe(200);
    expect(await badgesOf(seller)).toEqual(['chosen']);
    expect(await audits('badge.revoke', seller.id)).toBe(2);
    expect((await stranger.client.get(`/admin/users/${seller.id}/badges`)).status).toBe(403);
  });

  it('coaches: verified badge, own-student badges only after a completed session, featured flag, separate fee', async () => {
    const coachUser = await registerUser(ctx, 'cfcoach');
    const applied = await coachUser.client.post('/coaches/apply', {
      specialty: 'Rank pushing', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 100,
    });
    expect(applied.status).toBeLessThan(300);
    const coachId = applied.body.id;
    await openAllHours(ctx, coachId);
    expect((await superAdmin.client.post(`/coaches/${coachId}/approve`)).status).toBe(200);
    expect(await badgesOf(coachUser)).toContain('verified');

    // The coaching fee is its own setting; the marketplace fee is untouched by it.
    expect((await superAdmin.client.post('/admin/platform-settings', { coachingFeePercent: 101 })).status).toBe(400);
    expect((await superAdmin.client.post('/admin/platform-settings', { coachingFeePercent: 20 })).status).toBeLessThan(300);
    const settings = (await superAdmin.client.get('/admin/platform-settings')).body;
    expect([settings.platformFeePercent, settings.coachingFeePercent]).toEqual([10, 20]);
    const booked = await buyer.client.post(`/coaches/${coachId}/sessions`, { scheduledAt: new Date(Date.now() + 30 * 3600_000).toISOString(), durationMinutes: 60 });
    expect(booked.status).toBeLessThan(300);
    const row = (await ctx.dataSource.query(`SELECT * FROM coaching_sessions WHERE id = $1`, [booked.body.id]))[0];
    expect([row.platformFeePercentSnapshot, Number(row.coachPayoutWaveCoin)]).toEqual([20, 80]);
    await superAdmin.client.post('/admin/platform-settings', { coachingFeePercent: 10 });

    // Student badges: not before a completed session, only coach badges, one "chosen" per coach.
    const grant = (key: string, student = buyer) => coachUser.client.post(`/coaches/mine/students/${student.id}/badges`, { badgeKey: key });
    expect((await grant('strongest-student')).status).toBe(403);
    await completeSession(ctx, coachUser, buyer, booked.body.id);
    const students = (await coachUser.client.get('/coaches/mine/students')).body;
    expect(students.map((s: { userId: string }) => s.userId)).toEqual([buyer.id]);
    expect(JSON.stringify(students)).not.toMatch(/email|passwordHash|wavecoinBalance/);
    expect((await grant('official-seller')).status).toBe(400);
    expect((await grant('strongest-student', stranger)).status).toBe(403);
    expect((await stranger.client.post(`/coaches/mine/students/${buyer.id}/badges`, { badgeKey: 'strongest-student' })).status).toBe(403);
    expect((await grant('strongest-student')).status).toBe(200);
    expect((await grant('strongest-student')).status).toBe(409);
    expect(await badgesOf(buyer)).toContain('strongest-student');
    expect((await coachUser.client.del(`/coaches/mine/students/${buyer.id}/badges/strongest-student`)).status).toBe(200);
    expect(await badgesOf(buyer)).not.toContain('strongest-student');
    expect(await audits('badge.revoke', buyer.id)).toBe(1);

    // Featured: staff-only, audited, and the home filter returns only featured coaches.
    expect((await stranger.client.post(`/admin/coaches/${coachId}/featured`, { isFeatured: true })).status).toBe(403);
    expect((await ops.client.post(`/admin/coaches/${coachId}/featured`, { isFeatured: 'yes' })).status).toBe(400);
    expect((await ops.client.post(`/admin/coaches/${coachId}/featured`, { isFeatured: true })).status).toBe(200);
    const featured = (await stranger.client.get('/coaches?featured=true&limit=50')).body;
    const items = (featured.items ?? featured) as Array<{ id: string; isFeatured?: boolean }>;
    expect(items.map((c) => c.id)).toContain(coachId);
    expect(await audits('coach.feature', coachId)).toBe(1);
    expect((await ops.client.post(`/admin/coaches/${coachId}/featured`, { isFeatured: false })).status).toBe(200);
    const after = (await stranger.client.get('/coaches?featured=true&limit=50')).body;
    expect(((after.items ?? after) as Array<{ id: string }>).map((c) => c.id)).not.toContain(coachId);
  });

  it('review likes: idempotent per user, counted publicly, own likes listed; follow lists', async () => {
    const orderId = await buyItem(ctx, seller, buyer, superAdmin, 15, 'completed');
    const listingId = (await buyer.client.get(`/orders/${orderId}`)).body.listing.id;
    const review = await buyer.client.post('/reviews', { orderId, rating: 5, body: 'Fast and exactly as described.' });
    expect(review.status).toBeLessThan(300);
    const reviewId = review.body.id;

    expect((await stranger.client.post(`/reviews/${reviewId}/like`, { target: 'review', liked: true })).body).toMatchObject({ liked: true, count: 1 });
    expect((await stranger.client.post(`/reviews/${reviewId}/like`, { target: 'review', liked: true })).body).toMatchObject({ count: 1 });
    expect((await stranger.client.post(`/reviews/${reviewId}/like`, { target: 'reply', liked: true })).status).toBe(404); // no reply yet
    expect((await stranger.client.post(`/reviews/${reviewId}/like`, { target: 'other', liked: true })).status).toBe(400);
    expect((await seller.client.post(`/reviews/${reviewId}/reply`, { body: 'Thanks for buying!' })).status).toBeLessThan(300);
    expect((await stranger.client.post(`/reviews/${reviewId}/like`, { target: 'reply', liked: true })).body).toMatchObject({ count: 1 });

    const list = (await new (stranger.client.constructor as any)(ctx.baseUrl).get(`/listings/${listingId}/reviews`)).body;
    const pub = (list.items ?? list).find((r: { id: string }) => r.id === reviewId);
    expect(pub).toMatchObject({ likeCount: 1, replyLikeCount: 1 });
    expect(pub.buyer).toMatchObject({ id: buyer.id, firstName: 'Test', lastName: 'User' });
    expect(JSON.stringify(pub)).not.toMatch(/email|passwordHash|wavecoinBalance/);
    expect((await stranger.client.get(`/me/review-likes?listingId=${listingId}`)).body).toEqual({ review: [reviewId], reply: [reviewId] });
    expect((await stranger.client.post(`/reviews/${reviewId}/like`, { target: 'review', liked: false })).body).toMatchObject({ liked: false, count: 0 });

    // Follow lists: who I follow / who follows me, unfollow removes the row.
    expect((await stranger.client.post(`/users/${seller.username}/follow`)).status).toBeLessThan(300);
    const following = (await stranger.client.get('/me/following')).body as Array<{ username: string }>;
    expect(following.map((f) => f.username)).toEqual([seller.username]);
    const followers = (await seller.client.get('/me/followers')).body as Array<{ username: string }>;
    expect(followers.map((f) => f.username)).toContain(stranger.username);
    expect(JSON.stringify(followers)).not.toMatch(/email|passwordHash|wavecoinBalance/);
    await stranger.client.del(`/users/${seller.username}/follow`);
    expect((await stranger.client.get('/me/following')).body).toEqual([]);
  });

  it('order chat: photo attachments for participants only, content-sniffed; names in conversations', async () => {
    const orderId = await buyItem(ctx, seller, buyer, superAdmin, 12, 'in_progress');
    expect((await stranger.client.upload(`/orders/${orderId}/messages/attachment`, PNG, 'x.png', 'image/png')).status).toBe(403);
    expect((await buyer.client.upload(`/orders/${orderId}/messages/attachment`, Buffer.from('<html><script>alert(1)</script></html>'), 'x.png', 'image/png')).status).toBe(415);
    const sent = await buyer.client.upload(`/orders/${orderId}/messages/attachment`, PNG, 'proof.png', 'image/png');
    expect(sent.status).toBeLessThan(300);
    const messages = (await seller.client.get(`/orders/${orderId}/messages`)).body as Array<{ type: string; body: string }>;
    const image = messages.find((m) => m.type === 'image');
    expect(image).toBeTruthy();
    expect(image!.body).toMatch(/\/uploads\/[0-9a-f-]{36}\.png$/);

    const conv = await buyer.client.post('/direct-messages/start', { recipientUserId: seller.id });
    expect(conv.status).toBeLessThan(300);
    const mine = (await buyer.client.get('/direct-messages')).body as Array<{ otherUser: Record<string, unknown> }>;
    const other = mine.find((c) => c.otherUser.id === seller.id)!.otherUser;
    expect(other).toMatchObject({ username: seller.username, firstName: 'Test', lastName: 'User' });
    expect(Object.keys(other)).not.toEqual(expect.arrayContaining(['email']));
  });

  it('Steam keys: any Steam publisher stocks a game in bulk; keys never come back; non-staff refused', async () => {
    const steamCat = (await ops.client.get('/categories')).body.find((c: { slug: string }) => c.slug === 'steam-games').id;
    const created = await ops.client.post('/listings', {
      type: 'digital_key', categoryId: steamCat, title: 'Feedback Steam Game', description: 'Steam activation key with confirmed resale rights, described in detail.',
      priceWaveCoin: 20, resaleRightsAttested: true,
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    const other = await registerUser(ctx, 'cfpublisher');
    await makeAdmin(ctx, other, 'marketplace_coaching_ops_manager');
    expect((await stranger.client.post(`/admin/listings/${id}/keys`, { keys: ['AAAA-1'] })).status).toBe(403);
    const added = await other.client.post(`/admin/listings/${id}/keys`, { keys: ['FB-KEY-0001', 'FB-KEY-0002', 'FB-KEY-0003'] });
    expect(added.status).toBeLessThan(300);
    expect(added.body.added).toBe(3);
    const inventory = await other.client.get(`/admin/listings/${id}/keys`);
    expect(inventory.status).toBe(200);
    expect(JSON.stringify(inventory.body)).not.toContain('FB-KEY-');
    expect(inventory.body.length ?? inventory.body.items?.length).toBe(3);
    const audit = await ctx.dataSource.query(`SELECT metadata FROM audit_logs WHERE action = 'listing.keys_add' AND "entityId" = $1`, [id]);
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0].metadata)).not.toContain('FB-KEY-');
  });

  it('tournaments: Discord is required, visible to the own team and staff only', async () => {
    const gameId = (await superAdmin.client.get('/games')).body[0].id;
    const startDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const t = await superAdmin.client.post('/admin/tournaments', {
      gameId, name: `Feedback Cup ${Date.now() % 100000}`, description: 'A solo e2e tournament for the feedback batch.',
      prize: '100 GEL', status: 'open', startDate, maxPlayers: 8, teamSize: 1,
    });
    expect(t.status).toBeLessThan(300);
    const id = t.body.id;
    const solo = { inGameName: 'Player', inGameId: '51234567' };
    expect((await buyer.client.post(`/tournaments/${id}/register`, solo)).status).toBe(400);
    expect((await buyer.client.post(`/tournaments/${id}/register`, { ...solo, discord: 'has spaces and !!' })).status).toBe(400);
    expect((await buyer.client.post(`/tournaments/${id}/register`, { ...solo, discord: 'wave_player' })).status).toBeLessThan(300);

    expect(JSON.stringify((await stranger.client.get(`/tournaments/${id}/teams`)).body)).not.toContain('wave_player');
    const mine = (await buyer.client.get('/me/tournaments')).body as Array<{ tournament: { id: string }; team: { discord?: string } }>;
    expect(mine.find((e) => e.tournament.id === id)!.team.discord).toBe('wave_player');
    expect(JSON.stringify((await superAdmin.client.get(`/admin/tournaments/${id}/teams`)).body)).toContain('wave_player');
  });
});
