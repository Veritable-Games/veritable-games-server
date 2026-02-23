# Wiki Pages Production Issue: Investigation & Solution Planning

**Issue Date**: November 15, 2025
**Status**: Under Investigation
**Severity**: High (Wiki pages inaccessible in production)

---

## Problem Statement

Wiki pages work perfectly on **localhost (192.168.1.175)** but return **"Category Not Found"** errors on **production (www.veritablegames.com)**.

- **Localhost**: All 174 wiki pages accessible, all categories working
- **Production**: Shows "Category Not Found" for all categories
- **Direct IP**: Not yet tested (192.168.1.15:3000)

---

## Critical Discovery

**The production PostgreSQL database ALREADY HAS 176 wiki pages across 14 categories!**

This is NOT a missing data problem. The data exists in production:
- ✅ 176 wiki pages in `wiki.wiki_pages` table
- ✅ 14 categories in `wiki.wiki_categories` table
- ✅ 174 markdown files in production container at `/app/content/wiki/`
- ✅ Full schema with all expected columns

**The real problem**: Route handlers are failing to query this data successfully.

---

## What We've Tried

### Attempt 1: Add Wiki Import to Startup Script ❌ FAILED

**What we did**:
1. Modified `frontend/package.json` start script
2. Changed: `"start": "node scripts/migrations/fix-truncated-password-hashes.js && next start"`
3. To: `"start": "node scripts/migrations/fix-truncated-password-hashes.js && node scripts/wiki/import-from-markdown.js && next start"`
4. Committed and pushed (commit `9598ae7`)
5. Coolify detected change and started new deployment

**Why it failed**:
- Wiki import takes 2-5 minutes for 174 pages
- Next.js startup health checks have shorter timeout (typically 30-60 seconds)
- Container marked as `exited:unhealthy` before import could complete
- Result: **Production went down with 500 error in Coolify UI**

**Error message**:
```
Coolify 500 Error:
"unserialize(): Error at offset 0 of 76 bytes"
(PHP serialization error in Coolify's LiveWire config)

Container status: exited:unhealthy
```

**What we learned**:
- ❌ Never add long-running tasks to startup script (blocks health checks)
- ❌ Import script is too slow for synchronous startup execution
- ✅ Blocking startup immediately crashes production

### Attempt 2: Revert the Change ✅ PARTIAL SUCCESS

**What we did**:
1. Immediately reverted the startup script change (commit `2e56537`)
2. Pushed revert to GitHub
3. Coolify detected change and started rebuilding

**Status**:
- Production should come back online (3-5 minute rebuild)
- Wiki issue still unresolved (no data import)

---

## Investigation Findings

### Database State Analysis

**Production PostgreSQL (verified working)**:
```sql
-- This query works on production
SELECT c.id, c.name, COUNT(p.id) as page_count
FROM wiki.wiki_categories c
LEFT JOIN wiki.wiki_pages p ON c.id = p.category_id
WHERE c.id = 'cosmic-knights'
GROUP BY c.id

-- Result: cosmic-knights category exists with 21 pages
```

**Data verification**:
- Archive (8 pages)
- Autumn (13 pages)
- Cosmic-Knights (21 pages)
- Dodec (19 pages)
- Journals (18 pages)
- Noxii (15 pages)
- On-Command (22 pages)
- Systems (20 pages)
- Tutorials (12 pages)
- Plus 5 additional categories: uncategorized, community, development, modding, project-coalesce

**Total: 176 pages in 14 categories**

### Code Analysis

**Route Handler** (`frontend/src/app/wiki/category/[id]/page.tsx`):
```typescript
async function getCategoryData(categoryId: string) {
  const wikiService = new WikiService();

  try {
    const [category, pages] = await Promise.all([
      wikiService.getCategoryById(categoryId),  // THIS THROWS ERROR
      wikiService.getAllPages(categoryId),
    ]);
    return { category, pages, subcategories };
  } catch (error) {
    console.error('Error loading category data:', error);  // SILENT ERROR
    return { category: null, pages: [], subcategories: [] };
  }
}

// Later:
if (!category) {
  return <div>This category doesn't exist</div>;  // Shows this error
}
```

**Problem**: Error is caught silently and logged to Docker console (not visible to user). Only shows "Category Not Found".

**WikiCategoryService** (`frontend/src/lib/wiki/services/WikiCategoryService.ts`):
```typescript
async getCategoryById(categoryId: string): Promise<WikiCategory> {
  const result = await dbAdapter.query(
    `SELECT c.*, COUNT(p.id) as page_count
     FROM wiki_categories c
     LEFT JOIN wiki_pages p ON c.id = p.category_id
     WHERE c.id = $1
     GROUP BY c.id`,
    [categoryId],
    { schema: 'wiki' }  // Specifies wiki schema
  );

  if (result.rows.length === 0) {
    throw new Error(`Category not found: "${categoryId}"`);
  }
  return result.rows[0];
}
```

