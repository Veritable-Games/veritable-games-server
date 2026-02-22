# Wiki Category Pages: Complete Troubleshooting History
## November 13-16, 2025

**Status**: ❌ **STILL BROKEN** after 11 attempted fixes
**User Impact**: All 14 category pages show "This category doesn't exist" despite database containing 174 pages
**Latest Attempt**: Commit ade063f - Stripped pre-rendering config to match working pages - FAILED

---

## The Pattern: Why Every Fix Failed

### Critical Discovery
**API endpoints work ✅ | Web pages broken ❌**

```bash
# This works:
curl https://www.veritablegames.com/api/wiki/categories/on-command
→ Returns: {"success":true,"data":{"name":"ON COMMAND","page_count":39}}

# This fails:
https://www.veritablegames.com/wiki/category/on-command
→ Shows: "This category doesn't exist"
```

**What this tells us:**
- ✅ Database connection works
- ✅ Database contains correct data (39 pages in on-command)
- ✅ `getCategoryById()` works correctly
- ❌ `getAllPages()` returns 0 pages in page component
- ❌ Something is filtering out all pages on the web page route

---

## Timeline of Failed Fixes

### November 13, 2025 - First Attempts

#### Attempt 1: Commit 27aeaba - "Consolidate auth to single source"
**Theory**: Triple auth initialization race condition
**Changes**: Removed module-level auth checks, consolidated to AuthProvider
**Result**: ❌ **FAILED** - Category pages still broken

#### Attempt 2: Commit af569b3 - "Add c.is_public to GROUP BY"
**Theory**: PostgreSQL GROUP BY violation (selecting 9 columns, grouping by 8)
**Changes**: Added `c.is_public` to all GROUP BY clauses in WikiCategoryService
**Result**: ❌ **FAILED** - Still shows "Category Not Found"

#### Attempt 3: Commit 3b629bb - "Use standalone server startup"
**Theory**: `next start` incompatible with `output: 'standalone'`
**Changes**: Changed from `next start` to `node .next/standalone/server.js`
**Result**: ❌ **FAILED** - No effect on category pages

#### Attempt 4: Commit 7eaa39a - "Make wiki publicly accessible"
**Theory**: Middleware blocking wiki routes
**Changes**: Added `/wiki`, `/wiki/category` to PUBLIC_PATHS
**Result**: ❌ **FAILED** - Made wiki public but pages still show error
**Side Effect**: ⚠️ Security vulnerability - exposed wiki without auth

#### Attempt 5: Commit 19b4de4 - "Simplify GROUP BY to primary key"
**Theory**: Modern PostgreSQL allows GROUP BY c.id only
**Changes**: Simplified 6 GROUP BY clauses to use only primary key
**Result**: ❌ **FAILED** - API works, web pages still broken

### November 15, 2025 - Startup Script Crash

#### Attempt 6: Add wiki import to startup - **PRODUCTION CRASH**
**Theory**: Wiki pages need to be imported from markdown on startup
**Changes**: Modified package.json start script to run `import-from-markdown.js`
**Result**: ❌ **CATASTROPHIC FAILURE**
- Import takes 2-5 minutes (too long for health checks)
- Production container marked `exited:unhealthy`
- Site went completely down with 500 error
- **Emergency revert required** (commit 2e56537)

**Lessons learned:**
- Never add long-running tasks to startup script
- Blocking startup crashes production
- Health checks have 30-60 second timeout

### November 16, 2025 (Today) - My Failed Attempts

#### Attempt 7: Commit e3bea67 - "Fix PostgreSQL GROUP BY syntax"
**Theory**: PostgreSQL requires all columns in GROUP BY with SELECT *
**Changes**: Fixed `getCategoryById()` to list all 8 columns in GROUP BY
**Result**: ❌ **FAILED** - SQL works, category pages still show error
**Why I tried this**: Didn't read the previous documentation showing this was already tried

