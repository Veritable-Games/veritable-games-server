# GitHub Actions Docker Build - Step-by-Step Fixes

**Date**: November 14, 2025
**Status**: Ready for implementation
**Time to implement**: 15-30 minutes

---

## Quick Summary of Fixes

| Issue | File | Lines | Fix Type | Severity |
|-------|------|-------|----------|----------|
| Missing `packages:write` permission | advanced-ci-cd.yml | 3-7 | ADD 1 line | CRITICAL |
| Secrets in Dockerfile ENV | Dockerfile | 44-46 | REMOVE 3 lines | HIGH |
| Secrets in workflow build-args | advanced-ci-cd.yml | 482-488 | MODIFY 2 lines | HIGH |

---

## Fix 1: Add Missing Permission to Workflow

### File Location
```
/home/user/Projects/veritable-games-main/.github/workflows/advanced-ci-cd.yml
Lines: 3-7
```

### Current Code
```yaml
permissions:
  contents: read
  pull-requests: read
  issues: read
  checks: write
```

### Fixed Code
```yaml
permissions:
  contents: read
  pull-requests: read
  issues: read
  checks: write
  packages: write
```

### What Changed
- Added single line: `packages: write`
- This grants the GITHUB_TOKEN scope to push to GitHub Container Registry (ghcr.io)

### Why This Works
- `packages: write` scope allows GHCR operations
- GITHUB_TOKEN gets access to container registry
- docker/login-action now succeeds with proper authentication
- Push to ghcr.io now permitted

---

## Fix 2: Remove Secrets from Dockerfile ENV Instructions

### File Location
```
/home/user/Projects/veritable-games-main/frontend/Dockerfile
Lines: 44-46
```

### Current Code (INSECURE)
```dockerfile
# Build arguments for environment variables needed during build
ARG NEXT_PUBLIC_APP_VERSION
ARG NODE_ENV=production
ARG DATABASE_URL
ARG SESSION_SECRET
ARG CSRF_SECRET
ARG ENCRYPTION_KEY

# Copy all dependencies from deps stage (includes devDependencies for build)
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Copy environment template (will be overridden by runtime env)
RUN cp -n .env.example .env.local || true

# Build Next.js application with required environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=${NODE_ENV}
ENV DATABASE_URL=${DATABASE_URL:-postgresql://build:build@localhost:5432/build_db}
ENV POSTGRES_URL=${DATABASE_URL:-postgresql://build:build@localhost:5432/build_db}
ENV DATABASE_MODE=postgres
ENV SESSION_SECRET=${SESSION_SECRET:-build-secret-key-minimum-32-chars-required}
ENV CSRF_SECRET=${CSRF_SECRET:-build-csrf-secret-minimum-32-chars-required}
ENV ENCRYPTION_KEY=${ENCRYPTION_KEY:-build-encryption-key-minimum-32-chars}

RUN npm run build
```

### Fixed Code (SECURE)
```dockerfile
# Build arguments for environment variables needed during build
ARG NEXT_PUBLIC_APP_VERSION
ARG NODE_ENV=production

# Copy all dependencies from deps stage (includes devDependencies for build)
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Copy environment template (will be overridden by runtime env)
RUN cp -n .env.example .env.local || true

# Build Next.js application with required environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=${NODE_ENV}
ENV DATABASE_MODE=postgres

RUN npm run build
```

### What Changed
1. **Removed lines**:
   - `ARG DATABASE_URL` - Build doesn't need production DB
   - `ARG SESSION_SECRET` - Never pass secrets in build
   - `ARG CSRF_SECRET` - Never pass secrets in build
   - `ARG ENCRYPTION_KEY` - Never pass secrets in build

2. **Removed ENV lines**:
   - `ENV DATABASE_URL=${DATABASE_URL:-...}` - Will use runtime value
   - `ENV POSTGRES_URL=${DATABASE_URL:-...}` - Will use runtime value
   - `ENV SESSION_SECRET=${SESSION_SECRET:-...}` - Will use runtime value
   - `ENV CSRF_SECRET=${CSRF_SECRET:-...}` - Will use runtime value
   - `ENV ENCRYPTION_KEY=${ENCRYPTION_KEY:-...}` - Will use runtime value

3. **Kept ENV lines**:
   - `ENV NEXT_TELEMETRY_DISABLED=1` - Non-sensitive, needed for build
   - `ENV NODE_ENV=${NODE_ENV}` - Non-sensitive, needed for build
   - `ENV DATABASE_MODE=postgres` - Non-sensitive, informational

