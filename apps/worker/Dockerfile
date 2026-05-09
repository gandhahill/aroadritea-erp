# syntax=docker/dockerfile:1
# Worker Dockerfile — Aroadri Tea ERP
# Multi-stage: build → production

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm install --frozen-lockfile --prod

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @erp/worker build

FROM base AS runner
ENV NODE_ENV=production

# Install ca-certificates for HTTPS connections to Neon
RUN apk add --no-cache ca-certificates dumb-init

WORKDIR /app
COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=deps /app/node_modules ./node_modules

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
