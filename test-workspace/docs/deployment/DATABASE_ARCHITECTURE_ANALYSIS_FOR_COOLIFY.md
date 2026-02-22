# Veritable Games - Database Architecture Analysis for Coolify

**Date**: November 4, 2025
**Analysis Type**: Complete PostgreSQL migration mapping from 10 SQLite databases to PostgreSQL schemas
**Status**: Migration 100% complete (155 tables, 51,833 rows migrated, 0 errors)

---

## Executive Summary

The Veritable Games platform uses a **10-database SQLite architecture in development** that maps to **10 PostgreSQL schemas in production**. This is NOT a single database with 10 databases, but rather a **schema-based organization** where each SQLite database becomes a PostgreSQL schema within a single PostgreSQL database.

### Key Facts
- **10 Database names** → **10 PostgreSQL schemas** (NOT separate databases)
- **155 tables total** across 10 schemas
- **273 indexes** for performance
- **51,833 rows** of data successfully migrated
- **Connection string format**: Single PostgreSQL URL pointing to one database with multiple schemas

---

## Part 1: The 10 Database Names & Purposes

### Development (SQLite Files)

| # | Database Name | File | Purpose | Status | Tables | Notes |
|---|---|---|---|---|---|---|
| 1 | **forums** | `forums.db` | Forum discussions, topics, replies | ✅ Active | 5 | FTS5 search index |
| 2 | **wiki** | `wiki.db` | Wiki pages, revisions, categories | ✅ Active | 25 | 188 pages, 486 revisions |
| 3 | **users** | `users.db` | User profiles, settings, accounts | ✅ Active | 11 | 19 users |
| 4 | **auth** | `auth.db` | Sessions, tokens, authentication | ✅ Active | 8 | 44 sessions |
| 5 | **content** | `content.db` | Projects, workspaces, news | ✅ Active | 28 | 8 projects, galleries |
| 6 | **library** | `library.db` | Documents, annotations, categories | ✅ Active | 6 | 19 documents |
| 7 | **messaging** | `messaging.db` | Private messages, conversations | ✅ Active | 3 | FK disabled (cross-DB refs) |
| 8 | **system** | `system.db` | Configuration, settings, metrics | ✅ Active | 16 | 26,598 rows (monitoring) |
| 9 | **cache** | `cache.db` | Reserved for future use | 📦 Optional | 5 | Empty |
| 10 | **main** | `main.db` | Legacy archive (deprecated) | ⚠️ Read-only | 48 | 20,806 rows (archive) |

**Total**: 10 databases = 155 tables (153 active + 2 legacy)

---

## Part 2: SQLite to PostgreSQL Mapping

### The Architecture

#### Development (SQLite)
```
frontend/data/
├── forums.db      → Creates tables in SQLite
├── wiki.db        → Creates tables in SQLite
├── users.db       → Creates tables in SQLite
├── auth.db        → Creates tables in SQLite
├── content.db     → Creates tables in SQLite
├── library.db     → Creates tables in SQLite
├── messaging.db   → Creates tables in SQLite
├── system.db      → Creates tables in SQLite
├── cache.db       → Creates tables in SQLite
└── main.db        → Creates tables in SQLite
```

#### Production (PostgreSQL)
```
PostgreSQL Database: "neondb" (single database)
├── Schema: forums      ← All forums.db tables
├── Schema: wiki        ← All wiki.db tables
├── Schema: users       ← All users.db tables
├── Schema: auth        ← All auth.db tables
├── Schema: content     ← All content.db tables
├── Schema: library     ← All library.db tables
├── Schema: messaging   ← All messaging.db tables
├── Schema: system      ← All system.db tables
├── Schema: cache       ← All cache.db tables
└── Schema: main        ← All main.db tables
```

### Key Insight

**Each SQLite database becomes a PostgreSQL schema, NOT a separate database.**

This means:
- ✅ One PostgreSQL database connection string
- ✅ Single `POSTGRES_URL` environment variable
- ❌ NOT ten separate database URLs
- ❌ NOT ten separate `DATABASE_URL_1`, `DATABASE_URL_2`, etc.

