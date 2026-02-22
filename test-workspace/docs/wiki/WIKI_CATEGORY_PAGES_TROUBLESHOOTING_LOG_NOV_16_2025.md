# Wiki Category Pages - Complete Troubleshooting Log

**Issue Date**: November 15-16, 2025
**Status**: 🔴 UNRESOLVED - Category pages still return "This category doesn't exist"
**Severity**: HIGH - Core wiki functionality broken in production

---

## Problem Statement

**Symptoms**:
- ✅ Individual wiki pages work perfectly (e.g., `/wiki/grand-voss-megastructures`)
- ✅ Main wiki page shows all categories correctly
- ❌ Category listing pages return "This category doesn't exist" (e.g., `/wiki/category/noxii`)
- ❌ Browser console shows: `TypeError: can't access property "catch", n() is undefined`

**Environments**:
- ❌ Production (www.veritablegames.com) - BROKEN
- ❌ Direct IP (192.168.1.15:3000) - BROKEN
- ❓ Localhost - NOT TESTED (assumed working based on previous sessions)

---

## What We Know For Sure

### ✅ Data EXISTS in Database

**Verified November 16, 2025, 07:00 UTC:**

```sql
-- Categories exist
SELECT id, name FROM wiki.wiki_categories ORDER BY sort_order;
-- Returns: 15 rows (noxii, autumn, cosmic-knights, dodec, etc.)

-- NOXII category has pages
SELECT COUNT(*) FROM wiki.wiki_pages WHERE category_id = 'noxii';
-- Returns: 44 pages

-- The exact query used by getCategoryById works
SELECT c.*, COUNT(p.id) as page_count
FROM wiki.wiki_categories c
LEFT JOIN wiki.wiki_pages p ON c.id = p.category_id
WHERE c.id = 'noxii'
GROUP BY c.id;
-- Returns: 1 row (NOXII with 44 pages)
```

**Conclusion**: This is NOT a missing data problem.

### ✅ Architecture Flow

**Request Path**:
```
Browser: www.veritablegames.com/wiki/category/noxii
  ↓
Cloudflare (DNS + CDN)
  ↓
Traefik Reverse Proxy (192.168.1.15:80)
  ↓
Docker Container (m4s0kwo4kc4oooocck4sswc4:3000)
  ↓
Next.js Server (production mode)
  ↓
Route Handler: /app/wiki/category/[id]/page.tsx
  ↓
getCategoryData(categoryId)
  ↓
WikiService.getCategoryById(categoryId)
  ↓
WikiCategoryService.getCategoryById(categoryId)
  ↓
dbAdapter.query(..., { schema: 'wiki' })
  ↓
PostgreSQL: veritable-games-postgres:5432
  ↓
❌ SOMETHING FAILS HERE
```

### ✅ Browser Evidence

