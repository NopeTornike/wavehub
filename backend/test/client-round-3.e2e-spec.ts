import { assertConserved, buyItem, completeSession } from './flows';
import { createApp, credit, E2eApp, makeAdmin, openAllHours, publishItemListing, registerUser, TestUser } from './helpers';

// Owner round 2026-10-15: profile titles, coach removal + home order, admin registration counts,
// email login + "remember me", real wallet numbers, services off the marketplace counts, and the
// duplicate-post check ignoring extra spaces.
describe('client round 3 (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  const at = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();
  const step3 = { goal: 'Reach Conqueror and fix my close-range fights.', discord: 'gio.wavehub' };

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'r3admin');
    await makeAdmin(ctx, admin);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  async function makeCoach(prefix: string) {
    const user = await registerUser(ctx, prefix);
    const created = await admin.client.post('/admin/coaches', {
      username: user.username, specialty: 'Rank pushing', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 40,
    });
    expect(created.status).toBe(201);
    await openAllHours(ctx, created.body.id);
    return { user, coachId: created.body.id as string };
  }

  it('profile title: open titles for anyone, Seller / Coach only while true, staff override locks it', async () => {
    const user = await registerUser(ctx, 'r3title');
    const mine = (await user.client.get('/me/profile')).body;
    expect(mine).toMatchObject({ profileTitle: null, profileTitleByStaff: false });
    expect(mine.availableTitles).toEqual(expect.arrayContaining(['player', 'streamer']));
    expect(mine.availableTitles).not.toContain('seller');
    expect(mine.availableTitles).not.toContain('coach');

    expect((await user.client.patch('/me/profile', { profileTitle: 'seller' })).status).toBe(400);
    expect((await user.client.patch('/me/profile', { profileTitle: 'king' })).status).toBe(400);
    expect((await user.client.patch('/me/profile', { profileTitle: 'streamer' })).status).toBe(200);
    expect((await admin.client.get(`/users/${user.username}`)).body.title).toBe('streamer');

    // A reviewed listing makes Seller available.
    await publishItemListing(ctx, user, admin, 10);
    expect((await user.client.get('/me/profile')).body.availableTitles).toContain('seller');
    expect((await user.client.patch('/me/profile', { profileTitle: 'seller' })).status).toBe(200);
    // Back to automatic.
    expect((await user.client.patch('/me/profile', { profileTitle: null })).status).toBe(200);
    expect((await admin.client.get(`/users/${user.username}`)).body.title).toBe('seller');

    // Staff set any title; the user can't change it; null hands it back. Audited.
    const support = await registerUser(ctx, 'r3support');
    await makeAdmin(ctx, support, 'support_specialist');
    expect((await support.client.post(`/admin/users/${user.id}/profile-title`, { title: 'coach' })).status).toBe(403);
    expect((await admin.client.post(`/admin/users/${user.id}/profile-title`, { title: 'nope' })).status).toBe(400);
    expect((await admin.client.post(`/admin/users/${user.id}/profile-title`, {})).status).toBe(400);
    const set = await admin.client.post(`/admin/users/${user.id}/profile-title`, { title: 'pro_player' });
    expect(set.body).toMatchObject({ profileTitle: 'pro_player', profileTitleByStaff: true });
    expect((await admin.client.get(`/users/${user.username}`)).body.title).toBe('pro_player');
    expect((await user.client.patch('/me/profile', { profileTitle: 'player' })).status).toBe(403);
    expect((await user.client.patch('/me/profile', { bio: 'Still editable' })).status).toBe(200);
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM audit_logs WHERE action = 'user.set_profile_title' AND "entityId" = $1`, [user.id]);
    expect(count).toBe(1);
    expect((await admin.client.post(`/admin/users/${user.id}/profile-title`, { title: null })).body.profileTitleByStaff).toBe(false);
    expect((await user.client.patch('/me/profile', { profileTitle: 'player' })).status).toBe(200);
  });

  it('coach removal: history kept, profile hidden, Coach title gone; open sessions block it; no history = deleted', async () => {
    const buyer = await registerUser(ctx, 'r3buyer');
    await credit(ctx, buyer, 500);
    const { user: coachUser, coachId } = await makeCoach('r3coach');
    expect((await admin.client.get(`/users/${coachUser.username}`)).body).toMatchObject({ role: 'coach', title: 'coach' });

    const booked = await buyer.client.post(`/coaches/${coachId}/bookings`, { durationMinutes: 60, slots: [at(30)], ...step3 });
    expect(booked.status).toBe(201);
    const sessionId = booked.body[0].id;
    // An open session blocks the removal.
    expect((await admin.client.request('DELETE', `/admin/coaches/${coachId}`)).status).toBe(409);
    await completeSession(ctx, coachUser, buyer, sessionId);

    // Only a Super Admin removes.
    const ops = await registerUser(ctx, 'r3ops');
    await makeAdmin(ctx, ops, 'marketplace_coaching_ops_manager');
    expect((await ops.client.request('DELETE', `/admin/coaches/${coachId}`)).status).toBe(403);

    const removed = await admin.client.request('DELETE', `/admin/coaches/${coachId}`);
    expect(removed.body).toEqual({ ok: true, outcome: 'removed' });
    expect((await buyer.client.get(`/coaches/${coachId}`)).status).toBe(404);
    expect((await buyer.client.get('/coaches?limit=100')).body.items.map((c: { id: string }) => c.id)).not.toContain(coachId);
    expect((await admin.client.get('/coaches/all')).body.map((c: { id: string }) => c.id)).not.toContain(coachId);
    const profile = (await admin.client.get(`/users/${coachUser.username}`)).body;
    expect(profile.role).not.toBe('coach');
    expect(profile.title).not.toBe('coach');
    expect(profile.coachId).toBeNull();
    expect((await coachUser.client.get('/me/profile')).body.availableTitles).not.toContain('coach');
    // The session and its money stay.
    expect((await buyer.client.get(`/coaching-sessions/${sessionId}`)).body.status).toBe('completed');
    expect((await admin.client.request('DELETE', `/admin/coaches/${coachId}`)).status).toBe(404);
    const [{ action }] = await ctx.dataSource.query(`SELECT action FROM audit_logs WHERE "entityId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [coachId]);
    expect(action).toBe('coach.remove');

    // Staff can add them back (same row, verified again).
    const again = await admin.client.post('/admin/coaches', {
      username: coachUser.username, specialty: 'Back again', bio: 'Returning coach with the same long experience as before.', hourlyRateWaveCoin: 30,
    });
    expect(again.status).toBe(201);
    expect(again.body.id).toBe(coachId);
    expect(again.body.removedAt).toBeNull();
    expect((await buyer.client.get(`/coaches/${coachId}`)).status).toBe(200);

    // A coach who never had a session is deleted outright.
    const { coachId: freshId } = await makeCoach('r3fresh');
    expect((await admin.client.request('DELETE', `/admin/coaches/${freshId}`)).body).toEqual({ ok: true, outcome: 'deleted' });
  });

  it('home coach order: staff set it for featured coaches; the public list follows it', async () => {
    const a = await makeCoach('r3ordera');
    const b = await makeCoach('r3orderb');
    const c = await makeCoach('r3orderc');
    for (const coach of [a, b, c]) {
      expect((await admin.client.post(`/admin/coaches/${coach.coachId}/featured`, { isFeatured: true })).status).toBe(200);
    }
    const plain = await registerUser(ctx, 'r3plain');
    expect((await plain.client.post('/admin/coach-home-order', { ids: [c.coachId, a.coachId, b.coachId] })).status).toBe(403);
    const set = await admin.client.post('/admin/coach-home-order', { ids: [c.coachId, a.coachId, b.coachId] });
    expect(set.status).toBe(200);
    const featured = (await plain.client.get('/coaches?featured=true&limit=50')).body.items.map((x: { id: string }) => x.id);
    const mineOnly = featured.filter((id: string) => [a.coachId, b.coachId, c.coachId].includes(id));
    expect(mineOnly).toEqual([c.coachId, a.coachId, b.coachId]);
    // Not-featured ids and duplicates are refused.
    const d = await makeCoach('r3orderd');
    expect((await admin.client.post('/admin/coach-home-order', { ids: [d.coachId] })).status).toBe(400);
    expect((await admin.client.post('/admin/coach-home-order', { ids: [a.coachId, a.coachId] })).status).toBe(400);
    // Un-featuring clears the position.
    await admin.client.post(`/admin/coaches/${c.coachId}/featured`, { isFeatured: false });
    const [{ homeOrder }] = await ctx.dataSource.query(`SELECT "homeOrder" FROM coaches WHERE id = $1`, [c.coachId]);
    expect(homeOrder).toBeNull();
  });

  it('admin dashboard registration counts: any staff role, counts only', async () => {
    const plain = await registerUser(ctx, 'r3reg');
    expect((await plain.client.get('/admin/users/registration-stats')).status).toBe(403);
    const support = await registerUser(ctx, 'r3regsupport');
    await makeAdmin(ctx, support, 'support_specialist');
    const before = (await support.client.get('/admin/users/registration-stats')).body;
    expect(Object.keys(before).sort()).toEqual(['last7Days', 'today', 'total', 'verified']);
    await registerUser(ctx, 'r3regnew');
    const after = (await support.client.get('/admin/users/registration-stats')).body;
    expect(after.total).toBe(before.total + 1);
    expect(after.today).toBe(before.today + 1);
    expect(after.verified).toBe(before.verified + 1);
  });

  it('login with the email too; "remember me" off = a browser-session cookie', async () => {
    const user = await registerUser(ctx, 'r3login');
    const login = (body: Record<string, unknown>) =>
      fetch(`${ctx.baseUrl}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.250.3.1' }, body: JSON.stringify(body) });
    const byEmail = await login({ username: `${user.username.toUpperCase()}@EXAMPLE.COM`, password: 'E2ePassw0rd!' });
    expect(byEmail.status).toBe(200);
    expect(byEmail.headers.getSetCookie().join(';')).toMatch(/Max-Age=604800/);
    const session = await login({ username: user.username, password: 'E2ePassw0rd!', remember: false });
    expect(session.status).toBe(200);
    const cookie = session.headers.getSetCookie().join(';');
    expect(cookie).toContain('wavehub_session=');
    expect(cookie).not.toMatch(/Max-Age|Expires/i);
    // Unknown email and wrong password answer the same.
    const unknown = await login({ username: 'nobody-here@example.com', password: 'E2ePassw0rd!' });
    const wrong = await login({ username: `${user.username}@example.com`, password: 'wrong-password-1' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await unknown.text()).toBe(await wrong.text());
    expect((await login({ username: user.username, password: 'E2ePassw0rd!', remember: 'yes' })).status).toBe(400);
  });

  it('wallet cards are real: escrow includes the buyer fee of open orders; deposits count every top-up', async () => {
    await ctx.dataSource.query(`UPDATE platform_settings SET "platformFeePercent" = 10`);
    const seller = await registerUser(ctx, 'r3wseller');
    const buyer = await registerUser(ctx, 'r3wbuyer');
    await credit(ctx, buyer, 100);
    await credit(ctx, buyer, 25);
    const before = (await buyer.client.get('/wallet/balance')).body;
    expect(before).toMatchObject({ inEscrow: 0, totalToppedUp: 125 });
    await buyItem(ctx, seller, buyer, admin, 20, 'paid');
    const held = (await buyer.client.get('/wallet/balance')).body;
    expect(held.inEscrow).toBe(22);
    expect(held.totalToppedUp).toBe(125);
    expect(held.walletBalance).toBe(103);
  });

  it('home game counts are marketplace products only (no services, no keys)', async () => {
    const seller = await registerUser(ctx, 'r3count');
    const games = (await seller.client.get('/games')).body;
    const game = games[0];
    const count = async () => ((await seller.client.get('/stats/games')).body.find((g: { slug: string }) => g.slug === game.slug)?.activeListingCount ?? 0) as number;
    const before = await count();
    // A live service listing for that game doesn't count.
    const cats = (await seller.client.get('/categories')).body;
    const serviceCat = cats.find((c: { type: string }) => c.type === 'service' || c.type === 'both');
    const svc = await seller.client.post('/listings', {
      type: 'service', categoryId: serviceCat.id, gameId: game.id, title: `Round three service ${Date.now()}`,
      description: 'A service listing used to check the home game counts, long enough to pass validation.',
    });
    expect(svc.status).toBe(201);
    expect((await seller.client.post(`/listings/${svc.body.id}/packages`, { name: 'Basic', priceWaveCoin: 10, deliveryTimeDays: 2 })).status).toBeLessThan(300);
    expect((await seller.client.post(`/listings/${svc.body.id}/submit`)).status).toBeLessThan(300);
    expect((await admin.client.post(`/listings/${svc.body.id}/approve`)).status).toBeLessThan(300);
    expect(await count()).toBe(before);
    // An item listing does.
    const created = await seller.client.post('/listings', {
      type: 'item', categoryId: cats[0].id, gameId: game.id, title: `Round three item ${Date.now()}`,
      description: 'An item listing used to check the home game counts, long enough to pass validation.', priceWaveCoin: 5, stockQuantity: 1, isUnique: true,
    });
    await seller.client.post(`/listings/${created.body.id}/submit`);
    await admin.client.post(`/listings/${created.body.id}/approve`);
    expect(await count()).toBe(before + 1);
  });

  it('the duplicate-post check ignores case and extra spaces', async () => {
    const seller = await registerUser(ctx, 'r3space');
    const cats = (await seller.client.get('/categories')).body;
    const games = (await seller.client.get('/games')).body;
    const draft = (title: string) =>
      seller.client.post('/listings', {
        type: 'item', categoryId: cats[0].id, gameId: games[0].id, title,
        description: 'A draft listing used to test the duplicate-post guard, long enough for validation.', priceWaveCoin: 10, stockQuantity: 1, isUnique: true,
      });
    expect((await draft('Coc th14 full max base')).status).toBe(201);
    expect((await draft('coc  TH14 full   max  base')).status).toBe(409);
  });
});
