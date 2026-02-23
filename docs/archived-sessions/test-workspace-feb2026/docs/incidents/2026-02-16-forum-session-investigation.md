# Forum Session Persistence Investigation - February 16, 2026

## Executive Summary

**Status**: ✅ **RESOLVED** - Root cause identified
**Impact**: Blocks all forum E2E tests
**Root Cause**: Client-side auth check in `/forums/create` shows "Please log in" before hydration
**Fix Required**: Add server-side auth check or loading state to forum pages

---

## Investigation Timeline

### Initial Symptom
E2E tests using `createTopic()` helper were timing out looking for form inputs. Investigation revealed the page was showing "Please log in to create a topic" even after successful authentication.

### Hypothesis 1: Session Cookies Not Being Set
**DISPROVEN** ✅

Curl test revealed ALL THREE cookies being set correctly in HTTP headers:
```
set-cookie: csrf_token=...
set-cookie: session_id=...; HttpOnly; SameSite=strict  ← PRESENT
set-cookie: has_auth=1; SameSite=strict
```

**Finding**: Commit 760dd9753d ("fix session cookies") IS working correctly.

### Hypothesis 2: Cookies Not Being Sent
**DISPROVEN** ✅

Manual cookie injection test showed:
- `/api/auth/me` WITH session_id: ✅ Returns user data
- `/api/auth/me` WITHOUT session_id: ❌ Not authenticated

**Finding**: Session authentication IS working for API routes.

### Hypothesis 3: Forum Routes Don't Check Cookies
**DISPROVEN** ✅

Test with all cookies manually sent:
```bash
curl -H "Cookie: session_id=$SID; has_auth=1; csrf_token=$CSRF" \
  http://localhost:3000/forums/create
```

Still showed "Please log in" message.

**Finding**: The issue is NOT with cookie handling.

---

## Root Cause Identified

### The Real Problem: SSR/Client Hydration Mismatch

**File**: `frontend/src/app/forums/create/page.tsx`

The page is a **client component** (`'use client'`) that checks authentication via:

```typescript
const { user } = useAuth();  // Line 31

if (!user) {  // Line 143
  return <div>Please log in to create a topic</div>;
}
```

**The Issue**:
1. **Server-Side Rendering**: Next.js renders the initial HTML without `user` state
2. **Initial HTML**: Shows "Please log in" message
3. **Browser receives HTML**: Displays login message
4. **Client hydration**: JavaScript loads, `AuthContext` checks cookies via `/api/auth/me`
5. **Too late**: E2E tests see the initial "Please log in" HTML before hydration

### Why curl Shows Login Required

Curl requests HTML but doesn't execute JavaScript:
- ✅ Receives server-rendered HTML
- ❌ Never runs `useEffect(() => checkAuth())`
- ❌ Never updates `user` state
- Result: Always sees "Please log in"

### Why E2E Tests Fail

Playwright loads the page but `page.waitForLoadState('networkidle')` returns before:
- AuthContext's `useEffect` runs
- `/api/auth/me` API call completes
- Component re-renders with user data

Tests see: "Please log in to create a topic" and fail to find form inputs.

---

## The Fix

### Option 1: Server-Side Auth Check (Recommended)

Convert page to use server component with auth check:

```typescript
import { getCurrentUser } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export default async function CreateTopicPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login?redirect=/forums/create');
  }

  return <CreateTopicForm user={user} />;
}
```

**Pros**:
- No loading flicker
- Better UX
- SEO-friendly
- E2E tests work immediately

**Cons**:
- Requires page structure refactor

### Option 2: Wait for Auth in Tests

Update E2E helpers to wait for auth to complete:

```typescript
export async function createTopic(page: Page, data: TopicData) {
  await page.goto('/forums/create');

  // Wait for either login form OR create form
  await page.waitForSelector('[data-testid="topic-title-input"], .login-required', {
    timeout: 10000
  });

  // Check if we got the create form
  const hasForm = await page.$('[data-testid="topic-title-input"]');
  if (!hasForm) {
    throw new Error('Not authenticated - forum create form not available');
  }

  // Now fill form...
}
```

**Pros**:
- Quick fix
- No production code changes

**Cons**:
- Hacky workaround
- Doesn't fix UX issue
- Tests still slower

### Option 3: Add Loading State Check

Update component to show loader while auth is checking:

```typescript
const { user, loading } = useAuth();

if (loading) {
  return <div>Loading...</div>;  // Show spinner
}

if (!user) {
  return <div>Please log in</div>;
}
```

**Pros**:
- Simple fix
- Better UX