#### Attempt 8: Commit 9399f4a - "Fix ALL PostgreSQL GROUP BY errors"
**Theory**: Multiple methods had same GROUP BY error, fix all 5 methods
**Changes**: Fixed GROUP BY in `getSubcategories()`, `getRootCategories()`, `getCategoryStats()`, `searchCategories()`
**Result**: ❌ **FAILED** - Category pages STILL broken
**Why this was wrong**: Investigation docs explicitly say "Don't assume it's a GROUP BY issue"

### November 16, 2025 (Later Session) - Continued Investigation

#### Attempt 9: Commit 685edca - "Add comprehensive logging to getAllPages()"
**Theory**: Need to see what parameters getAllPages() receives and what it returns
**Changes**: Added extensive debug logging throughout getAllPages() method
- Entry point logging (parameters, userRole type)
- Category filtering logic execution
- Admin-only category filtering decisions
- Final SQL query and parameters
- Database result row count
- Post-formatting page count
- Author lookup results
- Final return value
**Result**: ❌ **FAILED** - Pages still broken, no logs appeared (function never called)
**Why this failed**: Pages are pre-rendered at build time, server code never executes at runtime

#### Attempt 10: User's Fix (Commits after 685edca) - "Add ALL pre-rendering config"
**Theory**: Need to force dynamic rendering with all possible Next.js config options
**Changes**: Added to `/app/wiki/category/[id]/page.tsx`:
- `export const runtime = 'nodejs'`
- `export const dynamicParams = true`
- `export async function generateStaticParams() { return []; }`
- Plus existing `dynamic = 'force-dynamic'` and `revalidate = 0`
**Result**: ❌ **FAILED** - Category pages still show "doesn't exist"
**Evidence**: Response headers still show `x-nextjs-prerender: 1`

#### Attempt 11: Commit ade063f - "Strip pre-rendering config - match working pages"
**Theory**: ADDING config to disable pre-rendering doesn't work - need to REMOVE it entirely
**Reasoning**: Individual wiki pages that WORK (`/wiki/[slug]/page.tsx`) only have minimal config:
- `export const dynamic = 'force-dynamic'`
- `export const revalidate = 0`
**Changes**:
1. Removed ALL extra pre-rendering config from category page
2. Stripped out `runtime`, `dynamicParams`, `generateStaticParams()`
3. Matched minimal config from working pages exactly
4. Also removed debug logging from WikiPageService.ts
**Result**: ❌ **FAILED** - Category pages STILL broken
**Deployed**: Commit ade063f, deployment finished successfully
**Why this failed**: Unknown - even matching working page config doesn't fix it

---

## What We Know For Certain

### ✅ What WORKS

1. **Database has correct data**
   ```sql
   SELECT COUNT(*) FROM wiki.wiki_pages WHERE category_id = 'on-command';
   -- Result: 39 pages
   ```

2. **getCategoryById() returns correct data**
   ```javascript
   await wikiService.getCategoryById('on-command')
   // Returns: { id: 'on-command', name: 'ON COMMAND', page_count: 39 }
   ```

3. **API endpoints work**
   ```bash
   GET /api/wiki/categories/on-command
   # Returns full category data with 39 pages
   ```

4. **SQL queries execute successfully**
   - Tested directly in production container
   - All GROUP BY queries work correctly
   - Returns expected data

### ❌ What FAILS

1. **getAllPages() in page component context**
   ```typescript
   // In /app/wiki/category/[id]/page.tsx:
   const pages = await wikiService.getAllPages(categoryId);
   // Returns: [] (empty array)
   ```

2. **Category web pages**
   ```
   GET /wiki/category/on-command
   Shows: "This category doesn't exist"
   ```

3. **The Promise.all in getCategoryData fails**
   ```typescript
   const [category, pages] = await Promise.all([
     wikiService.getCategoryById(categoryId),  // ✅ Works
     wikiService.getAllPages(categoryId),      // ❌ Returns []
   ]);
   // Result: pages = [], so page shows "doesn't exist"
   ```

