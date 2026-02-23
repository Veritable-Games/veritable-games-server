# Wiki Category Pages Investigation - November 2025

**Status**: ❌ **UNRESOLVED** - Multiple attempted fixes failed
**Last Updated**: November 14, 2025
**Investigator(s)**: Claude Code (multiple instances), User

---

## Problem Statement

Wiki category pages display "This category doesn't exist" error on production despite:
- Categories existing in PostgreSQL database
- API endpoint `/api/wiki/categories/noxii` returning correct data with 44 pages
- Database queries executing successfully
- Same code working on localhost with SQLite

**User Impact**: Users cannot view category pages or page listings by category
- https://www.veritablegames.com/wiki/category/noxii → Shows error
- https://www.veritablegames.com/api/wiki/categories/noxii → Returns correct JSON

---

## Investigation Timeline

### November 13, 2025 - Initial Diagnosis

**Symptoms Observed**:
- Category pages return "Category doesn't exist"
- User dropdown loading stuck in "Loading..." state
- Forums category pages similarly broken
- Library pages stuck loading

**Initial Hypothesis**: Triple auth initialization race condition (multiple auth checks running in parallel)
- auth.ts module-level `checkAuth()`
- AuthContext.tsx `useEffect` initialization
- MaintenanceBanner making separate `/api/auth/session` fetch

**Action Taken**: Commit 27aeaba - Consolidate auth to single source of truth (AuthProvider)
- Removed module-level auth check from auth.ts
- Rewrote MaintenanceBanner to use useAuth() hook
- Result: ❌ **Did not fix category pages**

### Attempted Fixes (All Failed)

#### 1. **Commit af569b3** - "Add c.is_public to GROUP BY clauses"
- **Theory**: PostgreSQL GROUP BY violation - selecting 9 columns but grouping by 8
- **Change**: Added c.is_public to all GROUP BY clauses in WikiCategoryService
- **Result**: ❌ **Still shows "Category Not Found"**

#### 2. **Commit 3b629bb** - "Use Next.js standalone server startup"
- **Theory**: `next start` incompatible with `output: 'standalone'` config
- **Change**: Changed startup from `next start` to `node .next/standalone/server.js`
- **Result**: ❌ **Still shows "Category Not Found"**

#### 3. **Commit 7eaa39a** - "Make wiki pages publicly accessible"
- **Theory**: Middleware blocking wiki routes, preventing page code from running
- **Change**: Added `/wiki`, `/wiki/category`, `/wiki/page` to PUBLIC_PATHS
- **Problems**:
  - ✅ Makes wiki public (intentional vulnerability - violates auth architecture)
  - ❌ **Does not fix category page "doesn't exist" error**
- **Result**: ❌ **Exposed wiki publicly, problem remains**

#### 4. **Commit 19b4de4** - "Simplify GROUP BY to primary key approach"
- **Theory**: Modern PostgreSQL 9.1+ allows `GROUP BY c.id` instead of explicit columns
- **Change**: Simplified all 6 GROUP BY clauses to use only primary key
- **Testing**:
  - ✅ Compiled without errors locally
  - ✅ API endpoint returns correct data
  - ❌ **Web pages still show "Category Not Found"**
- **Result**: ❌ **Fix did not work either**

---

## Key Discovery: Discrepancy Between API and Web Pages

### API Layer ✅ Works
```
GET /api/wiki/categories/noxii
200 OK
{
  "success": true,
  "data": {
    "id": "noxii",
    "name": "NOXII",
    "page_count": 44,
    ...
  }
}
```

### Web Page ❌ Broken
```
GET /wiki/category/noxii
Shows: "This category doesn't exist"
```

**This means**:
- Database queries work ✓
- API routes work ✓
- Page component logic is broken ✗

---

## Root Cause Analysis - NOT YET IDENTIFIED

### What We Know

1. **getCategoryById() works** - Returns category data correctly
2. **getAllPages() fails** - Returns 0 pages in the page component
3. **The same code works on localhost** - SQLite vs PostgreSQL difference
4. **API endpoint works on production** - So database access is fine

### Possible Causes (Unconfirmed)

1. **Page visibility/status filtering too restrictive**
   - getAllPages() may be filtering out all pages based on status or visibility
   - Could be `status = 'published'` filter rejecting pages
   - Could be `is_public` filter rejecting pages

2. **Cache invalidation issue**
   - Pages cached with old/empty data
   - Cache key mismatch between database state and what's cached

3. **Component state initialization**
   - Page component not waiting for data to load
   - Race condition between component render and data fetch

4. **Database schema mismatch**
   - PostgreSQL and SQLite schema differences
   - Missing columns or type mismatches

5. **Service layer misconfiguration**
   - WikiPageService initialization issue
   - Database adapter not properly routing to PostgreSQL