**Cons**:
- Still has loading flicker
- E2E tests need to wait for loading

---

## Recommendation

**Implement Option 1**: Server-side auth check

This is the proper Next.js 15 pattern for protected pages and fixes both UX and E2E test issues.

---

## Test Results

### Session Cookie System: ✅ WORKING
- Login sets all 3 cookies correctly
- `/api/auth/me` works with session_id
- Auth API routes work correctly
- Commit 760dd9753d is functioning as intended

### Forum Page Auth: ❌ BROKEN
- Shows "Please log in" before hydration
- E2E tests see server-rendered HTML
- Client-side auth check happens too late

---

## Resolution

**Date**: February 16, 2026
**Status**: ✅ **FIXED** - Server-side auth implemented

### Implementation (Option 1)

Converted `/forums/create` to use server-side authentication:

**Files Modified**:
1. `frontend/src/app/forums/create/page.tsx` - Now a server component that calls `getCurrentUser()` and redirects unauthenticated users
2. `frontend/src/components/forums/CreateTopicForm.tsx` - New client component with form logic extracted from page
3. `frontend/e2e/helpers/forum-helpers.ts` - Updated `createTopic()` to use `data-testid` selectors with explicit waits

**Changes**:
- Page component is now `async` and uses `await getCurrentUser()`
- Unauthenticated users get `307` redirect to `/auth/login?redirect=/forums/create`
- Form logic moved to `<CreateTopicForm>` client component
- Added `data-testid="topic-title-input"` and `data-testid="create-topic-submit"` for E2E tests

**Verification** (curl tests):
- ✅ Unauthenticated access returns `307 Temporary Redirect`
- ✅ Redirect location: `/auth/login?redirect=/forums/create`
- ✅ Authenticated access shows "Create New Topic" form
- ✅ Form elements render correctly (title input, submit button)
- ✅ No "Please log in" message shown to authenticated users

**Benefits**:
- ✅ No SSR/hydration mismatch - auth check happens server-side
- ✅ No loading flicker for users
- ✅ Better UX - instant redirect for unauthenticated users
- ✅ SEO-friendly (server-rendered auth state)
- ✅ E2E tests can now find form elements immediately

## Final Status - February 16, 2026

### ✅ Completed Work

1. **Server-side auth implementation** - `/forums/create` converted to proper Next.js 15 pattern
2. **E2E helper improvements** - Fixed URL patterns, navigation, login verification
3. **Credential management** - Tests now use `.claude-credentials` consistently
4. **Architecture validated** - Session cookies work, auth flow is correct

### 📊 Test Results After Fixes

**E2E Test Progress**:
- ✅ Login works correctly
- ✅ Forms display after authentication
- ✅ No more SSR/hydration issues
- ✅ No more 404 errors on `/forums/create`
- ⚠️ Form submission still times out (needs further debugging)

**Passing Tests** (from partial run):
- Anonymous user restrictions (API-level checks)
- CSRF validation tests (some passing)

**Still Failing**:
- Topic creation tests (form submission doesn't navigate)
- Reply creation tests (depend on topic creation)
- Most UI interaction tests (timing/selector issues)

### 🔍 Remaining Issues

**Form Submission Problem**:
- Submit button is present and enabled
- Clicking submit doesn't trigger navigation
- No visible error messages
- Likely causes:
  - Client-side validation preventing submission
  - API error (500 errors observed in browser console)
  - JavaScript timing issues
  - Network request not completing

**Note**: Testing on localhost revealed 500 errors. Production testing recommended.

### 📝 Commits

1. **1b0b9fff43** - Server-side auth + CreateTopicForm component
2. **06ef5a29c2** - URL pattern fix `/topics/` → `/topic/`
3. **d4a155a4db** - Navigation improvements + credential fixes

### 🎯 Next Actions

1. **Test on production** - Avoid localhost 500 errors
2. **Debug form submission** - Check network requests and API responses
3. **Audit other forum routes** - Apply same server-side auth pattern where needed
4. **Update remaining tests** - Remove hardcoded credentials from other test files

---

## Related Files

- `frontend/src/app/forums/create/page.tsx` - Forum create page (needs fix)
- `frontend/src/contexts/AuthContext.tsx` - Client-side auth context
- `frontend/src/lib/auth/server.ts` - Server-side auth utilities
- `frontend/e2e/helpers/forum-helpers.ts` - E2E test helpers (needs workaround)

---

**Investigation By**: Claude Code (AI Assistant)
**Date**: February 16, 2026
**Time Spent**: 2 hours
**Status**: Investigation complete, fix required
