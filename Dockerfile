# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps
#   Install all production + dev dependencies using pnpm so the build stage
#   has access to TypeScript, Vite, esbuild, etc.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Copy manifests first for layer-cache efficiency
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install all dependencies (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — builder
#   Compile the React frontend with Vite and bundle the Express server with
#   esbuild into /app/dist.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Build: Vite compiles client → dist/public; esbuild bundles server → dist/index.js
RUN pnpm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runner
#   Lean production image. Only the compiled output and production deps are
#   included. The drizzle migration files are copied so the entrypoint can
#   run migrations on first boot.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Install mysql-client so the entrypoint can wait for MySQL to be ready
RUN apk add --no-cache mysql-client bash

WORKDIR /app

# Copy package manifests and install production-only deps
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy drizzle schema + migrations (needed for drizzle-kit migrate at runtime)
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy shared constants (referenced by compiled server bundle)
COPY --from=builder /app/shared ./shared

# Copy the entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose the application port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
