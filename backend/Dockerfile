# Build context is the MONOREPO ROOT (see docker-compose.yml's `context: .`), not this directory —
# this is an npm workspaces monorepo (backend imports `@wavehub/shared-types` from
# ../packages/shared-types via the workspace symlink), so a `backend`-only build context can't
# resolve that dependency at all. This file replaces an earlier version that built from
# `./backend` and predated the workspaces migration — see backend/CLAUDE.md and root CLAUDE.md's
# monorepo note.
#
# Deliberately a single stage, not a slimmed multi-stage build: isolating just one workspace's
# production dependencies inside a multi-stage npm-workspaces build is easy to get subtly wrong,
# and this Dockerfile has never been run against a real Docker daemon (no Docker available in the
# sandbox that wrote it — see root CLAUDE.md). Correctness over image size until someone can
# actually verify a leaner build works.
FROM node:22-alpine
WORKDIR /app

# Copy just the package manifests first for better layer caching — every workspace's package.json
# is needed for `npm install` to resolve the workspace graph correctly, even though only backend's
# code will run from this image.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm install

COPY . .
RUN npm run backend:build

EXPOSE 4000
CMD ["node", "backend/dist/main.js"]
