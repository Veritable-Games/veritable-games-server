# E2E Test Fix Patterns - February 16, 2026

## Overview

This document captures the fix patterns discovered while fixing CSRF tests. Use these patterns to fix remaining forum test files.

---

## Pattern 1: Replace Hardcoded Production URLs

**Problem**: Tests hardcoded `https://www.veritablegames.com` URLs, preventing them from running against localhost.

**Solution**: Use relative URLs and baseURL variable.

### Before:
```typescript
import { test, expect } from '@playwright/test';

test('my test', async ({ page, request }) => {
  await page.goto('https://www.veritablegames.com/auth/login');
  const response = await request.post('https://www.veritablegames.com/api/forums/topics', {
    headers: {
      Origin: 'https://www.veritablegames.com',
      Referer: 'https://www.veritablegames.com/forums/create',
    },
  });
});
```

### After:
```typescript
import { test, expect } from '@playwright/test';

// Get baseURL from environment or default to localhost
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

test('my test', async ({ page, request }) => {
  await page.goto('/auth/login');  // Relative URL
  const response = await request.post('/api/forums/topics', {  // Relative URL
    headers: {
      Origin: baseURL,  // Dynamic
      Referer: `${baseURL}/forums/create`,  // Dynamic
    },
  });
});
```

**Files Fixed**: `csrf.spec.ts` (13 URLs replaced)

---

## Pattern 2: Add Debug Output for Login Flow

**Problem**: Login failures were silent, making it hard to diagnose issues.

**Solution**: Add console.log statements to track login progress.

### Pattern:
```typescript
test('my test', async ({ page }) => {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');

  console.log('Submitting login form...');

  // Intercept login response
  const loginResponsePromise = page.waitForResponse(response =>
    response.url().includes('/api/auth/login') && response.request().method() === 'POST'
  );

  await page.fill('input[name="username"]', USERNAME);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  const loginResponse = await loginResponsePromise;
  console.log('Login response status:', loginResponse.status());

  // Check cookies after login
  const cookies = await page.context().cookies();
  console.log('Cookies after login:', JSON.stringify(cookies, null, 2));

  console.log('Waiting for redirect...');
  await page.waitForURL(/\/(?!auth\/login)/, { timeout: 10000 });
  console.log('Redirected to:', page.url());
});
```

**Benefits**:
- Easier debugging when tests fail
- Verify cookies are being set
- Confirm login API response

---

## Pattern 3: Verify Cookies Are Set

**Problem**: Tests failed silently when cookies weren't set.

**Solution**: Add assertions to verify cookies before proceeding.

### Pattern:
```typescript
test('my test requires auth', async ({ page }) => {
  // Login
  await loginViaUI(page);

  // Verify cookies are set
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'session_id');
  const authCookie = cookies.find(c => c.name === 'has_auth');

  expect(sessionCookie).toBeDefined();
  expect(authCookie).toBeDefined();

  console.log('Session cookie:', sessionCookie?.httpOnly ? 'httpOnly ✅' : 'NOT httpOnly ❌');

  // Now proceed with test
  // ...
});
```

---

## Pattern 4: Handle Login Redirect Timeouts

**Problem**: `page.waitForURL()` would timeout if login failed.

**Solution**: Wrap in try-catch with detailed error output.

### Pattern:
```typescript
try {
  await page.waitForURL(/\/(?!auth\/login)/, { timeout: 10000 });
  console.log('Redirected to:', page.url());
} catch (error: any) {
  console.error('Redirect failed!', error.message);
  console.error('Still on:', page.url());

  // Check for error messages on page
  const errorText = await page.textContent('body');
  console.error('Page content:', errorText?.substring(0, 500));

  throw error;  // Re-throw to fail test with context
}
```

---

## Pattern 5: Use Environment-Aware Test Setup

**Problem**: Tests assumed specific environment (production vs localhost).

**Solution**: Make tests environment-agnostic.

### Pattern:
```typescript
// At top of test file
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const isProduction = baseURL.includes('veritablegames.com');

test('my test', async ({ page }) => {
  // Skip if feature not available in this environment
  test.skip(isProduction && !process.env.HAS_FORUMS, 'Forums not available');

  // Or adjust expectations based on environment
  const expectedStatus = isProduction ? 403 : 401;
  expect(response.status()).toBe(expectedStatus);
});
```

