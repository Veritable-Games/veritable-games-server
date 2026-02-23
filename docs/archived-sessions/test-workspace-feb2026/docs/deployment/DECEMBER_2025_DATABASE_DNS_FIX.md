# Docker DNS Configuration Fix - December 30, 2025

**Status**: ✅ RESOLVED

**Issue**: Application container failing to start with `connect ETIMEDOUT 192.168.1.15:5432`

**Root Cause**: `DATABASE_URL` environment variable misconfigured with host IP instead of Docker internal DNS name

---

## Problem Description

The application container was crashing on startup with:
```
❌ Migration failed: connect ETIMEDOUT 192.168.1.15:5432
Stack trace: Error: connect ETIMEDOUT 192.168.1.15:5432
    at /app/node_modules/pg-pool/index.js:45:11
```

**Why this happened**:
- PostgreSQL container runs on Docker network `coolify` with internal DNS name `veritable-games-postgres`
- `DATABASE_URL` was set to host IP `192.168.1.15:5432` (not accessible from containers)
- Application tried to connect via host IP, which failed with connection timeout
- Migration scripts attempted to use `DATABASE_URL` instead of `POSTGRES_URL` (which was correct)

---

## Diagnostic Steps

### Check Environment Variables
```bash
ssh user@192.168.1.15 "
  docker exec m4s0kwo4kc4oooocck4sswc4 printenv | grep -E 'DATABASE|POSTGRES'
"
```

Expected to see:
```
DATABASE_URL=postgresql://postgres:postgres@192.168.1.15:5432/veritable_games  ❌ WRONG
POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games  ✅ CORRECT
```

### Check Application Logs
```bash
ssh user@192.168.1.15 "
  docker logs m4s0kwo4kc4oooocck4sswc4 --tail 30
"
```

Look for: `connect ETIMEDOUT 192.168.1.15:5432`

### Verify PostgreSQL Container Connectivity
```bash
ssh user@192.168.1.15 "
  docker exec m4s0kwo4kc4oooocck4sswc4 printenv | grep POSTGRES_URL
  # This should work if you try to connect using POSTGRES_URL
"
```

---

## Solution Applied

### Step 1: Update Migration Script (Code Fix)
**File**: `frontend/scripts/migrations/fix-truncated-password-hashes.js`

Changed:
```javascript
// ❌ BEFORE
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// ✅ AFTER
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
```

**Reason**: Prefer correct Docker DNS `POSTGRES_URL` over potentially misconfigured `DATABASE_URL`

**Commit**: `de848a197b` - "fix: Prefer POSTGRES_URL over DATABASE_URL in password hash migration"

### Step 2: Fix Coolify Environment Variables (Database Fix)
**Connected to Coolify database**:
```bash
ssh user@192.168.1.15 "docker exec -i coolify-db psql -U coolify -d coolify"
```

**Deleted incorrect DATABASE_URL**:
```sql
DELETE FROM environment_variables
WHERE resourceable_id = 1 AND key = 'DATABASE_URL'
AND value LIKE '%192.168.1.15%';
```

**Added corrected DATABASE_URL with Docker DNS**:
```sql
INSERT INTO environment_variables (
  uuid, created_at, updated_at, key, value, is_buildtime, is_runtime,
  resourceable_id, resourceable_type
) VALUES (
  'fix-database-url-docker-dns',
  NOW(),
  NOW(),
  'DATABASE_URL',
  'postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games',
  false,
  true,
  1,
  'App'
);
```

### Step 3: Restart Container
```bash
ssh user@192.168.1.15 "
  docker stop m4s0kwo4kc4oooocck4sswc4
  sleep 2
  docker start m4s0kwo4kc4oooocck4sswc4
"
```

---

## Verification

### After Fix Applied
```bash
ssh user@192.168.1.15 "docker logs m4s0kwo4kc4oooocck4sswc4 --tail 30"
```

