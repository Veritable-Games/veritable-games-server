# Test Failures Analysis & Fix Guide

**Generated:** 2025-11-01
**Context:** Phase 3 of CI/CD fixes
**Current Status:** 11 pool tests fixed, 28 tests remaining
**Test Suite:** 318 passing, 28 failing, 2 skipped (347 total)

---

## Executive Summary

### Progress Made ✅
- **Database Pool Tests**: 11/11 passing (was 0/11) - **FIXED**
- **Foundation**: Real database connections working in tests
- **Infrastructure**: CI/CD workflows honest, Docker building

### Remaining Work ⏳
- **API Endpoint Tests**: 7 failures (CSRF token setup needed)
- **Navigation Component**: 10 failures (component updated, tests outdated)
- **LoginForm Component**: 4 failures (query strategy issues)
- **AccountSettingsForm**: 3 failures (component text changed)
- **Misc Tests**: ~4 failures (various issues)

**Total Remaining**: 28 test failures across 5 categories

---

## Test Failure Categories

### Category 1: API Endpoint Tests (7 failures) 🔴 **CRITICAL**

**Priority**: HIGH (Security-related)
**Complexity**: MEDIUM
**Estimated Time**: 2-3 hours
**Risk**: Medium

#### Failing Tests:
1. `GET /api/health` - should return healthy status (503 vs 200)
2. `POST /api/auth/login` - should reject empty credentials (403 vs 400)
3. `POST /api/auth/login` - should reject invalid credentials (403 vs 401)
4. `POST /api/auth/login` - should validate input format (403 vs 400)
5. `POST /api/auth/register` - should validate email format (403 vs 400)
6. `POST /api/auth/register` - should enforce password requirements (403 vs 400)
7. `CORS Headers` - should include appropriate CORS headers (503 vs 200)

#### Root Cause:
All tests are getting **403 Forbidden** instead of expected status codes because:
- `withSecurity` middleware requires CSRF tokens
- Test requests don't include CSRF tokens or cookies
- Security middleware blocks requests before validation logic runs

#### Example Error:
```typescript
expect(response.status).toBe(400);
// Received: 403 (Forbidden - CSRF token missing)
```

#### Fix Strategy:

**Option A: Add CSRF Token Helper** (Recommended)
```typescript
// Create test helper: src/__tests__/helpers/csrf.ts
export function createAuthenticatedRequest(
  url: string,
  options: RequestInit = {}
): NextRequest {
  const csrfToken = 'test-csrf-token';

  return new NextRequest(url, {
    ...options,
    headers: {
      'x-csrf-token': csrfToken,
      'cookie': `csrf-token=${csrfToken}`,
      ...options.headers,
    },
  });
}

// Update tests to use helper:
const request = createAuthenticatedRequest(
  'http://localhost:3000/api/auth/login',
  {
    method: 'POST',
    body: JSON.stringify({ username: '', password: '' }),
  }
);
```

**Option B: Mock withSecurity Middleware**
```typescript
// In test file
jest.mock('@/lib/security/middleware', () => ({
  withSecurity: (handler: any) => handler,
}));
```

**Option C: Add Test Mode to withSecurity**
```typescript
// In middleware.ts
if (process.env.NODE_ENV === 'test' && process.env.BYPASS_SECURITY) {
  return handler(request, params);
}
```

#### Implementation Steps:
1. Create CSRF helper in `src/__tests__/helpers/csrf.ts`
2. Update each test to use `createAuthenticatedRequest()`
3. Add mock session cookie if needed
4. Verify all 7 tests pass

#### Time Estimate:
- Helper creation: 30 min
- Update 7 tests: 60 min
- Debug & verify: 30 min
- **Total**: 2 hours

---

### Category 2: Navigation Component Tests (10 failures) 🟡 **MEDIUM**

**Priority**: MEDIUM (UI/UX)
**Complexity**: LOW-MEDIUM
**Estimated Time**: 2-3 hours
**Risk**: Low

#### Failing Tests:
1. renders navigation with logo and brand text
2. highlights active navigation item
3. shows mobile menu button on mobile
4. toggles mobile menu when button is clicked
5. closes mobile menu when navigation item is clicked
6. handles active state for root path correctly
7. handles active state for sub-paths correctly
8. has proper accessibility attributes
9. applies hover styles correctly
10. maintains responsive design classes

