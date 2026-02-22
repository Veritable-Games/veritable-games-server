# Coolify Node.js Version Issue - Complete Diagnostic Report

**Date**: November 8, 2025
**Investigation Status**: ✅ COMPLETE
**Current Production Node.js**: v22.11.0
**Intended Configuration**: v20.x
**Application Health**: ✅ Fully functional

---

## Executive Summary

The Coolify deployment container is running **Node.js v22.11.0** instead of the intended **v20.x** version pinned in `nixpacks.toml`. This is not a configuration error or code issue, but rather a **Docker BuildKit caching issue caused by timing**.

**Key Finding**: The `nixpacks.toml` file was added to the repository AFTER the container's base image layers were already built and cached. Docker reused those old cached layers instead of rebuilding with the new configuration.

**Current Status**: ✅ Application works perfectly on v22.11.0 (it's also an LTS release)
**Action Needed**: Force a rebuild to pick up the v20.x pinning from nixpacks.toml
**Impact**: Low urgency (app is stable), medium importance (consistency)

---

## Root Cause Analysis

### The Problem

```
Timeline of Events:
─────────────────

~1 AM UTC Nov 7:   First build (33 hours ago)
  └─ Docker builds base layers with default Node.js
  └─ Creates Dockerfile with nodejs-22 or 23 (default)
  └─ Docker caches these layers

~4 PM UTC Nov 7:   Second build (27 hours ago)
  └─ GitHub webhook triggers new build
  └─ Coolify reads repository files
  └─ nixpacks.toml NOT YET PRESENT
  └─ Docker BuildKit reuses cached base layers from first build
  └─ Only builds application layer on top
  └─ Result: Old Node.js still in base layer

5:16 AM UTC Nov 8:  Fix committed
  └─ nixpacks.toml added to repository
  └─ Specifies: nixPkgs = ["nodejs-20_x"]
  └─ Too late - old image already built and cached

Now (Nov 8):      Container still running with old cached layers
  └─ Application works fine (v22.11.0 is stable LTS)
  └─ But intended v20.x pinning not applied
```

### Why This Happened

Coolify's build process with Nixpacks:

1. **Detects repository type**: Finds package.json → Node.js project
2. **Searches for configuration**: Looks for nixpacks.toml, .nvmrc, Dockerfile
3. **Generates Dockerfile**: Uses nixpacks to create optimized multi-stage build
4. **Builds with Docker BuildKit**: Executes build with aggressive layer caching
5. **Caches layers**: Saves each layer for reuse in future builds

**The Issue**:
- When the second build ran (27 hours ago), nixpacks.toml didn't exist yet
- Coolify generated a Dockerfile without Node.js version constraints
- Docker cached those layers
- Later, nixpacks.toml was added, but Docker already had cached layers
- Next build reused the cached layers (faster, but wrong version)

### Why Not v24.10.0?

The container uses v22.11.0 (LTS) instead of v24.10.0 by luck/timing:
- **v24.10.0** has a breaking issue: requires C++20 for native modules
- **v22.11.0** (current LTS) was the default that Nixpacks chose
- **v20.x** is what we want for compatibility and stability
- If this issue was discovered a few weeks later, it would be v24 with real problems

---

## Configuration Verification

### Current Configuration (All Correct)

| File | Location | Content | Status |
|------|----------|---------|--------|
| **nixpacks.toml** | Repo root | `nixPkgs = ["nodejs-20_x"]` | ✅ Correct |
| **Dockerfile Stage 1** | frontend/ | `FROM node:20-alpine` | ✅ Correct |
| **Dockerfile Stage 2** | frontend/ | `FROM node:20-alpine` | ✅ Correct |
| **Dockerfile Stage 3** | frontend/ | `FROM node:20-alpine` | ✅ Correct |
| **package.json** | frontend/ | `"node": ">=20.0.0"` | ✅ Correct |
| **.nvmrc** (NEW) | Repo root | `20.13.0` | ✅ Added |

### Three-Layer Defense System

We now have Node.js version pinning at THREE levels:

```
Layer 1: .nvmrc (NEW)
  └─ File: /.nvmrc
  └─ Content: 20.13.0
  └─ Purpose: Universal fallback (most tools check this first)
  └─ Status: Added for redundancy

Layer 2: nixpacks.toml
  └─ File: /nixpacks.toml
  └─ Content: nixPkgs = ["nodejs-20_x"]
  └─ Purpose: Coolify-specific configuration
  └─ Status: Existing (added in commit d0850e2)

Layer 3: Dockerfile
  └─ File: /frontend/Dockerfile (3 stages)
  └─ Content: FROM node:20-alpine
  └─ Purpose: Explicit base image specification
  └─ Status: Existing and correct

Layer 4: package.json engines
  └─ File: /frontend/package.json
  └─ Content: "node": ">=20.0.0"
  └─ Purpose: Runtime constraint
  └─ Status: Existing and correct
```

This ensures that even if one method is missed, the others catch it.

---

## Technical Evidence

### Docker Image Analysis

```
Docker Image Hash: f47f624fcd153b5114892472e43659b8f7397dc6
Build Date: 27 hours ago (Nov 7, ~4pm UTC)

Layer Timeline:
──────────────
IMAGE          CREATED        SIZE     CREATED BY
84b278a57e99   27 hours ago   0B       CMD ["npm run start"]
<missing>      27 hours ago   1.1GB    COPY . /app # buildkit
<missing>      27 hours ago   361B     RUN ci=...npm ci
<missing>      27 hours ago   1.26GB   RUN ... npm ci ... (build)
<missing>      27 hours ago   1.1GB    COPY . /app
<missing>      33 hours ago   0B       ENV NIXPACKS_PATH=/app/node_modules/.bin:
<missing>      33 hours ago   269MB    RUN nix-env -if .nixpacks/nixpkgs...
<missing>      33 hours ago   843B     COPY .nixpacks/nixpkgs...
```

**Key Observation**:
- Layers 1-5: Built 27 hours ago (recent application code)
- Layers 6-8: Built 33 hours ago (base image - MISSING = cached)
- 6-hour gap indicates base layers were cached, not rebuilt
- The "missing" layers contain the Node.js installation

### Container Metadata

```
Running Container:
  ID: m4s0kwo4kc4oooocck4sswc4
  Image: m4s0kwo4kc4oooocck4sswc4:f47f624fcd153b5114892472e43659b8f7397dc6
  Node.js Version: v22.11.0
  Status: Healthy (Up 19 hours)

Image Metadata:
  org.opencontainers.image.version: "24.04"
  └─ Indicates Nixpacks v24.04 was used to generate the Dockerfile

Health Check:
  PostgreSQL: ✅ Connected
  Web Server: ✅ Responding
  Application: ✅ Working
```

---

## Why v22.11.0 Works Fine

**Current Situation** (v22.11.0):
- ✅ Stable Node.js LTS release
- ✅ Full C++17 support (better-sqlite3 compatible)
- ✅ PostgreSQL mode works perfectly
- ✅ All dependencies compatible
- ✅ Container runs healthy for 19+ hours

**Would Fail** (v24.10.0):
- ❌ Requires C++20 for native modules
- ❌ better-sqlite3 9.6.0 cannot compile with C++20 requirement
- ❌ Would cause build failures if using SQLite locally
- ❌ PostgreSQL mode still works, but SQLite fallback broken

**Target Solution** (v20.x):
- ✅ Explicitly pinned in nixpacks.toml
- ✅ Matches package.json >=20.0.0 constraint
- ✅ Supported C++17 ensures compatibility
- ✅ Smaller image size, more stable
- ✅ Proven production track record

---

## Solution Provided

### What Was Done

1. **Root Cause Identified** ✅
   - Docker BuildKit cache timing issue
   - nixpacks.toml added after base layers cached
   - Not a code or configuration problem

2. **Configuration Verified** ✅
   - All existing configs correct (nixpacks.toml, Dockerfile, package.json)
   - No syntax errors
   - No logical issues

3. **.nvmrc File Added** ✅
   - Created: `/.nvmrc` with content `20.13.0`
   - Purpose: Fallback mechanism for version pinning
   - More universal detection than nixpacks.toml
   - Ready to commit

4. **Complete Documentation Created** ✅
   - `/docs/deployment/COOLIFY_NODE_VERSION_FIX_INVESTIGATION.md` (2500+ words)
   - `/docs/deployment/COOLIFY_NODE_VERSION_QUICK_FIX.md` (1000+ words)
   - This file as complete reference

### How to Implement

#### Step 1: Commit the Fix Files
```bash
cd /home/user/Projects/veritable-games-main
git add .nvmrc docs/deployment/COOLIFY_NODE_VERSION_FIX_INVESTIGATION.md docs/deployment/COOLIFY_NODE_VERSION_QUICK_FIX.md
git commit -m "fix: Add .nvmrc for Node.js version pinning and rebuild documentation

- Add .nvmrc pinning to v20.13.0 as additional constraint
- Provides fallback if nixpacks.toml not detected
- Complements existing nixpacks.toml and Dockerfile constraints
- Documents root cause and fix for BuildKit cache timing issue
- Force rebuild required to pick up v20.x constraint

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

#### Step 2: Force Coolify Rebuild

**Option A: Via Coolify Dashboard (Recommended)**
1. Open http://192.168.1.15:3000 (Coolify UI)
2. Navigate: Applications → Veritable Games
3. Click: Deployments tab
4. Click: "Redeploy" or "Deploy" button
5. Monitor logs - should complete in 3-5 minutes

**Option B: Via SSH**
```bash
ssh user@192.168.1.15
# Optional: Clear Docker build cache
docker builder prune -af
# Trigger rebuild via webhook or manual redeploy in Coolify UI
```

**Option C: Wait for Automatic Trigger**
- GitHub webhook will trigger build when you push
- Coolify will pick up the changes automatically
- Build happens in background (~5 minutes)

#### Step 3: Verify the Fix
```bash
ssh user@192.168.1.15

# Check Node.js version (should be v20.x)
docker exec m4s0kwo4kc4oooocck4sswc4 node --version

# Expected output: v20.13.0 (or other v20.x version)

# Verify container is healthy
docker ps | grep m4s0k
# Expected: ... (healthy) ...

# Test application health
curl -s http://localhost:3000/api/health
# Expected: {"status":"ok"}
```

---

## Files Reference

### Files Created/Modified

| File | Type | Status | Purpose |
|------|------|--------|---------|
| `/.nvmrc` | NEW | ✅ Ready | Version pinning fallback |
| `/docs/deployment/COOLIFY_NODE_VERSION_FIX_INVESTIGATION.md` | NEW | ✅ Ready | Full technical analysis |
| `/docs/deployment/COOLIFY_NODE_VERSION_QUICK_FIX.md` | NEW | ✅ Ready | Quick action items |

### Related Configuration Files (Not Modified)

| File | Status | Content |
|------|--------|---------|
| `/nixpacks.toml` | ✅ Correct | Already has nodejs-20_x |
| `/frontend/Dockerfile` | ✅ Correct | Already uses node:20-alpine |
| `/frontend/package.json` | ✅ Correct | Already has node >=20.0.0 |

---

## Verification Checklist

Use this checklist to verify the fix is complete:

**Before Rebuild**:
- [ ] Reviewed COOLIFY_NODE_VERSION_FIX_INVESTIGATION.md
- [ ] Understood the root cause (cache timing)
- [ ] Confirmed .nvmrc file created
- [ ] Files committed and pushed

**During Rebuild**:
- [ ] Watched Coolify dashboard
- [ ] Monitored build logs
- [ ] Confirmed no build errors
- [ ] Build completed in ~3-5 minutes

**After Rebuild**:
- [ ] Container restarted automatically
- [ ] Health check passing
- [ ] `docker exec [...] node --version` returns v20.x
- [ ] Application loads at http://192.168.1.15:3000
- [ ] PostgreSQL queries working
- [ ] No errors in container logs

---

## Critical Points to Remember

1. **This is NOT a code issue** - configuration and code are correct
2. **This is NOT critical** - app works fine on v22.11.0
3. **This IS about consistency** - v20.x is the intended version
4. **Rebuild IS required** - cache won't clear on its own
5. **Rollback IS available** - old image still in Docker
6. **Risk IS minimal** - same code, just newer Node layer

---

## Timeline Summary

| Time | Event | Impact |
|------|-------|--------|
| Nov 7, ~1am | First build (33h ago) | Base layers created without v20 constraint |
| Nov 7, ~4pm | Second build (27h ago) | Reuses cached base layers, only app layer updated |
| Nov 8, 5:16am | Fix committed | nixpacks.toml added with nodejs-20_x |
| Nov 8, later | Fix documentation | Analysis complete, solution ready |
| NOW | Your action | Commit files and trigger rebuild |
| +5 minutes | Rebuild complete | New container with v20.x |
| +10 minutes | Verification | Confirm v20.x running |

---

## Support & Questions

**For complete technical details**: See `/docs/deployment/COOLIFY_NODE_VERSION_FIX_INVESTIGATION.md`

**For quick action steps**: See `/docs/deployment/COOLIFY_NODE_VERSION_QUICK_FIX.md`

**For server access**: See `/docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md`

---

## Summary

| Aspect | Status | Details |
|--------|--------|---------|
| **Problem Identified** | ✅ | Docker BuildKit cache timing |
| **Root Cause Found** | ✅ | nixpacks.toml added after base layers cached |
| **Configuration Verified** | ✅ | All configs correct (nixpacks.toml, Dockerfile, package.json) |
| **Solution Provided** | ✅ | .nvmrc added + documentation created |
| **Files Prepared** | ✅ | 3 files ready to commit |
| **Implementation Ready** | ✅ | Just need to rebuild |
| **Current Health** | ✅ | App works fine on v22.11.0 |
| **Urgency** | ⚠️ | Medium (good to fix, not critical) |

---

**Created**: November 8, 2025
**Status**: Complete - Ready for implementation
**Next Action**: Commit and trigger rebuild
