# Resumable Deployment Runbook

**Complete step-by-step guide to deploy Veritable Games to Vercel + Neon PostgreSQL**

**Last Updated**: October 29, 2025
**Status**: Ready for fresh deployment on any system
**Estimated Time**: 2-3 hours total

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Phase 1: Environment Setup](#phase-1-environment-setup)
4. [Phase 2: Neon PostgreSQL Setup](#phase-2-neon-postgresql-setup)
5. [Phase 3: Schema Migration](#phase-3-schema-migration)
6. [Phase 4: Apply Schema Fixes](#phase-4-apply-schema-fixes)
7. [Phase 5: Data Migration](#phase-5-data-migration)
8. [Phase 6: Vercel Deployment](#phase-6-vercel-deployment)
9. [Phase 7: Post-Deployment](#phase-7-post-deployment)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start

**If you've done this before and just need reminders:**

```bash
# 1. Set up environment
cd /home/user/Projects/web/veritable-games-main/frontend
cat > .env.local << 'EOF'
POSTGRES_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

# 2. Run schema migration
npm run pg:migrate-schema

# 3. Apply schema fixes (see Phase 4)
# 4. Run data migration
npm run pg:migrate-data

# 5. Deploy to Vercel (see Phase 6)
```

---

## Pre-Deployment Checklist

### Required Accounts
- [ ] GitHub account (repository access)
- [ ] Neon account (neon.tech) - FREE
- [ ] Vercel account (vercel.com) - FREE
- [ ] Squarespace account (for DNS changes)

### Required Knowledge
- [ ] Basic PostgreSQL commands
- [ ] Node.js/npm installed locally
- [ ] Git configured

### Time Requirements
- [ ] 2-3 hours available for complete deployment
- [ ] Stable internet connection

---

## Phase 1: Environment Setup

### Step 1.1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/veritable-games.git
cd veritable-games-main

# Navigate to frontend directory (ALL work happens here)
cd frontend
```

### Step 1.2: Create Environment Variables

```bash
# Generate 3 random 32-byte hex strings
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Create .env.local file
cat > .env.local << 'EOF'
# Database Connection (from Neon - add after creating database)
POSTGRES_URL=postgresql://user:password@host.neon.tech/database?sslmode=require

# Session Security (generate with: openssl rand -hex 32)
SESSION_SECRET=YOUR_SESSION_SECRET_HERE
ENCRYPTION_KEY=YOUR_ENCRYPTION_KEY_HERE

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

**IMPORTANT**: Keep `.env.local` out of Git (already in `.gitignore`)

### Step 1.3: Verify Local Setup

```bash
# Check Node.js version (needs v20+)
node --version

# Check npm
npm --version

# Install dependencies (from frontend/ directory)
npm install
```

**Expected**: No errors, all dependencies installed

---

## Phase 2: Neon PostgreSQL Setup

### Step 2.1: Create Neon Account

1. Go to [neon.tech](https://neon.tech)
2. Click **"Sign Up"** (or use GitHub auth)
3. Complete email verification
4. Create organization (optional)

### Step 2.2: Create New Database Project

1. Dashboard → **"New Project"**
2. Configure:
   - **Name**: `veritable-games`
   - **Region**: US East (or closest to you)
   - **PostgreSQL**: 15 (latest)
3. Click **"Create Project"**

**Wait**: 2-3 minutes for provisioning

### Step 2.3: Get Connection String

1. Project Dashboard → **"Connection Details"**
2. Select **"Connection string"**
3. Copy the full string:
   ```
   postgresql://user:password@host.neon.tech/database?sslmode=require
   ```

**SAVE THIS**: You'll need it multiple times

### Step 2.4: Update .env.local

```bash
# Edit frontend/.env.local
# Replace: POSTGRES_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
# With: Your actual connection string from Neon
```

### Step 2.5: Test Connection

```bash
# From frontend/ directory
node -e "
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
pool.query('SELECT 1', (err, res) => {
  if (err) console.error('❌ Connection failed:', err.message);
  else console.log('✅ PostgreSQL connected successfully!');
  process.exit(err ? 1 : 0);
});
"
```

**Expected**: "✅ PostgreSQL connected successfully!"

---

## Phase 3: Schema Migration

### Step 3.1: Run Schema Migration

```bash
# From frontend/ directory
npm run pg:migrate-schema
```

**Expected output**:
```
🔌 Connecting to PostgreSQL...
✅ Connected!

📊 Creating schemas...
✅ auth schema created
✅ forums schema created
... (all 10 schemas)

📊 Creating tables...
✅ forums.forum_categories created
... (all 153 tables)

✅ Schema migration complete
Tables created: 153
Indexes created: 273
```

**Duration**: 3-5 minutes

### Step 3.2: Verify Schema Creation

```bash
# Check tables were created
node -e "
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const result = await pool.query(\"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')\");
  console.log('✅ Tables created:', result.rows[0].count);
  process.exit(0);
})().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
"
```

**Expected**: "✅ Tables created: 153"

---

## Phase 4: Apply Schema Fixes

**CRITICAL**: These fixes must be applied BEFORE data migration.

### Step 4.1: Understand the Fixes

Three schema issues discovered during testing:

1. **users.users table** - Missing `status` column
2. **system.system_performance_metrics** - INTEGER columns need BIGINT for large values
3. **content.project_metadata** - Table doesn't exist in schema

### Step 4.2: Apply All Fixes

```bash
# Run from frontend/ directory
node -e "
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  console.log('🔧 APPLYING SCHEMA FIXES\n');

  try {
    // FIX 1: Add users.status column
    console.log('1️⃣  Adding users.status column...');
    try {
      await pool.query('ALTER TABLE users.users ADD COLUMN status TEXT');
      console.log('   ✅ Column added\n');
    } catch(e) {
      if (e.message.includes('already exists')) {
        console.log('   ⚠️  Already exists\n');
      } else throw e;
    }

    // FIX 2: Fix system_performance_metrics BIGINT columns
    console.log('2️⃣  Fixing system_performance_metrics column types...');
    const columns = ['memory_total', 'memory_used', 'disk_total', 'disk_free'];
    for (const col of columns) {
      await pool.query(\`ALTER TABLE system.system_performance_metrics ALTER COLUMN \${col} TYPE BIGINT\`);
      console.log(\`   ✅ \${col}: INTEGER → BIGINT\`);
    }
    console.log();

    // FIX 3: Create project_metadata table
    console.log('3️⃣  Creating project_metadata table...');
    await pool.query(\`
      CREATE TABLE IF NOT EXISTS content.project_metadata (
        id BIGSERIAL PRIMARY KEY,
        project_id BIGINT,
        key VARCHAR(255),
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`);
    console.log('   ✅ Table created\n');

    console.log('✅ ALL SCHEMA FIXES APPLIED\n');
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
"
```

**Expected output**:
```
1️⃣  Adding users.status column...
   ✅ Column added

2️⃣  Fixing system_performance_metrics column types...
   ✅ memory_total: INTEGER → BIGINT
   ✅ memory_used: INTEGER → BIGINT
   ✅ disk_total: INTEGER → BIGINT
   ✅ disk_free: INTEGER → BIGINT

3️⃣  Creating project_metadata table...
   ✅ Table created

✅ ALL SCHEMA FIXES APPLIED
```

### Step 4.3: Verify Fixes

```bash
# Verify status column was added
node -e "
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const result = await pool.query(\"SELECT column_name FROM information_schema.columns WHERE table_schema='users' AND table_name='users' AND column_name='status'\");
  if (result.rows.length > 0) console.log('✅ users.status column exists');
  else console.log('❌ users.status column NOT found');
  process.exit(result.rows.length > 0 ? 0 : 1);
})();
"
```

---

## Phase 5: Data Migration

### Step 5.1: Start Data Migration

```bash
# From frontend/ directory
npm run pg:migrate-data
```

**Expected output** (during processing):
```
📊 Migrating SQLite Data to PostgreSQL
🔌 Connecting to Neon PostgreSQL...
✅ Connected!

📊 Processing forums.db...
   ✅ forum_categories: 7/7 rows
   ✅ forum_sections: 5/5 rows

📊 Processing wiki.db...
   ✅ wiki_categories: 14/14 rows
   ... (continues for all databases)
```

**Duration**: 10-20 minutes

### Step 5.2: Interpret Results

When migration completes, you'll see:

```
============================================================
📊 Migration Summary:
   Tables processed: 142
   Total rows migrated: 50,143
   Errors: 0-2

⚠️  Data migration completed with [error count] errors.
```

**Acceptable errors**:
- 0 errors: Perfect! ✅
- 1-2 errors: Normal (project_metadata table, edge cases) ✅
- 3+ errors: Review `MIGRATION_ERROR_ANALYSIS.md`

### Step 5.3: Verify Data Migration

```bash
# Check row counts in key tables
node -e "
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  const tables = [
    'forums.forum_categories',
    'wiki.wiki_pages',
    'users.users',
    'content.projects',
    'library.library_documents'
  ];

  console.log('📊 Sample table row counts:\n');
  for (const table of tables) {
    const result = await pool.query(\`SELECT COUNT(*) as count FROM \${table}\`);
    console.log(\`  \${table}: \${result.rows[0].count} rows\`);
  }

  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
"
```

**Expected**: All tables have data

---

## Phase 6: Vercel Deployment

### Step 6.1: Prepare GitHub

```bash
# From root directory
git status
git add .
git commit -m "Ready for Vercel deployment: PostgreSQL migration complete"
git push origin main
```

### Step 6.2: Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (recommended)
4. Authorize Vercel

### Step 6.3: Import Repository

1. Vercel Dashboard → **"Add New..."** → **"Project"**
2. Click **"Import Git Repository"**
3. Select your `veritable-games-main` repository
4. Click **"Import"**

### Step 6.4: Configure Build Settings

**Critical**: Set root directory to `frontend`

1. In project configuration screen:
2. Under **"Project Settings"**
3. Click **"Edit"** next to "Root Directory"
4. Enter: `frontend`
5. Click **"Save"**

### Step 6.5: Add Environment Variables

In Vercel project settings, add each variable:

| Variable | Value | Source |
|----------|-------|--------|
| `POSTGRES_URL` | Your Neon connection string | From Neon dashboard |
| `SESSION_SECRET` | 32-byte hex string | Generate: `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | 32-byte hex string | Generate: `openssl rand -hex 32` |
| `NODE_ENV` | `production` | Constant |
| `NEXT_PUBLIC_APP_URL` | `https://yourdomain.com` | Your domain |

**Steps**:
1. Settings → Environment Variables
2. Add Name + Value for each
3. Select: Production, Preview, Development
4. Click "Add"

### Step 6.6: Deploy

1. Click **"Deploy"** button
2. Wait for build to complete (5-10 minutes)
3. Monitor logs for errors

**Success indicators**:
- ✅ Green checkmark
- ✅ Live URL assigned (e.g., `https://veritable-games-main-xyz.vercel.app`)
- ✅ No errors in logs

### Step 6.7: Test Deployment

```bash
# Visit your Vercel URL
https://veritable-games-main-xyz.vercel.app

# Check:
- [ ] Site loads (no 500 errors)
- [ ] Can access login page
- [ ] Database connection works (check runtime logs)
```

---

## Phase 7: Post-Deployment

### Step 7.1: Configure Custom Domain (Optional)

Follow `DNS_CONFIGURATION_QUICKREF.md` for:
1. Adding domain in Vercel
2. Configuring DNS in Squarespace
3. Waiting for propagation

### Step 7.2: Monitor Logs

```
Vercel Dashboard → Deployments → [Latest] → Runtime Logs

Look for:
✅ PostgreSQL connected
✅ No connection errors
✅ Application initialized
```

### Step 7.3: Test Core Features

- [ ] Login/registration
- [ ] Create forum topic
- [ ] Create wiki page
- [ ] Upload file to library
- [ ] Use search function
- [ ] Check user profile

---

## Troubleshooting

### Connection Issues

**Error**: "ECONNREFUSED"

```bash
# Verify POSTGRES_URL
echo $POSTGRES_URL

# Test connection manually
psql $POSTGRES_URL -c "SELECT 1"
```

**Fix**: Verify connection string from Neon is correct

### Schema Migration Fails

**Error**: "relation already exists" or permission error

```bash
# Check if schema was already created
psql $POSTGRES_URL -c "\dn"

# If exists, you can proceed to data migration
```

### Data Migration Errors

See `MIGRATION_ERROR_ANALYSIS.md` for detailed error handling

**Common errors**:
- Integer overflow → Already fixed in Phase 4
- Missing columns → Already fixed in Phase 4
- Missing tables → Already fixed in Phase 4

### Vercel Build Fails

**Check**:
1. Runtime errors in build logs
2. Missing environment variables
3. TypeScript errors: `npm run type-check` locally first

**Fix**:
```bash
# Locally test build
npm run build

# Check for errors
npm run type-check
```

---

## Complete Command Reference

### All at Once (Full Deployment)

```bash
# 1. Setup
cd /path/to/veritable-games-main/frontend
cat > .env.local << 'EOF'
POSTGRES_URL=your_neon_connection_string_here
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

# 2. Test connection
node -e "require('dotenv').config(); const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.POSTGRES_URL }); pool.query('SELECT 1', (err) => { console.log(err ? '❌ ' + err.message : '✅ Connected'); process.exit(err ? 1 : 0); });"

# 3. Migrate schema
npm run pg:migrate-schema

# 4. Apply schema fixes
# (Run the fix script from Phase 4)

# 5. Migrate data
npm run pg:migrate-data

# 6. Check results
# Verify data in PostgreSQL

# 7. Deploy to Vercel
# (Follow Phase 6 steps)
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `MIGRATION_ERROR_ANALYSIS.md` | Detailed error investigation & fixes |
| `NEON_POSTGRESQL_DEPLOYMENT_GUIDE.md` | Comprehensive Neon setup guide |
| `VERCEL_DEPLOYMENT_GUIDE.md` | Complete Vercel configuration |
| `DNS_CONFIGURATION_QUICKREF.md` | DNS setup for custom domains |
| `DEPLOYMENT_NEXT_STEPS.md` | Decision tree for deployment |

---

## Success Criteria

### Before Deployment
- [ ] `.env.local` created with valid POSTGRES_URL
- [ ] Connection to Neon verified
- [ ] Schema migrated (153 tables created)
- [ ] Schema fixes applied (all 3)
- [ ] Data migrated (>50K rows)
- [ ] Migration errors < 3

### During Deployment
- [ ] Vercel build succeeds
- [ ] No build-time errors
- [ ] Environment variables set in Vercel
- [ ] Root directory set to `frontend`

### After Deployment
- [ ] Site loads without 500 errors
- [ ] PostgreSQL connection works
- [ ] Authentication functions
- [ ] Database operations succeed
- [ ] No errors in runtime logs

---

## Time Breakdown

| Phase | Duration |
|-------|----------|
| Environment Setup | 10 minutes |
| Neon Setup | 15 minutes |
| Schema Migration | 5 minutes |
| Schema Fixes | 5 minutes |
| Data Migration | 15 minutes |
| Vercel Setup | 10 minutes |
| Deployment | 10 minutes |
| Testing | 10 minutes |
| **Total** | **~80 minutes** |

---

## Support & References

**For detailed information**:
- Neon: `NEON_POSTGRESQL_DEPLOYMENT_GUIDE.md`
- Vercel: `VERCEL_DEPLOYMENT_GUIDE.md`
- Errors: `MIGRATION_ERROR_ANALYSIS.md`
- DNS: `DNS_CONFIGURATION_QUICKREF.md`

**External links**:
- [Neon Docs](https://neon.tech/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Docs](https://nextjs.org/docs)

---

**Ready to deploy? Start with Phase 1!**

---

**Last updated**: October 29, 2025
**Status**: Tested and ready for production deployment