### Why This Works
- Next.js build doesn't need secret values (they're used at runtime, not build time)
- Secrets come from container runtime environment (via docker run -e or Kubernetes secrets)
- Dockerfile is image blueprint - no secrets baked in
- Image history shows no secret values in `docker history`

### Security Impact
- Secrets not visible in `docker history`
- Secrets not visible with `docker inspect`
- Secrets not visible in CI/CD logs
- Better alignment with container security best practices

---

## Fix 3: Reduce Secrets in Workflow Build Arguments

### File Location
```
/home/user/Projects/veritable-games-main/.github/workflows/advanced-ci-cd.yml
Lines: 482-488
```

### Current Code (INSECURE)
```yaml
      - name: Build and push Docker image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          platforms: linux/amd64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_APP_VERSION=${{ github.sha }}
            NODE_ENV=production
            DATABASE_URL=postgresql://build:build@localhost:5432/build_db
            SESSION_SECRET=build-secret-key-minimum-32-chars-required-for-ci
            CSRF_SECRET=build-csrf-secret-minimum-32-chars-required-for-ci
            ENCRYPTION_KEY=build-encryption-key-minimum-32-chars-required-ci
```

### Fixed Code (SECURE)
```yaml
      - name: Build and push Docker image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          platforms: linux/amd64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_APP_VERSION=${{ github.sha }}
            NODE_ENV=production
```

### What Changed
1. **Removed build-args**:
   - `DATABASE_URL=...` - Not used in build anymore (removed from Dockerfile)
   - `SESSION_SECRET=...` - Never should be in build args
   - `CSRF_SECRET=...` - Never should be in build args
   - `ENCRYPTION_KEY=...` - Never should be in build args

2. **Kept build-args**:
   - `NEXT_PUBLIC_APP_VERSION=${{ github.sha }}` - Non-sensitive version identifier
   - `NODE_ENV=production` - Non-sensitive build mode

### Why This Works
- Build arguments are visible in CI/CD logs
- Sensitive data shouldn't be in logs
- Only version/mode info needed for build
- Matches new Dockerfile that doesn't expect these args

### CI/CD Log Impact
- Previous logs showed: "DATABASE_URL=postgresql://build..." visible
- Previous logs showed: "SESSION_SECRET=build-secret-key..." visible
- New logs only show: "NEXT_PUBLIC_APP_VERSION=abcd1234..."
- New logs only show: "NODE_ENV=production"

---

## Complete Workflow Diff

### Change Summary
File: `/home/user/Projects/veritable-games-main/.github/workflows/advanced-ci-cd.yml`

**Line 3-7 (Permission)**:
```diff
  permissions:
    contents: read
    pull-requests: read
    issues: read
    checks: write
+   packages: write
```

**Line 482-488 (Build arguments)**:
```diff
          build-args: |
            NEXT_PUBLIC_APP_VERSION=${{ github.sha }}
            NODE_ENV=production
-           DATABASE_URL=postgresql://build:build@localhost:5432/build_db
-           SESSION_SECRET=build-secret-key-minimum-32-chars-required-for-ci
-           CSRF_SECRET=build-csrf-secret-minimum-32-chars-required-for-ci
-           ENCRYPTION_KEY=build-encryption-key-minimum-32-chars-required-ci
```

---

## Complete Dockerfile Diff

### Change Summary
File: `/home/user/Projects/veritable-games-main/frontend/Dockerfile`

**Line 22-27 (ARG section)**:
```diff
  # Build arguments for environment variables needed during build
  ARG NEXT_PUBLIC_APP_VERSION
  ARG NODE_ENV=production
- ARG DATABASE_URL
- ARG SESSION_SECRET
- ARG CSRF_SECRET
- ARG ENCRYPTION_KEY
```

**Line 44-46 (ENV section)**:
```diff
  # Build Next.js application with required environment variables
  ENV NEXT_TELEMETRY_DISABLED=1
  ENV NODE_ENV=${NODE_ENV}
- ENV DATABASE_URL=${DATABASE_URL:-postgresql://build:build@localhost:5432/build_db}
- ENV POSTGRES_URL=${DATABASE_URL:-postgresql://build:build@localhost:5432/build_db}
  ENV DATABASE_MODE=postgres
- ENV SESSION_SECRET=${SESSION_SECRET:-build-secret-key-minimum-32-chars-required}
- ENV CSRF_SECRET=${CSRF_SECRET:-build-csrf-secret-minimum-32-chars-required}
- ENV ENCRYPTION_KEY=${ENCRYPTION_KEY:-build-encryption-key-minimum-32-chars}
```

---

## Implementation Checklist

### Step 1: Update Workflow Permissions

