import { assertConserved } from './flows';
import { createApp, credit, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';

// "Notifications on welcome, purchase, etc." (client, 2026-10-02): every user-facing event that
// changes something for a user lands in their notification center, deep-linked.
describe('notification events (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;
  let buyer: TestUser;
  type Note = { type: string; title: string; body: string; metadata: Record<string, string> | null; readAt: string | null };
  const notes = async (u: TestUser): Promise<Note[]> => (await u.client.get('/notifications?limit=50')).body;
  const ofType = async (u: TestUser, type: string) => (await notes(u)).filter((n) => n.type === type);

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'neadmin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'neseller');
    buyer = await registerUser(ctx, 'nebuyer');
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('welcome on registration, unread, counted in the badge', async () => {
    const welcome = await ofType(buyer, 'welcome');
    expect(welcome).toHaveLength(1);
    expect(welcome[0].readAt).toBeNull();
    expect((await buyer.client.get('/notifications/unread-count')).body.count).toBeGreaterThanOrEqual(1);
  });

  it('listing approved → the seller; purchase → both the buyer (order placed) and the seller (new order)', async () => {
    const listingId = await publishItemListing(ctx, seller, admin, 40);
    const approved = await ofType(seller, 'listing_approved');
    expect(approved).toHaveLength(1);
    expect(approved[0].metadata).toEqual({ link: `/listings/${listingId}` });

    await credit(ctx, buyer, 100);
    const order = await buyer.client.post('/orders', { listingId });
    expect(order.status).toBe(201);
    const placed = await ofType(buyer, 'order_placed');
    expect(placed).toHaveLength(1);
    expect(placed[0].body).toContain('44 GEL (ფასი 40 + საკომისიო 4)'); // total paid, with the breakdown
    expect(placed[0].metadata).toEqual({ orderId: order.body.id });
    expect((await ofType(seller, 'order_paid')).map((n) => n.metadata?.orderId)).toContain(order.body.id);
  });

  it('key events are also emailed (with a link to the page), unless the user switched emails off', async () => {
    const mailsTo = (u: TestUser) => ctx.sentEmails.filter((e) => e.to === `${u.username}@example.com`);
    const waitFor = async (check: () => boolean) => {
      for (let i = 0; i < 40 && !check(); i++) await new Promise((r) => setTimeout(r, 50));
    };
    const quiet = await registerUser(ctx, 'nequiet');
    expect((await quiet.client.get('/me/profile')).body.emailNotifications).toBe(true);
    expect((await quiet.client.request('PATCH', '/me/profile', { emailNotifications: false })).body.emailNotifications).toBe(false);
    const before = { buyer: mailsTo(buyer).length, seller: mailsTo(seller).length, quiet: mailsTo(quiet).length };

    const listingId = await publishItemListing(ctx, seller, admin, 7);
    await credit(ctx, buyer, 20);
    await credit(ctx, quiet, 20);
    const order = (await buyer.client.post('/orders', { listingId })).body;
    expect((await quiet.client.post('/orders', { listingId: await publishItemListing(ctx, seller, admin, 7) })).status).toBe(201);
    await waitFor(() => mailsTo(buyer).length > before.buyer && mailsTo(seller).length >= before.seller + 2);

    const placed = mailsTo(buyer).slice(before.buyer).find((m) => m.subject.startsWith('შეკვეთა გაფორმდა'));
    expect(placed).toBeTruthy();
    expect(placed!.html).toContain(`/orders/${order.id}`);
    expect(placed!.body).toContain('7.70 GEL (ფასი 7 + საკომისიო 0.70)'); // exact fee, not rounded
    expect(mailsTo(seller).slice(before.seller).some((m) => m.subject.startsWith('ახალი შეკვეთა'))).toBe(true);
    expect(mailsTo(seller).slice(before.seller).some((m) => m.subject.startsWith('განცხადება დამტკიცდა'))).toBe(true);
    await new Promise((r) => setTimeout(r, 300));
    expect(mailsTo(quiet).length).toBe(before.quiet); // switched off: in-app only
    expect((await quiet.client.get('/notifications')).body.some((n: { type: string }) => n.type === 'order_placed')).toBe(true);
  });

  it('listing rejected → the seller, with the reason', async () => {
    const cats = await seller.client.get('/categories');
    const games = await seller.client.get('/games');
    const created = await seller.client.post('/listings', {
      type: 'item', title: 'Rejected test account', description: 'A listing that staff will reject for the test, long enough to pass.',
      gameId: games.body[0].id, categoryId: cats.body[0].id, priceWaveCoin: 10, stockQuantity: 1, isUnique: false, resaleRightsAttested: true,
    });
    expect(created.status).toBe(201);
    await seller.client.post(`/listings/${created.body.id}/submit`);
    expect((await admin.client.post(`/listings/${created.body.id}/reject`, { reason: 'Photos missing' })).status).toBeLessThan(300);
    const rejected = await ofType(seller, 'listing_rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].body).toContain('Photos missing');
  });

  it('coach approved / rejected → the applicant', async () => {
    const coach = await registerUser(ctx, 'necoach');
    const apply = (u: TestUser) =>
      u.client.post('/coaches/apply', { specialty: 'Rank pushing', bio: 'Ten years of competitive experience across several titles.', hourlyRateWaveCoin: 30 });
    const a = await apply(coach);
    expect((await admin.client.post(`/coaches/${a.body.id}/approve`)).status).toBeLessThan(300);
    expect((await ofType(coach, 'coach_approved'))[0]?.metadata).toEqual({ link: '/coaching/profile' });

    const other = await registerUser(ctx, 'necoach2');
    const b = await apply(other);
    expect((await admin.client.post(`/coaches/${b.body.id}/reject`, { reason: 'Need proof of rank' })).status).toBeLessThan(300);
    expect((await ofType(other, 'coach_rejected'))[0]?.body).toContain('Need proof of rank');
  });

  it('a staff balance adjustment tells the user the amount but never the internal reason', async () => {
    const res = await admin.client.post(`/admin/users/${seller.id}/wallet-adjustment`, { amountWaveCoin: 15, reason: 'internal-note-xyz' });
    expect(res.status).toBe(200);
    const adjusted = await ofType(seller, 'wallet_adjusted');
    expect(adjusted).toHaveLength(1);
    expect(adjusted[0].body).toContain('15 WaveCoin');
    expect(JSON.stringify(adjusted)).not.toContain('internal-note-xyz');
  });

  it('a new follower notifies once — unfollow + follow again does not repeat it', async () => {
    const fan = await registerUser(ctx, 'nefan');
    await fan.client.post(`/users/${seller.username}/follow`);
    await fan.client.post(`/users/${seller.username}/follow`); // idempotent
    await fan.client.request('DELETE', `/users/${seller.username}/follow`);
    await fan.client.post(`/users/${seller.username}/follow`);
    const follows = await ofType(seller, 'new_follower');
    expect(follows).toHaveLength(1);
    expect(follows[0].body).toContain(`@${fan.username}`);
    expect(follows[0].metadata?.link).toBe(`/u/${fan.username}`);
  });

  it('notifications stay private: another user cannot read or mark them', async () => {
    const mine = await notes(seller);
    const stranger = await registerUser(ctx, 'nestranger');
    expect((await stranger.client.post(`/notifications/${(mine[0] as unknown as { id: string }).id}/read`)).status).toBeGreaterThanOrEqual(403);
    expect(JSON.stringify(await notes(stranger))).not.toContain(seller.username);
  });
});
