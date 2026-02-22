# Externalized Files Implementation Plan

**Status**: Ready for implementation
**Created**: November 10, 2025
**Objective**: Move 1.1GB gallery uploads to persistent Docker volume, fix broken image/video loading

---

## Executive Summary

### The Problem
- 1.1GB `/frontend/public/uploads/` directory isn't on production server
- Gallery images/videos show "failed to load" errors
- Files were excluded from Docker image (commit `7613751`) but no persistence layer added
- Every deployment rebuild tries to include 1.1GB, causing timeouts and failures

### The Solution
Use **Docker volumes** for persistent file storage separate from container image:
1. Create `veritable-uploads` Docker volume on server
2. Transfer 1.1GB uploads from localhost to server
3. Mount volume in application container
4. Set up rsync sync for ongoing updates

### The Outcome
- ✅ Gallery images/videos load immediately
- ✅ Deployments 6-13x faster (no 1.1GB in image)
- ✅ Files persist across container restarts
- ✅ Files updated independently of deployments

---

## Quick Reference

| Task | Time | Difficulty | Dependencies |
|------|------|-----------|--------------|
| **Phase 1: Setup Volume** | 5 min | Easy | SSH access |
| **Phase 2: Transfer Files** | 30-60 min | Medium | Network bandwidth (1.1GB) |
| **Phase 3: Configure Coolify** | 10 min | Easy | Coolify dashboard access |
| **Phase 4: Verify & Test** | 10 min | Easy | Web browser |
| **Phase 5: Sync Automation** | 15 min | Medium | Crontab access |
| **TOTAL** | 60-90 min | Medium | None blocking |

---

## Step-by-Step Implementation

### PHASE 1: Create Docker Volume (5 minutes)

**SSH to server**:
```bash
ssh user@192.168.1.15
```

**Create volume**:
```bash
docker volume create veritable-uploads
docker volume ls
# Should show: veritable-uploads
```

**Status**: ✅ READY

---

### PHASE 2: Transfer 1.1GB Uploads (30-60 minutes)

**Choose ONE method**:

#### Method A: Rsync (Recommended - resumable)

From localhost:
```bash
cd /home/user/Projects/veritable-games-main

# First, prepare staging area on server
ssh user@192.168.1.15 "mkdir -p /tmp/uploads-staging"

# Copy uploads (this will take 10-20 minutes depending on speed)
rsync -avz --progress \
  frontend/public/uploads/ \
  user@192.168.1.15:/tmp/uploads-staging/

# Watch progress - should see something like:
# frontend/public/uploads/concept-art/project-name/file.jpg
#               150 100% __ MB/s  0:00:10 (xfer#150, to-check=0/150)
```

Then on server:
```bash
ssh user@192.168.1.15 << 'EOSSH'
# Copy from staging to Docker volume
docker run --rm \
  -v veritable-uploads:/mnt/uploads \
  -v /tmp/uploads-staging:/mnt/staging \
  alpine cp -r /mnt/staging/* /mnt/uploads/

# Verify files were copied
docker run --rm -v veritable-uploads:/mnt/uploads alpine \
  sh -c 'echo "Total files:" && find /mnt/uploads -type f | wc -l && \
  echo "Total size:" && du -sh /mnt/uploads'

# Should show 150+ files and 1.1 GB

# Cleanup
rm -rf /tmp/uploads-staging
EOSSH
```

#### Method B: SSH + Direct Copy (Faster but no resume)

```bash
# Copy directly to server's /tmp
scp -r frontend/public/uploads user@192.168.1.15:/tmp/

# Then extract to volume
ssh user@192.168.1.15 << 'EOF'
docker run --rm \
  -v veritable-uploads:/mnt/uploads \
  -v /tmp/uploads:/tmp/uploads \
  alpine cp -r /tmp/uploads/* /mnt/uploads/

rm -rf /tmp/uploads
EOF
```

**Status**: ✅ READY after transfer completes

---

### PHASE 3: Configure Coolify Volume Mount (10 minutes)

**Via Coolify Dashboard** (Recommended):