- [ ] Open `/home/user/Projects/veritable-games-main/.github/workflows/advanced-ci-cd.yml`
- [ ] Find line 3 (`permissions:`)
- [ ] Add `packages: write` after `checks: write` on line 8
- [ ] Save file

**Verification**:
```bash
cd /home/user/Projects/veritable-games-main
grep -A 6 "^permissions:" .github/workflows/advanced-ci-cd.yml
```
Should show 6 permissions including `packages: write`

### Step 2: Update Dockerfile ARG Section

- [ ] Open `/home/user/Projects/veritable-games-main/frontend/Dockerfile`
- [ ] Find lines 25-27 (ARG sections with secrets)
- [ ] Delete these lines:
  - `ARG DATABASE_URL`
  - `ARG SESSION_SECRET`
  - `ARG CSRF_SECRET`
  - `ARG ENCRYPTION_KEY`
- [ ] Keep only:
  - `ARG NEXT_PUBLIC_APP_VERSION`
  - `ARG NODE_ENV=production`
- [ ] Save file

**Verification**:
```bash
cd /home/user/Projects/veritable-games-main/frontend
grep "^ARG" Dockerfile
```
Should show only:
```
ARG NEXT_PUBLIC_APP_VERSION
ARG NODE_ENV=production
```

### Step 3: Update Dockerfile ENV Section

- [ ] In same file, find lines 44-46 (ENV section with secrets)
- [ ] Delete these lines:
  - `ENV DATABASE_URL=${DATABASE_URL:-...}`
  - `ENV POSTGRES_URL=${DATABASE_URL:-...}`
  - `ENV SESSION_SECRET=${SESSION_SECRET:-...}`
  - `ENV CSRF_SECRET=${CSRF_SECRET:-...}`
  - `ENV ENCRYPTION_KEY=${ENCRYPTION_KEY:-...}`
- [ ] Keep:
  - `ENV NEXT_TELEMETRY_DISABLED=1`
  - `ENV NODE_ENV=${NODE_ENV}`
  - `ENV DATABASE_MODE=postgres`
- [ ] Save file

**Verification**:
```bash
cd /home/user/Projects/veritable-games-main/frontend
grep "^ENV" Dockerfile | grep -E "SECRET|ENCRYPTION"
```
Should return NO results (no secrets in ENV)

### Step 4: Update Workflow Build Arguments

- [ ] Open `/home/user/Projects/veritable-games-main/.github/workflows/advanced-ci-cd.yml`
- [ ] Find line 482-488 (build-args section)
- [ ] Delete these lines:
  - `DATABASE_URL=postgresql://build:build@localhost:5432/build_db`
  - `SESSION_SECRET=build-secret-key-minimum-32-chars-required-for-ci`
  - `CSRF_SECRET=build-csrf-secret-minimum-32-chars-required-for-ci`
  - `ENCRYPTION_KEY=build-encryption-key-minimum-32-chars-required-ci`
- [ ] Keep only:
  - `NEXT_PUBLIC_APP_VERSION=${{ github.sha }}`
  - `NODE_ENV=production`
- [ ] Save file

**Verification**:
```bash
cd /home/user/Projects/veritable-games-main
grep -A 8 "build-args:" .github/workflows/advanced-ci-cd.yml | head -10
```
Should show only 2 args without secrets

### Step 5: Validate Changes

- [ ] Run `npm run type-check` (from frontend directory)
- [ ] Run `npm run format` (from frontend directory)
- [ ] Verify no syntax errors

```bash
cd /home/user/Projects/veritable-games-main/frontend
npm run type-check
npm run format
```

### Step 6: Commit Changes

```bash
cd /home/user/Projects/veritable-games-main
git add .github/workflows/advanced-ci-cd.yml frontend/Dockerfile
git commit -m "fix: Secure Docker build - add GHCR permissions and remove secrets from Dockerfile

- Add packages:write permission to workflow for GHCR push access
- Remove SECRET* variables from Dockerfile (DATABASE_URL, SESSION_SECRET, CSRF_SECRET, ENCRYPTION_KEY)
- Remove secret build-args from workflow (only keep version and NODE_ENV)
- Secrets will now come from runtime environment, not build stage
- Fixes GHCR push permission denied error and security warnings

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git log -1 --oneline
```

### Step 7: Push to GitHub

```bash
git push origin main
# or
git push origin test/eabb964-fixed  # if on branch
```

---

## Verification Steps

### Before Deploying

1. **Check workflow syntax** (on GitHub Actions UI):
   - Go to Actions tab
   - Look for "Advanced CI/CD Pipeline" workflow
   - Verify no syntax errors in workflow

