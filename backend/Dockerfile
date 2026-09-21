# Build context is the MONOREPO ROOT (see docker-compose.yml's `context: .`), not this directory —
# this is an npm workspaces monorepo (backend imports `@wavehub/shared-types` from
# ../packages/shared-types via the workspace symlink), so a `backend`-only build context can't
# resolve that dependency at all.
#
# Single stage on purpose: isolating just one workspace's production dependencies inside a
# multi-stage npm-workspaces build is easy to get subtly wrong, and this file has never been run
# against a real Docker daemon by its authors — correctness over image size. (The image is larger
# than necessary because the frontend's dependencies are installed too; harmless.)
FROM node:22-alpine
WORKDIR /app

# Manifests first for layer caching — every workspace's package.json is needed for `npm ci` to
# resolve the workspace graph, even though only the backend's code runs from this image.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci

COPY . .
# Builds packages/shared-types (-> dist/, used at runtime via `--conditions=wavehub-node-prod`, see
# packages/shared-types/package.json — its `main` is raw TypeScript, which plain `node` can't load)
# and then the backend itself.
RUN npm run backend:build

# Non-root runtime user. /data/uploads is the mount point for the uploads volume (UPLOADS_DIR);
# it must exist and be owned by `node` BEFORE Docker initialises the named volume, or the volume
# comes up root-owned and uploads fail with EACCES.
RUN mkdir -p /data/uploads && chown -R node:node /data /app/backend
COPY --chmod=755 backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENV NODE_ENV=production \
    PORT=4000 \
    UPLOADS_DIR=/data/uploads
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:4000/health || exit 1

# Runs pending migrations, then starts the server (see the script for RUN_MIGRATIONS).
ENTRYPOINT ["docker-entrypoint.sh"]
