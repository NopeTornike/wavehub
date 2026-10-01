-- Restores what the 2026-10-01 "hide everything" step changed (snapshot in ops_visibility_freeze).
-- Run on the VPS:
--   sudo docker compose exec -T postgres psql -U wavehub -d wavehubdb -v ON_ERROR_STOP=1 < scripts/visibility-restore.sql
-- Only rows still in the hidden state are touched. A listing its seller edited while hidden goes to
-- admin review instead of straight back to live, so unreviewed changes never go public.
BEGIN;
UPDATE listings l SET status = f.previous_status
  FROM ops_visibility_freeze f
  WHERE f.entity = 'listing' AND f.id = l.id AND l.status = 'draft' AND l."updatedAt" = f.previous_updated_at;
UPDATE listings l SET status = 'pending_review'
  FROM ops_visibility_freeze f
  WHERE f.entity = 'listing' AND f.id = l.id AND l.status = 'draft';
UPDATE coaches c SET status = f.previous_status
  FROM ops_visibility_freeze f
  WHERE f.entity = 'coach' AND f.id = c.id AND c.status = 'suspended';
UPDATE tournaments t SET status = f.previous_status
  FROM ops_visibility_freeze f
  WHERE f.entity = 'tournament' AND f.id = t.id AND t.status = 'draft';
ALTER TABLE ops_visibility_freeze RENAME TO ops_visibility_freeze_restored;
COMMIT;
