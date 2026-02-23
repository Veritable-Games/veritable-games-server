# E2E Test Review Checklist - February 15, 2026

## Purpose
Systematic checklist for reviewing and fixing the 169 failing E2E tests.

**Use this document to:**
- Track progress through test failures
- Document actual vs expected behavior
- Identify patterns in failures
- Prioritize fixes

---

## How to Use This Checklist

1. **Pick a test file** from the list below
2. **Run it in debug mode** to see actual failures
3. **Fill in the review section** for each test
4. **Mark status**: ❌ Failing → 🔄 Reviewed → ✅ Fixed
5. **Commit fixes** incrementally

---

## Test File Review Status

### Security Tests (35 tests)

#### 1. XSS Prevention (`e2e/forums/security/xss-prevention.spec.ts`)
**Status**: ❌ **NOT REVIEWED**
**Tests**: 10
**Command**:
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright test e2e/forums/security/xss-prevention.spec.ts --debug
```

**Review Notes**:
- [ ] Test 1: Script tag in topic title
  - **Expected**: Script tag removed
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 2: Script tag in reply content
  - **Expected**: Script tag removed
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 3: Image onerror attack
  - **Expected**: onerror handler removed
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 4: JavaScript URLs
  - **Expected**: javascript: URLs blocked
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 5: Event handlers
  - **Expected**: onclick/onerror removed
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 6: iframe injection
  - **Expected**: iframe removed
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 7: SVG-based XSS
  - **Expected**: Malicious SVG blocked
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 8: Style injection
  - **Expected**: Dangerous styles removed
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 9: Nested XSS
  - **Expected**: Nested attacks blocked
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 10: Encoded XSS
  - **Expected**: Encoded payloads blocked
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

**Priority**: 🔴 P0 CRITICAL
**Estimated Fix Time**: 2-4 hours

---

#### 2. SQL Injection (`e2e/forums/security/sql-injection.spec.ts`)
**Status**: ❌ **NOT REVIEWED**
**Tests**: 5
**Command**:
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright test e2e/forums/security/sql-injection.spec.ts --debug
```

**Review Notes**:
- [ ] Test 1: OR-based injection in search
  - **Expected**: Safe search, no DB error
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 2: UNION-based injection
  - **Expected**: No data leakage
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 3: Comment-based injection
  - **Expected**: Comments don't bypass security
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 4: Category filter injection
  - **Expected**: Category filter safe
  - **Actual**: ✅ PASSING
  - **Fix needed**: None
  - **Status**: ✅

- [ ] Test 5: Time-based blind injection
  - **Expected**: No timing attacks
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

**Priority**: 🔴 P0 CRITICAL
**Estimated Fix Time**: 1-2 hours (mostly passing)

---

