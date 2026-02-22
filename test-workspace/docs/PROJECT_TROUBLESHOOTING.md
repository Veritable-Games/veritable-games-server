# Troubleshooting Guide

Solutions to common errors and issues you may encounter during development.

## Port Already in Use (EADDRINUSE)

**Problem**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use the server management script
./start-veritable-games.sh stop
```

## Database Locked or Connection Errors

**Problem**: `SQLITE_BUSY: database is locked` or connection pool errors

**Solution**:
```bash
# Check database health
cd frontend
npm run db:health

# Restart the server to reset connection pool
cd .. && ./start-veritable-games.sh restart
```

## TypeScript Errors During Build

**Problem**: Build fails with TypeScript errors that don't appear in VSCode

**Solution**:
```bash
# Run type-check to see all errors
cd frontend
npm run type-check

# Common issue: params not awaited (Next.js 15)
# See hydration-prevention.md for async params patterns
```

## Server Won't Start: Conflicting Dynamic Routes

**Problem**: Next.js throws error about conflicting dynamic route parameters.

**Cause**: Two route directories exist at the same path level with different parameter names:
```
/api/projects/[slug]/references/[id]/route.ts
/api/projects/[slug]/references/[imageId]/route.ts
```

**Solution**: Remove the duplicate directory. Keep only one parameter name per route level.

```bash
# Find conflicting routes
find frontend/src/app -type d -name "\[*\]" | sort

# Remove duplicate (keep the one with GET handler)
rm -rf frontend/src/app/api/projects/\[slug\]/references/\[id\]
```

## Server Stops After Starting

**Problem**: Server starts successfully but dies when terminal closes.

**Cause**: Process not properly daemonized.

**Solution**: Use the provided server management scripts which use `nohup` and `disown`:
```bash
./start-veritable-games.sh start        # Properly daemonizes the server
./start-veritable-games.sh status       # Check if still running
```

## Forum/Database Not Initialized

**Problem**: Forum pages return errors or database tables don't exist

**Solution**:
```bash
cd frontend
npm run forums:ensure  # Initializes forum tables and categories
npm run db:health      # Verify all databases are healthy
```

## Forum Search Not Working

**Problem**: Search returns no results or is very slow

**Cause**: `forum_search_fts` FTS5 table is missing from forums.db

**Solution**:
```bash
cd frontend
# Create FTS5 table and triggers (script needs to be created)
node scripts/create-forum-fts5-table.js

# Or manually via SQLite:
sqlite3 data/forums.db << 'EOF'
CREATE VIRTUAL TABLE forum_search_fts USING fts5(
  content_id UNINDEXED,
  content_type UNINDEXED,
  title,
  content,
  author_username,
  category_name,
  tokenize='porter unicode61 remove_diacritics 2'
);

-- Add triggers for automatic sync (see pool.ts lines 483-571 for full triggers)
EOF
```

## Forums Database Too Large

**Problem**: `forums.db` is 9+ MB despite having only 23 topics and 90 replies

**Cause**: Database contains duplicate wiki/project tables and 18K misplaced monitoring logs

**Solution**:
```bash
cd frontend
# Backup first!
cp data/forums.db data/forums.db.backup

# Remove duplicate tables (create cleanup script)
sqlite3 data/forums.db << 'EOF'
-- Remove wiki duplicates
DROP TABLE IF EXISTS wiki_pages;
DROP TABLE IF EXISTS wiki_revisions;
DROP TABLE IF EXISTS wiki_categories;

-- Remove project duplicates
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS project_metadata;

-- Remove library duplicates
DROP TABLE IF EXISTS library_documents;
DROP TABLE IF EXISTS library_categories;

-- Remove monitoring tables (should be in system.db)
DROP TABLE IF EXISTS resource_usage;
DROP TABLE IF EXISTS memory_metrics;
DROP TABLE IF EXISTS apm_request_metrics;

-- Remove user duplicates
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS user_sessions;

