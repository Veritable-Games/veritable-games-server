# Docker Build Reference

## Build System

**Build tool:** Nixpacks (Coolify)

Nixpacks automatically detects the project type and creates an optimized Docker build configuration.

## Files Excluded from Production Builds

Configured in `.dockerignore`:

### Documentation
- `docs/` - Documentation folder (not deployed)
- `*.md` files (except README.md at root)

### Scripts
- `scripts/debug/` - Debug utilities
- `scripts/migrations/` - Migration scripts (run manually)
- `scripts/gallery/` - Gallery management
- `scripts/user-management/` - User management tools

### Development Data
- `data/*.db` - SQLite databases (not needed in production)
- Development environment files

### Testing Files
- `*.test.ts` - Test files
- `*.spec.ts` - Spec files
- `__tests__/` - Test directories
- `jest.config.js` - Jest configuration
- `jest.setup.js` - Jest setup

### IDE and Cache
- `.vscode/`
- `.idea/`
- `node_modules/.cache/`
- `.next/cache/`

## Files Included in Production

### Application Source
- `src/` - All application source code
- `public/` - Public assets (images, fonts, etc.)
- `package.json` - Dependencies
- `package-lock.json` - Dependency lock

### Configuration
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `.env` files (if present, though env vars preferred)

### Essential Scripts
Production scripts (maintenance utilities that may be needed)

### Node Modules
- Rebuilt during build process for production environment
- Only production dependencies included

## Build Process

### 1. Detection Phase
Nixpacks detects:
- Node.js project (via package.json)
- Next.js framework (via next.config.js)
- Required Node version (from package.json engines field)

### 2. Build Phase
```bash
# Install dependencies
npm ci --only=production

# Build Next.js application
npm run build

# Optimize for production
# (Next.js automatically optimizes bundles, images, etc.)
```

### 3. Runtime Phase
```bash
# Start production server
npm start
# or
node server.js  # if custom server
```

## Build Optimization

### Next.js Optimizations
- Static page generation where possible
- Image optimization (WebP, lazy loading)
- Code splitting and tree shaking
- Minification and compression

### Docker Layer Caching
- Dependencies cached in separate layer
- Source code in later layer
- Faster rebuilds when only code changes

### Multi-Stage Build
Nixpacks uses multi-stage builds:
1. **Build stage**: Install all deps, build application
2. **Runtime stage**: Copy only production artifacts
3. Result: Smaller final image

## Build Configuration

### Environment Variables Used During Build

```bash
NODE_ENV=production              # Production mode
NEXT_TELEMETRY_DISABLED=1       # Disable Next.js telemetry
```

### Build-Time vs Runtime Variables

**Build-time** (baked into bundle):
- `NEXT_PUBLIC_*` variables
- Used in client-side code

**Runtime** (read from environment):
- `DATABASE_URL`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- Server-side only variables

## Troubleshooting Build Issues

### Build Fails with Missing Dependencies

Check package.json:
- All required dependencies listed?
- Correct versions specified?
- No missing peer dependencies?

### Build Succeeds but App Crashes

Check:
- Environment variables set in Coolify
- `DATABASE_URL` is set
- All required secrets present

### Build Takes Too Long

- Check network connectivity to npm registry
- Consider using npm cache
- Review build logs for bottlenecks

### Out of Memory During Build

- Increase build container memory in Coolify
- Optimize dependencies (remove unused packages)
- Check for memory leaks in build scripts

## Build Verification

### After Successful Build

```bash
# Check container is running
docker ps | grep m4s0kwo4kc4oooocck4sswc4

# Verify environment variables
docker inspect m4s0kwo4kc4oooocck4sswc4 \
  --format='{{range .Config.Env}}{{println .}}{{end}}'

# Check application logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50

# Test application endpoint
curl -I https://www.veritablegames.com
```

## Manual Build (Development)

For local development testing:

```bash
cd /home/user/veritable-games-site

# Install dependencies
npm install

# Build application
npm run build

# Test production build locally
npm start
```

## Deployment Build Process

When you push to GitHub:

1. **Coolify detects commit** (via webhook or polling)
2. **Pulls latest code** from GitHub
3. **Runs Nixpacks build** (2-5 minutes)
4. **Creates Docker image**
5. **Stops old container**
6. **Starts new container** (rolling update)
7. **Verifies health** (HTTP checks)
8. **Routes traffic** to new container

If build or deployment fails, old container continues running.
