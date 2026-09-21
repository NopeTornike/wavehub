import { assertConserved, buyItem } from './flows';
import { createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

describe('support, notifications and platform settings (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let specialist: TestUser;
  let seller: TestUser;
  let buyer: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'sadmin');
    await makeAdmin(ctx, admin);
    specialist = await registerUser(ctx, 'sspec');
    await makeAdmin(ctx, specialist, 'support_specialist');
    seller = await registerUser(ctx, 'sseller');
    buyer = await registerUser(ctx, 'sbuyer');
    other = await registerUser(ctx, 'sother');
    await credit(ctx, buyer, 5000);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  describe('platform settings', () => {
    it('validates ranges, is Super-Admin-only, is audited, and the fee applies to NEW orders only', async () => {
      const oldOrder = await buyItem(ctx, seller, buyer, admin, 100, 'paid');
      expect((await buyer.client.post('/admin/platform-settings', { platformFeePercent: 5 })).status).toBe(403);
      expect((await specialist.client.post('/admin/platform-settings', { platformFeePercent: 5 })).status).toBe(403);
      expect((await admin.client.post('/admin/platform-settings', { platformFeePercent: 101 })).status).toBe(400);
      expect((await admin.client.post('/admin/platform-settings', { platformFeePercent: -1 })).status).toBe(400);
      expect((await admin.client.post('/admin/platform-settings', { minWithdrawalWaveCoin: 0 })).status).toBe(400);
      expect((await admin.client.post('/admin/platform-settings', { unknownField: 1 })).status).toBe(400);

      expect((await admin.client.post('/admin/platform-settings', { platformFeePercent: 20 })).status).toBe(200);
      expect((await admin.client.get('/admin/platform-settings')).body.platformFeePercent).toBe(20);
      const fresh = await buyItem(ctx, seller, buyer, admin, 100, 'paid');
      const fee = async (id: string) => (await buyer.client.get(`/orders/${id}`)).body.platformFeeWaveCoin;
      expect(await fee(fresh)).toBe(20);
      expect(await fee(oldOrder)).toBe(10); // snapshot untouched by the later change
      await admin.client.post('/admin/platform-settings', { platformFeePercent: 10 });
      const audit = await ctx.dataSource.query(`SELECT metadata FROM audit_logs WHERE action = 'platform_settings.update'`);
      expect(audit.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('notifications', () => {
    it('are private to their owner: list, unread count, mark-read and read-all', async () => {
      await buyItem(ctx, seller, buyer, admin, 30, 'delivered'); // notifies the seller/buyer
      const mine = (await seller.client.get('/notifications')).body;
      expect(mine.length).toBeGreaterThan(0);
      const unread = (await seller.client.get('/notifications/unread-count')).body.count;
      expect(unread).toBeGreaterThan(0);

      const id = mine[0].id;
      expect((await other.client.post(`/notifications/${id}/read`)).status).toBe(403);
      expect((await other.client.get('/notifications')).body.map((n: any) => n.id)).not.toContain(id);
      expect((await other.client.post('/notifications/read-all')).status).toBe(200);
      expect((await seller.client.get('/notifications/unread-count')).body.count).toBe(unread); // other's read-all didn't touch mine

      expect((await seller.client.post(`/notifications/${id}/read`)).status).toBe(200);
      expect((await seller.client.get('/notifications/unread-count')).body.count).toBe(unread - 1);
      expect((await seller.client.post('/notifications/read-all')).status).toBe(200);
      expect((await seller.client.get('/notifications/unread-count')).body.count).toBe(0);
      expect((await seller.client.post('/notifications/00000000-0000-4000-8000-000000000000/read')).status).toBe(404);
      expect((await new (buyer.client.constructor as any)(ctx.baseUrl).get('/notifications')).status).toBe(401);
    });
  });

  describe('support tickets', () => {
    it('a requester sees only their own tickets and never staff internal notes', async () => {
      const t = await buyer.client.post('/tickets', { subject: 'Need help', category: 'payment', description: 'My top-up is missing.' });
      expect(t.status).toBeLessThan(300);
      expect(t.body.priority).toBe('medium');
      const id = t.body.id;
      expect((await other.client.get(`/tickets/mine/${id}`)).status).toBeGreaterThanOrEqual(403);
      expect((await other.client.post(`/tickets/mine/${id}/reply`, { body: 'hijack' })).status).toBeGreaterThanOrEqual(403);
      expect((await other.client.get('/tickets/mine')).body.map((x: any) => x.id)).not.toContain(id);

      expect((await specialist.client.post(`/admin/tickets/${id}/reply`, { body: 'We are looking into it.' })).status).toBeLessThan(300);
      expect((await specialist.client.post(`/admin/tickets/${id}/internal-note`, { body: 'SECRET-INTERNAL-NOTE' })).status).toBeLessThan(300);
      const visible = await buyer.client.get(`/tickets/mine/${id}`);
      expect(JSON.stringify(visible.body)).toContain('We are looking into it.');
      expect(JSON.stringify(visible.body)).not.toContain('SECRET-INTERNAL-NOTE');
      expect(JSON.stringify((await specialist.client.get(`/admin/tickets/${id}`)).body)).toContain('SECRET-INTERNAL-NOTE');

      // Close, then a requester reply reopens it.
      expect((await specialist.client.post(`/admin/tickets/${id}/update`, { status: 'closed' })).status).toBe(200);
      await buyer.client.post(`/tickets/mine/${id}/reply`, { body: 'Still broken.' });
      expect((await buyer.client.get(`/tickets/mine/${id}`)).body.status).toBe('open');
      expect((await buyer.client.post(`/admin/tickets/${id}/reply`, { body: 'x' })).status).toBe(403);
      expect((await ctx.dataSource.query(`SELECT 1 FROM audit_logs WHERE action = 'ticket.internal_note'`)).length).toBeGreaterThan(0);
    });

    it("cannot attach someone else's order to a ticket", async () => {
      const orderId = await buyItem(ctx, seller, buyer, admin, 10, 'paid');
      const res = await other.client.post('/tickets', { subject: 'About that order', category: 'order_status', description: 'Not mine.', orderId });
      expect(res.status).toBe(403);
      expect((await buyer.client.post('/tickets', { subject: 'My order', category: 'order_status', description: 'Mine.', orderId })).status).toBeLessThan(300);
    });
  });
});
