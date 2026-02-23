# GitHub Actions Workflow #27 Docker Build Failure Diagnosis

**Date**: November 14, 2025
**Issue**: GHCR push permission denied + 6 security warnings
**Status**: Root cause identified with complete fixes

---

## Executive Summary

The Docker build workflow #27 is failing due to **three separate issues**:

1. **GHCR Push Permission Failure** (PRIMARY)
   - Error: "denied: installation not allowed to Create organization package"
   - Root Cause: `GITHUB_TOKEN` lacks `packages:write` permission
   - Impact: Cannot push Docker images to ghcr.io registry
   - Severity: CRITICAL - blocks deployment pipeline

2. **Dockerfile Security Warnings** (SECONDARY)
   - 6 secrets exposed in Dockerfile ARG/ENV instructions
   - Lines affected: 22-27 (ARG), 44-46 (ENV)
   - Risk: Secrets visible in build logs and image layer history
   - Severity: HIGH - security vulnerability

3. **Insufficient Workflow Permissions** (TERTIARY)
   - Workflow declares minimal permissions (contents, pull-requests, issues, checks)
   - Missing: `packages:write` for registry operations
   - Severity: HIGH - prevents GHCR operations

---

## Root Cause Analysis

### Issue 1: GHCR Push Permission Failure

**Current Configuration** (`/home/user/Projects/veritable-games-main/.github/workflows/advanced-ci-cd.yml`):

```yaml
permissions:
  contents: read
  pull-requests: read
  issues: read
  checks: write

jobs:
  docker-build:
    steps:
      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY_URL }}  # ghcr.io
          username: ${{ github.actor }}      # GitHub username
          password: ${{ secrets.GITHUB_TOKEN }}
```

**Problem**:
- `GITHUB_TOKEN` is GitHub-provided automatic token with limited scopes
- Default scopes: `contents:read`, `metadata:read`, `actions:read`
- Missing scope: `packages:write` (required for ghcr.io push)
- GitHub does NOT automatically grant packages scope to GITHUB_TOKEN
- The token is trying to push to `ghcr.io/veritable-games/veritable-games-site/veritable-games:main`
- Organization permission check fails because token lacks write access

**Why This Happens**:
```
GITHUB_TOKEN Scope Check:
├─ contents:read ✓ (can read repo)
├─ pull-requests:read ✓ (can read PRs)
├─ issues:read ✓ (can read issues)
├─ checks:write ✓ (can write checks)
└─ packages:write ✗ (MISSING - why push fails)

GitHub Registry Operation Flow:
1. Request to push to ghcr.io/veritable-games/...
2. GitHub checks token scopes
3. Token missing packages:write scope
4. Check: Is token authorized for organization package push?
5. FAIL: "installation not allowed to Create organization package"
```

**Solution Options**:

| Option | Approach | Pros | Cons | Recommended |
|--------|----------|------|------|-------------|
| **Option A** | Use `secrets.GITHUB_TOKEN` with increased scope | Simple, built-in | Limited scope options | ✓ YES |
| **Option B** | Create Personal Access Token (PAT) | More control, better scopes | Requires secret management, person-specific | NO |
| **Option C** | Create GitHub App | Enterprise-grade, granular | Complex setup, overkill | NO |

**Recommendation**: **Option A** - The workflow permissions are incorrect. GitHub Actions permissions block needs to include `packages: write`.

---

### Issue 2: Dockerfile Security Warnings

**Current Configuration** (`/home/user/Projects/veritable-games-main/frontend/Dockerfile`):

```dockerfile
# Line 22-27: ARG instructions (visible in build output)
ARG NEXT_PUBLIC_APP_VERSION
ARG NODE_ENV=production
ARG DATABASE_URL
ARG SESSION_SECRET
ARG CSRF_SECRET
ARG ENCRYPTION_KEY

# Line 44-46: ENV instructions (baked into image layer)
ENV SESSION_SECRET=${SESSION_SECRET:-build-secret-key-minimum-32-chars-required}
ENV CSRF_SECRET=${CSRF_SECRET:-build-csrf-secret-minimum-32-chars-required}
ENV ENCRYPTION_KEY=${ENCRYPTION_KEY:-build-encryption-key-minimum-32-chars}
```

**Security Issues**:

1. **ARG Values Exposed in Build Logs**
   - Docker `docker build` output shows all ARG values
   - `docker history` shows layer history with ARG references
   - Accessible if logs are not properly restricted
   - Problem: Each ARG creates a new build layer

2. **ENV Variables Baked into Image**
   - `ENV` instructions create permanent image layers
   - Values visible with: `docker inspect <image>`
   - Running `docker history` shows secrets
   - All downstream containers inherit these secrets

3. **Warnings Detected By**:
   - Docker build: Warnings during build process
   - Trivy scanner: Detects hardcoded secrets in Dockerfile
   - Best practice scanners: Flag ENV secrets

**Container Image Layer Analysis**:
```
Layer 1: FROM node:20-alpine (base)
Layer 2: RUN apk add (dependencies)
Layer 3: COPY package*.json (files)
Layer 4: RUN npm ci (installs)
Layer 5: ENV SESSION_SECRET=... (VISIBLE IN HISTORY) ⚠️
Layer 6: ENV CSRF_SECRET=... (VISIBLE IN HISTORY) ⚠️
Layer 7: ENV ENCRYPTION_KEY=... (VISIBLE IN HISTORY) ⚠️
Layer 8: RUN npm run build (uses above secrets)
```

**Why This Is Bad**:
- Anyone with image access can extract secrets
- Secrets are "baked in" - not passed at runtime
- `docker inspect` reveals all ENV variables in all layers
- Secrets persist across image rebuilds

