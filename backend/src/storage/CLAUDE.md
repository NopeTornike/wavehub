# storage

## Purpose
File storage for everything a user uploads (listing images, order delivery files, dispute evidence,
tournament covers). Every caller goes through `StorageService.save()`; the backend driver is chosen
by `STORAGE_DRIVER`.

## Key files
- `storage.service.ts` — `StorageService.save(buffer, originalName, kind = 'attachment')` →
  `{ url, contentType }`. `kind: 'image'` accepts only JPG/PNG/WEBP; `'attachment'` also accepts
  PDF/ZIP. Drivers:
  - **`local`** (default) — writes to `UPLOADS_DIR` (default `./uploads`; `/data/uploads` in the
    Docker image, a named volume) and returns `${BACKEND_PUBLIC_URL}/uploads/<name>`; `app.setup.ts`
    serves that directory at `/uploads`.
  - **`s3`** — any S3-compatible object store (AWS S3, Cloudflare R2, Backblaze B2, Hetzner, MinIO)
    via `s3-client.ts`: a ~100-line AWS SigV4 `PUT` over `fetch`, **no AWS SDK**. Objects go under
    `uploads/<uuid>.<ext>` with `Cache-Control: immutable` (and `Content-Disposition: attachment`
    for PDF/ZIP). Returns `${S3_PUBLIC_BASE_URL}/uploads/<name>` — reads never touch this server, so
    the bucket must be publicly readable (or fronted by a CDN). Env: `S3_ENDPOINT`, `S3_REGION`,
    `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`,
    `S3_FORCE_PATH_STYLE` (default true; false = virtual-hosted style). The service throws at
    construction if the required ones are missing.
- `file-sniff.ts` — `sniffFileType(buffer)`: identifies JPEG/PNG/WEBP/PDF/ZIP by magic bytes.
- `s3-client.ts` — SigV4 signer (`signPutObject`, unit-tested) + `putObject`.
- `storage.module.ts` — exports `StorageService`.
- `storage.spec.ts` — sniffing, local driver, path-traversal/disguised-file rejection, signer.

## Data model
None — files only. Callers persist the returned `url` (and `contentType`) in their own tables.

## Conventions & gotchas
- **Never trust the client's filename or Content-Type.** `save()` sniffs the bytes and derives both
  the extension and the stored content type from what it finds; the object name is always a fresh
  UUID, so `../` tricks in a filename are inert. A file that isn't a recognised type → HTTP 415.
  Before this, callers checked `file.mimetype` and kept `originalname`'s extension, so `evil.html`
  labelled `image/png` was stored and served as `text/html` from the API origin (stored XSS). Call
  sites still keep their own mimetype/size checks (cheap, give friendlier errors) but the sniff is
  the real gate. Callers persist `stored.contentType`, not `file.mimetype`.
- **Local files are served hardened** (`app.setup.ts`): `X-Content-Type-Options: nosniff`, a
  `Content-Security-Policy: default-src 'none'; sandbox`, immutable caching, and
  `Content-Disposition: attachment` for anything that isn't a jpg/png/webp. Defence in depth on top
  of the sniff.
- **Local disk is single-server only**: it survives restarts (named volume, included in
  `scripts/backup.sh`) but not a server loss, and won't work with more than one backend instance.
  Use `s3` for anything else.
- **Body size limits**: multer per-route limits (5 MB images, 20 MB attachments) + Caddy's 25 MB
  `request_body` cap. Upload routes are also rate-limited (`common/throttle.ts` `UPLOAD_THROTTLE`).
- Uploading to S3 fails closed: a provider error is logged (status only) and the client gets a
  generic 503; nothing is recorded in the database.
- No malware/virus scanning (the source spec asks for it on chat/dispute uploads). Type is validated
  by content, but a malicious-yet-valid PDF/ZIP is possible; ZIPs are served as downloads only.
- Switching drivers later doesn't migrate existing files; old rows keep their old absolute URLs.

## Related modules
- `backend/src/listings/`, `orders/`, `disputes/`, `tournaments/` — the callers.
- `backend/src/app.setup.ts` — serves `/uploads` for the local driver.
- `backend/src/config/production-config.ts` — validates the `s3` settings in production.

## Status
Local driver verified end to end in the e2e suite (real upload, disguised-html rejection, served
headers). The S3 driver's signer is unit-tested against the SigV4 spec (signing-key vector from
AWS's docs + a cross-check with an independent implementation) but **has never been run against a
real S3/R2/B2 endpoint** — do a real upload during launch verification.
