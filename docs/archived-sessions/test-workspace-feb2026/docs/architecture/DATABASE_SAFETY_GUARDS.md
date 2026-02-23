# Database Safety Guards & Migration Patterns

**Status**: ✅ Production-ready (PostgreSQL required, SQLite prevention enforced)
**Last Updated**: November 10, 2025
**Audience**: Backend developers working with database access

---

## Quick Navigation

### Inline Documentation (Code-Adjacent - Read These!)

- **[SQLite Safety Guards README](../../frontend/src/lib/utils/SAFETY_GUARDS_README.md)** ⭐ START HERE
  - Complete guard utilities reference
  - Development vs production detection
  - All 9 guard patterns with examples
  - Legacy module warnings
  - Configuration options

- **[Safety Guard: require-sqlite.ts](../../frontend/src/lib/utils/require-sqlite.ts)**
  - SQLite availability checking
  - Development environment assertion
  - Error messages for production misuse

- **[Safety Guard: require-postgres.ts](../../frontend/src/lib/utils/require-postgres.ts)**
  - PostgreSQL configuration validation
  - Connection string validation
  - Environment detection

- **[Database Adapter](../../frontend/src/lib/database/adapter.ts)**
  - Automatic database routing
  - Build phase detection
  - DATABASE_URL fallback for Coolify
  - SQLite vs PostgreSQL routing

### Central Documentation (System-Level Overview)

- **[Database Architecture](../DATABASE.md)**
  - 10 specialized databases
  - 155 tables total
  - Schema documentation
  - Migration history

---

## System Overview

### Three Different Environments = Three Different Configurations

| Environment | Database | Configuration | Use Case |
|-------------|----------|---------------|----------|
| **Development** | SQLite | File-based (`frontend/data/`) | Local testing, offline development |
| **CI/CD Testing** | PostgreSQL | Configured via env var | Automated testing pipeline |
| **Production** | PostgreSQL | **REQUIRED** via env var | Live application, real users |

**Critical Rule**: SQLite is **NEVER** allowed in production code. All production-facing code **MUST** work with PostgreSQL.

### How It Works

```
Application starts
    ↓
Detect environment (NODE_ENV, POSTGRES_URL, DATABASE_URL)
    ↓
├─ Production → MUST use PostgreSQL
├─ Development → Can use SQLite or PostgreSQL
└─ CI/CD → Must use PostgreSQL
    ↓
Load appropriate database connector
    ↓
All database access goes through adapter
```

---

## Database Safety Patterns

### Pattern 1: Production Code (MUST use PostgreSQL)

**Use in**: API routes, services, utilities that users depend on

```typescript
// ✅ CORRECT - Enforces PostgreSQL
import { requirePostgres, getPostgresUrl } from '@/lib/utils/require-postgres';

export async function getUserProfile(userId: number) {
  // Validates PostgreSQL is available
  requirePostgres('Get user profile');

  // Get validated connection string
  const url = getPostgresUrl('User profile query');

  // Safely execute query
  const result = await dbAdapter.query(
    'SELECT * FROM users.users WHERE id = $1',
    [userId]
  );
  return result;
}
```

**Guarantees**:
- ✅ Will never accidentally use SQLite
- ✅ Will provide clear error messages if PostgreSQL not configured
- ✅ Will work in both development and production

### Pattern 2: Development Utilities (Can use SQLite)

**Use in**: Development scripts, seed scripts, migration scripts (NOT production code)

```typescript
// ✅ CORRECT - Allows SQLite in development
import { assertDevEnvironment } from '@/lib/utils/require-sqlite';

export async function seedTestData() {
  // Assert we're not in production
  assertDevEnvironment('Seed test data');

  // Now safe to use SQLite
  const db = dbPool.getConnection('forums');
  await db.exec(seedSQL);
}
```

**Guarantees**:
- ✅ Will work in development
- ✅ Will throw clear error in production
- ✅ Safe for development-only operations

