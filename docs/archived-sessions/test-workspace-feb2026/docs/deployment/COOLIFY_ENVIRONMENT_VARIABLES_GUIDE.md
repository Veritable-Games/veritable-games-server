# Coolify Environment Variables - Complete Guide

**Last Updated**: February 16, 2026
**Status**: Production-tested

---

## Overview

This guide explains how environment variables work in Coolify, based on real-world experience deploying the Veritable Games donation system.

**Key Principle**: Environment variables are injected **during deployment**, not restart.

---

## How Environment Variables Work in Coolify

### The Deployment Process

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DEPLOYMENT TRIGGERED                                     │
│    (git push, manual deploy, or API call)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. READ DATABASE                                            │
│    SELECT * FROM environment_variables                      │
│    WHERE resourceable_id = <app_id>                         │
│      AND is_preview = false                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. BUILD CONTAINER                                          │
│    - Pull source code                                       │
│    - Inject environment variables                           │
│    - Run build commands                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. START CONTAINER                                          │
│    Container has ALL variables from step 2                  │
└─────────────────────────────────────────────────────────────┘
```

### Container Restart (No Variable Reload)

```
┌─────────────────────────────────────────────────────────────┐
│ CONTAINER RESTART                                           │
│    docker restart <container>                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Container starts with SAME variables from last deployment  │
│ ❌ Database is NOT queried again                            │
│ ❌ New variables are NOT loaded                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

Environment variables are stored in Coolify's PostgreSQL database:

```sql
-- Table: environment_variables
CREATE TABLE environment_variables (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL,              -- Variable name (e.g., STRIPE_SECRET_KEY)
    value TEXT,                             -- Encrypted value
    is_preview BOOLEAN NOT NULL,            -- true = staging, false = production
    is_buildtime BOOLEAN NOT NULL,          -- Available during build?
    is_runtime BOOLEAN NOT NULL,            -- Available in running container?
    is_shared BOOLEAN NOT NULL,             -- Shared across environments?
    resourceable_id INT NOT NULL,           -- Application ID
    resourceable_type VARCHAR(255),         -- 'App\Models\Application'
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Important Flags

| Flag | Description | When to Set |
|------|-------------|-------------|
| `is_preview` | `false` = production, `true` = preview/staging | `false` for production |
| `is_buildtime` | Variable available during build (npm install, etc.) | `true` for most cases |
| `is_runtime` | Variable available in running container | `true` for most cases |
| `is_shared` | Variable shared across all environments | Usually `false` |

---

## Common Scenarios

### Scenario 1: Adding a New Variable

**Steps:**

1. **Add via Coolify UI** (recommended):
   - Navigate to application → Environment Variables
   - Click "Add Variable"
   - Enter key/value
   - Uncheck "Is Preview" if for production
   - Save

2. **Or add via database** (advanced):
   ```sql
   INSERT INTO environment_variables (
       key, value, is_preview, is_buildtime, is_runtime,
       is_shared, resourceable_id, resourceable_type,
       created_at, updated_at
   ) VALUES (
       'MY_NEW_VAR',
       'encrypted_value_here',
       false,  -- production
       true,   -- available at build time
       true,   -- available at runtime
       false,  -- not shared
       1,      -- application ID
       'App\Models\Application',
       NOW(),
       NOW()
   );
   ```

3. **CRITICAL**: Trigger deployment:
   ```bash
   # Option A: Empty commit
   git commit --allow-empty -m "chore: load new environment variable"
   git push origin main

   # Option B: Coolify UI
   # Click "Deploy" button
   ```

4. **Verify**:
   ```bash
   ssh user@server "docker exec <container> env | grep MY_NEW_VAR"
   ```

### Scenario 2: Updating an Existing Variable

**Steps:**

1. **Update via Coolify UI**:
   - Navigate to variable
   - Edit value
   - Save

2. **Or update via database**:
   ```sql
   UPDATE environment_variables
   SET value = 'new_encrypted_value',
       updated_at = NOW()
   WHERE key = 'MY_VAR' AND resourceable_id = 1;
   ```

3. **CRITICAL**: Trigger deployment (container restart won't work)

4. **Verify new value loaded**

### Scenario 3: Variable in Database but Not in Container

**Diagnosis:**
```bash
# Check when variable was added
ssh server "docker exec coolify-db psql -U coolify -d coolify -c \
  \"SELECT key, created_at FROM environment_variables WHERE key='MY_VAR';\""

