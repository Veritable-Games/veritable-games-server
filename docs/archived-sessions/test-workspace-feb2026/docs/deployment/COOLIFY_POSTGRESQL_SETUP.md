# Coolify PostgreSQL Setup Guide

**Veritable Games Platform - PostgreSQL Database Configuration**

**Created**: November 5, 2025
**For**: Coolify self-hosted deployment
**Status**: Ready to implement

---

## Overview

This guide provides step-by-step instructions to set up PostgreSQL for the Veritable Games deployment on Coolify. The application currently uses SQLite (development mode) and needs to be migrated to PostgreSQL for production.

### What This Guide Covers

1. Creating PostgreSQL database in Coolify
2. Configuring environment variables
3. Running migration scripts to set up schemas
4. Migrating data from SQLite to PostgreSQL
5. Verifying the setup
6. Testing the application

### Time Required

- **Setup**: 15-20 minutes
- **Migration**: 10-30 minutes (depends on data volume)
- **Total**: ~30-50 minutes

---

## Architecture Understanding

### Current State (Development)
- **10 separate SQLite databases** in `frontend/data/`:
  - forums.db, wiki.db, users.db, auth.db, content.db
  - library.db, messaging.db, system.db, cache.db, main.db
- **Total**: 155 tables, 51,833 rows

### Target State (Production)
- **1 PostgreSQL database** with **10 schemas**:
  - Each SQLite database becomes a PostgreSQL schema
  - Example: `forums.db` → `forums` schema
  - All schemas share one connection string
  - Accessed via `DATABASE_URL`

**Why schemas?** Provides logical separation while maintaining single database connection, perfect for connection pooling and management.

---

## Prerequisites

