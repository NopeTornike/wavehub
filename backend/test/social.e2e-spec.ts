import { createApp, credit, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';

describe('direct messaging + tournaments (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'admin');
    await makeAdmin(ctx, admin);
  });
  afterAll(async () => ctx.close());

  it('direct messages need a real transaction between the two users', async () => {
    const seller = await registerUser(ctx, 'dmseller');
    const buyer = await registerUser(ctx, 'dmbuyer');
    const stranger = await registerUser(ctx, 'dmstranger');
    await credit(ctx, buyer, 100);

    expect((await buyer.client.post('/direct-messages/start', { recipientUserId: seller.id })).status).toBeGreaterThanOrEqual(400);

    const listing = await publishItemListing(ctx, seller, admin, 10);
    expect((await buyer.client.post('/orders', { listingId: listing })).status).toBeLessThan(300);

    const start = await buyer.client.post('/direct-messages/start', { recipientUserId: seller.id });
    expect(start.status).toBeLessThan(300);
    const convoId = start.body.id;
    expect((await buyer.client.post(`/direct-messages/${convoId}/messages`, { body: 'Hello, quick question' })).status).toBeLessThan(300);
    expect(JSON.stringify((await seller.client.get(`/direct-messages/${convoId}/messages`)).body)).toContain('quick question');
    // A third party can neither read nor write it.
    expect((await stranger.client.get(`/direct-messages/${convoId}/messages`)).status).toBeGreaterThanOrEqual(400);
    expect((await stranger.client.post(`/direct-messages/${convoId}/messages`, { body: 'hi' })).status).toBeGreaterThanOrEqual(400);
  });

  it('tournament registration: capacity is enforced and double-registration is rejected', async () => {
    const games = await admin.client.get('/games');
    const t = await admin.client.post('/admin/tournaments', {
      gameId: games.body[0].id, name: 'E2E Cup', description: 'A tiny two-player e2e tournament.',
      prize: '100 WC', status: 'open', startDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), maxPlayers: 2,
    });
    expect(t.status).toBeLessThan(300);
    const [a, b, c] = await Promise.all([registerUser(ctx, 'ta'), registerUser(ctx, 'tb'), registerUser(ctx, 'tc')]);
    expect((await a.client.post(`/tournaments/${t.body.id}/register`)).status).toBe(200);
    expect((await a.client.post(`/tournaments/${t.body.id}/register`)).status).toBeGreaterThanOrEqual(400);
    expect((await b.client.post(`/tournaments/${t.body.id}/register`)).status).toBe(200);
    expect((await c.client.post(`/tournaments/${t.body.id}/register`)).status).toBeGreaterThanOrEqual(400);
    expect((await a.client.post('/admin/tournaments', {})).status).toBe(403); // non-admin
  });
});
