import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Client } from 'pg';
import { sniffFileType } from './file-sniff';
import { putObject, S3Config } from './s3-client';
import { resolveUploadsDir } from './storage.service';

// One-off move of the local upload folder into S3-compatible storage (storage/CLAUDE.md "Moving to
// object storage"). Dry run by default; `--apply` uploads every file under the same key the s3
// driver uses (uploads/<name>) and rewrites every stored URL from
// `${BACKEND_PUBLIC_URL}/uploads/` to `${S3_PUBLIC_BASE_URL}/uploads/` in all text/varchar/jsonb
// columns. Safe to re-run (same keys, already-rewritten URLs no longer match). Run inside the
// backend container with the S3_* variables set, BEFORE switching STORAGE_DRIVER=s3:
//   node --conditions=wavehub-node-prod dist/storage/move-uploads-to-s3.js [--apply]
async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const need = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL', 'BACKEND_PUBLIC_URL'];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing ${missing.join(', ')}`);
  const region = process.env.S3_REGION || 'auto';
  const s3: S3Config = {
    endpoint: process.env.S3_ENDPOINT || `https://s3.${region}.amazonaws.com`,
    region,
    bucket: process.env.S3_BUCKET as string,
    accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') !== 'false',
  };
  const from = `${(process.env.BACKEND_PUBLIC_URL as string).replace(/\/+$/, '')}/uploads/`;
  const to = `${(process.env.S3_PUBLIC_BASE_URL as string).replace(/\/+$/, '')}/uploads/`;

  const dir = resolveUploadsDir();
  const files = (await readdir(dir, { withFileTypes: true })).filter((f) => f.isFile() && /^[0-9a-f-]{36}\.\w+$/.test(f.name));
  let uploaded = 0;
  let skipped = 0;
  for (const f of files) {
    const buffer = await readFile(join(dir, f.name));
    const sniffed = sniffFileType(buffer);
    if (!sniffed) {
      skipped++;
      continue;
    }
    if (apply) {
      const inline = sniffed.isImage || !!sniffed.isVideo;
      await putObject(s3, `uploads/${f.name}`, buffer, {
        'content-type': sniffed.mime,
        'cache-control': 'public, max-age=31536000, immutable',
        ...(inline ? {} : { 'content-disposition': 'attachment' }),
      });
    }
    uploaded++;
  }
  console.log(`${apply ? 'Uploaded' : 'Would upload'} ${uploaded} files (${skipped} unrecognised skipped) from ${dir}`);

  const db = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5432,
    user: process.env.DATABASE_USER || 'wavehub',
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'wavehubdb',
  });
  await db.connect();
  try {
    const cols = await db.query(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND data_type IN ('character varying', 'text', 'jsonb', 'ARRAY')`,
    );
    for (const c of cols.rows as Array<{ table_name: string; column_name: string; data_type: string }>) {
      const t = `"${c.table_name.replace(/"/g, '')}"`;
      const col = `"${c.column_name.replace(/"/g, '')}"`;
      const asText = c.data_type === 'jsonb' || c.data_type === 'ARRAY' ? `${col}::text` : col;
      const hits = Number((await db.query(`SELECT count(*)::int AS n FROM ${t} WHERE ${asText} LIKE $1`, [`%${from}%`])).rows[0].n);
      if (!hits) continue;
      console.log(`${apply ? 'Rewriting' : 'Would rewrite'} ${hits} row(s) in ${c.table_name}.${c.column_name}`);
      if (!apply) continue;
      const set =
        c.data_type === 'jsonb'
          ? `replace(${col}::text, $1, $2)::jsonb`
          : c.data_type === 'ARRAY'
            ? `(SELECT array_agg(replace(x, $1, $2)) FROM unnest(${col}) x)`
            : `replace(${col}, $1, $2)`;
      await db.query(`UPDATE ${t} SET ${col} = ${set} WHERE ${asText} LIKE $3`, [from, to, `%${from}%`]);
    }
  } finally {
    await db.end();
  }
  if (!apply) console.log('Dry run — nothing changed. Re-run with --apply, then set STORAGE_DRIVER=s3 and restart the backend.');
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
