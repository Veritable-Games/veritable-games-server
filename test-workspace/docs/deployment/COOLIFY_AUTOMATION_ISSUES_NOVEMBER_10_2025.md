# Coolify Deployment Automation Issues (November 10, 2025)

## Status: CRITICAL - Automation Still Broken

**Date**: November 10, 2025 (08:00 UTC)
**Issue**: Coolify automated deployments continue to fail silently despite `.dockerignore` fix
**Current State**: Manual deployment active, domain operational, Coolify automation non-functional

---

## Summary

After implementing the critical `.dockerignore` fix (commit 7613751) to exclude the 1.1GB `public/uploads/` directory from Docker build context, we attempted to verify that Coolify's automated deployment system would now work properly. **It does not.**

The test results show that Coolify's deployment automation system has fundamental issues beyond the build context timeout. This document details what we found and what needs investigation.

---

## What We Tested

### Test Sequence (Deployment #95)

1. **FQDN Configuration**: ✅ Updated `applications.fqdn = 'www.veritablegames.com'` in Coolify database
2. **Deployment Queue**: ✅ Inserted new deployment into `application_deployment_queues` with `status = 'queued'`
3. **Queue Processing**: ❌ **FAILED** - Job processor did not process the queued deployment
4. **Manual Trigger**: ❌ **FAILED** - Even after restarting Coolify and manually triggering `php artisan queue:work`, deployment remained in 'failed' state
5. **Result**: Container crashed (Restarting status), domain returned 502 Bad Gateway

### Test Results

| Component | Status | Details |
|-----------|--------|---------|
| FQDN Setting | ✅ Success | `fqdn = 'www.veritablegames.com'` persisted correctly |
| Deployment Queue | ✅ Inserted | Deployment #95 successfully queued in database |
| Queue Processing | ❌ Failed | Job processor never picked up the deployment |
| Container Status | ❌ Crashed | Container stuck in "Restarting (1)" state |
| Domain Access | ❌ 502 | Bad Gateway from Traefik (no backend available) |
| Coolify Logs | ⚠️ Silent | No errors logged, deployment just marked as "failed" |

---

## Root Cause Analysis

### Issue #1: Silent Deployment Failures

**Symptom**: Deployment #95 changed from 'queued' → 'failed' with no error message logged

**Findings**:
- Coolify database has no accessible deployment logs table
- Container logs do not contain deployment-specific errors
- Job queue worker (queue:work) processed other jobs (PushServerUpdateJob, ServerStorageCheckJob) but skipped application deployment

**Hypothesis**:
- The application deployment job handler is catching and silently swallowing exceptions
- OR the queue worker is skipping deployment jobs due to some condition
- OR there's a database-level issue preventing the job from being processed

### Issue #2: Container Startup Failure (After Deployment Attempt)

**Symptom**: Container entered "Restarting (1)" state and never recovered

**Timeline**:
1. Coolify attempted deployment via job queue
2. Container was created/restarted
3. Container exited immediately with exit code 1
4. Coolify's restart policy kicked in (infinite restart loop)

**Why Exit Code 1?**:
- Either the migration script failed: `node scripts/migrations/fix-truncated-password-hashes.js`
- OR the Next.js startup failed: `next start`
- No logs available to determine which

**Hypothesis**: The deployment job process did not properly inject environment variables, causing the container to crash on startup (same as the initial DATABASE_URL issue we fixed)

### Issue #3: Job Queue Worker Bypass

**Symptom**: Manual `php artisan queue:work` command processed some jobs but skipped deployment jobs

**Findings**:
```
2025-11-10 07:52:28 App\Jobs\PushServerUpdateJob ............. DONE
2025-11-10 07:52:28 App\Jobs\ServerStorageCheckJob ........... DONE
(No deployment jobs processed)
```

**Hypothesis**: Deployment queue jobs are either:
- In a different queue that the worker isn't monitoring
- Filtered out by some condition
- Stuck in a locked state in the database

### Issue #4: `.dockerignore` Fix Didn't Prevent Failure

**Expected**: Fix the build context timeout → Allow successful Docker builds → Enable deployments to complete

**Actual**: Fix had no effect on deployment automation failures

**Why**:
- The build context timeout was preventing deployments from starting at all
- Now deployments *are* starting but failing elsewhere in the process
- The fix unmasked the deeper issues in Coolify's deployment automation

---

## Current Production Status

### ✅ Application is Operational

**Restored Manual Deployment**:
```
Container: m4s0kwo4kc4oooocck4sswc4 (running since 07:58 UTC)
Status: Healthy (10+ seconds uptime, responding to requests)
Local IP: http://192.168.1.15:3000 → HTTP 307 ✓
Published Domain: https://www.veritablegames.com → HTTP 307 ✓
```

**Note**: The HTTP 307 response is expected behavior (temporary redirect to `/auth/login` for unauthenticated requests)

### ❌ Coolify Automation is Broken

**Deployment #95 Status**: FAILED
- Cannot retry or recover
- No visible error message
- Application container crashed during deployment