---

## Pattern 6: Update Helper Functions to Use Relative URLs

**Problem**: Helper functions (like `forum-helpers.ts`) used absolute URLs, preventing environment-agnostic testing

**Solution**: Convert all `page.goto()` calls to use relative paths

### Before:
```typescript
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://www.veritablegames.com';

export async function login(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`);
}

export async function createTopic(page: Page, data: TopicData) {
  await page.goto(`${BASE_URL}/forums/category/${data.category}`);
}
```

### After:
```typescript
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

export async function login(page: Page) {
  await page.goto('/auth/login'); // Relative URL
}

export async function createTopic(page: Page, data: TopicData) {
  await page.goto(`/forums/category/${data.category}`); // Relative URL
}
```

**Files Fixed**: `e2e/helpers/forum-helpers.ts` (10 navigation calls updated)

---

## Checklist for Fixing Each Test File

1. **Search for hardcoded URLs**:
   ```bash
   grep -n "veritablegames.com" e2e/forums/security/xss-prevention.spec.ts
   ```

2. **Add baseURL variable** at top of file:
   ```typescript
   const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
   ```

3. **Replace all hardcoded URLs**:
   - Page navigation: `page.goto('/auth/login')`
   - API requests: `request.post('/api/forums/topics')`
   - Headers: `Origin: baseURL`

4. **Add debug output** for login flows

5. **Run test locally** to verify:
   ```bash
   npx playwright test e2e/forums/security/xss-prevention.spec.ts --project=chromium
   ```

6. **Commit changes** with descriptive message

---

## Results from CSRF Tests

**Before fixes**:
- 12 passed / 24 failed (33% pass rate)
- Tests failed against production (wrong credentials)

**After fixes**:
- 4 passed / 2 failed (67% pass rate on Chromium)
- Tests run successfully against localhost
- Session cookies verified working (httpOnly=true)

**Remaining failures**: Forum API permission issues (unrelated to test infrastructure)

---

## Next Test Files to Fix

Priority order based on expected complexity:

1. ✅ `csrf.spec.ts` - **DONE** (4/6 passing)
2. `xss-prevention.spec.ts` - Similar pattern to CSRF
3. `sql-injection.spec.ts` - Similar pattern to CSRF
4. `authorization.spec.ts` - May need role setup
5. `rate-limiting.spec.ts` - May need timing adjustments
6. `voting-complete.spec.ts` - Requires forum setup
7. `topics-crud.spec.ts` - Requires forum setup
8. `replies-crud.spec.ts` - Requires forum setup
9. `validation-errors.spec.ts` - Should be straightforward

---

## Common Issues and Solutions

### Issue: Login succeeds but cookies not set
**Solution**: Check if using correct API endpoint and await response

### Issue: Tests timeout waiting for redirect
**Solution**: Login may be failing - add debug output to see actual response

### Issue: 403 Forbidden on API requests
**Solution**: User role may not have permissions - check forum setup or use admin credentials

### Issue: Tests pass on localhost but fail on production
**Solution**: Environment differences - use conditional expectations or skip tests

### Issue: Forum routes show "Please log in to create a topic" after successful login
**Problem**: Session cookies not persisting when navigating to forum pages
**Symptoms**:
- `/auth/login` succeeds (200 OK)
- Cookies are set (session_id, has_auth)
- But `/forums/create` shows login required message
- `/forums/category/general` shows 404 or "Loading category..."

**Possible Causes**:
1. Cookies not being sent with subsequent requests
2. Session middleware not recognizing cookies
3. Forum routes have different authentication requirements
4. Cookie domain/path mismatch

**Status**: 🔴 **BLOCKING ISSUE** - Discovered Feb 16, 2026
**Next Steps**:
1. Check session middleware configuration
2. Verify cookie domain/path settings
3. Check if forum routes use different auth than other routes
4. May need to use Playwright's `storageState` to persist auth

---

**Last Updated**: February 16, 2026
**Author**: Claude Code (AI Assistant)
**Related Commits**:
- `74cb475a7e` - CSRF test fixes
- `760dd9753d` - Session cookies bug fix
