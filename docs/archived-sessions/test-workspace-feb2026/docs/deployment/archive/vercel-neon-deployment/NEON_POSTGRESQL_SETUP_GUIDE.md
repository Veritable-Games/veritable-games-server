# Neon PostgreSQL Deployment Guide

**Step-by-step guide for deploying Veritable Games to Neon serverless PostgreSQL**

**Last Updated**: October 29, 2025
**Status**: Ready for deployment
**Target**: Vercel + Neon (serverless PostgreSQL)

---

## Table of Contents

1. [What is Neon?](#what-is-neon)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Neon Account Setup](#neon-account-setup)
4. [Database Creation](#database-creation)
5. [Schema Migration](#schema-migration)
6. [Data Migration](#data-migration)
7. [Error Handling](#error-handling)
8. [Connection Configuration](#connection-configuration)
9. [Vercel Integration](#vercel-integration)
10. [Post-Deployment Verification](#post-deployment-verification)

---

## What is Neon?

**Neon** is a serverless PostgreSQL database service designed for Vercel deployments.

### Key Features

| Feature | Benefit |
|---------|---------|
| Serverless | Auto-scales, pay only for what you use |
| Auto-pause | Pauses when idle, resumes instantly |
| Branches | Create isolated database copies for testing |
| Free Tier | 0.5 GB storage, unlimited queries |
| FTS Support | Full-text search (required for your app) |
| Backups | Automatic daily backups |
| SSL/TLS | Required encrypted connections |

### Cost Structure

```
Free Tier:
- 0.5 GB storage
- Unlimited compute hours
- Unlimited queries
- Perfect for: Dev/test, small production

Growth Plan ($15/month):
- 10 GB storage
- Same compute/query allowance
- Perfect for: Production with growth
```

### Why Neon for Veritable Games?

1. ✅ **FTS5 Support**: Full-text search for wiki/library
2. ✅ **Serverless**: Scales with demand
3. ✅ **Cost**: Free tier sufficient for current usage
4. ✅ **Auto-pause**: Saves costs when idle
5. ✅ **Vercel Integration**: Works seamlessly

---

## Pre-Deployment Checklist

Before starting, verify you have:

- [ ] GitHub account with your repository
- [ ] Neon account (or ready to create one)
- [ ] Vercel account (or ready to create one)
- [ ] SQLite databases backed up locally
- [ ] Migration scripts ready (`frontend/scripts/migrate-*.js`)
- [ ] Environment variables documented
- [ ] 30-60 minutes available for complete setup

---

## Neon Account Setup

### Step 1: Create Neon Account

1. Go to [neon.tech](https://neon.tech)
2. Click **"Sign Up"** or **"Sign Up with GitHub"** (recommended)
3. Authorize Neon to access your GitHub account
4. Verify email address
5. Complete onboarding

### Step 2: Create Organization (Optional)

For team projects, create an organization:
1. Dashboard → **"New Organization"**
2. Enter organization name
3. Invite team members (optional)

---

## Database Creation

### Step 1: Create New Project

1. Neon Dashboard → **"New Project"**
2. Configure:
   - **Name**: `veritable-games` (or your project name)
   - **Region**: Select closest to your users (US East for most)
   - **PostgreSQL Version**: 15 (current, has FTS support)
3. Click **"Create Project"**

**Expected time**: 2-3 minutes for database provisioning

### Step 2: Get Connection String

After project creation:

1. Dashboard → Click your project
2. Click **"Connection Details"**
3. Select **"Connection string"**
4. Copy the string (looks like):
   ```
   postgresql://user:password@host.neon.tech/database?sslmode=require
   ```

**Save this securely!** You'll need it for:
- Local migration scripts
- Vercel environment variables
- Application configuration

### Step 3: Enable FTS Support

Neon PostgreSQL 15 includes FTS by default. No additional setup needed!

**Verify FTS is available** (optional):
```sql
SELECT * FROM pg_extension WHERE extname LIKE 'fts%';
-- Should return results if FTS is available
```

---

## Schema Migration

### Step 1: Prepare Schema Files

Your schema is in: `frontend/lib/*/schema.sql`

**Schema files needed**:
- `frontend/lib/auth/schema.sql` (auth schemas)
- `frontend/lib/content/schema.sql` (content schemas)
- `frontend/lib/forums/schema.sql` (forum schemas)
- `frontend/lib/library/schema.sql` (library schemas)
- `frontend/lib/messaging/schema.sql` (messaging schemas)
- `frontend/lib/system/schema.sql` (system schemas)
- `frontend/lib/users/schema.sql` (user schemas)
- `frontend/lib/wiki/schema.sql` (wiki schemas)

### Step 2: Run Schema Migration Script

```bash
# From frontend/ directory
npm run pg:migrate-schema

# This script:
# 1. Connects to Neon PostgreSQL
# 2. Creates all 10 schemas
# 3. Creates 153 tables
# 4. Creates 273 indexes
# 5. Enables FTS for search tables
```

**Expected time**: 3-5 minutes
**Success indicator**: "✅ Schema migration complete"

### Step 3: Verify Schema

```bash
# List all schemas created
psql $POSTGRES_URL -c "\dn"

# Count tables
psql $POSTGRES_URL -c "
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
"

# Should return: 153
```

### Known Schema Issues

See `MIGRATION_ERROR_ANALYSIS.md` for details on:

1. **Missing columns**: `users.status` (LOW severity)
2. **Integer overflow columns**: Various system metrics (MEDIUM, but non-critical)
3. **Missing tables**: `project_metadata` (LOW severity)

**Quick fix** (apply before data migration):

```sql
-- 1. Add users.status column
ALTER TABLE users.users ADD COLUMN status TEXT;

-- 2. Fix system_performance_metrics column types
ALTER TABLE system.system_performance_metrics
  ALTER COLUMN memory_total TYPE BIGINT,
  ALTER COLUMN memory_used TYPE BIGINT,
  ALTER COLUMN disk_total TYPE BIGINT,
  ALTER COLUMN disk_free TYPE BIGINT;

-- 3. Create project_metadata table
CREATE TABLE IF NOT EXISTS content.project_metadata (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT,
    key VARCHAR(255),
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Data Migration

### Step 1: Prepare Migration Script

Located at: `frontend/scripts/migrate-data-to-postgres.js`

This script:
- Reads all SQLite databases from `frontend/data/*.db`
- Connects to PostgreSQL (Neon)
- Migrates all rows
- Handles duplicate key conflicts
- Reports progress and errors

### Step 2: Set Environment Variables

Create/update `frontend/.env.local`:

```bash
# Database connections
POSTGRES_URL=postgresql://user:password@host.neon.tech/database?sslmode=require

# Session security (generate with: openssl rand -hex 32)
SESSION_SECRET=<32-byte-hex-string>
ENCRYPTION_KEY=<32-byte-hex-string>

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 3: Run Data Migration

```bash
# From frontend/ directory
npm run pg:migrate-data

# Output:
# 📊 Processing forums.db...
# ✅ forum_categories: 7/7 rows
# ... (all databases)
#
# Migration Summary:
# Tables processed: 142
# Total rows migrated: 50,143
# Errors: <3
```

**Expected time**: 10-15 minutes
**Success indicator**: "Errors: <3"

### Step 4: Handle Errors (If Any)

See `MIGRATION_ERROR_ANALYSIS.md` for detailed error handling:

**If you get errors**:

```bash
# 1. Note the error message and table name
# 2. See MIGRATION_ERROR_ANALYSIS.md for solution
# 3. Apply fix to PostgreSQL schema
# 4. Truncate problematic table
# 5. Re-run migration

# Example: Fix integer overflow
ALTER TABLE system.system_performance_metrics
  ALTER COLUMN memory_total TYPE BIGINT;

TRUNCATE TABLE system.system_performance_metrics CASCADE;

# Then re-run:
npm run pg:migrate-data
```

---

## Error Handling

### Common Errors and Solutions

#### Error: "ECONNREFUSED"
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Cause**: PostgreSQL not running or wrong connection string

**Fix**:
```bash
# Verify POSTGRES_URL in .env.local
echo $POSTGRES_URL

# Test connection
psql $POSTGRES_URL -c "SELECT 1"

# Should return: 1
```

#### Error: "column does not exist"
```
Error: column "status" does not exist
```

**Cause**: SQLite table has column not in PostgreSQL schema

**Fix**: Add column to PostgreSQL
```sql
ALTER TABLE [schema].[table] ADD COLUMN [column] TEXT;
```

#### Error: "value out of range"
```
Error: value "107374182400" is out of range for type integer
```

**Cause**: Data exceeds PostgreSQL INTEGER max (2,147,483,647)

**Fix**: Change column type to BIGINT
```sql
ALTER TABLE [schema].[table] ALTER COLUMN [column] TYPE BIGINT;
```

#### Error: "relation does not exist"
```
Error: relation "content.project_metadata" does not exist
```

**Cause**: Table in SQLite not created in PostgreSQL schema

**Fix**: Create table
```sql
CREATE TABLE content.project_metadata (...);
```

### Migration Validation

After migration completes, validate:

```bash
# Check row counts match
psql $POSTGRES_URL << 'EOF'
SELECT
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY schemaname, tablename;
EOF

# Compare with SQLite row counts
```

---

## Connection Configuration

### For Next.js Application

Update `frontend/src/lib/database/pool.ts`:

```typescript
import { Pool } from 'pg';

export const pgPool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  // Neon-specific options
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
  // Connection pooling
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pgPool.query('SELECT 1', (err, res) => {
  if (err) console.error('PostgreSQL connection failed:', err);
  else console.log('✅ PostgreSQL connected');
});
```

### Environment Variables

**Development** (`frontend/.env.local`):
```
POSTGRES_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
NODE_ENV=development
```

**Vercel Production** (set in Vercel dashboard):
```
POSTGRES_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
NODE_ENV=production
SESSION_SECRET=<32-byte-hex>
ENCRYPTION_KEY=<32-byte-hex>
```

---

## Vercel Integration

### Step 1: Connect GitHub Repository

1. Vercel Dashboard → **"New Project"**
2. Click **"Import Git Repository"**
3. Select your GitHub repository
4. Click **"Import"**

### Step 2: Configure Build Settings

**Root Directory**: Set to `frontend` (critical!)

1. In configuration screen:
2. Click **"Edit"** next to Root Directory
3. Enter: `frontend`
4. Click **"Save"**

### Step 3: Add Environment Variables

In Vercel project settings:

1. Go to **Settings** → **Environment Variables**
2. Add each variable:
   - `POSTGRES_URL`: Your Neon connection string
   - `SESSION_SECRET`: 32-byte hex from `openssl rand -hex 32`
   - `ENCRYPTION_KEY`: 32-byte hex from `openssl rand -hex 32`
   - `NODE_ENV`: `production`
   - `NEXT_PUBLIC_APP_URL`: `https://yourdomain.com`

### Step 4: Deploy

1. Click **"Deploy"**
2. Vercel builds and deploys
3. Monitor build logs for errors

**Build time**: 5-10 minutes
**Success**: Green checkmark, live URL provided

### Step 5: Monitor Logs

After deployment:

1. Go to **Deployments** tab
2. Click latest deployment
3. Click **"Runtime Logs"**
4. Watch for:
   - ✅ Next.js build successful
   - ✅ PostgreSQL connection established
   - ❌ Any error messages

---

## Post-Deployment Verification

### Step 1: Test Production Site

```bash
# Visit your site
https://yourdomain.com

# Check:
- [ ] Site loads (no 500 errors)
- [ ] Authentication works
- [ ] Can create new content
- [ ] Search functions work
- [ ] Database reads/writes succeed
```

### Step 2: Verify Database Connection

```bash
# Check Neon connection in production logs
Vercel Dashboard → Deployments → Runtime Logs

# Look for:
✅ PostgreSQL connected
✅ 153 tables available
✅ No connection errors
```

### Step 3: Monitor Performance

```bash
# Check Core Web Vitals
PageSpeed Insights → https://yourdomain.com

# Target scores:
- LCP: < 2.5s
- FID: < 100ms
- CLS: < 0.1
```

### Step 4: Enable Auto-Scaling (Optional)

Neon automatically pauses when idle. To enable auto-scaling:

1. Neon Dashboard → Project Settings
2. **Autoscaling**: Enable
3. **Max connections**: 20
4. **Min connections**: 1

---

## Maintenance & Monitoring

### Daily Monitoring

**In Neon Dashboard**:
- Storage usage (target: < 100 MB)
- Compute usage (target: < 10 hours/day)
- Connection count (target: < 5 concurrent)

**In Vercel Dashboard**:
- Edge function execution
- Build success rate
- Error tracking

### Weekly Tasks

- [ ] Check database backups exist
- [ ] Review error logs
- [ ] Monitor Core Web Vitals
- [ ] Check auth token expiration

### Monthly Tasks

- [ ] Review database storage growth
- [ ] Analyze query performance
- [ ] Update dependencies
- [ ] Plan for growth (upgrade if needed)

### Scaling Strategy

**Current Setup (Free Tier)**:
- 0.5 GB storage
- Sufficient for: ~50,000 users, 1M+ rows

**When to upgrade to Growth Plan ($15/month)**:
- Storage > 300 MB (target: stay < 50%)
- Compute > 20 hours/day consistently
- Performance degradation observed

---

## Troubleshooting

### Site Shows 500 Error

1. Check Vercel runtime logs
2. Look for PostgreSQL connection error
3. Verify POSTGRES_URL in Vercel settings
4. Test Neon connection manually:
   ```bash
   psql $POSTGRES_URL -c "SELECT 1"
   ```

### Slow Database Queries

1. Check for missing indexes
2. Add query timeout monitoring
3. Consider caching with Vercel KV
4. Monitor Neon query performance dashboard

### Auto-Pause Issues

If site is slow after pause:
1. This is expected - first request resumes database
2. Typically resumes in 5-10 seconds
3. Disable auto-pause if latency unacceptable:
   - Neon Dashboard → Project Settings → Auto-pause: Off
   - Cost: Higher (database always running)

### Data Corruption/Loss

**Recovery steps**:
1. Neon auto-backups available (24 hours)
2. Restore from branch if needed
3. Contact Neon support for older backups

---

## Quick Reference

### Connection String Format
```
postgresql://[user]:[password]@[host].neon.tech/[database]?sslmode=require
```

### Required Environment Variables
```
POSTGRES_URL=<connection-string>
SESSION_SECRET=<32-byte-hex>
ENCRYPTION_KEY=<32-byte-hex>
NODE_ENV=production
NEXT_PUBLIC_APP_URL=<domain>
```

### Essential Commands
```bash
# Test connection
psql $POSTGRES_URL -c "SELECT 1"

# Run schema migration
npm run pg:migrate-schema

# Run data migration
npm run pg:migrate-data

# Backup database
pg_dump $POSTGRES_URL > backup.sql

# Restore database
psql $POSTGRES_URL < backup.sql
```

### Migration Checklist
- [ ] Neon project created
- [ ] Connection string saved
- [ ] Schema migrated (153 tables)
- [ ] Data migrated (50,143+ rows)
- [ ] Errors investigated and resolved
- [ ] Environment variables set
- [ ] Vercel configured
- [ ] Build successful
- [ ] Site tested
- [ ] Database monitored

---

## Related Documentation

- **`VERCEL_DEPLOYMENT_GUIDE.md`** - Vercel-specific setup
- **`MIGRATION_ERROR_ANALYSIS.md`** - Error investigation
- **`MIGRATION_AND_DEPLOYMENT_SUMMARY.md`** - Overview
- **`DNS_CONFIGURATION_QUICKREF.md`** - Domain setup

---

**Next Step**: Follow `VERCEL_DEPLOYMENT_GUIDE.md` for final deployment configuration.