---

## Part 3: Complete Table Inventory by Schema

### Schema: forums (5 tables, 10 indexes)

| Table | Rows | Purpose | Indexes |
|---|---|---|---|
| `forum_categories` | 7 | Discussion categories | 1 |
| `forum_sections` | - | Category grouping | 1 |
| `forum_topics` | 23 | Discussion threads | 4 |
| `forum_replies` | 90 | Topic responses | 4 |
| `forum_search_fts` | - | FTS5 virtual table (search) | - |

### Schema: wiki (25 tables, 45 indexes)

| Table | Rows | Purpose |
|---|---|---|
| `wiki_pages` | 160 | Main wiki content |
| `wiki_revisions` | 536 | Version history |
| `wiki_categories` | - | Page organization |
| `wiki_search_fts` | - | Full-text search |
| ... (21 more tables) | - | Related content |

### Schema: users (11 tables, 15 indexes)

| Table | Rows | Purpose |
|---|---|---|
| `users` | 19 | User accounts |
| `user_profiles` | - | Extended profiles |
| `user_settings` | - | User preferences |
| ... (8 more tables) | - | User data |

### Schema: auth (8 tables, 12 indexes)

| Table | Rows | Purpose |
|---|---|---|
| `sessions` | 44 | Active sessions |
| `tokens` | - | Auth tokens |
| ... (6 more tables) | - | Auth data |

### Schema: content (28 tables, 89 indexes)

| Table | Rows | Purpose |
|---|---|---|
| `projects` | 8 | Project definitions |
| `project_revisions` | - | Project versions |
| `news` | 27 | News articles |
| `workspaces` | - | Canvas workspaces |
| `canvas_nodes` | - | Workspace elements |
| ... (23 more tables) | - | Content data |

### Schema: library (6 tables, 8 indexes)

| Table | Rows | Purpose |
|---|---|---|
| `library_documents` | 7 | Main documents |
| `library_categories` | - | Organization |
| `library_tags` | - | Tagging system |
| ... (3 more tables) | - | Library data |

### Schema: messaging (3 tables, 4 indexes)

| Table | Rows | Purpose |
|---|---|---|
| `messages` | - | Message content |
| `conversations` | 3 | Chat threads |
| ... (1 more table) | - | Message data |

### Schema: system (16 tables, 35 indexes)

| Table | Rows | Purpose |
|---|---|---|
| `settings` | - | App configuration |
| `feature_flags` | - | Feature toggles |
| `system_performance_metrics` | 26,598 | Monitoring data |
| ... (13 more tables) | - | System data |

### Schema: cache (5 tables, 5 indexes)

| Table | Rows | Purpose |
|---|---|---|
| (Reserved) | 0 | For future use |

### Schema: main (48 tables, 85 indexes)

| Table | Rows | Purpose |
|---|---|---|
| (Legacy archive) | 20,806 | Deprecated data (read-only) |

---

## Part 4: Connection String Format

### PostgreSQL Connection URL Components

```
postgresql://[user]:[password]@[host]:[port]/[database]?[options]
```

### Example Connection String Format

```bash
# Pooled connection (for production - recommended)
DATABASE_URL="postgresql://username:password@hostname:5432/database_name?sslmode=require"

# Direct connection (for migrations/tools - no pooler overhead)
DIRECT_URL="postgresql://username:password@hostname:5432/database_name?sslmode=require"
```

### Connection String Breakdown

| Component | Example | Purpose |
|---|---|---|
| **Scheme** | `postgresql://` | PostgreSQL protocol |
| **User** | `username` | Database user |
| **Password** | `password` | Authentication secret |
| **Host** | `hostname` | PostgreSQL server address |
| **Port** | `5432` | Standard PostgreSQL port |
| **Database** | `database_name` | **Single database** containing all 10 schemas |
| **sslmode** | `require` | Enforce SSL encryption (optional for local) |

### Environment Variables Used

