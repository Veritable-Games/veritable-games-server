# Phase 2: Permanent Fix Implementation Plan

**Date**: November 10, 2025
**Status**: Ready for Implementation
**Solution**: Solution A - Migrate PostgreSQL to Coolify Management
**Estimated Timeline**: 2-3 hours
**Risk Level**: Low (with proper backup)

---

## Executive Summary

The current deployment is experiencing recurring failures because:
- **Application container** is deployed on Coolify's network
- **PostgreSQL database** is manually maintained on a separate network
- **Network isolation** prevents DNS resolution → container crashes after each redeploy
- **Temporary fix** (reconnecting networks) only lasts 24-48 hours until next redeploy

**Solution A** moves PostgreSQL under Coolify's management, ensuring:
- ✅ Both services on same network automatically
- ✅ Automatic DNS resolution
- ✅ GUI-managed backups with S3 integration
- ✅ Survives redeployments indefinitely
- ✅ Professional managed database lifecycle

---

## Current State Analysis

### What Works Right Now (With Temporary Fix)

```
✓ Application container: m4s0kwo4kc4oooocck4sswc4 (HTTP 307)
✓ PostgreSQL: veritable-games-postgres (running, healthy)
✓ Both connected to veritable-games-network
✓ Service accessible via:
  - Local IP: http://192.168.1.15:3000
  - Domain: https://www.veritablegames.com
```

### Why It Will Break Again

- **Manual network connection** is not persistent
- **Coolify redeploy** recreates container from scratch
- **New container** loses network connection
- **Can't reach database** → crashes
- **Service down** until manual fix applied

### Solution Timeline

This temporary fix buys us **24-48 hours** before the next automatic redeploy or manual trigger breaks it again.

---

## Phase 2: Implementation Plan (30 Minutes Planning)

### Step 1: Review Current Database Configuration

```bash
# Current manual PostgreSQL setup
Host: 192.168.1.15
Port: 5432
User: postgres (or custom)
Password: [secure]
Database: veritable_games
Container: veritable-games-postgres
Network: veritable-games-network (manual)
Backups: Manual (if any)
```

### Step 2: Prepare for Migration

**Pre-Migration Checklist**:
- [ ] Read this entire plan
- [ ] Read COOLIFY_IMPLEMENTATION_GUIDE.md "Database Management in Coolify" section
- [ ] Have SSH access to 192.168.1.15
- [ ] Have Coolify UI access
- [ ] Have current PostgreSQL backup
- [ ] Have connection string info readily available

**Backup Current Database**:
```bash
# Full backup of current database
pg_dump -U postgres -h 192.168.1.15 veritable_games > /tmp/veritable_games_backup.sql

# Verify backup
ls -lh /tmp/veritable_games_backup.sql
wc -l /tmp/veritable_games_backup.sql
```

---

## Phase 3: Implementation Steps (1-2 Hours)

### BEFORE YOU START

⚠️ **Important**: Create backup of current PostgreSQL before proceeding

```bash
# From production server
ssh user@192.168.1.15
docker exec veritable-games-postgres pg_dump -U postgres veritable_games > /tmp/veritable_games_backup.sql
ls -lh /tmp/veritable_games_backup.sql
```

### Implementation Sequence

#### Step 1: Create New PostgreSQL Database in Coolify

