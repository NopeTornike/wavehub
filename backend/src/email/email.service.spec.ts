import { EmailService } from './email.service';

describe('EmailService', () => {
  const savedEnv = { ...process.env };
  const realFetch = global.fetch;
  afterEach(() => {
    process.env = { ...savedEnv };
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('defaults to console outside production and does not call fetch', async () => {
    delete process.env.EMAIL_PROVIDER;
    process.env.NODE_ENV = 'test';
    global.fetch = jest.fn() as unknown as typeof fetch;
    await new EmailService().send('a@b.com', 'Hi', 'body https://x/verify?token=abc');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('in production console mode never logs the body or the address', async () => {
    process.env.EMAIL_PROVIDER = 'console';
    process.env.NODE_ENV = 'production';
    const svc = new EmailService();
    const warn = jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);
    const log = jest.spyOn((svc as any).logger, 'log').mockImplementation(() => undefined);
    await svc.send('victim@example.org', 'Reset', 'secret-token-123');
    const logged = JSON.stringify([...warn.mock.calls, ...log.mock.calls]);
    expect(logged).not.toContain('secret-token-123');
    expect(logged).not.toContain('victim@');
  });

  it('requires an API key and sender for resend and rejects unknown providers', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    delete process.env.RESEND_API_KEY;
    expect(() => new EmailService()).toThrow(/RESEND_API_KEY/);
    process.env.EMAIL_PROVIDER = 'smtp2go';
    expect(() => new EmailService()).toThrow(/Unsupported EMAIL_PROVIDER/);
  });

  it('posts to the Resend API with a bearer token', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_key';
    process.env.EMAIL_FROM = 'WaveHub <no-reply@example.com>';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
    await new EmailService().send('user@example.com', 'Subject', 'Body');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.authorization).toBe('Bearer re_key');
    expect(JSON.parse(init.body)).toEqual({ from: 'WaveHub <no-reply@example.com>', to: ['user@example.com'], subject: 'Subject', text: 'Body' });
  });

  it('does not throw or retry on a 4xx, and retries once then swallows a 5xx/network error', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_key';
    process.env.EMAIL_FROM = 'a@b.com';
    const svc = new EmailService();
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);

    const four = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    global.fetch = four as unknown as typeof fetch;
    await expect(svc.send('u@example.com', 's', 'b')).resolves.toBeUndefined();
    expect(four).toHaveBeenCalledTimes(1);

    const five = jest.fn().mockRejectedValue(new Error('boom'));
    global.fetch = five as unknown as typeof fetch;
    await expect(svc.send('u@example.com', 's', 'b')).resolves.toBeUndefined();
    expect(five).toHaveBeenCalledTimes(2);
  });
});