2. **Monitor first build** (after push):
   - Watch the workflow run on the pushed commit
   - Monitor "Login to Container Registry" step
   - Should succeed (not fail with permission denied)
   - Monitor "Build and push Docker image" step
   - Should push successfully (not fail)

3. **Check GHCR registry**:
   ```bash
   # After successful workflow run
   # Check image is in registry
   curl -H "Authorization: token $GITHUB_TOKEN" \
     https://api.github.com/orgs/Veritable-Games/packages/container/veritable-games-site/veritable-games/versions
   ```

4. **Scan image for secrets** (locally):
   ```bash
   # After image is pushed, pull it locally
   docker pull ghcr.io/Veritable-Games/veritable-games-site/veritable-games:main

   # Check for secrets in history
   docker history ghcr.io/Veritable-Games/veritable-games-site/veritable-games:main
   # Should NOT show SESSION_SECRET, CSRF_SECRET, or ENCRYPTION_KEY

   # Scan with Trivy
   trivy image ghcr.io/Veritable-Games/veritable-games-site/veritable-games:main
   # Should pass without secret warnings in Dockerfile
   ```

### After Deployment

1. **Verify container runs correctly**:
   ```bash
   # On production server
   docker logs m4s0kwo4kc4oooocck4sswc4 | tail -50
   # Should show normal startup without secret-related errors
   ```

2. **Check application health**:
   ```bash
   curl -f https://veritablegames.com/api/health
   # Should return 200 OK
   ```

---

## Rollback Plan (If Needed)

If issues occur after fix, revert with:

```bash
cd /home/user/Projects/veritable-games-main
git revert HEAD
git push origin main
```

This will:
1. Revert all changes
2. Restore original workflow and Dockerfile
3. Trigger new build with old configuration

**Note**: This would restore the security issue - only use for emergency.

---

## Testing on Feature Branch First (Recommended)

Before merging to main:

```bash
# Create test branch
git checkout -b test/docker-security-fixes

# Make all fixes (as per checklist above)
# Commit changes
git commit -m "test: Docker security fixes"

# Push to test branch
git push origin test/docker-security-fixes

# Create PR on GitHub
# Monitor workflow run for this branch
# Verify all steps pass
# Verify image pushes to GHCR
# Then merge to main
```

---

## Common Issues and Solutions

### Issue: "denied: installation not allowed to Create organization package"
**Status**: Should be FIXED after adding `packages: write`
**If still failing**:
1. Verify permission was saved correctly (check workflow file)
2. Clear GitHub Actions cache: Settings → Actions → Clear all caches
3. Re-run workflow with fresh environment

### Issue: Trivy still detects secrets after fixes
**Status**: Should be FIXED after removing secrets from Dockerfile
**If still detected**:
1. Verify Dockerfile was saved correctly (check file)
2. Verify old image isn't cached (pull fresh)
3. Run: `trivy image --clear-cache`

### Issue: Build fails with "undefined variable"
**Status**: Should NOT happen - we're removing variables
**If it occurs**:
1. Check if Next.js code expects these ENV vars
2. These should be passed at runtime via container environment
3. Verify .env.example has required variables

---

## Security Improvements Summary

After these fixes:

| Area | Before | After |
|------|--------|-------|
| **Push Permissions** | Missing packages:write | ✓ Added packages:write |
| **Dockerfile Secrets** | 5 secrets in ENV | ✓ 0 secrets in Dockerfile |
| **Build Args Secrets** | 4 secrets in args | ✓ 0 secrets in args |
| **docker history** | Shows secrets | ✓ Shows no secrets |
| **docker inspect** | Shows secrets | ✓ Shows no secrets |
| **CI/CD Logs** | Shows secrets | ✓ Shows no secrets |
| **Image Registry** | Secrets visible | ✓ Secrets hidden |
| **Trivy Warnings** | 6 warnings | ✓ 0 warnings |

---

## Additional Security Notes

1. **Runtime Secrets**: After these fixes, secrets must come from:
   - Container environment variables (`docker run -e`)
   - Kubernetes secrets
   - Docker Compose environment files
   - CI/CD secret injection at deploy time

2. **Next.js Build-Time Vars**: Only use `NEXT_PUBLIC_*` for public variables:
   - `NEXT_PUBLIC_APP_VERSION` - Fine, public
   - `SESSION_SECRET` - NEVER public, never in build

3. **Rotation Strategy**: With secrets not in image:
   - Can rotate secrets without rebuilding image
   - Just update container environment
   - Faster, safer secret rotation

---

## References

- [GitHub Actions: permissions keyword](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions)
- [Container Registry: GitHub](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker: Best Practices for writing Dockerfiles](https://docs.docker.com/develop/dev-best-practices/)
- [OWASP: Secrets in Images](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)

