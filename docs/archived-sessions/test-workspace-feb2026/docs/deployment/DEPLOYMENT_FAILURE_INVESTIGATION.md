# Deployment Failure Investigation - November 6, 2025

## Problem Summary

**Status**: ❌ DEPLOYMENT FAILED
**Time**: 2025-Nov-06 06:44:43 UTC
**Commit**: e6028ac2fd947fd7b6678a12fa3600786f6084a9
**Platform**: Coolify + Docker + Nixpacks

## Error Details

### Build Error
```
Error: 🚨 FATAL: PostgreSQL connection not configured.
Set POSTGRES_URL or DATABASE_URL environment variable.
SQLite is no longer supported in this codebase.

> Build error occurred
[Error: Failed to collect page data for /api/forums/search] {
  type: 'Error'
}
```

### Error Location
- **Phase**: Build phase (step 9/11)
- **Command**: `npm run build`
- **Stage**: "Collecting page data"
- **File**: `.next/server/chunks/[root-of-the-server]__9048eb40._.js:1:2883`

## Root Cause Analysis

### Immediate Cause
The Next.js build process is failing during **static page generation** because it's trying to connect to the database at build time, but **no PostgreSQL connection string is configured**.

### Why This Happens
1. **Code Change**: We migrated from SQLite to PostgreSQL (commit e6028ac)
2. **Database Adapter**: The new `dbAdapter` throws a fatal error if `POSTGRES_URL` or `DATABASE_URL` is not set
3. **Build-Time Database Access**: Next.js tries to pre-render pages during build, which triggers database initialization
4. **Missing Environment Variables**: Coolify doesn't have PostgreSQL credentials configured

### Why SQLite Doesn't Work
The codebase was fully migrated to PostgreSQL-only. All database code now uses:
- `dbAdapter.query()` instead of `db.prepare()`
- PostgreSQL schemas (`system`, `content`, `users`, `wiki`, `forums`, etc.)
- PostgreSQL-specific SQL (`JSON_BUILD_OBJECT`, `STRING_AGG`, `ON CONFLICT`, etc.)

## Required Environment Variables

### Critical (MUST SET)
```bash
# PostgreSQL Connection
POSTGRES_URL=postgresql://user:password@host:port/database
# OR
DATABASE_URL=postgresql://user:password@host:port/database

# Session Management
SESSION_SECRET=<32-char hex string>

# Security
CSRF_SECRET=<32-char hex string>
ENCRYPTION_KEY=<32-char hex string>
```

### Optional (for production)
```bash
# Node Environment
NODE_ENV=production

# Next.js
NEXT_TELEMETRY_DISABLED=1
```

## Solution Options

### Option 1: Use Local PostgreSQL (Docker)
**Pros**: Free, private, full control
**Cons**: Need to set up PostgreSQL container on server

**Steps**:
1. SSH to 192.168.1.15
2. Create PostgreSQL container with Docker
3. Run migration scripts to populate database
4. Configure Coolify with connection string
5. Redeploy

### Option 2: Use Cloud PostgreSQL
**Pros**: Managed service, auto-scaling, automatic backups
**Cons**: Internet dependency, monthly costs, data leaves server

**Steps**:
1. Sign up with cloud PostgreSQL provider
2. Create database project
3. Copy connection string
4. Configure Coolify environment variables
5. Run migration scripts
6. Redeploy

### Option 3: Temporarily Allow SQLite for Build
**Pros**: Quick fix, gets deployment working
**Cons**: Runtime will still fail, not a real solution

**NOT RECOMMENDED**: The entire codebase uses PostgreSQL-only features now.

## Deployment Checklist

- [ ] Choose database option (Local PostgreSQL or Neon Cloud)
- [ ] Set up PostgreSQL database
- [ ] Configure Coolify environment variables
- [ ] Run database migration scripts
- [ ] Verify database health
- [ ] Trigger Coolify redeploy
- [ ] Verify deployment success
- [ ] Test application functionality

## Next Steps

1. **Immediate**: Set up PostgreSQL database (local or cloud)
2. **Configure**: Add environment variables to Coolify
3. **Migrate**: Run data migration scripts
4. **Deploy**: Trigger rebuild
5. **Verify**: Test application

## Technical Details

### Build Phase Failure
```
#13 [stage-0  9/11] RUN npm run build
#13 18.23    Collecting page data ...
#13 18.78 Error: 🚨 FATAL: PostgreSQL connection not configured
```

### Affected Routes
- `/api/forums/search` (first failure detected)
- Likely all API routes that use `dbAdapter`

### Database Adapter Code
Location: `frontend/src/lib/database/adapter.ts`

```typescript
const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    '🚨 FATAL: PostgreSQL connection not configured. ' +
    'Set POSTGRES_URL or DATABASE_URL environment variable. ' +
    'SQLite is no longer supported in this codebase.'
  );
}
```

## Related Documentation

- [COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md)
- [POSTGRESQL_MIGRATION_COMPLETE.md](./POSTGRESQL_MIGRATION_COMPLETE.md)
- [DATABASE.md](../DATABASE.md)

## Status Log

| Time | Action | Status |
|------|--------|--------|
| 06:41:14 UTC | Deployment started | ✅ Started |
| 06:41:24 UTC | Building image | ✅ Success |
| 06:44:43 UTC | npm run build | ❌ FAILED |
| 06:44:44 UTC | Deployment stopped | ❌ FAILED |

---

**Created**: 2025-11-06
**Last Updated**: 2025-11-06
**Severity**: CRITICAL
**Priority**: HIGH