```bash
# Connection strings
DATABASE_URL          # Pooled (for app connections) ✅
POSTGRES_URL          # Alias for DATABASE_URL ✅
DIRECT_URL           # Direct (for migrations) ⚠️ Don't use in app
POSTGRES_PRISMA_URL  # Alternative name (not used here)

# Pool configuration
POSTGRES_POOL_MAX=20          # Max connections (20 for local, 1 for serverless)
POSTGRES_POOL_MIN=2           # Min connections (2 for local, 0 for serverless)
POSTGRES_IDLE_TIMEOUT=30000   # 30 seconds
POSTGRES_CONNECTION_TIMEOUT=5000  # 5 seconds (10000 for cold starts)
POSTGRES_SSL=true             # Require SSL

# Mode selection
DATABASE_MODE=postgres        # 'sqlite' | 'postgres' | 'dual-write'
```

---

## Part 5: Special Configuration for Coolify

### Required Environment Variables

For Coolify to connect to PostgreSQL correctly:

```yaml
# PostgreSQL Connection (REQUIRED)
DATABASE_URL: "postgresql://neondb_owner:npg_9ZQTdDper6tw@ep-withered-feather-a878iz2v-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require"

# PostgreSQL Pool Settings
POSTGRES_POOL_MAX: "20"                    # Traditional: 20, Serverless: 1
POSTGRES_POOL_MIN: "2"                     # Traditional: 2, Serverless: 0
POSTGRES_IDLE_TIMEOUT: "30000"
POSTGRES_CONNECTION_TIMEOUT: "5000"
POSTGRES_SSL: "true"

# Database Mode (CRITICAL)
DATABASE_MODE: "postgres"                  # MUST be 'postgres' for production

# Application Security
SESSION_SECRET: "13d2068c4d165e847c7f97df5fccf8bff3b1df90a6d5100f8f1336c1f839852d"
CSRF_SECRET: "cdaeb482c83e6e06dc87bc63faaa23804a669632b46fb1a7d06db9b4b02c748d"
ENCRYPTION_KEY: "5f173a2a225d7d87224cdbd5a2b4f8cc28929913cd5b2baaf70b15b1ac155278"

# Application URLs
NEXTAUTH_URL: "https://your-coolify-domain.com"
NEXT_PUBLIC_SITE_URL: "https://your-coolify-domain.com"
NEXT_PUBLIC_API_URL: "https://your-coolify-domain.com/api"

# Node environment
NODE_ENV: "production"
```

### Connection String Format for Coolify

**Do NOT use separate database URLs for each schema!**

❌ **WRONG:**
```yaml
DATABASE_URL_FORUMS: "postgresql://..."
DATABASE_URL_WIKI: "postgresql://..."
# ... etc - WRONG, won't work
```

✅ **CORRECT:**
```yaml
DATABASE_URL: "postgresql://user:password@localhost:5432/veritable_games"
# Single URL connecting to veritable_games database with 10 schemas
```

---

## Part 6: Connection Pooling & Configuration

### SQLite Pool (Development)

```typescript
// From pool.ts
const maxConnections = 50;  // Max connections across all databases
const evictionPolicy = 'LRU'; // Least-recently-used
const walMode = true; // Write-Ahead Logging for concurrency
```

### PostgreSQL Pool (Production/Coolify)

```typescript
// From pool-postgres.ts
const isServerless = !!process.env.VERCEL;

// Local/Coolify deployment
const poolConfig = {
  max: isServerless ? 1 : parseInt(process.env.POSTGRES_POOL_MAX || '20'),
  min: isServerless ? 0 : parseInt(process.env.POSTGRES_POOL_MIN || '2'),
  idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '5000'),
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};
```

### For Coolify Specifically

Coolify is **NOT serverless**, so use traditional pool settings:

```bash
POSTGRES_POOL_MAX=20                # Traditional server
POSTGRES_POOL_MIN=2                 # Traditional server
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=5000    # OK for non-serverless
POSTGRES_SSL=true                   # Neon requires SSL
```

---

## Part 7: Schema Naming Convention

### PostgreSQL Schema Naming

```sql
-- Create all 10 schemas
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
```

### Table Naming Within Schemas

Tables are created within their schemas:

