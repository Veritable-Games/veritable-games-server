# File Sync Workflow: Localhost ↔ Server

**Status**: Planning and documentation
**Date**: November 10, 2025
**Purpose**: Strategy for syncing uploads between development and production without git

---

## Problem Overview

### Challenge 1: Large Files in Git
- 1.1GB uploads directory would bloat git history
- Every `git pull` would download old uploads
- Every `git push` would upload 1.1GB
- Makes development slow and deployments impossible

### Challenge 2: Server-Only Files
- Files uploaded via web UI only exist on production
- `git pull` doesn't bring them down (not in repo)
- Developers lose access to production uploads for testing

### Challenge 3: Development Workflow
- Developer uploads files locally → needs to appear on server
- Server receives uploads via web UI → needs to be available to developers
- No git mechanism to sync these

---

## Solution: Multi-Method Sync Strategy

### Three Synchronization Patterns

```
┌─ Pattern A: Scheduled Sync (Automated) ──────────┐
│ Every 6 hours: localhost → server                │
│ Use: Cron job with rsync                         │
│ Good for: Regular uploads accumulating locally   │
└────────────────────────────────────────────────┘

┌─ Pattern B: Event-Driven Sync (On-Demand) ──────┐
│ When you run: npm run sync-uploads               │
│ Use: rsync script with confirmation              │
│ Good for: Before/after deployments               │
└────────────────────────────────────────────────┘

┌─ Pattern C: Bidirectional Backup (Periodic) ────┐
│ When you run: npm run backup-uploads             │
│ Use: rsync with backup rotation                  │
│ Good for: Disaster recovery                      │
└────────────────────────────────────────────────┘
```

---

## Pattern A: Scheduled Automated Sync

### How It Works

```
Localhost uploads accumulate
         ↓ (every 6 hours)
Cron job triggers rsync
         ↓
Uploads transferred to server
         ↓
Server extracts to Docker volume
         ↓
Files immediately available in web app
```

### Setup

**Create sync script** (`frontend/scripts/sync/push-uploads-to-server.sh`):

```bash
#!/bin/bash

# Configuration
REMOTE_USER="${SYNC_USER:-user}"
REMOTE_HOST="${SYNC_HOST:-192.168.1.15}"
LOCAL_UPLOADS="$(dirname "$0")/../../public/uploads"
LOG_FILE="${LOCAL_UPLOADS}/../../.logs/upload-sync.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

echo "[$TIMESTAMP] Starting upload sync to server..." >> "$LOG_FILE"

# Check if uploads directory exists
if [ ! -d "$LOCAL_UPLOADS" ]; then
  echo "[$TIMESTAMP] No uploads directory found at $LOCAL_UPLOADS" >> "$LOG_FILE"
  exit 0
fi

# Get directory size
SIZE=$(du -sh "$LOCAL_UPLOADS" | cut -f1)
FILE_COUNT=$(find "$LOCAL_UPLOADS" -type f | wc -l)

echo "[$TIMESTAMP] Syncing $FILE_COUNT files ($SIZE) to $REMOTE_HOST..." >> "$LOG_FILE"

# Perform rsync (dry-run for safety)
rsync -avz \
  --exclude '.DS_Store' \
  --exclude '*.tmp' \
  --exclude '.gitkeep' \
  --stats \
  "$LOCAL_UPLOADS/" \
  "${REMOTE_USER}@${REMOTE_HOST}:/tmp/uploads-sync/" \
  >> "$LOG_FILE" 2>&1

RSYNC_EXIT=$?

if [ $RSYNC_EXIT -eq 0 ]; then
  echo "[$TIMESTAMP] ✓ Rsync successful" >> "$LOG_FILE"

  # On server: move to volume (if we have SSH access)
  ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH'
    docker run --rm \
      -v veritable-uploads:/mnt/uploads \
      -v /tmp/uploads-sync:/mnt/incoming \
      alpine sh -c 'cp -rv /mnt/incoming/* /mnt/uploads/ 2>/dev/null && rm -rf /mnt/incoming/*' \
      >> /dev/null 2>&1
EOSSH

  echo "[$TIMESTAMP] ✓ Volume sync complete" >> "$LOG_FILE"
else
  echo "[$TIMESTAMP] ✗ Rsync failed (exit code: $RSYNC_EXIT)" >> "$LOG_FILE"
fi

echo "[$TIMESTAMP] Sync job finished" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
```

