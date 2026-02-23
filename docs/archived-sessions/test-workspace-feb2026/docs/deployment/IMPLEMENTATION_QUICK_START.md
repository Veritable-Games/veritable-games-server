# Implementation Quick Start - Option D Selected

**Status**: Architecture decided, ready for implementation
**Date**: November 10, 2025
**Your Choice**: Option D (Hybrid: Shared DB + Feature-Specific Volumes)

---

## What We've Decided

### Architecture: Option D (Hybrid)
✅ **1 PostgreSQL Database** (`veritable_core`) - shared by all features
✅ **6 Docker Volumes** - feature-specific storage:
  1. `veritable-gallery` (1.1GB - gallery media)
  2. `veritable-user-uploads` (avatars, forum attachments)
  3. `veritable-wiki` (wiki images - future)
  4. `veritable-news` (news media - future)
  5. `anarchist-library` (read-only, 24K texts)
  6. `marxists-library` (read-only, 500K+ texts)

✅ **1 Container** - Veritable Games application
  - Mounts all 6 volumes
  - Single PostgreSQL connection
  - No code changes needed

### Why Option D for Your Project
- ✅ Perfect for current state (1.1GB + archives)
- ✅ Clear file organization (galleries separate from user uploads)
- ✅ Natural growth path (can expand to microservices later)
- ✅ Single developer friendly (not too simple, not too complex)
- ✅ Future-proof (can migrate to Option C if scaling needed)

---

## Documentation Created

**Read These in Order**:

1. **[DATABASE_VOLUME_ARCHITECTURE_OPTIONS.md](./DATABASE_VOLUME_ARCHITECTURE_OPTIONS.md)** (2 min read)
   - Overview of all 4 options (A, B, C, D)
   - Comparison matrix
   - Why Option D was selected

2. **[OPTION_D_IMPLEMENTATION_SPECIFICATIONS.md](./OPTION_D_IMPLEMENTATION_SPECIFICATIONS.md)** (5 min read)
   - Complete volume mount configuration
   - File organization standards
   - API route mapping
   - Container initialization sequence
   - Backup strategies

3. **[EXTERNALIZED_FILES_IMPLEMENTATION_PLAN.md](./EXTERNALIZED_FILES_IMPLEMENTATION_PLAN.md)** (Reference during execution)
   - 5-phase implementation plan
   - Exact commands to run
   - Verification steps

---

## Your Current State

✅ **What you have**:
- 1.1GB uploads on localhost at `frontend/public/uploads/`
- 1.1GB uploads on server (files available but not persisted in container)
- Anarchist library volume created (empty, ready for 24K documents)
- Marxists library volume created (empty, ready for 500K+ documents)
- PostgreSQL database running on production server
- Coolify application container running

❌ **What's broken**:
- Gallery images/videos return "failed to load" (files not mounted in container)
- User uploads lost on container restart (no volume persistence)
- No automated sync between localhost and server

---

## Exact Next Steps (60-90 minutes total)

### Step 1: Execute Phase 1 (5 minutes)
**Goal**: Create veritable-gallery Docker volume

```bash
ssh user@192.168.1.15
docker volume create veritable-gallery
docker volume ls | grep veritable-gallery
```

**Expected output**: `veritable-gallery` listed

### Step 2: Execute Phase 2 (30-60 minutes)
**Goal**: Transfer 1.1GB files to server

See: [EXTERNALIZED_FILES_IMPLEMENTATION_PLAN.md](./EXTERNALIZED_FILES_IMPLEMENTATION_PLAN.md) **Phase 2**

```bash
# From localhost:
cd /home/user/Projects/veritable-games-main
ssh user@192.168.1.15 "mkdir -p /tmp/uploads-staging"

rsync -avz --progress \
  frontend/public/uploads/ \
  user@192.168.1.15:/tmp/uploads-staging/
```

**Expected**: See progress like "150 100% __ MB/s 0:00:10"

Then on server:
```bash
# Docker copies staging to volume
docker run --rm \
  -v veritable-gallery:/mnt/uploads \
  -v /tmp/uploads-staging:/mnt/staging \
  alpine cp -r /mnt/staging/* /mnt/uploads/

# Verify
docker run --rm -v veritable-gallery:/mnt/uploads alpine \
  sh -c 'echo "Files:" && find /mnt/uploads -type f | wc -l && \
  echo "Size:" && du -sh /mnt/uploads'

# Expected: 150 files, 1.1G
rm -rf /tmp/uploads-staging
```