### Pattern 3: Test Setup (Can use either)

**Use in**: Jest test files, test utilities, fixtures

```typescript
// ✅ CORRECT - Flexible database selection
import { isPostgresEnvironment } from '@/lib/utils/require-postgres';
import { assertDevEnvironment } from '@/lib/utils/require-sqlite';

export async function setupTestDatabase() {
  if (isPostgresEnvironment()) {
    // Use PostgreSQL for tests
    return setupPostgresTest();
  } else {
    // Use SQLite for tests
    assertDevEnvironment('Test setup');
    return setupSqliteTest();
  }
}
```

**Guarantees**:
- ✅ Works in CI/CD (PostgreSQL)
- ✅ Works locally (SQLite or PostgreSQL)
- ✅ Clear failure if misconfigured

### Pattern 4: Conditional Code (Environment Detection)

**Use in**: Utilities that need to work in both environments

```typescript
// ✅ CORRECT - Detects environment and adapts
import { isPostgresEnvironment, getDatabaseConfig } from '@/lib/utils/require-postgres';

export async function getPerformanceMetrics() {
  const config = getDatabaseConfig();

  if (config.type === 'postgresql') {
    // Use PostgreSQL-specific queries
    return await queryPostgresMetrics();
  } else {
    // Use SQLite-specific queries
    return await querySqliteMetrics();
  }
}
```

**Guarantees**:
- ✅ Works correctly in any environment
- ✅ Uses database-specific optimizations
- ✅ Never breaks in production

---

## Common Mistakes

### ❌ Mistake 1: Importing SQLite in Production Code

```typescript
// WRONG - Will fail in production
import Database from 'better-sqlite3';

export async function getUserProfile(userId: number) {
  const db = new Database('users.db');
  const result = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return result;
}
```

**Why Bad**:
- SQLite doesn't exist in production
- Will throw "Module not found" error
- Will crash production application

**Fix**: Use safety guards
```typescript
// CORRECT
import { requirePostgres } from '@/lib/utils/require-postgres';

export async function getUserProfile(userId: number) {
  requirePostgres('Get user profile');
  const result = await dbAdapter.query(
    'SELECT * FROM users.users WHERE id = $1',
    [userId]
  );
  return result;
}
```

### ❌ Mistake 2: Forgetting Environment Validation

```typescript
// WRONG - No validation, could fail in production
export async function deleteExpiredSessions() {
  const db = dbPool.getConnection('auth');
  await db.exec('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP');
}
```

**Why Bad**:
- Assumes database is available
- Uses SQLite in production (if not guarded)
- No clear error message if misconfigured

**Fix**: Add validation
```typescript
// CORRECT
import { requirePostgres } from '@/lib/utils/require-postgres';

export async function deleteExpiredSessions() {
  requirePostgres('Delete expired sessions');
  const result = await dbAdapter.query(
    'DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP'
  );
  return result.rowCount;
}
```

### ❌ Mistake 3: Development Code in Production

```typescript
// WRONG - This seed function could be called in production
export async function seedDatabase() {
  const db = dbPool.getConnection('users');
  await db.exec(INSERT_SEED_DATA);
}
```

**Why Bad**:
- Accidentally running seed in production could destroy data
- No protection against misuse
- Hard to debug why data changed

**Fix**: Guard development code
```typescript
// CORRECT
import { assertDevEnvironment } from '@/lib/utils/require-sqlite';

export async function seedDatabase() {
  assertDevEnvironment('Seed database');
  const db = dbPool.getConnection('users');
  await db.exec(INSERT_SEED_DATA);
}
```

### ❌ Mistake 4: Mixing Database Access Patterns

```typescript
// WRONG - Mixes two database access patterns
import Database from 'better-sqlite3';
import { dbAdapter } from '@/lib/database/adapter';

export async function getUserData(userId: number) {
  // Creates new SQLite instance (wrong!)
  const db = new Database('data.db');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  // Also uses adapter (correct)
  const profile = await dbAdapter.query(
    'SELECT * FROM users.users WHERE id = $1',
    [userId]
  );
}
```

