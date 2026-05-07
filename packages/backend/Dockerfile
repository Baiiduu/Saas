# ── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@8

# Copy root workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files (required for workspace dependency resolution)
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json

RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared-types ./packages/shared-types
COPY packages/backend ./packages/backend

# Build shared-types first, then backend
RUN pnpm --filter @saas/shared-types build
RUN pnpm --filter @saas/backend build

# ── Production stage ─────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN npm install -g pnpm@8

# Copy workspace configuration for node_modules resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json

# Copy node_modules from builder (retains workspace symlinks)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=builder /app/packages/shared-types/node_modules ./packages/shared-types/node_modules

# Copy built artifacts
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

WORKDIR /app/packages/backend

RUN npx prisma generate

EXPOSE 3000

CMD ["node", "dist/main"]
