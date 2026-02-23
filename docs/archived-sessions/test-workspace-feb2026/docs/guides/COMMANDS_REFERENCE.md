📍 **Navigation**: [CLAUDE.md](../../CLAUDE.md) > [docs/](../README.md) > [guides/](./README.md) > Commands Reference

---

# Complete Commands Reference

**Last Updated:** November 20, 2025

Complete reference for all npm scripts and commands in Veritable Games.

## Important Notes

- **All npm commands** must be run from the `frontend/` directory
- **Git commands** must be run from root directory
- **Server management** scripts (`./start-veritable-games.sh`) run from root directory

## Quick Reference

| Task | Command | Directory |
|------|---------|-----------|
| Start dev server (background) | `./start-veritable-games.sh start` | root |
| Start dev server (foreground) | `npm run dev` | frontend/ |
| Stop server | `./start-veritable-games.sh stop` | root |
| Type-check before commit | `npm run type-check` | frontend/ |
| Check database health | `npm run db:health` | frontend/ |
| Run tests | `npm test` | frontend/ |
| Git commit | `git add . && git commit -m "msg"` | root |

## Essential Daily Commands

### Development
```bash
# From frontend/ directory

npm run dev                      # Dev server with Turbopack (0.0.0.0:3000)
npm run dev:debug                # Dev server without Turbopack (for debugging)
npm run build                    # Production build with Turbopack
npm run start                    # Start production server
```

**Turbopack Notes:**
- Default for dev and production builds (Next.js 15.5+)
- Fastest build times (~30-40s for production)
- Use `dev:debug` if you need Webpack for debugging

### Code Quality (MUST run before committing)
```bash
npm run type-check               # TypeScript validation (CRITICAL)
npm run format                   # Prettier formatting
npm test                         # Run all tests
npm run quality:full             # Type-check + test + build (comprehensive)
```

**Note:** ESLint is disabled. Running `npm run lint` shows a notice.

### Database
```bash
npm run db:health                # Check database health
npm run db:backup                # Backup all databases
npm run db:restore               # Restore from backup
npm run db:migrate               # Run database migrations
npm run db:check-sequences       # Check PostgreSQL sequences
npm run db:fix-sequences         # Fix sequence issues
```

### PostgreSQL Management (Production)
```bash
npm run pg:test                  # Test PostgreSQL connection
npm run pg:create-schemas        # Create PostgreSQL schemas
npm run pg:cleanup               # Cleanup PostgreSQL schemas
npm run pg:migrate-schema        # Migrate schema to PostgreSQL
npm run pg:migrate-data          # Migrate data to PostgreSQL
```

### Development Utilities
```bash
npm run dev:doctor               # Diagnose environment issues
npm run dev:clean                # Clean build artifacts and cache
npm run dev:reset                # Complete reset (clean + setup)
npm run dev:setup                # Setup development environment
```

## Testing Commands

### Unit & Integration Tests
```bash
npm test                         # Run all tests
npm test auth.test.ts            # Run specific test file
npm test -- --coverage           # Coverage report
npm test -- --watch              # Watch mode
```

## Code Quality & Formatting

```bash
npm run type-check               # TypeScript validation (CRITICAL)
npm run format                   # Prettier formatting
npm run format:check             # Check formatting without changes
npm run quality:full             # Type-check + test + build
```

**Pre-commit Checklist:**
1. `npm run type-check` - CRITICAL (will fail in CI if errors)
2. `npm run format` - Format code
3. `npm test` - Run tests

## Database Management

### Basic Operations
```bash
npm run db:health                # Check database health
npm run db:backup                # Backup all databases
npm run db:restore               # Restore from backup
npm run db:migrate               # Run database migrations
```

### Workspace Tables
```bash
npm run workspace:init           # Initialize workspace tables
npm run workspace:check          # Check workspace table status
```