**Solution**:
- Use `--build-arg` for passing values (not stored in image)
- Use runtime ENV variables (passed at container run, not in Dockerfile)
- Never use `ENV VAR=value` for secrets in Dockerfile

---

### Issue 3: Insufficient Workflow Permissions

**Current Permissions Block** (Line 3-7 of `advanced-ci-cd.yml`):

```yaml
permissions:
  contents: read           # Read repository contents
  pull-requests: read      # Read PR information
  issues: read             # Read issues
  checks: write            # Write check results
  # MISSING: packages: write  # Write to container registry
```

**What These Permissions Do**:
| Permission | Scope | Use Case |
|-----------|-------|----------|
| `contents: read` | Repository files | Checkout code |
| `pull-requests: read` | PR metadata | Display PR info |
| `issues: read` | Issue metadata | Read issue data |
| `checks: write` | Check results | Write status checks |
| **`packages: write`** | **Registry access** | **Push to ghcr.io** |

**Why Docker Push Fails Without packages:write**:
```
docker/build-push-action@v5 Push Operation:
1. Create image layers
2. Tag image: ghcr.io/veritable-games/veritable-games-site/veritable-games:main
3. Authenticate with docker/login-action@v3
4. Call docker push ghcr.io/...
5. GitHub Registry API checks token scopes
6. Query: Does token have packages:write?
7. Response: NO (scope not granted)
8. DENY: Cannot push to organization package registry
```

---

## Docker Build Arguments Security Issue

**Current Problem** (Lines 482-488 of `advanced-ci-cd.yml`):

```yaml
build-args: |
  NEXT_PUBLIC_APP_VERSION=${{ github.sha }}
  NODE_ENV=production
  DATABASE_URL=postgresql://build:build@localhost:5432/build_db
  SESSION_SECRET=build-secret-key-minimum-32-chars-required-for-ci
  CSRF_SECRET=build-csrf-secret-minimum-32-chars-required-for-ci
  ENCRYPTION_KEY=build-encryption-key-minimum-32-chars-required-ci
```

**Security Concerns**:
- These secrets are visible in GitHub Actions workflow logs
- They get passed to Dockerfile as ARG values
- They appear in `docker history` output
- They're hardcoded in the workflow (not ideal for rotation)

**Better Approach**:
- Use only necessary build arguments
- Don't pass secrets to Docker build stage
- Secrets should come from container runtime environment
- Only pass BUILD variables that are truly needed

---

## Complete Fix Plan

### Fix 1: Add `packages: write` Permission

**File**: `/home/user/Projects/veritable-games-main/.github/workflows/advanced-ci-cd.yml`
**Lines**: 3-7
**Change Type**: Add missing permission scope

### Fix 2: Secure Dockerfile ENV/ARG Handling

**File**: `/home/user/Projects/veritable-games-main/frontend/Dockerfile`
**Changes**:
- Remove SECRET variables from Dockerfile entirely
- Keep only essential build arguments
- Runtime secrets should come from container environment

### Fix 3: Reduce Build Arguments Passed

**File**: `/home/user/Projects/veritable-games-main/.github/workflows/advanced-ci-cd.yml`
**Lines**: 482-488
**Change**: Only pass non-sensitive build arguments

---

## Implementation Details

### Problem Hierarchy

```
CRITICAL (Blocks Deployment):
  └─ Push Permission Denied
     └─ Root Cause: Missing packages:write permission
     └─ Fix Location: Workflow permissions block
     └─ Effort: 1 line change

HIGH (Security Vulnerability):
  ├─ Secrets in Dockerfile ENV
  │  └─ Root Cause: ARG/ENV with secrets
  │  └─ Fix Location: Dockerfile lines 25-27, 44-46
  │  └─ Effort: Remove/relocate 3 ENV instructions
  └─ Secrets in Workflow Build Args
     └─ Root Cause: Passing secrets in build-args
     └─ Fix Location: Workflow lines 482-488
     └─ Effort: Reduce to essential args only
```

---

## Key Insights

1. **GitHub GITHUB_TOKEN Limitation**:
   - GITHUB_TOKEN is convenient but scope-limited
   - Automatically created, limited permissions
   - Cannot manually increase scope (no UI option)
   - Works for most operations, fails for registry access

2. **Dockerfile Secrets Persistence**:
   - `ENV` variables are baked into image layers
   - Visible in history, inspect, and layer analysis
   - Harder to rotate after image creation
   - Best practice: Never put secrets in Dockerfile

3. **Docker Build Argument Visibility**:
   - `--build-arg` values visible in build output
   - Visible in CI/CD logs
   - Should not contain production secrets
   - Okay for non-sensitive values (versions, URLs)

4. **Registry Authentication Flow**:
   - Login creates credentials
   - Push checks token scopes
   - Scope must be declared in workflow.permissions
   - GitHub validates before allowing operation

---

## Testing Strategy

After fixes applied:

1. **Permission Check**
   - Verify workflow permissions include `packages: write`
   - Check GitHub Actions UI shows correct scopes

2. **Build Test**
   - Run workflow on test branch
   - Monitor build logs for secret warnings
   - Verify Trivy scanner passes

3. **Security Scan**
   - Run `trivy image` locally
   - Verify no secrets detected
   - Check layer history is clean

4. **Push Verification**
   - Confirm image pushes to ghcr.io
   - Verify image is accessible
   - Check image history for secrets

---

## References

- [GitHub Actions: permissions keyword](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions)
- [GitHub Container Registry scopes](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Best Practices: secrets](https://docs.docker.com/develop/dev-best-practices/)
- [Trivy: Secret Detection](https://aquasecurity.github.io/trivy/latest/docs/scanner/secret/)
- [docker/login-action documentation](https://github.com/docker/login-action)

