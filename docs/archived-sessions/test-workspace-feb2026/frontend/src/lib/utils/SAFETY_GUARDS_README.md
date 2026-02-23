# SQLite Safety Guards

## Overview

This directory contains safety guard utilities to prevent SQLite usage in
production environments. The application is 100% PostgreSQL-only at runtime, but
contains SQLite functionality for development and testing.

**Key Principle**: SQLite should **never** be used in production. PostgreSQL is
the only supported production database.

## Guard Utilities

### 1. `require-sqlite.ts`

Prevents SQLite usage in production environments.

**Usage in development-only scripts:**

```typescript
import {
  requireSQLite,
  assertDevEnvironment,
} from '@/lib/utils/require-sqlite';

// Option 1: Explicitly check if SQLite is available
requireSQLite('my-component-name');

// Option 2: Assert we're in development/testing context
assertDevEnvironment('My operation description');
```

**When to use:**

- In development-only utility scripts
- In test setup files
- In components that only work with SQLite

**Behavior:**

- ✅ Allows in development (NODE_ENV === 'development')
- ✅ Allows in tests with USE_REAL_DB=true
- ✅ Allows in localhost contexts
- ❌ Throws fatal error in production
- ❌ Throws fatal error in staging/other environments

### 2. `require-postgres.ts`

Ensures PostgreSQL is properly configured.

**Usage in production-facing code:**

```typescript
import {
  requirePostgres,
  getPostgresUrl,
  isPostgresEnvironment,
} from '@/lib/utils/require-postgres';

// Option 1: Require PostgreSQL to be configured
requirePostgres('Database operation');

// Option 2: Get the connection string (with validation)
const url = getPostgresUrl('My operation');

// Option 3: Check if PostgreSQL is available
if (isPostgresEnvironment()) {
  // Safe to use PostgreSQL
}

// Option 4: Get current database configuration
const config = getDatabaseConfig();
console.log(config.type); // 'postgresql' | 'sqlite' | 'unknown'
```

**When to use:**

- In API routes that access the database
- In services that require PostgreSQL
- In production setup/validation code

**Behavior:**

- ✅ Validates POSTGRES_URL or DATABASE_URL is set
- ✅ Validates URL format starts with postgresql://
- ✅ Provides detailed error messages with configuration examples
- ❌ Throws fatal error if PostgreSQL not configured

## Legacy Module Warnings

The following modules in `frontend/src/lib/database/legacy/` have built-in
safety guards:

### Legacy Pool Modules

- **`pool.ts`** - SQLite connection pool
- **`optimized-pool.ts`** - Experimental SQLite optimization
- **`wal-monitor.ts`** - SQLite WAL monitoring
- **`query-builder.ts`** - SQLite query builder

Each module:

1. Has a clear warning in JSDoc comments (⚠️ DEVELOPMENT/TESTING ONLY)
2. Detects production environment at module load time
3. Logs warning if loaded in production (unless ALLOW_SQLITE_IN_PRODUCTION=true)
4. Should be imported only by development-only code

**Detection logic:**

```typescript
const isProduction =
  process.env.NODE_ENV === 'production' ||
  (process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'test' &&
    !process.env.LOCALHOST);
```

## Development-Only Scripts with Guards

The following scripts have production environment checks:

### Database Operations

| Script                                            | Type                   | Guard                  |
| ------------------------------------------------- | ---------------------- | ---------------------- |
| `scripts/database-health-check.js`                | SQLite health check    | ❌ Fails in production |
| `scripts/backup-all-databases.js`                 | SQLite backups         | ❌ Fails in production |
| `scripts/user-management/reset-admin-password.js` | SQLite password reset  | ❌ Fails in production |
| `scripts/generate-sample-news.ts`                 | Sample data generation | ❌ Fails in production |

### PostgreSQL Production Scripts

For production equivalents, use:

