import { balanceOf, createApp, credit, E2eApp, makeAdmin, publishItemListing, registerUser, TestUser } from './helpers';

// Regression suite for the same-buyer wallet-lock deadlock (Postgres 40P01 -> HTTP 500): a single
// buyer firing many simultaneous POST /orders. See backend/src/wallet/CLAUDE.md.
describe('same-buyer concurrent purchases (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'wcadmin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'wcseller');
  });
  afterAll(async () => ctx.close());

  it('never deadlocks (no 5xx) when one buyer fires 12 simultaneous purchases with ample balance', async () => {
    // The helper's item listings have stockQuantity 5, so spread the purchases over several listings.
    const listings: string[] = [];
    for (let i = 0; i < 4; i++) listings.push(await publishItemListing(ctx, seller, admin, 10));

    const buyer = await registerUser(ctx, 'wcbuyer');
    await credit(ctx, buyer, 1000);

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => buyer.client.post('/orders', { listingId: listings[i % listings.length] })),
    );
    expect(results.filter((r) => r.status >= 500)).toEqual([]);
    expect(results.filter((r) => r.status < 300)).toHaveLength(12);
    expect(await balanceOf(ctx, buyer)).toBe(1000 - 12 * 10);

    const ledger = await ctx.dataSource.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM("amountWaveCoin"),0)::int AS total FROM wallet_ledger_entries WHERE "userId" = $1 AND type = 'order_escrow_hold'`,
      [buyer.id],
    );
    expect(ledger[0].n).toBe(12);
    expect(ledger[0].total).toBe(-120);
  });

  it('never overdraws: 10 simultaneous 10-coin purchases on a 35-coin balance -> exactly 3 succeed, rest 403', async () => {
    const listings: string[] = [];
    for (let i = 0; i < 2; i++) listings.push(await publishItemListing(ctx, seller, admin, 10));
    const buyer = await registerUser(ctx, 'wcpoor');
    await credit(ctx, buyer, 35);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => buyer.client.post('/orders', { listingId: listings[i % 2] })),
    );
    expect(results.filter((r) => r.status >= 500)).toEqual([]);
    expect(results.filter((r) => r.status < 300)).toHaveLength(3);
    for (const r of results.filter((r) => r.status >= 300)) expect(r.status).toBe(403);
    expect(await balanceOf(ctx, buyer)).toBe(5);
    const orders = await ctx.dataSource.query(`SELECT COUNT(*)::int AS n FROM orders WHERE "buyerId" = $1`, [buyer.id]);
    expect(orders[0].n).toBe(3);
  });
});