#### Root Cause:
The Navigation component has been updated but tests still expect old structure:
- Logo alt text changed
- CSS classes updated
- Mobile menu structure changed
- Active state logic changed

#### Example Errors:
```
Unable to find an element with the alt text: Veritable Games Logo
// Component now uses different alt text or structure

expect(element).toHaveClass("text-blue-600 dark:text-blue-400")
// Component uses different active state classes

Found multiple elements with the role "navigation"
// Component structure changed - more specific queries needed
```

#### Fix Strategy:

**Step 1: Update Logo Test**
```typescript
// Before:
const logo = screen.getByAltText('Veritable Games Logo');

// After: Check what's actually in the component
const logo = screen.getByRole('img', { name: /veritable/i });
// Or use data-testid:
const logo = screen.getByTestId('nav-logo');
```

**Step 2: Update Active State Tests**
```typescript
// Add data-testid to Navigation.tsx:
<Link
  href={item.href}
  data-testid={`nav-link-${item.name.toLowerCase()}`}
  className={isActive ? activeClasses : inactiveClasses}
>

// Update test:
const homeLink = screen.getByTestId('nav-link-home');
expect(homeLink).toHaveClass(/* current active classes */);
```

**Step 3: Fix Mobile Menu Tests**
```typescript
// Use more specific queries:
const mobileMenuButton = screen.getByRole('button', {
  name: /menu|navigation/i
});

// Or add data-testid:
<button data-testid="mobile-menu-toggle">
```

#### Implementation Steps:
1. Read Navigation.tsx to understand current structure
2. Add `data-testid` attributes to key elements
3. Update tests to match current CSS classes
4. Fix mobile menu queries (use testId or more specific roles)
5. Update accessibility attribute expectations

#### Time Estimate:
- Component analysis: 30 min
- Add data-testids: 30 min
- Update 10 tests: 90 min
- Verify & debug: 30 min
- **Total**: 3 hours

---

### Category 3: LoginForm Component Tests (4 failures) 🟡 **MEDIUM**

**Priority**: MEDIUM (Core functionality)
**Complexity**: LOW
**Estimated Time**: 1-2 hours
**Risk**: Low

#### Failing Tests:
1. renders login form with all required fields
2. validates required fields
3. submits form with valid credentials
4. displays error message for invalid credentials

#### Root Cause:
All 4 tests fail with same error:
```
Unable to find an accessible element with the role "button" and name `/log in/i`
```

The button text or structure changed, so the query can't find it.

#### Example Error:
```typescript
const loginButton = screen.getByRole('button', { name: /log in/i });
// Error: Can't find button with that name
```

#### Fix Strategy:

**Quick Fix: Use data-testid**
```typescript
// In LoginForm.tsx:
<button
  type="submit"
  data-testid="login-submit-button"
>
  Login {/* or "Log In" or "Sign In" - check actual text */}
</button>

// In tests:
const loginButton = screen.getByTestId('login-submit-button');
```

**Better Fix: Match Actual Button Text**
```typescript
// First, check what the button actually says:
screen.debug(); // In test to see rendered output

// Then update query:
const loginButton = screen.getByRole('button', { name: /login/i });
// or
const loginButton = screen.getByRole('button', { name: 'Login' });
```

#### Implementation Steps:
1. Check actual button text in LoginForm.tsx
2. Add `data-testid="login-submit-button"` to submit button
3. Update all 4 tests to use `getByTestId('login-submit-button')`
4. Alternatively: Update queries to match actual button text
5. Check for "Forgot Password" link issue (from earlier output)

#### Time Estimate:
- Component check: 15 min
- Add data-testid: 10 min
- Update 4 tests: 30 min
- Fix forgot password link: 30 min
- **Total**: 1.5 hours

---

### Category 4: AccountSettingsForm Tests (3 failures) 🟢 **LOW**

**Priority**: LOW (Non-critical UI)
**Complexity**: LOW
**Estimated Time**: 1 hour
**Risk**: Very Low

#### Failing Tests:
1. renders all sections correctly
2. shows coming soon buttons for security features
3. displays security notice

#### Root Cause:
Component was updated but tests still expect old text:
- "Coming Soon" buttons removed or text changed
- "Enhanced Security Coming Soon" notice removed
- "Email Address" appears multiple times (heading + label)

