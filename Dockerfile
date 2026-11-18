# NOVZI API — production image (Node 22, npm workspaces)
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Resolve the monorepo workspaces before installing.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/fixtures/package.json ./packages/fixtures/package.json
RUN npm ci

# Compile the API, database migrator and one-time admin bootstrap.
COPY apps/api ./apps/api
COPY packages/contracts ./packages/contracts
COPY packages/fixtures ./packages/fixtures
RUN npm run build:api

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
WORKDIR /app

# Production-only dependencies. Runtime code is already compiled.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/fixtures/package.json ./packages/fixtures/package.json
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/migrations ./apps/api/migrations
# Keep workspace paths required by package exports (bundled API code normally embeds them).
COPY --from=builder /app/packages/contracts/src ./packages/contracts/src
COPY --from=builder /app/packages/fixtures/src ./packages/fixtures/src

WORKDIR /app/apps/api
USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]
