# CI/CD Fix Implementation Checklist

**Project:** Veritable Games
**Date:** 2025-10-31
**Assignee:** _________________
**Estimated Time:** 2-4 hours (Priority items)
**Status:** 🔴 NOT STARTED

---

## Pre-Implementation Checklist

- [ ] Read `CI_CD_FAILURE_ANALYSIS.md` (comprehensive analysis)
- [ ] Read `CI_CD_QUICK_FIX_GUIDE.md` (step-by-step guide)
- [ ] Review `CI_CD_WORKFLOW_STATUS.md` (current state)
- [ ] Backup current work: `git stash` or commit to branch
- [ ] Pull latest main: `git checkout main && git pull origin main`
- [ ] Ensure clean working tree: `git status` shows no uncommitted changes
- [ ] Terminal open in repository root: `/home/user/Projects/veritable-games-main`

---

## PHASE 1: Fix Unit Tests (CRITICAL - 2 hours)

### Task 1.1: Move DOMPurify Mock File (5 minutes)

**Current Location:** `frontend/src/lib/forums/__tests__/__mocks__/dompurify.ts`
**Target Location:** `frontend/src/lib/forums/__mocks__/dompurify.ts`

**Commands:**
```bash
cd /home/user/Projects/veritable-games-main/frontend
mkdir -p src/lib/forums/__mocks__
mv src/lib/forums/__tests__/__mocks__/dompurify.ts src/lib/forums/__mocks__/
rmdir src/lib/forums/__tests__/__mocks__
```

**Verification:**
```bash
ls -la src/lib/forums/__mocks__/dompurify.ts
# Should exist

ls -la src/lib/forums/__tests__/__mocks__/
# Should show: No such file or directory
```

- [ ] Mock file moved successfully
- [ ] Old directory removed
- [ ] File path verified

---

### Task 1.2: Update Jest Configuration (10 minutes)

**File:** `frontend/jest.config.js`

**Change:**
```javascript
// BEFORE (line 21-26):
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
  '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
},

// AFTER:
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^dompurify$': '<rootDir>/src/lib/forums/__mocks__/dompurify.ts',  // ADD THIS LINE
  '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
  '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
},
```

**Test:**
```bash
cd /home/user/Projects/veritable-games-main/frontend
npm test -- --clearCache
npm test -- --watchAll=false --testPathPattern="dompurify"
# Should NOT show "Test suite failed to run"
```

- [ ] jest.config.js updated
- [ ] Test cache cleared
- [ ] DOMPurify mock no longer detected as test file

---

### Task 1.3: Fix Avatar Component (30 minutes)

#### Step A: Add Test ID to Avatar.tsx

**File:** `frontend/src/components/ui/Avatar.tsx`

**Location 1 - Gradient Avatar (line ~122-129):**
```typescript
// BEFORE:
const gradientContent = (
  <div
    className={gradientClasses}
    title={`${displayName}${isClickableWithId ? ' - Click to view profile' : ''}`}
  >
    {initial}
  </div>
);

// AFTER:
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

**Location 2 - Image Avatar (line ~81-84):**
```typescript
// BEFORE:
<div
  className={baseClasses}
  title={`${displayName}${isClickableWithId ? ' - Click to view profile' : ''}`}
>

// AFTER:
<div
  className={baseClasses}
  data-testid="avatar-container"  // ADD THIS LINE
  title={`${displayName}${isClickableWithId ? ' - Click to view profile' : ''}`}
>
```

- [ ] Gradient avatar has `data-testid="avatar-container"`
- [ ] Image avatar has `data-testid="avatar-container"`
- [ ] File saved

#### Step B: Update Avatar.test.tsx

**File:** `frontend/src/components/ui/__tests__/Avatar.test.tsx`

**Location:** Test "applies correct size classes" (line ~54-63)

```typescript
// BEFORE:
it('applies correct size classes', () => {
  const { rerender } = render(<Avatar user={defaultUser} size="xs" />);

  let avatar = screen.getByText('T').parentElement;
  expect(avatar).toHaveClass('w-6', 'h-6');

  rerender(<Avatar user={defaultUser} size="lg" />);
  avatar = screen.getByText('T').parentElement;
  expect(avatar).toHaveClass('w-16', 'h-16');
});