# Check when container was deployed
ssh server "docker exec coolify-db psql -U coolify -d coolify -c \
  \"SELECT finished_at, commit FROM application_deployment_queues \
   WHERE status='finished' AND application_id='1' \
   ORDER BY finished_at DESC LIMIT 1;\""
```

**If variable.created_at > deployment.finished_at:**
→ Variable was added AFTER deployment
→ Container doesn't have it yet
→ **Solution: Trigger new deployment**

---

## Troubleshooting Guide

### Problem: Variable Not Loading

**Checklist:**

1. ✅ **Check database flags**:
   ```sql
   SELECT key, is_preview, is_buildtime, is_runtime
   FROM environment_variables
   WHERE key = 'MY_VAR' AND resourceable_id = 1;
   ```
   - Ensure `is_preview = false` for production
   - Ensure `is_runtime = true`

2. ✅ **Check deployment timing**:
   ```sql
   -- When was variable added?
   SELECT created_at FROM environment_variables WHERE key='MY_VAR';

   -- When was container last deployed?
   SELECT finished_at FROM application_deployment_queues
   WHERE status='finished' ORDER BY finished_at DESC LIMIT 1;
   ```
   - If variable added AFTER deployment → need new deployment

3. ✅ **Trigger deployment** (not restart):
   ```bash
   git commit --allow-empty -m "chore: reload environment variables"
   git push origin main
   ```

4. ✅ **Verify in container**:
   ```bash
   ssh server "docker exec <container> env | grep MY_VAR"
   ```

### Problem: Deployment Stuck in Queue

**Diagnosis:**
```sql
SELECT id, status, created_at, finished_at
FROM application_deployment_queues
WHERE status IN ('queued', 'in_progress')
ORDER BY created_at DESC;
```

**Solutions:**

1. **Wait 5-10 minutes** (might be processing)

2. **Check Coolify logs**:
   ```bash
   docker logs coolify --tail 100 | grep -i deploy
   ```

3. **Cancel stuck deployment** (if stuck for >10 minutes):
   ```sql
   UPDATE application_deployment_queues
   SET status = 'cancelled-by-user'
   WHERE id = <stuck_id>;
   ```

4. **Trigger new deployment**

### Problem: Wrong Value in Container

**Diagnosis:**
```bash
# Check container value
docker exec <container> env | grep MY_VAR

# Check database value
docker exec coolify-db psql -U coolify -d coolify -c \
  "SELECT key, LEFT(value, 50) as value_preview FROM environment_variables WHERE key='MY_VAR';"
```

**Solution:**
1. Update value in database
2. Trigger new deployment
3. Verify new value loaded

---

## Best Practices

### 1. Document Variable Changes

**Always document when adding/changing production variables:**

```bash
# In commit message
git commit -m "chore: add STRIPE_WEBHOOK_SECRET to production

Added webhook secret for Stripe payment completion events.
Triggered deployment to load new variable.

Variable: STRIPE_WEBHOOK_SECRET
Purpose: Webhook signature verification
Deployment: Triggered via git push"
```

### 2. Verify After Every Change

**Never assume it worked - always verify:**

```bash
# Standard verification script
echo "=== Checking Environment Variables ==="
ssh user@server "docker exec <container> env | grep -E '(VAR1|VAR2|VAR3)' | sort"
echo "=== All expected variables present? ==="
```

### 3. Test in Staging First

**For critical variables:**
1. Add to staging environment first
2. Test functionality
3. Verify variable loads correctly
4. Then add to production

### 4. Use Descriptive Names

**Good variable names:**
```
STRIPE_SECRET_KEY          ✅ Clear purpose
BTCPAY_WEBHOOK_SECRET     ✅ Clear purpose
NEXT_PUBLIC_BASE_URL      ✅ Clear scope (public)
```

**Bad variable names:**
```
SECRET_1                   ❌ What is this?
KEY                        ❌ Too generic
WEBHOOK                    ❌ Which service?
```

### 5. Group Related Variables

**In database documentation, group by feature:**

```bash
# ===== DONATION SYSTEM =====
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
BTCPAY_SERVER_URL=...
BTCPAY_WEBHOOK_SECRET=...

