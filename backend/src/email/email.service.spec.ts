import nodemailer from 'nodemailer';
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

  it('requires SMTP_HOST and EMAIL_FROM for smtp', () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    delete process.env.SMTP_HOST;
    expect(() => new EmailService()).toThrow(/SMTP_HOST/);
  });

  it('sends via nodemailer for smtp, retries once on failure, then gives up without throwing', async () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.SMTP_HOST = 'host.docker.internal';
    process.env.EMAIL_FROM = 'WaveHub <no-reply@example.com>';
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;

    const sendMail = jest.fn().mockResolvedValueOnce(undefined);
    const createTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as any);

    const svc = new EmailService();
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'host.docker.internal', port: 587, secure: false, ignoreTLS: true, auth: undefined }),
    );
    await svc.send('user@example.com', 'Subject', 'Body');
    expect(sendMail).toHaveBeenCalledWith({
      from: 'WaveHub <no-reply@example.com>',
      to: 'user@example.com',
      subject: 'Subject',
      text: 'Body',
    });

    sendMail.mockReset().mockRejectedValue(new Error('connection refused'));
    const svc2 = new EmailService();
    const err = jest.spyOn((svc2 as any).logger, 'error').mockImplementation(() => undefined);
    jest.spyOn((svc2 as any).logger, 'warn').mockImplementation(() => undefined);
    await expect(svc2.send('u@example.com', 's', 'b')).resolves.toBeUndefined();
    expect(sendMail).toHaveBeenCalledTimes(2); // one retry
    expect(err).toHaveBeenCalled();
  });

  it('passes SMTP_USER/SMTP_PASSWORD as auth when both are set', () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASSWORD = 'pass';
    process.env.EMAIL_FROM = 'a@b.com';
    const createTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: jest.fn() } as any);
    new EmailService();
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.example.com', port: 465, secure: true, ignoreTLS: false, auth: { user: 'user', pass: 'pass' } }),
    );
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