---

## Code Locations to Investigate

### Category Page Component
- File: `frontend/src/app/wiki/category/[id]/page.tsx`
- Method: `getCategoryData()`
- Issue: Calls `getAllPages()` which returns 0 results

### WikiPageService
- File: `frontend/src/lib/wiki/services/WikiPageService.ts`
- Method: `getAllPages()`
- Issue: Returns empty array despite pages existing in database

### WikiCategoryService
- File: `frontend/src/lib/wiki/services/WikiCategoryService.ts`
- Method: `getCategoryById()`
- Status: Works correctly - returns category with page_count

### Database Adapter
- File: `frontend/src/lib/database/adapter.ts`
- Check: Is schema routing correctly to PostgreSQL?

---

## What NOT To Do

❌ **Don't assume middleware is the problem** - Commit 7eaa39a exposed wiki publicly but didn't fix the error
❌ **Don't assume it's a GROUP BY syntax issue** - Both af569b3 and 19b4de4 fixed GROUP BY but pages still don't load
❌ **Don't assume it's an auth issue** - 27aeaba consolidated auth but didn't fix pages
❌ **Don't test API endpoints and claim the feature is fixed** - API working ≠ Web page working
❌ **Don't claim success without explicit user confirmation of the actual feature**

---

## Investigation Process Errors

### What Went Wrong

1. **False Positives**: Each fix seemed correct in isolation but didn't solve the actual problem
2. **Misleading Symptoms**: The API working made it look like the infrastructure was fine
3. **Intermediate Claims**: Multiple instances claimed "fixed" based on partial evidence
4. **Lack of End-to-End Testing**: Tested components, not the actual user feature
5. **Skipped Manual Testing**: Deployed fixes without user testing the actual web pages

### Why This Happened

- Multiple Claude instances working on the same problem
- Each instance diagnosed a different root cause
- No shared understanding of what "fixed" actually means
- Documentation wasn't updated with failures

---

## Next Steps

### Actual Root Cause Investigation Needed

1. **Add debug logging to `getAllPages()`**
   - Log: query SQL
   - Log: parameters passed
   - Log: raw database results
   - Log: filtered results

2. **Compare localhost vs production behavior**
   - Same code, different database backend
   - Trace the query path in both environments
   - Check if filters are different

3. **Review WikiPageService query**
   - Check WHERE clauses for restrictive filters
   - Check if `status` or `is_public` filters are rejecting all pages
   - Verify column existence in PostgreSQL schema

4. **Test directly in production**
   - SSH to server
   - Run manual PostgreSQL query: `SELECT * FROM wiki.wiki_pages WHERE category_id = 'noxii' AND status = 'published'`
   - Compare results between local SQLite and production PostgreSQL

5. **Review component logic**
   - Check WikiCategoryPageComponent
   - Verify it's awaiting data properly
   - Check error handling and fallback logic

---

## Documentation for Future Work

### Key Insight

**Do NOT fix things based on educated guesses**. This investigation tried 4 different "likely" fixes that all failed because the actual problem was never identified.

The next person needs to:
1. Identify the ROOT CAUSE (not symptoms)
2. Test the actual user-facing feature (not API endpoints)
3. Get explicit user confirmation it works
4. Document what was actually broken

### Example of Correct Process

```
1. User reports: "Category pages show 'doesn't exist'"
2. Investigate: Why do they show this error?
   - Trace error message: comes from page component
   - Trace component: calls getCategoryData()
   - Trace getCategoryData(): calls getAllPages()
   - Trace getAllPages(): ADD DEBUG LOGGING
3. Deploy with debug logging to production
4. Reproduce the issue, capture logs
5. Analyze logs: "Oh! getAllPages() is filtering by status='draft', all pages are draft"
6. Fix: Change status filter to include published pages
7. Test: User confirms page now loads
8. Deploy to main
```

---

## Files Modified in Failed Investigation

- `frontend/src/stores/auth.ts` - Commit 27aeaba
- `frontend/src/components/MaintenanceBanner.tsx` - Commit 27aeaba
- `frontend/src/middleware.ts` - Commit 7eaa39a (⚠️ wiki exposed)
- `frontend/package.json` - Commit 3b629bb
- `frontend/src/lib/wiki/services/WikiCategoryService.ts` - Commits af569b3, 19b4de4

---

## Conclusion

As of November 14, 2025:
- ❌ Wiki category pages still broken
- ❌ Root cause not identified
- ✅ Error thoroughly documented to prevent repeated guessing
- ✅ Key insight: API working ≠ Feature working

This investigation wasted resources by trying fixes without understanding the actual problem. The next investigation MUST focus on root cause analysis, not pattern-matching to "likely" fixes.
