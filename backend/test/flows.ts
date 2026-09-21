import { E2eApp, publishItemListing, TestUser } from './helpers';

// Drives an Item order from purchase up to the requested stage.
export async function buyItem(
  ctx: E2eApp,
  seller: TestUser,
  buyer: TestUser,
  admin: TestUser,
  price: number,
  upTo: 'paid' | 'in_progress' | 'delivered' | 'completed' = 'paid',
): Promise<string> {
  const listingId = await publishItemListing(ctx, seller, admin, price);
  const purchase = await buyer.client.post('/orders', { listingId });
  if (purchase.status >= 300) throw new Error(`purchase failed: ${JSON.stringify(purchase.body)}`);
  const id = purchase.body.id;
  if (upTo === 'paid') return id;
  await seller.client.post(`/orders/${id}/start`);
  if (upTo === 'in_progress') return id;
  await seller.client.post(`/orders/${id}/deliver`);
  if (upTo === 'delivered') return id;
  const acc = await buyer.client.post(`/orders/${id}/accept`);
  if (acc.status >= 300) throw new Error(`accept failed: ${JSON.stringify(acc.body)}`);
  return id;
}

// Makes every earning of a user withdrawable by backdating the 7-day hold.
export async function clearHold(ctx: E2eApp, user: TestUser): Promise<void> {
  await ctx.dataSource.query(
    `UPDATE wallet_ledger_entries SET "availableAt" = now() - interval '1 day' WHERE "userId" = $1 AND "availableAt" IS NOT NULL`,
    [user.id],
  );
}

// Global WaveCoin conservation: every coin ever topped up is in a user balance, escrowed in an
// open order/session, taken as a platform fee on a completed one, or paid out via a live
// withdrawal. Also asserts each user's balance equals the sum of their own ledger rows.
export async function assertConserved(ctx: E2eApp): Promise<void> {
  const q = async (sql: string) => Number((await ctx.dataSource.query(sql))[0].v);
  const balances = await q(`SELECT COALESCE(SUM("wavecoinBalance"),0) v FROM users`);
  const ledger = await q(`SELECT COALESCE(SUM("amountWaveCoin"),0) v FROM wallet_ledger_entries`);
  expect(balances).toBe(ledger);
  const bad = await ctx.dataSource.query(
    `SELECT u.id FROM users u WHERE u."wavecoinBalance" <> COALESCE((SELECT SUM(e."amountWaveCoin") FROM wallet_ledger_entries e WHERE e."userId" = u.id),0)`,
  );
  expect(bad).toHaveLength(0);
  const topups = await q(`SELECT COALESCE(SUM("amountWaveCoin"),0) v FROM wallet_ledger_entries WHERE type = 'topup'`);
  const withdrawalNet = await q(`SELECT COALESCE(SUM("amountWaveCoin"),0) v FROM wallet_ledger_entries WHERE type = 'withdrawal'`);
  const orderEscrow = await q(`SELECT COALESCE(SUM("priceWaveCoin"),0) v FROM orders WHERE status NOT IN ('completed','cancelled','refunded')`);
  const orderFees = await q(`SELECT COALESCE(SUM("priceWaveCoin" - "sellerPayoutWaveCoin"),0) v FROM orders WHERE status = 'completed'`);
  const sessEscrow = await q(`SELECT COALESCE(SUM("priceWaveCoin"),0) v FROM coaching_sessions WHERE status = 'scheduled'`);
  const sessFees = await q(`SELECT COALESCE(SUM("priceWaveCoin" - "coachPayoutWaveCoin"),0) v FROM coaching_sessions WHERE status = 'completed'`);
  expect(balances).toBe(topups + withdrawalNet - orderEscrow - orderFees - sessEscrow - sessFees);
}