# ===== DATABASE =====
POSTGRES_URL=...
DATABASE_MODE=...

# ===== WEBSOCKET =====
WS_URL=...
WS_PORT=...
```

---

## Quick Reference

### Essential Commands

```bash
# List all variables for application
ssh server "docker exec coolify-db psql -U coolify -d coolify -c \
  \"SELECT key, is_preview FROM environment_variables \
   WHERE resourceable_id=1 ORDER BY key;\""

# Check if variable is in container
ssh server "docker exec <container> env | grep VARNAME"

# Get recent deployments
ssh server "docker exec coolify-db psql -U coolify -d coolify -c \
  \"SELECT id, status, finished_at FROM application_deployment_queues \
   WHERE application_id='1' ORDER BY finished_at DESC LIMIT 5;\""

# Trigger deployment
git commit --allow-empty -m "chore: reload environment variables"
git push origin main

# Monitor deployment
watch -n 5 "ssh server 'docker exec coolify-db psql -U coolify -d coolify -t -c \
  \"SELECT status FROM application_deployment_queues WHERE id=<deployment_id>\"'"
```

---

## Real-World Example: Donation System

**Context**: Adding STRIPE_WEBHOOK_SECRET to production

**Timeline:**
```
02:47 UTC - Deployment 883 completed (6 variables)
03:35 UTC - Added STRIPE_WEBHOOK_SECRET to database
03:44 UTC - Container restarted (variable NOT loaded)
03:51 UTC - Triggered new deployment
04:01 UTC - Deployment 886 completed (7 variables) ✅
```

**Lesson**: Variable was added AFTER deployment 883, so container didn't have it. Container restart at 03:44 didn't help because restarts don't reload variables. Only after deployment 886 did the variable appear.

**Full incident report**: [docs/incidents/2026-02-16-stripe-webhook-secret-not-loading.md](../incidents/2026-02-16-stripe-webhook-secret-not-loading.md)

---

## Coolify API Reference

### Get Application Variables

```bash
curl -X GET "http://coolify-server:8000/api/v1/applications/<uuid>/envs" \
  -H "Authorization: Bearer <api_token>"
```

### Trigger Deployment

```bash
curl -X POST "http://coolify-server:8000/api/v1/deploy?uuid=<app_uuid>&force=true" \
  -H "Authorization: Bearer <api_token>"
```

**Note**: API permissions must include deployment rights.

---

## Related Documentation

- **Environment Variables Example**: [frontend/.env.example](../../frontend/.env.example)
- **Deployment Guide**: [docs/deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md](./DEPLOYMENT_DOCUMENTATION_INDEX.md)
- **Incident Report**: [docs/incidents/2026-02-16-stripe-webhook-secret-not-loading.md](../incidents/2026-02-16-stripe-webhook-secret-not-loading.md)
- **CLAUDE.md Production Access**: [CLAUDE.md](../../CLAUDE.md)

---

## Summary

**Key Takeaways:**

1. ✅ Environment variables load during **deployment**, not restart
2. ✅ Always trigger deployment after adding/changing variables
3. ✅ Verify variables loaded: `docker exec <container> env | grep VAR`
4. ✅ Check deployment timing if variable missing
5. ✅ Use `is_preview=false` for production variables

**Remember**: Restarting a container is like rebooting your computer - it starts with the same configuration it had before. Deployment is like reinstalling - it reads the latest configuration from scratch.

---

**Last Updated**: February 16, 2026
**Maintainer**: Claude Code
**Tested On**: Coolify v4.x with Docker deployment