### Architecture: Localhost vs Production

**Localhost Data Flow** (WORKS):
```
Browser: http://localhost:3000/wiki/category/cosmic-knights
  ↓
Next.js Dev Server (Turbopack)
  ↓
Route Handler: /app/wiki/category/[id]/page.tsx
  ↓
WikiService.getCategoryById('cosmic-knights')
  ↓
dbAdapter.query(..., { schema: 'wiki' })
  ↓
SQLite: frontend/data/wiki.db (locally populated with 174 pages)
  ↓
Result: { id: 'cosmic-knights', name: 'COSMIC KNIGHTS', page_count: 21 }
  ↓
✅ Success: Renders category page with 21 pages
```

**Production Data Flow** (FAILS):
```
Browser: https://www.veritablegames.com/wiki/category/cosmic-knights
  ↓
Cloudflare (DNS + CDN)
  ↓
Traefik Reverse Proxy (192.168.1.15:80)
  ↓
Docker Container (m4s0kwo4kc4oooocck4sswc4:3000)
  ↓
Next.js Production Server
  ↓
Route Handler: /app/wiki/category/[id]/page.tsx
  ↓
WikiService.getCategoryById('cosmic-knights')
  ↓
dbAdapter.query(..., { schema: 'wiki' })
  ↓
PostgreSQL: veritable-games-postgres-new:5432
  ↓
❌ Query fails or returns empty (even though data exists)
  ↓
catch (error) { return { category: null, ... } }
  ↓
Shows: "Category Not Found"
```

### Most Likely Root Causes

**Hypothesis 1: Database Connection Mismatch** (MOST LIKELY)
- Production app might be connecting to wrong PostgreSQL instance
- Or using fallback connection string
- Need to verify: `echo $DATABASE_URL` in production container

**Hypothesis 2: Caching Issue**
- Cloudflare or Traefik caching old "not found" responses
- Direct IP test would confirm: `http://192.168.1.15:3000/wiki/category/cosmic-knights`
- If IP works but domain doesn't → caching issue

**Hypothesis 3: Query Execution Error**
- Schema routing problem in database adapter
- Query timing issue (health check running before connections ready)
- Connection pool issues under load

**Hypothesis 4: Table/Schema Missing**
- Unlikely (we verified data exists) but possible
- `wiki` schema might not exist OR tables might be in wrong schema
- Need to check: `SELECT * FROM information_schema.tables WHERE table_schema = 'wiki'`

---

## Alternative Solutions Being Considered

### Solution A: Lazy Import on First Access ⭐ RECOMMENDED

**Concept**: Check if wiki pages exist on first wiki route access, import if missing.

**Pros**:
- ✅ No startup delay
- ✅ Self-healing (auto-imports if missing)
- ✅ Works for fresh deployments
- ✅ Can't block health checks
- ✅ Clean and simple

**Cons**:
- First wiki access slightly slower (one-time cost)
- Requires singleton state management

**Implementation**:
```typescript
// frontend/src/lib/wiki/lazy-import.ts
let importCompleted = false;
let importInProgress = false;

export async function ensureWikiPagesImported() {
  if (importCompleted) return;
  if (importInProgress) {
    while (importInProgress) await new Promise(r => setTimeout(r, 100));
    return;
  }

  importInProgress = true;
  try {
    const result = await dbAdapter.query(
      'SELECT COUNT(*) as count FROM wiki_pages',
      [], { schema: 'wiki' }
    );

    if (parseInt(result.rows[0].count) === 0) {
      console.log('[Wiki] Importing pages from markdown...');
      await importWikiPagesFromMarkdown();
      console.log('[Wiki] Import complete');
    }

    importCompleted = true;
  } catch (error) {
    console.error('[Wiki] Import failed:', error);
  } finally {
    importInProgress = false;
  }
}

// Usage in route handler (add to top of getCategoryData):
await ensureWikiPagesImported();
```

### Solution B: API Endpoint for Manual Import ✅ GOOD FALLBACK

**Concept**: Admin-only API endpoint to trigger wiki import manually.

**Pros**:
- ✅ Full control over when import runs
- ✅ Can be triggered multiple times
- ✅ Easy to debug
- ✅ No startup delay
- ✅ Can be called from Coolify webhook

**Cons**:
- Requires manual intervention after deployment
- Easy to forget

**Implementation**:
```typescript
// frontend/src/app/api/admin/wiki/import/route.ts
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const result = await importWikiPagesFromMarkdown();
    return NextResponse.json({
      success: true,
      pagesImported: result.count,
      timestamp: new Date()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
```

**Usage**:
```bash
curl -X POST https://www.veritablegames.com/api/admin/wiki/import \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json"
```