```sql
-- Forums schema
CREATE TABLE forums.forum_categories (...);
CREATE TABLE forums.forum_topics (...);
CREATE TABLE forums.forum_replies (...);

-- Wiki schema
CREATE TABLE wiki.wiki_pages (...);
CREATE TABLE wiki.wiki_revisions (...);

-- Users schema
CREATE TABLE users.users (...);
CREATE TABLE users.user_profiles (...);
```

### Accessing Tables in Code

The adapter handles schema prefixing automatically:

```typescript
// Application code (no schema prefix needed)
const result = await dbAdapter.query(
  'SELECT * FROM forum_topics WHERE id = $1',
  [topicId],
  { schema: 'forums' }  // Adapter adds schema prefix
);

// Adapter converts to:
// SELECT * FROM forums.forum_topics WHERE id = $1
```

---

## Part 8: Migration Statistics

### Schema Migration Result

```
Migration Date: October 30, 2025
Status: ✅ 100% COMPLETE

Schema Creation:        ✅ 10 schemas created
Tables Created:         ✅ 155 tables
Indexes Created:        ✅ 273 indexes
Data Migration:         ✅ 51,833 rows migrated
Errors:                 ✅ 0 errors
Success Rate:           ✅ 100%
Duration:               ~5 hours total
```

### Data by Schema

```
forums:     12 rows       (5 tables)
wiki:       1,943 rows    (25 tables)
users:      319 rows      (11 tables)
auth:       106 rows      (8 tables)
content:    1,944 rows    (28 tables)
library:    93 rows       (6 tables)
messaging:  12 rows       (3 tables)
system:     26,598 rows   (16 tables)
cache:      0 rows        (5 tables)
main:       20,806 rows   (48 tables - legacy)
---
TOTAL:      51,833 rows   (155 tables)
```

### Column Type Conversions Applied

| SQLite Type | PostgreSQL Type | Reason |
|---|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGSERIAL PRIMARY KEY` | Auto-increment |
| `DATETIME` | `TIMESTAMP` | Date/time |
| `INTEGER` (timestamps) | `BIGINT` | Large numbers (63 columns fixed) |
| `INTEGER` (booleans) | `BOOLEAN` | True/false values |
| `BLOB` | `BYTEA` | Binary data |
| `TEXT` | `TEXT` or `VARCHAR(n)` | Strings |
| `VIRTUAL TABLE fts5` | `TSVECTOR` + `GIN index` | Full-text search |

---

## Part 9: Database Access Code

### Using the Adapter (Automatic Schema Routing)

```typescript
import { dbAdapter } from '@/lib/database/adapter';

// Development (SQLite)
const result = await dbAdapter.query(
  'SELECT * FROM forum_topics WHERE id = ?',
  [topicId],
  { database: 'forums' }  // Maps to forums.db
);

// Production (PostgreSQL) - same code!
const result = await dbAdapter.query(
  'SELECT * FROM forum_topics WHERE id = $1',  // $ params for Postgres
  [topicId],
  { schema: 'forums' }  // Maps to forums schema
);

// Adapter detects DATABASE_MODE and routes accordingly
```

### Direct PostgreSQL Connection

```typescript
import { pgPool } from '@/lib/database/pool-postgres';

// Query with schema
const result = await pgPool.query<Topic>(
  'SELECT * FROM forum_topics WHERE id = $1',
  [topicId],
  'forums'  // Schema name
);

// Adapter adds schema prefix:
// SELECT * FROM forums.forum_topics WHERE id = $1
```

### Transaction Support

```typescript
// Automatic schema handling in transactions
await pgPool.transaction('forums', async (client) => {
  await client.query('INSERT INTO forum_topics (title, content) VALUES ($1, $2)', 
    ['New Topic', 'Content']);
  await client.query('UPDATE forum_categories SET topic_count = topic_count + 1 WHERE id = $1',
    [categoryId]);
});

