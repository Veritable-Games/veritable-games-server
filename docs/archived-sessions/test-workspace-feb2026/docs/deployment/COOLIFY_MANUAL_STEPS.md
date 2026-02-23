# Coolify Manual Steps - Required User Actions

**Last Updated**: November 4, 2025
**Coolify Dashboard**: http://192.168.1.15:8000

This document lists all the steps that require manual action in the Coolify web interface. Claude Code cannot access the Coolify UI, so these steps must be performed by you.

---

## CRITICAL: Immediate Actions Required

### 1. Deploy Latest Code (URGENT)

**Current State**:
- Deployed commit: `3f92ea3` (Oct 30-31)
- Latest commit: `3691ac0` (Nov 4) ← **Contains critical nixpacks.toml fix**
- Missing: 3 commits not deployed

**Steps**:
1. Open http://192.168.1.15:8000
2. Navigate to your application
3. Click **"Deployments"** tab
4. Click **"Redeploy"** or **"Deploy"** button
5. **Select commit**: `3691ac0` (latest)
6. **Monitor build logs** for any errors
7. **Wait** ~3 minutes for build to complete

**Expected Result**: Application shows "healthy" status

**What to Watch For**:
- Build should show: "Installing python3, build-essential" (from nixpacks.toml)
- `npm install` should complete successfully
- Application should start without errors

---

### 2. Configure Environment Variables (CRITICAL)

**Why**: Application needs database connection and security secrets

**Steps**:
1. Coolify Dashboard → Your Application → **"Environment Variables"** tab
2. **Add these variables**:

```bash
# Database Configuration (Local PostgreSQL)
DATABASE_MODE=postgres
DATABASE_URL=postgresql://postgres:postgres@192.168.1.15:5432/veritable_games
POSTGRES_URL=postgresql://postgres:postgres@192.168.1.15:5432/veritable_games
POSTGRES_SSL=false
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=2

# Security Secrets (from .env.local)
SESSION_SECRET=13d2068c4d165e847c7f97df5fccf8bff3b1df90a6d5100f8f1336c1f839852d
CSRF_SECRET=cdaeb482c83e6e06dc87bc63faaa23804a669632b46fb1a7d06db9b4b02c748d
ENCRYPTION_KEY=5f173a2a225d7d87224cdbd5a2b4f8cc28929913cd5b2baaf70b15b1ac155278

# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=http://192.168.1.15:3000
```

3. **Save** environment variables
4. **Redeploy** application to apply changes

