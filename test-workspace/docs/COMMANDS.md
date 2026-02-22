# Commands Reference

Complete reference for all npm scripts and CLI commands. All npm commands must be run from the `frontend/` directory.

## Essential Daily Commands

```bash
# Development (from frontend/)
npm run dev                      # Dev server with Turbo (0.0.0.0:3000)
npm run dev:webpack              # Dev server with Webpack (for debugging)
npm run build                    # Production build

# Code Quality - MUST run before committing
npm run type-check               # TypeScript validation (CRITICAL)
npm run format                   # Prettier formatting
npm test                         # Run all tests

# Database
npm run db:health                # Check database health
npm run forums:ensure            # Ensure forum initialization
```

## Testing

```bash
npm test                         # Run all tests
npm test auth.test.ts            # Run specific test file
npm test -- --coverage           # Coverage report
npm test -- --watch              # Watch mode
```

## Code Quality

```bash
npm run type-check               # TypeScript validation (CRITICAL)
npm run format                   # Prettier formatting
npm run format:check             # Check formatting
npm run quality:full             # Type-check + test + build
# NOTE: ESLint disabled (npm run lint shows notice)
```

## Database Management

```bash
npm run db:health                # Check database health
npm run db:backup                # Backup all databases
npm run db:restore               # Restore from backup
npm run db:migrate               # Run database migrations
npm run forums:ensure            # Ensure forum initialization
npm run forums:check             # Diagnose forum setup
npm run forums:test              # Test forum API endpoints
npm run workspace:init           # Initialize workspace tables
npm run workspace:check          # Check workspace table status
```

## Database Encryption (Production)

```bash
npm run encrypt:migrate          # Encrypt all databases
npm run encrypt:migrate:dry-run  # Test encryption without changes
npm run encrypt:rotate           # Rotate encryption keys
npm run encrypt:status           # Check encryption status
npm run encrypt:performance      # Test encryption performance
```

## Scaling & Replication (Advanced)

```bash
npm run replica:setup            # Setup read replicas
npm run replica:add              # Add new replica
npm run replica:remove           # Remove replica
npm run replica:health           # Check replica health
npm run replica:sync             # Sync replicas
npm run replica:status           # View replica statistics
npm run scaling:monitor          # Monitor scaling status
```

## Performance & Monitoring

```bash
npm run perf:report              # Full performance report
npm run performance:lighthouse   # Lighthouse audit
npm run performance:monitor      # Start performance monitoring
npm run observability:setup      # Setup tracing and monitoring
npm run tracing:init             # Initialize tracing
npm run tracing:status           # Check tracing status
```

## Image Optimization

```bash
npm run optimize:images          # Optimize images
npm run optimize:images:clean    # Clean optimized images
npm run optimize:images:test     # Test optimization pipeline
npm run validate:images          # Validate image optimization
```

## Dependencies

```bash
npm run deps:audit               # Security audit
npm run deps:check               # Check for outdated dependencies
npm run deps:update:patch        # Update patch versions
npm run deps:update:minor        # Update minor versions
```

## Git Helpers

```bash
npm run commit "message"         # Stage all and commit
npm run commit:fix "message"     # Commit with 'fix:' prefix
npm run commit:feat "message"    # Commit with 'feat:' prefix
npm run commit:docs "message"    # Commit with 'docs:' prefix
```

## Troubleshooting Commands

```bash
npm run dev:doctor               # Diagnose dev issues
npm run dev:reset                # Clean reinstall
npm run dev:clean                # Remove build artifacts
npm run dev:setup                # Initial dev environment setup
```

## Server Management (from root directory)

```bash
# Using ./start-veritable-games.sh script (recommended - properly daemonizes)
./start-veritable-games.sh start       # Start dev server in background (survives terminal exit)
./start-veritable-games.sh stop        # Stop the dev server
./start-veritable-games.sh restart     # Restart the dev server
./start-veritable-games.sh status      # Check if server is running
./start-veritable-games.sh logs        # Show recent server logs
```

## Git Workflow

**Important:** Git operations run from root, npm commands run from `frontend/`

```bash
# From root directory
git status
git add .
git commit -m "Your message"
git push

# From frontend directory
npm run dev
npm run type-check
npm test
```

## Quick Reference Table

| Task | Command | Directory |
|------|---------|-----------|
| Start dev server (background) | `./start-veritable-games.sh start` | root |
| Start dev server (foreground) | `npm run dev` | frontend/ |
| Stop server | `./start-veritable-games.sh stop` | root |
| Run type-check before commit | `npm run type-check` | frontend/ |
| Check database health | `npm run db:health` | frontend/ |
| Run tests | `npm test` | frontend/ |
| Git commit | `git add . && git commit -m "msg"` | root |

## Build & Deployment

```bash
# Production build
npm run build                    # Standard build
npm run build:analyze            # Build with bundle analysis
npm run build:optimize           # Build with optimizations

# Analysis
npm run analyze                  # Analyze bundle size
```

## Notes

- **Monorepo Structure**: Root for git operations, `frontend/` for npm commands
- **Port Binding**: Dev server binds to 0.0.0.0 for network access
- **Turbo Mode**: Default dev mode uses Turbo, use `npm run dev:webpack` for debugging
- **Hooks**: Predev/prebuild hooks automatically run `ensure-forum-initialization.js`
