import { createApp, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

// Steam games (docs/design-mockups 04/05): seller-entered facts on digital-key listings, genre
// filter, popular sort, compare-at price rule, image removal ownership.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5a3a2e50000000049454e44ae426082', 'hex');

describe('steam game listings (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;
  let other: TestUser;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'sgadmin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'sgseller');
    other = await registerUser(ctx, 'sgother');
    categoryId = (await seller.client.get('/categories')).body[0].id;
  });
  afterAll(async () => ctx.close());

  const base = (title: string, attributes?: Record<string, unknown>) => ({
    type: 'digital_key', categoryId, title, description: 'Steam activation key with confirmed resale rights, described in detail.',
    priceWaveCoin: 20, resaleRightsAttested: true, ...(attributes ? { attributes } : {}),
  });

  async function publish(id: string) {
    expect((await seller.client.post(`/listings/${id}/keys`, { keys: ['SG-KEY-0001'] })).status).toBeLessThan(300);
    expect((await seller.client.post(`/listings/${id}/submit`)).status).toBeLessThan(300);
    expect((await admin.client.post(`/listings/${id}/approve`)).status).toBeLessThan(300);
  }

  it('stores facts, filters by genre, and refuses a fake discount', async () => {
    expect((await seller.client.post('/listings', base('Fake discount game', { compareAtPrice: 20 }))).status).toBe(400);
    expect((await seller.client.post('/listings', base('Unknown genre game', { genre: 'x'.repeat(301) }))).status).toBe(400);

    const rpg = await seller.client.post('/listings', base('Steam RPG Epic Game', { tagline: 'A vast world awaits.', genre: 'rpg', region: 'Global', compareAtPrice: 30 }));
    expect(rpg.status).toBe(201);
    await publish(rpg.body.id);
    const shooter = await seller.client.post('/listings', base('Steam Shooter Game', { genre: 'shooter' }));
    await publish(shooter.body.id);

    const detail = (await other.client.get(`/listings/${rpg.body.id}`)).body;
    expect(detail.itemAttributes).toMatchObject({ tagline: 'A vast world awaits.', genre: 'rpg', compareAtPrice: 30 });
    const byGenre = (await other.client.get('/listings?type=digital_key&genre=rpg&limit=100')).body.items.map((l: { id: string }) => l.id);
    expect(byGenre).toContain(rpg.body.id);
    expect(byGenre).not.toContain(shooter.body.id);
    expect((await other.client.get('/listings?type=digital_key&genre=nonsense')).status).toBe(400);
    expect((await other.client.get('/listings?type=digital_key&sort=popular')).status).toBe(200);

    // Editing facts on a live listing sends it back to review; a fake discount is refused on edit too.
    expect((await seller.client.request('PATCH', `/listings/${rpg.body.id}`, { attributes: { genre: 'rpg', compareAtPrice: 10 } })).status).toBe(400);
    const edited = await seller.client.request('PATCH', `/listings/${rpg.body.id}`, { attributes: { genre: 'adventure' } });
    expect(edited.status).toBe(200);
    expect(edited.body.status).toBe('pending_review');
    const mine = (await seller.client.get('/listings/mine')).body.find((l: { id: string }) => l.id === rpg.body.id);
    expect(mine.itemAttributes).toEqual({ genre: 'adventure' });
  });

  it('only the owner can remove a listing photo', async () => {
    const created = await seller.client.post('/listings', base('Steam Photo Game'));
    const img = await seller.client.upload(`/listings/${created.body.id}/images`, PNG, 'cover.png', 'image/png');
    expect(img.status).toBe(201);
    expect((await other.client.request('DELETE', `/listings/${created.body.id}/images/${img.body.id}`)).status).toBe(403);
    expect((await seller.client.request('DELETE', `/listings/${created.body.id}/images/${img.body.id}`)).status).toBe(200);
    expect((await seller.client.request('DELETE', `/listings/${created.body.id}/images/${img.body.id}`)).status).toBe(404);
  });
});
