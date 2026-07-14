import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join, extname } from 'path';

export interface StoredFile {
  url: string;
}

// Local-disk implementation, standing in for real object storage (S3/R2/etc.) — see
// backend/src/storage/CLAUDE.md for why this is NOT production-ready as-is (doesn't survive
// redeploys, doesn't work with more than one server instance) and what needs to change before it
// is. Every caller goes through this interface's `save` method, so swapping the implementation
// later doesn't require touching call sites.
@Injectable()
export class StorageService {
  private readonly uploadsDir = join(process.cwd(), 'uploads');

  async save(buffer: Buffer, originalName: string): Promise<StoredFile> {
    await mkdir(this.uploadsDir, { recursive: true });
    const filename = `${randomUUID()}${extname(originalName).toLowerCase()}`;
    await writeFile(join(this.uploadsDir, filename), buffer);

    const publicBaseUrl = process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000';
    return { url: `${publicBaseUrl}/uploads/${filename}` };
  }
}
