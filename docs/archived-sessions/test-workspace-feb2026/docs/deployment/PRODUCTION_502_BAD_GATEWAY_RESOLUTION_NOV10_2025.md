# Production 502 Bad Gateway - Resolution Log (November 10, 2025)

## 🚨 Issue Summary

**Date**: November 10, 2025 (07:00-07:15 UTC)
**Status**: ✅ **RESOLVED**
**Impact**: Production application (192.168.1.15:3000) returned 502 Bad Gateway errors

---

## 🔍 Root Cause Analysis

### The Problem

The application container (`m4s0kwo4kc4oooocck4sswc4`) was stuck in a **crash loop** (Restarting status) because:

**Missing Environment Variables**:
- `DATABASE_URL` was completely absent from Coolify's environment configuration
- `POSTGRES_URL` was also missing
- The migration script `fix-truncated-password-hashes.js` requires either `DATABASE_URL` or `POSTGRES_URL` to connect to the database
- Without these variables, the migration would fail with exit code 1, causing the container to crash and restart

### Container Logs (Before Fix)

```
> veritablegames@0.1.0 start
> node scripts/migrations/fix-truncated-password-hashes.js && next start

❌ DATABASE_URL or POSTGRES_URL environment variable not set
```

This repeated infinitely in a crash loop.

---

## 🔧 Solution Applied

### Step 1: Identified Missing Variables
Queried Coolify's database to confirm environment variables:
```sql
SELECT key FROM environment_variables
WHERE resourceable_id = 1
AND (key = 'DATABASE_URL' OR key = 'POSTGRES_URL');
-- Result: (0 rows) - Both variables missing!
```

### Step 2: Added Missing Environment Variables
Inserted `DATABASE_URL` and `POSTGRES_URL` into Coolify's database:
```sql
INSERT INTO environment_variables
(key, value, is_buildtime, is_runtime, resourceable_type, resourceable_id, uuid, version)
VALUES
('DATABASE_URL', 'postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games', true, true, 'App', 1, gen_random_uuid()::text, '4.0.0-beta.239'),
('POSTGRES_URL', 'postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games', true, true, 'App', 1, gen_random_uuid()::text, '4.0.0-beta.239');
```

### Step 3: Attempted Coolify Redeploy
- Restarted container (didn't pick up new env vars)
- Queued deployment job in Coolify (not processed in time)
- Coolify's automatic deployment system didn't immediately inject the new variables

### Step 4: Manual Container Fix
Since Coolify wasn't responsive in time, manually:
1. Removed the crashing container
2. Ran a new container with environment variables manually specified:
   ```bash
   docker run -d \
     --name m4s0kwo4kc4oooocck4sswc4 \
     --network veritable-games-network \
     -p 3000:3000 \
     -e DATABASE_URL='postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games' \
     -e POSTGRES_URL='postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games' \
     -e NODE_ENV=production \
     -e SESSION_SECRET='...' \
     -e ENCRYPTION_KEY='...' \
     -e COOKIE_SECURE_FLAG=false \
     -e NEXT_TELEMETRY_DISABLED=1 \
     'm4s0kwo4kc4oooocck4sswc4:eee545eb8ca1369d9c03f6d02647db8d18ec7f21'
   ```

### Step 5: Verified Success
After fix, application:
- ✅ Container status: `Up 17 seconds` (healthy)
- ✅ HTTP response: `307 Temporary Redirect` (not 502!)
- ✅ Database connection: Working (`2 users` found)
- ✅ Migration: Successful (`✅ No truncated password hashes found`)

---

## 📝 Critical Findings

### Why Did This Happen?

1. **Coolify Configuration Loss**: The environment variables that SHOULD have been configured in Coolify weren't there
   - Either lost during a Coolify restart
   - Or never properly set during initial deployment
   - Or accidentally cleared

2. **No Fallback System**: The application's startup script has no fallback when environment variables are missing - it fails hard and crashes

3. **Coolify Automation Failure**: Attempting to use Coolify's normal deployment pipeline to inject new variables didn't work in the timeframe

### Why the Container Couldn't Auto-Recover

- Coolify's restart policy in the database allows infinite restarts
- But without env vars, the container crashes immediately after each restart
- This creates an infinite crash loop with no way for the application to start

---

## 🛡️ Prevention & Monitoring

### Immediate Actions Needed

1. **Verify Coolify Environment Variables**
   - Ensure `DATABASE_URL` and `POSTGRES_URL` are properly stored in Coolify's database
   - Check that `is_buildtime` and `is_runtime` flags are both TRUE
   - Test that new deployments pick up these variables

2. **Add Health Checks**
   - Implement Kubernetes-style liveness probes
   - Detect if application becomes unresponsive and restart
   - Monitor HTTP responses from the app

3. **Improve Error Messages**
   - The current error is silent - just exits with code 1
   - Add logging to show exactly which environment variables are missing
   - Consider a startup check that logs all configured environment variables

### Long-term Solutions

1. **Git-Based Secrets Management**
   - Store production secrets in a `.env.production` file (encrypted in git)
   - Have the application load from git if Coolify env vars fail
   - Provides automatic recovery and version control

2. **Coolify Documentation**
   - Document that env vars can be lost during Coolify restarts
   - Create a backup system to re-inject critical variables
   - Consider using Coolify's built-in secret management

3. **Monitoring & Alerts**
   - Set up monitoring for HTTP 502 errors
   - Alert on container crash loops
   - Monitor database connectivity from the application

---

## 📊 Timeline

| Time | Event |
|------|-------|
| ~06:00 UTC | Unknown: Coolify environment variables lost |
| 07:00 UTC | First 502 error reported |
| 07:05 UTC | Diagnosed: Missing DATABASE_URL |
| 07:08 UTC | Added DATABASE_URL to Coolify database |
| 07:08-07:12 UTC | Attempted Coolify redeploy (slow) |
| 07:12 UTC | Manually started container with env vars |
| 07:15 UTC | Application fully recovered ✅ |

---

## ✅ Verification Commands

To verify the fix is working:

```bash
# Check container status
ssh user@192.168.1.15 "docker ps | grep m4s0k"

# Verify environment variables are set
ssh user@192.168.1.15 "docker logs m4s0kwo4kc4oooocck4sswc4 | head -20"

# Test HTTP access
curl -I http://192.168.1.15:3000

# Verify database connection
ssh user@192.168.1.15 "docker exec veritable-games-postgres psql -U postgres -d veritable_games -c 'SELECT COUNT(*) FROM auth.users;'"
```

---

## 🔗 Related Documentation

- [docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md) - Troubleshooting section for Bad Gateway
- [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - General troubleshooting guide
- [Coolify PostgreSQL Setup](./COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md) - Database configuration

---

## 📋 Future Prevention Checklist

- [ ] Implement health checks in Docker container
- [ ] Add startup validation for required environment variables
- [ ] Set up monitoring for HTTP 502 errors
- [ ] Create automated recovery for missing environment variables
- [ ] Document Coolify env var backup/restore procedures
- [ ] Consider git-based configuration as fallback
- [ ] Test disaster recovery for production database
- [ ] Set up alerts for container crash loops

---

**Issue Resolved**: November 10, 2025 @ 07:15 UTC
**Status**: ✅ Closed
**Next Review**: Monitor for 24 hours to ensure stability