**Expected Output**:
```
> veritablegames@0.1.0 start
> node scripts/migrations/fix-truncated-password-hashes.js && DATABASE_MODE=production tsx scripts/database/run-migrations.ts && tsx server/websocket-server.ts & next start

🔍 Checking for truncated password hashes in users.users table...
   ▲ Next.js 15.5.6
   - Local:        http://localhost:3000
   - Network:      http://10.0.1.10:3000

 ✓ Starting...
 ✓ Ready in 270ms
```

**No more timeout errors!** ✅

### Server Health Check
```bash
ssh user@192.168.1.15 "
  echo '=== Docker Status ==='
  docker ps | grep m4s0k

  echo '=== HTTP Status ==='
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:3000

  echo '=== Database Users ==='
  docker exec veritable-games-postgres psql -U postgres -d veritable_games -c 'SELECT COUNT(*) FROM auth.users;'
"
```

**Results**:
```
m4s0kwo4kc4oooocck4sswc4   Up 21 seconds (healthy)
HTTP 307
 count
-------
     2
(1 row)
```

All systems operational! ✅

---

## Docker DNS Concepts

### Why This Matters

**Docker Network Architecture**:
```
Host Machine (192.168.1.15)
├── Docker Network: "coolify"
    ├── Container: veritable-games-postgres (service name in network)
    │   └── Accessible at: veritable-games-postgres:5432
    │   └── NOT accessible at: 192.168.1.15:5432 (host IP)
    │
    └── Container: m4s0kwo4kc4oooocck4sswc4 (app)
        └── Can resolve: veritable-games-postgres
        └── CANNOT resolve: 192.168.1.15 (host IP outside network)
```

### Connection String Rules

**❌ WRONG** (Host IP - not accessible from containers):
```
DATABASE_URL=postgresql://postgres:postgres@192.168.1.15:5432/veritable_games
```

**✅ CORRECT** (Docker internal DNS - accessible from containers):
```
DATABASE_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
```

### When Setting Environment Variables

**In Coolify UI or Coolify database**:
- Always use Docker service names, not host IPs
- Example: `veritable-games-postgres` not `192.168.1.15`
- Docker automatically resolves service names within the network

**In Code/Scripts**:
- Prefer `POSTGRES_URL` (guaranteed to use Docker DNS)
- Use `DATABASE_URL` as fallback (may be misconfigured)
- Never hardcode IPs in connection strings

---

## Prevention for Future

### Best Practices

1. **Script Development**:
   ```javascript
   // Always prefer POSTGRES_URL first
   const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
   ```

2. **Environment Variable Setup**:
   - Document which variables use Docker DNS vs host network
   - Add validation to warn if DATABASE_URL uses host IP

3. **Coolify Configuration**:
   - Document that service names go in environment variables
   - Add migration script to fix any misconfigured variables

4. **Documentation**:
   - Update CLAUDE.md with Docker DNS critical rule ✅ (done)
   - Update Production Access Guide with troubleshooting ✅ (done)
   - Link from database documentation

---

## Related Issues

- **Symptom**: Application won't start, migrations timeout
- **Affected Systems**: Migration scripts, any startup-time database access
- **Severity**: Critical (prevents app from running)
- **Reproducibility**: High (if DATABASE_URL configured incorrectly)
- **Time to Fix**: ~10 minutes (once diagnosed)

---

## Timeline

| Time | Action | Result |
|------|--------|--------|
| 12/30 | Diagnosed: `connect ETIMEDOUT 192.168.1.15:5432` | Root cause identified |
| 12/30 | Updated migration script: prefer POSTGRES_URL | Code fix committed |
| 12/30 | Fixed Coolify environment: DATABASE_URL → Docker DNS | Environment fix applied |
| 12/30 | Restarted container | Application online ✅ |
| 12/30 | Updated documentation | CLAUDE.md + Production Guide |

---

## Testing Checklist

- [x] Application container starts without timeouts
- [x] Migration scripts complete successfully
- [x] HTTP endpoint responds (307 redirect)
- [x] Database connection verified (2 users)
- [x] No error logs related to database connection
- [x] Documentation updated
- [x] Code changes committed

---

**Status**: ✅ FULLY RESOLVED

**Last Updated**: December 30, 2025

**Next Review**: If similar timeout errors appear, check this guide first