### Wiki Management
```bash
npm run wiki:reindex             # Rebuild wiki search index (FTS5)
npm run wiki:export              # Export wiki pages from DB to markdown files
npm run wiki:import              # Import markdown files back to wiki DB
npm run wiki:seed-categories     # Seed wiki categories
npm run wiki:list-orphaned       # List orphaned wiki pages
npm run wiki:detect-broken-links # Detect broken wikilinks
```

**Git-based Versioning:**
- Wiki pages are exported to markdown for version control
- Import/export workflow maintains database cache
- See `docs/wiki/WIKI_GIT_WORKFLOW.md` for complete workflow

## Database Encryption (Production)

**Optional** - For production deployments requiring encryption:

```bash
npm run encrypt:migrate          # Encrypt all databases
npm run encrypt:migrate:dry-run  # Test encryption without changes
npm run encrypt:rotate           # Rotate encryption keys
npm run encrypt:status           # Check encryption status
npm run encrypt:performance      # Test encryption performance
```

**Notes:**
- Not enabled by default
- Performance impact should be tested
- Requires `ENCRYPTION_KEY` in environment

## Scaling & Replication (Advanced)

**Optional** - For high-traffic deployments:

```bash
npm run replica:setup            # Setup read replicas
npm run replica:add              # Add new replica
npm run replica:remove           # Remove replica
npm run replica:health           # Check replica health
npm run replica:sync             # Sync replicas
npm run replica:status           # View replica statistics
npm run scaling:monitor          # Monitor scaling status
```

**Notes:**
- Scripts exist but not deployed by default
- See `docs/architecture/DATABASE_ARCHITECTURE.md` for details

## Performance & Monitoring

### Performance Analysis
```bash
npm run perf:report              # Full performance report
npm run performance:lighthouse   # Lighthouse audit
npm run performance:monitor      # Start performance monitoring
npm run test:image-pipeline      # Test image processing pipeline
npm run performance:ci           # CI performance checks
```

### Observability
```bash
npm run observability:setup      # Setup tracing and monitoring
npm run tracing:init             # Initialize tracing
npm run tracing:status           # Check tracing status
```

**Monitoring Endpoint:**
- `GET /api/metrics/performance` (dev/staging only)
- See `docs/PERFORMANCE_MONITORING.md` for details

## Image Optimization

```bash
npm run optimize:images          # Optimize images
npm run optimize:images:clean    # Clean optimized images
npm run optimize:images:test     # Test optimization pipeline
npm run validate:images          # Validate image optimization
```

**Supported formats:** AVIF, WebP
**Default sizes:** 640px, 1280px

## Dependency Management

### Auditing
```bash
npm run deps:audit               # Security audit
npm run deps:check               # Check for outdated dependencies
```

### Updating
```bash
npm run deps:update:patch        # Update patch versions (safe)
npm run deps:update:minor        # Update minor versions (review changes)
```

**Note:** Major version updates should be done manually after review.

## Git Helper Commands

**Note:** These stage ALL changes before committing.

```bash
npm run commit "message"         # Stage all and commit
npm run commit:fix "message"     # Commit with 'fix:' prefix
npm run commit:feat "message"    # Commit with 'feat:' prefix
npm run commit:docs "message"    # Commit with 'docs:' prefix
npm run commit:refactor "msg"    # Commit with 'refactor:' prefix
```

**Example:**
```bash
npm run commit:feat "add user search functionality"
# Equivalent to: git add . && git commit -m "feat: add user search functionality"
```

## Troubleshooting Commands

```bash
npm run dev:doctor               # Diagnose dev issues
npm run dev:reset                # Clean reinstall (removes node_modules, .next)
npm run dev:clean                # Remove build artifacts
npm run dev:setup                # Initial dev environment setup
```

**When to use:**
- `dev:doctor` - First step when something is broken
- `dev:clean` - Clear build cache after dependency changes
- `dev:reset` - Nuclear option, reinstalls everything

## Server Management (Root Directory)