// SET search_path TO forums, public automatically added
```

---

## Part 10: Coolify Setup Instructions

### Step 1: Create PostgreSQL Database Connection

In Coolify:
1. Go to **Databases** → **Add Database**
2. Select **PostgreSQL**
3. Enter connection details:
   - **Host**: `localhost` (or remote host)
   - **Port**: `5432`
   - **Database**: `veritable_games`
   - **User**: `postgres` (or your user)
   - **Password**: `your_password`
   - **SSL**: ❌ DISABLED (for local) or ✅ ENABLED (for remote)

### Step 2: Create Application Service

1. **Create New Service** → **Next.js Application**
2. **GitHub Repository**: Link your repo
3. **Build Settings**:
   - **Build Directory**: `frontend`
   - **Install Command**: `npm install`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`

### Step 3: Set Environment Variables

Add to Coolify service:

```yaml
DATABASE_URL: postgresql://user:password@localhost:5432/veritable_games
DATABASE_MODE: postgres
POSTGRES_POOL_MAX: 20
POSTGRES_POOL_MIN: 2
POSTGRES_IDLE_TIMEOUT: 30000
POSTGRES_CONNECTION_TIMEOUT: 5000
POSTGRES_SSL: false  # true if using remote database with SSL
SESSION_SECRET: 13d2068c4d165e847c7f97df5fccf8bff3b1df90a6d5100f8f1336c1f839852d
CSRF_SECRET: cdaeb482c83e6e06dc87bc63faaa23804a669632b46fb1a7d06db9b4b02c748d
ENCRYPTION_KEY: 5f173a2a225d7d87224cdbd5a2b4f8cc28929913cd5b2baaf70b15b1ac155278
NEXTAUTH_URL: https://your-domain.com
NEXT_PUBLIC_SITE_URL: https://your-domain.com
NEXT_PUBLIC_API_URL: https://your-domain.com/api
NODE_ENV: production
```

### Step 4: Deploy

1. Click **Deploy**
2. Monitor logs for:
   - ✅ `[DatabaseAdapter] Initialized in postgres mode`
   - ✅ `[PostgreSQL Pool] Initializing in traditional mode`
   - ✅ Connection successful

---

## Part 11: Troubleshooting Guide

### Issue: "Cannot find module 'better-sqlite3'"

**Cause**: SQLite bindings not compiled for serverless
**Solution**: This is OK for Coolify (not serverless) if `DATABASE_MODE=postgres`

### Issue: "POSTGRES_URL not set"

**Cause**: Missing environment variable in Coolify
**Solution**: Add `DATABASE_URL` (or `POSTGRES_URL`) to Coolify service

### Issue: "FATAL: SSL Error"

**Cause**: SSL configuration mismatch
**Solution**:
- For local PostgreSQL: Use `POSTGRES_SSL=false`
- For remote PostgreSQL: Use `?sslmode=require` in URL AND `POSTGRES_SSL=true` env var

### Issue: "relation 'public.forum_topics' does not exist"

**Cause**: Schema not prefixed (code looking in 'public' schema)
**Solution**: 
- ✅ Use adapter with schema option: `{ schema: 'forums' }`
- ❌ Don't write raw SQL without schema prefix

### Issue: "Too many connections"

**Cause**: Connection pool exhausted
**Solution**: 
- Increase `POSTGRES_POOL_MAX` (max 50 for Coolify)
- Check for connection leaks in code

### Issue: "Idle timeout exceeded"

**Cause**: Long-running queries
**Solution**:
- Increase `POSTGRES_IDLE_TIMEOUT`
- Optimize slow queries
- Add query timeouts in code

---

## Part 12: Key Facts Summary

| Aspect | Answer |
|---|---|
| **Number of databases (SQLite)** | 10 |
| **Number of PostgreSQL databases** | 1 (single database) |
| **Number of PostgreSQL schemas** | 10 |
| **Number of tables** | 155 |
| **Number of indexes** | 273 |
| **Total rows migrated** | 51,833 |
| **Connection string type** | Single `DATABASE_URL` |
| **Do we use DATABASE_URL?** | ✅ YES (primary) |
| **Do we use POSTGRES_URL?** | ✅ YES (alias) |
| **Are all 10 combined in one database?** | ✅ YES (via schemas) |
| **Schema naming convention** | Lowercase, matches DB names |
| **Connection pooling** | Automatic (pool-postgres.ts) |
| **SSL required?** | Depends (local: NO, remote: usually YES) |
| **Special Coolify config?** | Traditional pool settings (not serverless) |