**Add to crontab**:

```bash
# Open crontab editor
crontab -e

# Add this line (runs at midnight, 6 AM, noon, 6 PM UTC)
0 0,6,12,18 * * * /home/user/Projects/veritable-games-main/frontend/scripts/sync/push-uploads-to-server.sh

# Or for every 6 hours:
0 */6 * * * /home/user/Projects/veritable-games-main/frontend/scripts/sync/push-uploads-to-server.sh
```

**Add npm script** (`frontend/package.json`):

```json
{
  "scripts": {
    "sync:uploads:push": "bash scripts/sync/push-uploads-to-server.sh",
    "sync:uploads:schedule": "echo '0 */6 * * * npm run sync:uploads:push' | crontab -"
  }
}
```

### Monitoring Sync

Check sync logs:
```bash
tail -f frontend/public/uploads/../../.logs/upload-sync.log

# Should show:
# [2025-11-10 12:00:01] Starting upload sync to server...
# [2025-11-10 12:00:01] Syncing 150 files (1.1G) to 192.168.1.15...
# [2025-11-10 12:00:45] ✓ Rsync successful
# [2025-11-10 12:00:48] ✓ Volume sync complete
```

---

## Pattern B: On-Demand Sync

### Manual Sync When Needed

**Scenario 1: Before Deployment**
```bash
# You're about to deploy to production
# Ensure all local uploads are on server first
npm run sync:uploads:push

# Then deploy via Coolify dashboard
```

**Scenario 2: After Server Upload**
```bash
# Files were uploaded via web UI on production
# Pull them down to localhost for testing
npm run sync:uploads:pull
```

**Scenario 3: Backup Before Deleting**
```bash
# You're about to delete some uploads locally
# Backup to server first
npm run sync:uploads:backup

# Then safe to delete locally
```

### Create Manual Sync Script (`frontend/scripts/sync/sync-uploads-manual.sh`):

