import { createSign, generateKeyPairSync } from 'crypto';
import { assertConserved } from './flows';
import { balanceOf, createApp, E2eApp, makeAdmin, registerUser, TestUser } from './helpers';
import { BogPaymentsService } from '../src/payments/bog-payments.service';

// A test RSA keypair stands in for BOG's: verifyBogCallbackSignature already reads its public key
// from BOG_CALLBACK_PUBLIC_KEY at call time, so no production seam is needed — the suite signs
// callbacks with the private half. BogPaymentsService's outbound HTTP calls are replaced on the
// prototype (like EmailService in helpers.ts); nothing here ever reaches api.bog.ge.
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const other = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const sign = (raw: string, key = privateKey) => createSign('RSA-SHA256').update(raw).end().sign(key, 'base64');

describe('BOG callbacks with real RSA signatures (e2e)', () => {
  let ctx: E2eApp;
  let admin: TestUser;
  let user: TestUser;
  const bogOrders = new Map<string, { orderStatus: string; externalOrderId?: string }>();
  let bogSeq = 0;
  let saveCardCalls: string[] = [];
  let saveCardShouldFail = false;
  const restore: (() => void)[] = [];

  async function callback(bogOrderId: string, opts: { signWith?: string | null; tamper?: boolean; raw?: string } = {}, path = '/payments/bog/callback') {
    const raw = opts.raw ?? JSON.stringify({ event: 'order_payment', body: { order_id: bogOrderId } });
    const signature = opts.signWith === null ? undefined : sign(raw, opts.signWith ?? privateKey);
    const res = await fetch(`${ctx.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.99.0.1', ...(signature ? { 'callback-signature': signature } : {}) },
      body: opts.tamper ? raw.replace(bogOrderId, `${bogOrderId}x`) : raw,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  beforeAll(async () => {
    process.env.BOG_CALLBACK_PUBLIC_KEY = publicKey;
    ctx = await createApp();
    const proto = BogPaymentsService.prototype as any;
    const patch = (name: string, fn: (...a: any[]) => any) => {
      const orig = proto[name];
      proto[name] = fn;
      restore.push(() => (proto[name] = orig));
    };
    patch('getOrderDetails', async (id: string) => {
      const o = bogOrders.get(id);
      if (!o) throw new Error(`BOG lookup failed for ${id}`);
      return o;
    });
    patch('createWavecoinOrder', async () => ({ orderId: `bog-topup-${++bogSeq}`, redirectUrl: 'https://pay.example/redirect' }));
    patch('createSubscriptionOrder', async () => ({ orderId: `bog-sub-${++bogSeq}`, redirectUrl: 'https://pay.example/redirect' }));
    patch('saveCard', async (orderId: string) => {
      saveCardCalls.push(orderId);
      if (saveCardShouldFail) throw new Error('BOG save-card failed');
    });
    admin = await registerUser(ctx, 'padmin');
    await makeAdmin(ctx, admin);
    user = await registerUser(ctx, 'payer');
  });
  afterAll(async () => {
    await assertConserved(ctx);
    restore.forEach((r) => r());
    delete process.env.BOG_CALLBACK_PUBLIC_KEY;
    await ctx.close();
  });

  describe('WaveCoin top-up', () => {
    const urls = { successUrl: 'http://localhost:3000/wallet?ok=1', failUrl: 'http://localhost:3000/wallet?fail=1' };
    const intentFor = async (bogOrderId: string) => (await ctx.dataSource.query(`SELECT * FROM bog_topup_intents WHERE "bogOrderId" = $1`, [bogOrderId]))[0];
    async function newIntent(u: TestUser, amountGel: number): Promise<{ bogOrderId: string; intentId: string }> {
      const res = await u.client.post('/payments/bog/create-order', { amountGel, ...urls });
      expect(res.status).toBeLessThan(300);
      const intent = await intentFor(res.body.orderId);
      return { bogOrderId: res.body.orderId, intentId: intent.id };
    }

    it('create-order is validated: same-origin URLs only, positive amount, no client-supplied WaveCoin count', async () => {
      const anon = await registerUser(ctx, 'payanon');
      expect((await anon.client.post('/payments/bog/create-order', { amountGel: 10, successUrl: 'https://evil.example/x', failUrl: urls.failUrl })).status).toBe(400);
      expect((await anon.client.post('/payments/bog/create-order', { amountGel: 0, ...urls })).status).toBe(400);
      expect((await anon.client.post('/payments/bog/create-order', { amountGel: 10, wavecoins: 9999, ...urls })).status).toBe(400);
      expect(await ctx.dataSource.query(`SELECT 1 FROM bog_topup_intents WHERE "userId" = $1`, [anon.id])).toHaveLength(0);
    });

    it('ignores callbacks with a missing, wrong-key, or tampered signature — nothing is credited', async () => {
      const { bogOrderId, intentId } = await newIntent(user, 40);
      bogOrders.set(bogOrderId, { orderStatus: 'completed', externalOrderId: intentId });
      const before = await balanceOf(ctx, user);

      for (const attempt of [{ signWith: null }, { signWith: other.privateKey }, { tamper: true }, { raw: '{"body":{"order_id":"' + bogOrderId + '"}}', signWith: 'not-a-key' }]) {
        const res = await callback(bogOrderId, attempt as any).catch(() => ({ status: 200 }));
        expect(res.status).toBe(200); // always 200 so BOG doesn't retry a permanently rejected call
      }
      expect(await balanceOf(ctx, user)).toBe(before);
      expect((await intentFor(bogOrderId)).status).toBe('pending');
    });

    it('a validly signed completed callback credits exactly the paid amount 1:1, once', async () => {
      const { bogOrderId, intentId } = await newIntent(user, 60);
      const before = await balanceOf(ctx, user);

      // Not completed yet → nothing.
      bogOrders.set(bogOrderId, { orderStatus: 'created', externalOrderId: intentId });
      await callback(bogOrderId);
      expect(await balanceOf(ctx, user)).toBe(before);

      bogOrders.set(bogOrderId, { orderStatus: 'completed', externalOrderId: intentId });
      expect((await callback(bogOrderId)).body).toEqual({ ok: true });
      expect(await balanceOf(ctx, user)).toBe(before + 60);
      expect((await intentFor(bogOrderId)).status).toBe('completed');
      const ledger = await ctx.dataSource.query(`SELECT "amountWaveCoin" a FROM wallet_ledger_entries WHERE reference = $1`, [intentId]);
      expect(ledger).toHaveLength(1);
      expect(ledger[0].a).toBe(60);

      // BOG retries / replays: sequential and a concurrent burst — still exactly one credit.
      for (let i = 0; i < 3; i++) await callback(bogOrderId);
      await Promise.all(Array.from({ length: 6 }, () => callback(bogOrderId)));
      expect(await balanceOf(ctx, user)).toBe(before + 60);
      expect(await ctx.dataSource.query(`SELECT 1 FROM wallet_ledger_entries WHERE reference = $1`, [intentId])).toHaveLength(1);
      await assertConserved(ctx);
    });

    it('a concurrent burst of first-time completed callbacks also credits once', async () => {
      const { bogOrderId, intentId } = await newIntent(user, 25);
      bogOrders.set(bogOrderId, { orderStatus: 'completed', externalOrderId: intentId });
      const before = await balanceOf(ctx, user);
      const results = await Promise.all(Array.from({ length: 6 }, () => callback(bogOrderId)));
      expect(results.every((r) => r.status === 200)).toBe(true); // a lost race must not surface as a 500 that BOG retries forever
      expect(await balanceOf(ctx, user)).toBe(before + 25);
    });

    it('credits the intent owner, not whoever is named in the callback; unknown orders and lookup failures credit nothing', async () => {
      const victim = await registerUser(ctx, 'payvictim');
      const { bogOrderId, intentId } = await newIntent(victim, 15);
      bogOrders.set(bogOrderId, { orderStatus: 'completed', externalOrderId: intentId });
      const userBefore = await balanceOf(ctx, user);
      await callback(bogOrderId);
      expect(await balanceOf(ctx, victim)).toBe(15);
      expect(await balanceOf(ctx, user)).toBe(userBefore);

      bogOrders.set('bog-ghost', { orderStatus: 'completed', externalOrderId: '00000000-0000-4000-8000-000000000000' });
      expect((await callback('bog-ghost')).status).toBe(200);
      expect((await callback('bog-never-registered')).status).toBe(200); // getOrderDetails throws
      expect((await callback('x', { raw: '{"body":{}}' })).status).toBe(200); // no order_id
      expect(await balanceOf(ctx, user)).toBe(userBefore);
    });

    it('a rejected payment marks the intent failed and credits nothing', async () => {
      const { bogOrderId, intentId } = await newIntent(user, 33);
      bogOrders.set(bogOrderId, { orderStatus: 'rejected', externalOrderId: intentId });
      const before = await balanceOf(ctx, user);
      await callback(bogOrderId);
      expect((await intentFor(bogOrderId)).status).toBe('failed');
      expect(await balanceOf(ctx, user)).toBe(before);
    });
  });

  describe('subscriptions', () => {
    let planId: string;
    let subscriber: TestUser;
    const urls = { successUrl: 'http://localhost:3000/plans?ok=1', failUrl: 'http://localhost:3000/plans?fail=1' };
    const attemptFor = async (bogOrderId: string) => (await ctx.dataSource.query(`SELECT * FROM subscription_charge_attempts WHERE "bogOrderId" = $1`, [bogOrderId]))[0];
    const subs = async (u: TestUser) => ctx.dataSource.query(`SELECT * FROM user_subscriptions WHERE "userId" = $1`, [u.id]);
    const cb = (id: string, o = {}) => callback(id, o, '/subscriptions/bog-callback');

    beforeAll(async () => {
      const plan = await admin.client.post('/admin/subscription-plans', {
        audience: 'seller_coach', tier: 'cb', name: 'Callback Plan', description: 'Plan used by the BOG callback tests.', priceGel: 20,
        perks: { platformFeeDiscountPercent: 4 },
      });
      planId = plan.body.id;
      subscriber = await registerUser(ctx, 'subber');
    });

    async function checkout(u: TestUser) {
      const res = await u.client.post('/subscriptions/checkout', { planId, ...urls });
      expect(res.status).toBeLessThan(300);
      const attempt = await attemptFor(res.body.orderId);
      return { bogOrderId: res.body.orderId as string, attemptId: attempt.id as string };
    }

    it('unsigned / wrongly signed subscription callbacks change nothing', async () => {
      const { bogOrderId, attemptId } = await checkout(subscriber);
      bogOrders.set(bogOrderId, { orderStatus: 'completed', externalOrderId: attemptId });
      await cb(bogOrderId, { signWith: null });
      await cb(bogOrderId, { signWith: other.privateKey });
      await cb(bogOrderId, { tamper: true });
      expect(await subs(subscriber)).toHaveLength(0);
      expect((await attemptFor(bogOrderId)).status).toBe('pending');
      expect(saveCardCalls).toHaveLength(0);
    });

    it('a failed card-save leaves the checkout pending (no subscription); a later retry activates it', async () => {
      const { bogOrderId, attemptId } = await checkout(subscriber);
      // (the previous attempt is still pending; only this one is completed at BOG)
      bogOrders.set(bogOrderId, { orderStatus: 'completed', externalOrderId: attemptId });
      saveCardShouldFail = true;
      await cb(bogOrderId);
      saveCardShouldFail = false;
      expect(await subs(subscriber)).toHaveLength(0);
      expect((await attemptFor(bogOrderId)).status).toBe('pending');

      await cb(bogOrderId); // BOG retries
      const rows = await subs(subscriber);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: 'active', bogParentOrderId: bogOrderId, audience: 'seller_coach' });
      const days = (new Date(rows[0].currentPeriodEnd).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(28);
      expect(days).toBeLessThan(32);
      expect((await attemptFor(bogOrderId)).status).toBe('completed');
      expect(saveCardCalls.filter((c) => c === bogOrderId).length).toBe(2); // once failed, once ok
    });

    it('replays and concurrent duplicates never create a second subscription or re-save the card', async () => {
      const calls = saveCardCalls.length;
      const { bogOrderId } = await attemptForSub(subscriber);
      for (let i = 0; i < 3; i++) await cb(bogOrderId);
      await Promise.all(Array.from({ length: 5 }, () => cb(bogOrderId)));
      expect(await subs(subscriber)).toHaveLength(1);
      expect(saveCardCalls.length).toBe(calls);

      // Same-user concurrent first-time completion on a fresh attempt pair: DB partial unique index holds.
      const dup = await registerUser(ctx, 'dupsub');
      const a = await checkout(dup);
      bogOrders.set(a.bogOrderId, { orderStatus: 'completed', externalOrderId: a.attemptId });
      const results = await Promise.all(Array.from({ length: 5 }, () => cb(a.bogOrderId)));
      expect(results.every((r) => r.status === 200)).toBe(true);
      expect(await subs(dup)).toHaveLength(1);
    });

    async function attemptForSub(u: TestUser) {
      const [s] = await subs(u);
      return { bogOrderId: s.bogParentOrderId as string, subId: s.id as string };
    }

    it('an active subscriber cannot start another checkout', async () => {
      const res = await subscriber.client.post('/subscriptions/checkout', { planId, ...urls });
      expect(res.status).toBe(403);
      expect((await subscriber.client.get('/subscriptions/mine')).body).toHaveLength(1);
    });

    it('a rejected checkout marks the attempt failed and grants nothing', async () => {
      const loser = await registerUser(ctx, 'subloser');
      const { bogOrderId, attemptId } = await checkout(loser);
      bogOrders.set(bogOrderId, { orderStatus: 'rejected', externalOrderId: attemptId });
      await cb(bogOrderId);
      expect((await attemptFor(bogOrderId)).status).toBe('failed');
      expect(await subs(loser)).toHaveLength(0);
    });

    it('recharge callbacks extend an active period, revive past_due, and a rejected one flips to past_due', async () => {
      const { subId } = await attemptForSub(subscriber);
      const insertRecharge = async (id: string, bogOrderId: string) =>
        ctx.dataSource.query(
          `INSERT INTO subscription_charge_attempts (id, kind, "userId", "subscriptionId", "amountGel", status, "bogOrderId") VALUES ($1,'recharge',$2,$3,20,'pending',$4)`,
          [id, subscriber.id, subId, bogOrderId],
        );
      const { randomUUID } = await import('crypto');

      const ok = randomUUID();
      await insertRecharge(ok, 'bog-recharge-ok');
      await ctx.dataSource.query(`UPDATE user_subscriptions SET status = 'past_due', "currentPeriodEnd" = now() - interval '2 days' WHERE id = $1`, [subId]);
      bogOrders.set('bog-recharge-ok', { orderStatus: 'completed', externalOrderId: ok });
      await cb('bog-recharge-ok');
      await cb('bog-recharge-ok'); // replay must not extend twice
      const [revived] = await subs(subscriber);
      expect(revived.status).toBe('active');
      const days = (new Date(revived.currentPeriodEnd).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(28); // anchored from now, one period only
      expect(days).toBeLessThan(32);

      const bad = randomUUID();
      await insertRecharge(bad, 'bog-recharge-bad');
      bogOrders.set('bog-recharge-bad', { orderStatus: 'rejected', externalOrderId: bad });
      await cb('bog-recharge-bad');
      expect((await subs(subscriber))[0].status).toBe('past_due');
      expect((await ctx.dataSource.query(`SELECT status FROM subscription_charge_attempts WHERE id = $1`, [bad]))[0].status).toBe('failed');
    });
  });
});
