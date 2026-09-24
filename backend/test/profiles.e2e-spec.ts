import { buyItem } from './flows';
import { createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Public profile facts + follows (docs/design-mockups/12).
describe('public profiles + follows (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;
  let fan: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'pradmin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'prseller');
    fan = await registerUser(ctx, 'prfan');
  });
  afterAll(async () => ctx.close());

  it('self-entered fields are editable and public; nothing private leaks', async () => {
    expect((await seller.client.request('PATCH', '/me/profile', { location: 'x'.repeat(61) })).status).toBe(400);
    const saved = await seller.client.request('PATCH', '/me/profile', { location: 'Tbilisi, Georgia', tagline: 'Better players. Brighter stories.', platform: 'Mobile', preferredRole: 'Aggressive / Slayer', achievement: 'Top 500 Global' });
    expect(saved.status).toBe(200);
    const pub = (await fan.client.get(`/users/${seller.username}`)).body;
    expect(pub).toMatchObject({ location: 'Tbilisi, Georgia', tagline: 'Better players. Brighter stories.', role: 'player', followers: 0, completedDeals: 0 });
    expect(pub.shortId).toMatch(/^[0-9A-F]{8}$/);
    expect(pub.reviews).toEqual({ count: 0, average: null, distribution: [0, 0, 0, 0, 0], latest: [] });
    expect(pub.badges[0].key).toBe('tier');
    expect(JSON.stringify(pub)).not.toMatch(/email|passwordHash|wavecoinBalance|lastSeenAt/);
  });

  it('follow / unfollow is per user, idempotent, and never self', async () => {
    expect((await fan.client.post(`/users/${seller.username}/follow`)).body).toEqual({ following: true, followers: 1 });
    expect((await fan.client.post(`/users/${seller.username}/follow`)).body).toEqual({ following: true, followers: 1 });
    expect((await seller.client.post(`/users/${seller.username}/follow`)).status).toBe(400);
    expect((await fan.client.get(`/users/${seller.username}/follow-status`)).body).toEqual({ following: true });
    expect((await admin.client.get(`/users/${seller.username}/follow-status`)).body).toEqual({ following: false });
    expect((await fan.client.get(`/users/${fan.username}`)).body.following).toBe(1);
    expect((await fan.client.request('DELETE', `/users/${seller.username}/follow`)).body).toEqual({ following: false, followers: 0 });
    expect((await fan.client.post('/users/nobody-here-xyz/follow')).status).toBe(404);
  });

  it('completed deals and reviews feed role, distribution and badges', async () => {
    await credit(ctx, fan, 200);
    const orderId = await buyItem(ctx, seller, fan, admin, 10, 'completed');
    expect((await fan.client.post('/reviews', { orderId, rating: 4, body: 'Smooth and quick.' })).status).toBeLessThan(300);
    const pub = (await admin.client.get(`/users/${seller.username}`)).body;
    expect(pub.role).toBe('seller');
    expect(pub.completedDeals).toBe(1);
    expect(pub.reviews).toMatchObject({ count: 1, average: 4, distribution: [0, 1, 0, 0, 0] });
    expect(pub.reviews.latest[0]).toMatchObject({ rating: 4, body: 'Smooth and quick.', buyerUsername: fan.username });
    expect(pub.badges.map((b: { key: string }) => b.key)).toContain('first-deal');
  });
});
