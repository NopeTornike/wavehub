import { createApp, credit, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';

describe('subscriptions + perks (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;
  let buyer: TestUser;
  let planId: string;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'admin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'subseller');
    buyer = await registerUser(ctx, 'subbuyer');
    await credit(ctx, buyer, 5000);
  });
  afterAll(async () => ctx.close());

  async function grant(user: TestUser, plan: string, audience: string, status = 'active') {
    await ctx.dataSource.query(
      `INSERT INTO user_subscriptions ("userId","planId",audience,status,"currentPeriodEnd","cancelAtPeriodEnd","bogParentOrderId")
       VALUES ($1,$2,$3,$4, now() + interval '30 days', false, 'e2e-parent')`,
      [user.id, plan, audience, status],
    );
  }

  it('only a super admin can manage plans; the public sees active plans only', async () => {
    const payload = {
      audience: 'seller_coach', tier: 'pro', name: 'E2E Seller Pro', description: 'Featured placement and a lower fee.',
      priceGel: 25, perks: { platformFeeDiscountPercent: 4, featuredListings: true, prioritySupport: true, profileBadge: 'pro' },
    };
    expect((await buyer.client.post('/admin/subscription-plans', payload)).status).toBe(403);
    const created = await admin.client.post('/admin/subscription-plans', payload);
    expect(created.status).toBeLessThan(300);
    planId = created.body.id;

    const hidden = await admin.client.post('/admin/subscription-plans', { ...payload, name: 'E2E Hidden', tier: 'ghost', isActive: false });
    const pub = await buyer.client.get('/subscriptions/plans');
    const ids = pub.body.map((p: any) => p.id);
    expect(ids).toContain(planId);
    expect(ids).not.toContain(hidden.body.id);
  });

  it('checkout without BOG credentials fails cleanly and creates no subscription', async () => {
    const res = await buyer.client.post('/subscriptions/checkout', {
      planId, successUrl: 'http://localhost:3000/plans?ok=1', failUrl: 'http://localhost:3000/plans?fail=1',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await buyer.client.get('/subscriptions/mine')).body).toHaveLength(0);
  });

  it('applies the fee discount (10% → 6%) to a subscribed seller and snapshots it on the order', async () => {
    const listing = await publishItemListing(ctx, seller, admin, 100);
    const plain = await buyer.client.post('/orders', { listingId: listing });
    expect(plain.body.platformFeePercentSnapshot).toBe(10);

    await grant(seller, planId, 'seller_coach');
    const listing2 = await publishItemListing(ctx, seller, admin, 100);
    const discounted = await buyer.client.post('/orders', { listingId: listing2 });
    expect(discounted.body.platformFeePercentSnapshot).toBe(6);
    expect(discounted.body.platformFeeWaveCoin).toBe(6);
    // The earlier order keeps its snapshot.
    expect((await buyer.client.get(`/orders/${plain.body.id}`)).body.platformFeeWaveCoin).toBe(10);
  });

  it('shows the profile badge, boosts the seller in browse, and revokes both on cancellation', async () => {
    expect((await buyer.client.get(`/users/${seller.username}`)).body.profileBadge).toBe('pro');
    const other = await registerUser(ctx, 'plainseller');
    await publishItemListing(ctx, other, admin, 10); // newer, non-boosted
    const boosted = await buyer.client.get('/listings?limit=50');
    expect(boosted.body.items[0].sellerId).toBe(seller.id);

    await ctx.dataSource.query(`UPDATE user_subscriptions SET status = 'cancelled' WHERE "userId" = $1`, [seller.id]);
    expect((await buyer.client.get(`/users/${seller.username}`)).body.profileBadge).toBeNull();
    const after = await buyer.client.get('/listings?limit=50');
    expect(after.body.items[0].sellerId).toBe(other.id);
  });

  it('opens support tickets as high priority for a subscriber, medium otherwise', async () => {
    const plainTicket = await buyer.client.post('/tickets', { subject: 'Regular ticket', category: 'other', description: 'No perk here at all.' });
    expect(plainTicket.body.priority).toBe('medium');

    const [buyerPlan] = (await admin.client.post('/admin/subscription-plans', {
      audience: 'buyer', tier: 'plus', name: 'E2E Buyer Plus', description: 'Priority support for buyers.', priceGel: 10, perks: { prioritySupport: true },
    })).body.id.split('|');
    await grant(buyer, buyerPlan, 'buyer');
    const vip = await buyer.client.post('/tickets', { subject: 'Priority ticket', category: 'other', description: 'With the perk active.' });
    expect(vip.body.priority).toBe('high');
  });

  it('the callback endpoint always answers 200 and ignores unsigned requests', async () => {
    // Specs share one database, so compare against the count before rather than assuming empty.
    const before = (await ctx.dataSource.query(`SELECT COUNT(*)::int c FROM subscription_charge_attempts`))[0].c;
    const res = await buyer.client.post('/subscriptions/bog-callback', { body: { order_id: 'x' } });
    expect(res.status).toBe(200);
    expect((await ctx.dataSource.query(`SELECT COUNT(*)::int c FROM subscription_charge_attempts`))[0].c).toBe(before);
  });
});
