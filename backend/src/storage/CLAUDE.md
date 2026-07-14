# storage

## Purpose
File storage abstraction for anything a user uploads (currently: listing images). Every caller goes
through `StorageService.save()` so the actual backend (local disk today, real object storage later)
can be swapped without touching call sites.

## Key files
- `storage.service.ts` — `StorageService.save(buffer, originalName)`, writes to a local `uploads/`
  directory and returns a public URL under `BACKEND_PUBLIC_URL`
- `storage.module.ts` — exports `StorageService`

## Data model
None — writes to the filesystem (`<repo>/backend/uploads/`, gitignored), not the database.

## Conventions & gotchas
- **This is explicitly NOT production-ready.** Local disk storage breaks the moment there's more
  than one server instance (each instance has its own disk, so an image uploaded to instance A is
  404 from instance B) and doesn't survive a redeploy on most hosting platforms (ephemeral
  filesystem). This was a known open item in the build plan (S3 vs R2 vs local, deferred pending a
  real infra decision) — local disk was chosen to unblock Phase 3 (Listings) without waiting on
  that decision, not because it's the intended final answer.
- **Before any real deployment**: swap `StorageService`'s internals for a real object-storage SDK
  call (S3-compatible — AWS S3, Cloudflare R2, Backblaze B2 are all reasonable). Because every
  caller goes through the `save()` method and its `StoredFile { url }` return shape, this should be
  a contained change inside this one file, not a call-site-by-call-site migration.
- Files are served via `app.useStaticAssets()` in `main.ts` at `/uploads/*` — a real object-storage
  swap should keep returning a directly-fetchable URL (a signed URL or a public bucket URL) so
  callers don't need to change how they use the result.
- No virus/malware scanning exists (the source spec calls for it under chat/dispute file uploads;
  listing images aren't explicitly called out, but the principle applies to any user upload). Not
  built — flag this if file upload surface grows beyond listing images (e.g. delivery files, dispute
  evidence in later phases) before this becomes a real attack surface at scale.

## Related modules
- `backend/src/listings/` — the only current caller (`ListingsService.addImage`).
- Future `backend/src/orders/` (delivery files) and `backend/src/disputes/` (evidence uploads) will
  likely be callers too — reuse this service rather than reimplementing file handling per module.

## Status
Functional for local dev only. Needs a real object-storage backend and a decision on which provider
before any real deployment — see the gotcha above.
