# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Copy godot package for dependencies (needed for imports)
COPY godot ./godot

# Build TypeScript (godot imports will resolve to ./godot/dist)
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Install postgresql-client for health checks and migrations
RUN apk add --no-cache postgresql-client

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/api/health/liveness', (r) => {if(r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 3002

# Start application
CMD ["node", "dist/router.js"]
