import { assertConserved } from './flows';
import { createApp, credit, E2eApp, makeAdmin, openAllHours, publishItemListing, registerUser, TestUser } from './helpers';

// Admin CRUD coverage added 2026-10-03: take a listing down / restore / delete, delete a coach,
// delete an unused promo code — each role-gated, guarded against destroying history, audit-logged —
// plus "a suspended seller's listings leave the marketplace".
describe('admin CRUD: listings, coaches, promo codes (e2e)', () => {
  let ctx: E2eApp;
  let superAdmin: TestUser;
  let ops: TestUser;
  let seller: TestUser;
  let buyer: TestUser;
  const audits = async (action: string, id: string) =>
    Number((await ctx.dataSource.query(`SELECT count(*)::int n FROM audit_logs WHERE action = $1 AND "entityId" = $2`, [action, id]))[0].n);
  const at = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();

  beforeAll(async () => {
    ctx = await createApp();
    superAdmin = await registerUser(ctx, 'crsuper');
    await makeAdmin(ctx, superAdmin);
    ops = await registerUser(ctx, 'crops');
    await makeAdmin(ctx, ops, 'marketplace_coaching_ops_manager');
    seller = await registerUser(ctx, 'crseller');
    buyer = await registerUser(ctx, 'crbuyer');
    await credit(ctx, buyer, 1000);
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('take-down hides a live listing with a reason; the seller cannot unpause it; restore brings it back', async () => {
    const id = await publishItemListing(ctx, seller, superAdmin, 30);
    expect((await buyer.client.post(`/admin/listings/${id}/take-down`, { reason: 'x' })).status).toBe(403);
    expect((await ops.client.post(`/admin/listings/${id}/take-down`, {})).status).toBe(400); // reason required

    const down = await ops.client.post(`/admin/listings/${id}/take-down`, { reason: 'Misleading photos' });
    expect(down.status).toBe(200);
    expect(down.body).toMatchObject({ status: 'rejected', rejectionReason: 'Misleading photos', isFeatured: false });
    expect((await buyer.client.get(`/listings/${id}`)).status).toBe(404);
    expect((await buyer.client.post('/orders', { listingId: id })).status).toBe(404);
    expect((await seller.client.post(`/listings/${id}/unpause`)).status).toBe(409);
    const notes = (await seller.client.get('/notifications')).body as Array<{ body: string }>;
    expect(notes.some((n) => n.body.includes('Misleading photos'))).toBe(true);
    expect(await audits('listing.take_down', id)).toBe(1);

    expect((await ops.client.post(`/admin/listings/${id}/restore`)).status).toBe(200);
    expect((await buyer.client.get(`/listings/${id}`)).status).toBe(200);
    expect((await ops.client.post(`/admin/listings/${id}/restore`)).status).toBe(409); // not removed
    expect(await audits('listing.restore', id)).toBe(1);
  });

  it('only Super Admin deletes a listing, and never one that has orders', async () => {
    const unused = await publishItemListing(ctx, seller, superAdmin, 25);
    expect((await ops.client.del(`/admin/listings/${unused}`)).status).toBe(403);
    expect((await superAdmin.client.del(`/admin/listings/${unused}`)).status).toBe(200);
    expect((await ops.client.get(`/admin/listings/${unused}`)).status).toBe(404);
    expect(await audits('listing.delete', unused)).toBe(1);

    const sold = await publishItemListing(ctx, seller, superAdmin, 25);
    expect((await buyer.client.post('/orders', { listingId: sold })).status).toBe(201);
    expect((await superAdmin.client.del(`/admin/listings/${sold}`)).status).toBe(409);
    expect((await ops.client.get(`/admin/listings/${sold}`)).status).toBe(200);
  });

  it("a suspended seller's listings leave the marketplace and can't be bought; restoring brings them back", async () => {
    const id = await publishItemListing(ctx, seller, superAdmin, 20);
    expect((await superAdmin.client.post(`/admin/users/${seller.id}/suspend`, { reason: 'Investigation' })).status).toBe(200);
    expect((await buyer.client.get(`/listings/${id}`)).status).toBe(404);
    const browse = (await buyer.client.get('/listings?limit=100')).body;
    const items = Array.isArray(browse) ? browse : browse.items;
    expect(items.some((l: { id: string }) => l.id === id)).toBe(false);
    expect((await buyer.client.post('/orders', { listingId: id })).status).toBe(404);
    expect((await fetch(`${ctx.baseUrl}/order-quote?listingId=${id}`)).status).toBe(404);

    expect((await superAdmin.client.post(`/admin/users/${seller.id}/restore`)).status).toBe(200);
    expect((await buyer.client.get(`/listings/${id}`)).status).toBe(200);
  });

  it('only Super Admin deletes a coach, and never one with session history (suspend instead)', async () => {
    const fresh = await registerUser(ctx, 'crcoach1');
    const made = await ops.client.post('/admin/coaches', { username: fresh.username, specialty: 'Aim', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 30 });
    expect(made.status).toBe(201);
    expect((await ops.client.del(`/admin/coaches/${made.body.id}`)).status).toBe(403);
    expect((await superAdmin.client.del(`/admin/coaches/${made.body.id}`)).status).toBe(200);
    expect((await buyer.client.get(`/coaches/${made.body.id}`)).status).toBe(404);
    expect(await audits('coach.delete', made.body.id)).toBe(1);
    expect((await superAdmin.client.del(`/admin/coaches/${made.body.id}`)).status).toBe(404);

    const busyUser = await registerUser(ctx, 'crcoach2');
    const busy = await ops.client.post('/admin/coaches', { username: busyUser.username, specialty: 'Aim', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 30 });
    await openAllHours(ctx, busy.body.id);
    const booked = await buyer.client.post(`/coaches/${busy.body.id}/bookings`, { durationMinutes: 60, slots: [at(30)], goal: 'Improve my aim in close fights.', discord: 'crbuyer' });
    expect(booked.status).toBe(201);
    expect((await superAdmin.client.del(`/admin/coaches/${busy.body.id}`)).status).toBe(409);
    expect((await ops.client.post(`/coaches/${busy.body.id}/suspend`)).status).toBe(200);
    expect((await buyer.client.get(`/coaches/${busy.body.id}`)).status).toBe(404);
  });

  it('a promo code can be deleted only while unused; a redeemed one only deactivated', async () => {
    const unused = await superAdmin.client.post('/admin/promo-codes', { code: 'CRUDDEL', amountWaveCoin: 2, maxRedemptions: 5 });
    expect((await ops.client.del(`/admin/promo-codes/${unused.body.id}`)).status).toBe(403);
    expect((await superAdmin.client.del(`/admin/promo-codes/${unused.body.id}`)).status).toBe(200);
    expect(await audits('promo_code.delete', unused.body.id)).toBe(1);

    const used = await superAdmin.client.post('/admin/promo-codes', { code: 'CRUDUSED', amountWaveCoin: 2, maxRedemptions: 5 });
    expect((await buyer.client.post('/promo-codes/redeem', { code: 'CRUDUSED' })).status).toBeLessThan(300);
    expect((await superAdmin.client.del(`/admin/promo-codes/${used.body.id}`)).status).toBe(409);
    expect((await superAdmin.client.patch(`/admin/promo-codes/${used.body.id}`, { active: false })).status).toBe(200);
  });
});
