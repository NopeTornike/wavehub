import { createApp, credit, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('fake-but-sniffable')]);

// Client round 2026-10-07 (second batch): one post uploaded 6 times, staff messaging, seller
// tiers on cards, optional banner text.
describe('client round 2 (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'r2admin');
    await makeAdmin(ctx, admin);
  });
  afterAll(async () => ctx.close());

  async function draft(user: TestUser, title: string) {
    const cats = await user.client.get('/categories');
    const games = await user.client.get('/games');
    return user.client.post('/listings', {
      type: 'item', categoryId: cats.body[0].id, gameId: games.body[0].id, title,
      description: 'A draft listing used to test the duplicate-post guard, long enough for validation.', priceWaveCoin: 10, stockQuantity: 1, isUnique: true,
    });
  }

  it('the same post again within two minutes is refused (retries used to create copies)', async () => {
    const seller = await registerUser(ctx, 'r2dup');
    const other = await registerUser(ctx, 'r2dupo');
    const first = await draft(seller, 'Coc th18 almost max base');
    expect(first.status).toBe(201);
    const again = await draft(seller, '  coc TH18 almost max base ');
    expect(again.status).toBe(409);
    expect(JSON.stringify(again.body)).toContain('You just created this listing');
    expect((await draft(seller, 'Coc th18 almost max base — second account')).status).toBe(201);
    expect((await draft(other, 'Coc th18 almost max base')).status).toBe(201); // another seller's post is unrelated
    // Older than two minutes: a real second listing with the same title is allowed.
    await ctx.dataSource.query(`UPDATE listings SET "createdAt" = now() - interval '3 minutes' WHERE id = $1`, [first.body.id]);
    expect((await draft(seller, 'Coc th18 almost max base')).status).toBe(201);
  });

  it('listing photos: a 6-photo post is never cut off by the upload throttle', async () => {
    const seller = await registerUser(ctx, 'r2photos');
    // 4 listings × 6 photos = 24 uploads in one minute (the old shared limit was 20/min).
    for (let i = 0; i < 4; i++) {
      const id = (await draft(seller, `Photo throttle listing ${i}`)).body.id;
      for (let p = 0; p < 6; p++) {
        expect((await seller.client.upload(`/listings/${id}/images`, PNG, 'a.png', 'image/png')).status).toBe(201);
      }
    }
  });

  it('staff can message anyone; coaches/sellers can message staff; others still need a deal', async () => {
    const staff = await registerUser(ctx, 'r2staff');
    await makeAdmin(ctx, staff, 'support_specialist');
    const seller = await registerUser(ctx, 'r2seller');
    const buyer = await registerUser(ctx, 'r2buyer');
    const drafter = await registerUser(ctx, 'r2drafter');
    const stranger = await registerUser(ctx, 'r2stranger');
    await publishItemListing(ctx, seller, admin, 10);
    await draft(drafter, 'Only a draft, never reviewed');

    // The team list: names + photo only, for staff / coaches / sellers with a reviewed listing.
    const team = await seller.client.get('/direct-messages/staff');
    expect(team.status).toBe(200);
    const entry = team.body.find((t: { id: string }) => t.id === staff.id);
    expect(entry).toBeDefined();
    expect(Object.keys(entry).sort()).toEqual(['avatarUrl', 'firstName', 'id', 'lastName']);
    expect(JSON.stringify(team.body)).not.toMatch(/username|adminRole|email|wavecoinBalance/);
    expect(JSON.stringify(team.body)).not.toContain(staff.username);
    expect((await buyer.client.get('/direct-messages/staff')).body).toEqual([]);
    expect((await drafter.client.get('/direct-messages/staff')).body).toEqual([]); // a bare draft isn't "a seller"
    expect((await stranger.client.get('/direct-messages/staff')).status).toBe(200);
    expect((await new (buyer.client.constructor as any)(ctx.baseUrl).get('/direct-messages/staff')).status).toBe(401);

    // Staff → anyone.
    const toBuyer = await staff.client.post('/direct-messages/start', { recipientUserId: buyer.id });
    expect(toBuyer.status).toBeLessThan(300);
    expect((await staff.client.post(`/direct-messages/${toBuyer.body.id}/messages`, { body: 'Hi, WaveHub support here' })).status).toBeLessThan(300);
    // The buyer sees the team member flagged as staff, without their username (a login name).
    const buyerInbox = (await buyer.client.get('/direct-messages')).body;
    const withStaff = buyerInbox.find((c: { otherUser: { id: string } }) => c.otherUser.id === staff.id);
    expect(withStaff.otherUser).toMatchObject({ username: '', staff: true });
    const thread = (await buyer.client.get(`/direct-messages/${toBuyer.body.id}/messages`)).body;
    expect(JSON.stringify(thread)).not.toContain(staff.username);
    // Staff still see usernames.
    const staffInbox = (await staff.client.get('/direct-messages')).body;
    expect(staffInbox.find((c: { otherUser: { id: string } }) => c.otherUser.id === buyer.id).otherUser).toMatchObject({ username: buyer.username, staff: false });

    // Seller → staff allowed; drafter / stranger → staff refused; stranger → seller refused.
    expect((await seller.client.post('/direct-messages/start', { recipientUserId: staff.id })).status).toBeLessThan(300);
    expect((await drafter.client.post('/direct-messages/start', { recipientUserId: staff.id })).status).toBe(403);
    expect((await stranger.client.post('/direct-messages/start', { recipientUserId: seller.id })).status).toBe(403);
  });

  it('a verified coach can message staff', async () => {
    const staff = await registerUser(ctx, 'r2staff2');
    await makeAdmin(ctx, staff, 'support_specialist');
    const coachUser = await registerUser(ctx, 'r2coach');
    expect((await admin.client.post('/admin/coaches', { username: coachUser.username, specialty: 'Rank pushing', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 40 })).status).toBe(201);
    expect((await coachUser.client.get('/direct-messages/staff')).body.map((t: { id: string }) => t.id)).toContain(staff.id);
    expect((await coachUser.client.post('/direct-messages/start', { recipientUserId: staff.id })).status).toBeLessThan(300);
  });

  it('seller tiers for product cards: public, username → Wave rank name only', async () => {
    const seller = await registerUser(ctx, 'r2tier');
    await publishItemListing(ctx, seller, admin, 10);
    const res = await fetch(`${ctx.baseUrl}/stats/seller-tiers`);
    expect(res.status).toBe(200);
    const tiers = (await res.json()) as Record<string, string>;
    // Cached for a minute: the new seller may not be in it yet, but every value is a rank name.
    for (const value of Object.values(tiers)) expect(typeof value).toBe('string');
    expect(JSON.stringify(tiers)).not.toMatch(/email|wavecoinBalance|adminRole|@/);
  });

  it('banners: the title is optional (a photo-only banner)', async () => {
    const b = await admin.client.post('/admin/banners', { placement: 'home_hero' });
    expect(b.status).toBe(201);
    expect(b.body.title).toBe('');
    expect((await admin.client.post('/admin/banners', { title: 'x'.repeat(81) })).status).toBe(400);
    expect((await admin.client.request('DELETE', `/admin/banners/${b.body.id}`)).status).toBeLessThan(300);
  });

  it('a buyer can still message a seller they bought from', async () => {
    const seller = await registerUser(ctx, 'r2s');
    const buyer = await registerUser(ctx, 'r2b');
    await credit(ctx, buyer, 50);
    const listing = await publishItemListing(ctx, seller, admin, 10);
    expect((await buyer.client.post('/orders', { listingId: listing })).status).toBeLessThan(300);
    expect((await buyer.client.post('/direct-messages/start', { recipientUserId: seller.id })).status).toBeLessThan(300);
  });
});
