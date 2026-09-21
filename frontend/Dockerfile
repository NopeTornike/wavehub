# Build context is the MONOREPO ROOT (see docker-compose.yml's `context: .`), not this directory —
# same reasoning as backend/Dockerfile: this is an npm workspaces monorepo and a `frontend`-only
# build context can't resolve the `@wavehub/shared-types` workspace dependency.
#
# Single stage, not a slimmed multi-stage build, for the same "correctness over size" reasoning as
# backend/Dockerfile.
FROM node:22-alpine
WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the browser bundle at BUILD time — changing the API URL
# means rebuilding this image, not just restarting it. For the single-domain Caddy setup this is
# https://<your-domain>/api (see docs/DEPLOY.md).
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci

COPY . .
RUN npm run frontend:build

# Non-root runtime. Next writes to .next/cache at runtime, so that directory must be writable.
RUN chown -R node:node /app/frontend/.next
USER node
ENV NODE_ENV=production

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["npm", "run", "frontend:start"]
