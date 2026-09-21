import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { UnsupportedMediaTypeException } from '@nestjs/common';
import { sniffFileType } from './file-sniff';
import { deriveSigningKey, signPutObject } from './s3-client';
import { StorageService } from './storage.service';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('rest')]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PDF = Buffer.from('%PDF-1.7\n...');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBPVP8 ')]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

describe('sniffFileType', () => {
  it('recognises the supported formats by magic bytes', () => {
    expect(sniffFileType(PNG)?.mime).toBe('image/png');
    expect(sniffFileType(JPG)?.mime).toBe('image/jpeg');
    expect(sniffFileType(WEBP)?.mime).toBe('image/webp');
    expect(sniffFileType(PDF)).toMatchObject({ mime: 'application/pdf', isImage: false });
    expect(sniffFileType(ZIP)).toMatchObject({ mime: 'application/zip', isImage: false });
  });

  it('rejects html, svg, scripts, empty and truncated input', () => {
    expect(sniffFileType(HTML)).toBeNull();
    expect(sniffFileType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffFileType(Buffer.alloc(0))).toBeNull();
    expect(sniffFileType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('StorageService (local driver)', () => {
  let dir: string;
  const saved = { ...process.env };
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'wavehub-uploads-'));
    process.env.UPLOADS_DIR = dir;
    process.env.BACKEND_PUBLIC_URL = 'https://example.com/api/';
    delete process.env.STORAGE_DRIVER;
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = { ...saved };
  });

  it('stores under a random uuid name with the sniffed extension, ignoring the client filename', async () => {
    const stored = await new StorageService().save(PNG, '../../etc/evil.html');
    expect(stored.contentType).toBe('image/png');
    expect(stored.url).toMatch(/^https:\/\/example\.com\/api\/uploads\/[0-9a-f-]{36}\.png$/);
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(readFileSync(join(dir, files[0])).equals(PNG)).toBe(true);
  });

  it('refuses html disguised as an image and non-images where an image is required', async () => {
    const svc = new StorageService();
    await expect(svc.save(HTML, 'x.png', 'image')).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    await expect(svc.save(HTML, 'x.pdf')).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    await expect(svc.save(PDF, 'x.pdf', 'image')).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it('accepts documents when the kind is attachment', async () => {
    const svc = new StorageService();
    expect((await svc.save(PDF, 'a.pdf')).contentType).toBe('application/pdf');
    expect((await svc.save(ZIP, 'a.zip')).url).toMatch(/\.zip$/);
  });

  it('rejects an unsupported driver and an under-configured s3 driver at construction', () => {
    process.env.STORAGE_DRIVER = 'ftp';
    expect(() => new StorageService()).toThrow(/Unsupported STORAGE_DRIVER/);
    process.env.STORAGE_DRIVER = 's3';
    expect(() => new StorageService()).toThrow(/requires S3_BUCKET/);
  });
});

describe('S3 SigV4 signer', () => {
  it('derives the documented AWS example signing key', () => {
    expect(deriveSigningKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20120215', 'us-east-1', 'iam').toString('hex')).toBe(
      'f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d',
    );
  });

  // Expected value cross-checked against an independent Python implementation of the SigV4 spec
  // (inputs mirror AWS's documented PUT Object example). Not verified against a live S3 endpoint.
  it('signs the AWS-documented PUT Object example inputs consistently with an independent SigV4 implementation', () => {
    const signed = signPutObject(
      {
        endpoint: 'https://s3.amazonaws.com',
        region: 'us-east-1',
        bucket: 'examplebucket',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
        forcePathStyle: false,
      },
      'test$file.text',
      Buffer.from('Welcome to Amazon S3.'),
      { date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY' },
      new Date('2013-05-24T00:00:00Z'),
    );
    expect(signed.url).toBe('https://examplebucket.s3.amazonaws.com/test%24file.text');
    expect(signed.headers.authorization).toContain(
      'SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class, Signature=7c0f3caf24a16d5948905b8ebf67d29fb415e93fddaed9ca6aeb5ac2348cfee4',
    );
  });

  it('builds a path-style URL when forced', () => {
    const signed = signPutObject(
      { endpoint: 'https://acct.r2.cloudflarestorage.com', region: 'auto', bucket: 'wave', accessKeyId: 'k', secretAccessKey: 's', forcePathStyle: true },
      'uploads/a.png',
      Buffer.from('x'),
      { 'content-type': 'image/png' },
    );
    expect(signed.url).toBe('https://acct.r2.cloudflarestorage.com/wave/uploads/a.png');
  });
});