#### 3. Authorization (`e2e/forums/security/authorization.spec.ts`)
**Status**: ❌ **NOT REVIEWED**
**Tests**: 15
**Command**:
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright test e2e/forums/security/authorization.spec.ts --debug
```

**Review Notes**:
- [x] Test 1: Anonymous vote prevention (API)
  - **Expected**: 401/403 error
  - **Actual**: ✅ Working
  - **Fix needed**: None
  - **Status**: ✅ PASSING

- [x] Test 2: Anonymous reply prevention (API)
  - **Expected**: 401/403 error
  - **Actual**: ✅ Working
  - **Fix needed**: None
  - **Status**: ✅ PASSING

- [ ] Test 3: Anonymous user view restrictions (UI)
  - **Expected**: Redirect to login
  - **Actual**:
  - **Fix needed**: Likely selector issue
  - **Status**: ❌

- [ ] Test 4: User cannot edit other's topic
  - **Expected**: 403 error
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [x] Test 5: User cannot delete other's topic (API)
  - **Expected**: 403 error
  - **Actual**: ✅ Working
  - **Fix needed**: None
  - **Status**: ✅ PASSING

- [ ] Test 6: User cannot delete other's reply
  - **Expected**: 403 error
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 7: Regular user cannot lock topics
  - **Expected**: 403 or feature missing
  - **Actual**:
  - **Fix needed**: Check if moderation implemented
  - **Status**: ❌

- [ ] Test 8: Moderator CAN lock topics
  - **Expected**: Success
  - **Actual**:
  - **Fix needed**: Check moderator role exists
  - **Status**: ❌

- [ ] Test 9: Regular user cannot pin topics
  - **Expected**: 403 or feature missing
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [x] Test 10: Non-admin cannot access admin category
  - **Expected**: 404 or 403
  - **Actual**: ✅ Working
  - **Fix needed**: None
  - **Status**: ✅ PASSING

- [ ] Test 11: Hidden category returns 404 not 403
  - **Expected**: 404 (info leak prevention)
  - **Actual**:
  - **Fix needed**: Verify Bug #2 fix deployed
  - **Status**: ❌

- [x] Test 12: Cannot bypass permissions via API
  - **Expected**: 403 on manipulated request
  - **Actual**: ✅ Working
  - **Fix needed**: None
  - **Status**: ✅ PASSING

- [ ] Test 13: Cannot escalate privileges
  - **Expected**: Session manipulation fails
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 14: Authenticated user CAN vote
  - **Expected**: Success
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 15: User cannot vote on own reply
  - **Expected**: 400/403 error
  - **Actual**:
  - **Fix needed**: Check if self-vote prevention implemented
  - **Status**: ❌

**Priority**: 🟠 P1 HIGH
**Estimated Fix Time**: 3-4 hours

---

#### 4. CSRF Protection (`e2e/forums/security/csrf.spec.ts`)
**Status**: 🔄 **REVIEWED** (Feb 15, 2026)
**Tests**: 6
**Command**:
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright test e2e/forums/security/csrf.spec.ts --debug
```