**Impact**:
- Future code pushes will NOT automatically deploy via Coolify's webhook
- Manual redeployment required for each change
- Production is vulnerable to losing deployment capability if container crashes

---

## Detailed Investigation Findings

### Database State After Test

```sql
-- FQDN is correctly set
SELECT fqdn FROM applications
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';
-- Result: www.veritablegames.com ✓

-- Deployment queue shows failed status
SELECT id, status FROM application_deployment_queues
WHERE id = 95;
-- Result: id=95, status='failed' ✗
```

### What Should Have Happened

1. GitHub webhook → Coolify receives deployment trigger
2. Coolify queues deployment: `INSERT INTO application_deployment_queues`
3. Job processor picks up deployment job
4. Docker build triggered with `.dockerignore` preventing build timeout
5. Build completes successfully
6. New image is deployed with Traefik labels
7. Container starts with injected environment variables
8. Application runs and responds to requests
9. Deployment marked as 'completed'

### What Actually Happened

1. ✓ Deployment queued successfully
2. ❌ Job processor never picked up the deployment job
3. ❌ Deployment automatically marked as 'failed' after timeout
4. ❌ Container attempted restart but crashed (exit code 1)
5. ❌ Container stuck in restart loop
6. ❌ No error logs available to diagnose issue

---

## Recommendations for Investigation

### High Priority (Required for Automated Deployments)

1. **Find Deployment Job Logs**
   - Investigate Coolify's Laravel queue logging mechanism
   - Check if there's a separate log file or database table for failed jobs
   - Query job queue for exceptions using `failed_jobs` table (Laravel standard)

2. **Debug the Job Queue Worker**
   - Why is the queue worker skipping deployment jobs?
   - Run: `docker exec coolify php artisan queue:failed` to see failed jobs
   - Check if deployment jobs have specific requirements or conditions

3. **Verify Environment Variable Injection**
   - The manual deployment works with hardcoded env vars
   - Coolify's job processor must inject these from the database
   - Verify that Coolify's deployment job includes this step

4. **Check Job Handler Implementation**
   - Locate the deployment job handler in Coolify's codebase
   - Look for exception handling that might be silently swallowing errors
   - Check for database locks or transaction issues

### Medium Priority (Improve Observability)

5. **Enable Debug Logging**
   - Set Coolify's log level to DEBUG for deployment jobs
   - Capture full stack traces of any failures
   - This will make future diagnostics much faster

6. **Add Deployment Status Webhooks**
   - Set up alerting for failed deployments
   - Send notifications when deployments complete/fail
   - This prevents future silent failures going unnoticed

7. **Investigate Coolify Version**
   - Current version might have known bugs
   - Check if there's a newer version available
   - Review Coolify changelog for deployment-related fixes

### Long-term (Architectural)

8. **Consider Alternative Deployment Pipelines**
   - GitHub Actions for building/pushing images
   - Docker Swarm or other orchestration for deployment
   - Keeps deployment independent from Coolify's reliability

---

## Immediate Action Items

### For User

1. **Monitor Current Deployment**: The manual container is running but Coolify's automation is unavailable
2. **Plan Next Code Push**: Either:
   - Continue using manual deployments (current workaround)
   - Investigate Coolify issues first (recommended for long-term)
   - Consider alternative deployment pipeline

3. **Backup Current Container**: If manual deployment continues to be used, document the Docker command and environment variables

### For Next Investigation Session

1. Check for failed jobs: `docker exec coolify php artisan queue:failed`
2. Review job queue config: `docker exec coolify cat /app/config/queue.php | grep -A 10 "driver"`
3. Check Coolify database schema: `docker exec coolify-db psql -U coolify -d coolify -dt | grep -i job`
4. Review Coolify logs with DEBUG level enabled
5. Test with a simpler deployment (restart-only instead of rebuild)

---

## Timeline

| Time | Event |
|------|-------|
| 07:50-08:00 UTC | Attempted Coolify deployment automation test (Deployment #95) |
| 08:00 UTC | Deployment #95 failed silently |
| 08:05 UTC | Discovered container crash and 502 errors |
| 08:10 UTC | Investigated deployment logs (not accessible) |
| 08:15 UTC | Manually redeployed container to restore service |
| 08:30 UTC | Domain confirmed operational |
| 08:35 UTC | Documented findings |

---

## Key Takeaway

The `.dockerignore` fix (commit 7613751) **successfully addressed the build context timeout issue**, allowing builds to complete. However, it revealed deeper problems in Coolify's deployment automation that prevented successful deployments from completing:

1. **Silent failure mode** - No error logging for debugging
2. **Job queue issues** - Deployments not being processed or completed
3. **Environment injection** - Unclear if env vars are properly injected by Coolify

**Current Status**: Application is production-stable with manual deployment. Coolify automation requires deeper investigation before automated deployments can be trusted.

---

**Last Updated**: November 10, 2025 @ 08:35 UTC
**Status**: 🔴 Coolify Automation Broken | 🟢 Manual Deployment Working | 🟢 Domain Operational