#### Example Errors:
```
Found multiple elements with the text: Email Address
// Need more specific query

Unable to find an element with the text: Coming Soon
// Component no longer has this text

Unable to find an element with the text: Enhanced Security Coming Soon
// Component text changed to "Advanced Security Features"
```

#### Fix Strategy:

**Fix 1: Multiple "Email Address" Elements**
```typescript
// Before:
expect(screen.getByText('Email Address')).toBeInTheDocument();

// After: Be more specific
expect(screen.getByRole('heading', { name: 'Email Address' })).toBeInTheDocument();
// Or use getAllByText and check length:
const emailTexts = screen.getAllByText('Email Address');
expect(emailTexts.length).toBeGreaterThan(0);
```

**Fix 2: Update Expected Text**
```typescript
// Before:
expect(screen.getByText('Coming Soon')).toBeInTheDocument();

// After: Check what's actually there
// If removed: Delete this test or update to check current state
// If changed: Update to new text
expect(screen.getByText('Advanced Security Features')).toBeInTheDocument();
```

**Fix 3: Update Security Notice**
```typescript
// Before:
expect(screen.getByText('Enhanced Security Coming Soon')).toBeInTheDocument();

// After: Update to match current component
// Or remove test if feature was fully implemented
```

#### Implementation Steps:
1. Read AccountSettingsForm.tsx to see current text
2. Update test #1 to use `getByRole('heading')` for "Email Address"
3. Update tests #2 and #3 with current security feature text
4. Or remove tests if features were implemented/removed

#### Time Estimate:
- Component review: 15 min
- Update 3 tests: 30 min
- Verify: 15 min
- **Total**: 1 hour

---

### Category 5: Misc Tests (~4 failures) 🟢 **LOW**

**Priority**: LOW
**Complexity**: VARIES
**Estimated Time**: 1-2 hours
**Risk**: Low

#### Likely Issues:
Based on earlier output, these might include:
- Forum stats tests
- SSE (Server-Sent Events) tests
- Other component tests
- Integration tests

#### Investigation Needed:
Run full test suite and categorize remaining ~4 failures:
```bash
npm test -- --watchAll=false | grep "●" -A 5 > remaining-failures.txt
```

#### Fix Strategy:
- Similar patterns to above categories
- Add data-testids where needed
- Update text expectations
- Fix query strategies

#### Time Estimate:
- Investigate: 30 min
- Fix each: 15-30 min
- **Total**: 1-2 hours

---

## Implementation Roadmap

### Phase 3a: Quick Wins (3-4 hours)
**Goal**: Fix simplest categories first

1. **AccountSettingsForm** (1 hour)
   - Low complexity
   - Only 3 tests
   - Text update fixes

2. **LoginForm** (1.5 hours)
   - Low complexity
   - Only 4 tests
   - Button query fixes

3. **Misc Tests** (1-2 hours)
   - Variable complexity
   - ~4 tests
   - Investigate & fix

**After Phase 3a**: ~11 tests fixed, 17 remaining

---

### Phase 3b: Medium Effort (5-6 hours)
**Goal**: Fix component tests

1. **Navigation Component** (3 hours)
   - 10 tests
   - Moderate complexity
   - Component structure updates

2. **API Endpoint Tests** (2-3 hours)
   - 7 tests
   - CSRF token setup
   - Security implications

**After Phase 3b**: All 28 tests fixed ✅

---

### Phase 3c: Verification (30 min)
1. Run full test suite
2. Verify 347/347 tests passing
3. Check test coverage
4. Update documentation

---

## Priority Matrix

| Category | Tests | Priority | Complexity | Time | Order |
|----------|-------|----------|------------|------|-------|
| AccountSettings | 3 | LOW | LOW | 1h | 1st |
| LoginForm | 4 | MEDIUM | LOW | 1.5h | 2nd |
| Misc Tests | ~4 | LOW | VARIES | 1-2h | 3rd |
| Navigation | 10 | MEDIUM | MED | 3h | 4th |
| API Endpoints | 7 | HIGH | MED | 2-3h | 5th |

**Total Time**: 8.5-11.5 hours

---

## Common Patterns & Solutions

### Pattern 1: Text Not Found
**Error**: `Unable to find an element with the text: X`