**⚠️ Important Notes**:
- Use IP `192.168.1.15` not `localhost` (Docker networking)
- PostgreSQL port `5432` must be accessible from Coolify containers
- **Never commit these secrets** to git (they're in .gitignore)

---

### 3. Fix Auto-Deploy Webhook

**Why**: GitHub App not triggering automatic deployments

**Diagnosis Steps**:

1. **Check GitHub Webhook Deliveries**:
   - Go to: https://github.com/Veritable-Games/veritable-games-site/settings/hooks
   - Find: Coolify webhook (created by GitHub App)
   - Click on it
   - Go to **"Recent Deliveries"** tab
   - Look for recent push events (last 3 commits)

**Possible Issues & Fixes**:

**Issue A: Webhook Deliveries Failing (4xx/5xx errors)**

Fix:
1. Coolify Dashboard → Settings → **"Sources"**
2. Find GitHub App connection
3. Click **"Reconnect"** or **"Refresh"**
4. Re-authorize if prompted

**Issue B: Webhook Deliveries Successful but No Deployment**

Fix:
1. Coolify Dashboard → Application → Settings
2. Verify **"Auto Deploy"** is **enabled** ✅
3. Check **"Branch"** is set to `main`
4. Verify no path filters excluding your commits

**Issue C: No Webhook Found in GitHub**

Fix:
1. Coolify Dashboard → Settings → Sources
2. **Remove** GitHub App connection
3. **Re-add** GitHub App:
   - Click "Add New Source"
   - Select "GitHub"
   - Choose "Install GitHub App"
   - Authorize for `veritable-games-main` repository
4. Coolify will recreate webhook automatically

**Test Auto-Deploy**:
1. Make a small change (e.g., README.md)
2. Commit and push
3. Watch Coolify dashboard for automatic deployment
4. Should trigger within 1-2 minutes

---

## Database Configuration

### Option Chosen: Local PostgreSQL (Option B)

**What's Set Up**:
- ✅ PostgreSQL container running on server
- ✅ 50,646 rows migrated
- ✅ Restart policy: `unless-stopped`
- ✅ Accessible at: `192.168.1.15:5432`

**Coolify Network Configuration**:

Coolify containers run in isolated Docker networks. To connect to PostgreSQL on the host:

**Option 1: Use Host Network (Simplest)**

In Coolify Dashboard → Application → Settings → Network:
- Change network mode to `host`
- Or use host IP: `192.168.1.15:5432` in DATABASE_URL

**Option 2: Create Docker Network Bridge**

```bash
# On server:
docker network connect veritable-games-network <coolify-app-container-name>
```

Then use:
```
DATABASE_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
```

**Verify Connection**:
After deployment, check logs for:
```
✅ Connected to PostgreSQL
✅ Database: veritable_games
```

---

## Monitoring & Health Checks

### Application Health Endpoint

**Test After Deployment**:
```bash
curl http://192.168.1.15:3000/api/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-04T...",
  "database": {
    "status": "connected",
    "type": "postgres",
    "version": "PostgreSQL 15.14"
  },
  "uptime": "...",
  "memory": {...}
}
```

**If Unhealthy**:
1. Check Coolify → Application → Logs
2. Look for database connection errors
3. Verify environment variables set correctly
4. Check PostgreSQL container running: `docker ps | grep postgres`

---

## Build Logs Analysis

### Common Build Errors

**Error: "node-gyp" or "python not found"**

Cause: nixpacks.toml missing or not applied

Fix:
- Verify commit `3691ac0` is deployed (has nixpacks.toml)
- Redeploy from latest commit

**Error: "better-sqlite3 compilation failed"**

Cause: Build dependencies missing

Fix:
- Check build logs show: "Installing python3, build-essential"
- If not shown, nixpacks.toml not being read
- Verify file exists at repository root

**Error: "Database connection failed"**

Cause: Environment variables not set or PostgreSQL not accessible

Fix:
- Check DATABASE_URL in environment variables
- Verify PostgreSQL container running
- Test connection from Coolify container

---

## Rollback Procedure

### If New Deployment Breaks

**Quick Rollback**:
1. Coolify Dashboard → Application → Deployments
2. Find previous working deployment (commit `3f92ea3`)
3. Click **"Redeploy"** on that specific deployment
4. Monitor logs

**Or Manually Select Commit**:
1. Click **"Deploy"**
2. Select commit: `3f92ea3`
3. Deploy

**After Rollback**:
- Application will be on old version (without PostgreSQL support)
- May need to switch DATABASE_MODE back to sqlite temporarily
- Fix issues, then redeploy latest

---

## Restart Policies in Coolify

### Application Container

**Check Current Policy**:
1. Coolify Dashboard → Application → Settings
2. Look for **"Restart Policy"** setting
3. Should be: `unless-stopped` or `always`

**Change if Needed**:
1. Set to: `unless-stopped` (recommended)
2. Save settings
3. Redeploy if needed

This ensures application auto-starts after server reboots.

---

## Build Time Optimization

**Current**: ~3 minutes (from push to live)

**If Builds Are Slow**:
1. Coolify → Application → Settings
2. Check **"Build Pack"**: Should be Nixpacks
3. Verify **"Base Directory"**: Should be `frontend`
4. Check cache is enabled

**Build Cache**:
- Coolify caches `node_modules` between builds
- First build slower (~3-5 min)
- Subsequent builds faster (~2-3 min)

---

## Security Settings

### HTTPS/SSL (Future Improvement)

Currently running on HTTP. To add HTTPS:

1. **Domain Name**: Get a domain pointing to server IP
2. **Coolify SSL**: Dashboard → Application → Domains
3. **Add Domain**: your-domain.com
4. **Enable SSL**: Coolify auto-generates Let's Encrypt certificate

**Local Network Only**: HTTPS not required for 192.168.1.x network

---

## Backup Configuration in Coolify

### Application Backups

**Not Required**: Application is stateless (all data in database)

### Database Backups

**External to Coolify**: Use automated backup script

See: `/opt/veritable-games-backup.sh` (created by Claude Code)

Run via cron:
```bash
0 2 * * * /opt/veritable-games-backup.sh
```

---

## Checklist: Post-Deployment Verification

After completing manual steps above, verify:

- [ ] Latest commit (3691ac0) deployed successfully
- [ ] Application status shows "healthy" in Coolify
- [ ] Environment variables all set correctly
- [ ] Can access: http://192.168.1.15:3000
- [ ] Health endpoint works: `/api/health` returns 200
- [ ] Database connection working (check health response)
- [ ] Can log in with test account
- [ ] Auto-deploy tested (make small change, push, verify deploys)
- [ ] Restart policy set to `unless-stopped`

---

## What Claude Code Already Did

✅ **Local Changes** (committed to git):
- Added restart policies to docker-compose.yml
- Created SERVER_RECOVERY_GUIDE.md
- Created this COOLIFY_MANUAL_STEPS.md
- Created backup script template
- Updated PostgreSQL container restart policy

❌ **Cannot Do** (requires Coolify UI):
- Trigger deployments
- Configure environment variables
- Check build logs
- Verify webhook status
- Change application settings

---

## Next Steps After Manual Configuration

1. **Test Power Cycle** (when convenient):
   ```bash
   sudo reboot
   ```
   Wait 3-4 minutes, verify everything auto-starts

2. **Set Up Automated Backups**:
   - Copy backup script to `/opt/`
   - Add to crontab
   - Test backup/restore

3. **Monitor for 24 Hours**:
   - Check application stays healthy
   - Verify auto-deploy works
   - Test core features

---

**Time Required**: 30-60 minutes
**Priority**: Complete today to fix unhealthy application state
