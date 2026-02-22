# PostgreSQL Migration Runbook

**Veritable Games - SQLite to PostgreSQL Migration**

**Timeline**: 4-6 weeks | **Downtime**: Zero | **Last Updated**: October 28, 2025

---

## 📋 Table of Contents

1. [Pre-Migration Checklist](#pre-migration-checklist)
2. [Week 1: Infrastructure Setup](#week-1-infrastructure-setup)
3. [Week 2: Schema Migration](#week-2-schema-migration)
4. [Week 3-4: Service Layer Migration](#week-3-4-service-layer-migration)
5. [Week 5: Data Migration & Validation](#week-5-data-migration--validation)
6. [Week 6: Production Cutover](#week-6-production-cutover)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Migration Checklist

### Prerequisites

- [ ] Deployment platform account created (Coolify or cloud provider)
- [ ] GitHub repository connected to Vercel
- [ ] Local development environment setup (Node.js 20+, Docker)
- [ ] Team members briefed on migration plan
- [ ] Backup schedule confirmed

### Current State Verification

```bash
# 1. Verify all SQLite databases exist
cd frontend && npm run db:health

# Expected output: 10 databases found

# 2. Check database sizes
du -sh data/*.db

# Expected: ~26MB total

# 3. Run type check (must pass)
npm run type-check

# 4. Run tests (should pass)
npm test

# 5. Count total records
sqlite3 data/forums.db "SELECT COUNT(*) FROM forum_topics"
sqlite3 data/wiki.db "SELECT COUNT(*) FROM wiki_pages"
sqlite3 data/users.db "SELECT COUNT(*) FROM users"
```

**Record Baseline Metrics:**
- Total users: ______
- Total forum topics: ______
- Total wiki pages: ______
- Total library documents: ______
- Database size: ______

---

## Week 1: Infrastructure Setup

### Day 1-2: Deployment Platform Setup

**1. Choose Deployment Platform:**

For self-hosted (recommended):
- Follow [COOLIFY_LOCAL_HOSTING_GUIDE.md](./COOLIFY_LOCAL_HOSTING_GUIDE.md)
- Install Coolify on Ubuntu server
- Set up GitHub integration

For cloud platforms:
- Choose platform (Railway, Fly.io, Render, etc.)
- Create account and link GitHub repository

**2. Set Up PostgreSQL Database:**

For local (Coolify):
```bash
# Create PostgreSQL container via Coolify dashboard
# Or use Docker:
docker run -d \
  --name veritable-games-postgres \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=veritable_games \
  -p 5432:5432 \
  postgres:15-alpine
```

For cloud:
```bash
# Follow cloud provider's PostgreSQL setup guide
# Get connection string from provider dashboard
```

**3. Configure environment variables:**

Create `.env.local` with:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Generate with `openssl rand -hex 32`
- `CSRF_SECRET` - Generate with `openssl rand -hex 32`
- `ENCRYPTION_KEY` - Generate with `openssl rand -hex 32`

**5. Test connection:**

```bash
# Create test script
cat > test-postgres-connection.js << 'EOF'
const { Client } = require('pg');

async function test() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  const result = await client.query('SELECT NOW()');
  console.log('✅ PostgreSQL connected:', result.rows[0].now);
  await client.end();
}

test().catch(console.error);
EOF

# Run test
node test-postgres-connection.js
```

### Day 3-4: Local Development Environment

**1. Start PostgreSQL with Docker:**

```bash
# From project root
docker-compose up -d postgres

# Verify it's running
docker ps | grep postgres

# Check logs
docker logs veritable-games-postgres
```

**2. Access pgAdmin (optional):**

Open browser to `http://localhost:5050`
- Email: `admin@veritable-games.com`
- Password: `admin`

Add server:
- Host: `postgres` (or `host.docker.internal` on macOS)
- Port: `5432`
- Database: `veritable_games`
- Username: `postgres`
- Password: `postgres`

**3. Install dependencies:**

```bash
cd frontend
npm install pg drizzle-orm
npm install -D drizzle-kit @types/pg
```

**4. Update package.json scripts:**

```json
{
  "scripts": {
    "db:migrate:schema": "node scripts/migrations/migrate-schema.js",
    "db:migrate:data": "node scripts/migrations/migrate-data.js",
    "db:migrate:validate": "node scripts/migrations/validate-migration.js",
    "db:migrate:dry-run": "node scripts/migrations/migrate-schema.js --dry-run",
    "postgres:local": "docker-compose up -d postgres",
    "postgres:stop": "docker-compose down"
  }
}
```

### Day 5-7: CI/CD Setup

**1. Create GitHub secrets:**

Go to: `https://github.com/YOUR_USERNAME/veritable-games-main/settings/secrets/actions`

Add secrets:
- `VERCEL_TOKEN` - Get from https://vercel.com/account/tokens
- `POSTGRES_URL` - Copy from Vercel dashboard
- `LHCI_GITHUB_APP_TOKEN` - For Lighthouse CI (optional)

**2. Test CI/CD pipeline:**

```bash
# Commit infrastructure files
git add docker-compose.yml vercel.json .github/workflows/deploy.yml
git commit -m "feat: Add Vercel deployment infrastructure"
git push origin main
```

Watch GitHub Actions run: `https://github.com/YOUR_USERNAME/veritable-games-main/actions`

**3. Verify Vercel deployment:**

Check Vercel dashboard for deployment status.

---

## Week 2: Schema Migration

### Day 1: Create PostgreSQL Schemas

**1. Initialize database schemas:**

```sql
-- Connect to PostgreSQL (local or Vercel)
psql $POSTGRES_URL

-- Create all schemas
CREATE SCHEMA IF NOT EXISTS forums;
CREATE SCHEMA IF NOT EXISTS wiki;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS library;
CREATE SCHEMA IF NOT EXISTS messaging;
CREATE SCHEMA IF NOT EXISTS system;
CREATE SCHEMA IF NOT EXISTS cache;
CREATE SCHEMA IF NOT EXISTS main;

-- Set default search path
ALTER DATABASE veritable_games SET search_path TO public, users, forums, wiki;

-- Verify schemas created
\dn
```

### Day 2-3: Convert SQLite Schemas

The migration scripts will automatically convert SQLite schemas to PostgreSQL.

**Key conversions:**

| SQLite Type | PostgreSQL Type | Notes |
|-------------|-----------------|-------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGSERIAL PRIMARY KEY` | Auto-incrementing |
| `INTEGER` (boolean) | `BOOLEAN` | True/false instead of 0/1 |
| `TEXT` (timestamp) | `TIMESTAMPTZ` | Timezone-aware timestamps |
| `TEXT` (JSON) | `JSONB` | Native JSON with indexing |
| `REAL` | `DOUBLE PRECISION` | Floating point |
| `DATETIME` | `TIMESTAMPTZ` | Timezone support |

**Run schema migration (dry-run first):**

```bash
cd frontend

# Dry run - no changes to database
npm run db:migrate:dry-run

# Review generated SQL in logs/
cat scripts/migrations/logs/schema-migration-*.log

# Run for real (start with non-critical database)
node scripts/migrations/migrate-schema.js cache

# Verify schema created
psql $POSTGRES_URL -c "\dt cache.*"
```

### Day 4-5: Migrate All Schemas

```bash
# Migrate in order (low-risk first)
node scripts/migrations/migrate-schema.js cache
node scripts/migrations/migrate-schema.js system
node scripts/migrations/migrate-schema.js library
node scripts/migrations/migrate-schema.js content
node scripts/migrations/migrate-schema.js messaging
node scripts/migrations/migrate-schema.js users
node scripts/migrations/migrate-schema.js auth
node scripts/migrations/migrate-schema.js wiki
node scripts/migrations/migrate-schema.js forums

# Or migrate all at once
npm run db:migrate:schema
```

**Verify schemas:**

```bash
# Count tables per schema
psql $POSTGRES_URL << 'EOF'
SELECT
    schemaname,
    COUNT(*) as table_count
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
GROUP BY schemaname
ORDER BY schemaname;
EOF
```

---

## Week 3-4: Service Layer Migration

### Overview

**Total services to migrate**: ~48 services across 10 domains

**Migration order** (by priority):
1. ✅ Cache (lowest risk, optional)
2. ✅ System (low risk)
3. ✅ Library (medium risk)
4. ⚠️ Users (high risk - authentication dependency)
5. ⚠️ Auth (high risk - security critical)
6. ⚠️ Content (high risk - large data)
7. ⚠️ Messaging (medium risk)
8. ⚠️ Wiki (high risk - FTS search)
9. ⚠️ Forums (highest risk - most complex, FTS search)

### Migration Pattern

**Before (SQLite - Synchronous):**

```typescript
// src/lib/users/service.ts
export class UserService {
  getUserById(userId: number): User | null {
    const db = dbPool.getConnection('users');
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(userId) as User | null;
  }
}
```

**After (PostgreSQL - Asynchronous):**

```typescript
// src/lib/users/service.ts
import { query } from '@/lib/database/adapter';

export class UserService {
  async getUserById(userId: number): Promise<User | null> {
    const result = await query<User>(
      'SELECT * FROM users WHERE id = $1',
      [userId],
      { schema: 'users' }
    );
    return result.rows[0] || null;
  }
}
```

### Day 1-3: Migrate Non-Critical Services

```bash
# Create feature branch
git checkout -b feat/postgres-migration-services

# Enable dual-write mode for testing
echo "DATABASE_MODE=dual-write" >> .env.local

# Migrate services one at a time
# Test each service thoroughly before moving to next
```

**Services to migrate:**
- [ ] `src/lib/cache/service.ts`
- [ ] `src/lib/system/service.ts`
- [ ] `src/lib/library/service.ts`

**Testing checklist per service:**
- [ ] All methods converted to async
- [ ] All `db.prepare()` calls replaced with `query()`
- [ ] Parameters converted from `?` to `$1, $2...`
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] TypeScript compilation successful

### Day 4-7: Migrate Critical Services

**Users Service:**

```typescript
// Key changes:
// 1. All methods become async
// 2. Replace dbPool.getConnection() with query()
// 3. Update error handling for async

// Example transaction conversion:
// Before:
const transaction = db.transaction(() => {
  const user = db.prepare('INSERT INTO users...').run(data);
  db.prepare('UPDATE stats...').run();
  return user;
});

// After:
import { transaction } from '@/lib/database/adapter';

await transaction(async (adapter) => {
  await adapter.query('INSERT INTO users...', [data], { schema: 'users' });
  await adapter.query('UPDATE stats...', [], { schema: 'system' });
}, { schema: 'users' });
```

**Auth Service (CRITICAL):**

```typescript
// Password verification - NO CHANGES to bcrypt logic!
// Hashes transfer byte-for-byte

async login(username: string, password: string) {
  // Query becomes async, but bcrypt.compare stays the same
  const result = await query<User>(
    'SELECT * FROM users WHERE username = $1',
    [username],
    { schema: 'auth' }
  );

  const user = result.rows[0];
  if (!user) return null;

  // bcrypt verification unchanged
  const valid = await bcrypt.compare(password, user.password_hash);
  return valid ? user : null;
}
```

### Day 8-14: Migrate Complex Services

**Forums & Wiki (FTS Search):**

```typescript
// SQLite FTS5
const results = db.prepare(`
  SELECT * FROM forum_search_fts
  WHERE forum_search_fts MATCH ?
  ORDER BY bm25(forum_search_fts)
`).all(searchQuery);

// PostgreSQL Full-Text Search
const results = await query(`
  SELECT *, ts_rank(search_vector, query) as rank
  FROM forums.forum_topics,
       websearch_to_tsquery('english', $1) query
  WHERE search_vector @@ query
  ORDER BY rank DESC
`, [searchQuery], { schema: 'forums' });
```

**Update API Routes:**

All 122 API routes need minimal changes (just add `await`):

```typescript
// Before
export const GET = withSecurity((request) => {
  const user = userService.getUserById(userId);
  return NextResponse.json({ user });
});

// After - just add await
export const GET = withSecurity(async (request) => {
  const user = await userService.getUserById(userId);
  return NextResponse.json({ user });
});
```

---

## Week 5: Data Migration & Validation

### Day 1-2: Export SQLite Data

**1. Create backup:**

```bash
cd frontend/data

# Backup all databases
for db in *.db; do
  sqlite3 "$db" ".backup ${db}.backup-$(date +%Y%m%d)"
done

# Verify backups
for backup in *.backup-*; do
  sqlite3 "$backup" "PRAGMA integrity_check;"
done
```

**2. Run data migration (start with non-critical):**

```bash
cd ..

# Migrate cache database (safest first)
node scripts/migrations/migrate-data.js cache

# Check progress
cat scripts/migrations/logs/migration-progress.json
```

### Day 3-5: Migrate All Data

```bash
# Migrate in order
node scripts/migrations/migrate-data.js system
node scripts/migrations/migrate-data.js library
node scripts/migrations/migrate-data.js content
node scripts/migrations/migrate-data.js messaging
node scripts/migrations/migrate-data.js users
node scripts/migrations/migrate-data.js auth
node scripts/migrations/migrate-data.js wiki
node scripts/migrations/migrate-data.js forums

# Estimated time: 2-4 hours for all databases
```

**Monitor progress:**

```bash
# Watch migration logs
tail -f scripts/migrations/logs/data-migration-*.log

# Check PostgreSQL row counts
psql $POSTGRES_URL -c "
SELECT schemaname, tablename, n_tup_ins as inserted_rows
FROM pg_stat_user_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;
"
```

### Day 6-7: Validation

```bash
# Run comprehensive validation
npm run db:migrate:validate

# Expected output:
# ✅ users: 100 rows match
# ✅ forum_topics: 500 rows match
# ✅ wiki_pages: 200 rows match
# etc.
```

**Manual spot checks:**

```bash
# Compare specific records
sqlite3 data/users.db "SELECT * FROM users WHERE id = 1;"
psql $POSTGRES_URL -c "SELECT * FROM users.users WHERE id = 1;"

# Compare totals
sqlite3 data/forums.db "SELECT COUNT(*) FROM forum_topics;"
psql $POSTGRES_URL -c "SELECT COUNT(*) FROM forums.forum_topics;"
```

---

## Week 6: Production Cutover

### Day 1-2: Performance Testing

```bash
# Run performance benchmarks
cd frontend
node scripts/performance/check-query-performance.js

# Expected: Most queries 2-3x faster
# Acceptable: < 20% slower for some queries
# Red flag: > 50% slower (investigate before proceeding)
```

### Day 3: Enable Dual-Write Mode

```bash
# Update environment variable on Vercel
vercel env add DATABASE_MODE production
# Value: dual-write

# Redeploy
git commit --allow-empty -m "chore: Enable dual-write mode"
git push origin main

# Monitor for 24 hours
vercel logs --follow
```

### Day 4-5: Gradual Traffic Shift

**Option A: Environment Variable Toggle**

```bash
# Shift to PostgreSQL reads (SQLite writes continue)
vercel env add DATABASE_MODE production
# Value: postgres

# Deploy
git push origin main
```

**Option B: Feature Flags (more granular)**

Update `DATABASE_MODE` incrementally:
- Day 4 AM: `dual-write` (validate consistency)
- Day 4 PM: `postgres` for 10% traffic (canary)
- Day 5 AM: `postgres` for 50% traffic
- Day 5 PM: `postgres` for 100% traffic

### Day 6: Monitor & Optimize

```bash
# Check error rates
vercel logs --filter=error | wc -l

# Check query performance
psql $POSTGRES_URL -c "
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
"

# Check connection pool
psql $POSTGRES_URL -c "
SELECT count(*) as connections,
       state
FROM pg_stat_activity
WHERE datname = 'veritable_games'
GROUP BY state;
"
```

### Day 7: Archive SQLite Databases

```bash
# Only after 1 week of successful PostgreSQL operation!

# Create final backup
cd frontend/data
tar -czf sqlite-databases-final-backup-$(date +%Y%m%d).tar.gz *.db

# Move to archive directory
mkdir -p ../../backups/sqlite-archive
mv *.db ../../backups/sqlite-archive/
mv sqlite-databases-final-backup-*.tar.gz ../../backups/

# Update code to remove SQLite support
# (Keep adapter.ts for now in case of emergency rollback)
```

---

## Rollback Procedures

### Emergency Rollback (< 5 minutes)

**Scenario**: Critical production issue, need immediate rollback

```bash
# 1. Revert DATABASE_MODE to sqlite
vercel env rm DATABASE_MODE production
vercel env add DATABASE_MODE production
# Value: sqlite

# 2. Force redeploy
git commit --allow-empty -m "EMERGENCY: Rollback to SQLite"
git push origin main --force

# 3. Verify rollback
curl https://your-app.vercel.app/api/health

# 4. Check database mode
vercel logs | grep "DatabaseAdapter"
# Should show: "Initialized in sqlite mode"
```

### Planned Rollback (data issues)

**Scenario**: Data discrepancies found, need to re-sync

```bash
# 1. Switch to dual-write mode
DATABASE_MODE=dual-write

# 2. Re-run data migration
npm run db:migrate:data

# 3. Re-validate
npm run db:migrate:validate

# 4. If still issues, rollback to sqlite and investigate
```

---

## Troubleshooting

### Common Issues

**Issue 1: "Cannot connect to PostgreSQL"**

```bash
# Check environment variables
echo $POSTGRES_URL

# Test connection
psql $POSTGRES_URL -c "SELECT 1"

# Verify SSL settings
# Vercel Postgres requires SSL
```

**Issue 2: "Row count mismatch after migration"**

```bash
# Identify which table
node scripts/migrations/validate-migration.js

# Re-migrate specific table
node scripts/migrations/migrate-data.js users --table=users --force

# Check for constraints blocking inserts
psql $POSTGRES_URL -c "
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'users.users'::regclass;
"
```

**Issue 3: "Search results different after migration"**

```bash
# FTS5 → PostgreSQL full-text search may have different relevance
# This is expected, tune if needed

# Check search configuration
psql $POSTGRES_URL -c "SHOW default_text_search_config;"

# Create custom search configuration
psql $POSTGRES_URL -c "
CREATE TEXT SEARCH CONFIGURATION forums_search (COPY = english);
ALTER TEXT SEARCH CONFIGURATION forums_search
  ALTER MAPPING FOR word WITH english_stem;
"
```

**Issue 4: "Performance regression > 20%"**

```bash
# Check if indexes were created
psql $POSTGRES_URL -c "
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'forums'
ORDER BY tablename;
"

# Check query plan
psql $POSTGRES_URL -c "
EXPLAIN ANALYZE
SELECT * FROM forums.forum_topics
WHERE category_id = 1
ORDER BY updated_at DESC
LIMIT 20;
"

# Add missing indexes
psql $POSTGRES_URL -c "
CREATE INDEX idx_forum_topics_category_updated
ON forums.forum_topics(category_id, updated_at DESC);
"
```

---

## Success Criteria

- [ ] Zero data loss (100% row count match)
- [ ] All tests passing
- [ ] Query performance < 20% regression
- [ ] Error rate < 0.1%
- [ ] All users can authenticate
- [ ] Search functionality working
- [ ] No connection pool exhaustion
- [ ] Rollback tested successfully

---

## Support Contacts

**Internal Team:**
- Lead Developer: [Your Name]
- DevOps: [Team Member]
- Database Admin: [Team Member]

**External Resources:**
- Vercel Support: https://vercel.com/support
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Neon Support: https://neon.tech/docs

---

**Last Updated**: October 28, 2025
**Document Version**: 1.0
**Migration Status**: Not Started
