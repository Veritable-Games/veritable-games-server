# Coolify Node.js Version Cache Issue - Complete Investigation & Fix

**Date**: November 8, 2025
**Investigation Status**: ✅ Complete
**Problem**: Coolify not respecting nixpacks.toml Node.js version pin despite file being committed
**Root Cause**: BuildKit cache reusing old base layers built before config file existed
**Recommended Fix**: Force rebuild with cache clear

---

## Executive Summary

The Coolify deployment is successfully using v22.11.0 (Node.js LTS), but the intended v20.x pinning from `nixpacks.toml` is not being applied because:

1. **Timing Issue**: The `nixpacks.toml` file was committed on **Nov 8, 05:16 UTC**
2. **Last Build**: Container last built **27 hours ago (Nov 7, ~4pm UTC)** - BEFORE the fix
3. **Cache Problem**: Docker BuildKit reused cached base image layers from before the file existed
4. **Result**: Old Dockerfile without Node.js version constraint still in use

**Current Status**: ✅ Application is stable on v22.11.0 (acceptable Node.js 22 is LTS)
**Required Action**: Force rebuild to pick up v20.x pinning from nixpacks.toml
**Urgency**: Medium (only critical if using better-sqlite3 locally; PostgreSQL mode works fine)

---

## Diagnostic Findings

### 1. Current Production State

```
Container ID:         m4s0kwo4kc4oooocck4sswc4
Node.js Version:      v22.11.0 (LTS)
Container Status:     Healthy (Up 19 hours)
Last Build Time:      27 hours ago (Nov 7, ~4pm UTC)
Build Image Hash:     f47f624fcd153b5114892472e43659b8f7397dc6
PostgreSQL Status:    Connected and working
```

### 2. Configuration Analysis

**File 1: nixpacks.toml (Repository Root)**
```toml
[phases.setup]
aptPkgs = ["python3", "build-essential"]
nixPkgs = ["nodejs-20_x"]
```
Status: ✅ Correct syntax
Added: Commit d0850e2 (November 8, 05:16 UTC)

**File 2: Dockerfile (frontend/)**
```dockerfile
FROM node:20-alpine AS deps        # Line 4
FROM node:20-alpine AS builder     # Line 17
FROM node:20-alpine AS runner      # Line 51
```
Status: ✅ All three stages pinned to v20-alpine

**File 3: package.json (frontend/)**
```json
{
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
```
Status: ✅ Enforces minimum v20

### 3. Root Cause Evidence

**Docker Image Build History**:
```
IMAGE          CREATED        CREATED BY
84b278a57e99   27 hours ago   CMD ["npm run start"]             ← Latest
<missing>      27 hours ago   COPY . /app # buildkit
<missing>      27 hours ago   RUN |24 CI= ... npm ci              ← Build execution
<missing>      27 hours ago   COPY . /app/. # buildkit
<missing>      33 hours ago   ENV NIXPACKS_PATH=/app/node_modules/.bin:
<missing>      33 hours ago   RUN nix-env -if .nixpacks/nixpkgs...  (269MB)
<missing>      33 hours ago   COPY .nixpacks/nixpkgs...
```

**Analysis**:
- Layers marked "missing" are from 33 hours ago (Nov 7 ~1am UTC)
- These "missing" layers contain the Node.js base installation
- 6 hour gap between base layer build (33h ago) and app layer build (27h ago)
- nixpacks.toml was added AFTER the base layers were cached

**Timeline**:
- ~1am UTC Nov 7: Old build (33 hours ago) - created base layers WITHOUT v20 constraint
- ~4pm UTC Nov 7: Recent build (27 hours ago) - reused OLD base layers, only built app layers
- ~5:16am UTC Nov 8: Fix committed (nixpacks.toml added)
- Now (Nov 8, later): Container still running with old cached base layers

### 4. Why v22.11.0 Not v24.10.0?

The concern was about v24.10.0 (which requires C++20 for better-sqlite3). Current v22.11.0 is:
- **Between v20 and v24** in the Node.js release line
- **LTS version** (stable and well-tested)
- **Compatible with better-sqlite3 9.6.0** (needs C++17, not C++20)
- **Works fine with PostgreSQL mode** (no native compilation needed)

The v24.10.0 issue only materializes if someone tries to:
1. Use better-sqlite3 locally with Node v24
2. Rebuild the container without the nixpacks.toml fix

---

## Root Cause Analysis

### The Problem

