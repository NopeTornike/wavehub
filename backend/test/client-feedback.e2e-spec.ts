import { assertConserved, buyItem, completeSession, startSession } from './flows';
import { Client, createApp, credit, E2eApp, makeAdmin, openAllHours, registerUser, TestUser } from './helpers';

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
    expect(other).toMatchObject({ username: seller.username, firstName: 'Test', lastName: 'User', staff: false });
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

  // --- Client round 2026-10-07 ---

  it('a delivered order auto-completes 24h after delivery, and the buyer is told so', async () => {
    const orderId = await buyItem(ctx, seller, buyer, superAdmin, 9, 'delivered');
    const order = (await buyer.client.get(`/orders/${orderId}`)).body;
    expect(new Date(order.autoCompleteAt).getTime() - new Date(order.deliveredAt).getTime()).toBe(24 * 3600_000);
    const notes = (await buyer.client.get('/notifications')).body as Array<{ type: string; body: string; metadata?: { orderId?: string } }>;
    const delivered = notes.find((n) => n.type === 'order_delivered' && n.metadata?.orderId === orderId);
    expect(delivered?.body).toContain('24 საათის განმავლობაში');
  });

  it('banners carry a placement: validated, filtered publicly, audited', async () => {
    expect((await superAdmin.client.post('/admin/banners', { placement: 'nowhere', title: 'Bad spot' })).status).toBe(400);
    const b = (await superAdmin.client.post('/admin/banners', { placement: 'marketplace_top', title: 'Marketplace week' })).body;
    expect(b.placement).toBe('marketplace_top');
    expect((await superAdmin.client.upload(`/admin/banners/${b.id}/image`, PNG, 'b.png', 'image/png')).status).toBe(200);
    expect((await superAdmin.client.request('PATCH', `/admin/banners/${b.id}`, { active: true })).status).toBe(200);
    const anon = new Client(ctx.baseUrl);
    const ids = async (q: string) => ((await anon.get(`/banners${q}`)).body as Array<{ id: string }>).map((x) => x.id);
    expect(await ids('?placement=marketplace_top')).toContain(b.id);
    expect(await ids('?placement=home_strip')).not.toContain(b.id);
    expect((await anon.get('/banners?placement=nowhere')).status).toBe(400);
    const moved = await superAdmin.client.request('PATCH', `/admin/banners/${b.id}`, { placement: 'home_hero' });
    expect(moved.body.placement).toBe('home_hero');
    expect(await ids('?placement=home_hero')).toContain(b.id);
    expect((await superAdmin.client.request('DELETE', `/admin/banners/${b.id}`)).status).toBe(200);
  });

  it('profile and coach reviews name the reviewer (full name + photo), nothing private', async () => {
    const pub = (await stranger.client.get(`/users/${seller.username}`)).body;
    const latest = pub.reviews.latest[0];
    expect(latest).toMatchObject({ buyerUsername: buyer.username, buyerFirstName: 'Test', buyerLastName: 'User' });
    expect(latest).toHaveProperty('buyerAvatarUrl');
    expect(JSON.stringify(pub.reviews)).not.toMatch(/email|passwordHash|wavecoinBalance/);
  });

  it('editing a plan badge text applies to live subscribers at once', async () => {
    const plan = (await superAdmin.client.post('/admin/subscription-plans', {
      audience: 'seller_coach', tier: 'cfedit', name: 'CF Editable', description: 'A plan whose badge gets corrected.', priceGel: 5, billingPeriodDays: 30, perks: { profileBadge: 'Typo' },
    })).body;
    const member = await registerUser(ctx, 'cfmember');
    expect((await superAdmin.client.post('/admin/subscriptions/grant', { userId: member.id, planId: plan.id, reason: 'badge edit test' })).status).toBeLessThan(300);
    expect((await stranger.client.get(`/users/${member.username}`)).body.profileBadge).toBe('Typo');
    expect((await ops.client.post(`/admin/subscription-plans/${plan.id}`, { perks: { profileBadge: 'Pro' } })).status).toBe(403);
    expect((await superAdmin.client.post(`/admin/subscription-plans/${plan.id}`, { perks: { profileBadge: 'Pro' } })).status).toBeLessThan(300);
    expect((await stranger.client.get(`/users/${member.username}`)).body.profileBadge).toBe('Pro');
  });

  it('auto-accept windows are staff-set: public timings, validation, and new deadlines follow them', async () => {
    const anon = new Client(ctx.baseUrl);
    expect((await anon.get('/platform/timings')).body).toEqual({ orderAutoCompleteHours: 24, sessionAutoConfirmHours: 48 });

    const set = (who: TestUser, body: Record<string, number>) => who.client.post('/admin/platform-settings', body);
    expect((await set(ops, { orderAutoCompleteHours: 6 })).status).toBe(403);
    expect((await set(superAdmin, { orderAutoCompleteHours: 0 })).status).toBe(400);
    expect((await set(superAdmin, { sessionAutoConfirmHours: 721 })).status).toBe(400);
    expect((await set(superAdmin, { orderAutoCompleteHours: 6, sessionAutoConfirmHours: 12 })).status).toBe(200);
    expect((await anon.get('/platform/timings')).body).toEqual({ orderAutoCompleteHours: 6, sessionAutoConfirmHours: 12 });

    // An order delivered now gets the 6h window and the buyer is told so.
    const orderId = await buyItem(ctx, seller, buyer, superAdmin, 7, 'delivered');
    const order = (await buyer.client.get(`/orders/${orderId}`)).body;
    expect(new Date(order.autoCompleteAt).getTime() - new Date(order.deliveredAt).getTime()).toBe(6 * 3600_000);
    const notes = (await buyer.client.get('/notifications')).body as Array<{ type: string; body: string; metadata?: { orderId?: string } }>;
    expect(notes.find((n) => n.type === 'order_delivered' && n.metadata?.orderId === orderId)?.body).toContain('6 საათის');

    // A session the coach marks done now gets the 12h window, stored on the session.
    const coachUser = await registerUser(ctx, 'cftimer');
    const coachId = (await coachUser.client.post('/coaches/apply', { specialty: 'Timing', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 60 })).body.id;
    await openAllHours(ctx, coachId);
    await superAdmin.client.post(`/coaches/${coachId}/approve`);
    const sess = (await buyer.client.post(`/coaches/${coachId}/sessions`, { scheduledAt: new Date(Date.now() + 40 * 3600_000).toISOString(), durationMinutes: 60 })).body;
    await startSession(ctx, coachUser, buyer, sess.id);
    const done = (await coachUser.client.post(`/coaching-sessions/${sess.id}/complete`)).body;
    expect(new Date(done.autoConfirmAt).getTime() - new Date(done.coachCompletedAt).getTime()).toBe(12 * 3600_000);

    // Changing the setting doesn't move deadlines already set.
    expect((await set(superAdmin, { orderAutoCompleteHours: 24, sessionAutoConfirmHours: 48 })).status).toBe(200);
    expect((await buyer.client.get(`/orders/${orderId}`)).body.autoCompleteAt).toBe(order.autoCompleteAt);
    expect((await buyer.client.get(`/coaching-sessions/${sess.id}`)).body.autoConfirmAt).toBe(done.autoConfirmAt);
    await buyer.client.post(`/coaching-sessions/${sess.id}/confirm-complete`);
  });

  it('Admin → Steam: any Steam publisher sees and manages every Steam game; publish needs stock; audited', async () => {
    const steamCat = (await superAdmin.client.get('/categories')).body.find((c: { slug: string }) => c.slug === 'steam-games').id;
    const created = await superAdmin.client.post('/listings', {
      type: 'digital_key', categoryId: steamCat, title: 'Admin Steam Catalogue Game', description: 'Steam activation key with confirmed resale rights, described in detail.',
      priceWaveCoin: 12, resaleRightsAttested: true,
    });
    expect(created.status).toBe(201);
    const id = created.body.id;

    expect((await stranger.client.get('/admin/steam-games')).status).toBe(403);
    expect((await support.client.get('/admin/steam-games')).status).toBe(403);
    // Another publisher (not the creator) sees it in the catalogue with its stock.
    const row = ((await ops.client.get('/admin/steam-games')).body as Array<{ id: string; availableKeys: number; status: string; createdByUsername: string }>).find((g) => g.id === id);
    expect(row).toMatchObject({ availableKeys: 0, status: 'draft', createdByUsername: superAdmin.username });
    expect(JSON.stringify(row)).not.toMatch(/email|passwordHash|wavecoinBalance/);

    expect((await ops.client.post(`/admin/steam-games/${id}/publish`)).status).toBe(409); // no keys yet
    expect((await ops.client.post(`/admin/listings/${id}/keys`, { keys: ['ADM-STEAM-0001', 'ADM-STEAM-0002'] })).status).toBeLessThan(300);
    const published = await ops.client.post(`/admin/steam-games/${id}/publish`);
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('active');
    expect((await stranger.client.get(`/listings/${id}`)).status).toBe(200);

    const edited = await ops.client.request('PATCH', `/admin/steam-games/${id}`, { title: 'Admin Steam Catalogue Game v2', priceWaveCoin: 14 });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ title: 'Admin Steam Catalogue Game v2', priceWaveCoin: 14, status: 'active' }); // staff edit: no re-review
    expect((await ops.client.post(`/admin/steam-games/${id}/pause`)).body.status).toBe('paused');
    expect((await stranger.client.get(`/listings/${id}`)).status).toBe(404);
    expect((await ops.client.post(`/admin/steam-games/${id}/pause`)).status).toBe(409);

    // Non-Steam listings are out of reach of these routes.
    const itemOrder = await buyItem(ctx, seller, buyer, superAdmin, 5, 'paid');
    const itemListing = (await buyer.client.get(`/orders/${itemOrder}`)).body.listing.id;
    expect((await ops.client.get(`/admin/steam-games/${itemListing}`)).status).toBe(404);
    expect((await ops.client.post(`/admin/steam-games/${itemListing}/publish`)).status).toBe(404);
    await buyer.client.post(`/orders/${itemOrder}/cancel`);

    const actions = (await ctx.dataSource.query(`SELECT action FROM audit_logs WHERE "entityId" = $1 ORDER BY "createdAt"`, [id])).map((r: { action: string }) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['listing.keys_add', 'steam.publish', 'steam.update', 'steam.pause']));
  });
});
