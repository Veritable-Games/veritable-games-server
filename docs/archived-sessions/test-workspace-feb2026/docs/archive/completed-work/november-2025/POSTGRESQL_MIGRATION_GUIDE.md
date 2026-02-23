# PostgreSQL Migration Guide

Comprehensive guide for migrating Veritable Games from SQLite to PostgreSQL for Vercel deployment.

**Status**: Phase 4 Planning
**Timeline**: 4 weeks (16-20 hours)
**Risk Level**: Medium-High (requires careful testing)

---

## Table of Contents

1. [Overview](#overview)
2. [Why PostgreSQL?](#why-postgresql)
3. [Migration Strategy](#migration-strategy)
4. [Schema Conversion](#schema-conversion)
5. [Data Migration](#data-migration)
6. [Connection Pool Refactor](#connection-pool-refactor)
7. [Testing Strategy](#testing-strategy)
8. [Rollback Plan](#rollback-plan)

---

## Overview

### Current Architecture (SQLite)

- **10 separate SQLite databases** (auth, forums, wiki, users, content, library, messaging, system, cache, main)
- **195 tables total** across all databases
- **279 indexes**, 31 triggers, 5 views
- **Connection Pool**: better-sqlite3 with LRU cache (max 50 connections)
- **File-based storage**: `frontend/data/*.db`

### Target Architecture (PostgreSQL)

- **Single PostgreSQL instance** with 10 separate schemas
- **Connection Pool**: node-postgres (pg) with pgBouncer
- **Hosted**: Vercel Postgres or external (Supabase, AWS RDS)
- **Migration**: Dual-write strategy with fallback

---

## Why PostgreSQL?

### Vercel Requirements

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Vercel Support | ❌ No | ✅ Yes |
| Serverless | ❌ Requires filesystem | ✅ Network-based |
| Scalability | Limited to single server | Horizontal scaling |
| Connection Pooling | Process-local | Global with pgBouncer |
| Full-text Search | FTS5 | Built-in (tsvector) |
| JSON Support | Limited | Native JSONB |
| Transactions | File-based locks | MVCC (better concurrency) |

### Trade-offs

**Pros**:
- ✅ Vercel-compatible
- ✅ Better concurrency (100+ connections)
- ✅ Advanced features (JSONB, array types, full-text search)
- ✅ Industry standard (more resources, tools)
- ✅ Better backup/replication

**Cons**:
- ❌ More complex setup (requires hosted database)
- ❌ Higher latency (network vs. filesystem)
- ❌ Cost ($5-25/month for hosting)
- ❌ Migration effort (4 weeks)

---

## Migration Strategy

### Phase 4.1: Schema Conversion (Week 1-2, 8 hours)

**Objective**: Convert all SQLite schemas to PostgreSQL syntax.

#### Step 1: Analyze Existing Schemas

```bash
# Already complete - schemas exported in Phase 3
ls frontend/scripts/seeds/schemas/
# Output: 10 .sql files (auth.sql, forums.sql, etc.)
```

#### Step 2: Conversion Mapping

| SQLite Type | PostgreSQL Type | Notes |
|-------------|-----------------|-------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` | Auto-increment |
| `INTEGER` | `INTEGER` | Same |
| `TEXT` | `TEXT` or `VARCHAR(n)` | Use VARCHAR for bounded strings |
| `REAL` | `REAL` or `NUMERIC` | Use NUMERIC for money |
| `BLOB` | `BYTEA` | Binary data |
| `DATETIME` | `TIMESTAMP` | ISO 8601 format |
| `CURRENT_TIMESTAMP` | `NOW()` or `CURRENT_TIMESTAMP` | Both work |
| `BOOLEAN` (0/1) | `BOOLEAN` | True type |

#### Step 3: Schema Organization

Create **10 PostgreSQL schemas** (namespaces):

```sql
-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS forums;
CREATE SCHEMA IF NOT EXISTS wiki;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS library;
CREATE SCHEMA IF NOT EXISTS messaging;
CREATE SCHEMA IF NOT EXISTS system;
CREATE SCHEMA IF NOT EXISTS cache;
CREATE SCHEMA IF NOT EXISTS main;  -- archive only
```

#### Step 4: Convert Tables

**Example: forums.forum_categories**

SQLite:
```sql
CREATE TABLE forum_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    sort_order INTEGER DEFAULT 0,
    topic_count INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

PostgreSQL:
```sql
CREATE TABLE forums.categories (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    sort_order INTEGER DEFAULT 0,
    topic_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION forums.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categories_updated_at
BEFORE UPDATE ON forums.categories
FOR EACH ROW
EXECUTE FUNCTION forums.update_updated_at();
```

#### Step 5: Convert Indexes

SQLite:
```sql
CREATE INDEX idx_categories_section ON forum_categories(section);
CREATE INDEX idx_categories_public ON forum_categories(is_public);
```

PostgreSQL:
```sql
CREATE INDEX idx_categories_section ON forums.categories(section);
CREATE INDEX idx_categories_public ON forums.categories(is_public) WHERE is_public = true;
-- Note: Partial index for better performance
```

#### Step 6: Convert Full-Text Search

SQLite FTS5:
```sql
CREATE VIRTUAL TABLE forum_search_fts USING fts5(
    topic_id,
    title,
    content
);
```

PostgreSQL tsvector:
```sql
CREATE TABLE forums.topics (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) STORED
);

CREATE INDEX idx_topics_search ON forums.topics USING GIN(search_vector);
```

#### Deliverables:
- ✅ 10 PostgreSQL schema files (`*.postgresql.sql`)
- ✅ Conversion documentation
- ✅ Type mapping reference
- ✅ Index optimization notes

---

### Phase 4.2: Connection Pool Refactor (Week 2, 4 hours)

**Objective**: Replace better-sqlite3 with node-postgres (pg).

#### Step 1: Install Dependencies

```bash
npm install pg
npm install --save-dev @types/pg
```

#### Step 2: Create PostgresPool Class

**File**: `frontend/src/lib/database/postgres-pool.ts`

```typescript
import { Pool, PoolConfig, QueryResult } from 'pg';

export interface PostgresPoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;  // Max connections (default: 20)
  idleTimeoutMillis?: number;  // Default: 30000
  connectionTimeoutMillis?: number;  // Default: 2000
}

export class PostgresPool {
  private pools: Map<string, Pool> = new Map();
  private config: Record<string, PostgresPoolConfig>;

  constructor(config: Record<string, PostgresPoolConfig>) {
    this.config = config;
  }

  /**
   * Get connection pool for a schema
   */
  getPool(schema: string): Pool {
    if (!this.pools.has(schema)) {
      const config = this.config[schema];
      if (!config) {
        throw new Error(`No configuration for schema: ${schema}`);
      }

      const pool = new Pool({
        ...config,
        max: config.max || 20,
        idleTimeoutMillis: config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
      });

      // Handle pool errors
      pool.on('error', (err) => {
        console.error(`PostgreSQL pool error (${schema}):`, err);
      });

      this.pools.set(schema, pool);
    }

    return this.pools.get(schema)!;
  }

  /**
   * Execute query with automatic schema selection
   */
  async query<T = any>(
    schema: string,
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const pool = this.getPool(schema);
    return pool.query(text, params);
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    const promises = Array.from(this.pools.values()).map(pool => pool.end());
    await Promise.all(promises);
    this.pools.clear();
  }
}

// Singleton instance
let pgPool: PostgresPool | null = null;

export function initPostgresPool(config: Record<string, PostgresPoolConfig>): PostgresPool {
  if (!pgPool) {
    pgPool = new PostgresPool(config);
  }
  return pgPool;
}

export function getPostgresPool(): PostgresPool {
  if (!pgPool) {
    throw new Error('PostgresPool not initialized. Call initPostgresPool first.');
  }
  return pgPool;
}
```

#### Step 3: Update dbPool Interface

**File**: `frontend/src/lib/database/pool.ts`

```typescript
// Add database type detection
type DatabaseType = 'sqlite' | 'postgresql';

export function getConnection(dbName: string): Database | Pool {
  const dbType = process.env.DATABASE_TYPE as DatabaseType || 'sqlite';

  if (dbType === 'postgresql') {
    return getPostgresPool().getPool(dbName);
  } else {
    // Existing SQLite logic
    return getSQLiteConnection(dbName);
  }
}
```

#### Step 4: Environment Configuration

**File**: `.env.local`

```bash
# Database Type
DATABASE_TYPE=postgresql  # or 'sqlite'

# PostgreSQL Configuration (Vercel Postgres)
POSTGRES_URL="postgres://user:pass@host:5432/dbname"
POSTGRES_PRISMA_URL="postgres://user:pass@host:5432/dbname?pgbouncer=true"
POSTGRES_URL_NON_POOLING="postgres://user:pass@host:5432/dbname"

# Or individual schemas
DATABASE_AUTH_URL="postgres://user:pass@host:5432/veritablegames?schema=auth"
DATABASE_FORUMS_URL="postgres://user:pass@host:5432/veritablegames?schema=forums"
# ... repeat for all 10 schemas
```

#### Deliverables:
- ✅ PostgresPool class implemented
- ✅ Connection factory updated
- ✅ Environment configuration documented
- ✅ Type definitions complete

---

### Phase 4.3: Query Migration (Week 2-3, 6 hours)

**Objective**: Update all SQL queries to PostgreSQL syntax.

#### Common Conversions

**1. Parameter Binding**

SQLite (positional):
```typescript
db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
```

PostgreSQL (numbered):
```typescript
pool.query('SELECT * FROM users.profiles WHERE id = $1', [userId]);
```

**2. LIMIT/OFFSET**

Same syntax, but PostgreSQL optimizes better:
```sql
SELECT * FROM forums.topics
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;
```

**3. Date/Time Functions**

| SQLite | PostgreSQL |
|--------|------------|
| `datetime('now')` | `NOW()` |
| `date('now', '-7 days')` | `NOW() - INTERVAL '7 days'` |
| `strftime('%Y', created_at)` | `EXTRACT(YEAR FROM created_at)` |

**4. Boolean Values**

SQLite:
```sql
WHERE is_public = 1
```

PostgreSQL:
```sql
WHERE is_public = true
```

**5. Full-Text Search**

SQLite FTS5:
```sql
SELECT * FROM forum_search_fts
WHERE forum_search_fts MATCH 'search term'
```

PostgreSQL:
```sql
SELECT * FROM forums.topics
WHERE search_vector @@ to_tsquery('english', 'search & term')
ORDER BY ts_rank(search_vector, to_tsquery('english', 'search & term')) DESC
```

#### Services to Update

Total: **~30 service files**, ~**100+ API routes**

**Priority Services**:
1. `AuthService` (10 methods)
2. `ForumService` (25 methods)
3. `WikiPageService` (20 methods)
4. `UserService` (15 methods)
5. `ContentService` (18 methods)

**Testing Strategy**:
- Unit test each service method
- Integration test API routes
- E2E test critical flows (auth, forum posting, wiki editing)

#### Deliverables:
- ✅ All services updated
- ✅ Query compatibility layer
- ✅ Test coverage >80%
- ✅ Performance benchmarks

---

### Phase 4.4: Data Migration (Week 3-4, 4 hours)

**Objective**: Migrate existing data from SQLite to PostgreSQL.

#### Step 1: Export SQLite Data

```bash
node scripts/export-sqlite-data.js
```

Creates JSON exports:
- `migration/auth-data.json`
- `migration/forums-data.json`
- `migration/wiki-data.json`
- ... (10 files total)

#### Step 2: Transform Data

Handle type conversions:
- Boolean: 0/1 → false/true
- Dates: TEXT → TIMESTAMP
- NULL handling
- ID sequence adjustment

#### Step 3: Import to PostgreSQL

```bash
node scripts/import-postgresql-data.js
```

With validation:
- Row counts match
- Foreign keys valid
- No data loss
- Checksums match

#### Step 4: Verification

```sql
-- Compare record counts
SELECT
  'auth' as schema, COUNT(*) FROM auth.sessions
UNION ALL
SELECT 'forums', COUNT(*) FROM forums.topics
UNION ALL
SELECT 'wiki', COUNT(*) FROM wiki.pages;
-- ... etc
```

#### Deliverables:
- ✅ Data export scripts
- ✅ Data transformation logic
- ✅ Import scripts with validation
- ✅ Rollback procedures

---

## Testing Strategy

### Test Pyramid

```
           E2E Tests (10)
         ----------------
        Integration Tests (50)
       ----------------------
      Unit Tests (200)
     ----------------------
```

### Critical Test Cases

**Authentication** (10 tests):
- Login with username/password
- Session creation/validation
- Password reset flow
- Invitation system
- Admin-only routes

**Forums** (15 tests):
- Create topic
- Post reply
- Full-text search
- Category filtering
- Pagination

**Wiki** (12 tests):
- Create page
- Edit page (revisions)
- Wikilink resolution
- Category assignment
- Search

**Performance** (5 tests):
- Query response time (<100ms)
- Connection pool stability
- Concurrent user load (50 users)
- Large dataset operations
- Memory usage

### Performance Benchmarks

**Target Metrics**:
- Query time: <50ms (p95)
- API response: <200ms (p95)
- Page load: <1s (p75)
- Database connections: <20 concurrent

---

## Rollback Plan

### Emergency Rollback

If critical bugs detected in production:

1. **Immediate**: Revert Vercel deployment to previous version
2. **Switch** environment variable: `DATABASE_TYPE=sqlite`
3. **Restore** SQLite databases from backup
4. **Deploy** rollback commit

### Gradual Rollback

If issues detected during migration:

1. **Dual-write mode**: Write to both SQLite and PostgreSQL
2. **Validate** data consistency
3. **Compare** query results
4. **Switch** read queries gradually

### Data Loss Prevention

- ✅ SQLite backups retained for 30 days
- ✅ PostgreSQL point-in-time recovery enabled
- ✅ Data export before cutover
- ✅ Staged migration (test → staging → production)

---

## Timeline & Effort

| Phase | Duration | Effort | Status |
|-------|----------|--------|--------|
| 4.1 Schema Conversion | 1-2 weeks | 8 hours | Not Started |
| 4.2 Connection Pool | 3-4 days | 4 hours | Not Started |
| 4.3 Query Migration | 1-2 weeks | 6 hours | Not Started |
| 4.4 Data Migration | 3-5 days | 4 hours | Not Started |
| **TOTAL** | **4 weeks** | **22 hours** | **0% Complete** |

---

## Dependencies & Prerequisites

### Required

- ✅ PostgreSQL instance (Vercel Postgres, Supabase, or AWS RDS)
- ✅ Node.js 20+ with pg driver
- ✅ Git repository cleaned (Phase 3 complete)
- ✅ Test environment available

### Optional

- pgBouncer (connection pooling)
- pgAdmin (database management UI)
- PostgREST (if API-first approach desired)
- Prisma (ORM alternative to raw SQL)

---

## Cost Estimate

### Hosting Options

| Provider | Plan | Storage | Connections | Cost |
|----------|------|---------|-------------|------|
| **Vercel Postgres** | Hobby | 256MB | 60 | $0/month |
| **Vercel Postgres** | Pro | 1GB | 120 | $20/month |
| **Supabase** | Free | 500MB | 60 | $0/month |
| **Supabase** | Pro | 8GB | 200 | $25/month |
| **AWS RDS** | db.t4g.micro | 20GB | Variable | $13/month |
| **DigitalOcean** | Managed | 10GB | 25 | $15/month |

**Recommendation**: Start with **Vercel Postgres Hobby** (free), upgrade if needed.

---

## Next Steps

1. **Complete Phase 3** (git cleanup, tagging)
2. **Provision PostgreSQL** database (Vercel or Supabase)
3. **Begin Phase 4.1** (schema conversion)
4. **Set up CI/CD** for automated testing
5. **Create staging environment** for validation

---

**Document Version**: 1.0
**Last Updated**: October 28, 2025
**Author**: Claude Code (Phase 3 preparation)