**Causes**:
- Text changed in component
- Text broken across multiple elements
- Text is in different case

**Solutions**:
```typescript
// Use regex for flexible matching:
screen.getByText(/text/i);

// Use function matcher:
screen.getByText((content, element) => content.includes('text'));

// Use data-testid:
screen.getByTestId('element-id');

// Check all text:
screen.debug();
```

### Pattern 2: Multiple Elements
**Error**: `Found multiple elements with the text: X`

**Solutions**:
```typescript
// Be more specific with role:
screen.getByRole('heading', { name: 'X' });

// Use getAllBy and select index:
const elements = screen.getAllByText('X');
expect(elements[0]).toBeInTheDocument();

// Add data-testid to distinguish:
screen.getByTestId('specific-x');
```

### Pattern 3: Button Not Found
**Error**: `Unable to find button with name /X/i`

**Solutions**:
```typescript
// Check actual button text:
screen.debug();

// Use data-testid:
screen.getByTestId('submit-button');

// Use different query:
screen.getByRole('button', { name: 'Exact Text' });
```

### Pattern 4: Wrong Status Code (API Tests)
**Error**: `Expected: 400, Received: 403`

**Solutions**:
```typescript
// Add CSRF token:
const request = new NextRequest(url, {
  headers: {
    'x-csrf-token': 'test-token',
    'cookie': 'csrf-token=test-token',
  },
});

// Mock security middleware:
jest.mock('@/lib/security/middleware');

// Add test mode:
process.env.BYPASS_SECURITY = 'true';
```

---

## Testing Best Practices

### 1. Use data-testid for Complex Queries
```typescript
// Good: Resilient to text changes
<button data-testid="submit-btn">Submit</button>
screen.getByTestId('submit-btn');

// Fragile: Breaks when text changes
screen.getByText('Submit');
```

### 2. Prefer Role Queries When Possible
```typescript
// Best: Accessible and semantic
screen.getByRole('button', { name: /submit/i });

// Good: Works but less semantic
screen.getByTestId('submit-btn');

// Avoid: Fragile
screen.getByText('Submit').parentElement;
```

### 3. Make Tests Resilient
```typescript
// Bad: Exact class matching
expect(element).toHaveClass('text-blue-600 dark:text-blue-400');

// Good: Check for presence
expect(element.className).toContain('text-blue');

// Better: Test behavior, not implementation
expect(element).toHaveAttribute('aria-current', 'page');
```

---

## Success Criteria

### Test Suite Goals:
- ✅ 347/347 tests passing (100%)
- ✅ No skipped tests (currently 2 skipped)
- ✅ Test coverage >80%
- ✅ All critical paths tested

### Quality Metrics:
- No flaky tests
- Fast execution (<5 seconds)
- Clear error messages
- Good test isolation

---

## Next Steps

### Immediate (Today):
1. Read this document
2. Choose starting category (recommend: AccountSettingsForm)
3. Fix tests following strategies above
4. Commit fixes incrementally

### This Week:
1. Complete Phase 3a (Quick Wins)
2. Start Phase 3b (Medium Effort)
3. Update test documentation

### This Month:
1. Complete all test fixes
2. Achieve 100% pass rate
3. Add new tests for uncovered code
4. Set up test coverage monitoring

---

## Related Documentation

- [CI_CD_CURRENT_STATUS.md](./CI_CD_CURRENT_STATUS.md) - Current CI/CD status
- [docs/guides/TESTING.md](./docs/guides/TESTING.md) - Testing guide
- [docs/COMMON_PITFALLS.md](./docs/COMMON_PITFALLS.md) - Common mistakes

---

## Change Log

| Date | Change | Tests Fixed | Remaining |
|------|--------|-------------|-----------|
| 2025-11-01 | Pool tests fixed | 11 | 28 |
| TBD | AccountSettings | +3 | 25 |
| TBD | LoginForm | +4 | 21 |
| TBD | Misc Tests | +4 | 17 |
| TBD | Navigation | +10 | 7 |
| TBD | API Endpoints | +7 | 0 |

---

**Last Updated**: 2025-11-01
**Status**: Pool tests fixed (11/11 passing), 28 tests remaining
**Next Action**: Start with AccountSettingsForm (easiest category)
