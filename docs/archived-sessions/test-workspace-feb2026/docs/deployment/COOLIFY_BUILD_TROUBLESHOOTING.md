# Coolify Build Troubleshooting - Quick Reference

**Quick Fix Applied**: November 9, 2025
**Issue**: Docker build fails with "PostgreSQL connection not configured"
**Solution Status**: FIXED - Code change deployed

---

## TL;DR - The Fix

The Docker build now succeeds without runtime environment variables because the adapter detects the build phase and skips database validation until the application actually starts.

**What changed**: `frontend/src/lib/database/adapter.ts` now checks `NEXT_PHASE=phase-production-build` to detect build time and allows the build to proceed.

**Trigger a rebuild**: Push code changes to main branch (webhook will auto-deploy).

---

## Quick Diagnostic - Is the Fix Working?

Run this in 5 seconds to check:

```bash
# Option 1: Check latest commits
git log --oneline | head -3
# Should show: 47e930a fix(build): Allow Docker build to succeed...

# Option 2: Check Coolify logs
ssh user@192.168.1.15
docker logs -f coolify-api 2>/dev/null | grep -i "docker build\|error" | head -5

# Option 3: Try manual Docker build
cd frontend
docker build --target builder -t test . 2>&1 | tail -20
# Should NOT show: "FATAL: PostgreSQL connection not configured"
```

---

## If Build Still Fails

### Symptom: "PostgreSQL connection not configured" during build

```
Error: 🚨 FATAL: PostgreSQL connection not configured. Set POSTGRES_URL
or DATABASE_URL environment variable. SQLite is no longer supported.
```

**Step 1**: Verify the fix was deployed
```bash
git log --oneline frontend/src/lib/database/adapter.ts | head -1
# Should show: 47e930a - if not, fix hasn't been deployed yet
```

**Step 2**: Force Coolify to pull latest code
```bash
ssh user@192.168.1.15
docker exec coolify-api curl -X POST http://localhost:3000/api/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/main"}' 2>&1
```

**Step 3**: Monitor the rebuild
```bash
# Watch Coolify logs
docker logs -f coolify-api --tail=50 2>&1 | grep -i "veritable\|build\|error"

# Or check in Coolify UI:
# http://192.168.1.15:8000 → Application → Logs → New Deployment
```

---

### Symptom: Build succeeds but container doesn't start

**Error**: Application crashes on startup with database error

**This is CORRECT behavior** - it means the fix is working:
- Build succeeded without database ✓
- Container started ✓
- Application checked for DATABASE_URL at runtime
- DATABASE_URL not found → Crash (expected)

**Fix**: Ensure environment variables are set in Coolify:
```bash
ssh user@192.168.1.15

# Check what's configured
docker exec coolify-db psql -U coolify -d coolify << 'SQL'
SELECT key, is_buildtime, is_runtime FROM environment_variables
WHERE resourceable_id = 1 AND key LIKE '%DATABASE%';
SQL

# Expected output:
#   key     | is_buildtime | is_runtime
# --------+----------+----------
#  DATABASE_URL | f        | t
#  POSTGRES_URL | f        | t
```

If DATABASE_URL or POSTGRES_URL are missing:
1. Add them in Coolify UI: Application → Environment Variables
2. Set value to: `postgresql://postgres:secure_postgres_password@veritable-games-postgres-new:5432/veritable_games`
3. Trigger rebuild

---

### Symptom: "NEXT_PHASE not recognized" or strange build errors

**This shouldn't happen** - NEXT_PHASE is set automatically by Next.js.

But if it does:

**Step 1**: Check Node.js version
```bash
ssh user@192.168.1.15
docker ps --filter name=veritable-games --format '{{.ID}}' | \
  xargs docker inspect --format '{{.Config.Image}}' | head -1
# Should say: node:20-alpine or similar

# If wrong version, update in Coolify:
# Settings → Node Version → Select 20 or 24
```

**Step 2**: Force clean rebuild
```bash
ssh user@192.168.1.15

# Find container ID
CONTAINER=$(docker ps --filter name=veritable-games --quiet)

# Stop it
docker stop $CONTAINER

# Remove it
docker rm $CONTAINER

# Trigger rebuild in Coolify UI
# http://192.168.1.15:8000 → Application → Deployments → Rebuild
```

---

## Build Environment Variables Explained

### What Gets Passed to Docker Build?

**Currently (without manual fix)**:
```bash
docker build \
  -f Dockerfile \
  -t veritable-games:latest \
  .
# Note: No --build-arg flags
# No environment variables available
# Dockerfile fallback defaults used
```

**With full Coolify optimization** (optional):
```bash
docker build \
  --build-arg DATABASE_URL=postgresql://... \
  --build-arg NODE_ENV=production \
  --build-arg SESSION_SECRET=... \
  -f Dockerfile \
  -t veritable-games:latest \
  .
```

### Current Architecture

```
Three Database States:
1. Build Phase (with fix):
   ├─ DATABASE_URL = undefined
   ├─ Adapter constructor called
   ├─ NEXT_PHASE=phase-production-build detected
   └─ Skips validation ✓

2. Fallback (if no build-arg):
   ├─ DATABASE_URL = postgresql://build:build@localhost:5432/build_db
   ├─ (dummy value from Dockerfile line 41)
   └─ Not actually used anywhere

3. Runtime (correct path):
   ├─ DATABASE_URL = injected from Coolify env vars
   ├─ Adapter constructor called again
   ├─ NODE_ENV=production (not in build phase)
   └─ Database validation ENFORCED ✓
```

