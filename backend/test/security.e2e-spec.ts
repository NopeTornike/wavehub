import { createApp, credit, E2eApp, makeAdmin, publishItemListing, recordedResponses, registerUser, TestUser } from './helpers';

// Walks a broad slice of the API as several users and then sweeps EVERY recorded JSON response for
// keys that must never reach a client (password hashes, other users' balances/emails/roles). This
// is a regression net for the "joined User entity serialized into a public response" bug class.
const ALWAYS_FORBIDDEN = ['passwordHash', 'adminRole', 'moderationReason', 'emailVerifiedAt', 'wavecoinBalance', 'email'];
// Endpoints that legitimately return the caller's OWN private fields.
const OWN_DATA_PATHS = [/^\/auth\/(me|login|register)/, /^\/wallet\//];
const ADMIN_PATH = /^\/(admin|withdrawals\/pending|coaches\/(all|pending-verification)|listings\/pending-review|reviews\/reported|disputes)/;

function findKeys(value: any, keys: string[], trail = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findKeys(v, keys, `${trail}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => (keys.includes(k) ? [`${trail}.${k}`] : []).concat(findKeys(v, keys, `${trail}.${k}`)));
  }
  return [];
}

describe('response privacy sweep + hardening (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;
  let buyer: TestUser;
  let stranger: TestUser;
  let listingId: string;
  let orderId: string;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'sadmin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'sseller');
    buyer = await registerUser(ctx, 'sbuyer');
    stranger = await registerUser(ctx, 'sstranger');
    await credit(ctx, buyer, 1000);
    listingId = await publishItemListing(ctx, seller, admin, 100);
    orderId = (await buyer.client.post('/orders', { listingId })).body.id;
  });
  afterAll(async () => ctx.close());

  it('exercises endpoints that join user rows', async () => {
    await seller.client.post(`/orders/${orderId}/start`);
    await seller.client.post(`/orders/${orderId}/deliver`);
    await buyer.client.post(`/orders/${orderId}/accept`);
    await buyer.client.get('/listings');
    await stranger.client.get('/listings');
    await stranger.client.get(`/listings/${listingId}`);
    await buyer.client.get('/orders/as-buyer');
    await seller.client.get('/orders/as-seller');
    await buyer.client.get(`/orders/${orderId}`);
    await buyer.client.get(`/orders/${orderId}/messages`);
    await buyer.client.post(`/orders/${orderId}/messages`, { body: 'hello there' });
    await seller.client.get(`/orders/${orderId}/messages`);
    await buyer.client.post('/reviews', { orderId, rating: 5, body: 'Great seller, would buy again.' });
    await stranger.client.get(`/listings/${listingId}/reviews`);
    await stranger.client.get(`/users/${seller.username}`);
    await buyer.client.post('/direct-messages/start', { recipientUserId: seller.id });
    await buyer.client.get('/direct-messages');
    await buyer.client.post('/tickets', { subject: 'Help me', category: 'other', description: 'Something' });
    await buyer.client.get('/tickets/mine');
    const games = await seller.client.get('/games');
    await seller.client.post('/coaches/apply', {
      gameId: games.body[0].id,
      specialty: 'Ranked pushes',
      bio: 'A long enough coach bio for validation purposes.',
      hourlyRateWaveCoin: 20,
    });
    await seller.client.get('/coaches/mine');
    await admin.client.get('/coaches/pending-verification');
    await stranger.client.get('/coaches');
    await stranger.client.get('/tournaments');
    await buyer.client.get('/notifications');
    await buyer.client.get('/wallet/transactions');
    await admin.client.get('/admin/users');
    await admin.client.get('/admin/tickets');
    await admin.client.get('/disputes');
  });

  it('no non-admin, non-own-data response contains sensitive user fields', () => {
    const offenders: string[] = [];
    for (const r of recordedResponses) {
      if (r.status >= 300 || OWN_DATA_PATHS.some((p) => p.test(r.path)) || ADMIN_PATH.test(r.path)) continue;
      const hits = findKeys(r.body, ALWAYS_FORBIDDEN);
      if (hits.length) offenders.push(`${r.method} ${r.path} -> ${hits.slice(0, 4).join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('no response anywhere contains passwordHash', () => {
    const offenders = recordedResponses.filter((r) => findKeys(r.body, ['passwordHash']).length > 0);
    expect(offenders.map((r) => r.path)).toEqual([]);
  });

  it('a malformed uuid path param is a clean 4xx, not a 500', async () => {
    const res = await buyer.client.get('/orders/not-a-uuid');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect((await stranger.client.get('/listings/not-a-uuid')).status).toBeLessThan(500);
  });

  it("a stranger cannot read or act on someone else's order", async () => {
    expect((await stranger.client.get(`/orders/${orderId}`)).status).toBe(403);
    expect((await stranger.client.get(`/orders/${orderId}/messages`)).status).toBeGreaterThanOrEqual(403);
    expect((await stranger.client.get(`/orders/${orderId}/key`)).status).toBeGreaterThanOrEqual(400);
    expect((await stranger.client.post(`/orders/${orderId}/accept`)).status).toBe(403);
    expect((await stranger.client.get(`/orders/${orderId}/dispute`)).status).toBeGreaterThanOrEqual(400);
  });
});