// AFTER:
it('applies correct size classes', () => {
  const { rerender } = render(<Avatar user={defaultUser} size="xs" />);

  let avatar = screen.getByTestId('avatar-container');  // CHANGED
  expect(avatar).toHaveClass('w-6', 'h-6');

  rerender(<Avatar user={defaultUser} size="lg" />);
  avatar = screen.getByTestId('avatar-container');  // CHANGED
  expect(avatar).toHaveClass('w-16', 'h-16');
});
```

- [ ] Test updated to use `getByTestId`
- [ ] File saved

**Test:**
```bash
cd /home/user/Projects/veritable-games-main/frontend
npm test -- Avatar.test.tsx --no-coverage
# Expected: 6 passing, 0 failing
```

- [ ] Avatar tests pass (6/6)
- [ ] No errors or warnings

---

### Task 1.4: Fix AccountSettingsForm Component (45 minutes)

#### Step A: Add Test IDs to AccountSettingsForm.tsx

**File:** `frontend/src/components/settings/AccountSettingsForm.tsx`

**Location 1 - Email Button (line ~210-216):**
```typescript
// BEFORE:
<SettingsSaveButton
  type="submit"
  isLoading={emailLoading}
  loadingText="Updating email..."
>
  Update Email
</SettingsSaveButton>

// AFTER:
<SettingsSaveButton
  type="submit"
  isLoading={emailLoading}
  loadingText="Updating email..."
  data-testid="update-email-button"  // ADD THIS LINE
>
  Update Email
</SettingsSaveButton>
```

**Location 2 - Password Button (line ~271-277):**
```typescript
// BEFORE:
<SettingsSaveButton
  type="submit"
  isLoading={passwordLoading}
  loadingText="Updating password..."
>
  Update Password
</SettingsSaveButton>

// AFTER:
<SettingsSaveButton
  type="submit"
  isLoading={passwordLoading}
  loadingText="Updating password..."
  data-testid="update-password-button"  // ADD THIS LINE
>
  Update Password
</SettingsSaveButton>
```

- [ ] Email button has `data-testid="update-email-button"`
- [ ] Password button has `data-testid="update-password-button"`
- [ ] File saved

#### Step B: Update AccountSettingsForm.test.tsx

**File:** `frontend/src/components/settings/__tests__/AccountSettingsForm.test.tsx`

**Location:** Test "handles email update form submission" (line ~79-113)

```typescript
// FIND THIS LINE (around line 98):
const updateEmailButton = screen.getByRole('button', { name: /update email/i });

// REPLACE WITH:
const updateEmailButton = screen.getByTestId('update-email-button');
```

- [ ] Test updated to use `getByTestId('update-email-button')`
- [ ] File saved

**Test:**
```bash
cd /home/user/Projects/veritable-games-main/frontend
npm test -- AccountSettingsForm.test.tsx --no-coverage
# Expected: 6 passing, 0 failing
```

- [ ] AccountSettingsForm tests pass (6/6)
- [ ] No errors or warnings

---

### Task 1.5: Verify All Tests Pass (15 minutes)

**Run full test suite:**
```bash
cd /home/user/Projects/veritable-games-main/frontend

# Clear cache
npm test -- --clearCache

# Run all tests
npm test -- --coverage --watchAll=false

# Expected output:
# Test Suites: 20 passed, 20 total
# Tests:       345 passed, 345 total
# Snapshots:   0 total
# Time:        30-60s
```

**Check for specific fixes:**
```bash
# Verify no mock file errors
npm test -- --listTests | grep -i dompurify
# Should show: (empty - not detected as test)

