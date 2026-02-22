# Database Architecture Analysis - Index

**Analysis Date**: November 4, 2025
**Status**: Complete - Ready for Coolify PostgreSQL Configuration
**Migration Status**: 100% Complete (155 tables, 51,833 rows)

---

## Quick Links

### For Coolify Configuration

Start here for PostgreSQL setup in Coolify:

1. **[DATABASE_QUICK_REFERENCE_COOLIFY.md](./DATABASE_QUICK_REFERENCE_COOLIFY.md)**
   - TL;DR format (5KB)
   - Essential configuration only
   - Quick lookup table
   - Common issues & fixes
   - **USE THIS FIRST** for quick reference

2. **[DATABASE_ARCHITECTURE_ANALYSIS_FOR_COOLIFY.md](./DATABASE_ARCHITECTURE_ANALYSIS_FOR_COOLIFY.md)**
   - Complete analysis (22KB)
   - 14 detailed sections
   - Table inventory by schema
   - Connection pooling details
   - Full troubleshooting guide
   - Setup instructions with screenshots

### Related Documentation

3. **[DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md)**
   - Original Vercel+Neon deployment guide
   - Architecture overview
   - DNS configuration (if needed for public domain)

4. **[POSTGRESQL_MIGRATION_COMPLETE.md](./POSTGRESQL_MIGRATION_COMPLETE.md)**
   - Migration completion report
   - Data integrity verification
   - Statistics and breakdown
   - Issues resolved during migration

5. **[COOLIFY_LOCAL_HOSTING_GUIDE.md](./COOLIFY_LOCAL_HOSTING_GUIDE.md)**
   - General Coolify deployment guide
   - Server setup instructions
   - Docker configuration
   - Auto-deployment from GitHub

---

## The Bottom Line

### What You Need to Know

The Veritable Games database uses:

- **10 SQLite databases** in development
- **1 PostgreSQL database with 10 schemas** in production
- **155 tables** across all schemas
- **273 indexes** for performance
- **51,833 rows** of data

### For Coolify

You need:

1. **One PostgreSQL connection string**
   ```
   DATABASE_URL=postgresql://neondb_owner:npg_9ZQTdDper6tw@ep-withered-feather-a878iz2v-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

2. **Set DATABASE_MODE=postgres**
   ```
   DATABASE_MODE=postgres
   ```

3. **Configure pool settings for traditional server**
   ```
   POSTGRES_POOL_MAX=20
   POSTGRES_POOL_MIN=2
   POSTGRES_SSL=true
   ```

4. **Add security secrets** (from .env.local)
   ```
   SESSION_SECRET, CSRF_SECRET, ENCRYPTION_KEY
   ```

That's it! The adapter layer handles all 10 schemas automatically.

---

## Key Facts

| Aspect | Details |
|--------|---------|
| **Databases (SQLite)** | 10 |
| **PostgreSQL Database** | 1 (neondb) |
| **PostgreSQL Schemas** | 10 (forums, wiki, users, auth, content, library, messaging, system, cache, main) |
| **Tables** | 155 |
| **Indexes** | 273 |
| **Data Rows** | 51,833 |
| **Connection Strings** | 1 (single DATABASE_URL) |
| **Migration Status** | 100% Complete |
| **Errors** | 0 |

---

## The 10 Databases

| # | Name | Tables | Rows | Purpose |
|---|------|--------|------|---------|
| 1 | forums | 5 | 12 | Forum discussions |
| 2 | wiki | 25 | 1,943 | Wiki pages & revisions |
| 3 | users | 11 | 319 | User accounts |
| 4 | auth | 8 | 106 | Sessions & tokens |
| 5 | content | 28 | 1,944 | Projects & workspaces |
| 6 | library | 6 | 93 | Documents |
| 7 | messaging | 3 | 12 | Messages |
| 8 | system | 16 | 26,598 | Configuration |
| 9 | cache | 5 | 0 | Reserved |
| 10 | main | 48 | 20,806 | Legacy archive |

---

## Reading Guide

**I need to configure Coolify right now:**
→ Read [DATABASE_QUICK_REFERENCE_COOLIFY.md](./DATABASE_QUICK_REFERENCE_COOLIFY.md) (5 minutes)

**I need complete details about the database architecture:**
→ Read [DATABASE_ARCHITECTURE_ANALYSIS_FOR_COOLIFY.md](./DATABASE_ARCHITECTURE_ANALYSIS_FOR_COOLIFY.md) (20 minutes)

**I need to understand how the migration happened:**
→ Read [POSTGRESQL_MIGRATION_COMPLETE.md](./POSTGRESQL_MIGRATION_COMPLETE.md) (10 minutes)

**I need help with Coolify deployment overall:**
→ Read [COOLIFY_LOCAL_HOSTING_GUIDE.md](./COOLIFY_LOCAL_HOSTING_GUIDE.md) (15 minutes)

**I need to understand the production architecture:**
→ Read [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md) (15 minutes)

---

## Critical Configuration Points

### DATABASE_MODE - MUST BE POSTGRES

```bash
DATABASE_MODE=postgres  # NOT sqlite!
```

If you miss this:
- App tries to use SQLite
- SQLite files don't exist in production
- App crashes with "data directory does not exist"

### Connection Pool - NOT SERVERLESS

Coolify is a traditional server, so:

```bash
POSTGRES_POOL_MAX=20      # NOT 1 (serverless uses 1)
POSTGRES_POOL_MIN=2       # NOT 0 (serverless uses 0)
POSTGRES_SSL=true         # Required for Neon
```

### Single Connection String

Do NOT create separate database URLs:

```bash
# WRONG
DATABASE_URL_FORUMS=...
DATABASE_URL_WIKI=...

# CORRECT
DATABASE_URL=postgresql://neondb_owner:...
```

---

## Verification Checklist

Before deploying to Coolify:

- [ ] DATABASE_URL set correctly
- [ ] DATABASE_MODE=postgres set
- [ ] POSTGRES_POOL_MAX=20 set
- [ ] POSTGRES_POOL_MIN=2 set
- [ ] POSTGRES_SSL=true set
- [ ] Security secrets set (SESSION_SECRET, CSRF_SECRET, ENCRYPTION_KEY)
- [ ] Application URLs configured (NEXTAUTH_URL, NEXT_PUBLIC_SITE_URL, etc.)
- [ ] NODE_ENV=production set
- [ ] Build directory = frontend
- [ ] Build command = npm run build
- [ ] Start command = npm run start

---

## Support

For detailed information on any topic:

1. **Connection String Format** → Part 4 of DATABASE_ARCHITECTURE_ANALYSIS_FOR_COOLIFY.md
2. **Environment Variables** → Part 5 of DATABASE_ARCHITECTURE_ANALYSIS_FOR_COOLIFY.md
3. **Coolify Setup** → Part 10 of DATABASE_ARCHITECTURE_ANALYSIS_FOR_COOLIFY.md
4. **Troubleshooting** → Part 11 of DATABASE_ARCHITECTURE_ANALYSIS_FOR_COOLIFY.md
5. **Quick Reference** → DATABASE_QUICK_REFERENCE_COOLIFY.md

---

**Last Updated**: November 4, 2025
**Analysis Complete**: Yes
**Ready for Coolify**: Yes