**Why Bad**:
- Inconsistent database access
- Opens connection leaks (new instances)
- Different databases could have stale data

**Fix**: Use adapter everywhere
```typescript
// CORRECT
import { dbAdapter } from '@/lib/database/adapter';

export async function getUserData(userId: number) {
  const user = await dbAdapter.query(
    'SELECT * FROM users.users WHERE id = $1',
    [userId]
  );
  return user;
}
```

---

## Safety Guard Reference

### 9 Total Safety Guards Available

**1. `requirePostgres(operation)`**
- Validates PostgreSQL is configured
- Use in: Production code, API routes
- Throws: Clear error with configuration examples

**2. `getPostgresUrl(operation)`**
- Gets validated PostgreSQL connection string
- Use in: Services, utilities
- Throws: Clear error if not configured

**3. `isPostgresEnvironment()`**
- Checks if PostgreSQL is available
- Use in: Conditional code
- Returns: boolean

**4. `getDatabaseConfig()`**
- Gets current database configuration
- Use in: Diagnostics, conditional code
- Returns: `{ type: 'postgresql' | 'sqlite' | 'unknown', url?: string }`

**5. `requireSQLite(operation)`**
- Validates SQLite is available
- Use in: Development scripts
- Throws: Clear error in production

**6. `assertDevEnvironment(operation)`**
- Asserts we're in development/test context
- Use in: Dev scripts, seed functions
- Throws: Clear error in production

**7. `getEnvironmentContext()`**
- Gets detailed environment information
- Use in: Diagnostics
- Returns: `{ isDevelopment, isProduction, isTest, ... }`

**8. `validateDatabaseConfig()`**
- Validates all database configuration
- Use in: Startup checks
- Returns: Validation result with error messages

**9. `logDatabaseEnvironment()`**
- Logs database environment to console
- Use in: Startup debugging
- Returns: Formatted environment info

See [SAFETY_GUARDS_README.md](../../frontend/src/lib/utils/SAFETY_GUARDS_README.md) for complete reference.

---

## Environment Detection

The system automatically detects environments:

### Production Detection
```
Production = True if ANY of:
├─ NODE_ENV === 'production'
├─ Deployed on Coolify (container environment)
├─ DATABASE_URL or POSTGRES_URL set to PostgreSQL
└─ ALLOW_SQLITE_IN_PRODUCTION !== 'true'
```

### Development Detection
```
Development = True if ANY of:
├─ NODE_ENV === 'development'
├─ Running on localhost:3000
├─ LOCALHOST environment variable set
├─ Running locally (not in container)
└─ ALLOW_SQLITE_IN_DEVELOPMENT === 'true'
```

### Test Detection
```
Testing = True if ANY of:
├─ NODE_ENV === 'test'
├─ Running Jest tests (jest.useFakeTimers)
├─ USE_REAL_DB !== 'true' (using mocked DB)
└─ TEST environment variable set
```

---

## Configuration Reference

### Environment Variables

**PostgreSQL Configuration**:
```bash
POSTGRES_URL=postgresql://user:password@localhost:5432/database
# OR
DATABASE_URL=postgresql://user:password@localhost:5432/database
```

**SQLite Configuration** (development only):
```bash
SQLITE_ENABLED=true
SQLITE_PATH=./data/
```

**Override Flags** (use sparingly):
```bash
# Allow SQLite in production (⚠️ NOT RECOMMENDED)
ALLOW_SQLITE_IN_PRODUCTION=true

# Force test mode
NODE_ENV=test

# Force development mode
NODE_ENV=development
LOCALHOST=true
```

---

## Migration & Upgrade Path

### From SQLite to PostgreSQL

**Step 1**: Configure PostgreSQL connection
```bash
DATABASE_URL=postgresql://user:password@host:5432/db
```