# Count passing tests
npm test -- --watchAll=false 2>&1 | grep "Tests:"
# Should show: 345 passed
```

- [ ] All 345 tests passing
- [ ] 0 test failures
- [ ] No "Test suite failed to run" errors
- [ ] Coverage report generated
- [ ] Test execution time < 2 minutes

---

### Task 1.6: Remove `|| true` from Workflows (15 minutes)

**Files to edit:** `.github/workflows/ci-cd.yml`

**Locations to fix:**

1. **Line 42:** Security audit
   ```yaml
   # KEEP THIS ONE (non-critical check)
   run: npm audit --audit-level=high || true
   ```

2. **Line 67:** ESLint
   ```yaml
   # KEEP THIS ONE (ESLint disabled)
   run: npm run lint || true
   ```

3. **Line 110, 113, 116:** Test commands
   ```yaml
   # BEFORE:
   "unit")
     npm test -- --coverage --watchAll=false --testPathPattern="^((?!integration|security).)*$" || true
     ;;
   "integration")
     npm test -- --testPathPattern="integration" --watchAll=false || true
     ;;
   "security")
     npm test -- --testPathPattern="security" --watchAll=false || true
     ;;

   # AFTER (REMOVE || true):
   "unit")
     npm test -- --coverage --watchAll=false --testPathPattern="^((?!integration|security).)*$"
     ;;
   "integration")
     npm test -- --testPathPattern="integration" --watchAll=false
     ;;
   "security")
     npm test -- --testPathPattern="security" --watchAll=false
     ;;
   ```

**Verification:**
```bash
grep -n "|| true" .github/workflows/ci-cd.yml

# Should show:
# 42:        run: npm audit --audit-level=high || true
# 67:        run: npm run lint || true
# 71:        run: npm run format:check || true

# Should NOT show any on test command lines
```

- [ ] Test commands no longer have `|| true`
- [ ] Non-critical checks still have `|| true` (audit, lint)
- [ ] File saved

---

### Task 1.7: Commit and Push (10 minutes)

**Verify changes:**
```bash
cd /home/user/Projects/veritable-games-main

# Check git status
git status

# Should show modified files:
# - frontend/src/lib/forums/__mocks__/dompurify.ts (new location)
# - frontend/src/components/ui/Avatar.tsx
# - frontend/src/components/ui/__tests__/Avatar.test.tsx
# - frontend/src/components/settings/AccountSettingsForm.tsx
# - frontend/src/components/settings/__tests__/AccountSettingsForm.test.tsx
# - frontend/jest.config.js
# - .github/workflows/ci-cd.yml
```

**Run final verification:**
```bash
cd frontend
npm run type-check
# Should pass (with 15 known warnings)

npm test -- --watchAll=false
# Should show: 345 passed

cd ..
```

- [ ] Type check passes
- [ ] All tests pass
- [ ] Ready to commit

**Commit:**
```bash
git add .
git commit -m "fix: Resolve 43 test failures blocking CI/CD

- Move DOMPurify mock to correct location (out of __tests__)
- Add data-testid to Avatar component for stable test queries
- Add data-testid to AccountSettingsForm buttons
- Remove || true from critical test commands in workflows

Fixes #[ISSUE_NUMBER]

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
```

- [ ] Changes committed
- [ ] Commit message includes fix details

**Push:**
```bash
git push origin main
```

- [ ] Changes pushed to GitHub
- [ ] GitHub Actions triggered

---

### Task 1.8: Monitor GitHub Actions (15 minutes)

**Go to:** `https://github.com/[USERNAME]/veritable-games/actions`

**Watch workflows:**
1. **ci-cd.yml** - Veritable Games CI/CD Pipeline
   - [ ] security job: ✅ PASS
   - [ ] quality job: ✅ PASS
   - [ ] test job (unit): ✅ PASS (should show 345 passing)
   - [ ] test job (integration): ✅ PASS (or gracefully skip)
   - [ ] test job (security): ✅ PASS (or gracefully skip)
   - [ ] build job: ✅ PASS (unblocked)
   - [ ] docker job: ❌ FAIL (expected - Dockerfile missing)
   - [ ] health-check job: ✅ PASS