**Via Coolify UI** (http://192.168.1.15:8000):

1. Navigate to: **Resources → Databases → PostgreSQL**
2. Click: **"Create a new PostgreSQL database"**
3. Configuration:
   ```
   Name: veritable-games-new  (or similar)
   Password: [Generate strong password]
   Image: postgres:15-alpine (same version as current)
   Port: 5432 (internal)
   Root Password: [Generate strong password]
   ```
4. Click: **"Create"**
5. Wait: ~2 minutes for database to start
6. Verify: Status should show "Running" and green health check

**Save these details**:
- Database Name: `veritable_games`
- Root Password: `[saved]`
- Connection String: Will be provided in Coolify UI

#### Step 2: Get Coolify Database Connection String

**Via Coolify UI**:

1. Go to: **Resources → Databases → [veritable-games-new]**
2. Look for: **"Connection String"** section
3. Copy the connection string:
   ```
   postgresql://postgres:PASSWORD@veritable-games-new:5432/veritable_games
   ```

**Important Notes**:
- `veritable-games-new` is the DNS name within Coolify's network
- This will resolve automatically within containers on same network
- No need for IP address - Docker DNS handles it

#### Step 3: Migrate Data to New Database

**Migration Strategy**:

Option A (Recommended - Pg_dump + Restore):
```bash
# On production server
ssh user@192.168.1.15

# Dump old database
docker exec veritable-games-postgres pg_dump -U postgres veritable_games > /tmp/dump.sql

# Create database in new PostgreSQL
docker exec [NEW_POSTGRES_CONTAINER] createdb -U postgres veritable_games

# Restore to new database
docker exec [NEW_POSTGRES_CONTAINER] psql -U postgres veritable_games < /tmp/dump.sql

# Verify data
docker exec [NEW_POSTGRES_CONTAINER] psql -U postgres -d veritable_games -c "SELECT COUNT(*) FROM users.users;"
```

Option B (pg_restore - If using custom format):
```bash
# Pg_restore for backup/restore with custom format
# (Use if original backup used -Fc flag)
```

#### Step 4: Update Application Environment Variables

**In Coolify UI**:

1. Go to: **Applications → [Your App] → Settings → Environment Variables**
2. **BEFORE**: `DATABASE_URL=postgresql://postgres:pass@192.168.1.15:5432/veritable_games`
3. **AFTER**: `DATABASE_URL=postgresql://postgres:NEWPASS@veritable-games-new:5432/veritable_games`
4. Save changes
5. Note: **Do NOT redeploy yet** (we need to verify first)

**Critical Change**:
- Old: Uses IP address `192.168.1.15` (external)
- New: Uses Docker DNS name `veritable-games-new` (internal Coolify network)

#### Step 5: Enable "Connect to Predefined Network"

**In Coolify UI**:

1. Go to: **Applications → [Your App] → Settings → Networking**
2. Find: **"Connect to Predefined Network"** option
3. Enable: ✓ Check this box
4. Select: **coolify** network (default)
5. Save changes

**What This Does**:
- Ensures app and database are on same network
- Automatic during container creation
- Survives redeployments

#### Step 6: Test New Database Connection (Before Redeply)

**Test the connection string**:

```bash
# Test connection to new database
docker exec [APP_CONTAINER] psql \
  "postgresql://postgres:NEWPASS@veritable-games-new:5432/veritable_games" \
  -c "SELECT version();"
```

**Expected Output**:
```
PostgreSQL 15.x on ...
```

**If connection fails**:
- Check password is correct
- Verify database name
- Check container is on same network
- Review Coolify logs

#### Step 7: Redeploy Application

**In Coolify UI**:

1. Go to: **Applications → [Your App]**
2. Click: **"Redeploy"** button
3. Watch: Deployment logs
4. Wait: ~3 minutes for build and deployment

**Expected Sequence**:
```
1. Building Docker image
2. Pulling dependencies
3. Running migrations (if any)
4. Starting application
5. Health check passing
6. Service ready
```

**During Redeploy**:
- New container created on coolify network
- Database connection string used from environment
- Container automatically connects to database
- No manual network connection needed

#### Step 8: Verify Application Works

**Test Points**:

```bash
# Test 1: Local IP access
curl -I http://192.168.1.15:3000
# Expected: HTTP 307 (redirect) or 200 OK

# Test 2: Domain access
curl -I https://www.veritablegames.com
# Expected: HTTP 307 (redirect) or 200 OK

# Test 3: Application functionality
# Open browser: http://192.168.1.15:3000
# - Check if pages load
# - Check if database queries work
# - Try creating a test account

# Test 4: Check logs for errors
ssh user@192.168.1.15
docker logs [APP_CONTAINER] --tail 50 | grep -i "error\|connection"
```

---

## Phase 4: Verify Permanent Fix (30 Minutes)

### The Real Test: Redeploy Again

**Trigger another redeploy** to verify the fix persists:

```bash
# Option 1: Via Coolify UI - Click Redeploy button
# Option 2: Via Git - Make a small commit and push
git add docs/PHASE_2_PERMANENT_FIX_PLAN.md
git commit -m "chore: Update deployment documentation"
git push origin main
```

**After Second Redeploy**:
- [ ] Service comes back up automatically
- [ ] No manual network reconnection needed
- [ ] Application accessible via IP
- [ ] Application accessible via domain
- [ ] Database connectivity working
- [ ] Can create test account
- [ ] Can access application data

**Success Criteria**:
- ✅ Service up within 3-5 minutes of redeploy
- ✅ No network connection errors in logs
- ✅ Both local IP and domain working
- ✅ Database queries responding
- ✅ Health checks passing

**Failure Scenarios & Fixes**:

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 502 Bad Gateway | Traefik misconfigured | Verify FQDN in Coolify settings |
| Can't connect to database | Wrong network | Enable "Connect to Predefined Network" |
| Connection refused | Database not reachable | Verify connection string has correct container name |
| Wrong password | Env variable not updated | Update DATABASE_URL in Coolify UI |

---

## Post-Implementation: Configure Backups

### Automatic Backups in Coolify

**In Coolify UI**:

1. Go to: **Resources → Databases → [veritable-games-new]**
2. Find: **"Backups"** section
3. Enable: **Automatic backups**
4. Schedule: Daily at 2:00 AM (UTC)
5. Retention: 30 days
6. S3 Integration: (Optional) Configure for off-site storage

**Manual Backup Command**:
```bash
# For reference/emergency use
pg_dump postgresql://postgres:PASS@veritable-games-new:5432/veritable_games > backup.sql
```

---

## Troubleshooting Guide

### Issue: Connection Refused to New Database

**Symptoms**:
- Can't connect to new database
- Error: "connection refused" or "no such host"

**Solutions**:
1. Verify database is running in Coolify UI
2. Check connection string has correct database name
3. Verify container is on same network as database
4. Check password is correct

**Debug Commands**:
```bash
# Check if database is reachable
docker exec [APP_CONTAINER] ping veritable-games-new
docker exec [APP_CONTAINER] nc -zv veritable-games-new 5432

# Check environment variable
docker exec [APP_CONTAINER] env | grep DATABASE_URL
```

### Issue: Data Not Migrated

**Symptoms**:
- Application says "tables not found"
- Database is empty

**Solutions**:
1. Verify dump completed successfully
2. Check restore command ran without errors
3. Verify row count in new database

**Verification**:
```bash
# Count tables in new database
docker exec [NEW_POSTGRES] psql -U postgres -d veritable_games -c "\dt+" | wc -l

# Compare with old database
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "\dt+" | wc -l
```

### Issue: Application Crashes After Redeploy

**Symptoms**:
- Container crashes immediately after redeploy
- Error logs show "getaddrinfo EAI_AGAIN"

**Solutions**:
1. Verify "Connect to Predefined Network" is enabled
2. Check DATABASE_URL environment variable is correct
3. Verify new database container is running

**Logs**:
```bash
docker logs [APP_CONTAINER] --tail 100
```

---

## Rollback Plan (If Needed)

**If the migration fails**, you can quickly rollback:

```bash
# 1. Update environment variable back to old database
# In Coolify UI: Set DATABASE_URL back to old PostgreSQL

# 2. Redeploy application
# Application will reconnect to old database

# 3. Keep new database running (in case of issues)
# Don't delete it until you're confident the new setup works

# 4. After 48 hours of stability, delete old database
```

**No data loss** - old database remains intact during this entire process.

---

## Success Checklist

### Before Starting Phase 3

- [ ] Read entire plan
- [ ] Have backup of current database
- [ ] Have SSH access to server
- [ ] Have Coolify UI access
- [ ] Understanding of connection strings

### After Step 1 (New Database Created)

- [ ] New PostgreSQL database created in Coolify
- [ ] Database is running (green health check)
- [ ] Connection string saved

### After Step 3 (Data Migrated)

- [ ] Data dump successful (> 0 bytes)
- [ ] Data restore successful (no errors)
- [ ] Row counts match between old and new DB

### After Step 4 (Environment Updated)

- [ ] DATABASE_URL updated in Coolify
- [ ] Uses container name, not IP address
- [ ] Password is correct

### After Step 5 (Network Configured)

- [ ] "Connect to Predefined Network" enabled
- [ ] Application will be on same network as database

### After Step 7 (Redeployed)

- [ ] Redeploy completed successfully
- [ ] Logs show "Ready in X ms"
- [ ] No connection errors in logs

### After Step 8 (Verified Working)

- [ ] Local IP responding (307 or 200)
- [ ] Domain responding (307 or 200)
- [ ] Database queries working
- [ ] Can create test account

### After Phase 4 (Permanent)

- [ ] Second redeploy completed
- [ ] Service back up automatically
- [ ] No manual fixes needed
- [ ] All tests pass again

---

## Timeline Summary

| Phase | Activity | Time |
|-------|----------|------|
| **Phase 2** | Review plan, prepare | 30 min |
| **Phase 3, Steps 1-3** | Create new DB, migrate data | 45 min |
| **Phase 3, Steps 4-8** | Update config, redeploy, verify | 45 min |
| **Phase 4** | Test resilience (redeploy again) | 30 min |
| **Total** | | **2.5 hours** |

---

## Important Notes

### Critical Points

1. **Backup First**: Always backup before migrating databases
2. **Test Connection**: Verify new database works before full redeploy
3. **Verify Persistence**: Second redeploy proves it's permanent
4. **Keep Old DB**: Don't delete old database until you're sure new one works (48+ hours)

### Why This Solution Works

- **Same Network**: Both app and DB on Coolify's network → automatic DNS
- **Persistent**: Coolify manages the database lifecycle → survives redeploys
- **Professional**: Automatic backups, monitoring, and recovery
- **Future-Proof**: Can scale, add replicas, or upgrade without downtime

### After This Is Done

- No more temporary fixes
- Service stays up indefinitely
- Redeployments are safe
- Professional-grade infrastructure

---

## Next Steps

1. **Review** this entire plan
2. **Understand** each step before executing
3. **Backup** current database
4. **Execute** Phase 3 steps in order
5. **Verify** Phase 4 resilience
6. **Monitor** for 48 hours to ensure stability
7. **Delete** old database (only after confirmed stable)

---

**Status**: Ready to begin Phase 3 implementation

**Questions?**: Refer back to COOLIFY_IMPLEMENTATION_GUIDE.md or DEPLOYMENT_ISSUES_EXECUTIVE_SUMMARY.md