### Step 3: Execute Phase 3 (10 minutes)
**Goal**: Configure Coolify with all 6 volume mounts

**In Coolify Dashboard**:
1. Go to: Applications → Veritable Games
2. Find: Services/Resources → Volumes
3. Add 6 volumes (see table below)
4. Save and trigger redeploy

| Source | Mount Path | Mode |
|--------|-----------|------|
| `veritable-gallery` | `/app/public/uploads` | Read/Write |
| `veritable-user-uploads` | `/app/data/uploads` | Read/Write |
| `veritable-wiki` | `/app/public/wiki-images` | Read/Write |
| `veritable-news` | `/app/public/news` | Read/Write |
| `anarchist-library` | `/app/anarchist-library` | Read/Write |
| `marxists-library` | `/app/marxists-library` | Read/Write |

**Expected**: Coolify shows "Deployment in progress..." then "Successfully deployed"

### Step 4: Execute Phase 4 (10 minutes)
**Goal**: Verify all volumes are mounted and files are accessible

```bash
ssh user@192.168.1.15

# Verify all 6 volumes are mounted
docker inspect m4s0kwo4kc4oooocck4sswc4 | grep -A 100 Mounts | grep -E "Destination|veritable"

# Should show 6 mount points with paths /app/public/uploads, /app/data/uploads, etc.

# Test gallery files exist
docker exec m4s0kwo4kc4oooocck4sswc4 ls -la /app/public/uploads/
# Expected: Lists concept-art/, references/, history/, videos/

# Test file access via HTTP
curl -I https://www.veritablegames.com/public/uploads/concept-art/[some-project]/[some-file].jpg
# Expected: HTTP 200 OK (not 404)
```

### Step 5: Execute Phase 5 (15 minutes)
**Goal**: Setup automated sync from localhost to server

See: [EXTERNALIZED_FILES_IMPLEMENTATION_PLAN.md](./EXTERNALIZED_FILES_IMPLEMENTATION_PLAN.md) **Phase 5**

```bash
# Create sync script
mkdir -p frontend/scripts/sync

cat > frontend/scripts/sync/push-uploads-to-server.sh << 'EOF'
#!/bin/bash

REMOTE_USER="user"
REMOTE_HOST="192.168.1.15"
LOCAL_UPLOADS="$(dirname "$0")/../../public/uploads"
LOG_FILE="${LOCAL_UPLOADS}/../../.logs/upload-sync.log"

mkdir -p "$(dirname "$LOG_FILE")"
echo "[$(date)] Starting sync..." >> "$LOG_FILE"

if [ ! -d "$LOCAL_UPLOADS" ]; then
  echo "[$(date)] No uploads directory" >> "$LOG_FILE"
  exit 0
fi

SIZE=$(du -sh "$LOCAL_UPLOADS" 2>/dev/null | cut -f1)
echo "[$(date)] Syncing $SIZE..." >> "$LOG_FILE"

rsync -avz --delete \
  --exclude '.DS_Store' \
  --exclude '*.tmp' \
  "$LOCAL_UPLOADS/" \
  "${REMOTE_USER}@${REMOTE_HOST}:/tmp/uploads-sync/" \
  >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
  ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH'
docker run --rm \
  -v veritable-gallery:/mnt/uploads \
  -v /tmp/uploads-sync:/mnt/incoming \
  alpine cp -r /mnt/incoming/* /mnt/uploads/ 2>/dev/null && rm -rf /mnt/incoming/*
EOSSH
  echo "[$(date)] ✓ Complete" >> "$LOG_FILE"
else
  echo "[$(date)] ✗ Failed" >> "$LOG_FILE"
fi
EOF

chmod +x frontend/scripts/sync/push-uploads-to-server.sh

# Add npm script
# Edit frontend/package.json and add:
# "sync:gallery:push": "bash scripts/sync/push-uploads-to-server.sh"

# Add to crontab for automatic sync every 6 hours
crontab -e
# Add line: 0 */6 * * * /home/user/Projects/veritable-games-main/frontend/scripts/sync/push-uploads-to-server.sh

# Verify cron job added
crontab -l
```

**Expected**: Cron job appears in `crontab -l`

---

## After Implementation Completes

### Immediate (Within 1 hour)
✅ Gallery images load properly
✅ Videos play without "failed to load"
✅ Uploads persist across container restarts
✅ Deployments 6-13x faster (no 1.1GB in image)

### Short-term (Next 2-4 weeks)
⏳ User uploads automatically synced to server
⏳ Monitor sync logs
⏳ Test new uploads via web UI
⏳ Verify persistence after container restart