2. **advanced-ci-cd.yml** - Advanced CI/CD Pipeline
   - [ ] setup job: ✅ PASS
   - [ ] security-scan job: ✅ PASS
   - [ ] test-suite job: ✅ PASS
   - [ ] build-optimize job: ✅ PASS
   - [ ] docker-build job: ❌ FAIL (expected - Dockerfile missing)

3. **deploy.yml** - Deploy to Vercel
   - [ ] typecheck job: ✅ PASS
   - [ ] test job: ✅ PASS (should show 345 passing)
   - [ ] deploy job: ✅ RUNS (was blocked before)

**Success Criteria for Phase 1:**
- [ ] Test jobs show green checkmarks (not red X)
- [ ] Build jobs complete successfully
- [ ] Vercel deploy job runs (may fail on missing secrets, but runs)
- [ ] Docker jobs fail with "Dockerfile not found" (expected)

**If tests still fail:**
1. Check GitHub Actions logs for actual error
2. Verify component changes were pushed: `git log -1 --stat`
3. Run tests locally again to debug
4. Check full error analysis in `CI_CD_FAILURE_ANALYSIS.md`

---

## PHASE 2: Create Dockerfile (OPTIONAL - 2 hours)

**Note:** This is optional for fixing test failures. Required for Docker-based deployments.

### Task 2.1: Create Dockerfile (90 minutes)

**File:** `frontend/Dockerfile`

**Full content:** See `CI_CD_FAILURE_ANALYSIS.md` Failure #1 - Fix Strategy - Phase 1

**Key sections:**
- Stage 1: Dependencies (install better-sqlite3 native deps)
- Stage 2: Builder (npm run build)
- Stage 3: Runner (standalone output, non-root user)

**Template:**
```dockerfile
FROM node:20.18.2-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --only=production --ignore-scripts

FROM node:20.18.2-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
RUN npm run build

FROM node:20.18.2-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["node", "server.js"]
```

- [ ] Dockerfile created in `frontend/` directory
- [ ] All 3 stages implemented (deps, builder, runner)
- [ ] Health check configured

---

### Task 2.2: Update next.config.js (15 minutes)

**File:** `frontend/next.config.js`

**Add:**
```javascript
module.exports = {
  // ... existing config ...
  output: 'standalone',  // ADD THIS LINE for Docker builds
};
```

- [ ] `output: 'standalone'` added to next.config.js
- [ ] File saved

---

### Task 2.3: Test Docker Build Locally (30 minutes)

**Build:**
```bash
cd /home/user/Projects/veritable-games-main/frontend
docker build -t veritable-games:test .

# Expected: 3 stages complete, ~5-8 minutes
# Image size: ~350-450 MB
```

- [ ] Build completes without errors
- [ ] All stages (deps, builder, runner) succeed
- [ ] Image size reasonable (<500 MB)

**Run:**
```bash
docker run -d -p 3000:3000 --name vg-test veritable-games:test

# Wait for startup
sleep 30

# Test health check
curl http://localhost:3000/api/health
# Expected: {"status":"ok"} or similar

# Check logs
docker logs vg-test

# Stop and clean up
docker stop vg-test
docker rm vg-test
```

- [ ] Container starts successfully
- [ ] Health check returns 200 OK
- [ ] No errors in logs
- [ ] Container stops cleanly

