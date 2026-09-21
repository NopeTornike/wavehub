import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EmailService } from '../src/email/email.service';
import { WalletService } from '../src/wallet/wallet.service';

export interface E2eApp {
  app: INestApplication;
  baseUrl: string;
  dataSource: DataSource;
  wallet: WalletService;
  sentEmails: { to: string; subject: string; body: string }[];
  close: () => Promise<void>;
}

// Mirrors main.ts's bootstrap (raw body, cookie parser, the same global ValidationPipe) on an
// ephemeral port, with EmailService swapped for a recorder so tests can read verification links.
export async function createApp(): Promise<E2eApp> {
  const sentEmails: E2eApp['sentEmails'] = [];
  // No @nestjs/testing dependency — patch the stub's `send` so tests can read verification links.
  EmailService.prototype.send = async (to: string, subject: string, body: string) => {
    sentEmails.push({ to, subject, body });
  };
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, logger: ['error'] });
  configureApp(app); // the same middleware/pipes/filters main.ts runs (TRUST_PROXY comes from e2e-env.ts)
  await app.listen(0);
  const baseUrl = await app.getUrl();
  return {
    app,
    baseUrl: baseUrl.replace('[::1]', 'localhost'),
    dataSource: app.get(DataSource),
    wallet: app.get(WalletService),
    sentEmails,
    close: () => app.close(),
  };
}

let ipCounter = 1;

// Every JSON response any Client receives, recorded so a spec can scan them all (see
// security.e2e-spec.ts's PII/secret-leak sweep).
export const recordedResponses: { method: string; path: string; status: number; body: any }[] = [];

// A cookie-jar HTTP client for one user. Every client gets a unique X-Forwarded-For so the
// per-IP throttles never collide between users.
export class Client {
  private cookie = '';
  private readonly ip = `10.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}.1`;
  constructor(private readonly baseUrl: string) {}

  async request(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': this.ip,
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      const pair = c.split(';')[0];
      if (pair.endsWith('=')) this.cookie = '';
      else this.cookie = pair;
    }
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body */
    }
    recordedResponses.push({ method, path, status: res.status, body: parsed });
    return { status: res.status, body: parsed };
  }

  // multipart/form-data upload of one file under the field name `file`.
  async upload(path: string, content: Buffer, filename: string, mime: string): Promise<{ status: number; body: any }> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(content)], { type: mime }), filename);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'x-forwarded-for': this.ip, ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: form,
    });
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body */
    }
    recordedResponses.push({ method: 'POST', path, status: res.status, body: parsed });
    return { status: res.status, body: parsed };
  }

  // Multipart upload (single `file` field) for evidence/delivery-file style endpoints.
  async upload(path: string, filename: string, mime: string, content: string): Promise<{ status: number; body: any }> {
    const form = new FormData();
    form.append('file', new Blob([content], { type: mime }), filename);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'x-forwarded-for': this.ip, ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: form,
    });
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body */
    }
    return { status: res.status, body: parsed };
  }

  get = (path: string) => this.request('GET', path);
  post = (path: string, body?: unknown) => this.request('POST', path, body ?? {});
  del = (path: string) => this.request('DELETE', path);
}

let userCounter = 0;

export interface TestUser {
  client: Client;
  id: string;
  username: string;
}

// Registers through the real API, follows the emailed verification link, and logs in.
export async function registerUser(ctx: E2eApp, prefix = 'user'): Promise<TestUser> {
  const username = `${prefix}${Date.now().toString(36)}${userCounter++}`;
  const password = 'E2ePassw0rd!';
  const client = new Client(ctx.baseUrl);
  const reg = await client.post('/auth/register', {
    username,
    email: `${username}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    password,
  });
  if (reg.status >= 300) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  const email = [...ctx.sentEmails].reverse().find((e) => e.to === `${username}@example.com`);
  const token = email?.body.match(/token=([a-f0-9]+)/)?.[1];
  if (!token) throw new Error('verification email not captured');
  const verify = await client.post('/auth/verify-email', { token });
  if (verify.status >= 300) throw new Error(`verify failed: ${verify.status}`);
  const login = await client.post('/auth/login', { username, password });
  if (login.status >= 300) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  return { client, id: login.body.user.id, username };
}

export async function makeAdmin(ctx: E2eApp, user: TestUser, role = 'super_admin'): Promise<void> {
  await ctx.dataSource.query(`UPDATE users SET "adminRole" = $1 WHERE id = $2`, [role, user.id]);
}

export async function credit(ctx: E2eApp, user: TestUser, amount: number): Promise<void> {
  await ctx.wallet.recordTopup(user.id, amount, `e2e-topup-${user.id}-${Date.now()}-${Math.random()}`);
}

export async function balanceOf(ctx: E2eApp, user: TestUser): Promise<number> {
  const rows = await ctx.dataSource.query(`SELECT "wavecoinBalance" FROM users WHERE id = $1`, [user.id]);
  return Number(rows[0].wavecoinBalance);
}

// Creates + submits + admin-approves an Item listing, returning its id.
export async function publishItemListing(ctx: E2eApp, seller: TestUser, admin: TestUser, priceWaveCoin: number): Promise<string> {
  const cats = await seller.client.get('/categories');
  const games = await seller.client.get('/games');
  // Seeded categories are all `service`-typed; the listing type, not the category, decides the flow.
  const category = cats.body[0];
  const created = await seller.client.post('/listings', {
    type: 'item',
    categoryId: category.id,
    gameId: games.body[0].id,
    title: `E2E item ${Math.random().toString(36).slice(2, 8)}`,
    description: 'An end-to-end test item listing, long enough to satisfy the 50 character minimum.',
    priceWaveCoin,
    stockQuantity: 5,
    isUnique: false,
    resaleRightsAttested: true,
  });
  if (created.status >= 300) throw new Error(`create listing failed: ${JSON.stringify(created.body)}`);
  const id = created.body.id;
  const submitted = await seller.client.post(`/listings/${id}/submit`);
  if (submitted.status >= 300) throw new Error(`submit failed: ${JSON.stringify(submitted.body)}`);
  const approved = await admin.client.post(`/listings/${id}/approve`);
  if (approved.status >= 300) throw new Error(`approve failed: ${JSON.stringify(approved.body)}`);
  return id;
}
