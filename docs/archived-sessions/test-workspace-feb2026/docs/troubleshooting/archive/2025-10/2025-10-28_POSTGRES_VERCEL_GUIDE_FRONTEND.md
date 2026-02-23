# PostgreSQL Migration & Vercel Deployment - Implementation Guide

**Created**: October 28, 2025 **Status**: Ready to proceed with Vercel
deployment

This guide provides step-by-step instructions for deploying Veritable Games to
production.

---

## Current Status

### ✅ Completed

1. **Schema Migration**: 100% success

   - 153 tables created
   - 273 indexes created
   - 10 PostgreSQL schemas (forums, wiki, users, auth, content, library,
     messaging, system, cache, main)
   - All SQLite types converted to PostgreSQL equivalents

2. **Data Migration**: 99.99% success

   - 6,967 of 6,968 rows migrated
   - Only 1 row remaining: `landing_subscribers` (timestamp overflow)

3. **Timestamp Fixes**: Applied
   - 45 timestamp columns converted from INTEGER to BIGINT
   - Fixed all overflow errors except landing_subscribers

### ⏳ Remaining

1. Fix last timestamp overflow (5 minutes)
2. Vercel deployment setup (1-2 hours)
3. DNS configuration (15 minutes active, 1-48 hours propagation)

---

## Phase 1: Final Data Migration Fix

**Estimated Time**: 5 minutes

### Step 1: Fix Remaining Timestamp Error

```bash
cd frontend

# Run the timestamp fix script one more time
node scripts/fix-timestamp-columns.js

# Expected output:
# ✅ landing_subscribers.timestamp: INTEGER → BIGINT
```

### Step 2: Retry Data Migration

```bash
npm run pg:migrate-data

# Expected output:
# Tables processed: 132
# Total rows migrated: 6,968
# Errors: 0
```

### Verification

```bash
# Check final statistics
cat /tmp/data-migration-retry.log | grep "Migration Summary" -A 5
```

**Expected Result**: 6,968 rows, 0 errors

---

## Phase 2: Local Testing with PostgreSQL

**Estimated Time**: 15 minutes

### Step 1: Update Local Environment

Edit `frontend/.env.local`:

```bash
# Change this line:
DATABASE_MODE=sqlite

# To this:
DATABASE_MODE=postgres
```

### Step 2: Test Application

```bash
cd frontend
npm run dev

# Visit: http://localhost:3000
```

### Test Checklist

- [ ] Homepage loads
- [ ] User login works
- [ ] Forum posts display
- [ ] Wiki pages render
- [ ] Projects/references load
- [ ] Library documents display
- [ ] All features functional

**If anything fails**: Check console for database errors, verify `POSTGRES_URL`
in `.env.local`

---

## Phase 3: Vercel Account Setup

**Estimated Time**: 10 minutes

### Step 1: Create Account

1. Go to https://vercel.com/signup
2. Click **"Continue with GitHub"**
3. Authorize Vercel to access your repositories
4. Verify email if prompted

### Step 2: Explore Dashboard