**Response Headers** (from user's browser):
```
x-nextjs-cache: HIT
x-nextjs-prerender: 1
```

**Interpretation**: Pages are being PRERENDERED and cached, not rendered server-side per request.

**Browser Console Errors**:
```javascript
TypeError: can't access property "catch", n() is undefined
index.js:1:1108
```

**Interpretation**: React hydration error - server-rendered HTML doesn't match client expectations.

---

## What We've Tried (Chronological)

### Attempt 1: Initial Investigation (Nov 15-16, 06:00 UTC)
**Hypothesis**: Categories missing from database
**Actions**:
- Checked database directly
- Found categories exist (15 rows)
- Found pages exist (176 rows, 44 for NOXII)

**Result**: ❌ Hypothesis WRONG - data exists

### Attempt 2: Seed Script Creation (Nov 16, 06:15 UTC)
**Hypothesis**: Need to ensure categories are seeded
**Actions**:
- Created `frontend/scripts/wiki/seed-categories.js`
- Script inserts 10 predefined categories with ON CONFLICT DO UPDATE
- Added npm script: `npm run wiki:seed-categories`
- Commit: `1e021d5`

**Result**: ✅ Script created, BUT categories already existed, so had no effect

### Attempt 3: Remove Excess Debug Code (Nov 16, 06:48 UTC)
**Hypothesis**: Previous diagnostic commits interfering
**Actions**:
- Removed excessive `console.log` statements
- Removed test API endpoint `/api/wiki/categories/test`
- Kept only `dynamic = 'force-dynamic'` export
- Removed: `revalidate`, `dynamicParams`, `fetchCache` exports
- Commit: `a074b48`

**Result**: ❌ Still broken

### Attempt 4: Force Server-Side Rendering (Nov 16, 07:05 UTC)
**Hypothesis**: Next.js prerendering pages at build time with no database access
**Evidence**: Response headers show `x-nextjs-prerender: 1`
**Actions**:
- Added `export const runtime = 'nodejs'`
- Added `export const revalidate = 0`
- Commit: `6d04e14`

**Result**: ❌ Still broken - headers still show prerender

### Attempt 5: Add Detailed Logging (Nov 16, 07:10 UTC)
**Hypothesis**: Need to see actual errors from server
**Actions**:
- Added comprehensive logging to `WikiCategoryService.getCategoryById()`
- Logs: function call, query result count, category found/not found
- Commit: `12b4c99`

**Result**: ⏳ Deployed, awaiting logs - but logs show nothing (function not being called)

---

## Current Understanding

### The Mystery

**What makes NO sense**:
1. ✅ Database has categories (verified with direct SQL)
2. ✅ Direct SQL queries work perfectly
3. ✅ Individual wiki pages work (same database, same connection)
4. ✅ Main wiki page shows categories (uses `getAllCategories()`)
5. ❌ Category listing pages fail (uses `getCategoryById()`)

**The Disconnect**:
- `getAllCategories()` works → Shows categories on main page
- `getCategoryById()` fails → Shows "Category not found"
- Both query the SAME table (`wiki.wiki_categories`)
- Both use the SAME database adapter
- Both should query the SAME PostgreSQL instance

### Critical Clues

**Clue 1: Prerendering**
```
x-nextjs-prerender: 1
```
This means:
- Pages are generated at BUILD TIME (when database may not exist)
- Cached "Category Not Found" error pages served to users
- Even with `dynamic = 'force-dynamic'`, Next.js ignores it

**Clue 2: React Hydration Error**
```javascript
TypeError: can't access property "catch", n() is undefined
```
This means:
- Server-rendered HTML shows "Category Not Found"
- Client-side JavaScript expects different structure
- Hydration fails trying to reconcile the difference

**Clue 3: No Server Logs**
```bash
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100 | grep WikiCategory
# Returns nothing
```
This means:
- `getCategoryById()` is NOT being called at runtime
- Confirms pages are prerendered, not server-side rendered
- Diagnostic logging we added never executes

---

## Previous Investigation (Nov 14-15)

**From WIKI_PRODUCTION_ISSUE.md** (November 15):

### What Was Tried Before
1. **Add wiki import to startup script** - ❌ CRASHED PRODUCTION
   - Blocked health checks
   - Container marked as `exited:unhealthy`
   - Reverted immediately

2. **Lazy import on first access** - ⏳ PROPOSED (not implemented)
   - Check if wiki pages exist
   - Import from markdown if missing
   - Self-healing approach

3. **Admin API endpoint for manual import** - ⏳ PROPOSED (not implemented)
   - `/api/admin/wiki/import` endpoint
   - Manual trigger after deployment
   - Requires authentication

### Previous Hypotheses (Nov 15)
1. ✅ Database Connection Mismatch - RULED OUT (verified connection string)
2. ✅ Caching Issue (Cloudflare/Traefik) - RULED OUT (direct IP also fails)
3. ⏳ Query Execution Error - POSSIBLE (but direct queries work)
4. ✅ Table/Schema Missing - RULED OUT (tables exist, have data)

**From WIKI_CATEGORY_PRODUCTION_BUG_ANALYSIS.md** (November 14):

### Root Cause (OUTDATED - No Longer Valid)
**Original diagnosis**: Missing wiki_categories data in PostgreSQL

**Evidence that this was WRONG**:
- November 16 database check shows 15 categories exist
- NOXII has 44 pages
- Categories were seeded between Nov 14-16

**Current status**: Categories exist, but pages still fail - NEW root cause needed

---

## Hypotheses Still Being Investigated

### Hypothesis A: Build-Time Static Generation (MOST LIKELY)
**Theory**: Next.js generates static pages at build time when database is unavailable

**Evidence**:
- ✅ Response headers: `x-nextjs-prerender: 1`
- ✅ No server logs (function never called)
- ✅ Hard refresh doesn't help (cached error served)

**What would fix it**:
- Disable static generation entirely for category routes
- Force server-side rendering on every request
- Ensure database is accessible during build

**What we tried**:
- ❌ `export const dynamic = 'force-dynamic'` - IGNORED
- ❌ `export const runtime = 'nodejs'` - IGNORED
- ❌ `export const revalidate = 0` - IGNORED

**What we haven't tried**:
- ⏳ `export const dynamicParams = true` (for dynamic routes)
- ⏳ `export const dynamic = 'force-dynamic'` at layout level (not just page)
- ⏳ Disable ISR/SSG in next.config.js
- ⏳ Clear Next.js build cache and rebuild

### Hypothesis B: Next.js Build Cache Corruption
**Theory**: Build cache contains old "Category Not Found" pages

**Evidence**:
- Changes deployed but behavior unchanged
- Multiple deploys show same symptoms

**What would fix it**:
- Clear `.next/` directory on server
- Force clean rebuild
- Disable build cache in Coolify

**What we tried**:
- ❌ Redeployment (Coolify rebuilds, but may use cache)

**What we haven't tried**:
- ⏳ `rm -rf .next/` on server before build
- ⏳ Set `NEXT_DISABLE_CACHE=1` in build environment
- ⏳ Coolify: Delete and recreate application (nuclear option)

### Hypothesis C: Database Connection During Build
**Theory**: Database not accessible during Coolify build phase

**Evidence**:
- Build happens in isolated container
- PostgreSQL may not be networked during build
- Build-time rendering needs database access

**What would fix it**:
- Connect to database during build (risky)
- OR disable build-time prerendering entirely

**What we tried**:
- ❌ Runtime config changes (doesn't affect build)

**What we haven't tried**:
- ⏳ Check Coolify build logs for database connection errors
- ⏳ Provide DATABASE_URL as build-time environment variable
- ⏳ Disable prerendering in next.config.js

### Hypothesis D: Route Configuration Issue
**Theory**: Dynamic route `[id]` not properly configured for server-side rendering

**Evidence**:
- Individual pages work (static route: `/wiki/[slug]`)
- Category pages fail (nested dynamic: `/wiki/category/[id]`)

**What would fix it**:
- generateStaticParams() with empty array (disable pregeneration)
- Force all [id] params to be server-side only

**What we tried**:
- ❌ `dynamicParams` export (removed, should be kept)

**What we haven't tried**:
- ⏳ Add `export async function generateStaticParams() { return []; }`
- ⏳ Check if other dynamic routes have same issue

---

## Diagnostic Commands

### Database Verification
```bash
# Connect to production database
docker exec veritable-games-postgres psql -U postgres -d veritable_games

# Check categories exist
SELECT id, name, (SELECT COUNT(*) FROM wiki.wiki_pages WHERE category_id = wiki_categories.id) as page_count
FROM wiki.wiki_categories
ORDER BY sort_order;

# Test the exact query used by getCategoryById
SELECT c.*, COUNT(p.id) as page_count
FROM wiki.wiki_categories c
LEFT JOIN wiki.wiki_pages p ON c.id = p.category_id
WHERE c.id = 'noxii'
GROUP BY c.id;
```

### Container Verification
```bash
# Check deployed commit
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT

# Check environment variables
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep -i database

# Check server logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 200

# Check for WikiCategory logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 200 2>&1 | grep -i "WikiCategory\|category\|error"
```

### Build Cache Verification
```bash
# Check if .next directory exists in container
docker exec m4s0kwo4kc4oooocck4sswc4 ls -la /app/.next/ 2>/dev/null || echo "Not found"

# Check for prerendered pages
docker exec m4s0kwo4kc4oooocck4sswc4 ls -la /app/.next/server/app/wiki/category/ 2>/dev/null || echo "Not found"
```

### Coolify Build Logs
```bash
# Check recent deployments
coolify deploy list --limit 5

# Get specific deployment logs (replace UUID)
coolify deploy get <deployment_uuid>
```

---

## Next Steps (Priority Order)

### 🔴 CRITICAL - Immediate Actions

1. **Check Build Logs**
   ```bash
   # Get latest deployment logs
   coolify deploy list --limit 1
   # Look for database connection errors during build
   ```

2. **Add generateStaticParams()**
   ```typescript
   // In /app/wiki/category/[id]/page.tsx
   export async function generateStaticParams() {
     return []; // Disable static pregeneration
   }
   ```

3. **Check Container File System**
   ```bash
   # See if prerendered pages exist
   docker exec m4s0kwo4kc4oooocck4sswc4 find /app/.next -name "*category*" -type f 2>/dev/null
   ```

### 🟡 HIGH PRIORITY - Investigation

4. **Test Localhost**
   - Verify category pages work on localhost:3000
   - If they work locally → confirms production-specific issue
   - If they fail locally → code/architecture issue

5. **Clear Build Cache**
   ```bash
   # Nuclear option - delete and rebuild
   coolify deploy uuid m4s0kwo4kc4oooocck4sswc4 --no-cache
   ```

6. **Check Next.js Config**
   - Review `next.config.js` for ISR/SSG settings
   - Look for `output: 'standalone'` or `output: 'export'`
   - Check for any caching directives

### 🟢 MEDIUM PRIORITY - Alternative Solutions

7. **Implement Lazy Import** (from Nov 15 proposal)
   - Add lazy import check on first category access
   - Self-healing if categories missing
   - Fallback solution if rendering can't be fixed

8. **Create Admin Import Endpoint** (from Nov 15 proposal)
   - `/api/admin/wiki/import` endpoint
   - Manual trigger for wiki data sync
   - Safety net for future deployments

---

## Success Criteria

When this is fixed, we should see:

### User Experience
- ✅ Category pages load correctly (https://www.veritablegames.com/wiki/category/noxii)
- ✅ All 44 NOXII pages listed
- ✅ No "Category Not Found" errors
- ✅ No React hydration errors in browser console

### Technical Verification
- ✅ Response headers show `x-nextjs-cache: MISS` (not cached)
- ✅ Response headers do NOT show `x-nextjs-prerender: 1`
- ✅ Server logs show `[WikiCategoryService.getCategoryById]` being called
- ✅ Hard refresh serves fresh data from database

### Performance
- ✅ Category pages load in <500ms
- ✅ No database connection errors
- ✅ Consistent behavior across all categories

---

## Historical Context

**Timeline**:
- **November 5, 2025**: Production deployment completed
- **November 8, 2025**: Wiki category bug first reported
- **November 9, 2025**: Multiple fix attempts (didn't address root cause)
- **November 14, 2025**: Root cause analysis (incorrectly identified as missing data)
- **November 15, 2025**: Extensive troubleshooting, startup script crashed production
- **November 16, 2025**: Discovered categories exist, issue is caching/prerendering

**Related Documentation**:
- [WIKI_PRODUCTION_ISSUE.md](./WIKI_PRODUCTION_ISSUE.md) - November 15 investigation
- [WIKI_CATEGORY_PRODUCTION_BUG_ANALYSIS.md](./WIKI_CATEGORY_PRODUCTION_BUG_ANALYSIS.md) - November 14 analysis
- [WIKI_BUG_INVESTIGATION_INDEX.md](./WIKI_BUG_INVESTIGATION_INDEX.md) - Complete investigation index

**Key Learnings**:
1. Database has data - verified multiple times
2. Direct SQL queries work perfectly
3. Issue is in rendering/caching layer, not data layer
4. Next.js prerendering is the likely culprit
5. Build cache may need to be cleared
6. Previous diagnoses were incorrect (categories exist)

---

**Last Updated**: November 16, 2025, 07:45 UTC
**Status**: Active investigation - prerendering hypothesis being tested
**Next Review**: After generateStaticParams() implementation and cache clear
