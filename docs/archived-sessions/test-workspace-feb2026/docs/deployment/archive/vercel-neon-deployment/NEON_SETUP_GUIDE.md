# PostgreSQL Migration - Quick Start Guide

**Status**: Phase 4.1 - Week 1 Setup
**Date**: October 28, 2025
**Infrastructure**: ✅ Complete (Neon account created, connection pool ready)

---

## 🎯 Current Step: Get Neon Connection String

### Step 1: Get Your Neon Connection String

1. **Log into Neon Console**:
   - Visit: https://console.neon.tech
   - Sign in with your account

2. **Select Your Project**:
   - Click on your "Veritable Games" project (or whatever you named it)

3. **Find Connection Details**:
   - Look for "Connection Details" section on the dashboard
   - Or navigate to **Settings → Connection Details**

4. **Copy the Connection String**:
   - Look for the **"Connection string"** field
   - It should look like:
     ```
     postgresql://[username]:[password]@ep-xxx-xxx.us-east-2.aws.neon.tech/[database]?sslmode=require
     ```
   - **Important**: Make sure to select the **Pooled connection** option (not direct)
   - Click the copy button

5. **Add to .env.local**:
   - Open: `frontend/.env.local`
   - Find line 22: `POSTGRES_URL=`
   - Paste your connection string:
     ```bash
     POSTGRES_URL="postgresql://username:password@host/database?sslmode=require"
     ```
   - **Important**: Keep the quotes around the connection string!

### Step 2: Test the Connection

Run the connection test script:

```bash
npm run pg:test
```

**What this does**:
- ✅ Verifies connection string is valid
- ✅ Tests connection to Neon
- ✅ Checks SSL is working
- ✅ Shows server time and PostgreSQL version
- ✅ Lists existing schemas (should be empty initially)
- ✅ Shows storage usage (should be near 0%)

**Expected output**:
```
🔍 PostgreSQL Connection Test
==================================================

✅ POSTGRES_URL found

📊 Connection Details:
   Host: ep-xxx-xxx.us-east-2.aws.neon.tech
   Port: 5432
   Database: veritable_games
   User: your_username
   Password: ********** (masked)
   SSL: require

🔌 Attempting to connect...
✅ Connection successful!

🔍 Testing query execution...
✅ Query executed successfully!

📊 Server Information:
   Server Time: 2025-10-28T...
   PostgreSQL Version: PostgreSQL 15.x

🔍 Checking for database schemas...
⚠️  No custom schemas found (expected - schemas will be created in next step)

💾 Storage Information:
   Database Size: 8192 bytes (0.01 MB)
   Neon Free Tier: 512 MB limit
   Usage: 0.0% of free tier

✅ All tests passed!
```

**If you get errors**, the script will provide specific troubleshooting steps.

---

## 🚀 Next Steps (After Connection Test Passes)

### Phase 4.1.3: Create PostgreSQL Schemas

Once `npm run pg:test` succeeds, you'll run:

```bash
npm run pg:create-schemas
```

This will create 10 PostgreSQL schemas to match your 10 SQLite databases:
- `auth` - Authentication & sessions
- `forums` - Forum discussions
- `wiki` - Wiki pages & revisions
- `users` - User profiles & settings
- `content` - Projects, news, workspaces
- `library` - Documents & annotations
- `messaging` - Private messages
- `system` - System configuration
- `cache` - Application cache
- `main` - Legacy archive

---

## 📋 Complete Migration Timeline

**Week 1** (Current) - Local Environment Setup:
- [x] Phase 4.0: Infrastructure (docker-compose, vercel.json, pool-postgres.ts)
- [x] Phase 4.1.1: Environment configuration
- [ ] Phase 4.1.2: Connection test ← **YOU ARE HERE**
- [ ] Phase 4.1.3: Create schemas in Neon

**Week 2** - Schema Migration:
- [ ] Phase 4.2.1: Convert SQLite schemas to PostgreSQL syntax
- [ ] Phase 4.2.2: Apply converted schemas to Neon
- [ ] Phase 4.2.3: Verify all 195 tables created

**Week 3-4** - Service Layer Migration:
- [ ] Phase 4.3.1: Update services to use async queries
- [ ] Phase 4.3.2: Replace better-sqlite3 with pg pool
- [ ] Phase 4.3.3: Update all 50+ service methods

**Week 5** - Data Migration:
- [ ] Phase 4.4.1: Export data from SQLite
- [ ] Phase 4.4.2: Import data to PostgreSQL
- [ ] Phase 4.4.3: Validate data integrity

**Week 6** - Production Cutover:
- [ ] Phase 4.5.1: Deploy to Vercel staging
- [ ] Phase 4.5.2: Final testing
- [ ] Phase 4.5.3: Production deployment

---

## 🔧 Troubleshooting

### Connection String Issues

**Special Characters in Password**:
If your password contains special characters (`@`, `#`, `$`, etc.), they need URL encoding:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- Or regenerate password without special characters in Neon console

**Format Check**:
```
postgresql://[user]:[pass]@[host]/[database]?sslmode=require
           ↑      ↑      ↑      ↑            ↑
       username  password  host  db name   SSL required
```

### Common Errors

**"POSTGRES_URL not found"**:
- Check you saved `.env.local` after adding the connection string
- Verify the file is in `frontend/.env.local` (not root directory)

**"timeout" or "ETIMEDOUT"**:
- Check internet connection
- Verify Neon project is not paused (check Neon console)
- Increase timeout in `.env.local`: `POSTGRES_CONNECTION_TIMEOUT=10000`

**"password authentication failed"**:
- Copy fresh connection string from Neon console
- Check for typos in username/password
- Verify password special characters are URL-encoded

**"database does not exist"**:
- Verify database name in connection string matches Neon project
- Default database name is usually `neondb` or your project name

---

## 📊 Storage Monitoring

**Neon Free Tier Limits**:
- Storage: 0.5 GB (512 MB)
- Compute: Unlimited (with auto-suspend)
- Projects: 1 project

**Current Data Size** (from SQLite):
- `forums.db`: ~8 MB
- `wiki.db`: ~5 MB
- `users.db`: ~3 MB
- `content.db`: ~6 MB
- `library.db`: ~2 MB
- `auth.db`: ~1 MB
- Others: <1 MB each
- **Total**: ~26 MB (5% of free tier)

You have plenty of room for growth!

---

## 🎓 Learning Resources

**Neon Documentation**:
- Connection Guide: https://neon.tech/docs/connect/connect-from-any-app
- Connection Pooling: https://neon.tech/docs/connect/connection-pooling
- Monitoring: https://neon.tech/docs/introduction/monitoring

**PostgreSQL vs SQLite**:
- PostgreSQL is **asynchronous** (all queries return Promises)
- PostgreSQL uses `$1, $2` for parameters (not `?`)
- PostgreSQL uses **schemas** for organization (like separate DBs in SQLite)
- PostgreSQL has **better full-text search** (tsvector vs FTS5)

---

## ✅ Ready to Proceed?

**Once you've completed Step 1 & 2 above**:

1. Verify `npm run pg:test` shows **"✅ All tests passed!"**
2. Let me know, and I'll create the schema migration scripts
3. We'll run `npm run pg:create-schemas` to set up the database structure

**Your Current Progress**:
- ✅ Neon account created
- ✅ Infrastructure files ready (docker-compose, vercel.json, pool-postgres.ts)
- ✅ Environment configured
- ✅ Connection test script ready
- 🔜 Waiting for you to add POSTGRES_URL and test connection

---

**Questions?** Just ask! I'm here to help with each step of the migration.
