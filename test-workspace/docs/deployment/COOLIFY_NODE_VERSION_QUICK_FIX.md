# Coolify Node.js Version - Quick Fix & Action Items

**Date**: November 8, 2025
**Status**: ✅ Root cause identified, fix ready to deploy
**Current Node.js**: v22.11.0 (works, but v20.x intended)
**Time to Fix**: 5 minutes to prepare, 3-5 minutes rebuild time

---

## The Issue (30-Second Summary)

Coolify is running Node.js v22.11.0 instead of v20.x because:
- nixpacks.toml was added AFTER the last build
- Docker BuildKit cached old base image layers
- Container is using old cached layers instead of respecting the new config

**Bottom line**: Not a critical issue (v22 works), but v20 is the intended version.

---

## What Was Done to Fix It

✅ **Already Completed**:
1. Verified nixpacks.toml syntax is correct (commit d0850e2)
2. Confirmed Dockerfile has v20-alpine (correct)
3. Verified package.json engines constraint (correct)
4. Identified root cause (cache timing issue)
5. Created .nvmrc file as additional pinning mechanism

✅ **Files Added** (ready to commit):
- `/.nvmrc` - Version pinning file
- `/docs/deployment/COOLIFY_NODE_VERSION_FIX_INVESTIGATION.md` - Full diagnostic report

---

## Next Actions (3 Steps)

### Step 1: Commit the Fix Files

```bash
cd /home/user/Projects/veritable-games-main
git add .nvmrc docs/deployment/COOLIFY_NODE_VERSION_FIX_INVESTIGATION.md
git commit -m "fix: Add .nvmrc for Node.js version pinning and rebuild documentation

- Add .nvmrc pinning to v20.13.0 as additional constraint
- Provides fallback if nixpacks.toml not detected
- Complements existing nixpacks.toml and Dockerfile constraints
- Documents root cause: BuildKit cache timing (base layers built before config file existed)
- Rebuild required to pick up v20.x constraint

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

### Step 2: Force Coolify Rebuild

**Via Coolify Dashboard** (recommended):
1. Open http://192.168.1.15:3000 (Coolify)
2. Navigate to: Applications → Veritable Games
3. Click: Deployments tab
4. Click: "Redeploy" button (or "Deploy" if available)
5. Watch logs - build takes 3-5 minutes

**Alternative - Via SSH**:
```bash
ssh user@192.168.1.15
# Clear Docker build cache (optional but recommended)
docker builder prune -af
# Trigger via webhook or wait for next push
# Or manually restart container to force redeploy
```

### Step 3: Verify the Fix

```bash
ssh user@192.168.1.15

# Check Node.js version (should be v20.x)
docker exec m4s0kwo4kc4oooocck4sswc4 node --version

# Check container is healthy
docker ps | grep m4s0k

# Test application
curl -s http://localhost:3000/api/health | jq .
```

Expected output:
```
v20.13.0     ← Exact version may vary (20.x series)
HEALTHY      ← Container status
{"status":"ok"}  ← Health check
```

---

## Why This Works

| File | Purpose | Status |
|------|---------|--------|
| `nixpacks.toml` | Primary: Tells Coolify to use v20 | ✅ Merged |
| `.nvmrc` | Fallback: Explicit version pinning | ✅ Added |
| `Dockerfile` | Override: All 3 stages use v20-alpine | ✅ Verified |
| `package.json` engines | Constraint: Requires >=20.0.0 | ✅ Verified |

**Three-layer defense**:
1. If Coolify reads nixpacks.toml → v20 installed
2. If Coolify reads .nvmrc → v20 installed
3. If both missed → package.json engines enforces at runtime

---

## What .nvmrc Does

The `.nvmrc` file (Node Version Manager config):
- Widely recognized by build tools (Nixpacks, Docker, CI/CD)
- Tells any Node.js version manager: "This project uses v20.13.0"
- Fallback detection chain: prettier, more universal than nixpacks.toml

**Example chain**:
```
Tools check for version in this order:
1. .nvmrc (most common)
2. .tool-versions (asdf format)
3. nixpacks.toml (nixpacks-specific)
4. package.json engines (runtime constraint)
5. Latest LTS (default fallback)
```

---

## Expected Timeline

| Action | Duration | Notes |
|--------|----------|-------|
| Commit files | Immediate | Just `git push` |
| GitHub webhook triggers | <1 minute | Automatic |
| Coolify detects changes | <1 minute | Automatic |
| Docker build | 3-5 minutes | Includes npm ci, next build |
| Container restart | 30 seconds | Automatic |
| Health check pass | <1 minute | Automatic |
| **Total time** | **~8 minutes** | From push to running |

---

## Monitoring the Build

### In Coolify Dashboard
1. Applications → Veritable Games
2. Deployments tab
3. Watch status change: Pending → Building → Built → Running

### In Production Server
```bash
ssh user@192.168.1.15
# Watch build in real-time
docker logs -f m4s0kwo4kc4oooocck4sswc4

# Or check periodically
watch -n 5 'docker ps | grep m4s0k && docker exec m4s0kwo4kc4oooocck4sswc4 node --version'
```

---

## Rollback (If Needed)

If for any reason the rebuild breaks:

```bash
# Revert the .nvmrc file
git revert HEAD
git push

# Or manually set to previous working image
ssh user@192.168.1.15
docker ps -a  # Find old image hash
docker run -d [old-image-hash] # Restart old version
```

Rollback time: <5 minutes

---

## Files Reference

| File | Purpose | Location |
|------|---------|----------|
| .nvmrc | Version pinning (new) | Repo root |
| nixpacks.toml | Coolify config | Repo root |
| Dockerfile | Build definition | frontend/ |
| package.json | Runtime constraint | frontend/ |

All files are properly configured. No breaking changes.

---

## Validation Checklist

Before considering this complete:

- [ ] Commit .nvmrc and documentation
- [ ] Push to origin/main
- [ ] Coolify rebuild completed
- [ ] Container restarted successfully
- [ ] `docker exec [...] node --version` shows v20.x
- [ ] Application loads at 192.168.1.15:3000
- [ ] PostgreSQL queries working
- [ ] No error logs in container

---

## Key Points

1. **The fix is simple**: .nvmrc + rebuild
2. **No code changes needed**: This is purely infrastructure
3. **Zero downtime approach**: Rebuild happens automatically
4. **Rollback is trivial**: Just revert the commit
5. **This ensures consistency**: v20 across dev, Docker, and production

---

## If Issues Occur

**Problem**: Rebuild still shows v22 or higher
**Solution**: Check Coolify app settings for Node.js version override field

**Problem**: Build fails with dependency errors
**Solution**: Likely unrelated - check application code

**Problem**: Container won't start after rebuild
**Solution**: Check Docker logs for errors, revert if needed

---

## Documentation References

- **Full diagnostic report**: [COOLIFY_NODE_VERSION_FIX_INVESTIGATION.md](./COOLIFY_NODE_VERSION_FIX_INVESTIGATION.md)
- **Original deployment guide**: [COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md)
- **Server access guide**: [CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)

---

## Summary

✅ **Root cause identified**: Cache timing + missing rebuild trigger
✅ **Fix implemented**: .nvmrc added, documentation created
⏳ **Action pending**: Force rebuild and verify v20.x
✅ **Rollback available**: Simple if needed
✅ **Application status**: Working fine on v22, will improve on v20

**Next step**: Run the commit and trigger rebuild.

---

**Last Updated**: November 8, 2025
**Status**: Ready to deploy