```bash
#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

REMOTE_USER="${SYNC_USER:-user}"
REMOTE_HOST="${SYNC_HOST:-192.168.1.15}"
LOCAL_UPLOADS="$(dirname "$0")/../../public/uploads"

print_header() {
  echo -e "${YELLOW}=== $1 ===${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
  exit 1
}

case "${1:-push}" in
  push)
    print_header "Push uploads to server"

    if [ ! -d "$LOCAL_UPLOADS" ]; then
      print_error "No uploads directory at $LOCAL_UPLOADS"
    fi

    SIZE=$(du -sh "$LOCAL_UPLOADS" | cut -f1)
    FILE_COUNT=$(find "$LOCAL_UPLOADS" -type f | wc -l)

    echo "Directory: $LOCAL_UPLOADS"
    echo "Files: $FILE_COUNT"
    echo "Size: $SIZE"
    echo ""
    read -p "Sync to server? (yes/no) " CONFIRM

    if [ "$CONFIRM" != "yes" ]; then
      echo "Cancelled"
      exit 0
    fi

    rsync -avz --delete \
      --exclude '.DS_Store' \
      --exclude '*.tmp' \
      "$LOCAL_UPLOADS/" \
      "${REMOTE_USER}@${REMOTE_HOST}:/tmp/uploads-sync/" \
      || print_error "Rsync failed"

    # Update volume
    ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH' || print_error "Server update failed"
docker run --rm \
  -v veritable-uploads:/mnt/uploads \
  -v /tmp/uploads-sync:/mnt/incoming \
  alpine sh -c 'cp -r /mnt/incoming/* /mnt/uploads/ && rm -rf /mnt/incoming/*'
EOSSH

    print_success "Uploads synced to server"
    ;;

  pull)
    print_header "Pull uploads from server"

    mkdir -p "$LOCAL_UPLOADS"

    print_success "Pulling from server..."

    rsync -avz --delete \
      "${REMOTE_USER}@${REMOTE_HOST}:/tmp/uploads-backup/" \
      "$LOCAL_UPLOADS/" \
      || print_error "Rsync failed"

    SIZE=$(du -sh "$LOCAL_UPLOADS" | cut -f1)
    FILE_COUNT=$(find "$LOCAL_UPLOADS" -type f | wc -l)

    print_success "Pulled $FILE_COUNT files ($SIZE)"
    ;;

  backup)
    print_header "Backup uploads to server"

    if [ ! -d "$LOCAL_UPLOADS" ]; then
      print_error "No uploads directory at $LOCAL_UPLOADS"
    fi

    SIZE=$(du -sh "$LOCAL_UPLOADS" | cut -f1)

    echo "Creating backup of $SIZE to server..."

    ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH'
mkdir -p /var/backups/uploads/$(date +%Y-%m-%d_%H%M%S)
EOSSH

    rsync -avz \
      "$LOCAL_UPLOADS/" \
      "${REMOTE_USER}@${REMOTE_HOST}:/var/backups/uploads/" \
      || print_error "Backup failed"

    print_success "Backup complete"
    ;;

  status)
    print_header "Sync status"

    echo "Local uploads:"
    if [ -d "$LOCAL_UPLOADS" ]; then
      du -sh "$LOCAL_UPLOADS"
      find "$LOCAL_UPLOADS" -type f | wc -l
      echo "files"
    else
      echo "(directory not found)"
    fi

    echo ""
    echo "Server uploads:"
    ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH'
docker run --rm -v veritable-uploads:/mnt/uploads alpine sh -c \
  'du -sh /mnt/uploads && find /mnt/uploads -type f | wc -l && echo "files"'
EOSSH
    ;;

  *)
    echo "Usage: $0 {push|pull|backup|status}"
    exit 1
    ;;
esac
```

**Add npm scripts** (`frontend/package.json`):

```json
{
  "scripts": {
    "sync:uploads": "bash scripts/sync/sync-uploads-manual.sh",
    "sync:uploads:push": "bash scripts/sync/sync-uploads-manual.sh push",
    "sync:uploads:pull": "bash scripts/sync/sync-uploads-manual.sh pull",
    "sync:uploads:backup": "bash scripts/sync/sync-uploads-manual.sh backup",
    "sync:uploads:status": "bash scripts/sync/sync-uploads-manual.sh status"
  }
}
```

### Usage

```bash
# Check sync status
npm run sync:uploads:status

# Output:
# === Sync status ===
# Local uploads:
# 1.1G
# 150
# files
#
# Server uploads:
# 1.1G
# 150
# files

# Sync to server
npm run sync:uploads:push

# Pull from server
npm run sync:uploads:pull

# Create backup
npm run sync:uploads:backup
```

---

## Pattern C: Bidirectional Backup

### Backup Strategy

**Goal**: Keep versioned backups of all uploads in case of disaster

**Setup**:

```bash
# On server, create backup directory
ssh user@192.168.1.15 "mkdir -p /var/backups/uploads-archive"

# Run backup (keep last 7 days)
ssh user@192.168.1.15 << 'EOSSH'
# Copy volume to timestamped backup
BACKUP_DATE=$(date +%Y-%m-%d_%H%M%S)
docker run --rm \
  -v veritable-uploads:/mnt/uploads \
  -v /var/backups/uploads-archive:/mnt/backups \
  alpine cp -r /mnt/uploads /mnt/backups/$BACKUP_DATE

# Keep only last 7 days of backups
find /var/backups/uploads-archive -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
EOSSH
```

**Add to cron** (daily backup):

