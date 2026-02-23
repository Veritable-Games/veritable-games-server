# Legacy SQLite Database Code

This directory contains archived SQLite database pool and utility code that is
**no longer used** in the active codebase.

## ⚠️ IMPORTANT

**These files are for historical reference only**:

- ❌ NOT imported by any active services
- ❌ NOT used in production (PostgreSQL-only)
- ❌ NOT maintained or updated
- ⏳ Kept for version history and reference

## Files

### `pool.ts` (35 KB)

SQLite connection pool using `better-sqlite3` library

- Singleton pattern for database connections
- Build-time mock detection (returns mock DB during Next.js build)
- WAL mode support
- Query statistics tracking

**Status**: Completely replaced by `pool-postgres.ts`

### `optimized-pool.ts` (13 KB)

Experimental optimization of SQLite pool

- Was never adopted in active services
- All services use `dbAdapter` instead

**Status**: Deprecated, never used

### `query-builder.ts` (17 KB)

SQLite-specific query building utilities

- Schema binding utilities
- Parameter handling for SQLite
- Never used - dbAdapter handles queries directly

**Status**: Dead code

### `wal-monitor.ts` (10 KB)

SQLite Write-Ahead Logging (WAL) monitoring

- Checks WAL file sizes
- Monitors journal files
- SQLite-specific metrics

**Status**: Monitoring utilities for development only

## Migration History

- **November 5, 2025**: Moved to legacy archive
- **November 2025**: PostgreSQL migration completed (50,646 rows, 99.99%
  success)
- **October 2025**: Began PostgreSQL migration
- **Pre-October 2025**: Used for all development and production

## Why Archived

The codebase completed full migration to PostgreSQL 15 in November 2025:

1. **Production Database**: PostgreSQL 15 (Coolify deployment)
2. **Development**: SQLite still used locally, but through abstraction
3. **Architecture**: All services use `dbAdapter` which routes to PostgreSQL

Legacy SQLite code was archived to:

- ✅ Reduce code complexity
- ✅ Clarify that PostgreSQL is the only database used
- ✅ Prevent accidental usage of deprecated code
- ✅ Maintain version history (via git)

## If You Need This Code

To restore any of these files:

```bash
# Find the commit where it was archived
git log --oneline -- src/lib/database/legacy/

# Restore a specific file from git history
git checkout <commit-hash> -- src/lib/database/legacy/pool.ts
```

## Related

- **Active Database Code**: `adapter.ts`, `pool-postgres.ts`
- **Documentation**: See `docs/DATABASE.md` for current architecture
- **Decision**: SQLite is localhost-only, PostgreSQL is production-required