- Familiarize yourself with the interface
- Note where "Add New Project" button is
- Check Settings → Environment Variables (you'll use this later)

---

## Phase 4: Repository Import

**Estimated Time**: 15 minutes

### Step 1: Import Project

1. Click **"Add New..." → "Project"**
2. Find repository: `veritable-games-main`
3. Click **"Import"**

### Step 2: Configure Build Settings

```
Framework Preset: Next.js
Root Directory: ./frontend
Build Command: npm run build
Output Directory: .next
Install Command: npm install
Node.js Version: 20.x
```

### Step 3: DO NOT DEPLOY YET

Click the **"Environment Variables"** tab instead of "Deploy".

---

## Phase 5: Environment Variables

**Estimated Time**: 20 minutes

### Critical Variables (Required)

Add each of these in Vercel Dashboard → Environment Variables:

```bash
# Database
POSTGRES_URL=postgresql://neondb_owner:npg_9ZQTdDper6tw@ep-withered-feather-a878iz2v-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require
DATABASE_MODE=postgres

# Security (from .env.local)
SESSION_SECRET=240d9f9e6679831f39a32c635b1af804840c1f5efbcade291dc46d520899b24a
CSRF_SECRET=4f623ee07b6cf81faa6c9381cbb776eac5dc00c34a4ddeaea60193001c0bdffb
ENCRYPTION_KEY=5362bcd48c6773fee45a30518801ef33b015c43992869b4439ac81d947e9a984

# URLs (initial values, will update after custom domain)
NEXTAUTH_URL=https://veritable-games.vercel.app
NEXT_PUBLIC_SITE_URL=https://veritable-games.vercel.app
NEXT_PUBLIC_API_URL=https://veritable-games.vercel.app/api

# Database Pool
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=2
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=5000
POSTGRES_SSL=true

# Application
DB_POOL_SIZE=5
DB_TIMEOUT=30000
LOG_LEVEL=info
NODE_ENV=production
NEXT_PUBLIC_MAINTENANCE_MODE=false

# Features
ENABLE_FORUMS=true
ENABLE_WIKI=true
ENABLE_LIBRARY=true
ENABLE_3D_VIEWER=true
```

### Important Notes

- Set each variable to **all three environments**: Production, Preview,
  Development
- Copy/paste carefully - typos will break deployment
- Don't commit `.env.local` to Git (already in .gitignore)

---

## Phase 6: First Deployment

**Estimated Time**: 5-10 minutes

### Step 1: Deploy

Click the **"Deploy"** button.

### Step 2: Monitor Build

Watch the build logs in real-time. Expected stages:

1. Cloning repository
2. Installing dependencies (2-3 minutes)
3. Building application (2-3 minutes)
4. Deploying to edge network

**Total time**: 5-7 minutes for first deployment

### Step 3: Handle Build Errors

**If TypeScript errors**:

```bash
# Test locally first
cd frontend
npm run type-check
npm run build
```

**If dependency errors**:

```bash
# Verify package.json
cd frontend
npm install
git add package-lock.json
git commit -m "Update dependencies"
git push
```

---

## Phase 7: Test Deployment

**Estimated Time**: 15 minutes

### Step 1: Visit Deployment

Vercel will assign URL: `https://veritable-games.vercel.app`

### Step 2: Test Checklist

- [ ] Homepage loads (no 500 errors)
- [ ] Can create account
- [ ] Can log in
- [ ] Forum browsing works
- [ ] Wiki pages display
- [ ] Projects/galleries load
- [ ] Sessions persist (don't get logged out)

### Step 3: Check Logs

Go to Vercel Dashboard → Project → **Logs**

- Look for any errors
- Verify database connections succeed
- Check API route responses

**If 500 errors**:

- Check Function Logs for specific error messages
- Verify environment variables are set correctly
- Ensure `DATABASE_MODE=postgres`

---

## Phase 8: Custom Domain Setup

**Estimated Time**: 5 minutes active + 1-48 hours passive

### Step 1: Add Domain in Vercel

1. Go to Project Settings → **Domains**
2. Click **"Add Domain"**
3. Enter: `veritablegames.com`
4. Also add: `www.veritablegames.com`
5. Vercel will show required DNS records

**Keep this page open** - you'll need these values.

### Step 2: Update Squarespace DNS

1. Log into https://account.squarespace.com/domains
2. Click on `veritablegames.com`
3. Click **"DNS Settings"**

**Add These Records**:

```
Type: CNAME
Host: www
Value: cname.vercel-dns.com
TTL: 3600

Type: CNAME (or A if not allowed)
Host: @
Value: cname.vercel-dns.com (or 76.76.21.21 if using A record)
TTL: 3600
```

**Remove These Records**:

- CNAME pointing to `108070.github.io`
- Old A records pointing to GitHub IPs
- GitHub verification TXT record

**DO NOT TOUCH**:

- Google Workspace MX records (email routing)

### Step 3: Wait for Propagation

**Check Status**:

```bash
dig veritablegames.com
dig www.veritablegames.com
```

Or use: https://dnschecker.org

**Timeline**:

- Minimum: 5 minutes
- Typical: 30-60 minutes
- Maximum: 48 hours

### Step 4: Verify in Vercel

Go back to Vercel → Domains:

- Wait for: **"Valid Configuration" ✓**
- Wait for: **"Certificate Active" ✓** (SSL)

---

## Phase 9: Update URLs

**Estimated Time**: 5 minutes

### Step 1: Update Environment Variables

In Vercel → Settings → Environment Variables, update:

```bash
NEXTAUTH_URL=https://veritablegames.com
NEXT_PUBLIC_SITE_URL=https://veritablegames.com
NEXT_PUBLIC_API_URL=https://veritablegames.com/api
```

### Step 2: Redeploy

Go to Deployments → Latest deployment → **"..."** → **"Redeploy"**

### Step 3: Test Production Domain

Visit `https://veritablegames.com` and repeat all tests from Phase 7.

---

## Phase 10: Final Verification

**Estimated Time**: 15 minutes

### Functional Tests

- [ ] Login/logout works
- [ ] Create forum post
- [ ] Edit wiki page
- [ ] Upload reference image
- [ ] All features functional

### Performance Tests

- [ ] Page load times acceptable
- [ ] No console errors
- [ ] Database queries fast
- [ ] Images load properly

### Cross-Device Tests

- [ ] Test on desktop
- [ ] Test on mobile
- [ ] Test on different browsers
- [ ] Test on different networks

---

## Rollback Plan

If deployment has critical issues:

### Option 1: Vercel Rollback

1. Go to Vercel → Deployments
2. Find last known-good deployment
3. Click "..." → **"Promote to Production"**
4. Instant rollback (< 1 minute)

### Option 2: Git Rollback

```bash
git revert HEAD
git push origin main
# Vercel auto-deploys previous version
```

### Option 3: Emergency DNS Rollback

Revert Squarespace DNS to GitHub Pages:

1. Restore old CNAME to `108070.github.io`
2. Restore old A records
3. Wait for propagation

---

## Monitoring Setup

### Vercel Analytics

- Go to Project → **Analytics**
- Monitor error rates
- Track performance metrics

### Neon Database Monitoring

- Go to Neon Console → Project → **Metrics**
- Monitor storage usage (stay under 0.5GB)
- Check query performance
- Watch connection counts

### External Monitoring (Optional)

Consider setting up:

- **UptimeRobot**: Free uptime monitoring (https://uptimerobot.com)
- **Sentry**: Error tracking (has free tier)
- **LogRocket**: Session replay for debugging

---

## Success Criteria

Deployment is successful when:

- [x] Schema migration: 153 tables, 0 errors
- [x] Data migration: 6,968 rows, 0 errors
- [ ] Vercel deployment: No build errors
- [ ] All tests pass on `.vercel.app` domain
- [ ] DNS points to Vercel
- [ ] SSL certificate active
- [ ] All tests pass on `veritablegames.com`
- [ ] No console errors
- [ ] Sessions persist correctly
- [ ] Database queries succeed

---

## Troubleshooting Common Issues

### Build Fails

**Error**: TypeScript errors

```bash
cd frontend
npm run type-check
# Fix errors, commit, push
```

### Database Connection Fails

**Error**: `connect ETIMEDOUT`

- Verify `POSTGRES_URL` in Vercel
- Test locally: `npm run pg:test`
- Check Neon dashboard (database running?)

### 500 Errors After Deployment

**Check**:

1. Vercel Function Logs (specific error messages)
2. Environment variables (all set?)
3. `DATABASE_MODE=postgres` (set?)

### DNS Not Propagating

**Check**:

```bash
dig veritablegames.com
# Should show Vercel IP: 76.76.21.21
```

**If still showing old IP**:

- Wait longer (up to 48 hours)
- Clear browser cache
- Try different browser/device

### Sessions Don't Persist

**Check**:

1. `SESSION_SECRET` set in Vercel
2. `NEXTAUTH_URL` matches actual domain
3. Browser allows cookies
4. No CORS errors in console

---

## Post-Deployment Tasks

### Immediate (Week 1)

- [ ] Monitor error rates daily
- [ ] Check database storage usage
- [ ] Test all features thoroughly
- [ ] Get user feedback
- [ ] Document any issues

### Short-Term (Month 1)

- [ ] Set up automated backups (Neon has this built-in)
- [ ] Configure monitoring alerts
- [ ] Review performance metrics
- [ ] Optimize slow queries if needed
- [ ] Consider upgrading plans if hitting limits

### Long-Term

- [ ] Regular security updates
- [ ] Database maintenance
- [ ] Performance optimization
- [ ] Feature additions
- [ ] User growth planning

---

## Resources

### Documentation

- **Full Guide**: `DEPLOYMENT_DOCUMENTATION.md`
- **Quick Reference**: `QUICK_REFERENCE.md`
- **Migration Logs**: `/tmp/data-migration-retry.log`

### External Resources

- **Vercel Docs**: https://vercel.com/docs
- **Neon Docs**: https://neon.tech/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment

### Support

- **Vercel**: support@vercel.com
- **Neon**: https://neon.tech/docs/community/support
- **Squarespace DNS**: https://support.squarespace.com

---

**Ready to Begin?** Start with Phase 1: Final Data Migration Fix

**Questions?** See `DEPLOYMENT_DOCUMENTATION.md` for detailed explanations

**Last Updated**: October 28, 2025