```bash
crontab -e
# Add: 0 2 * * * ssh user@192.168.1.15 'bash /home/user/backup-uploads.sh'
```

---

## Complete Workflow Example

### Daily Development Workflow

```
Morning:
1. Start work
2. npm run sync:uploads:status     (check server has latest)
3. [Make code changes]
4. npm run dev                      (test locally)

Afternoon:
5. [Upload test files via web UI]
6. npm run sync:uploads:push       (push to server)

Evening:
7. npm run build                    (type-check everything)
8. git add . && git commit          (code only, NOT uploads)
9. git push origin branch
10. Deploy via Coolify              (files already on server)

Next Day:
11. npm run sync:uploads:pull      (pull any production uploads)
12. [Continue development]
```

### Deployment Day Workflow

```
Before Deployment:
1. npm run sync:uploads:push       (ensure all local files on server)
2. Verify via: npm run sync:uploads:status

During Deployment:
3. Push code to GitHub
4. Coolify auto-deploys
5. New container mounts veritable-uploads volume
6. All files immediately available (no download needed)

After Deployment:
7. Test files are accessible: curl https://domain/public/uploads/...
8. npm run sync:uploads:backup    (create backup of production state)
```

---

## File Organization

### Recommended Directory Structure

```
frontend/
├── public/
│   └── uploads/                  (1.1GB - local copy)
│       ├── concept-art/
│       │   └── {project-slug}/
│       │       ├── file1.jpg
│       │       └── file2.png
│       ├── references/
│       │   └── {project-slug}/
│       │       └── image.jpg
│       ├── history/
│       │   └── {project-slug}/
│       │       └── evolution.jpg
│       └── videos/
│           └── {project-slug}/
│               └── demo.mp4
├── data/
│   └── uploads/                  (avatars)
│       └── avatars/
│           ├── user-1.jpg
│           └── user-2.jpg
└── scripts/
    └── sync/
        ├── push-uploads-to-server.sh
        └── sync-uploads-manual.sh
```

### Server Volume Structure

Identical to local:
```
docker volume: veritable-uploads
├── concept-art/
├── references/
├── history/
├── videos/
└── avatars/
```

---

## Troubleshooting

### Issue: Rsync Permission Denied

**Cause**: SSH key not configured or missing

**Fix**:
```bash
# Test SSH
ssh user@192.168.1.15 "echo 'SSH works'"

# Add SSH key if missing
ssh-copy-id -i ~/.ssh/id_rsa.pub user@192.168.1.15

# Verify
ssh -v user@192.168.1.15 "exit"
```

### Issue: Volume fills up on server

**Cause**: Old backups not being cleaned up

**Fix**:
```bash
ssh user@192.168.1.15 << 'EOF'
# Check disk usage
df -h /var/lib/docker/volumes/

# Remove old backups
find /var/backups/uploads-archive -mtime +30 -type d -exec rm -rf {} \;
EOF
```

### Issue: Files not appearing after push

**Cause**: Docker volume mount not configured in Coolify

**Fix**:
```bash
# Verify volume is mounted
docker inspect m4s0kwo4kc4oooocck4sswc4 | grep -A 30 Mounts

# If missing: re-add volume in Coolify and redeploy
```

---

## Best Practices

✅ **DO:**
- Run sync before deployments
- Keep local uploads in sync with server
- Backup before major changes
- Monitor sync logs for errors

❌ **DON'T:**
- Commit uploads to git
- Delete uploads without backup
- Run sync during active uploads
- Change volume mount paths

---

## Related Documentation

- **[EXTERNALIZED_FILES_ARCHITECTURE.md](./EXTERNALIZED_FILES_ARCHITECTURE.md)** - Overall architecture
- **[CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)** - Server access
- **[frontend/.dockerignore](../../frontend/.dockerignore)** - Docker build exclusions

---

**Status**: Ready for implementation
**Estimated Setup Time**: 15-20 minutes
**Maintenance Time**: 2-3 minutes per manual sync