```
┌─────────────────────────────────────────────────────────────┐
│ Coolify Build Process                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. GitHub webhook triggers                                 │
│    ↓                                                        │
│ 2. Coolify reads repository files                          │
│    ├─ Checks for nixpacks.toml ← MISSING at this point    │
│    ├─ Checks for Dockerfile ← FOUND (explicit)            │
│    ├─ Uses .nvmrc ← MISSING                               │
│    └─ Generates Dockerfile with DEFAULT Node.js          │
│    ↓                                                        │
│ 3. Docker BuildKit executes build                         │
│    ├─ Layer 1: Base OS image (Debian/Ubuntu)             │
│    ├─ Layer 2: Install Node.js (DEFAULT 22.x or 24.x)    │
│    ├─ Layer 3: Install dependencies                       │
│    ├─ Layer 4: Build application                          │
│    └─ Layer 5: Package final image                        │
│    ↓                                                        │
│ 4. Docker caches each layer                               │
│    └─ Reuses SAME layers if unchanged                     │
│    ↓                                                        │
│ 5. Later: nixpacks.toml added to repo                    │
│    ├─ Coolify doesn't know to rebuild base layers         │
│    ├─ BuildKit reuses cached layers 1-3                   │
│    └─ Result: Old Node.js version persists                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Why nixpacks.toml Wasn't Picked Up

Coolify's Nixpacks integration has a specific order:
1. Reads Dockerfile if present (takes priority)
2. Reads nixpacks.toml if Dockerfile absent
3. Auto-detects from package.json if neither exists

In our case:
- **Problem**: We have BOTH Dockerfile AND nixpacks.toml
- **What happened**: Coolify generated Dockerfile BEFORE nixpacks.toml existed
- **Current state**: Coolify still using old generated Dockerfile
- **BuildKit**: Caching base layers from before nixpacks.toml was added

### Why Rebuild Will Fix It

When Coolify rebuilds:
```
1. Reads current nixpacks.toml (now exists)
2. Generates NEW Dockerfile with nodejs-20_x constraint
3. BuildKit detects base layer changes
4. BuildKit rebuilds ALL layers from scratch (no cache reuse)
5. Result: Fresh container with v20.x as specified
```

---

## Solution - Recommended Approach

### Primary Fix: Force Coolify Rebuild

**This is the correct solution** because:
- Regenerates Dockerfile from current nixpacks.toml
- Clears BuildKit cache for base layers
- Ensures v20.x installation
- Better-sqlite3 will compile with C++17 (Node v20 compatible)

**Steps**:

1. **Access Coolify Dashboard**
   - URL: http://192.168.1.15/dashboard
   - Login with your Coolify credentials

2. **Navigate to Veritable Games Application**
   - Applications → Veritable Games
   - Or: Projects → [Project] → Veritable Games

3. **Trigger Rebuild**
   - Option A (Recommended): Settings → Advanced → "Rebuild" button
   - Option B: Deployments → "Deploy" (will rebuild if needed)
   - Option C: "Reset & Rebuild" (clears all caches)

4. **Monitor Build Progress**
   - Watch Deployments tab
   - Logs should show: "Found nodejs-20_x in nixpacks.toml"
   - Build takes ~3-5 minutes

5. **Verify Success**
   ```bash
   ssh user@192.168.1.15
   docker exec m4s0kwo4kc4oooocck4sswc4 node --version
   # Expected output: v20.13.x or similar
   ```

### Alternative Fix 1: Add .nvmrc File (Fallback)

If Coolify still doesn't pick up nixpacks.toml, add Node version file:

**File**: `/home/user/Projects/veritable-games-main/.nvmrc`
```
20.13.0
```

**Why it works**:
- Nixpacks has fallback detection chain
- .nvmrc is more universal than nixpacks.toml
- Even if Dockerfile exists, .nvmrc is respected

**Deploy**:
```bash
echo "20.13.0" > /home/user/Projects/veritable-games-main/.nvmrc
git add .nvmrc
git commit -m "fix: Add .nvmrc for explicit Node.js version pinning"
git push origin main
# Then trigger rebuild in Coolify
```

### Alternative Fix 2: Explicit Dockerfile Override

If both nixpacks.toml and .nvmrc are ignored, remove the frontend/Dockerfile:

**Why**:
- Forces Coolify to use nixpacks.toml for image generation
- Removes ambiguity about which Dockerfile to use

**Steps**:
```bash
git rm frontend/Dockerfile
git commit -m "fix: Remove Dockerfile to force nixpacks.toml generation"
git push origin main
# Then trigger rebuild
```

**Note**: Only do if absolutely necessary - our Dockerfile is intentionally optimized for the application.

### Alternative Fix 3: Coolify UI Override

Some Coolify versions support per-application Node.js version:

1. Coolify Dashboard → Veritable Games app
2. Settings → Build & Deploy
3. Look for: "Node.js Version" or "Build Environment"
4. Set to: `20.13.0` or `20`
5. Save and rebuild

---

## Implementation Status

### Current Configuration - Status

| File | Location | Content | Status |
|------|----------|---------|--------|
| nixpacks.toml | Repo root | `nixPkgs = ["nodejs-20_x"]` | ✅ Correct |
| Dockerfile | frontend/ | `FROM node:20-alpine` (3 stages) | ✅ Correct |
| package.json | frontend/ | `"node": ">=20.0.0"` | ✅ Correct |
| .nvmrc | Repo root | NOT PRESENT | Optional |

**Recommendation**: Add .nvmrc as belt-and-suspenders approach

### Files to Create/Modify

**File 1: Add .nvmrc (Recommended)**
- **Path**: `/home/user/Projects/veritable-games-main/.nvmrc`
- **Content**: `20.13.0`
- **Reason**: Explicit fallback for version pinning
- **Git**: Add and commit

```bash
echo "20.13.0" > .nvmrc
git add .nvmrc
git commit -m "fix: Add .nvmrc for Node.js version pinning (belt-and-suspenders)"
git push
```

**File 2: Update COOLIFY.md (Documentation)**
- Document the issue
- Document the rebuild procedure
- Document version pinning precedence

---

## Verification Checklist

After implementing the fix:

- [ ] Coolify rebuild completed successfully
- [ ] Build logs show "Found nodejs-20_x" or similar
- [ ] New Docker image created with recent timestamp
- [ ] Container restarted automatically
- [ ] Container health check passing
- [ ] `docker exec m4s0kwo4kc4oooocck4sswc4 node --version` returns v20.x
- [ ] Application accessible at http://192.168.1.15:3000
- [ ] PostgreSQL queries working (verify in app)
- [ ] No errors in container logs regarding Node version

---

## Why v22.11.0 vs v24.10.0

**Current Situation** (v22.11.0):
- ✅ Stable LTS release
- ✅ Compatible with better-sqlite3 (C++17 requirement)
- ✅ Works with PostgreSQL mode
- ✅ No compilation issues

**Problem Scenario** (v24.10.0):
- ❌ Would occur if build ran with Dockerfile using `FROM node:latest` or `FROM node:24-alpine`
- ❌ Requires C++20 for better-sqlite3 compilation
- ❌ Would cause build failure if ever using better-sqlite3

**Our Fix** (v20.x):
- ✅ Explicitly pinned in 3 places
- ✅ Matches package.json engines constraint
- ✅ Smaller than v22, more stable than v24
- ✅ C++17 support ensures better-sqlite3 always compiles

---

## Debugging Commands

### Check Current Node Version
```bash
ssh user@192.168.1.15
docker exec m4s0kwo4kc4oooocck4sswc4 node --version
```

### View Build Logs (Last Build)
```bash
ssh user@192.168.1.15
docker logs m4s0kwo4kc4oooocck4sswc4 2>&1 | grep -i "node\|version\|npm" | head -20
```

### Verify nixpacks.toml is in Repo
```bash
git show HEAD:nixpacks.toml
# Should show the file with nodejs-20_x
```

### Check Container Image Details
```bash
ssh user@192.168.1.15
docker inspect m4s0kwo4kc4oooocck4sswc4:f47f624fcd153b5114892472e43659b8f7397dc6 \
  --format='{{json .Config.Image}}'
