import { assertConserved, buyItem, clearHold } from './flows';
import { balanceOf, createApp, credit, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';

describe('withdrawals + wallet balance (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let seller: TestUser;
  let buyer: TestUser;
  const payout = { amountWaveCoin: 0, method: 'bank_transfer', payoutDetails: { iban: 'GE00XX0000000000000000' } };
  const withdraw = (u: TestUser, amount: number) => u.client.post('/withdrawals', { ...payout, amountWaveCoin: amount });

  beforeAll(async () => {
    ctx = await createApp();
    admin = await registerUser(ctx, 'wadmin');
    await makeAdmin(ctx, admin);
    seller = await registerUser(ctx, 'wseller');
    buyer = await registerUser(ctx, 'wbuyer');
    await credit(ctx, buyer, 10000);
    // Two completed 100-coin orders → 180 earned (90 each), still inside the 7-day hold.
    await buyItem(ctx, seller, buyer, admin, 100, 'completed');
    await buyItem(ctx, seller, buyer, admin, 100, 'completed');
  });
  afterAll(async () => {
    await assertConserved(ctx);
    await ctx.close();
  });

  it('shows earnings as pending clearance and blocks withdrawal during the 7-day hold', async () => {
    const w = (await seller.client.get('/wallet/balance')).body;
    expect(w).toMatchObject({ walletBalance: 180, totalEarned: 180, pendingClearance: 180, availableToWithdraw: 0, pendingWithdrawal: 0, totalWithdrawn: 0 });
    expect((await withdraw(seller, 50)).status).toBe(403);
    expect(await balanceOf(ctx, seller)).toBe(180);
  });

  it('enforces the minimum (default 20, admin-configurable) and the available ceiling', async () => {
    await clearHold(ctx, seller);
    expect((await seller.client.get('/wallet/balance')).body.availableToWithdraw).toBe(180);
    expect((await withdraw(seller, 19)).status).toBe(403);
    expect((await withdraw(seller, 181)).status).toBe(403);
    expect((await withdraw(seller, 0)).status).toBe(400);
    expect((await withdraw(seller, -5)).status).toBe(400);

    // Only Super Admin may change the minimum; a raised minimum applies immediately.
    expect((await seller.client.post('/admin/platform-settings', { minWithdrawalWaveCoin: 100 })).status).toBe(403);
    expect((await admin.client.post('/admin/platform-settings', { minWithdrawalWaveCoin: 100 })).status).toBe(200);
    expect((await withdraw(seller, 50)).status).toBe(403);
    await admin.client.post('/admin/platform-settings', { minWithdrawalWaveCoin: 20 });
    expect(await balanceOf(ctx, seller)).toBe(180);
  });

  it('a request holds funds immediately, updates every balance figure, and cannot be re-spent', async () => {
    const res = await withdraw(seller, 60);
    expect(res.status).toBeLessThan(300);
    expect(res.body.status).toBe('pending');
    const w = (await seller.client.get('/wallet/balance')).body;
    expect(w.walletBalance).toBe(120);
    expect(w.pendingWithdrawal).toBe(60);
    expect(w.totalWithdrawn).toBe(0);
    // The 60 already left; only 120 of the 180 cleared earnings remain withdrawable.
    expect(w.availableToWithdraw).toBe(120);
    const tx = (await seller.client.get('/wallet/transactions')).body;
    expect(tx.find((t: any) => t.type === 'withdrawal' && t.amountWaveCoin === -60)).toBeDefined();
    await assertConserved(ctx);
  });

  it('cannot withdraw the same cleared earnings twice using unrelated balance (topped-up coins)', async () => {
    const rich = await registerUser(ctx, 'wrich');
    await credit(ctx, rich, 1000); // spendable top-up money, not earnings
    // Sell to `buyer` so `rich` has exactly 90 cleared earnings on top of 1000 top-up.
    await buyItem(ctx, rich, buyer, admin, 100, 'completed');
    await clearHold(ctx, rich);
    expect((await rich.client.get('/wallet/balance')).body.availableToWithdraw).toBe(90);

    expect((await withdraw(rich, 90)).status).toBeLessThan(300);
    // Earnings are exhausted: nothing more may be withdrawn even though balance is still 1000.
    expect((await rich.client.get('/wallet/balance')).body.availableToWithdraw).toBe(0);
    expect((await withdraw(rich, 90)).status).toBe(403);
    expect(await balanceOf(ctx, rich)).toBe(1000);
  });

  it('admin queue and processing are Super-Admin-only; rejecting needs a note and returns the funds', async () => {
    const pending = (await admin.client.get('/withdrawals/pending')).body;
    const mine = pending.find((p: any) => p.sellerId === seller.id);
    expect(mine.payoutDetails.iban).toBeDefined();
    expect((await seller.client.get('/withdrawals/pending')).status).toBe(403);
    const lead = await registerUser(ctx, 'wlead');
    await makeAdmin(ctx, lead, 'operation_lead');
    expect((await lead.client.get('/withdrawals/pending')).status).toBe(403);
    expect((await lead.client.post(`/withdrawals/${mine.id}/process`, { status: 'completed' })).status).toBe(403);

    expect((await admin.client.post(`/withdrawals/${mine.id}/process`, { status: 'rejected' })).status).toBe(400); // note required
    const before = await balanceOf(ctx, seller);
    const rejected = await admin.client.post(`/withdrawals/${mine.id}/process`, { status: 'rejected', note: 'IBAN invalid' });
    expect(rejected.status).toBe(200);
    expect(await balanceOf(ctx, seller)).toBe(before + 60);
    const w = (await seller.client.get('/wallet/balance')).body;
    expect(w.pendingWithdrawal).toBe(0);
    expect(w.availableToWithdraw).toBe(180);
    // Terminal: cannot be processed or re-rejected (which would credit twice).
    expect((await admin.client.post(`/withdrawals/${mine.id}/process`, { status: 'rejected', note: 'again' })).status).toBe(409);
    expect(await balanceOf(ctx, seller)).toBe(before + 60);
    expect(JSON.stringify((await seller.client.get('/notifications')).body)).toContain('withdrawal_status_changed');
  });

  it('pending → processing → completed counts as withdrawn and never returns funds', async () => {
    const req = (await withdraw(seller, 40)).body;
    const before = await balanceOf(ctx, seller);
    expect((await admin.client.post(`/withdrawals/${req.id}/process`, { status: 'processing' })).status).toBe(200);
    expect((await seller.client.post(`/withdrawals/${req.id}/cancel`)).status).toBe(409); // too late to cancel
    expect((await admin.client.post(`/withdrawals/${req.id}/process`, { status: 'completed' })).status).toBe(200);
    expect(await balanceOf(ctx, seller)).toBe(before);
    const w = (await seller.client.get('/wallet/balance')).body;
    expect(w.totalWithdrawn).toBe(40);
    expect(w.pendingWithdrawal).toBe(0);
    expect((await admin.client.post(`/withdrawals/${req.id}/process`, { status: 'rejected', note: 'too late' })).status).toBe(409);
    const audit = await ctx.dataSource.query(`SELECT 1 FROM audit_logs WHERE action = 'withdrawal.process'`);
    expect(audit.length).toBeGreaterThanOrEqual(3);
  });

  it('seller cancel of a pending request returns funds once, and only the owner may cancel', async () => {
    const req = (await withdraw(seller, 30)).body;
    const other = await registerUser(ctx, 'wother');
    expect((await other.client.post(`/withdrawals/${req.id}/cancel`)).status).toBe(403);
    const before = await balanceOf(ctx, seller);
    expect((await seller.client.post(`/withdrawals/${req.id}/cancel`)).status).toBe(200);
    expect(await balanceOf(ctx, seller)).toBe(before + 30);
    expect((await seller.client.post(`/withdrawals/${req.id}/cancel`)).status).toBe(409);
    expect(await balanceOf(ctx, seller)).toBe(before + 30);
  });
});
