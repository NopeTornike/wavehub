import { createHash, createHmac } from 'crypto';

// Minimal S3-compatible "PUT object" client using AWS Signature V4 over plain `fetch` — no AWS SDK
// (a ~30MB dependency tree for one HTTP call). Works with AWS S3, Cloudflare R2, Backblaze B2,
// Hetzner Object Storage, MinIO, etc. Only PUT is needed: reads go straight to the public bucket
// / CDN URL (S3_PUBLIC_BASE_URL), never through this server.

export interface S3Config {
  endpoint: string; // e.g. https://<account>.r2.cloudflarestorage.com or https://s3.eu-central-1.amazonaws.com
  region: string; // 'auto' for R2
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

const sha256Hex = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string) => createHmac('sha256', key).update(data).digest();

export function deriveSigningKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, dateStamp), region), service), 'aws4_request');
}

// RFC 3986 encoding per path segment, as SigV4 requires (encodeURIComponent leaves !'()* alone).
const encodeSegment = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export interface SignedPut {
  url: string;
  headers: Record<string, string>;
}

// Pure (takes `now`) so it can be unit-tested against fixed vectors.
export function signPutObject(
  cfg: S3Config,
  key: string,
  body: Buffer,
  extraHeaders: Record<string, string>,
  now: Date = new Date(),
): SignedPut {
  const endpoint = new URL(cfg.endpoint);
  const encodedKey = key.split('/').map(encodeSegment).join('/');
  const host = cfg.forcePathStyle ? endpoint.host : `${cfg.bucket}.${endpoint.host}`;
  const path = cfg.forcePathStyle ? `/${encodeSegment(cfg.bucket)}/${encodedKey}` : `/${encodedKey}`;

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(extraHeaders).map(([k, v]) => [k.toLowerCase(), v])),
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const signedNames = Object.keys(headers).sort();
  const canonicalHeaders = signedNames.map((n) => `${n}:${headers[n].trim()}\n`).join('');
  const signedHeaders = signedNames.join(';');

  const canonicalRequest = ['PUT', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signature = createHmac('sha256', deriveSigningKey(cfg.secretAccessKey, dateStamp, cfg.region, 's3'))
    .update(stringToSign)
    .digest('hex');

  return {
    url: `${endpoint.protocol}//${host}${path}`,
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

export async function putObject(
  cfg: S3Config,
  key: string,
  body: Buffer,
  extraHeaders: Record<string, string>,
): Promise<void> {
  const { url, headers } = signPutObject(cfg, key, body, extraHeaders);
  const sendHeaders = { ...headers };
  delete sendHeaders.host; // fetch sets Host itself (it was only needed for signing)
  const res = await fetch(url, {
    method: 'PUT',
    headers: sendHeaders,
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    // The response body can echo bucket/key details — surface only the status to callers/logs.
    throw new Error(`S3 PUT failed with HTTP ${res.status}`);
  }
}