---

## The Actual Problem (Still Unidentified)

### What We Know
- The issue is specifically in `getAllPages()` when called from page component
- Same method works in API routes
- Same code works on localhost (SQLite)
- Fails only on production (PostgreSQL) in page context

### Possible Causes (Unproven)

1. **Page filtering too restrictive**
   - getAllPages() may filter by `status = 'published'`
   - All pages might have `status = 'draft'` in production
   - Or `is_public = false`

2. **Server/Client component context**
   - Page component is Server Component
   - API route is different execution context
   - Database adapter might behave differently

3. **Cache returning stale empty data**
   - getAllPages() might be cached
   - Cache was populated when database was empty
   - Never invalidated

4. **Execution context difference**
   - Page render time vs API request time
   - Connection pool initialization
   - Environment variables

---

## Code Paths Comparison

### API Route Path (WORKS ✅)
```
GET /api/wiki/categories/on-command
  ↓
/app/api/wiki/categories/[id]/route.ts
  ↓
wikiCategoryService.getCategoryById('on-command')
  ↓
dbAdapter.query(..., { schema: 'wiki' })
  ↓
PostgreSQL: SELECT ... FROM wiki.wiki_categories
  ↓
Returns: { id: 'on-command', page_count: 39 }
```

### Web Page Path (FAILS ❌)
```
GET /wiki/category/on-command
  ↓
/app/wiki/category/[id]/page.tsx
  ↓
getCategoryData('on-command')
  ↓
Promise.all([
  getCategoryById('on-command'),  // ✅ Returns category
  getAllPages('on-command')       // ❌ Returns []
])
  ↓
if (!category || pages.length === 0)
  return <div>Category doesn't exist</div>
```

---

## Files Involved

### Page Component (Where error manifests)
- `/frontend/src/app/wiki/category/[id]/page.tsx`
  - Line 21-46: `getCategoryData()` function
  - Line 25-28: Promise.all with getCategoryById + getAllPages
  - Line 119-154: Error message "Category Not Found"

### Service Layer (Where getAllPages fails)
- `/frontend/src/lib/wiki/services/WikiPageService.ts`
  - Method: `getAllPages(category?: string, limit?: number, userRole?: string)`
  - This is the method that returns empty array

