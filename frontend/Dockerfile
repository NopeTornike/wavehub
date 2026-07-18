# Build context is the MONOREPO ROOT (see docker-compose.yml's `context: .`), not this directory —
# same reasoning as backend/Dockerfile: this is an npm workspaces monorepo and a `frontend`-only
# build context can't resolve the `@wavehub/shared-types` workspace dependency. Replaces an earlier
# version that built from `./frontend` and predated the workspaces migration.
#
# Single stage, not a slimmed multi-stage build, for the same "never run against a real Docker
# daemon, correctness over size" reasoning as backend/Dockerfile.
FROM node:22-alpine
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm install

COPY . .
RUN npm run frontend:build

EXPOSE 3000
CMD ["npm", "run", "frontend:start"]