**Step 2**: Verify connection
```bash
npm run db:health
```

**Step 3**: Run migrations
```bash
npm run db:migrate
```

**Step 4**: Verify data
```bash
npm run db:audit
```

**Step 5**: Update code (if using SQLite-specific features)
```typescript
// Change from:
import { dbPool } from '@/lib/database/legacy/pool';

// To:
import { dbAdapter } from '@/lib/database/adapter';
```

### Rollback to SQLite (if needed)

```bash
# Unset PostgreSQL configuration
unset DATABASE_URL
unset POSTGRES_URL

# Fall back to SQLite
npm run db:health  # Will use SQLite instead
```

---

## Troubleshooting

### Error: "DATABASE_URL or POSTGRES_URL environment variable not set"

**Cause**: PostgreSQL not configured

**Fix**:
```bash
# Set one of these:
export DATABASE_URL="postgresql://user:password@localhost:5432/db"
# OR
export POSTGRES_URL="postgresql://user:password@localhost:5432/db"

# Verify
npm run db:health
```

### Error: "SQLite is not allowed in this environment"

**Cause**: Trying to use SQLite in production

**Fix**: Use `requirePostgres()` guard in production code
```typescript
import { requirePostgres } from '@/lib/utils/require-postgres';

export async function getUser(id: number) {
  requirePostgres('Get user');
  // Now safe to use PostgreSQL
}
```

### Error: "Cannot find module 'better-sqlite3'"

**Cause**: SQLite not installed (common in containers)

**Fix**: Either:
1. Install SQLite: `npm install`
2. Use PostgreSQL instead: `export DATABASE_URL=...`
3. Use nixpacks.toml to include SQLite in container build

---

## Testing Database Code

### Unit Tests (Mocked Database)

```typescript
// Use jest mocks, no real database needed
jest.mock('@/lib/database/adapter');

describe('getUserProfile', () => {
  it('should fetch user profile', async () => {
    // Mock the database call
    dbAdapter.query.mockResolvedValue({ id: 1, name: 'Test' });

    const profile = await getUserProfile(1);
    expect(profile.name).toBe('Test');
  });
});
```

### Integration Tests (Real Database)

```typescript
// Use real database (SQLite or PostgreSQL)
describe('getUserProfile - Integration', () => {
  beforeEach(async () => {
    // Set up test database
    await setupTestDatabase();
  });

  it('should fetch user profile from database', async () => {
    // Insert test data
    await insertTestUser({ id: 1, name: 'Test' });

    // Test actual database query
    const profile = await getUserProfile(1);
    expect(profile.name).toBe('Test');
  });
});
```

---

## Key Concepts

### Connection Pooling

The application uses connection pooling to efficiently manage database connections:

**Development (SQLite)**:
```typescript
const db = dbPool.getConnection('users');  // Returns SQLite connection
```

**Production (PostgreSQL)**:
```typescript
const db = dbPool.getConnection('users');  // Returns PostgreSQL connection
```

Both use the same interface but different drivers.

### Database Adapter Pattern

The `dbAdapter` provides a unified interface:

```typescript
import { dbAdapter } from '@/lib/database/adapter';

// Works the same in both SQLite and PostgreSQL
const result = await dbAdapter.query(
  'SELECT * FROM users.users WHERE id = $1',
  [userId]
);
```

**Benefits**:
- Single API for both databases
- Automatic driver selection
- Safe parameter binding
- Query logging

---

## Related Documentation

- **[DATABASE.md](../DATABASE.md)** - Complete database architecture (10 databases, 155 tables)
- **[CRITICAL_PATTERNS.md](./CRITICAL_PATTERNS.md)** - Must-follow patterns (includes database access)
- **[TROUBLESHOOTING.md](../TROUBLESHOOTING.md)** - Common database issues and fixes

---

**Status**: ✅ Complete and current
**Last Updated**: November 10, 2025
