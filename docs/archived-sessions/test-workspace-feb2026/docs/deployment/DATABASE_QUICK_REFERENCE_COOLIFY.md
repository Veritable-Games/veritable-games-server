# Veritable Games Database - Quick Reference for Coolify

## TL;DR - 10 Databases → 1 PostgreSQL Database with 10 Schemas

### The 10 Database Names
1. **forums** - Discussion forums (5 tables)
2. **wiki** - Wiki pages (25 tables)
3. **users** - User accounts (11 tables)
4. **auth** - Sessions/tokens (8 tables)
5. **content** - Projects/workspaces (28 tables)
6. **library** - Documents (6 tables)
7. **messaging** - Messages (3 tables)
8. **system** - Configuration/metrics (16 tables)
9. **cache** - Reserved (5 tables)
10. **main** - Legacy archive (48 tables)

**Total: 155 tables, 273 indexes, 51,833 rows**

---

## PostgreSQL Setup for Coolify

### Connection String (Single URL - NOT 10 separate URLs!)

```
DATABASE_URL=postgresql://neondb_owner:npg_9ZQTdDper6tw@ep-withered-feather-a878iz2v-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require
```

### Required Environment Variables

```yaml
# Database Connection
DATABASE_URL: postgresql://neondb_owner:npg_9ZQTdDper6tw@ep-withered-feather-a878iz2v-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require
DATABASE_MODE: postgres

# Connection Pool (for traditional server, NOT serverless)
POSTGRES_POOL_MAX: 20
POSTGRES_POOL_MIN: 2
POSTGRES_IDLE_TIMEOUT: 30000
POSTGRES_CONNECTION_TIMEOUT: 5000
POSTGRES_SSL: true

# Security Secrets (DO NOT REGENERATE!)
SESSION_SECRET: 13d2068c4d165e847c7f97df5fccf8bff3b1df90a6d5100f8f1336c1f839852d
CSRF_SECRET: cdaeb482c83e6e06dc87bc63faaa23804a669632b46fb1a7d06db9b4b02c748d
ENCRYPTION_KEY: 5f173a2a225d7d87224cdbd5a2b4f8cc28929913cd5b2baaf70b15b1ac155278

# Application URLs
NEXTAUTH_URL: https://your-domain.com
NEXT_PUBLIC_SITE_URL: https://your-domain.com
NEXT_PUBLIC_API_URL: https://your-domain.com/api

# Runtime
NODE_ENV: production
```

---

## Key Points

### What Changed from SQLite to PostgreSQL?

| Aspect | SQLite | PostgreSQL |
|--------|--------|-----------|
| **Connection** | 10 separate .db files | 1 database with 10 schemas |
| **Connection URL** | None (filesystem) | Single DATABASE_URL |
| **Pool Size** | 50 max | 20 max (configurable) |
| **Environment Var** | None | DATABASE_URL |
| **Database Mode** | sqlite | **postgres** (CRITICAL!) |
| **Schema Handling** | N/A | Automatic via adapter |

### Architecture

```
SQLite (Dev):          PostgreSQL (Production):
forums.db       →      neondb.forums schema
wiki.db         →      neondb.wiki schema
users.db        →      neondb.users schema
auth.db         →      neondb.auth schema
content.db      →      neondb.content schema
library.db      →      neondb.library schema
messaging.db    →      neondb.messaging schema
system.db       →      neondb.system schema
cache.db        →      neondb.cache schema
main.db         →      neondb.main schema
```

### Migration Status

- ✅ Schema creation: 100% complete (10 schemas, 155 tables)
- ✅ Data migration: 100% complete (51,833 rows, 0 errors)
- ✅ Index creation: 100% complete (273 indexes)
- ✅ Type conversions: 100% complete (63 INTEGER→BIGINT columns fixed)

---

## Critical Configuration

### DATABASE_MODE Must Be Set to "postgres"

```
DATABASE_MODE=postgres  ← CRITICAL! NOT "sqlite"
```

If not set:
- ❌ App will try to use SQLite
- ❌ SQLite files don't exist in production
- ❌ App will crash with "data directory does not exist"

### Use Single DATABASE_URL

Do NOT create separate variables:
```
❌ WRONG:
DATABASE_URL_FORUMS=...
DATABASE_URL_WIKI=...

✅ CORRECT:
DATABASE_URL=postgresql://neondb_owner:...
```

---

## Coolify Deployment Steps

1. **Add PostgreSQL Connection**
   - Host: `ep-withered-feather-a878iz2v-pooler.eastus2.azure.neon.tech`
   - Port: `5432`
   - Database: `neondb`
   - User: `neondb_owner`
   - Password: `npg_9ZQTdDper6tw`
   - SSL: ✅ ON (required for Neon)

2. **Create Next.js Service**
   - Build directory: `frontend`
   - Build command: `npm run build`
   - Start command: `npm run start`

3. **Add Environment Variables** (see above)

4. **Deploy**
   - Monitor logs for: `[DatabaseAdapter] Initialized in postgres mode`
   - Check: `[PostgreSQL Pool] Initializing in traditional mode`

---

## Verification Queries

After deployment, verify:

```sql
-- Check schemas
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name NOT LIKE 'pg_%';

-- Check table count
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema != 'pg_catalog';

-- Check data in forums schema
SELECT COUNT(*) FROM forums.forum_topics;

-- Check data in wiki schema
SELECT COUNT(*) FROM wiki.wiki_pages;
```

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Cannot connect" | DATABASE_URL missing | Add DATABASE_URL env var |
| "FATAL: SSL Error" | SSL not enabled | Add `?sslmode=require` to URL |
| "relation not found" | Wrong schema | Use adapter with schema option |
| "Too many connections" | Pool exhausted | Increase POSTGRES_POOL_MAX |
| "data directory does not exist" | DATABASE_MODE=sqlite | Change to DATABASE_MODE=postgres |

---

## Files Reference

**Main Documentation:**
- `/docs/deployment/DATABASE_ARCHITECTURE_ANALYSIS_FOR_COOLIFY.md` - Complete analysis (this file!)
- `/docs/DATABASE.md` - Database overview
- `/docs/deployment/DEPLOYMENT_ARCHITECTURE.md` - Architecture

**Connection Code:**
- `/frontend/src/lib/database/adapter.ts` - Auto-routing layer
- `/frontend/src/lib/database/pool-postgres.ts` - PostgreSQL pool
- `/frontend/src/lib/database/pool.ts` - SQLite pool (legacy)

**Configuration:**
- `/frontend/.env.example` - Template
- `/frontend/.env.local` - Actual secrets

---

## Support

For detailed info, see: `/docs/deployment/DATABASE_ARCHITECTURE_ANALYSIS_FOR_COOLIFY.md`

Key sections:
- Part 1: 10 database names and purposes
- Part 4: Connection string format
- Part 5: Coolify-specific configuration
- Part 10: Setup instructions
- Part 11: Troubleshooting
- Part 12: Summary table