| Operation       | SQLite Script              | PostgreSQL Script                   |
| --------------- | -------------------------- | ----------------------------------- |
| Health Check    | `database-health-check.js` | `database-health-check-postgres.js` |
| Backups         | `backup-all-databases.js`  | `backup-postgres.js`                |
| Password Reset  | `reset-admin-password.js`  | `reset-admin-password-postgres.js`  |
| Workspace Check | N/A                        | `workspace-check.js` (auto-detects) |

## Environment Variables

### Development

```bash
# Allow localhost development with SQLite
LOCALHOST=true
NODE_ENV=development

# Or use SQLite for testing
NODE_ENV=test
USE_REAL_DB=true
```

### Production

```bash
# PostgreSQL is required
NODE_ENV=production
POSTGRES_URL=postgresql://user:password@host:5432/database

# Or use DATABASE_URL as fallback
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Emergency Override (NOT RECOMMENDED)

```bash
# ONLY use if absolutely necessary for migration/debugging
ALLOW_SQLITE_IN_PRODUCTION=true

# Even with this set, production code should still use PostgreSQL
```

## Adding Guards to New Code

### For Development-Only Utilities

```typescript
// 1. Import the guard
import { assertDevEnvironment } from '@/lib/utils/require-sqlite';

// 2. Call it at the start of the function/script
assertDevEnvironment('My development utility name');

// 3. Continue with SQLite-only code
import { dbPool } from '@/lib/database/legacy/pool';
const db = dbPool.getConnection('forums');
```

### For Production-Facing Code

```typescript
// 1. Import PostgreSQL guard
import { requirePostgres, getPostgresUrl } from '@/lib/utils/require-postgres';

// 2. Validate setup
requirePostgres('My API route');

// 3. Use the URL if needed
const url = getPostgresUrl();
```

## Testing

### Running Tests with SQLite

```bash
# Enable SQLite for tests
NODE_ENV=test USE_REAL_DB=true npm test

# Or set in jest.config.js
process.env.USE_REAL_DB = 'true';
```

### Testing Guard Behavior

```typescript
describe('Safety Guards', () => {
  it('should fail in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    expect(() => {
      assertDevEnvironment('test');
    }).toThrow('[FATAL] Development-Only Operation in Production');

    process.env.NODE_ENV = originalEnv;
  });
});
```

## Troubleshooting

### Error: "SQLite Required in Production Environment"

**Cause**: Attempting to use SQLite in production

**Solution**:

1. Check NODE_ENV is 'production'
2. Verify you're not in a development context
3. Use PostgreSQL equivalents instead
4. If this is migration/debugging, set ALLOW_SQLITE_IN_PRODUCTION=true

### Error: "PostgreSQL Configuration Missing"

**Cause**: POSTGRES_URL or DATABASE_URL not set

**Solution**:

```bash
# For development
POSTGRES_URL=postgresql://test:test@localhost:5432/test_db npm run dev

# For production, set in environment/Coolify
export POSTGRES_URL=postgresql://user:pass@host:5432/db
```

### Warning: "SQLite Pool Loaded in Production Environment"

**Cause**: A legacy SQLite module was imported in production

**Solution**:

1. Review the code that imported the module
2. Replace with PostgreSQL equivalent
3. Or set ALLOW_SQLITE_IN_PRODUCTION=true if intentional

## References

- **Database Architecture**: [docs/DATABASE.md](../../DATABASE.md)
- **Critical Patterns**:
  [docs/architecture/CRITICAL_PATTERNS.md](../../architecture/CRITICAL_PATTERNS.md)
- **Deployment Guide**:
  [docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](../../deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)
- **Environment Variables**: See `.env.example` in `frontend/`

## Related Files

- `require-sqlite.ts` - SQLite usage prevention
- `require-postgres.ts` - PostgreSQL validation
- `frontend/src/lib/database/legacy/` - Archived SQLite modules
- `frontend/scripts/database-health-check-postgres.js` - Production health check
- `frontend/scripts/backup-postgres.js` - Production backups
