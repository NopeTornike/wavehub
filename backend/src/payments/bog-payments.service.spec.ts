import { BogPaymentsService } from './bog-payments.service';

// Regression coverage for a real bug found against production BOG: omitting the Accept-Language
// header made BOG reject every order-creation call with "Invalid language *" (see this file's own
// comment on BOG_LANGUAGE_HEADER). Every BOG endpoint that opens/affects a checkout must send it.
describe('BogPaymentsService — Accept-Language header', () => {
  const savedEnv = { ...process.env };
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.BOG_CLIENT_ID = 'client-id';
    process.env.BOG_CLIENT_SECRET = 'client-secret';
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  function mockFetchSequence(...responses: Array<{ ok: boolean; json: () => Promise<unknown> }>) {
    const calls: Array<[string, RequestInit]> = [];
    let i = 0;
    global.fetch = jest.fn((url: any, init: any) => {
      calls.push([url, init]);
      const res = responses[Math.min(i, responses.length - 1)];
      i++;
      return Promise.resolve(res as any);
    }) as unknown as typeof fetch;
    return calls;
  }

  it('sends Accept-Language: ka when creating a WaveCoin top-up order', async () => {
    const calls = mockFetchSequence(
      { ok: true, json: async () => ({ access_token: 'tok' }) }, // oauth
      { ok: true, json: async () => ({ id: 'order-1', _links: { redirect: { href: 'https://pay' } } }) }, // order
    );
    const svc = new BogPaymentsService();
    await svc.createWavecoinOrder({
      amountGel: 10,
      wavecoins: 10,
      username: 'buyer',
      transactionId: 'tx-1',
      successUrl: 'https://x/ok',
      failUrl: 'https://x/fail',
      callbackUrl: 'https://x/callback',
    });
    const [, orderInit] = calls[1];
    expect((orderInit.headers as Record<string, string>)['Accept-Language']).toBe('ka');
  });

  it('sends Accept-Language: ka when creating a subscription order', async () => {
    const calls = mockFetchSequence(
      { ok: true, json: async () => ({ access_token: 'tok' }) },
      { ok: true, json: async () => ({ id: 'order-1', _links: { redirect: { href: 'https://pay' } } }) },
    );
    const svc = new BogPaymentsService();
    await svc.createSubscriptionOrder({
      amountGel: 20,
      planName: 'Pro',
      username: 'buyer',
      transactionId: 'tx-2',
      successUrl: 'https://x/ok',
      failUrl: 'https://x/fail',
      callbackUrl: 'https://x/callback',
    });
    const [, orderInit] = calls[1];
    expect((orderInit.headers as Record<string, string>)['Accept-Language']).toBe('ka');
  });

  it('sends Accept-Language: ka when charging a saved card', async () => {
    const calls = mockFetchSequence(
      { ok: true, json: async () => ({ access_token: 'tok' }) },
      { ok: true, json: async () => ({ id: 'charge-1' }) },
    );
    const svc = new BogPaymentsService();
    await svc.chargeSavedCard('parent-1', 'tx-3', 'https://x/callback');
    const [, chargeInit] = calls[1];
    expect((chargeInit.headers as Record<string, string>)['Accept-Language']).toBe('ka');
  });

  it('propagates BOG\'s real error message for the controller to log server-side (never shown to the client as-is — see bog-payments.controller.ts)', async () => {
    mockFetchSequence(
      { ok: true, json: async () => ({ access_token: 'tok' }) },
      { ok: false, json: async () => ({ message: 'Invalid language *' }) },
    );
    const svc = new BogPaymentsService();
    await expect(
      svc.createWavecoinOrder({
        amountGel: 10,
        wavecoins: 10,
        username: 'buyer',
        transactionId: 'tx-4',
        successUrl: 'https://x/ok',
        failUrl: 'https://x/fail',
        callbackUrl: 'https://x/callback',
      }),
    ).rejects.toThrow('Invalid language *');
  });
});
