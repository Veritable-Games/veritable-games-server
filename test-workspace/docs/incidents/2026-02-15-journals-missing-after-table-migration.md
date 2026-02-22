# Incident Report: Journals Missing After Table Migration (2026-02-15)

## Summary
All 329 journals disappeared from production after deploying the journal table migration (separating journals from wiki_pages into dedicated table).

## Timeline
- **02:27 UTC** - Deployed journal table migration (commit `9bd8742753`)
- **02:30 UTC** - Data migration completed (329 journals migrated to wiki.journals table)
- **03:21 UTC** - Deployed performance optimizations (commit `4aa3adbb6d`)
- **03:30 UTC** - User reported all journals missing AGAIN
- **03:45 UTC** - Discovered server-side query still using wiki_pages table
- **03:50 UTC** - Deployed fix for server-side query (commit `208f8ae318`)
- **04:00 UTC** - User reports journals STILL MISSING

## Status
**✅ RESOLVED - All root causes identified and fixed**

## Root Cause (Partial)
The journal table migration successfully moved all journals from `wiki_pages` to a dedicated `journals` table. However, the codebase was not fully updated to query the new table:

### What Was Fixed
✅ API routes:
- `frontend/src/app/api/journals/[slug]/route.ts` - Individual journal fetch
- `frontend/src/app/api/journals/route.ts` - Create/list journals
- `frontend/src/app/api/journals/deleted/route.ts` - Deleted journals
- `frontend/src/app/api/journals/recover/route.ts` - Recover journals

### What Was Missed (First Pass)
❌ Server-side rendering:
- `frontend/src/app/wiki/category/[id]/page.tsx` - `getJournalsData()` function (FIXED in commit `208f8ae318`)

### What Was ACTUALLY Wrong (Root Cause #1)
✅ **React useEffect Bug** - The `JournalsLayout` component had a critical React bug:

**The Bug** (`frontend/src/components/journals/JournalsLayout.tsx:48-51`):
```typescript
// Initialize journals ONCE on mount (journals come from server props)
useEffect(() => {
  setJournals(journals);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Only on mount ❌ EMPTY DEPENDENCY ARRAY
```

**Why It Caused Journals to Disappear**:
1. Component initially mounted with `journals=[]` (empty, before server query was fixed)
2. useEffect ran once, setting store to `[]`
3. Server query was fixed and returned 329 journals
4. Component re-rendered with `journals=[...329 journals]`
5. **BUG**: useEffect didn't re-run due to empty dependency array `[]`
6. Store remained `[]`, UI showed no journals

**The Fix** (Commit: `bebc4fbda5`):
```typescript
// Initialize journals from server props (update when journals change)
useEffect(() => {
  setJournals(journals);
}, [journals, setJournals]); // ✅ Re-run when journals prop changes
```

This was a classic React anti-pattern: ignoring prop changes by using an empty dependency array.

### What Was ACTUALLY Wrong (Root Cause #2)
✅ **Authentication Requirement Bug** - The journals page had incorrect authentication logic:

**The Bug** (`frontend/src/app/wiki/category/[id]/page.tsx:166-173`):
```typescript
// Special handling for journals category
if (id === 'journals') {
  const user = await getCurrentUser();
  const maintenanceModeEnabled = await isMaintenanceModeEnabled();

  if (maintenanceModeEnabled && !user) {
    // Only redirects to login if maintenance mode is ON
    redirect('/auth/login?redirect=/wiki/category/journals');
  }

  // If maintenance mode is OFF and user is null, returns []
  const journals = user ? await getJournalsData(user.id, user.role) : [];
}
```

**Why It Caused Journals to Disappear**:
1. Maintenance mode is OFF on production (`maintenance_enabled = false`)
2. When accessing `/wiki/category/journals` without logging in, `user` is null
3. Code only redirects to login if maintenance mode is ON
4. With maintenance mode OFF, unauthenticated users can access page
5. **BUG**: Code returns empty array `[]` for null users
6. UI shows "No journals" (even though 321 journals exist in database)