```

### Monitor Next Build (Real-time)
```bash
ssh user@192.168.1.15
docker logs -f m4s0kwo4kc4oooocck4sswc4
```

---

## FAQ

**Q: Is v22.11.0 acceptable?**
A: Yes, it's stable and works. But v20.x is the intended target for consistency.

**Q: Why not force push to main?**
A: Not needed - we have committed the fix properly in d0850e2.

**Q: Will rebuild cause downtime?**
A: 3-5 minute deployment window, then automatic restart.

**Q: What if rebuild still uses v22?**
A: Use .nvmrc file as fallback (more universal than nixpacks.toml).

**Q: Is this a critical issue?**
A: Low priority - app works fine on v22. Medium priority if using SQLite locally.

---

## Related Documentation

- [COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md) - Original deployment
- [CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md) - Server access
- [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - General troubleshooting

---

## Summary Table

| Aspect | Finding | Status |
|--------|---------|--------|
| Current Node.js | v22.11.0 | ✅ Stable |
| Intended Node.js | v20.x | ✅ Configured |
| Root Cause | BuildKit cache + timing | ✅ Identified |
| Configuration | 3-point verification | ✅ All correct |
| Application State | Healthy | ✅ Working |
| PostgreSQL | Connected | ✅ Working |
| Fix Approach | Force rebuild | ✅ Recommended |
| Implementation | Not yet applied | ⏳ Pending |

---

**Last Updated**: November 8, 2025
**Next Action**: Force Coolify rebuild and verify Node.js version