1. Login to Coolify (http://coolify.local or your Coolify URL)
2. Navigate to **Applications** → **Veritable Games**
3. Go to **Services** or **Resources** section
4. Find **Volumes** configuration
5. Click **Add Volume** and add:
   ```
   Source:      veritable-uploads
   Mount Path:  /app/public/uploads
   Mode:        Read/Write
   ```
6. Click **Add Volume** again for avatars:
   ```
   Source:      veritable-uploads
   Mount Path:  /app/data/uploads
   Mode:        Read/Write
   ```
7. **Save** and wait for automatic redeploy

**Alternative: Manual Docker (if Coolify UI not available)**

```bash
ssh user@192.168.1.15

# Edit or create docker-compose.yml
nano docker-compose-veritable.yml
```

Add:
```yaml
version: '3.8'

services:
  veritable-games:
    image: veritable-games:latest
    container_name: m4s0kwo4kc4oooocck4sswc4
    volumes:
      - veritable-uploads:/app/public/uploads
      - veritable-uploads:/app/data/uploads
      - veritable-db:/var/lib/postgresql/data
    environment:
      DATABASE_URL: ${DATABASE_URL}
    ports:
      - "3000:3000"

volumes:
  veritable-uploads:
    driver: local
  veritable-db:
    driver: local
```

Then:
```bash
docker-compose -f docker-compose-veritable.yml up -d
```

**Status**: ✅ READY after Coolify redeploys

---

### PHASE 4: Verify & Test (10 minutes)

**Check volume mounted**:
```bash
ssh user@192.168.1.15

docker inspect m4s0kwo4kc4oooocck4sswc4 | grep -A 30 "Mounts"

# Should show something like:
# "Mounts": [
#   {
#     "Type": "volume",
#     "Name": "veritable-uploads",
#     "Source": "/var/lib/docker/volumes/veritable-uploads/_data",
#     "Destination": "/app/public/uploads",
#     "Mode": "z",
#     "RW": true
#   }
# ]
```

**Test file access**:
```bash
# Check files exist in volume
docker run --rm -v veritable-uploads:/mnt/uploads alpine \
  ls -lah /mnt/uploads/ | head -20

# Should list subdirectories:
# concept-art/
# references/
# history/
# videos/
# avatars/
```

**Test via HTTP**:

Open browser to production site:
```
https://www.veritablegames.com
# Navigate to a project with gallery images
# Try to view an image - should load (not show 404 or "failed to load")
```

**Check logs** (if files still not loading):
```bash
docker logs m4s0kwo4kc4oooocck4sswc4 | tail -50
# Look for error messages about missing files
```

**Status**: ✅ READY if files loading

---

### PHASE 5: Setup Sync Automation (15 minutes)

**Goal**: Automatically sync new uploads from localhost to server every 6 hours

**Create sync script** on localhost:

```bash
# Create directory
mkdir -p frontend/scripts/sync

# Create file: frontend/scripts/sync/push-uploads-to-server.sh
cat > frontend/scripts/sync/push-uploads-to-server.sh << 'EOF'
#!/bin/bash

REMOTE_USER="user"
REMOTE_HOST="192.168.1.15"
LOCAL_UPLOADS="$(dirname "$0")/../../public/uploads"
LOG_FILE="${LOCAL_UPLOADS}/../../.logs/upload-sync.log"

mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date)] Starting sync..." >> "$LOG_FILE"

if [ ! -d "$LOCAL_UPLOADS" ]; then
  echo "[$(date)] No uploads to sync" >> "$LOG_FILE"
  exit 0
fi

SIZE=$(du -sh "$LOCAL_UPLOADS" 2>/dev/null | cut -f1)
echo "[$(date)] Syncing $SIZE to server..." >> "$LOG_FILE"

rsync -avz --delete \
  --exclude '.DS_Store' \
  --exclude '*.tmp' \
  "$LOCAL_UPLOADS/" \
  "${REMOTE_USER}@${REMOTE_HOST}:/tmp/uploads-sync/" \
  >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
  ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH'
docker run --rm \
  -v veritable-uploads:/mnt/uploads \
  -v /tmp/uploads-sync:/mnt/incoming \
  alpine cp -r /mnt/incoming/* /mnt/uploads/ 2>/dev/null && rm -rf /mnt/incoming/*
EOSSH
  echo "[$(date)] ✓ Sync complete" >> "$LOG_FILE"
else
  echo "[$(date)] ✗ Sync failed" >> "$LOG_FILE"
fi
EOF

chmod +x frontend/scripts/sync/push-uploads-to-server.sh
```

**Add to crontab**:

```bash
# Open crontab editor
crontab -e

# Add this line (runs every 6 hours at 12 AM, 6 AM, 12 PM, 6 PM UTC)
0 */6 * * * /home/user/Projects/veritable-games-main/frontend/scripts/sync/push-uploads-to-server.sh

# Save and exit (Ctrl+X, then Y, then Enter)
```

**Verify cron job added**:
```bash
crontab -l
# Should show your sync line
```

**Optional: Add npm script**:

Edit `frontend/package.json`:
```json
{
  "scripts": {
    "sync:uploads:push": "bash scripts/sync/push-uploads-to-server.sh"
  }
}
```

Then you can run:
```bash
npm run sync:uploads:push
```

**Status**: ✅ READY - automation running

---

## Complete Checklist

### Before Implementation
- [ ] SSH access confirmed: `ssh user@192.168.1.15 "echo OK"`
- [ ] Network speed adequate: `speedtest` or estimate upload time
- [ ] Coolify accessible
- [ ] 1.1GB free space on server: `df -h`

### Implementation
- [ ] **Phase 1**: Docker volume created
- [ ] **Phase 2**: Files transferred successfully
- [ ] **Phase 3**: Volume mounted in Coolify (and redeployed)
- [ ] **Phase 4**: Files accessible via HTTP
- [ ] **Phase 5**: Sync cron job configured

### Post-Implementation
- [ ] Test gallery image loading
- [ ] Test video loading
- [ ] Create a test upload via web UI
- [ ] Verify it appears in filesystem: `docker run --rm -v veritable-uploads:/mnt/uploads alpine ls /mnt/uploads/`
- [ ] Check sync logs: `tail frontend/public/uploads/../../.logs/upload-sync.log`

---

## What Happens Next

### Immediate (After deployment)
✅ Gallery images display correctly
✅ Videos load without "failed to load"
✅ New uploads via web UI work
✅ Deployments faster (no 1.1GB in image)

### Short-term (Next 2 weeks)
⏳ Monitor sync logs for errors
⏳ Test uploads from web UI sync to localhost
⏳ Verify files survive container restart

### Medium-term (Next month)
⏳ Set up automated backups of upload volume
⏳ Document backup restore procedure
⏳ Plan anarchist library integration (uses same pattern)
⏳ Plan marxists library integration (uses same pattern)

---

## Troubleshooting Quick Guide

### Issue: Files still not loading after Phase 4

**Check 1**: Is volume mounted?
```bash
docker inspect m4s0kwo4kc4oooocck4sswc4 | grep -i mount
```

**Check 2**: Do files exist in volume?
```bash
docker run --rm -v veritable-uploads:/mnt/uploads alpine ls /mnt/uploads/
```

**Check 3**: Check logs for 404 errors
```bash
docker logs m4s0kwo4kc4oooocck4sswc4 | grep -i "not found"
```

### Issue: Rsync fails during transfer (Phase 2)

**Solution**: Rsync is resumable, just run again:
```bash
rsync -avz --progress \
  frontend/public/uploads/ \
  user@192.168.1.15:/tmp/uploads-staging/
# Will pick up where it left off
```

### Issue: Cron sync not running

**Check 1**: Is cron job scheduled?
```bash
crontab -l
```

**Check 2**: Check cron logs
```bash
grep CRON /var/log/syslog | tail -20
```

**Check 3**: Test script manually
```bash
bash frontend/scripts/sync/push-uploads-to-server.sh
tail frontend/public/uploads/../../.logs/upload-sync.log
```

---

## Performance Impact

### Before (Current - Broken)
- Gallery images: ❌ 404 / "Failed to load"
- Deployments: ⚠️ 7-13 minutes (with 1.1GB in image)
- Upload persistence: ❌ Lost on container restart

### After Implementation
- Gallery images: ✅ Load immediately
- Deployments: ✅ <2 minutes (no uploads in image)
- Upload persistence: ✅ Survives container restart

### Estimated Deployment Time Saved per Deploy
```
Before: 10 minutes (average, including 1.1GB upload)
After:  1.5 minutes (average, no uploads)
Savings: 8.5 minutes per deploy

For 2 deploys/week = 17 minutes/week = 14.7 hours/year ⏱️
```

---

## Next Phase: Libraries

Once this is working, same pattern applies to:

### Anarchist Library (24,643 documents)
- **Size**: 20-50 GB
- **Timeline**: 2-4 weeks
- **Uses**: Same Docker volume approach

### Marxists Library (500,000+ documents)
- **Size**: 100-200 GB
- **Timeline**: 4-8 weeks
- **Uses**: Same Docker volume approach, but larger scale

See: [LIBRARY_INTEGRATION_STRATEGY.md](./LIBRARY_INTEGRATION_STRATEGY.md)

---

## Related Documentation

**Investigation & Analysis**:
- [EXTERNALIZED_FILE_ARCHITECTURE_INVESTIGATION.md](./EXTERNALIZED_FILE_ARCHITECTURE_INVESTIGATION.md) - Server state analysis

**Architecture & Strategy**:
- [EXTERNALIZED_FILES_ARCHITECTURE.md](./EXTERNALIZED_FILES_ARCHITECTURE.md) - Complete architecture
- [FILE_SYNC_WORKFLOW.md](./FILE_SYNC_WORKFLOW.md) - Sync patterns and automation
- [LIBRARY_INTEGRATION_STRATEGY.md](./LIBRARY_INTEGRATION_STRATEGY.md) - Future: Libraries

**Operations**:
- [CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md) - Server access & commands
- [COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md) - Coolify setup

---

## Support & Questions

### Something not working?
1. Check the **Troubleshooting Quick Guide** above
2. Review the detailed docs listed in **Related Documentation**
3. Check logs: `docker logs m4s0kwo4kc4oooocck4sswc4`

### Need more details?
- **How it works**: See [EXTERNALIZED_FILES_ARCHITECTURE.md](./EXTERNALIZED_FILES_ARCHITECTURE.md)
- **Sync strategy**: See [FILE_SYNC_WORKFLOW.md](./FILE_SYNC_WORKFLOW.md)
- **Future libraries**: See [LIBRARY_INTEGRATION_STRATEGY.md](./LIBRARY_INTEGRATION_STRATEGY.md)

---

**Status**: ✅ Ready for implementation
**Estimated Time**: 60-90 minutes total
**Risk Level**: Low (volumes don't affect code, easy to rollback)
**Expected Outcome**: Gallery images/videos working, 6-13x faster deployments

