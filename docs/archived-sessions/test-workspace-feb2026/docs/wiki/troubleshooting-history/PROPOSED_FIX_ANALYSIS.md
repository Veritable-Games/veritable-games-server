# Proposed Fix Analysis - Wiki Category Pages
**Date**: November 16, 2025, 08:00 UTC
**Analyst**: Claude Model #2 (following Model #1's investigation)

---

## Critical Discovery from Model #1

**API endpoints work ✅ | Web pages broken ❌**

```bash
# This works:
curl https://www.veritablegames.com/api/wiki/categories/on-command
→ Returns: {"success":true,"data":{"name":"ON COMMAND","page_count":39}}

# This fails:
https://www.veritablegames.com/wiki/category/on-command
→ Shows: "This category doesn't exist"
```

**This means:**
- ✅ Database connection works
- ✅ getCategoryById() works
- ❌ getAllPages() returns `[]` (empty array) in page component context

---

## What I Discovered Independently (Before Reading Model #1's Work)

### 1. Prerendering Evidence
**Response headers from browser:**
```
x-nextjs-cache: HIT
x-nextjs-prerender: 1
```

**Interpretation**: Pages are being PRERENDERED at build time when database doesn't exist, then cached.

### 2. No Server-Side Execution
**Evidence**: No server logs when accessing category pages
```bash
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100 | grep WikiCategory
# Returns nothing
```

**Interpretation**: getCategoryData() is NOT being called at runtime - pages are serving cached HTML.

### 3. React Hydration Error
**Browser console:**
```javascript
TypeError: can't access property "catch", n() is undefined
```

**Interpretation**: Server-rendered HTML (error page) doesn't match client expectations.

---

## Synthesis: The Two Issues Are Connected

### Model #1's Finding
**`getAllPages()` returns empty array in page component**

### My Finding
**Pages are prerendered at build time and cached**

