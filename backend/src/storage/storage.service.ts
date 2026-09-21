import { Injectable, Logger, ServiceUnavailableException, UnsupportedMediaTypeException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { sniffFileType } from './file-sniff';
import { putObject, S3Config } from './s3-client';

export interface StoredFile {
  url: string;
  // The type detected from the file's bytes (never the client-declared one) — persist this, not
  // `file.mimetype`.
  contentType: string;
}

export type UploadKind = 'image' | 'attachment';

export function resolveUploadsDir(): string {
  return process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
}

// Pluggable upload storage, selected by STORAGE_DRIVER: `local` (default — files under
// UPLOADS_DIR, served by main.ts at /uploads) or `s3` (any S3-compatible object store; see
// s3-client.ts). Every caller goes through `save()`, so drivers are swappable without touching
// call sites. See backend/src/storage/CLAUDE.md.
//
// Regardless of driver, `save()` identifies the file by its bytes and derives the stored key/
// extension from that — the client's filename and Content-Type are never trusted (see
// file-sniff.ts), and the key is always a fresh UUID so path traversal via the filename is
// impossible.
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  private s3?: S3Config;

  constructor() {
    if (this.driver === 's3') {
      const region = process.env.S3_REGION || 'auto';
      const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? 'true') !== 'false';
      this.s3 = {
        endpoint: process.env.S3_ENDPOINT || `https://s3.${region}.amazonaws.com`,
        region,
        bucket: process.env.S3_BUCKET || '',
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        forcePathStyle,
      };
      if (!this.s3.bucket || !this.s3.accessKeyId || !this.s3.secretAccessKey || !process.env.S3_PUBLIC_BASE_URL) {
        throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_BASE_URL');
      }
    } else if (this.driver !== 'local') {
      throw new Error(`Unsupported STORAGE_DRIVER "${this.driver}" (use "local" or "s3")`);
    }
  }

  async save(buffer: Buffer, _originalName: string, kind: UploadKind = 'attachment'): Promise<StoredFile> {
    const sniffed = sniffFileType(buffer);
    if (!sniffed || (kind === 'image' && !sniffed.isImage)) {
      throw new UnsupportedMediaTypeException(
        kind === 'image' ? 'File is not a valid JPG, PNG, or WEBP image' : 'File is not a valid JPG, PNG, WEBP, PDF, or ZIP file',
      );
    }
    const filename = `${randomUUID()}${sniffed.ext}`;

    if (this.s3) {
      try {
        await putObject(this.s3, `uploads/${filename}`, buffer, {
          'content-type': sniffed.mime,
          'cache-control': 'public, max-age=31536000, immutable',
          ...(sniffed.isImage ? {} : { 'content-disposition': 'attachment' }),
        });
      } catch (err) {
        this.logger.error('Object storage upload failed', err as Error);
        throw new ServiceUnavailableException('File storage is temporarily unavailable');
      }
      const base = (process.env.S3_PUBLIC_BASE_URL as string).replace(/\/+$/, '');
      return { url: `${base}/uploads/${filename}`, contentType: sniffed.mime };
    }

    const dir = resolveUploadsDir();
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);
    const publicBaseUrl = (process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000').replace(/\/+$/, '');
    return { url: `${publicBaseUrl}/uploads/${filename}`, contentType: sniffed.mime };
  }
}
