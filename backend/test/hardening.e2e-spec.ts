import { createApp, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('fake-but-sniffable')]);
const PDF = Buffer.from('%PDF-1.7 evidence');
const HTML = Buffer.from('<html><script>alert(document.domain)</script></html>');

describe('production hardening (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'hadmin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'hseller');
    other = await registerUser(ctx, 'hother');
  });
  afterAll(async () => ctx.close());

  describe('health', () => {
    it('GET /health is public, checks the DB, and reports maintenance', async () => {
      const res = await fetch(`${ctx.baseUrl}/health`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'ok', db: 'up', maintenance: false });
    });
  });

  describe('uploads', () => {
    async function draftListing(): Promise<string> {
      const cats = await seller.client.get('/categories');
      const games = await seller.client.get('/games');
      const created = await seller.client.post('/listings', {
        type: 'item', categoryId: cats.body[0].id, gameId: games.body[0].id, title: 'Upload test item',
        description: 'A draft listing used to test image uploads, long enough for validation.', priceWaveCoin: 10, stockQuantity: 1, isUnique: true,
      });
      return created.body.id;
    }

    it('rejects html disguised as a PNG (client-declared type and filename are not trusted)', async () => {
      const id = await draftListing();
      const res = await seller.client.upload(`/listings/${id}/images`, HTML, 'evil.png', 'image/png');
      expect(res.status).toBe(415);
      expect((await seller.client.upload(`/listings/${id}/images`, HTML, 'evil.html', 'text/html')).status).toBeGreaterThanOrEqual(400);
    });

    it('rejects a PDF where an image is required', async () => {
      const id = await draftListing();
      expect((await seller.client.upload(`/listings/${id}/images`, PDF, 'a.png', 'image/png')).status).toBe(415);
    });

    it('stores a real image under a random name and serves it with hardened headers', async () => {
      const id = await draftListing();
      const res = await seller.client.upload(`/listings/${id}/images`, PNG, '../../../etc/passwd.html', 'image/png');
      expect(res.status).toBeLessThan(300);
      expect(res.body.url).toMatch(/\/uploads\/[0-9a-f-]{36}\.png$/);
      const served = await fetch(`${ctx.baseUrl}${new URL(res.body.url).pathname}`);
      expect(served.status).toBe(200);
      expect(served.headers.get('x-content-type-options')).toBe('nosniff');
      expect(served.headers.get('content-security-policy')).toContain('sandbox');
      expect(served.headers.get('content-type')).toBe('image/png');
    });

    it("another seller cannot upload to someone else's listing", async () => {
      const id = await draftListing();
      expect((await other.client.upload(`/listings/${id}/images`, PNG, 'a.png', 'image/png')).status).toBe(403);
    });

    it('oversized uploads are refused', async () => {
      const id = await draftListing();
      const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]);
      const res = await seller.client.upload(`/listings/${id}/images`, big, 'big.png', 'image/png');
      expect(res.status).toBe(413);
    });
  });

  describe('CORS + error hygiene', () => {
    it('answers a disallowed origin without CORS headers instead of a 500', async () => {
      const res = await fetch(`${ctx.baseUrl}/categories`, { headers: { origin: 'https://evil.example' } });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('never leaks SQL/driver details or stacks for a malformed id', async () => {
      const res = await fetch(`${ctx.baseUrl}/listings/not-a-uuid`);
      const text = await res.text();
      expect(res.status).toBe(404);
      expect(text).not.toMatch(/invalid input syntax|uuid|QueryFailed|at .*\.ts/i);
      expect(res.headers.get('x-request-id')).toBeTruthy();
    });

    it('sets helmet security headers and no x-powered-by', async () => {
      const res = await fetch(`${ctx.baseUrl}/categories`);
      expect(res.headers.get('x-powered-by')).toBeNull();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
    });
  });

  describe('maintenance mode', () => {
    it('blocks non-admin writes with 503, keeps reads/admin/login/webhooks working, then recovers', async () => {
      const on = await admin.client.post('/admin/platform-settings', { maintenanceMode: true });
      expect(on.status).toBe(200);
      try {
        // Non-admin write blocked, with the maintenance marker.
        const blocked = await seller.client.post('/tickets', { subject: 'Help', category: 'other', description: 'x' });
        expect(blocked.status).toBe(503);
        expect(blocked.body.maintenance).toBe(true);
        // Anonymous write blocked too.
        const anon = await fetch(`${ctx.baseUrl}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        expect(anon.status).toBe(503);
        expect(anon.headers.get('retry-after')).toBe('300');
        // Reads still work, and /health reports it.
        expect((await seller.client.get('/listings')).status).toBe(200);
        const health = await (await fetch(`${ctx.baseUrl}/health`)).json();
        expect(health.maintenance).toBe(true);
        // Admin exempt; login exempt; BOG webhook reaches its handler (200, not 503).
        expect((await admin.client.post('/admin/platform-settings', { platformFeePercent: 10 })).status).toBe(200);
        expect((await seller.client.post('/auth/login', { username: seller.username, password: 'E2ePassw0rd!' })).status).toBeLessThan(300);
        const cb = await fetch(`${ctx.baseUrl}/payments/bog/callback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        expect(cb.status).toBe(200);
      } finally {
        expect((await admin.client.post('/admin/platform-settings', { maintenanceMode: false })).status).toBe(200);
      }
      const after = await seller.client.post('/tickets', { subject: 'Help', category: 'other', description: 'x' });
      expect(after.status).toBeLessThan(300);
    });
  });

  describe('authorization spot checks', () => {
    it('a stranger cannot manage or read another seller’s listing internals', async () => {
      const listingId = await publishItemListing(ctx, seller, admin, 20);
      expect((await other.client.post(`/listings/${listingId}/pause`)).status).toBe(403);
      expect((await other.client.get(`/listings/${listingId}/keys`)).status).toBeGreaterThanOrEqual(400);
      expect((await other.client.post(`/listings/${listingId}/packages`, { name: 'x', priceWaveCoin: 5, deliveryTimeDays: 1, features: [], revisionsIncluded: 0 })).status).toBeGreaterThanOrEqual(400);
    });

    it('unauthenticated requests to guarded routes are 401', async () => {
      for (const path of ['/orders/as-buyer', '/wallet/balance', '/notifications', '/tickets/mine', '/listings/mine', '/direct-messages']) {
        const res = await fetch(`${ctx.baseUrl}${path}`);
        expect([401, 403]).toContain(res.status);
      }
    });

    it('non-admins get 403 on every admin route family', async () => {
      const paths = ['/admin/users', '/admin/tickets', '/admin/content', '/admin/platform-settings', '/admin/subscription-plans', '/disputes', '/withdrawals/pending', '/coaches/all', '/reviews/reported', '/listings/pending-review'];
      for (const path of paths) {
        expect([path, (await other.client.get(path)).status]).toEqual([path, 403]);
      }
    });

    it('a stranger cannot cancel or view another user’s notification/withdrawal/ticket', async () => {
      const ticket = await seller.client.post('/tickets', { subject: 'Private', category: 'other', description: 'mine' });
      expect(ticket.status).toBeLessThan(300);
      expect((await other.client.get(`/tickets/mine/${ticket.body.id}`)).status).toBeGreaterThanOrEqual(400);
      expect((await other.client.post(`/tickets/mine/${ticket.body.id}/reply`, { body: 'hi' })).status).toBeGreaterThanOrEqual(400);
      expect((await other.client.post('/withdrawals/00000000-0000-0000-0000-000000000000/cancel')).status).toBeGreaterThanOrEqual(400);
      expect((await other.client.post('/notifications/00000000-0000-0000-0000-000000000000/read')).status).toBeGreaterThanOrEqual(400);
    });
  });
});