VACUUM; -- Reclaim space
EOF

# Expected: 9.2 MB → ~500 KB (94% reduction)
```

**Detailed Cleanup Procedure**: See the devops-build-optimizer agent's comprehensive cleanup plan with migration scripts, safety procedures, and rollback steps.

## Common Runtime Warnings

These warnings may appear during development but are expected behavior:

### 1. SIGTERM database connection warnings
- `Received SIGTERM. Closing database connections...`
- Expected during hot reload, not an error

### 2. Turbopack multiple lockfiles warning
- Multiple package-lock.json files exist (root and frontend)
- Intentional monorepo structure, can be silenced with `turbopack.root` in next.config.js

### 3. Port auto-increment
- Dev server will use 3001, 3002, etc. if port 3000 is occupied
- Expected behavior, not an error

## Build Issues

### Bundle Size Too Large

**Problem**: Build warnings about large bundle sizes

**Solution**:
```bash
# Analyze bundle
npm run build:analyze

# Check for accidentally imported modules
npx next-bundle-analyzer
```

### Out of Memory During Build

**Problem**: `FATAL ERROR: Ineffective mark-compacts near heap limit`

**Solution**:
```bash
# Increase Node memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

## Database Issues

### Foreign Key Violations

**Problem**: Database operations fail with foreign key constraint errors

**Solution**:
```bash
cd frontend
# Check foreign key violations
npm run db:health

# Inspect specific database
node -e "
const Database = require('better-sqlite3');
const db = new Database('data/forums.db');
const violations = db.prepare('PRAGMA foreign_key_check').all();
console.log(violations);
db.close();
"
```

### WAL Mode Issues

**Problem**: Database locked or `-wal` files growing too large

**Solution**:
```bash
cd frontend
# Checkpoint WAL files
node -e "
const Database = require('better-sqlite3');
const db = new Database('data/forums.db');
db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
db.close();
console.log('WAL checkpointed');
"
```

## Performance Issues

### Slow Page Loads

**Problem**: Pages take >2 seconds to load

**Checklist**:
1. Check database size (see database.md)
2. Verify FTS5 tables exist (forum_search_fts, library_search_fts)
3. Check connection pool stats
4. Review cache hit rates

**Solution**:
```bash
# Database health check
npm run db:health

# Performance report
npm run perf:report

# Lighthouse audit
npm run performance:lighthouse
```

### High Memory Usage

**Problem**: Node process using >1GB RAM

**Investigation**:
```bash
# Check for memory leaks
node --inspect frontend/node_modules/.bin/next dev

# Monitor memory
npm run performance:monitor
```

## Next.js 15 Specific Issues

### Async Params Not Awaited

**Problem**: `params.slug is undefined` or similar

**Cause**: Next.js 15 made params async

**Solution**: See `.claude/hydration-prevention.md` for complete async params patterns

Quick fix:
```typescript
// ❌ WRONG
export async function GET(request, { params }) {
  const slug = params.slug; // undefined!
}

// ✅ CORRECT
export async function GET(request, context) {
  const params = await context.params;
  const slug = params.slug;
}
```

### Hydration Errors

**Problem**: Hydration mismatch errors in console

**Solution**: See `.claude/hydration-prevention.md` for banned patterns and correct implementations

Common causes:
- Using `localStorage` in Server Components
- Not awaiting params in route handlers
- Multiple client wrapper layers
- `template.tsx` file (NEVER create this)

## Related Documentation

- [Database Architecture](.claude/database.md) - Database issues and cleanup
- [Hydration Prevention](.claude/hydration-prevention.md) - Critical Next.js 15 patterns
- [Commands Reference](.claude/commands.md) - All troubleshooting commands
- [Forums System](.claude/forums-system.md) - Forum-specific issues

## Getting Help

When troubleshooting:
1. Run `npm run type-check` first
2. Check `npm run db:health`
3. Review recent git commits
4. Check this file for similar issues
5. Use Read tool to examine error-specific documentation