**Using the `./start-veritable-games.sh` script (recommended):**

```bash
# From root directory
./start-veritable-games.sh start       # Start dev server in background (survives terminal exit)
./start-veritable-games.sh stop        # Stop the dev server
./start-veritable-games.sh restart     # Restart the dev server
./start-veritable-games.sh status      # Check if server is running
./start-veritable-games.sh logs        # Show recent server logs
```

**Benefits of `./start-veritable-games.sh`:**
- Properly daemonizes the process (uses `nohup` and `disown`)
- Server survives terminal closure
- Easy status checking

## Build Commands

### Development Build
```bash
npm run build                    # Production build with Turbopack
npm run build:webpack            # Production build with Webpack (fallback)
npm run build:analyze            # Build with bundle analysis
```

### Optimized Build
```bash
npm run build:optimize           # Optimize images + fonts + build
```

**Build times:**
- Turbopack: ~30-40 seconds
- Webpack: ~60-90 seconds

## Advanced Commands

### Bundle Analysis
```bash
npm run analyze                  # Analyze bundle size
npm run build:analyze            # Build + analyze
npm run optimize:bundle          # Bundle optimization report
```

### Git Hooks
```bash
npm run git:hooks                # Install git hooks (husky)
```

**Pre-commit hooks:**
- Type checking
- Format checking
- Tests

## Environment-Specific Commands

### Development (Default)
```bash
npm run dev                      # Development server
```

### Production
```bash
npm run build                    # Build for production
npm run start                    # Start production server
```

### Staging
Same as production, but with staging environment variables.

## Common Workflows

### First Time Setup
```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with secrets
npm install
npm run dev
```

### Before Committing
```bash
npm run type-check               # CRITICAL
npm run format
npm test
# If all pass:
cd ..
git add .
git commit -m "your message"
```

### Deployment
```bash
npm run type-check               # CRITICAL
npm run quality:full             # Full check
npm run build                    # Production build
# Deploy .next/ directory to server
```

### Troubleshooting Issues
```bash
npm run dev:doctor               # Diagnose
npm run dev:clean                # Clear cache
npm run dev                      # Try again
# If still broken:
npm run dev:reset                # Nuclear option
```

## Command Categories Summary

| Category | Count | Examples |
|----------|-------|----------|
| Development | 4 | dev, build, start |
| Code Quality | 4 | type-check, format, test |
| Database | 8 | db:health, db:backup, workspace:init |
| Testing | 4 | test, test:coverage |
| Encryption | 5 | encrypt:migrate, encrypt:status |
| Replication | 7 | replica:setup, replica:sync |
| Performance | 6 | perf:report, lighthouse, monitoring |
| Images | 4 | optimize:images, validate:images |
| Dependencies | 4 | deps:audit, deps:update:patch |
| Git Helpers | 5 | commit, commit:feat, commit:fix |
| Troubleshooting | 4 | dev:doctor, dev:reset, dev:clean |
| **Total** | **80+** | See package.json for complete list |

## Related Documentation

- **[CLAUDE.md](../../CLAUDE.md)** - Main development guide
- **[DEPLOYMENT.md](../DEPLOYMENT.md)** - Deployment procedures
- **[TROUBLESHOOTING.md](../TROUBLESHOOTING.md)** - Common issues
- **[PERFORMANCE_MONITORING.md](../PERFORMANCE_MONITORING.md)** - Performance monitoring
- **[DATABASE.md](../DATABASE.md)** - Database operations

## Notes

1. **Always from frontend/** - All npm commands run from frontend/ directory
2. **Type-check is critical** - Run before every commit
3. **Server management from root** - Use `./start-veritable-games.sh` script for proper daemonization
4. **Git commands from root** - All git operations from root directory
5. **Review package.json** - See frontend/package.json for all available scripts

---

**Total commands:** 80+ npm scripts
**Most used:** dev, type-check, format, test, db:health
**Before commit:** type-check (CRITICAL), format, test