### Solution C: Background Task After Startup

**Concept**: Start Next.js immediately, launch import in background worker.

**Pros**:
- ✅ No startup delay
- ✅ Doesn't block health checks
- ✅ Automatic

**Cons**:
- Complex forked process management
- Harder to debug
- May interfere with container shutdown
- Not guaranteed to complete before first request

**Implementation**: Uses `child_process.fork()` with detached processes

### Solution D: Database Init Check with Timeout

⚠️ **NOT RECOMMENDED** - This is what caused the crash earlier

Runs import during startup with timeout, but:
- Still blocks startup (though less than synchronous)
- Health check timeouts still likely
- Too risky

---

## Recommended Approach

### Phase 1: Diagnose Root Cause (5 minutes)

**Run these diagnostic commands** (once production is back online):

```bash
# 1. Check DATABASE_URL in production
ssh user@192.168.1.15 "docker exec m4s0kwo4kc4oooocck4sswc4 printenv | grep DATABASE"

# 2. Test direct IP access (bypasses Cloudflare/Traefik)
curl -I http://192.168.1.15:3000/wiki/category/cosmic-knights

# 3. Check recent container logs
ssh user@192.168.1.15 "docker logs m4s0kwo4kc4oooocck4sswc4 --tail 500 2>&1" | grep -i "wiki\|category\|error"

# 4. Verify PostgreSQL schema exists
ssh user@192.168.1.15 "docker exec m4s0kwo4kc4oooocck4sswc4 node -e \"
const pg = require('pg');
const client = new pg.Client(process.env.DATABASE_URL);
client.connect().then(() => {
  client.query(
    \\\`SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'wiki' LIMIT 5\\\`
  ).then(res => {
    console.log('Wiki tables:', res.rows.map(r => r.table_name).join(', '));
    client.end();
  });
});
\""
```

**Expected Results**:
- If direct IP works but domain doesn't → Cloudflare/caching issue
- If both fail → Application/database issue
- If database query succeeds → Connection is working

### Phase 2: Implement Safety Net Solutions (1.5 hours)

**Combine Solutions A + B**:
1. Create `lazy-import.ts` for self-healing
2. Create `/api/admin/wiki/import` for manual control
3. Update wiki route handlers to call lazy import
4. Deploy to production
5. Test on localhost first

### Phase 3: Fix Root Cause (Variable)

Based on Phase 1 diagnostics:
- **Connection issue** → Update DATABASE_URL in Coolify
- **Caching issue** → Clear Cloudflare cache / configure Traefik
- **Schema issue** → Fix database adapter routing

---

## Timeline

| Phase | Task | Est. Time |
|-------|------|-----------|
| 0 | Wait for production to come back online (revert deploying) | 5 min |
| 1 | Run diagnostics | 5 min |
| 2a | Create lazy-import.ts service | 20 min |
| 2b | Create admin API endpoint | 15 min |
| 2c | Update route handlers | 10 min |
| 2d | Test on localhost | 15 min |
| 2e | Deploy to production | 5 min |
| 3 | Monitor and verify | 10 min |
| 4 | Fix root cause (if needed) | Variable |

**Total without root cause fix**: ~1.5 hours
**Total with root cause analysis**: ~2 hours

---

## Current Status

**November 15, 2025 - 17:30 UTC**

- ✅ Identified root issue is NOT missing data
- ✅ Reverted failed startup script change (commit `2e56537`)
- ✅ Production in process of redeploying (should be back online soon)
- ⏳ Waiting for production container to restart
- ⏳ Ready to proceed with Solution A + B implementation

---

## Key Learnings

1. **Data exists in production** - Don't waste time on sync, focus on query execution
2. **Blocking startup breaks health checks** - All solutions must be non-blocking
3. **Silent error catching hides problems** - Route handler catches errors without logging them clearly
4. **SQLite vs PostgreSQL difference** - Localhost works because data was populated during dev, production needs explicit import
5. **Git-based workflow is good** - Markdown files are perfect source of truth, just need proper sync mechanism

---

## Success Criteria

Once implemented:
- ✅ Production container starts successfully
- ✅ All 14 wiki categories accessible at https://www.veritablegames.com/wiki
- ✅ All 176 pages load correctly
- ✅ No manual intervention needed (auto-imports on first access)
- ✅ Admin API endpoint available for manual control
- ✅ Clear error logging for troubleshooting
- ✅ No health check timeouts
- ✅ Future deployments work without issues

---

## Next Steps

1. **Wait** for production to come back online
2. **Verify** wiki still doesn't work (confirms revert was successful)
3. **Run diagnostics** to identify root cause
4. **Implement Solutions A + B** (lazy import + API endpoint)
5. **Test** on localhost with empty database
6. **Deploy** to production
7. **Monitor** deployment and test wiki access
8. **Fix root cause** if needed

