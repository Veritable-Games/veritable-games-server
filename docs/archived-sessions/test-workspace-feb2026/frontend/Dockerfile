# syntax=docker/dockerfile:1

# Stage 1: Install dependencies (including devDependencies for build)
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (needed for build - includes devDependencies)
# Skip better-sqlite3 rebuild - production uses PostgreSQL only
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# Stage 2: Build the application
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Build arguments for environment variables needed during build
ARG NEXT_PUBLIC_APP_VERSION
ARG NODE_ENV=production

# Copy all dependencies from deps stage (includes devDependencies for build)
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Copy environment template (will be overridden by runtime env)
RUN cp -n .env.example .env.local || true

# Build Next.js application with required environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=${NODE_ENV}
ENV DATABASE_MODE=postgres
# CRITICAL: Mark this as build phase so database adapter skips initialization
# This prevents "Failed to collect page data" errors during Turbopack page collection
ENV NEXT_IS_BUILD=true

RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy scripts directory for migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Copy WebSocket server and required dependencies
COPY --from=builder --chown=nextjs:nodejs /app/server ./server
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy source files needed by WebSocket server (database adapter, logger, utils)
# tsx resolves @/ path aliases, so we need the complete lib structure
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/database ./src/lib/database
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/utils ./src/lib/utils
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Create data directory for SQLite databases
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Copy startup script
COPY --from=builder --chown=nextjs:nodejs /app/start-production.sh ./start-production.sh
RUN chmod +x ./start-production.sh

# Set user
USER nextjs

# Expose ports (3000 for Next.js, 3002 for WebSocket)
EXPOSE 3000 3002

# Set hostname to bind to all interfaces
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
ENV WS_PORT=3002

# Health check (checks both Next.js and WebSocket servers)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start both Next.js and WebSocket servers
CMD ["./start-production.sh"]
