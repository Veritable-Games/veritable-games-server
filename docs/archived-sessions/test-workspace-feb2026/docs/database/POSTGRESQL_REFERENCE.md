# PostgreSQL Reference Guide

**Last Updated**: November 12, 2025
**Version**: PostgreSQL 15
**Production**: 192.168.1.15 (Coolify self-hosted)
**Status**: ✅ Production deployment complete (November 5, 2025)

---

## Table of Contents

- [Overview](#overview)
- [PostgreSQL vs SQLite](#postgresql-vs-sqlite)
- [Schema Architecture](#schema-architecture)
- [Connection Management](#connection-management)
- [Full-Text Search](#full-text-search)
- [Indexes](#indexes)
- [Migrations](#migrations)
- [Performance Tuning](#performance-tuning)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Veritable Games platform uses PostgreSQL 15 in production for all database operations. This guide covers PostgreSQL-specific features, differences from SQLite, and best practices.

### Key Differences from SQLite

| Feature | SQLite (Development) | PostgreSQL (Production) |
|---------|---------------------|-------------------------|
| **Storage** | File-based (10 .db files) | Server-based (1 database, 13 schemas) |
| **Concurrency** | Limited (WAL mode helps) | Excellent (MVCC) |
| **Full-text** | FTS5 virtual tables | GIN indexes + to_tsvector |
| **Cross-database** | Not possible | Cross-schema JOINs allowed |
| **Array types** | TEXT with delimiters | Native ARRAY type |
| **JSON** | TEXT field | Native JSONB with indexing |
| **Connection pooling** | Required (file locks) | Required (connection limits) |
| **Size limits** | ~281 TB theoretical | Unlimited (table-level) |

---

## PostgreSQL vs SQLite

### What's the Same

✅ Both use SQL standard syntax
✅ Both support transactions (ACID)
✅ Both have foreign keys
✅ Both support triggers
✅ Both have indexes

### What's Different

#### Data Types

**SQLite**:
- 5 storage classes: NULL, INTEGER, REAL, TEXT, BLOB
- All types are "affinity" (flexible)

**PostgreSQL**:
- 40+ built-in types
- Strict type system
- Arrays: `text[]`, `integer[]`
- JSON: `json`, `jsonb`
- UUID: `uuid`
- Date/Time: `timestamp`, `timestamptz`

**Migration Example**:
```sql
-- SQLite
CREATE TABLE users (
  tags TEXT -- stored as comma-separated
);

-- PostgreSQL
CREATE TABLE users.users (
  tags TEXT[] -- native array type
);
```

#### Full-Text Search

**SQLite FTS5**:
```sql
CREATE VIRTUAL TABLE forum_search_fts USING fts5(
  title, content,
  content=topics,
  content_rowid=id
);

-- Query
SELECT * FROM topics t
JOIN forum_search_fts fts ON t.id = fts.rowid
WHERE fts MATCH 'anarchism';
```

**PostgreSQL GIN Indexes**:
```sql
CREATE INDEX idx_topics_fulltext ON forums.topics
USING GIN (to_tsvector('english', title || ' ' || content));

-- Query
SELECT * FROM forums.topics
WHERE to_tsvector('english', title || ' ' || content) @@
      to_tsquery('english', 'anarchism');
```

---

## Schema Architecture

### 13 PostgreSQL Schemas

Production uses **schemas** instead of separate database files:

```sql
-- List all schemas
SELECT schema_name FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
ORDER BY schema_name;

-- Results:
-- anarchist
-- auth
-- cache
-- content
-- documents
-- forums
-- library
-- main
-- messaging
-- shared
-- system
-- users
-- wiki
```

### Cross-Schema Queries

**Allowed in PostgreSQL** (not possible in SQLite):

```sql
-- Get user with forum post count
SELECT
  u.id,
  u.username,
  COUNT(t.id) as topic_count
FROM users.users u
LEFT JOIN forums.topics t ON u.id = t.author_id
GROUP BY u.id, u.username;
```

**Best Practice**: Use ProfileAggregatorService for domain isolation

```typescript
// ✅ Recommended approach (maintains architecture boundaries)
import { profileAggregatorService } from '@/lib/profiles/aggregator';
const profile = await profileAggregatorService.getFullProfile(userId);
// Returns: { user, forumStats, wikiStats, libraryStats }
```

---

## Connection Management

### Connection Pool Configuration

**Environment Variables**:
```bash
# Primary connection URL
DATABASE_URL=postgresql://user:password@host:5432/veritable_games

# Alternative (same meaning)
POSTGRES_URL=postgresql://user:password@host:5432/veritable_games
```

### Pool Settings

```typescript
// In production (pool-postgres.ts)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                  // Maximum connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout connecting
});
```

### Connection Limits

- **PostgreSQL Default**: 100 connections
- **Application Pool**: 20 connections max
- **Reserved**: 5 for admin/maintenance
- **Available**: 75 for other services

**Check current connections**:
```sql
SELECT
  datname as database,
  count(*) as connections
FROM pg_stat_activity
GROUP BY datname;
```

---

## Full-Text Search

### GIN Indexes

**Create full-text index**:
```sql
-- For English text
CREATE INDEX idx_documents_fulltext ON library.documents
USING GIN (to_tsvector('english', title || ' ' || description || ' ' || content));

-- For multi-language (generic)
CREATE INDEX idx_documents_fulltext_simple ON library.documents
USING GIN (to_tsvector('simple', title || ' ' || content));
```

### Search Queries

**Basic search**:
```sql
SELECT * FROM library.documents
WHERE to_tsvector('english', title || ' ' || content) @@
      to_tsquery('english', 'anarchism');
```

**Ranked search**:
```sql
SELECT
  id, title,
  ts_rank(
    to_tsvector('english', title || ' ' || content),
    to_tsquery('english', 'anarchism & mutual & aid')
  ) as rank
FROM library.documents
WHERE to_tsvector('english', title || ' ' || content) @@
      to_tsquery('english', 'anarchism & mutual & aid')
ORDER BY rank DESC
LIMIT 20;
```

**Phrase search**:
```sql
SELECT * FROM library.documents
WHERE to_tsvector('english', content) @@
      phraseto_tsquery('english', 'direct action');
```

### Language Configurations

Available configurations:
- `simple` (no stemming)
- `english`, `spanish`, `french`, `german`, `italian`, `portuguese`
- `russian`, `arabic`, `chinese`, `japanese`

---

## Indexes

### Index Types

| Type | Use Case | Example |
|------|----------|---------|
| **B-tree** | Standard indexes (default) | `CREATE INDEX idx_users_email ON users.users(email);` |
| **GIN** | Full-text search, arrays, JSON | `CREATE INDEX idx_docs_fts ON docs USING GIN(to_tsvector(...));` |
| **GiST** | Geometric, full-text | `CREATE INDEX idx_spatial USING GiST(location);` |
| **BRIN** | Large tables, sequential data | `CREATE INDEX idx_created USING BRIN(created_at);` |
| **Hash** | Equality only (rare) | `CREATE INDEX idx_hash USING HASH(id);` |

### Performance

**View index usage**:
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY idx_scan DESC;
```

**Find unused indexes**:
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## Migrations

### Current Status

- **SQLite → PostgreSQL**: ✅ Complete (November 2025)
- **Total Rows Migrated**: 50,646
- **Success Rate**: 99.99%
- **Schema Count**: 13 schemas, 164 tables

### Migration Process

1. **Export from SQLite**: Use better-sqlite3 to export data
2. **Transform**: Convert SQLite types to PostgreSQL types
3. **Create Schemas**: Set up PostgreSQL schemas
4. **Import Data**: Bulk insert with transactions
5. **Create Indexes**: Rebuild all 545 indexes
6. **Verify**: Check row counts, test queries

### Type Conversions

| SQLite | PostgreSQL | Notes |
|--------|------------|-------|
| `INTEGER` | `SERIAL` | For auto-increment IDs |
| `INTEGER` | `INTEGER` | Standard integers |
| `TEXT` | `TEXT` | Variable length text |
| `TEXT` | `VARCHAR(n)` | Limited length text |
| `TEXT` (delimited) | `TEXT[]` | Arrays |
| `TEXT` (JSON string) | `JSONB` | JSON data |
| `REAL` | `FLOAT` | Floating point |
| `BLOB` | `BYTEA` | Binary data |

### Migration Script Example

```typescript
// Export from SQLite
const sqliteDb = new Database('./data/users.db');
const rows = sqliteDb.prepare('SELECT * FROM users').all();

// Transform and import to PostgreSQL
const pgClient = await pool.connect();
try {
  await pgClient.query('BEGIN');

  for (const row of rows) {
    await pgClient.query(
      'INSERT INTO users.users (id, username, email, created_at) VALUES ($1, $2, $3, $4)',
      [row.id, row.username, row.email, new Date(row.created_at)]
    );
  }

  await pgClient.query('COMMIT');
} catch (error) {
  await pgClient.query('ROLLBACK');
  throw error;
} finally {
  pgClient.release();
}
```

---

## Performance Tuning

### Configuration

**Key PostgreSQL settings** (in `postgresql.conf`):

```ini
# Memory
shared_buffers = 256MB           # 25% of RAM
effective_cache_size = 1GB       # 50-75% of RAM
work_mem = 8MB                   # Per operation
maintenance_work_mem = 128MB     # For VACUUM, CREATE INDEX

# Planner
random_page_cost = 1.1           # For SSD storage
effective_io_concurrency = 200   # For SSD storage

# Checkpoints
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Connection
max_connections = 100
```

### Query Optimization

**EXPLAIN ANALYZE**:
```sql
EXPLAIN ANALYZE
SELECT u.username, COUNT(t.id) as topics
FROM users.users u
LEFT JOIN forums.topics t ON u.id = t.author_id
GROUP BY u.id, u.username
ORDER BY topics DESC
LIMIT 10;
```

**Vacuum and Analyze**:
```sql
-- Analyze table statistics (for query planner)
ANALYZE users.users;

-- Vacuum (reclaim space, update statistics)
VACUUM ANALYZE users.users;

-- Full vacuum (more aggressive, locks table)
VACUUM FULL users.users;
```

### Monitoring

**Check table sizes**:
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) -
                 pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Slow queries**:
```sql
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## Backup & Recovery

### Backup Strategies

**1. pg_dump (Logical Backup)**:
```bash
# Full database backup
pg_dump -h localhost -U postgres -d veritable_games -F c -f backup.dump

# Single schema backup
pg_dump -h localhost -U postgres -d veritable_games -n users -F c -f users_backup.dump

# SQL format (human-readable)
pg_dump -h localhost -U postgres -d veritable_games > backup.sql
```

**2. File System Backup**:
```bash
# Stop PostgreSQL first!
sudo systemctl stop postgresql

# Backup data directory
sudo tar -czf postgres_backup.tar.gz /var/lib/postgresql/15/main/

# Restart PostgreSQL
sudo systemctl start postgresql
```

**3. Continuous Archiving (WAL)**:
```ini
# In postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backup/archive/%f'
```

### Restore

**From pg_dump**:
```bash
# Restore full database
pg_restore -h localhost -U postgres -d veritable_games -c backup.dump

# Restore single schema
pg_restore -h localhost -U postgres -d veritable_games -n users users_backup.dump
```

**From SQL file**:
```bash
psql -h localhost -U postgres -d veritable_games < backup.sql
```

---

## Troubleshooting

### Common Issues

#### 1. Connection Refused

**Error**: `could not connect to server: Connection refused`

**Causes**:
- PostgreSQL not running
- Wrong host/port
- Firewall blocking

**Solutions**:
```bash
# Check if running
sudo systemctl status postgresql

# Check listening ports
sudo ss -tlnp | grep postgres

# Check config
grep "listen_addresses" /etc/postgresql/15/main/postgresql.conf
```

#### 2. Too Many Connections

**Error**: `FATAL: sorry, too many clients already`

**Solutions**:
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < current_timestamp - interval '10 minutes';

-- Increase max_connections (requires restart)
ALTER SYSTEM SET max_connections = 200;
```

#### 3. Slow Queries

**Diagnostic**:
```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s

-- View current slow queries
SELECT pid, query, state, query_start
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '5 seconds'
ORDER BY query_start;
```

**Fix**:
- Add indexes on frequently queried columns
- Run `ANALYZE` to update statistics
- Consider query rewrite
- Check `EXPLAIN ANALYZE` output

#### 4. Disk Space

**Check usage**:
```sql
SELECT
  pg_database.datname,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
ORDER BY pg_database_size(pg_database.datname) DESC;
```

**Free space**:
```bash
# Vacuum all databases
sudo -u postgres vacuumdb --all --full --analyze

# Remove old WAL files (if archiving disabled)
sudo -u postgres pg_archivecleanup /var/lib/postgresql/15/main/pg_wal 000000010000000000000001
```

---

## Related Documentation

- **[docs/DATABASE.md](./DATABASE.md)** - Main database documentation
- **[docs/deployment/POSTGRESQL_MIGRATION_COMPLETE.md](../deployment/POSTGRESQL_MIGRATION_COMPLETE.md)** - Migration guide
- **[docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](../deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)** - Production access
- **[frontend/src/lib/database/pool-postgres.ts](../../frontend/src/lib/database/pool-postgres.ts)** - Connection pool implementation

---

**PostgreSQL Official Docs**: https://www.postgresql.org/docs/15/
**Performance Wiki**: https://wiki.postgresql.org/wiki/Performance_Optimization
**Tuning Guide**: https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server

---

**Last Updated**: November 12, 2025
**PostgreSQL Version**: 15.x
**Status**: ✅ Production (192.168.1.15)