✅ Coolify installed and running
✅ Veritable Games application deployed (from previous steps)
✅ Access to Coolify dashboard (http://192.168.1.15:8000)
✅ SSH access to server (optional, for troubleshooting)

---

## Part 1: Create PostgreSQL Database in Coolify

### Step 1: Access Coolify Dashboard

1. **Open browser**: http://192.168.1.15:8000
2. **Log in** with your admin credentials
3. **Navigate to** your Veritable Games project

### Step 2: Add PostgreSQL Database

1. **In your project**: Click "Add Resource" or "New Resource"
2. **Select**: Database → PostgreSQL
3. **Configure database**:

   **Basic Settings**:
   ```
   Name: veritable-games-db
   Version: PostgreSQL 15
   ```

   **Database Configuration**:
   ```
   Database Name: veritable_games
   Username: postgres
   Password: <generate-secure-password>
   Port: 5432 (default)
   ```

   **Generate secure password**:
   ```bash
   # On your laptop or server:
   openssl rand -base64 32
   # Example output: kX9mP2nQ7vB4hF8jL3sT6wY1cR5aD0eG
   ```

   **Storage**:
   - Coolify automatically stores data in Docker volumes
   - Since you mounted extra drive to `/var`, PostgreSQL data goes to large drive
   - No additional configuration needed!

4. **Create database**
5. **Wait** for database to start (~1-2 minutes)

### Step 3: Verify Database is Running

**In Coolify**:
- Check database status: Should show "Running" (green)
- Note the internal connection details

**Connection string format**:
```
postgresql://postgres:<password>@veritable-games-db:5432/veritable_games
```

**Important**: Use the **internal Docker network name** (veritable-games-db), not localhost or IP address. Coolify handles internal DNS.

---

## Part 2: Configure Environment Variables

### Step 1: Get Connection String

**In Coolify** → Database → Connection Details:
- Copy the internal connection string
- Should look like: `postgresql://postgres:PASSWORD@veritable-games-db:5432/veritable_games`

### Step 2: Update Application Environment Variables

**In Coolify** → Application → Environment Variables:

**Add or update these variables**:

```bash
# Database Mode (CRITICAL!)
DATABASE_MODE=postgres

# PostgreSQL Connection
POSTGRES_URL=postgresql://postgres:YOUR_PASSWORD@veritable-games-db:5432/veritable_games

# SSL Configuration (for local Docker network)
POSTGRES_SSL=false

# Connection Pool Settings (Traditional Server)
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=2
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=10000

# Keep existing variables
NODE_ENV=production
SESSION_SECRET=<your-existing-value>
CSRF_SECRET=<your-existing-value>
ENCRYPTION_KEY=<your-existing-value>
```

**Critical Notes**:
- ⚠️ **DATABASE_MODE=postgres** - This tells the app to use PostgreSQL instead of SQLite
- ⚠️ **Use internal Docker name** (veritable-games-db) not localhost
- ⚠️ **POSTGRES_SSL=false** - Docker internal network doesn't need SSL
- ⚠️ **Replace YOUR_PASSWORD** with actual PostgreSQL password

### Step 3: Test Connection (Optional but Recommended)

**Access application terminal in Coolify**:

```bash
# In Coolify → Application → Terminal
cd frontend
node scripts/test-postgres-connection.js
```

**Expected output**:
```
✓ Connection string format valid
✓ Database accessible
✓ Can execute queries
✓ Schemas: (none yet - we'll create them next)
```

If errors occur, check:
- Connection string format
- Database is running
- Password is correct
- Internal Docker network name

---

## Part 3: Run Migration Scripts

Now we'll create the PostgreSQL schemas and tables. This is done by running migration scripts inside the application container.

### Step 1: Create PostgreSQL Schemas

**In Coolify** → Application → Terminal:

```bash
cd frontend

# Step 1: Create the 10 schemas
npm run pg:create-schemas
```

**What this does**:
- Creates 10 schemas: forums, wiki, users, auth, content, library, messaging, system, cache, main
- Enables PostgreSQL extensions (pg_trgm, unaccent)
- Sets up permissions

**Expected output**:
```
Creating PostgreSQL schemas...
✓ Created schema: auth
✓ Created schema: forums
✓ Created schema: wiki
✓ Created schema: users
✓ Created schema: content
✓ Created schema: library
✓ Created schema: messaging
✓ Created schema: system
✓ Created schema: cache
✓ Created schema: main
✓ All schemas created successfully!
```

**Time**: ~30 seconds

### Step 2: Migrate Schema (Create Tables)

```bash
# Step 2: Create all tables and indexes
npm run pg:migrate-schema
```

**What this does**:
- Reads SQLite schema from all 10 databases
- Converts to PostgreSQL-compatible SQL
- Creates 155 tables with indexes and constraints
- Converts FTS5 virtual tables to tsvector with GIN indexes

**Expected output**:
```
Migrating schema to PostgreSQL...
Processing: forums.db
  ✓ Created table: forums.categories
  ✓ Created table: forums.topics
  ✓ Created table: forums.posts
  ... (150+ more tables)
✓ Schema migration completed!
  Total tables: 155
  Total indexes: 273
```

**Time**: ~2-5 minutes

**If errors occur**:
- Check connection string
- Verify schemas were created
- Look for specific table/column errors in output

### Step 3: Migrate Data

```bash
# Step 3: Copy all data from SQLite to PostgreSQL
npm run pg:migrate-data
```

**What this does**:
- Copies all 51,833 rows from SQLite databases
- Processes in batches of 1000 rows
- Shows progress for large tables
- Handles NULL values and type conversions

**Expected output**:
```
Migrating data to PostgreSQL...
Processing: forums.topics (115 rows)
  ✓ Migrated 115 rows
Processing: wiki.pages (188 rows)
  ✓ Migrated 188 rows
Processing: system.monitoring_logs (26,598 rows)
  [============================] 100% (26,598/26,598)
  ✓ Migrated 26,598 rows
... (remaining tables)

✓ Data migration completed!
  Total rows migrated: 51,833
  Time: 8m 32s
```

**Time**: 5-30 minutes (depends on data volume and server speed)

**Progress indicators**:
- Small tables (<1000 rows): Instant
- Medium tables (1000-10000 rows): Progress bar
- Large tables (>10000 rows): Detailed progress with time estimates

---

## Part 4: Verify Setup

### Step 1: Run Database Health Check

```bash
# In Coolify → Application → Terminal
cd frontend
npm run db:health
```

**Expected output**:
```
Database Health Check
=====================

Mode: postgres
Connection: OK

Schemas:
✓ auth (8 tables)
✓ forums (5 tables)
✓ wiki (25 tables)
✓ users (11 tables)
✓ content (28 tables)
✓ library (6 tables)
✓ messaging (3 tables)
✓ system (16 tables)
✓ cache (5 tables)
✓ main (48 tables)

Total: 155 tables
Indexes: 273
Row count: 51,833

✓ All checks passed!
```

### Step 2: Check Connection Pool

```bash
node scripts/test-postgres-connection.js
```

**Should show**:
```
Pool Configuration:
- Max connections: 20
- Min connections: 2
- Idle timeout: 30000ms
- Active connections: 2

✓ Pool healthy
```

### Step 3: Restart Application

**To ensure app picks up new DATABASE_MODE**:

**In Coolify** → Application → Actions:
1. Click "Restart"
2. Wait for restart (~30 seconds)
3. Check status: Should show "Running"

---

## Part 5: Test Application

### Step 1: Access Application

**Open in browser**:
```
http://192.168.1.15:3000
```

### Step 2: Test Key Features

**Test these to verify PostgreSQL is working**:

1. **Homepage** ✓
   - Should load normally
   - Check for any error messages in browser console

2. **User Login** ✓
   - Log in with existing account
   - Session should work (stored in auth.sessions table)

3. **Forums** ✓
   - View existing topics
   - Create new post
   - Verify data is saved to PostgreSQL

4. **Wiki** ✓
   - View existing pages
   - Edit a page
   - Check revision history

5. **Projects** ✓
   - View projects list
   - Open project details
   - Test gallery/image viewing

6. **Search** ✓
   - Use forum search
   - Use wiki search
   - Verify full-text search works (uses PostgreSQL tsvector)

### Step 3: Check Application Logs

**In Coolify** → Application → Logs:

**Look for**:
```
✓ Connected to PostgreSQL
✓ Database mode: postgres
✓ Pool initialized: 20 max connections
```

**Should NOT see**:
```
✗ Using SQLite (development mode)
✗ DATABASE_MODE not set
✗ Connection failed
```

---

## Part 6: Monitor Performance

### Check Database Usage

**In Coolify** → Database → Metrics:
- CPU usage
- Memory usage
- Disk usage
- Active connections

**Healthy metrics**:
- CPU: <50% during normal operation
- Memory: <2GB for this dataset
- Disk: ~100-200MB (data + indexes)
- Connections: 2-5 active (idle), 10-20 (under load)

### Check Query Performance

**In application terminal**:
```bash
# Connect to PostgreSQL
docker exec -it veritable-games-db psql -U postgres -d veritable_games

# Check slow queries
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

# Exit
\q
```

---

## Troubleshooting

### Issue 1: "Connection Refused"

**Symptom**: Application can't connect to PostgreSQL

**Cause**: Incorrect connection string or database not running

**Fix**:
```bash
# Check database is running
docker ps | grep postgres

# Check connection string format
echo $POSTGRES_URL
# Should be: postgresql://postgres:PASSWORD@veritable-games-db:5432/veritable_games

# Verify internal Docker network
docker network ls
docker network inspect <coolify-network>
```

### Issue 2: "DATABASE_MODE not set" Error

**Symptom**: Application still using SQLite

**Cause**: DATABASE_MODE environment variable not set or app not restarted

**Fix**:
1. **In Coolify** → Application → Environment Variables
2. **Verify**: DATABASE_MODE=postgres exists
3. **Restart** application
4. **Check logs** for "Database mode: postgres"

### Issue 3: Migration Fails

**Symptom**: Migration script errors

**Possible causes & fixes**:

**"Schema already exists"**:
```bash
# Clean up and retry
npm run pg:cleanup
npm run pg:create-schemas
npm run pg:migrate-schema
npm run pg:migrate-data
```

**"Table already exists"**:
- Schemas created but tables incomplete
- Continue with `npm run pg:migrate-data` (safe to re-run)

**"Data type mismatch"**:
- Report error with table/column name
- May need manual schema adjustment

### Issue 4: Slow Queries

**Symptom**: Application slow after migration

**Cause**: Missing indexes or statistics not updated

**Fix**:
```bash
# Connect to database
docker exec -it veritable-games-db psql -U postgres -d veritable_games

# Analyze all tables (updates statistics)
ANALYZE;

# Check for missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname IN ('forums', 'wiki', 'users', 'auth', 'content', 'library', 'messaging', 'system')
ORDER BY schemaname, tablename;
```

### Issue 5: Out of Connections

**Symptom**: "Too many connections" error

**Cause**: Connection pool exhausted

**Fix**:
```bash
# Check active connections
docker exec -it veritable-games-db psql -U postgres -d veritable_games -c "SELECT count(*) FROM pg_stat_activity;"

# If >50 connections, increase pool max
# In Coolify → Database → Configuration
# max_connections = 200 (default is 100)

# Restart database
```

---

## Rollback Procedure

**If migration fails and you need to rollback to SQLite**:

### Step 1: Change Environment Variable

**In Coolify** → Application → Environment Variables:
```bash
DATABASE_MODE=sqlite  # Change from postgres back to sqlite
```

### Step 2: Restart Application

**In Coolify** → Application → Restart

### Step 3: Verify

- Application should use SQLite databases in `frontend/data/`
- All data preserved (SQLite files were not modified during migration)
- PostgreSQL database can be cleaned up or kept for retry

### Step 4: Retry When Ready

- Fix any issues identified
- Change DATABASE_MODE back to postgres
- Re-run migration scripts

---

## Post-Migration Cleanup

### Optional: Remove SQLite Databases

**After confirming PostgreSQL works perfectly**:

```bash
# In Coolify → Application → Terminal
cd frontend/data

# Backup first!
tar czf sqlite-backup-$(date +%Y%m%d).tar.gz *.db
mv sqlite-backup-*.tar.gz ../backups/

# Remove SQLite files (optional - keep as backup)
# rm *.db
```

**Recommendation**: Keep SQLite files for at least 30 days as backup.

### Set Up PostgreSQL Backups

**Create backup script** (on server):

```bash
#!/bin/bash
# /opt/backup-postgres.sh

BACKUP_DIR="/var/backups/veritable-games"
DATE=$(date +%Y%m%d_%H%M%S)
DB_CONTAINER="veritable-games-db"
DB_NAME="veritable_games"

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec $DB_CONTAINER pg_dump -U postgres $DB_NAME | \
  gzip > $BACKUP_DIR/postgres_backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "postgres_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: postgres_backup_$DATE.sql.gz"
```

**Schedule with cron**:
```bash
sudo chmod +x /opt/backup-postgres.sh
sudo crontab -e
# Add: 0 3 * * * /opt/backup-postgres.sh
```

---

## Success Criteria

**Migration is successful when**:

✅ PostgreSQL database running in Coolify
✅ All 10 schemas created
✅ All 155 tables created with indexes
✅ All 51,833+ rows migrated
✅ `npm run db:health` shows no errors
✅ Application loads at http://192.168.1.15:3000
✅ User can log in
✅ Forums, Wiki, Projects all functional
✅ Search works (full-text search)
✅ Image uploads work
✅ No error messages in application logs
✅ Connection pool healthy (2-5 connections idle)

**You can then consider the migration complete!**

---

## Summary

**What we accomplished**:

1. ✅ Created PostgreSQL 15 database in Coolify
2. ✅ Configured environment variables (DATABASE_MODE=postgres)
3. ✅ Created 10 PostgreSQL schemas
4. ✅ Migrated 155 tables with 273 indexes
5. ✅ Migrated 51,833+ rows of data
6. ✅ Verified database health
7. ✅ Tested application functionality
8. ✅ Set up monitoring and backups

**Current Status**: Production-ready PostgreSQL deployment

**Next Steps**:
- Monitor performance for first few days
- Set up automated backups
- (Optional) Configure public access via domain/SSL
- (Optional) Set up pgAdmin for database management

---

## Quick Reference

### NPM Scripts

```bash
# From frontend/ directory:
npm run pg:test              # Test PostgreSQL connection
npm run pg:create-schemas    # Create 10 schemas
npm run pg:migrate-schema    # Create tables (155 tables)
npm run pg:migrate-data      # Migrate data (51,833+ rows)
npm run pg:cleanup          # Reset schemas (destructive)
npm run db:health           # Verify database health
```

### Environment Variables

```bash
DATABASE_MODE=postgres                      # Production mode
POSTGRES_URL=postgresql://...              # Connection string
POSTGRES_SSL=false                         # For local Docker
POSTGRES_POOL_MAX=20                       # Traditional server
POSTGRES_POOL_MIN=2                        # Keep-alive
NODE_ENV=production                        # Production mode
```

### Coolify Locations

- **Dashboard**: http://192.168.1.15:8000
- **Database**: Project → Resources → veritable-games-db
- **Application**: Project → Resources → veritable-games
- **Logs**: Application → Logs (real-time)
- **Terminal**: Application → Terminal (for running scripts)

---

**Last Updated**: November 5, 2025
**Status**: Ready to implement
**Estimated Time**: 30-50 minutes total
**Difficulty**: Medium (well-documented, straightforward process)
