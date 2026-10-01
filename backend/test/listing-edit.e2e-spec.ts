import { createApp, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Editing an item listing in every status (bug 9, 2026-10-01), new photos on a live listing going
// back through moderation, and Super Admin editing any listing without re-review.
describe('item listing edits (e2e)', () => {
  let ctx: E2eApp;
  let seller: TestUser;
  let ops: TestUser;
  let superAdmin: TestUser;
  let categoryId: string;
  let gameId: string;
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
  const DESCRIPTION = 'An item listing used by the edit tests, long enough for the 50 character minimum.';

  beforeAll(async () => {
    ctx = await createApp();
    seller = await registerUser(ctx, 'editseller');
    ops = await registerUser(ctx, 'editops');
    await makeAdmin(ctx, ops, 'marketplace_coaching_ops_manager');
    superAdmin = await registerUser(ctx, 'editsa');
    await makeAdmin(ctx, superAdmin, 'super_admin');
    const cats = (await seller.client.get('/categories')).body as Array<{ id: string; slug: string }>;
    categoryId = (cats.find((c) => c.slug === 'accounts') ?? cats[0]).id;
    gameId = (await seller.client.get('/games')).body[0].id;
  });
  afterAll(async () => ctx.close());

  async function draft(title = 'Edit test account') {
    const res = await seller.client.post('/listings', {
      type: 'item', categoryId, gameId, title, description: DESCRIPTION, priceWaveCoin: 20,
      attributes: { kind: 'account', platform: 'Android', accountLevel: 40 },
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }
  const status = async (id: string) => (await seller.client.get(`/listings/mine/${id}`)).body.status as string;
  const patch = (u: TestUser, id: string, body: Record<string, unknown>) => u.client.request('PATCH', `/listings/${id}`, body);

  it('draft: title, price, description and game details save as-is', async () => {
    const id = await draft();
    const res = await patch(seller, id, { title: 'Edited draft title', priceWaveCoin: 25, attributes: { kind: 'account', platform: 'iOS', accountLevel: 55 } });
    expect(res.status).toBe(200);
    const mine = (await seller.client.get(`/listings/mine/${id}`)).body;
    expect(mine).toMatchObject({ status: 'draft', title: 'Edited draft title', priceWaveCoin: 25 });
    expect(mine.itemAttributes).toEqual({ kind: 'account', platform: 'iOS', accountLevel: 55 });
    // Bounds still apply; strangers can't edit.
    expect((await patch(seller, id, { title: 'x' })).status).toBe(400);
    expect((await patch(seller, id, { status: 'active' })).status).toBe(400);
    const stranger = await registerUser(ctx, 'editstranger');
    expect((await patch(stranger, id, { title: 'Hijacked title' })).status).toBe(403);
  });

  it('pending review: refused until the decision (text and new photos)', async () => {
    const id = await draft();
    await seller.client.post(`/listings/${id}/submit`);
    expect((await patch(seller, id, { title: 'Mid-review edit' })).status).toBe(409);
    expect((await seller.client.upload(`/listings/${id}/images`, PNG, 'p.png', 'image/png')).status).toBe(409);
  });

  it('active: an edit is saved and goes back to review; so does a new photo', async () => {
    const id = await draft();
    expect((await seller.client.upload(`/listings/${id}/images`, PNG, 'p.png', 'image/png')).status).toBe(201);
    await seller.client.post(`/listings/${id}/submit`);
    await ops.client.post(`/listings/${id}/approve`);
    expect(await status(id)).toBe('active');

    expect((await patch(seller, id, { priceWaveCoin: 30 })).status).toBe(200);
    expect(await status(id)).toBe('pending_review');
    expect((await seller.client.get(`/listings/${id}`)).status).toBe(404); // not buyable until re-approved
    await ops.client.post(`/listings/${id}/approve`);
    expect((await seller.client.get(`/listings/${id}`)).body.priceWaveCoin).toBe(30);

    // A photo added after approval used to go live unmoderated.
    expect((await seller.client.upload(`/listings/${id}/images`, PNG, 'p2.png', 'image/png')).status).toBe(201);
    expect(await status(id)).toBe('pending_review');
    await ops.client.post(`/listings/${id}/approve`);
    // Reordering / removing already-approved photos doesn't need review.
    const images = (await seller.client.get(`/listings/mine/${id}`)).body.images as Array<{ id: string }>;
    expect((await seller.client.post(`/listings/${id}/images/${images[1].id}/cover`)).status).toBe(200);
    expect((await seller.client.request('DELETE', `/listings/${id}/images/${images[0].id}`)).status).toBe(200);
    expect(await status(id)).toBe('active');
  });

  it('rejected: edits save and the seller resubmits', async () => {
    const id = await draft();
    await seller.client.post(`/listings/${id}/submit`);
    await ops.client.post(`/listings/${id}/reject`, { reason: 'Photos missing' });
    expect((await patch(seller, id, { description: `${DESCRIPTION} Now with more detail.` })).status).toBe(200);
    expect(await status(id)).toBe('rejected');
    expect((await seller.client.post(`/listings/${id}/submit`)).status).toBeLessThan(300);
    expect(await status(id)).toBe('pending_review');
  });

  it('Super Admin edits any listing in any status without re-review; other staff cannot; audit-logged', async () => {
    const id = await draft();
    await seller.client.post(`/listings/${id}/submit`);
    await ops.client.post(`/listings/${id}/approve`);

    expect((await ops.client.request('PATCH', `/admin/listings/${id}`, { title: 'Ops edit attempt' })).status).toBe(403);
    expect((await seller.client.request('PATCH', `/admin/listings/${id}`, { title: 'Seller via admin' })).status).toBe(403);

    const res = await superAdmin.client.request('PATCH', `/admin/listings/${id}`, { title: 'Corrected by staff', priceWaveCoin: 22 });
    expect(res.status).toBe(200);
    expect(await status(id)).toBe('active'); // stays live
    expect((await seller.client.get(`/listings/${id}`)).body).toMatchObject({ title: 'Corrected by staff', priceWaveCoin: 22 });

    const img = await superAdmin.client.upload(`/admin/listings/${id}/images`, PNG, 'staff.png', 'image/png');
    expect(img.status).toBe(201);
    expect((await superAdmin.client.post(`/admin/listings/${id}/images/${img.body.id}/cover`)).status).toBe(200);
    expect((await superAdmin.client.request('DELETE', `/admin/listings/${id}/images/${img.body.id}`)).status).toBe(200);
    expect(await status(id)).toBe('active');

    // Also while a review is pending (staff are the reviewers).
    await patch(seller, id, { priceWaveCoin: 23 });
    expect((await superAdmin.client.request('PATCH', `/admin/listings/${id}`, { priceWaveCoin: 24 })).status).toBe(200);
    expect(await status(id)).toBe('pending_review');

    const audit = await ctx.dataSource.query(`SELECT action FROM audit_logs WHERE "entityId" = $1 ORDER BY "createdAt"`, [id]);
    expect(audit.map((a: { action: string }) => a.action)).toEqual(
      expect.arrayContaining(['listing.admin_update', 'listing.admin_add_image', 'listing.admin_set_cover', 'listing.admin_remove_image']),
    );
  });
});
