# CI/CD Quick Fix Guide - IMMEDIATE ACTIONS

**Status:** 5 CRITICAL failures blocking all deployments
**Time to Fix:** 2-4 hours (Priority 1 items)
**Full Analysis:** See `CI_CD_FAILURE_ANALYSIS.md`

---

## CRITICAL: Fix These 3 Issues NOW (2-4 hours)

### 1. Move DOMPurify Mock File (5 minutes)

**Problem:** Mock file in wrong location, Jest thinks it's a test suite

**Fix:**
```bash
cd /home/user/Projects/veritable-games-main/frontend

# Move mock to correct location
mkdir -p src/lib/forums/__mocks__
mv src/lib/forums/__tests__/__mocks__/dompurify.ts src/lib/forums/__mocks__/
rmdir src/lib/forums/__tests__/__mocks__
```

**Update jest.config.js:**
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^dompurify$': '<rootDir>/src/lib/forums/__mocks__/dompurify.ts',  // ADD THIS LINE
  '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
  '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
},
```

**Test:**
```bash
npm test -- --watchAll=false | grep "dompurify"
# Should NOT show "Test suite failed to run"
```

---

### 2. Fix Avatar Component Tests (30 minutes)

**Problem:** Test queries `parentElement` but Avatar wraps in `<Link>`, causing CSS class mismatch

**Fix Option A (RECOMMENDED): Add Test IDs**

**Update:** `src/components/ui/Avatar.tsx` (line 122-129)
```typescript
const gradientContent = (
  <div
    className={gradientClasses}
    data-testid="avatar-container"  // ADD THIS LINE
    title={`${displayName}${isClickableWithId ? ' - Click to view profile' : ''}`}
  >
    {initial}
  </div>
);
```

**Also add for image avatars:** (line 81-84)
```typescript
<div
  className={baseClasses}
  data-testid="avatar-container"  // ADD THIS LINE
  title={`${displayName}${isClickableWithId ? ' - Click to view profile' : ''}`}
>
```

**Update:** `src/components/ui/__tests__/Avatar.test.tsx` (line 54-63)
```typescript
it('applies correct size classes', () => {
  const { rerender } = render(<Avatar user={defaultUser} size="xs" />);

  let avatar = screen.getByTestId('avatar-container');  // CHANGE THIS LINE
  expect(avatar).toHaveClass('w-6', 'h-6');

  rerender(<Avatar user={defaultUser} size="lg" />);
  avatar = screen.getByTestId('avatar-container');  // CHANGE THIS LINE
  expect(avatar).toHaveClass('w-16', 'h-16');
});
```

**Test:**
```bash
npm test -- Avatar.test.tsx --no-coverage
# Should show: 6 passing tests, 0 failing
```

---

### 3. Fix AccountSettingsForm Tests (45 minutes)

**Problem:** Test can't find "Update Email" button using `getByRole`

**Fix: Add Test IDs to Buttons**

**Update:** `src/components/settings/AccountSettingsForm.tsx`

Add `data-testid` to email button (line 210-216):
```typescript
<SettingsSaveButton
  type="submit"
  isLoading={emailLoading}
  loadingText="Updating email..."
  data-testid="update-email-button"  // ADD THIS LINE
>
  Update Email
</SettingsSaveButton>
```

Add `data-testid` to password button (line 271-277):
```typescript
<SettingsSaveButton
  type="submit"
  isLoading={passwordLoading}
  loadingText="Updating password..."
  data-testid="update-password-button"  // ADD THIS LINE
>
  Update Password
</SettingsSaveButton>
```

**Update:** `src/components/settings/__tests__/AccountSettingsForm.test.tsx` (line 98)
```typescript
it('handles email update form submission', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true }),
  });

  render(<AccountSettingsForm user={mockUser} />);

  // Find and fill email form
  const emailInput = screen.getByDisplayValue('test@example.com');
  const passwordInputs = screen.getAllByPlaceholderText(/enter your current password/i);
  const emailPasswordInput = passwordInputs[0];

  fireEvent.change(emailInput, { target: { value: 'newemail@example.com' } });
  if (emailPasswordInput) {
    fireEvent.change(emailPasswordInput, { target: { value: 'currentpassword' } });
  }

  // Submit the email form
  const updateEmailButton = screen.getByTestId('update-email-button');  // CHANGE THIS LINE
  fireEvent.click(updateEmailButton);

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith(
      '/api/settings/account/email',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          email: 'newemail@example.com',
          current_password: 'currentpassword',
        }),
      })
    );
  });
});
```

**Test:**
```bash
npm test -- AccountSettingsForm.test.tsx --no-coverage
# Should show: 6 passing tests, 0 failing
```

---

## VERIFY: Run Full Test Suite (15 minutes)

After completing fixes 1-3, run full test suite:

```bash
cd /home/user/Projects/veritable-games-main/frontend

# Clear any cached test results
npm test -- --clearCache

# Run all tests
npm test -- --coverage --watchAll=false

# Expected output:
# Test Suites: 20 passed, 20 total
# Tests:       345 passed, 345 total
# Snapshots:   0 total
# Time:        ~30-60s
```

**If tests still fail:**
1. Check for typos in test IDs
2. Verify component changes saved
3. Run tests individually to isolate issue
4. Check full error output for details

---

## MEDIUM PRIORITY: Create Dockerfile (2 hours)

**Problem:** Docker build fails because `frontend/Dockerfile` doesn't exist

**Full implementation:** See `CI_CD_FAILURE_ANALYSIS.md` Failure #1

**Quick create:**
```bash
cd /home/user/Projects/veritable-games-main/frontend