### Combined Understanding
The issue is BOTH:
1. ❌ Pages ARE being prerendered (my finding)
2. ❌ `getAllPages()` returns empty even when NOT cached (Model #1's finding)

**Evidence for this synthesis:**
- Model #1 tested API endpoints (they work) ← proves database/service layer OK
- My investigation found prerendering headers ← proves caching layer broken
- Model #1 found `getAllPages()` specifically fails ← proves there's also a service layer issue

---

## My Proposed Fixes (Based on Both Investigations)

### Fix #1: Disable Static Generation (HIGHEST PRIORITY)
**What**: Add `generateStaticParams()` to force server-side rendering

```typescript
// In /app/wiki/category/[id]/page.tsx
export async function generateStaticParams() {
  return []; // Disable static pregeneration
}

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
```

**Why**: This prevents Next.js from prerendering pages at build time when database is empty.

**Expected Result**: Pages will be rendered on every request with live database queries.

### Fix #2: Debug getAllPages() (CRITICAL FOR ROOT CAUSE)
**What**: Add comprehensive logging to see why it returns empty array

```typescript
// In WikiPageService.ts getAllPages()
async getAllPages(category?: string, limit?: number, userRole?: string) {
  console.log('[getAllPages] CALLED:', { category, limit, userRole, env: process.env.NODE_ENV });

  // Log the query
  const query = `SELECT ... FROM wiki_pages WHERE category_id = $1`;
  console.log('[getAllPages] QUERY:', query);
  console.log('[getAllPages] PARAMS:', [category]);

  const result = await dbAdapter.query(query, [category], { schema: 'wiki' });
  console.log('[getAllPages] RAW RESULT:', result.rows.length, 'rows');

  if (result.rows.length > 0) {
    console.log('[getAllPages] FIRST ROW:', result.rows[0]);
    console.log('[getAllPages] STATUS VALUES:', result.rows.map(r => r.status));
    console.log('[getAllPages] IS_PUBLIC VALUES:', result.rows.map(r => r.is_public));
  }

  // Check filtering
  const filtered = result.rows.filter(page => {
    const pass = page.status === 'published' && page.is_public;
    if (!pass) {
      console.log('[getAllPages] FILTERED OUT:', page.slug, 'status:', page.status, 'is_public:', page.is_public);
    }
    return pass;
  });

  console.log('[getAllPages] AFTER FILTERING:', filtered.length, 'pages');

  return filtered;
}
```

**Why**: This will reveal:
- Is the query executing?
- How many rows does it return?
- What are the status/is_public values?
- Is filtering removing all pages?

### Fix #3: Check Page Status in Database (INVESTIGATION)
**What**: Verify all wiki pages have correct status

```bash
# Run this in production
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT status, is_public, COUNT(*) as count
  FROM wiki.wiki_pages
  GROUP BY status, is_public
  ORDER BY count DESC;"
```

**Expected**: Should see `status='published'` and `is_public=true` for most pages

**If instead we see**: `status='draft'` or `is_public=false` → That's why filtering removes everything!

### Fix #4: Bypass Filtering Temporarily (DIAGNOSTIC)
**What**: Comment out filtering to see if that's the issue

```typescript
// TEMPORARY - for debugging only
async getAllPages(category?: string) {
  const result = await dbAdapter.query(`
    SELECT * FROM wiki_pages WHERE category_id = $1
  `, [category], { schema: 'wiki' });

  // SKIP FILTERING - return everything
  return result.rows;
}
```

**Why**: If this makes pages appear, we know filtering is the problem.

**Then check**: What status/is_public values do pages actually have?

---

## Hypotheses Ranked by Likelihood

### Hypothesis A: Status Filtering (MOST LIKELY - 80%)
**Theory**: All wiki pages have `status='draft'` instead of `'published'`

**Evidence**:
- getAllPages() filters by `status = 'published'`
- API endpoint doesn't filter by status
- Would explain why API works but pages don't

**Test**: Query database for status distribution

**Fix if true**:
```sql
UPDATE wiki.wiki_pages SET status = 'published' WHERE status != 'published';
```

### Hypothesis B: Visibility Filtering (LIKELY - 60%)
**Theory**: All pages have `is_public = false`

**Evidence**:
- getAllPages() likely filters by `is_public = true`
- API might not check this
- Model #1 mentioned this possibility

**Test**: Query database for is_public distribution

**Fix if true**:
```sql
UPDATE wiki.wiki_pages SET is_public = true WHERE is_public = false;
```

### Hypothesis C: Caching + Filtering Combined (MODERATE - 40%)
**Theory**: Pages were prerendered when database was empty, now cached forever

**Evidence**:
- Response headers show prerendering
- Fix #1 addresses this
- But doesn't explain why fresh renders also fail

**Fix**: Implement Fix #1 (generateStaticParams)

### Hypothesis D: User Role Context (LOW - 20%)
**Theory**: `userRole` parameter passed to getAllPages() is `undefined` or `'guest'`, causing filtering

**Evidence**:
- getAllPages() accepts `userRole` parameter
- Might filter based on role
- Page component might not pass it correctly

**Test**: Check how getAllPages() is called in page component

**Fix if true**: Pass explicit role or make method public by default

---

## What Model #1 Tried (All Failed)

1. ❌ GROUP BY fixes (multiple attempts)
2. ❌ Auth consolidation
3. ❌ Server startup changes
4. ❌ Public path configuration
5. ❌ Standalone server changes

**Why they all failed**: None addressed the actual root cause (getAllPages() filtering or prerendering)

---

## What NOT To Try (Lessons from Model #1)

❌ Don't fix GROUP BY syntax - Already tried 4 times
❌ Don't modify auth initialization - Doesn't affect category pages
❌ Don't change PUBLIC_PATHS - Creates security issues
❌ Don't modify startup scripts - Can crash production
❌ Don't test API endpoints and claim success - API ≠ Web pages

---

## Implementation Order (If I Were Implementing)

**Phase 1: Investigation (REQUIRED FIRST)**
1. Add logging to getAllPages() (Fix #2)
2. Deploy and test
3. Check logs to see what filtering does
4. Query database for page status distribution (Fix #3)

**Phase 2: Fix Based on Findings**
- If status filtering is issue → UPDATE wiki.wiki_pages SET status='published'
- If visibility filtering is issue → UPDATE is_public=true
- If neither → Implement diagnostic bypass (Fix #4)

**Phase 3: Address Caching**
5. Implement generateStaticParams() (Fix #1)
6. Clear Next.js build cache
7. Redeploy

**Phase 4: Verify**
8. User tests actual web page
9. Check all 14 categories
10. Confirm no "Category Not Found" errors

---

## Success Criteria

✅ User visits https://www.veritablegames.com/wiki/category/on-command
✅ Page shows "ON COMMAND" as title
✅ Shows "39 pages in this category"
✅ Lists all 39 wiki pages
✅ Works for ALL 14 categories
✅ No React hydration errors in browser console
✅ Response headers do NOT show `x-nextjs-prerender: 1`

**NOT success:**
❌ API endpoint returns correct data (already works)
❌ SQL query works in console (already works)
❌ TypeScript compiles (already works)
❌ Deployment succeeds (already works)

---

## Risk Assessment

### Low Risk Fixes
✅ Add logging (Fix #2) - No risk, pure investigation
✅ Database status query (Fix #3) - Read-only, safe
✅ generateStaticParams (Fix #1) - Standard Next.js pattern

### Medium Risk Fixes
⚠️ Update page status in database - Changes data, but reversible
⚠️ Bypass filtering (Fix #4) - Could expose draft pages temporarily

### High Risk Fixes
❌ Modify startup scripts - Already crashed production once
❌ Change auth/public paths - Security implications

---

## Coordination with Model #1

**Model #1's latest changes:**
- Commit 685edca - Documentation and troubleshooting history
- test-category-query.js - Database testing script
- Multiple documentation improvements

**Model #1's recommended approach:**
1. Stop guessing
2. Add comprehensive logging
3. Compare execution contexts
4. Check actual page data
5. Get user confirmation

**My additions to their plan:**
- Fix prerendering/caching issue (generateStaticParams)
- Specific logging targets for getAllPages()
- Database queries to check status distribution
- Clear implementation order

---

## Estimated Time to Fix

**Investigation Phase**: 15 minutes
- Deploy logging
- Check database status
- Review logs

**Fix Phase**: 10 minutes
- If status issue: Simple UPDATE query
- If caching issue: Add generateStaticParams

**Verification**: 10 minutes
- User tests all categories
- Confirm no errors

**Total**: ~35 minutes (if we find the root cause correctly)

---

## Conclusion

The issue is **NOT** a GROUP BY problem, auth problem, or routing problem.

The issue IS either:
1. **Filtering** - Pages have wrong status/visibility (80% likely)
2. **Caching** - Prerendered error pages served forever (40% likely)
3. **Both** - Cached empty results + ongoing filtering (30% likely)

**Next step**: Add logging to getAllPages() and check page status in database.

**DO NOT**: Make any more guesses or "likely fixes" without investigation.

---

**Status**: Documented for handoff to next investigation session
**Awaiting**: Deployment completion (commit 685edca) for user testing