---

## Prevention - How to Avoid This Issue

### 1. Always Deploy With Tested Builds

```bash
# Before pushing to production
cd frontend
npm run type-check  # Catch TypeScript errors
npm run build       # Test full build locally
```

### 2. Use .env.local for Local Testing

```bash
cd frontend

# Create .env.local with actual PostgreSQL connection
echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/veritable_games" >> .env.local

# Run build locally to catch issues before pushing
npm run build

# Clean up
git checkout .env.local  # Don't commit secrets
```

### 3. Monitor Coolify Logs After Deployments

```bash
ssh user@192.168.1.15

# Watch logs in real-time
docker logs -f coolify-api --tail=20 2>&1

# Check container health
docker ps --filter name=veritable-games --format '{{.Status}}'
# Should say: Up X minutes (healthy)
# If: Up X minutes (unhealthy) → Database connection issue
```

### 4. Understand the Two-Phase Architecture

Remember:
- **Build Phase**: Static analysis, no database needed
- **Runtime Phase**: Application logic, database required

Code that breaks:
```typescript
// ❌ BAD - Requires database at build time
export const config = {
  users: dbPool.getConnection().all('SELECT * FROM users')  // Error!
};

// ✓ GOOD - Database accessed only at runtime
export async function GET() {
  const users = await dbPool.getConnection().all('SELECT * FROM users');
  return Response.json(users);
}
```

---

## Reference: Before and After

### Before (Build Failed)

```
GitHub Webhook → Coolify Receives Push
    ↓
Coolify runs: docker build -f Dockerfile ...
    ↓
Build process starts, creates builder stage
    ↓
npm run build executes
    ↓
Next.js loads adapter.ts
    ↓
DatabaseAdapter constructor runs
    ↓
Checks: if (!POSTGRES_URL && !DATABASE_URL) → TRUE
    ↓
Throws: 🚨 FATAL: PostgreSQL connection not configured
    ↓
Build FAILS ❌
    ↓
Application never deploys
```

### After (Build Succeeds)

```
GitHub Webhook → Coolify Receives Push
    ↓
Coolify runs: docker build -f Dockerfile ...
    ↓
Build process starts, creates builder stage
    ↓
npm run build executes
    ↓
Next.js loads adapter.ts
    ↓
DatabaseAdapter constructor runs
    ↓
Checks: const isBuildPhase = NEXT_PHASE === 'phase-production-build' → TRUE
    ↓
Skips validation, returns ✓
    ↓
npm run build completes ✓
    ↓
Docker image created ✓
    ↓
Container starts with DATABASE_URL from Coolify env vars
    ↓
Adapter constructor runs again with NODE_ENV=production
    ↓
Validation enforced: if (!DATABASE_URL) → Checks environment
    ↓
PostgreSQL connects successfully ✓
    ↓
Application runs ✓
```

---

## Emergency Procedures

### If Application Is Down (Container Crashed)

```bash
ssh user@192.168.1.15

# 1. Check if container exists
docker ps -a | grep veritable-games
# If no result → container removed or in failed state

# 2. Check logs
docker logs $(docker ps -a --filter name=veritable-games --quiet) --tail=50

# 3. Restart from Coolify
# Option A: Trigger rebuild in UI
# http://192.168.1.15:8000 → Application → Deployments → Rebuild

# Option B: Manual restart
docker restart $(docker ps -a --filter name=veritable-games --quiet)

# 4. Check if it stays running
sleep 5
docker ps --filter name=veritable-games --format '{{.Status}}'
# Should say "Up" - if it says "Exited" → Check logs for error
```

### If Coolify Dashboard Is Unresponsive

```bash
ssh user@192.168.1.15

# Check if Coolify is running
docker ps | grep coolify | wc -l
# Should be 2-3 containers (coolify-api, coolify-db, coolify-proxy)

# If not running, restart
docker-compose -f ~/.docker/compose/docker-compose.yml up -d

# Wait for startup
sleep 10

# Check status
docker ps | grep coolify
```

---

## When to Escalate

Contact the developer if:

1. **Build fails** with different error than "PostgreSQL connection not configured"
2. **Container starts but immediately exits** with cryptic error
3. **Coolify dashboard unreachable** and manual restart doesn't help
4. **Database connection fails** at runtime (already working database URL was correct)
5. **Multiple deployments failing** even with the fix applied

Include these details:
- Output of `docker logs [container-id] --tail=50`
- Output of `docker ps -a | grep veritable`
- Coolify deployment logs screenshot
- Exact error message

---

## Summary Table

| Scenario | Symptom | Fix |
|----------|---------|-----|
| Build fails during npm run build | PostgreSQL not configured | ✓ Already fixed (code change) |
| Build succeeds but container won't start | Database error at startup | Check Coolify env vars are set |
| Build hangs on "Initializing database" | No progress for 5+ minutes | Kill and restart container |
| Container crashes after 30 seconds | "Connection refused" in logs | PostgreSQL container not running |
| Coolify dashboard shows old build | Rebuild button doesn't work | Restart Coolify: docker-compose up -d |
| Can build locally but not in Coolify | Locally works fine | Check Node version in Coolify settings |

---

**Document Created**: November 9, 2025
**Status**: Quick reference for build troubleshooting
**When to Use**: When Coolify deployment fails or needs debugging
