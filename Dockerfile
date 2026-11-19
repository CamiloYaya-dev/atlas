# NOVZI API — production image (Node 22, npm workspaces)
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/fixtures/package.json ./packages/fixtures/package.json
RUN npm ci

COPY apps/api ./apps/api
COPY packages/contracts ./packages/contracts
COPY packages/fixtures ./packages/fixtures
RUN npm run build:api

FROM node:22-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/fixtures/package.json ./packages/fixtures/package.json
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/migrations ./apps/api/migrations
COPY --from=builder /app/packages/contracts/src ./packages/contracts/src
COPY --from=builder /app/packages/fixtures/src ./packages/fixtures/src
WORKDIR /app/apps/api
USER node
EXPOSE 3001
# Run only pending schema migrations, then start API. A failure stops startup and fails health checks.
CMD ["sh", "-c", "node dist/db/migrate.js && exec node dist/server.js"]