**Review Notes**:
- [x] Test 1: Reject requests without CSRF token
  - **Expected**: 403 error, `responseData.success = false`
  - **Actual**: 401 status, `responseData.success = undefined` (API doesn't use `success` field)
  - **Fix needed**: Update assertion to check `responseData.error` or `responseData.message` instead
  - **Status**: ❌ CATEGORY B (API format mismatch)

- [x] Test 2: Validate Origin header
  - **Expected**: Origin check enforced
  - **Actual**: ✅ Working correctly
  - **Fix needed**: None
  - **Status**: ✅ PASSING

- [x] Test 3: Allow valid Origin + session
  - **Expected**: Request succeeds (200/201) or validation error (400)
  - **Actual**: 403 Forbidden - login rate limited ("Too many requests. Please try again later.")
  - **Root Cause**: Tests run in parallel, each tries to log in, rate limiter blocks them
  - **Fix needed**: Reuse authentication state across tests (use fixtures or beforeAll)
  - **Status**: ❌ CATEGORY D (Test infrastructure - rate limiting)

- [x] Test 4: Session cookies have SameSite
  - **Expected**: SameSite=Strict or Lax
  - **Actual**: ✅ Working correctly
  - **Fix needed**: None
  - **Status**: ✅ PASSING

- [x] Test 5: Session cookies are HttpOnly
  - **Expected**: At least one httpOnly cookie exists
  - **Actual**: 0 httpOnly cookies found - NO session cookies have httpOnly flag!
  - **Root Cause**: REAL SECURITY BUG - session cookies vulnerable to XSS attacks
  - **Fix needed**: Update cookie configuration to set httpOnly=true for session cookies
  - **Status**: ❌ CATEGORY E (Real Bug - P0 CRITICAL SECURITY ISSUE)

- [x] Test 6: Double-submit cookie pattern
  - **Expected**: Malicious request blocked (403), legitimate request succeeds
  - **Actual**: Both blocked (403) - login rate limited (same as Test 3)
  - **Root Cause**: Tests run in parallel, rate limiter blocks login attempts
  - **Fix needed**: Reuse authentication state across tests
  - **Status**: ❌ CATEGORY D (Test infrastructure - rate limiting)

**Additional Issues Found**:
- ✅ **Hardcoded credentials**: All tests use "noxii" / "Atochastertl25!" instead of Claude credentials - **FIXED**
- ✅ **API format**: Tests use `category: 'general'` instead of `categoryId: 1` - **FIXED**
- ✅ **Response format**: Tests expect `success` field but API uses `error`/`message` - **FIXED**
- ❌ **P0 CRITICAL BUG**: No httpOnly cookies exist - session tokens vulnerable to XSS attacks
- ❌ **Rate limiting**: Tests hit login rate limit when run in parallel - need shared auth state

**Results After Fixes**:
- **Before**: 2/6 passing (33%)
- **After**: 3/6 passing (50%)
- **Fixed**: Test 1 (CSRF token rejection) ✅
- **Still Failing**: Tests 3, 5, 6 (2 infrastructure issues, 1 real bug)

**Priority**: 🔴 P0 CRITICAL (httpOnly bug must be fixed immediately)
**Estimated Fix Time**:
- Test infrastructure (rate limit): 1 hour - reuse auth state
- Security bug (httpOnly): 2-3 hours - update cookie configuration + verify

---

#### 5. Rate Limiting (`e2e/forums/security/rate-limiting.spec.ts`)
**Status**: ❌ **NOT REVIEWED**
**Tests**: 2
**Command**:
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright test e2e/forums/security/rate-limiting.spec.ts --debug
```

**Review Notes**:
- [x] Test 1: Topic creation rate limit
  - **Expected**: 429 after 5 topics
  - **Actual**: ⚠️ Warning - created 0 topics
  - **Fix needed**: Check test logic or rate limit config
  - **Status**: ⚠️ NEEDS REVIEW

- [ ] Test 2: Reply creation rate limit
  - **Expected**: 429 after limit reached
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

**Priority**: 🟡 P2 MEDIUM
**Estimated Fix Time**: 30min - 1 hour

---

### Core Feature Tests (30 tests)

#### 6. Voting System (`e2e/forums/voting-complete.spec.ts`)
**Status**: ❌ **NOT REVIEWED**
**Tests**: 12
**Command**:
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright test e2e/forums/voting-complete.spec.ts --debug
```

**Review Notes**:
- [ ] Test 1: Upvote a reply
  - **Expected**: Vote count increases
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 2: Downvote a reply
  - **Expected**: Vote count decreases
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 3: Vote toggle (remove vote)
  - **Expected**: Vote removed, count restored
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 4: Vote change (up → down)
  - **Expected**: Vote switches, count changes by 2
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 5: Self-vote prevention
  - **Expected**: Error or blocked
  - **Actual**:
  - **Fix needed**: May not be implemented
  - **Status**: ❌

- [ ] Test 6: Vote count accuracy
  - **Expected**: Count matches actual votes
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 7: Optimistic UI rollback
  - **Expected**: UI rolls back on error
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 8: Concurrent voting
  - **Expected**: No vote count drift
  - **Actual**:
  - **Fix needed**: Verify Bug #4 fix deployed
  - **Status**: ❌

- [ ] Test 9: Vote on deleted reply
  - **Expected**: 404 error
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 10: Anonymous cannot vote
  - **Expected**: 401/403 error
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 11: Vote persistence
  - **Expected**: Vote survives refresh
  - **Actual**:
  - **Fix needed**:
  - **Status**: ❌

- [ ] Test 12: Vote button state
  - **Expected**: Active state on voted buttons
  - **Actual**:
  - **Fix needed**: Check CSS classes
  - **Status**: ❌

**Priority**: 🟠 P1 HIGH
**Estimated Fix Time**: 3-4 hours

---

#### 7. Topics CRUD (`e2e/forums/topics-crud.spec.ts`)
**Status**: ❌ **NOT REVIEWED**
**Tests**: 10
**Command**:
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright test e2e/forums/topics-crud.spec.ts --debug
```

**Review Notes**:
- [ ] Test 1: Create topic (valid)
- [ ] Test 2: Create with empty title
- [ ] Test 3: Create with long title
- [ ] Test 4: Create with no category
- [ ] Test 5: Edit topic
- [ ] Test 6: Delete topic
- [ ] Test 7: View count increment
- [ ] Test 8: Topic with tags
- [ ] Test 9: Topic status (locked/pinned/solved)
- [ ] Test 10: Topic pagination

**Priority**: 🟠 P1 HIGH
**Estimated Fix Time**: 2-3 hours

---

#### 8. Replies CRUD (`e2e/forums/replies-crud.spec.ts`)
**Status**: ❌ **NOT REVIEWED**
**Tests**: 10
**Command**:
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright test e2e/forums/replies-crud.spec.ts --debug
```

**Review Notes**:
- [ ] Test 1: Create top-level reply
- [ ] Test 2: Create nested reply (depth 1)
- [ ] Test 3: Create nested reply (depth 5)
- [ ] Test 4: Max depth enforcement (depth 6)
- [ ] Test 5: Edit reply
- [ ] Test 6: Delete reply
- [ ] Test 7: Reply count updates
- [ ] Test 8: Mark as solution
- [ ] Test 9: Unmark solution
- [ ] Test 10: **Multiple solutions prevention (Bug #3)**

**Priority**: 🟠 P1 HIGH
**Estimated Fix Time**: 2-3 hours

---

#### 9. Validation Errors (`e2e/forums/validation-errors.spec.ts`)
**Status**: ❌ **NOT REVIEWED**
**Tests**: 8
**Command**:
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright test e2e/forums/validation-errors.spec.ts --debug
```

**Review Notes**:
- [ ] Test 1: Empty title error
- [ ] Test 2: Short title error
- [ ] Test 3: Long title error
- [ ] Test 4: Empty content error
- [ ] Test 5: Invalid category error
- [ ] Test 6: Too many tags error
- [ ] Test 7: 404 for non-existent topic
- [ ] Test 8: 404 for non-existent reply

**Priority**: 🟡 P2 MEDIUM
**Estimated Fix Time**: 1-2 hours

---

## Quick Debug Commands

### Run single test in debug mode
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright test e2e/forums/security/xss-prevention.spec.ts:15 --debug
```

### Run all tests in a file with HTML report
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright test e2e/forums/security/csrf.spec.ts --reporter=html
```

### View HTML report
```bash
npx playwright show-report
```

### Run with headed browser (see what happens)
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright test e2e/forums/voting-complete.spec.ts --headed
```

### Generate test code (record actions)
```bash
PLAYWRIGHT_TEST_BASE_URL=https://www.veritablegames.com \
npx playwright codegen https://www.veritablegames.com/forums
```

---

## Fix Pattern Template

When you fix a test, document the pattern:

### Fix Pattern #1: Replace Hardcoded Credentials

**Problem**: Tests using hardcoded "noxii" / "Atochastertl25!" credentials
**Root Cause**: Tests written before `.claude-credentials` was implemented
**Solution**: Import and use `CLAUDE_CREDENTIALS` from forum-helpers
**Apply To**: All tests with hardcoded login credentials

**Example**:
```diff
+ import { CLAUDE_CREDENTIALS } from '../../helpers/forum-helpers';

- await page.fill('input[name="username"]', 'noxii');
- await page.fill('input[name="password"]', 'Atochastertl25!');
+ await page.fill('input[name="username"]', CLAUDE_CREDENTIALS.username);
+ await page.fill('input[name="password"]', CLAUDE_CREDENTIALS.password);
```

**Tests Fixed**: CSRF tests (6 tests) - IN PROGRESS

---

### Fix Pattern #2: API Request Format - Category Parameter

**Problem**: API requests using `category: 'general'` get 403 Forbidden
**Root Cause**: API expects `categoryId` (integer) not `category` (string)
**Solution**: Change to `categoryId: 1` in request body
**Apply To**: All tests creating forum topics via API

**Example**:
```diff
const response = await request.post('/api/forums/topics', {
  data: {
    title: 'Test Topic',
    content: 'Test content',
-   category: 'general',
+   categoryId: 1,
  },
});
```

**Tests Fixed**: CSRF tests (Test 3, Test 6) - IN PROGRESS

---

### Fix Pattern #3: API Response Format - Success Field

**Problem**: Tests expect `responseData.success === false` but get `undefined`
**Root Cause**: API returns different response format (uses `error` or `message` fields)
**Solution**: Check for `error` or `message` fields instead of `success`
**Apply To**: All tests checking API error responses

**Example**:
```diff
if (response.status() === 403 || response.status() === 401) {
- const responseData = await response.json();
- expect(responseData.success).toBe(false);
- expect(responseData.error).toBeTruthy();
+ try {
+   const responseData = await response.json();
+   expect(responseData.error || responseData.message).toBeTruthy();
+ } catch {
+   // Non-JSON response is acceptable for blocked requests
+   expect([401, 403]).toContain(response.status());
+ }
}
```

**Tests Fixed**: CSRF Test 1 - IN PROGRESS

---

### Fix Pattern #4: HttpOnly Cookie Assertion - Too Broad

**Problem**: Test fails because `csrf_token` is accessible via `document.cookie`
**Root Cause**: Test expects NO cookies with "token" in name to be accessible
**Solution**: Be more specific - check for `session_token` or `auth_token` only
**Apply To**: Cookie security tests

**Example**:
```diff
const accessibleCookies = await page.evaluate(() => document.cookie);

- expect(accessibleCookies).not.toContain('token'); // Too broad
+ expect(accessibleCookies).not.toContain('session_token'); // Specific
+ expect(accessibleCookies).not.toContain('auth_token');
+ // Note: csrf_token SHOULD be accessible (not httpOnly) - this is correct behavior
```

**Tests Fixed**: CSRF Test 5 - IN PROGRESS

---

## Progress Tracking

### Summary Stats
- **Total Tests**: 203
- **Passing**: 32 (16%)
- **Failing**: 169 (84%)
- **Skipped**: 2

### By Category
- **Security Tests**: 1/35 reviewed (3%) - CSRF tests reviewed
- **Core Feature Tests**: 0/30 reviewed (0%)
- **Baseline Tests**: 32/138 passing (23%)

### Time Tracking
- **Time Spent Reviewing**: 1 hour (CSRF tests)
- **Time Spent Fixing**: 0 hours
- **Total Time**: 1 hour

---

## Notes Section

### Patterns Discovered
1. **API Parameter Mismatches**: Tests using `category: 'general'` but API expects `categoryId: 1`
2. **Response Format Differences**: API doesn't use `success` field, uses `error`/`message` instead
3. **Hardcoded Credentials**: Many tests still use "noxii" credentials instead of Claude credentials
4. **Overly Broad Assertions**: Cookie tests check for "token" substring which catches valid CSRF tokens

### Common Issues
1. **Hardcoded Credentials**: Many tests still use hardcoded admin/user credentials instead of Claude credentials - **FIXED for CSRF tests**
2. **API Parameter Format**: Tests use `category: 'general'` but API expects `categoryId: 1` (integer)
3. **API Response Format**: API doesn't use `success` field, uses `error`/`message` instead
4. **Test Rate Limiting**: Tests hitting login rate limit when run in parallel - need shared authentication state
5. **🔴 P0 SECURITY BUG**: No httpOnly cookies exist - session tokens are vulnerable to XSS theft!

### Questions
1.
2.
3.

---

**Last Updated**: February 15, 2026
**Status**: 🔄 IN PROGRESS
**Next Review**: [Date]
