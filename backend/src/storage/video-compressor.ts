import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { setPriority, tmpdir } from 'os';
import { join } from 'path';

// Re-encodes an uploaded video to a small web MP4 (owner 2026-11-06: coach videos up to 25MB,
// compressed by the server): H.264 + AAC, longest side ≤1280 (720p), ≤30 fps, CRF 28, faststart so
// it starts playing before it has fully downloaded. Needs the `ffmpeg` binary (installed in
// backend/Dockerfile; FFMPEG_PATH overrides). Without it, compress() returns null and callers keep
// the original file.
//
// Jobs run one at a time, capped to 2 codec threads and at the lowest CPU priority, so a burst of
// uploads never slows the site down (a 30s phone clip takes a few seconds; ~21MB → ~3MB).
const TIMEOUT_MS = 10 * 60_000;

@Injectable()
export class VideoCompressor {
  private readonly logger = new Logger(VideoCompressor.name);
  private readonly bin = process.env.FFMPEG_PATH || 'ffmpeg';
  private missing = false;
  private queue: Promise<unknown> = Promise.resolve();

  /** The compressed MP4, or null when ffmpeg is missing or the input can't be decoded. */
  compress(input: Buffer): Promise<Buffer | null> {
    const job = this.queue.then(() => this.run(input));
    this.queue = job.catch(() => undefined);
    return job;
  }

  /** Resolves once every queued job has finished (tests). */
  idle(): Promise<void> {
    return this.queue.then(() => undefined);
  }

  private async run(input: Buffer): Promise<Buffer | null> {
    if (this.missing) return null;
    const dir = await mkdtemp(join(tmpdir(), 'wh-video-'));
    try {
      const src = join(dir, 'in');
      const out = join(dir, 'out.mp4');
      await writeFile(src, input);
      const even = (expr: string) => `trunc(${expr}/2)*2`;
      const scale = `scale='if(gte(iw,ih),${even('min(1280,iw)')},-2)':'if(gte(iw,ih),-2,${even('min(1280,ih)')})'`;
      const ok = await this.ffmpeg([
        '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-filter_threads', '1', '-i', src,
        '-map', '0:v:0', '-map', '0:a:0?',
        '-vf', scale, '-fpsmax', '30',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-threads', '2',
        '-c:a', 'aac', '-b:a', '96k', '-ac', '2',
        '-movflags', '+faststart', out,
      ]);
      return ok ? await readFile(out) : null;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private ffmpeg(args: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(this.bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      if (child.pid) {
        try {
          setPriority(child.pid, 19);
        } catch {
          // Not allowed here — it still runs, just at normal priority.
        }
      }
      let stderr = '';
      child.stderr.on('data', (d: Buffer) => {
        if (stderr.length < 2000) stderr += d.toString();
      });
      const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
      child.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (err.code === 'ENOENT') {
          this.missing = true;
          this.logger.warn(`ffmpeg not found (${this.bin}) — uploaded videos are kept uncompressed`);
        } else {
          this.logger.error('ffmpeg failed to start', err);
        }
        resolve(false);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) this.logger.warn(`Video compression failed (exit ${code}): ${stderr.trim().slice(0, 300)}`);
        resolve(code === 0);
      });
    });
  }
}