### WikiCategoryService (This one works!)
- `/frontend/src/lib/wiki/services/WikiCategoryService.ts`
  - Method: `getCategoryById()` - ✅ Works correctly
  - All GROUP BY clauses fixed (though this wasn't the problem)

---

## What NOT To Do (Lessons from 8 failed attempts)

❌ **Don't fix GROUP BY syntax** - Already tried in commits af569b3, 19b4de4, e3bea67, 9399f4a
❌ **Don't add wiki to PUBLIC_PATHS** - Commit 7eaa39a exposed security without fixing issue
❌ **Don't modify startup scripts** - Commit 9598ae7 crashed production
❌ **Don't consolidate auth** - Commit 27aeaba didn't affect category pages
❌ **Don't test API endpoints and claim success** - API working ≠ pages working
❌ **Don't deploy without user testing the actual web page**

---

## What TO Do (Actual debugging needed)

### Step 1: Add Debug Logging to getAllPages()
```typescript
// In WikiPageService.ts
async getAllPages(category?: string, limit?: number, userRole?: string) {
  console.log('[getAllPages] Called with:', { category, limit, userRole });

  const query = `...`;
  console.log('[getAllPages] SQL:', query);

  const result = await dbAdapter.query(query, params, { schema: 'wiki' });
  console.log('[getAllPages] Raw rows:', result.rows.length);

  const filtered = result.rows.filter(...);
  console.log('[getAllPages] After filtering:', filtered.length);

  return filtered;
}
```

### Step 2: Test on Production
```bash
# Deploy with logging
git add .
git commit -m "debug: Add extensive logging to getAllPages()"
git push

# Wait for deployment (3 min)
# Then access: https://www.veritablegames.com/wiki/category/on-command

# Check logs:
ssh user@192.168.1.15 "docker logs m4s0kwo4kc4oooocck4sswc4 --tail=50"
```

### Step 3: Compare with Manual Query
```bash
# Run the exact query getAllPages() uses:
ssh user@192.168.1.15 "docker exec m4s0kwo4kc4oooocck4sswc4 node -e \"
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
pool.query('SELECT * FROM wiki.wiki_pages WHERE category_id = \\$1', ['on-command'])
  .then(r => {
    console.log('Rows returned:', r.rows.length);
    console.log('First row:', r.rows[0]);
    pool.end();
  });
\""
```

### Step 4: Check Page Status/Visibility
```bash
# Are all pages draft or not public?
ssh user@192.168.1.15 "docker exec m4s0kwo4kc4oooocck4sswc4 node -e \"
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
pool.query(
  'SELECT status, is_public, COUNT(*) as count FROM wiki.wiki_pages GROUP BY status, is_public'
).then(r => {
  console.log('Page status distribution:');
  r.rows.forEach(row => console.log(\\\`  \\\${row.status} | public:\\\${row.is_public} | count:\\\${row.count}\\\`));
  pool.end();
});
\""
```

---

## Key Questions Still Unanswered

1. **Why does getAllPages() return empty array in page component but not in API route?**
2. **What filtering is being applied that removes all 39 pages?**
3. **Is the status column set to 'draft' instead of 'published'?**
4. **Is is_public set to false for all pages?**
5. **Is there caching involved that's returning stale data?**
6. **Is the userRole parameter being passed incorrectly?**

---

## Success Criteria (What "Fixed" Actually Means)

✅ User visits https://www.veritablegames.com/wiki/category/on-command
✅ Page shows "ON COMMAND" as title
✅ Shows "39 pages in this category"
✅ Lists all 39 wiki pages
✅ Each page is clickable and loads correctly
✅ Works for all 14 categories

**NOT success:**
❌ API endpoint returns correct data
❌ SQL query works in console
❌ TypeScript compiles without errors
❌ Deployment succeeds

---

## Next Investigation Must Do

1. **Stop guessing** - No more "likely fix" attempts
2. **Add comprehensive logging** - See what getAllPages() actually does
3. **Compare execution contexts** - API vs Page component
4. **Check actual page data** - Status, visibility, etc.
5. **Get user confirmation** - Test the actual web page, not API

---

## Total Resources Wasted

- **Time**: ~8+ hours across multiple sessions (Nov 13-16, 2025)
- **Failed commits**: 11 attempts
- **Production deploys**: 11 deployments
- **Production incidents**: 1 crash (startup script adding wiki import)
- **Security issues introduced**: 1 (wiki exposed publicly in commit 7eaa39a)

**All because we STILL have not identified the actual root cause.**

---

## Status as of November 16, 2025 02:45 PST

- ❌ Wiki category pages still broken after 11 attempts
- ❌ Root cause STILL unknown
- ✅ 11 failed attempts documented
- ✅ Pattern confirmed: API works, pages don't
- ❌ Pre-rendering theory FAILED - even minimal config doesn't work
- ❌ Debug logging theory FAILED - logs never appear (pre-rendering)
- ❌ Config matching theory FAILED - matching working pages doesn't help

**What we tried that DIDN'T work:**
1. GROUP BY fixes (4 attempts)
2. Auth consolidation
3. Server startup changes
4. Public path configuration
5. Standalone server mode
6. Debug logging (never executes)
7. Adding ALL pre-rendering config
8. Removing ALL pre-rendering config

**Critical mystery**: Why do individual wiki pages work but category pages don't when they have IDENTICAL config?

**This time: STOP GUESSING. The answer is NOT in the config.**
