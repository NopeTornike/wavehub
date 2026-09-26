import { createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';
import { assertConserved } from './flows';

// Service listings end to end (pages/sell/services/*): draft with requirements + FAQ, the package
// rules, owner/admin views, approval, a real purchase with requirement answers, and edits of a
// live service going back to review.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('service-art')]);

describe('service listings (e2e)', () => {
  let ctx: E2eApp;
  let seller: TestUser;
  let other: TestUser;
  let buyer: TestUser;
  let admin: TestUser;
  let serviceCategory: string;
  let itemCategory: string;
  let gameId: string;

  beforeAll(async () => {
    ctx = await createApp();
    [seller, other, buyer, admin] = await Promise.all([
      registerUser(ctx, 'svcseller'),
      registerUser(ctx, 'svcother'),
      registerUser(ctx, 'svcbuyer'),
      registerUser(ctx, 'svcadmin'),
    ]);
    await makeAdmin(ctx, admin);
    const categories = (await seller.client.get('/categories')).body as Array<{ id: string; slug: string }>;
    serviceCategory = categories.find((c) => c.slug === 'rank-push')!.id;
    itemCategory = categories.find((c) => c.slug === 'accounts')!.id;
    gameId = (await seller.client.get('/games')).body[0].id;
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  const draft = (extra: Record<string, unknown> = {}) =>
    seller.client.post('/listings', {
      type: 'service',
      categoryId: serviceCategory,
      gameId,
      title: 'Rank push to Ace in 3 days',
      description: 'Experienced player pushes your rank safely, no cheats, stream on request. '.repeat(2),
      requirementsSchema: [
        { key: 'current_rank', label: 'Current rank', type: 'text', required: true },
        { key: 'server', label: 'Server', type: 'dropdown', required: true, options: ['EU', 'Asia'] },
      ],
      faq: [{ q: 'Is it safe?', a: 'Yes — played by hand, no third-party software.' }],
      ...extra,
    });

  it('validates the service form', async () => {
    expect((await draft({ categoryId: itemCategory })).status).toBe(403);
    expect((await draft({ requirementsSchema: [{ key: 'Bad Key', label: 'x', type: 'text', required: true }] })).status).toBe(400);
    expect((await draft({ faq: Array.from({ length: 11 }, () => ({ q: 'Question?', a: 'Answer.' })) })).status).toBe(400);
    expect((await draft({ requirementsSchema: [{ key: 'a', label: 'A', type: 'dropdown', required: true }] })).status).toBe(403);
  });

  it('drafts, packages, submits, approves, sells, and re-reviews edits', async () => {
    const created = await draft();
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    // Owner view (any status); strangers can't read it; the public page doesn't serve drafts.
    const mine = await seller.client.get(`/listings/mine/${id}`);
    expect(mine.body).toMatchObject({ status: 'draft', type: 'service', packages: [], faq: [{ q: 'Is it safe?' }] });
    expect(mine.body.requirementsSchema).toHaveLength(2);
    expect((await other.client.get(`/listings/mine/${id}`)).status).toBe(403);
    expect((await buyer.client.get(`/listings/${id}`)).status).toBe(404);

    // No packages → can't submit.
    expect((await seller.client.post(`/listings/${id}/submit`)).status).toBe(409);

    // Package bounds and the 5-package cap.
    expect((await seller.client.post(`/listings/${id}/packages`, { name: 'Huge', priceWaveCoin: 100001, deliveryTimeDays: 3 })).status).toBe(400);
    expect((await seller.client.post(`/listings/${id}/packages`, { name: 'Slow', priceWaveCoin: 10, deliveryTimeDays: 91 })).status).toBe(400);
    const names = ['Basic', 'Standard', 'Premium', 'Pro', 'Elite'];
    for (const [i, name] of names.entries()) {
      const pkg = await seller.client.post(`/listings/${id}/packages`, { name, priceWaveCoin: 10 * (i + 1), deliveryTimeDays: i + 1, features: [`${i + 1} tier`], revisionsIncluded: 1 });
      expect(pkg.status).toBe(201);
    }
    expect((await seller.client.post(`/listings/${id}/packages`, { name: 'Sixth', priceWaveCoin: 70, deliveryTimeDays: 7 })).status).toBe(409);
    const packages = (await seller.client.get(`/listings/mine/${id}`)).body.packages as Array<{ id: string; name: string }>;
    expect(packages.map((p) => p.name)).toEqual(names); // kept in the order added
    expect((await other.client.request('DELETE', `/listings/${id}/packages/${packages[4].id}`)).status).toBe(403);
    expect((await seller.client.request("DELETE", `/listings/${id}/packages/${packages[4].id}`)).status).toBe(204);
    expect((await seller.client.upload(`/listings/${id}/images`, PNG, 'cover.png', 'image/png')).status).toBe(201);

    expect((await seller.client.post(`/listings/${id}/submit`)).body.status).toBe('pending_review');
    // Mid-review: no package changes.
    expect((await seller.client.post(`/listings/${id}/packages`, { name: 'Late', priceWaveCoin: 5, deliveryTimeDays: 1 })).status).toBe(409);

    // Moderator preview: full content, no seller PII; not for non-staff.
    expect((await seller.client.get(`/admin/listings/${id}`)).status).toBe(403);
    const preview = await admin.client.get(`/admin/listings/${id}`);
    expect(preview.body).toMatchObject({ status: 'pending_review', sellerUsername: seller.username });
    expect(preview.body.packages).toHaveLength(4);
    expect(JSON.stringify(preview.body)).not.toMatch(/"(email|passwordHash|wavecoinBalance)"/);
    expect((await admin.client.post(`/listings/${id}/approve`)).status).toBe(200);

    // Public detail carries packages, requirements and FAQ.
    const pub = (await buyer.client.get(`/listings/${id}`)).body;
    expect(pub.packages).toHaveLength(4);
    expect(pub.requirementsSchema.map((f: { key: string }) => f.key)).toEqual(['current_rank', 'server']);
    expect(pub.faq[0].q).toBe('Is it safe?');

    // Buying: requirement answers are validated against the schema.
    await credit(ctx, buyer, 100);
    const standard = pub.packages.find((p: { name: string }) => p.name === 'Standard');
    expect((await buyer.client.post('/orders', { listingId: id, packageId: standard.id, requirementsAnswers: { current_rank: 'Gold' } })).status).toBe(400);
    const order = await buyer.client.post('/orders', { listingId: id, packageId: standard.id, requirementsAnswers: { current_rank: 'Gold', server: 'EU' } });
    expect(order.status).toBe(201);
    expect(order.body.priceWaveCoin).toBe(20);

    // Editing a live service (package or FAQ) sends it back to review.
    expect((await seller.client.post(`/listings/${id}/packages`, { name: 'Weekend', priceWaveCoin: 15, deliveryTimeDays: 2 })).status).toBe(201);
    expect((await seller.client.get(`/listings/mine/${id}`)).body.status).toBe('pending_review');
    expect((await buyer.client.get(`/listings/${id}`)).status).toBe(404);
    await admin.client.post(`/listings/${id}/approve`);
    const faqEdit = await seller.client.request('PATCH', `/listings/${id}`, { faq: [{ q: 'How long?', a: 'One to three days.' }] });
    expect(faqEdit.body.status).toBe('pending_review');
    expect((await seller.client.get(`/listings/mine/${id}`)).body.faq).toEqual([{ q: 'How long?', a: 'One to three days.' }]);
  });

  it('keeps requirements/FAQ off non-service listings', async () => {
    const item = await seller.client.post('/listings', {
      type: 'item', categoryId: itemCategory, gameId, title: 'Ranked account level 70', description: 'Clean account, original email included, no bans ever.', priceWaveCoin: 30,
    });
    expect(item.status).toBe(201);
    expect((await seller.client.request('PATCH', `/listings/${item.body.id}`, { faq: [{ q: 'Question?', a: 'Answer.' }] })).status).toBe(403);
    expect((await seller.client.post(`/listings/${item.body.id}/packages`, { name: 'Basic', priceWaveCoin: 10, deliveryTimeDays: 1 })).status).toBe(403);
  });
});