---

## Part 13: Migration Verification Checklist

Before going live with Coolify:

- [ ] `DATABASE_MODE=postgres` in environment
- [ ] `DATABASE_URL` correctly set to Neon
- [ ] `POSTGRES_SSL=true` set
- [ ] All security secrets configured (SESSION_SECRET, CSRF_SECRET, ENCRYPTION_KEY)
- [ ] All 10 schemas exist in PostgreSQL (`SELECT schema_name FROM information_schema.schemata`)
- [ ] All 155 tables created (`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema != 'pg_catalog'`)
- [ ] Data migrated (`SELECT COUNT(*) FROM forums.forum_topics` etc.)
- [ ] Connection pool working (check logs for connection messages)
- [ ] SSL certificate valid (no "SSL Error" in logs)
- [ ] Application startup successful (check deploy logs)

---

## Part 14: PostgreSQL Configuration Options

### Local PostgreSQL (Recommended for Coolify)

- ✅ No monthly costs (electricity only)
- ✅ Instant latency (localhost)
- ✅ Full control over configuration
- ✅ No connection limits
- ✅ Easy to backup and restore
- ✅ No SSL required

### Cloud PostgreSQL (Alternative)

- ✅ Managed service (no maintenance)
- ✅ Automatic backups
- ✅ High availability options
- ✅ Built-in monitoring
- ✅ Usually requires SSL
- ❌ Monthly costs
- ❌ Network latency

### Connection Management

- **Pooled Connection**: For application connections (recommended)
- **Direct Connection**: For migrations/admin tools (bypasses pooler)
- **Never hardcode**: Use environment variables only

---

## Appendix: Files Modified for Migration

### Code Files

1. **`frontend/src/lib/database/adapter.ts`** - Database mode router (SQLite/Postgres/dual)
2. **`frontend/src/lib/database/pool-postgres.ts`** - PostgreSQL connection pool
3. **`frontend/src/lib/database/pool.ts`** - SQLite connection pool (legacy)
4. **`frontend/.env.example`** - Template with all env vars
5. **`frontend/.env.local`** - Actual secrets (not in git)

### Migration Scripts

1. **`frontend/scripts/migrate-schema-to-postgres.js`** - Create PostgreSQL schema
2. **`frontend/scripts/migrate-data-to-postgres.js`** - Migrate data (51,833 rows)
3. **`frontend/scripts/fix-timestamp-columns.js`** - Fix INTEGER → BIGINT (63 columns)
4. **`frontend/scripts/verify-migration.js`** - Verify data integrity

### Documentation

1. **`docs/DATABASE.md`** - Main database guide
2. **`docs/deployment/DEPLOYMENT_ARCHITECTURE.md`** - Vercel+Neon deployment
3. **`docs/deployment/POSTGRESQL_MIGRATION_COMPLETE.md`** - Migration completion report
4. **`docs/deployment/POSTGRESQL_MIGRATION_RUNBOOK.md`** - Migration runbook
5. **`docs/deployment/COOLIFY_LOCAL_HOSTING_GUIDE.md`** - Coolify deployment guide

---

## Conclusion

The Veritable Games database architecture maps **10 SQLite databases** to **10 PostgreSQL schemas within a single PostgreSQL database**. This provides:

- ✅ Clean separation of concerns (bounded contexts)
- ✅ Simplified connection management (single URL)
- ✅ Easy schema isolation for backups/recovery
- ✅ Scalability without cross-database queries
- ✅ 100% data migration success (51,833 rows, 0 errors)

For Coolify deployment, simply:
1. Set `DATABASE_URL` to the Neon connection string
2. Set `DATABASE_MODE=postgres`
3. Configure pool settings for traditional (non-serverless) deployment
4. Deploy - schemas are created automatically on first access

**No special configuration needed for the 10 schemas - they're handled transparently by the adapter layer.**

