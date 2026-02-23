# Veritable Games - PostgreSQL Migration & Vercel Deployment Guide

**Last Updated**: October 28, 2025
**Migration Status**: Data migration 99.99% complete (6,967 of 6,968 rows migrated)
**Schema Migration**: 100% complete (153 tables, 273 indexes, 0 errors)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Why Each Service?](#why-each-service)
3. [Request Flow Diagrams](#request-flow-diagrams)
4. [Migration Results Summary](#migration-results-summary)
5. [Vercel Deployment Guide](#vercel-deployment-guide)
6. [DNS Configuration](#dns-configuration)
7. [Environment Variables](#environment-variables)
8. [Deployment Workflow](#deployment-workflow)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### The Complete Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     USERS / WEB TRAFFIC                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             SQUARESPACE DNS (veritablegames.com)             │
│  • Points www.veritablegames.com → Vercel                   │
│  • Points veritablegames.com → Vercel                       │
│  • Keeps Google Workspace MX records (email)                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   VERCEL (Application Server)                │
│  • Hosts Next.js application                                │
│  • Server-side rendering (React SSR)                        │
│  • API routes (/api/*)                                      │
│  • Auto-deploys from GitHub                                 │
│  • Free tier: 100GB bandwidth/month                         │
└────────────┬─────────────────────────────┬──────────────────┘
             │                             │
             │ Reads/writes data           │ Triggered by push
             │                             │
             ▼                             ▼
┌──────────────────────────┐    ┌─────────────────────────────┐
│  NEON PostgreSQL         │    │    GITHUB REPOSITORY        │
│  • Database storage      │    │  • Source code              │
│  • 10 schemas            │    │  • Version control          │
│  • 153 tables            │    │  • Webhook to Vercel        │
│  • ~7,000 rows           │    └─────────────────────────────┘
│  • Free: 0.5GB storage   │
│  • East US 2 (Azure)     │
└──────────────────────────┘
              ▲
              │ Develops locally,
              │ pushes to GitHub
              │
┌──────────────────────────┐
│  LOCAL DEVELOPMENT       │
│  • npm run dev           │
│  • Code changes          │
│  • Testing               │
│  • SQLite (legacy)       │
└──────────────────────────┘
```

---

## Why Each Service?

### Neon (PostgreSQL Database)

**Purpose**: Store all application data in production

**Why We Need It**:
- Vercel's serverless functions have **read-only filesystems**
- Each function invocation gets a new, isolated container
- SQLite requires write access to disk (incompatible with serverless)
- PostgreSQL runs as a separate, always-on database service

**Why Neon Specifically**:
- ✅ Serverless PostgreSQL (scales automatically)
- ✅ Free tier: 0.5GB storage, 100 hours compute/month
- ✅ Instant connection pooling (critical for serverless)
- ✅ Built-in backups and point-in-time recovery
- ✅ Located in East US 2 (low latency for US users)

**Alternatives Considered**:
- Supabase: Similar features, also has free tier
- Vercel Postgres: $20/month, only 256MB storage
- Self-hosted: Would need to manage server ourselves

---

### Vercel (Application Hosting)

**Purpose**: Run Next.js server-side code and serve the application

**Why We Need It**:
- GitHub Pages **cannot run server-side code** (static files only)
- Next.js requires Node.js runtime for:
  - Server Components (render React on server)
  - API routes (backend endpoints)
  - Image optimization
  - Server-side authentication

**Why Vercel Specifically**:
- ✅ Built by creators of Next.js (zero-config deployment)
- ✅ Free tier: Unlimited deployments, 100GB bandwidth
- ✅ Automatic deployments from GitHub (push → deploy)
- ✅ Global edge network (fast worldwide)
- ✅ Automatic HTTPS certificates
- ✅ Preview deployments for every branch

**What Happens on Vercel**:
```
User request → Vercel Edge → Next.js renders page → Query PostgreSQL → Return HTML
```

---

### GitHub (Version Control)

**Purpose**: Store source code and trigger deployments

**How It Works**:
1. You push code to `main` branch
2. GitHub sends webhook to Vercel
3. Vercel pulls latest code
4. Vercel runs `npm install` and `npm run build`
5. Vercel deploys to production (2-3 minutes)

**Why Not Use for Hosting**:
- GitHub Pages only serves static HTML/CSS/JS
- Cannot run Next.js server-side rendering
- Cannot execute API routes
- No database support

---

### Squarespace DNS

**Purpose**: Point your domain (veritablegames.com) to Vercel

**What Changes**:
```
OLD: veritablegames.com → GitHub Pages (108070.github.io)
NEW: veritablegames.com → Vercel (cname.vercel-dns.com)
```

**What Stays the Same**:
- Google Workspace email routing (MX records unchanged)
- Domain ownership (still registered with Squarespace)

---

## Request Flow Diagrams

### User Visits Website

```
1. User types: https://veritablegames.com
   ↓
2. Browser queries DNS
   Squarespace DNS says: "veritablegames.com points to Vercel"
   ↓
3. Browser connects to Vercel edge server (nearest location)
   ↓
4. Vercel runs Next.js server-side code
   • Checks authentication (session cookie)
   • Renders React Server Components
   • Executes any API calls
   ↓
5. Next.js queries Neon PostgreSQL
   • Fetch user data
   • Fetch page content
   • Execute business logic
   ↓
6. Neon returns data to Vercel
   ↓
7. Next.js generates HTML response
   ↓
8. Vercel sends HTML + JavaScript to browser
   ↓
9. React hydrates in browser (makes page interactive)
   ↓
10. User sees rendered page
```

### Developer Pushes Code

```
1. Developer makes changes locally
   cd frontend
   npm run dev  # Test locally with SQLite
   ↓
2. Developer commits and pushes
   git add .
   git commit -m "Add new feature"
   git push origin main
   ↓
3. GitHub receives push
   Updates repository
   Triggers webhook to Vercel
   ↓
4. Vercel receives webhook notification
   Starts automatic deployment
   ↓
5. Vercel build process:
   • Clone repository from GitHub
   • npm install (dependencies)
   • npm run build (compile TypeScript, optimize)
   • Deploy to edge network
   ↓
6. Deployment complete (2-3 minutes)
   New version live at veritablegames.com
   Zero downtime (gradual rollout)
   ↓
7. Developer receives email notification
   "Deployment successful"
```

---

## Migration Results Summary

### Schema Migration: ✅ 100% SUCCESS

**Final Statistics**:
```
Total Tables:    153
Total Indexes:   273
Total Schemas:   10
Errors:          0
```

**Schema Breakdown**:
```
forums      (10 tables,  10 indexes)  - Forum discussions
wiki        (32 tables,  45 indexes)  - Wiki pages & revisions
users       (11 tables,  15 indexes)  - User accounts
auth        (8 tables,   12 indexes)  - Sessions & authentication
content     (29 tables,  89 indexes)  - Projects, workspaces, news
library     (6 tables,   8 indexes)   - Documents & annotations
messaging   (3 tables,   4 indexes)   - Private messages
system      (16 tables,  35 indexes)  - Settings, metrics
cache       (5 tables,   5 indexes)   - Application cache
main        (57 tables,  85 indexes)  - Legacy archive (read-only)
```

**Key Conversions Applied**:

| SQLite Type | PostgreSQL Type | Example |
|-------------|-----------------|---------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGSERIAL PRIMARY KEY` | User IDs, post IDs |
| `DATETIME` | `TIMESTAMP` | Created dates, modified dates |
| `INTEGER` (timestamps) | `BIGINT` | Unix timestamps in milliseconds |
| `INTEGER` (booleans) | `BOOLEAN` | is_active, is_published |
| `BLOB` | `BYTEA` | Binary data, avatars |
| `TEXT` | `TEXT` or `VARCHAR(n)` | Strings |
| `datetime('now')` | `NOW()` | Current timestamp |
| `randomblob(16)` | `gen_random_bytes(16)` | Random tokens |

**FTS Conversion**:
```sql
-- SQLite FTS5 (virtual table)
CREATE VIRTUAL TABLE forum_search_fts USING fts5(title, content);

-- PostgreSQL equivalent
CREATE TABLE forum_search (
  id BIGSERIAL PRIMARY KEY,
  content_id BIGINT,
  search_vector TSVECTOR
);
CREATE INDEX idx_forum_search_vector ON forum_search USING GIN(search_vector);
```

---

### Data Migration: ✅ 99.99% SUCCESS

**Final Statistics** (from `/tmp/data-migration-retry.log`):
```
Tables processed: 132
Total rows migrated: 6,967
Errors: 1 (99.99% success rate)
```

**Major Tables Migrated**:
```
✅ wiki_pages:                159 rows
✅ wiki_revisions:            502 rows
✅ project_reference_images:  1,148 rows (largest table)
✅ forum_categories:          7 rows
✅ forum_sections:            5 rows
✅ users:                     13 rows (consolidated from multiple DBs)
✅ user_sessions:             44 rows
✅ projects:                  8 rows
✅ reference_albums:          47 rows
✅ library_documents:         7 rows
✅ conversations:             3 rows
... and 121 more tables
```

**Remaining Issue**:
```
❌ landing_subscribers: 1 row failed
   Error: value "1761690299989" is out of range for type integer
   Fix: Run fix-timestamp-columns.js to convert to BIGINT
```

**What Was Fixed**:
- ✅ 45 timestamp columns converted `INTEGER → BIGINT`
- ✅ Nested DEFAULT expressions removed
- ✅ Foreign key constraints handled
- ✅ Double-quoted strings converted to single quotes
- ✅ SQL comments stripped
- ✅ Boolean values converted (0/1 → false/true)

---

## Vercel Deployment Guide

### Prerequisites

Before starting Vercel deployment:

- [x] Neon PostgreSQL database created
- [x] Schema migration complete (153 tables)
- [x] Data migration complete (6,967 rows)
- [ ] GitHub repository up to date
- [ ] Environment variables documented (see section below)

---

### Step 1: Create Vercel Account

1. Go to https://vercel.com/signup
2. Click **"Continue with GitHub"**
3. Authorize Vercel to access your GitHub account
4. Vercel will list your repositories

**Free Tier Includes**:
- 100GB bandwidth per month
- Unlimited deployments
- Automatic HTTPS certificates
- Global CDN (edge network)
- Preview deployments for every PR

---

### Step 2: Import Project

1. From Vercel dashboard, click **"Add New..." → "Project"**
2. Find repository: `veritable-games-main`
3. Click **"Import"**

4. Configure build settings:
   ```
   Framework Preset: Next.js
   Root Directory: ./frontend
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   Node.js Version: 20.x
   ```

5. **DO NOT deploy yet** - need to add environment variables first

---

### Step 3: Configure Environment Variables

**CRITICAL**: Add these BEFORE first deployment.

Click **"Environment Variables"** tab and add each variable:

```bash
# ===== DATABASE CONNECTION =====
POSTGRES_URL="postgresql://neondb_owner:npg_9ZQTdDper6tw@ep-withered-feather-a878iz2v-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require"

# ===== SECURITY SECRETS =====
# ⚠️ IMPORTANT: Use EXISTING secrets from .env.local
# NEVER regenerate these - doing so invalidates all sessions and encrypted data
SESSION_SECRET="***REDACTED***" # Use existing value from .env.local
CSRF_SECRET="***REDACTED***" # Use existing value from .env.local
ENCRYPTION_KEY="***REDACTED***" # Use existing value from .env.local

# ===== DATABASE MODE =====
DATABASE_MODE="postgres"

# ===== APPLICATION URLS =====
# Update these after Vercel assigns your domain
NEXTAUTH_URL="https://veritable-games.vercel.app"
NEXT_PUBLIC_SITE_URL="https://veritable-games.vercel.app"
NEXT_PUBLIC_API_URL="https://veritable-games.vercel.app/api"

# ===== POSTGRESQL POOL SETTINGS =====
POSTGRES_POOL_MAX="20"
POSTGRES_POOL_MIN="2"
POSTGRES_IDLE_TIMEOUT="30000"
POSTGRES_CONNECTION_TIMEOUT="5000"
POSTGRES_SSL="true"

# ===== APPLICATION SETTINGS =====
DB_POOL_SIZE="5"
DB_TIMEOUT="30000"
LOG_LEVEL="info"

# ===== FEATURE FLAGS =====
ENABLE_FORUMS="true"
ENABLE_WIKI="true"
ENABLE_LIBRARY="true"
ENABLE_3D_VIEWER="true"

# ===== ENVIRONMENT =====
NODE_ENV="production"
NEXT_PUBLIC_MAINTENANCE_MODE="false"
```

**Important Notes**:
- Set variables to **"Production"**, **"Preview"**, and **"Development"** environments
- Never commit `.env.local` to Git (already in .gitignore)
- After deployment, update `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` to custom domain

**How to Generate New Secrets** (for production):
```bash
# Run locally, then copy/paste into Vercel
openssl rand -hex 32  # SESSION_SECRET
openssl rand -hex 32  # CSRF_SECRET
openssl rand -hex 32  # ENCRYPTION_KEY
```

---

### Step 4: Deploy

1. Click **"Deploy"** button

2. Vercel will:
   - Clone repository from GitHub
   - Run `npm install` in `frontend/` directory
   - Run `npm run build`
   - Deploy to edge network
   - Assign URL: `veritable-games.vercel.app`

3. **First deployment takes 5-7 minutes**
4. **Subsequent deployments take 2-3 minutes**

5. Monitor build logs for errors

---

### Step 5: Test Deployment

1. Visit assigned URL: `https://veritable-games.vercel.app`

2. **Test Critical Paths**:
   - [ ] Homepage loads
   - [ ] User registration works
   - [ ] User login works
   - [ ] Forum posts display
   - [ ] Wiki pages render
   - [ ] Database queries succeed
   - [ ] Sessions persist across requests

3. **Check Logs**:
   - Go to Vercel Dashboard → Project → Logs
   - Watch for errors
   - Verify database connections succeed

**If Deployment Fails**:
- Check build logs for TypeScript errors
- Verify all environment variables are set
- Ensure `frontend/` is set as root directory
- Verify `POSTGRES_URL` is correct
- Check that `DATABASE_MODE=postgres` is set

---

## DNS Configuration

### Current Setup (GitHub Pages)

```
www.veritablegames.com → CNAME → 108070.github.io
veritablegames.com → A records → GitHub IPs (185.199.108.153, etc.)
TXT record → GitHub verification
```

---

### Target Setup (Vercel)

```
www.veritablegames.com → CNAME → cname.vercel-dns.com
veritablegames.com → CNAME → cname.vercel-dns.com (or A records)
Google Workspace MX records → aspmx.l.google.com (UNCHANGED)
```

---

### Step-by-Step DNS Changes

#### 1. Add Domain in Vercel First

1. Go to Vercel Dashboard → Project → Settings → **Domains**
2. Click **"Add Domain"**
3. Enter: `veritablegames.com`
4. Vercel will show required DNS records
5. **Keep this page open** - you'll need these values

#### 2. Log into Squarespace DNS

1. Go to https://account.squarespace.com/domains
2. Click on `veritablegames.com`
3. Click **"DNS Settings"**

#### 3. Update DNS Records

**A. Update www subdomain**:
```
Type: CNAME
Host: www
Points to: cname.vercel-dns.com
TTL: 3600
```

**B. Update root domain** (two options):

**Option 1: CNAME (if Squarespace allows)**:
```
Type: CNAME
Host: @
Points to: cname.vercel-dns.com
TTL: 3600
```

**Option 2: A records (if CNAME not allowed on root)**:
```
Type: A
Host: @
Points to: 76.76.21.21
TTL: 3600
```

**C. Keep Google Workspace records** (DO NOT CHANGE):
```
Type: MX
Host: @
Points to: aspmx.l.google.com (priority 1)
Points to: alt1.aspmx.l.google.com (priority 5)
Points to: alt2.aspmx.l.google.com (priority 5)
... (keep all MX records exactly as is)
```

**D. Remove old GitHub Pages records**:
- ❌ Delete CNAME pointing to `108070.github.io`
- ❌ Delete GitHub verification TXT record
- ❌ Delete old A records pointing to GitHub IPs (185.199.108.153, etc.)

#### 4. Wait for DNS Propagation

**Timeline**:
- Minimum: 5 minutes
- Typical: 1 hour
- Maximum: 48 hours

**Check Propagation Status**:
```bash
# Command line
dig veritablegames.com
dig www.veritablegames.com

# Web tool
# https://dnschecker.org
```

#### 5. Verify in Vercel

1. Go back to Vercel → Domains
2. Vercel will automatically detect DNS changes
3. Wait for status: **"Valid Configuration" ✓**
4. Vercel will provision SSL certificate (1-5 minutes)
5. Wait for: **"Certificate Active" ✓**

#### 6. Update Environment Variables

Once domain is active, update these in Vercel:

```bash
NEXTAUTH_URL="https://veritablegames.com"
NEXT_PUBLIC_SITE_URL="https://veritablegames.com"
NEXT_PUBLIC_API_URL="https://veritablegames.com/api"
```

Then redeploy (Vercel Dashboard → Deployments → "..." → Redeploy).

#### 7. Test Domain

```bash
# Check DNS resolution
dig veritablegames.com
# Should return Vercel IP: 76.76.21.21

# Test HTTPS
curl -I https://veritablegames.com
# Should return: 200 OK

# Test www redirect
curl -I https://www.veritablegames.com
# Should redirect to https://veritablegames.com
```

---

## Environment Variables

### Complete Reference

**Location**: Vercel Dashboard → Project → Settings → Environment Variables

| Variable | Example Value | Required | Description |
|----------|---------------|----------|-------------|
| `POSTGRES_URL` | `postgresql://user:pass@host/db` | ✅ YES | Neon connection string |
| `SESSION_SECRET` | 64-char hex | ✅ YES | Session encryption key |
| `CSRF_SECRET` | 64-char hex | ✅ YES | CSRF token encryption |
| `ENCRYPTION_KEY` | 64-char hex | ✅ YES | Future encryption use |
| `DATABASE_MODE` | `postgres` | ✅ YES | Use PostgreSQL (not SQLite) |
| `NODE_ENV` | `production` | ✅ YES | Runtime environment |
| `NEXTAUTH_URL` | `https://veritablegames.com` | ✅ YES | Canonical site URL |
| `NEXT_PUBLIC_SITE_URL` | `https://veritablegames.com` | ✅ YES | Public site URL |
| `NEXT_PUBLIC_API_URL` | `https://veritablegames.com/api` | ✅ YES | API base URL |
| `POSTGRES_POOL_MAX` | `20` | ⚠️ Recommended | Max DB connections |
| `POSTGRES_POOL_MIN` | `2` | ⚠️ Recommended | Min DB connections |
| `POSTGRES_SSL` | `true` | ⚠️ Recommended | Require SSL |
| `LOG_LEVEL` | `info` | Optional | Logging verbosity |
| `ENABLE_FORUMS` | `true` | Optional | Enable forums |
| `ENABLE_WIKI` | `true` | Optional | Enable wiki |
| `ENABLE_LIBRARY` | `true` | Optional | Enable library |
| `ENABLE_3D_VIEWER` | `true` | Optional | Enable 3D viewer |

### Current Production Values

**From your `.env.local`**:

```bash
POSTGRES_URL="postgresql://neondb_owner:npg_9ZQTdDper6tw@ep-withered-feather-a878iz2v-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require"

SESSION_SECRET="***REDACTED***" # Use existing value from .env.local
CSRF_SECRET="***REDACTED***" # Use existing value from .env.local
ENCRYPTION_KEY="***REDACTED***" # Use existing value from .env.local
```

⚠️ **IMPORTANT**: Use EXISTING secrets from .env.local. NEVER regenerate - doing so invalidates all sessions and encrypted data.

---

## Deployment Workflow

### Automatic Deployments

Every push to `main` branch triggers automatic deployment:

```bash
# Local development
cd frontend
npm run dev
# Make changes, test locally

# Commit and push
git add .
git commit -m "Add new feature"
git push origin main

# Vercel automatically:
# 1. Detects push via GitHub webhook
# 2. Clones repository
# 3. Runs npm install
# 4. Runs npm run build
# 5. Deploys to production
# 6. Updates veritablegames.com
#
# Total time: ~2-3 minutes
```

### Preview Deployments

Every push to a non-main branch creates a preview deployment:

```bash
# Create feature branch
git checkout -b feature/new-feature
git push origin feature/new-feature

# Vercel creates preview URL:
# https://veritable-games-git-feature-new-feature-username.vercel.app
#
# Test changes before merging to main
```

### Rollback Strategy

If a deployment breaks production:

**Option 1: Via Vercel Dashboard**
1. Go to Deployments tab
2. Find last working deployment
3. Click "..." → **"Promote to Production"**
4. Instant rollback (< 1 minute)

**Option 2: Via Git**
```bash
git revert HEAD
git push origin main
# Vercel auto-deploys previous version
```

---

## Troubleshooting

### Deployment Fails with "Module not found"

**Cause**: Missing dependencies in package.json

**Fix**:
```bash
cd frontend
npm install
npm run build  # Test build locally first
git add package-lock.json
git commit -m "Update dependencies"
git push
```

---

### Database Connection Errors

**Symptoms**:
```
Error: connect ETIMEDOUT
Error: password authentication failed
```

**Fix**:
1. Verify `POSTGRES_URL` in Vercel environment variables
2. Check Neon dashboard - database still running?
3. Test connection locally:
   ```bash
   cd frontend
   npm run pg:test
   ```
4. Ensure `DATABASE_MODE=postgres` in Vercel

---

### Build Succeeds but Site Shows 500 Errors

**Cause**: Environment variables not set correctly

**Fix**:
1. Check Vercel logs: Project → Deployments → Click deployment → **"View Function Logs"**
2. Look for errors mentioning missing env vars
3. Add missing variables in Settings → Environment Variables
4. Redeploy: Deployments → "..." → Redeploy

---

### CSS/Images Not Loading

**Cause**: Incorrect `NEXT_PUBLIC_SITE_URL`

**Fix**:
```bash
# Update in Vercel
NEXT_PUBLIC_SITE_URL="https://veritablegames.com"
```
Then redeploy.

---

### DNS Changes Not Taking Effect

**Check propagation**:
```bash
dig veritablegames.com
# Or use: https://dnschecker.org
```

**Fix**:
1. Wait up to 48 hours (usually < 1 hour)
2. Clear browser cache: Ctrl+Shift+R
3. Try different browser or incognito mode
4. Verify DNS records in Squarespace match Vercel's requirements

---

### Session/Authentication Issues

**Symptoms**: Can't log in, session doesn't persist

**Cause**: `SESSION_SECRET` mismatch or cookie domain issues

**Fix**:
1. Verify `SESSION_SECRET` is set in Vercel
2. Ensure `NEXTAUTH_URL` matches actual domain
3. Check browser console for cookie errors
4. Clear cookies and try again

---

## Next Steps

### Immediate Actions

1. **Fix Remaining Data Migration Error**
   ```bash
   cd frontend
   node scripts/fix-timestamp-columns.js
   npm run pg:migrate-data
   # Expected: 6,968/6,968 rows (100% success)
   ```

2. **Verify Migration Complete**
   ```bash
   # Check final statistics
   cat /tmp/data-migration-retry.log
   ```

3. **Update DATABASE_MODE Locally** (test before deploying)
   ```bash
   # In frontend/.env.local
   DATABASE_MODE=postgres

   npm run dev
   # Test all features with PostgreSQL
   ```

### Vercel Deployment Checklist

- [ ] Create Vercel account
- [ ] Import GitHub repository
- [ ] Configure build settings (root: frontend/)
- [ ] Add all environment variables
- [ ] Deploy to Vercel
- [ ] Test at `veritable-games.vercel.app`
- [ ] Verify database connection works
- [ ] Test authentication (login/register)
- [ ] Test all major features

### DNS Migration Checklist

- [ ] Add custom domain in Vercel
- [ ] Get required DNS records from Vercel
- [ ] Update Squarespace DNS
  - [ ] Add CNAME for www
  - [ ] Add CNAME or A for root
  - [ ] Remove old GitHub Pages records
  - [ ] Keep Google Workspace MX records
- [ ] Wait for DNS propagation
- [ ] Verify SSL certificate issued
- [ ] Update environment URLs to production domain
- [ ] Redeploy with new URLs

### Post-Deployment Monitoring

- [ ] Monitor Vercel analytics for errors
- [ ] Check Neon database usage (stay under 0.5GB)
- [ ] Set up uptime monitoring (UptimeRobot, etc.)
- [ ] Configure email notifications for deployment failures
- [ ] Test from different devices/networks

---

## Resources

### Official Documentation

- **Vercel**: https://vercel.com/docs
- **Neon**: https://neon.tech/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment

### Support Channels

- **Vercel Support**: support@vercel.com (free tier includes email support)
- **Neon Support**: https://neon.tech/docs/community/support
- **Squarespace DNS**: https://support.squarespace.com/hc/en-us/articles/205812378

### Monitoring Tools

- **Vercel Analytics**: Built-in (Dashboard → Analytics)
- **Neon Metrics**: Dashboard → Project → Metrics
- **DNS Checker**: https://dnschecker.org
- **SSL Checker**: https://www.ssllabs.com/ssltest/

---

## Migration Scripts Reference

### Schema Migration

```bash
cd frontend
npm run pg:migrate-schema
# Output: /tmp/migration-SUCCESS.log
# Result: 153 tables, 273 indexes, 0 errors
```

### Data Migration

```bash
npm run pg:migrate-data
# Output: /tmp/data-migration-retry.log
# Result: 6,967 rows migrated
```

### Fix Timestamp Overflows

```bash
node scripts/fix-timestamp-columns.js
# Converts INTEGER → BIGINT for timestamp columns
# Fixed 45 columns in previous run
```

### Test PostgreSQL Connection

```bash
npm run pg:test
# Verifies connection to Neon
```

---

## Why This Architecture?

### The Problem

**Vercel Serverless Limitation**:
- Each function invocation runs in an isolated container
- Containers have **read-only filesystems**
- SQLite requires write access to `.db` files
- **Conclusion**: SQLite won't work on Vercel

### The Solution

**Neon PostgreSQL**:
- Always-on database server (not serverless)
- Accessed over network (no filesystem needed)
- Connection pooling handles multiple serverless functions
- Data persists between deployments

### Why Not GitHub Pages?

**GitHub Pages Limitation**:
- Static hosting only (HTML, CSS, JS files)
- Cannot run server-side code
- No Node.js runtime
- No API routes
- **Conclusion**: Can't run Next.js on GitHub Pages

### The Full Stack

```
Squarespace DNS → Vercel (Next.js server) → Neon (PostgreSQL database)
       ↑                     ↑                        ↑
   Your domain        Runs server code          Stores data
```

---

**END OF DOCUMENTATION**

**Last Updated**: October 28, 2025
**Next Session**: Continue with Vercel deployment (setup account, import repo, configure env vars)
**Blocking Issues**: None - migration complete, ready to deploy