**Commit:**
```bash
cd /home/user/Projects/veritable-games-main
git add frontend/Dockerfile frontend/next.config.js
git commit -m "feat: Add production Dockerfile for containerized deployments

- Multi-stage build (deps → builder → runner)
- Node 20.18.2-alpine base image
- Non-root user (nextjs:nodejs) for security
- Health check on /api/health endpoint
- Standalone Next.js output for smaller image
- SQLite native dependencies (better-sqlite3)

Enables Docker-based deployment strategies:
- Blue-green deployments
- Canary releases
- Container orchestration (Kubernetes, Docker Swarm)

Image size: ~400 MB
Build time: ~5-8 minutes
Startup time: <10 seconds

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

- [ ] Dockerfile committed
- [ ] Changes pushed

**Monitor GitHub Actions:**
- [ ] docker job in ci-cd.yml: ✅ PASS
- [ ] docker-build job in advanced-ci-cd.yml: ✅ PASS
- [ ] Image pushed to ghcr.io successfully
- [ ] Trivy security scan completes

---

## PHASE 3: Post-Implementation Verification

### Final Checklist

**All Tests:**
- [ ] 345 tests passing locally
- [ ] 0 test failures
- [ ] Test coverage >70%

**GitHub Actions:**
- [ ] ci-cd.yml: All jobs green (or docker skipped if no Dockerfile)
- [ ] advanced-ci-cd.yml: All jobs green (or docker skipped)
- [ ] deploy.yml: Test and deploy jobs run successfully

**Docker (if implemented):**
- [ ] Dockerfile exists and builds successfully
- [ ] Image size reasonable (<500 MB)
- [ ] Container runs and health check passes
- [ ] GitHub Actions docker jobs pass

**Documentation:**
- [ ] CI_CD_FAILURE_ANALYSIS.md reviewed
- [ ] CI_CD_QUICK_FIX_GUIDE.md followed
- [ ] CI_CD_WORKFLOW_STATUS.md updated with new status
- [ ] CLAUDE.md CI/CD section reviewed

---

## Troubleshooting

### Tests Still Failing?

**Check:**
1. Component files saved with test IDs: `git diff src/components/`
2. Jest config updated: `cat frontend/jest.config.js | grep dompurify`
3. Mock file moved: `ls frontend/src/lib/forums/__mocks__/dompurify.ts`
4. Cache cleared: `npm test -- --clearCache`

**Debug:**
```bash
cd frontend

# Run individual tests
npm test -- Avatar.test.tsx --verbose --no-coverage
npm test -- AccountSettingsForm.test.tsx --verbose --no-coverage

# Check test file detection
npm test -- --listTests | wc -l
# Should show ~20 test files
```

### GitHub Actions Failing?

**Check:**
1. Commit pushed: `git log --oneline -5`
2. Actions triggered: Check GitHub Actions tab
3. Review logs: Click failed job → View logs
4. Compare with expected: See `CI_CD_WORKFLOW_STATUS.md`

### Docker Build Failing?

**Check:**
1. Dockerfile exists: `ls frontend/Dockerfile`
2. next.config.js updated: `grep standalone frontend/next.config.js`
3. Standalone build works: `npm run build && ls .next/standalone/`
4. Native deps installed: Docker stage shows `apk add` success

**Debug:**
```bash
cd frontend

# Test build locally
docker build --no-cache -t vg:debug .

# Check each stage
docker build --target deps -t vg:deps .
docker build --target builder -t vg:builder .
docker build --target runner -t vg:runner .
```

---

## Success Metrics

**Immediate (Phase 1):**
- [ ] 345/345 tests passing (100% success rate)
- [ ] 3/5 workflows unblocked
- [ ] Vercel deployments possible

**Complete (Phase 2):**
- [ ] 5/5 workflows fully functional
- [ ] Docker deployments enabled
- [ ] All deployment strategies available

---

## Sign-Off

**Phase 1 Complete:**
- Date: _______________
- Time spent: _______________
- All tests passing: [ ] YES [ ] NO
- GitHub Actions green: [ ] YES [ ] NO
- Issues encountered: _____________________________________

**Phase 2 Complete:**
- Date: _______________
- Time spent: _______________
- Docker builds: [ ] YES [ ] NO
- Deployments working: [ ] YES [ ] NO
- Issues encountered: _____________________________________

**Reviewed by:** _______________
**Approved by:** _______________

---

**Document Version:** 1.0
**Last Updated:** 2025-10-31
**Next Steps:** See `CI_CD_FAILURE_ANALYSIS.md` Phase 3 for CI improvements
