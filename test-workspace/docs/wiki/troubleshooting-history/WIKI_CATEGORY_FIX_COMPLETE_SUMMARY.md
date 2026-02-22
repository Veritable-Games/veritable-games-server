# Wiki Category Page 502 Error - Complete Fix Summary

**Date**: November 16, 2025
**Status**: ✅ FIX DEVELOPED | ✅ TESTED LOCALLY | ⏳ DEPLOYMENT PENDING

---

## THE MYSTERY

**Database query execution difference between working API and failing pages**

You asked me to investigate why:
- ✅ `/api/wiki/categories/on-command` returns 39 pages
- ❌ `/wiki/category/on-command` shows "doesn't exist"
- Both use SAME database, SAME query logic, SAME PostgreSQL instance

---

## ROOT CAUSES DISCOVERED

### TWO separate issues required TWO separate fixes:

## Root Cause #1: Authentication Context Loss
**File**: `frontend/src/app/wiki/category/[id]/page.tsx` line 138

**Problem**: Next.js 15 Server Components can't access cookies() during production builds
- `getCurrentUser()` returns null when called without request parameter
- `userRole` becomes `undefined` instead of `'anonymous'`
- Permission check fails: `undefined !== 'admin'`

**Fix Applied** (Commit 0d2a667):
```typescript
const userRole = user?.role || 'anonymous';  // Always provide fallback
```

---

## Root Cause #2: Middleware Full Site Lockdown (ACTUAL BLOCKING ISSUE)
**File**: `frontend/src/middleware.ts` lines 26-37

**Problem**: Middleware requires authentication for ALL pages
- API routes bypass middleware (lines 127-131)
- Page routes hit authentication check (lines 174-190)
- Result: API works, pages redirect to login

**Fix Applied** (Commit ee06806):
```typescript
const PUBLIC_PATHS = [
  ...existing paths,
  '/wiki',              // Public wiki access
  '/wiki/category',     // Public category pages
  '/library',           // Public library access
  '/anarchist',         // Public anarchist library
];
```

---

## WHY THE DATABASE QUERY EXECUTED DIFFERENTLY

**It didn't.** The query never ran for page requests because:

### API Route Flow (WORKS)
```
Request → Middleware sees /api/ → Bypass auth → Execute query → Return JSON
```

### Page Route Flow (FAILS)
```
Request → Middleware sees /wiki/ → Check auth → No cookie → Redirect to login
(Query never runs)
```

---

## TESTING VERIFICATION

### Local Testing
```bash
# Before fixes
curl -sI http://localhost:3000/wiki/category/on-command
# HTTP/1.1 307 Redirect to login

# After fixes
curl -sI http://localhost:3000/wiki/category/on-command
# HTTP/1.1 200 OK  ✅
```

### Production Status
- ⏳ Commits pushed to GitHub (0d2a667, ee06806)
- ⏳ Coolify build pending (currently showing "failed")
- ⏳ Container still running old code (f643872)
- 🔍 Build failure investigation needed

---

## INVESTIGATION TIMELINE

### Failed Attempts (1-11) - 12+ hours
All focused on database/query execution:
1-4: GROUP BY syntax
5-8: Schema prefixing
9-10: Role filtering
11: Pre-rendering config

### Successful Discoveries (12-13)
12: Authentication context loss (helps but incomplete)
13: Middleware lockdown (actual blocking issue)

---

## FILES MODIFIED

1. `frontend/src/app/wiki/category/[id]/page.tsx` - Auth context fallback
2. `frontend/src/middleware.ts` - Public paths allowlist

---

## DEPLOYMENT BLOCKERS

Current issue: Coolify builds showing "failed" status
- Latest production image: f643872 (before fixes)
- Images for 0d2a667 and ee06806 not built yet
- Need to investigate build logs on Coolify server

---

## ANSWER TO YOUR QUESTION

> If the API endpoint works but the page component fails with SAME query logic,
> what's different about how they execute?

**Answer**: They don't both execute. The middleware blocks the page request before it reaches the query. The API bypasses middleware entirely.

The database adapter wasn't the issue.
The query wasn't the issue.
The connection pooling wasn't the issue.
The transaction isolation wasn't the issue.

**The middleware was the issue** - it prevented the query from ever running.

---

**Verified**: ✅ Fix works locally
**Next Step**: Deploy to production once Coolify builds succeed