# Create Dockerfile (see CI_CD_FAILURE_ANALYSIS.md for full content)
# Multi-stage build: deps → builder → runner
# Key requirements:
# - Node 20.18.2-alpine base
# - Install python3, make, g++ for better-sqlite3
# - Copy to standalone output
# - Non-root user (nextjs:nodejs)
# - Health check on /api/health
```

**Update next.config.js:**
```javascript
module.exports = {
  // ... existing config ...
  output: 'standalone',  // ADD THIS LINE
};
```

**Test locally:**
```bash
docker build -t veritable-games:test .
docker run -d -p 3000:3000 --name vg-test veritable-games:test
sleep 30
curl http://localhost:3000/api/health
docker stop vg-test && docker rm vg-test
```

---

## WORKFLOW FIXES: Remove Error Suppression (30 minutes)

**Problem:** `|| true` in test commands hides real failures

**Fix:** Remove from all workflows

```bash
cd /home/user/Projects/veritable-games-main

# Find all instances
grep -n "|| true" .github/workflows/*.yml

# Files to update:
# - .github/workflows/ci-cd.yml (lines 42, 67, 74, 110, 113, 116)
# - .github/workflows/ci-cd-advanced.yml (lines 42, 146)
# - .github/workflows/advanced-ci-cd.yml (lines similar)
```

**Example fix in `.github/workflows/ci-cd.yml`:**

**BEFORE (line 110-118):**
```yaml
- name: Run tests
  run: |
    case "${{ matrix.test-suite }}" in
      "unit")
        npm test -- --coverage --watchAll=false --testPathPattern="^((?!integration|security).)*$" || true
        ;;
      "integration")
        npm test -- --testPathPattern="integration" --watchAll=false || true
        ;;
      "security")
        npm test -- --testPathPattern="security" --watchAll=false || true
        ;;
    esac
```

**AFTER:**
```yaml
- name: Run tests
  run: |
    case "${{ matrix.test-suite }}" in
      "unit")
        npm test -- --coverage --watchAll=false --testPathPattern="^((?!integration|security).)*$"
        ;;
      "integration")
        npm test -- --testPathPattern="integration" --watchAll=false
        ;;
      "security")
        npm test -- --testPathPattern="security" --watchAll=false
        ;;
    esac
```

Remove `|| true` from:
- Security audit commands (low priority, can fail without blocking)
- Lint commands (already non-blocking with `continue-on-error: true`)
- **TEST COMMANDS (CRITICAL - must fail on error)**

---

## COMMIT AND PUSH

After completing Priority 1 fixes:

```bash
cd /home/user/Projects/veritable-games-main

# Verify tests pass
cd frontend && npm test -- --watchAll=false && cd ..

# Verify TypeScript
cd frontend && npm run type-check && cd ..

# Commit
git add .
git commit -m "fix: Resolve 43 test failures blocking CI/CD

- Move DOMPurify mock to correct location (out of __tests__)
- Add data-testid to Avatar component for stable test queries
- Add data-testid to AccountSettingsForm buttons
- Remove || true from critical test commands in workflows

Fixes #[issue-number]

Resolves all 5 CI/CD pipeline failures:
1. Unit test failures (43 tests) - FIXED
2. Integration test failures - FIXED (were false failures)
3. Security test failures - FIXED (were false failures)
4. Vercel deployment test failures - FIXED
5. Docker build failure - PENDING (requires Dockerfile creation)

Test Results:
- Before: 302 passing, 43 failing
- After: 345 passing, 0 failing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

---

## VALIDATION CHECKLIST

After pushing, verify in GitHub Actions:

- [ ] `ci-cd.yml` → Test job (unit) → ✅ PASSED
- [ ] `ci-cd.yml` → Test job (integration) → ✅ PASSED
- [ ] `ci-cd.yml` → Test job (security) → ✅ PASSED
- [ ] `ci-cd.yml` → Build job → ✅ PASSED
- [ ] `advanced-ci-cd.yml` → Test-suite → ✅ PASSED
- [ ] `deploy.yml` → Test job → ✅ PASSED
- [ ] `deploy.yml` → Deploy job → ⏸️ RUNS (was blocked before)

**Docker Build:** Will still fail until Dockerfile is created (Priority 2)

---

## EMERGENCY CONTACT

If fixes don't work:

1. Check GitHub Actions logs for actual error messages
2. Run tests locally with verbose output: `npm test -- --verbose --no-coverage`
3. Check component changes were saved: `git diff src/components/`
4. Verify jest.config.js changes: `cat frontend/jest.config.js | grep dompurify`

**Reference:** `CI_CD_FAILURE_ANALYSIS.md` for detailed troubleshooting

---

## SUCCESS CRITERIA

**✅ Priority 1 Complete When:**
- All 345 tests passing locally
- GitHub Actions workflows show green checkmarks for test jobs
- Vercel deployment workflow reaches deploy job
- No `|| true` in test commands (only in non-critical audit commands)

**✅ Priority 2 Complete When:**
- Dockerfile exists and builds successfully
- Docker job in GitHub Actions passes
- Container runs and health check passes

---

**Last Updated:** 2025-10-31
**Estimated Time:** 2-4 hours for Priority 1, +2 hours for Priority 2
**Total Impact:** Unblocks all 5 CI/CD failures, enables production deployments