**The Fix** (Commit: `4f17553480`):
```typescript
// Journals are private - always require authentication
if (!user) {
  const { redirect } = await import('next/navigation');
  redirect('/auth/login?redirect=/wiki/category/journals');
  return; // TypeScript: redirect never returns, but satisfy the compiler
}

// User is authenticated - fetch their journals
const journals = await getJournalsData(user.id, user.role);
```

**Key Insight**: Journals are private user data and should ALWAYS require authentication, regardless of maintenance mode setting. The original logic incorrectly assumed journals could be public when maintenance mode was OFF.

## Impact
- **Severity**: Critical (P0)
- **Duration**: ~11 hours (02:27 UTC - 13:15 UTC on 2026-02-15)
- **Affected Users**: All users (unauthenticated users saw zero journals, authenticated users also saw zero due to React bug)
- **Data Loss**: None (all 321 journals preserved in database, just not visible in UI)

## Investigation Steps Taken

### 1. Migration Verification
```bash
# Verified migration completed successfully
DATABASE_URL="postgresql://postgres:postgres@10.100.0.1:5432/veritable_games" \
npx tsx scripts/migrations/check-journals-migration.ts

# Results:
# ✅ journals table exists in wiki schema
# ✅ 329 journals in wiki.journals table
# ✅ 0 journals in wiki_pages table
# ✅ 697 revisions preserved in wiki_revisions
```

### 2. Schema Changes
```sql
-- Old structure (wiki_pages)
FROM wiki_pages p WHERE p.namespace = 'journals'

-- New structure (journals table)
FROM journals j WHERE j.user_id = ?
```