### Medium-term (Next 2-8 months)
⏳ Implement wiki image uploads to `veritable-wiki` volume
⏳ Implement news media uploads to `veritable-news` volume
⏳ Integrate Anarchist Library (24,643 documents)
⏳ Integrate Marxists.org (500K+ documents)

---

## Key Differences from Earlier Phases

**Option D includes 6 volumes instead of 1**:
- **Phase 1-5**: Create and configure `veritable-gallery` (primary goal)
- **Future**: Add remaining volumes as features need them

**Why 6 volumes instead of 1?**
- Gallery media (1.1GB) is completely separate from user avatars
- Archives (anarchist, marxists) are separate from user uploads
- Each has different backup priority, access patterns, size
- Easier to manage independently

**Code changes needed?**
- ❌ NO - All existing API routes already map correctly
- API routes already write to `/app/public/uploads` and `/app/data/uploads`
- Volumes mount at those exact paths
- Everything works automatically

---

## Timeline

| Phase | Task | Time | Status |
|-------|------|------|--------|
| **1** | Create veritable-gallery volume | 5 min | Ready |
| **2** | Transfer 1.1GB uploads | 30-60 min | Ready |
| **3** | Configure Coolify (6 volumes) | 10 min | Ready |
| **4** | Verify mounts & test | 10 min | Ready |
| **5** | Setup sync automation | 15 min | Ready |
| **TOTAL** | **Fix gallery + manage uploads** | **60-90 min** | **Ready** |

---

## Verification Checklist

### After Phase 1
- [ ] `docker volume ls` shows `veritable-gallery`

### After Phase 2
- [ ] Rsync shows "150 files" transferred
- [ ] `docker run -v veritable-gallery:/mnt/uploads alpine ls /mnt/uploads/` shows `concept-art`, `references`, etc.

### After Phase 3
- [ ] Coolify dashboard shows 6 volumes configured
- [ ] Coolify shows "Successfully deployed"

### After Phase 4
- [ ] `docker inspect` shows 6 mount points
- [ ] `docker exec ... ls /app/public/uploads/` lists gallery directories
- [ ] `curl https://www.veritablegames.com/public/uploads/[path]/[file]` returns HTTP 200

### After Phase 5
- [ ] `crontab -l` shows sync job
- [ ] `frontend/scripts/sync/push-uploads-to-server.sh` exists and is executable
- [ ] `frontend/package.json` includes `sync:gallery:push` script

---

## If Something Goes Wrong

**Gallery still showing 404?**
1. Check volumes are mounted: `docker inspect m4s0kwo4kc4oooocck4sswc4 | grep Mounts`
2. Check files exist: `docker run -v veritable-gallery:/mnt/uploads alpine ls /mnt/uploads/`
3. Check logs: `docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50`

**Rsync fails during Phase 2?**
1. Rsync is resumable - just run again (picks up where it left off)
2. Check SSH works: `ssh user@192.168.1.15 "echo OK"`

**Coolify won't redeploy?**
1. Check Coolify UI for error messages
2. Manually verify volumes exist: `docker volume ls`
3. Check logs in Coolify dashboard

**Sync automation not running?**
1. Verify cron job: `crontab -l`
2. Check cron logs: `grep CRON /var/log/syslog | tail -20`
3. Test manually: `bash frontend/scripts/sync/push-uploads-to-server.sh`

---

## Support & Documentation

**While Implementing**:
- Reference: [EXTERNALIZED_FILES_IMPLEMENTATION_PLAN.md](./EXTERNALIZED_FILES_IMPLEMENTATION_PLAN.md)
- Specs: [OPTION_D_IMPLEMENTATION_SPECIFICATIONS.md](./OPTION_D_IMPLEMENTATION_SPECIFICATIONS.md)
- Architecture: [DATABASE_VOLUME_ARCHITECTURE_OPTIONS.md](./DATABASE_VOLUME_ARCHITECTURE_OPTIONS.md)

**If Stuck**:
- See: [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- See: [docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)

---

## You're Ready to Begin

**Start with**: [EXTERNALIZED_FILES_IMPLEMENTATION_PLAN.md](./EXTERNALIZED_FILES_IMPLEMENTATION_PLAN.md) **Phase 1**

**Estimated time**: 60-90 minutes
**Risk level**: Low (volume-based, no code changes)
**Expected outcome**: Gallery working + 6-13x faster deployments

---

**Status**: 🟢 **Ready to implement**