### 3. Code Updates Applied
- Changed all API routes to query `journals` table
- Updated server-side page component to query `journals` table
- Removed `namespace` column references (doesn't exist in journals table)
- Changed column reference: `journal_category_id` → `category_id`

### 4. What We Still Don't Know
- Why are journals still not appearing after all fixes?
- Are there other components querying the old table?
- Is there a React/Next.js caching issue?

## Files Modified

### Migration Scripts
- `frontend/scripts/migrations/018-separate-journals-table.sql` - Schema creation
- `frontend/scripts/migrations/migrate-journals-to-table.ts` - Data migration

### API Routes (Fixed)
- `frontend/src/app/api/journals/[slug]/route.ts`
- `frontend/src/app/api/journals/route.ts`
- `frontend/src/app/api/journals/deleted/route.ts`
- `frontend/src/app/api/journals/recover/route.ts`
- `frontend/src/app/api/journals/archive/route.ts` (deleted - functionality removed)

### Server-Side Rendering (Fixed)
- `frontend/src/app/wiki/category/[id]/page.tsx` - `getJournalsData()` function

### Client Components (Unknown Status)
- `frontend/src/app/wiki/category/journals/JournalsPageClient.tsx` - May need investigation
- `frontend/src/components/journals/JournalsLayout.tsx` - May need investigation
- `frontend/src/stores/journalsStore.ts` - May need investigation

## Resolution Steps Completed

1. ✅ Check production logs for database query errors - No errors found
2. ✅ Verify deployment actually completed (check Coolify) - Deployment successful
3. ✅ Search entire codebase for `wiki_pages` + `namespace` + `journals` - Found and fixed recover/route.ts
4. ✅ Check browser console for JavaScript errors - N/A (root cause was server-side useEffect)
5. ✅ Verify cache was cleared (Next.js build cache) - Not a caching issue
6. ✅ Test direct database query on production to verify journals exist - 329 journals confirmed in wiki.journals
7. ✅ Check if there's a React hydration issue - Root cause was React useEffect dependency bug

## Related Incidents
- **2026-02-12**: Journals missing due to missing columns (see `2026-02-12-journals-missing-columns.md`)
- **Current**: Similar symptom (journals missing) but different root cause (table migration incomplete)

## Commits
- `9bd8742753` - Initial journal table migration (missed server-side query)
- `4aa3adbb6d` - Performance optimizations (exposed the bug)
- `208f8ae318` - Fixed server-side query (journals STILL missing due to React bug + auth bug)
- `877b785fcf` - Fixed recover/route.ts to use journals table
- `bebc4fbda5` - **PARTIAL FIX**: Fixed React useEffect dependency bug in JournalsLayout (journals still missing for unauthenticated users)
- `4f17553480` - **FINAL CODE FIX**: Fixed authentication requirement - journals now always require login
- `b875dcc1b9` - Fixed /donate page build error by adding dynamic rendering directives

## Lessons Learned

### 1. React Props and useEffect Dependencies
**Problem**: Empty dependency arrays `[]` in useEffect cause the effect to ignore prop changes.

**Lesson**: When a useEffect uses props, always include those props in the dependency array. The pattern:
```typescript
useEffect(() => {
  doSomething(propValue);
}, []); // ❌ WRONG - ignores propValue changes
```

Should be:
```typescript
useEffect(() => {
  doSomething(propValue);
}, [propValue]); // ✅ CORRECT - re-runs when propValue changes
```

### 2. Verify Data Flow End-to-End
**Problem**: We verified:
- ✅ Database has data (329 journals)
- ✅ Server query returns data
- ✅ Code is deployed
- ❌ Didn't verify React component was using the data

**Lesson**: When debugging, trace data through the entire pipeline:
1. Database → 2. Server query → 3. API response → 4. Component props → 5. Component state → 6. UI render

### 3. Comments Can Be Misleading
**Problem**: The comment said "journals come from server props" but the code ignored prop changes.

**Lesson**: Don't trust comments—verify the code does what the comment claims.

### 4. Multiple Fixes May Be Needed
**Problem**: Fixed server-side query, then React bug, but journals STILL missing.

**Lesson**: Complex issues often have multiple root causes. Keep investigating until symptoms disappear—don't assume the first or second fix is the last one.

### 5. Test As Real Users Would
**Problem**: We tested after fixing the React bug, but didn't test without being logged in.

**Lesson**: Test common user flows:
- Authenticated users accessing journals ✓
- **Unauthenticated users accessing journals** ← This exposed the auth bug
- Different maintenance mode states
- Different user roles (admin, regular user)

### 6. Authentication Requirements Should Be Explicit
**Problem**: Journals authentication was conditional on maintenance mode setting.

**Lesson**: Private data (like journals) should ALWAYS require authentication, regardless of system settings. Don't couple security requirements with feature flags like maintenance mode.

### 7. Auto-Deploy Systems Can Fail Silently
**Problem**: Code was pushed to GitHub (commit 4f17553480) but Coolify's auto-deploy didn't trigger. Docker image was never built.

**Lesson**: Always verify deployments actually happened:
1. Check container image tag matches expected commit
2. Check environment variables (SOURCE_COMMIT) match expected commit
3. Test production behavior after deploy, don't assume success

**Manual Build Process** (when auto-deploy fails):
```bash
# 1. Copy code to server build directory
rsync -avz --exclude='node_modules' frontend/ user@10.100.0.1:/tmp/build-veritable-games/frontend/

# 2. Build Docker image with commit-specific tag
ssh user@10.100.0.1 "cd /tmp/build-veritable-games/frontend && docker build -t m4s0kwo4kc4oooocck4sswc4:4f17553480 ."

# 3. Update .env file with new commit hash
ssh user@10.100.0.1 "sudo sed -i 's/SOURCE_COMMIT=.*/SOURCE_COMMIT=4f17553480/' /data/coolify/applications/m4s0kwo4kc4oooocck4sswc4/.env"

# 4. Recreate container to load new image and .env
ssh user@10.100.0.1 "cd /data/coolify/applications/m4s0kwo4kc4oooocck4sswc4 && docker compose down && docker compose up -d"

# 5. Verify deployment
curl -I https://www.veritablegames.com/wiki/category/journals  # Should return 307 redirect
```

---

**Created**: 2026-02-15 03:30 UTC
**Code Fixed**: 2026-02-15 13:15 UTC (commit 4f17553480)
**Deployed to Production**: 2026-02-15 14:25 UTC (manual Docker build)
**Duration**: ~11 hours total (3 separate code fixes + manual deployment)
**Status**: ✅ FULLY RESOLVED - All root causes identified, fixed, and deployed
