# Externalized Files Architecture & Implementation

**Status**: 🟡 Planning - Implementation in progress
**Date**: November 10, 2025
**Purpose**: Manage large user-uploaded files (1.1GB+) outside Docker image for faster deployments

---

## Problem Statement

### Current State (Broken)
- 1.1GB `/public/uploads/` directory exists locally but NOT on production server
- Gallery images/videos return "failed to load" (files missing on server)
- API routes write to ephemeral container storage (lost on restart)
- Every Coolify deployment rebuilds entire image including 1.1GB of uploads
- This causes: slow builds, timeouts, failed deployments, 502 errors

### Root Cause
Commit `7613751` correctly identified that 1.1GB should not be in Docker image, but didn't implement the volume persistence layer needed to replace it.

---

## Solution Architecture

### Core Concept

```
Local Development (localhost)
├── /frontend/public/uploads/        (1.1GB - local filesystem)
└── [Syncs to server via rsync/upload]
        ↓
Production Server (192.168.1.15)
├── Docker Volume: veritable-uploads  (1.1GB - persisted)
├── Docker Volume: anarchist-library  (24,643 docs - when ready)
└── Docker Volume: marxists-library   (500k+ docs - when ready)
        ↓
Application Container
├── Mounted at: /app/public/uploads   (read/write)
├── Mounted at: /app/data/uploads     (read/write)
└── Mounted at: /app/lib/anarchist    (read-only)
```

### Three-Layer Strategy

#### Layer 1: Container Configuration (Coolify)
- Volume mount `/app/public/uploads` → `veritable-uploads` volume
- Volume mount `/app/data/uploads` → `veritable-uploads` volume
- No changes to git or Docker image
- Persists across all deployments

#### Layer 2: File Sync (rsync-based)
- Localhost → Server: `rsync` for uploads
- Server → Localhost: `rsync` for downloads (backup)
- Cron job for automated sync
- Preserves file metadata and permissions

#### Layer 3: Database Reference
- PostgreSQL stores file metadata (path, size, created_at, etc.)
- API queries DB for file existence before serving
- Graceful 404 if file missing but in DB

---

## Implementation Steps

### Step 1: Create Docker Volumes on Server

**Connect to server**:
```bash
ssh user@192.168.1.15
```

**Create volumes**:
```bash
# Main uploads volume
docker volume create veritable-uploads

# Anarchist library (for future)
docker volume create anarchist-library

# Marxists library (for future)
docker volume create marxists-library

# Verify
docker volume ls | grep veritable
```

### Step 2: Transfer Existing 1.1GB Uploads

**From localhost to server** (choose one method):

**Option A: Direct rsync (recommended)**
```bash
cd /home/user/Projects/veritable-games-main

# Create staging on server
ssh user@192.168.1.15 "mkdir -p /tmp/uploads-staging"

# Copy uploads
rsync -avz --progress frontend/public/uploads/ \
  user@192.168.1.15:/tmp/uploads-staging/

# On server: move to volume
ssh user@192.168.1.15 << 'EOF'
docker run --rm \
  -v veritable-uploads:/mnt/uploads \
  -v /tmp/uploads-staging:/mnt/staging \
  alpine cp -r /mnt/staging/* /mnt/uploads/

rm -rf /tmp/uploads-staging
EOF
```

**Option B: Docker CP (slower)**
```bash
# Package locally
tar czf uploads.tar.gz frontend/public/uploads/

# Transfer
scp uploads.tar.gz user@192.168.1.15:/tmp/

# On server: extract to volume
docker run --rm \
  -v veritable-uploads:/mnt/uploads \
  -v /tmp:/tmp \
  alpine tar xzf /tmp/uploads.tar.gz -C /mnt/uploads --strip-components=3
```

### Step 3: Configure Coolify Volume Mount

**In Coolify dashboard:**

1. Go to Application → Veritable Games
2. Navigate to "Services" or "Resources" section
3. Find "Volumes" section
4. Add new volume mount:
   ```
   Source:      veritable-uploads
   Mount Path:  /app/public/uploads
   Mode:        Read/Write
   ```

5. Add another mount for avatars:
   ```
   Source:      veritable-uploads
   Mount Path:  /app/data/uploads
   Mode:        Read/Write
   ```

6. Save and redeploy

**Alternative: Manual Docker Compose**

Edit or create `docker-compose.yml`:
```yaml
services:
  veritable-games:
    image: veritable-games:latest
    volumes:
      # Externalized uploads
      - veritable-uploads:/app/public/uploads
      - veritable-uploads:/app/data/uploads
      # PostgreSQL
      - veritable-db:/var/lib/postgresql/data
    environment:
      DATABASE_URL: postgresql://...

volumes:
  veritable-uploads:
    driver: local
  veritable-db:
    driver: local
```

### Step 4: Verify Volume Mount

**After deploying**, verify files are accessible:

```bash
# SSH to server
ssh user@192.168.1.15

# Check volume contents
docker run --rm -v veritable-uploads:/mnt/uploads alpine ls -lah /mnt/uploads/

# Should show subdirectories like:
# concept-art/
# history/
# references/
# videos/
# avatars/
```

---

## Sync Strategy: Local ↔ Server

### Bidirectional Sync Setup

**Purpose**: Keep localhost and server in sync without git commits

#### 1. Automated Upload Sync (localhost → server)

**Setup script** (`sync-uploads-to-server.sh`):
```bash
#!/bin/bash

# Configuration
REMOTE_USER="user"
REMOTE_HOST="192.168.1.15"
REMOTE_MOUNT="/mnt/uploads"
LOCAL_UPLOADS="frontend/public/uploads"
LOG_FILE="./uploads-sync.log"

# Sync local uploads to server
echo "[$(date)] Starting upload sync..." >> $LOG_FILE

rsync -avz --delete \
  --exclude '.DS_Store' \
  --exclude '*.tmp' \
  "$LOCAL_UPLOADS/" \
  "user@192.168.1.15:/tmp/uploads-sync/" \
  >> $LOG_FILE 2>&1

# On server: update volume
ssh $REMOTE_USER@$REMOTE_HOST << 'EOSSH'
docker run --rm \
  -v veritable-uploads:/mnt/uploads \
  -v /tmp/uploads-sync:/mnt/incoming \
  alpine sh -c 'cp -r /mnt/incoming/* /mnt/uploads/ && rm -rf /mnt/incoming/*'
EOSSH

echo "[$(date)] Upload sync complete" >> $LOG_FILE
```

**Make executable and add to cron**:
```bash
chmod +x sync-uploads-to-server.sh

# Add to crontab (run every 6 hours)
crontab -e
# Add line: 0 */6 * * * /path/to/sync-uploads-to-server.sh
```

#### 2. Manual Sync Commands

**Push localhost to server**:
```bash
./sync-uploads-to-server.sh
```

**Pull server to localhost**:
```bash
rsync -avz --delete \
  user@192.168.1.15:/tmp/uploads-backup/ \
  frontend/public/uploads/
```

**One-time transfer of new uploads from web UI**:
```bash
# After uploading files via web interface
ssh user@192.168.1.15 << 'EOF'
# Copy from container to volume (if not already mounted)
docker cp m4s0kwo4kc4oooocck4sswc4:/app/public/uploads /tmp/uploads-new
docker run --rm -v veritable-uploads:/mnt/uploads \
  -v /tmp/uploads-new:/mnt/new \
  alpine cp -r /mnt/new/* /mnt/uploads/
EOF
```

---

## API Route Configuration

### Current Routes (Need Volume)

All these routes currently write to ephemeral storage:

```typescript
// frontend/src/app/api/projects/[slug]/concept-art/route.ts
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'concept-art', slug);

// frontend/src/app/api/projects/[slug]/references/route.ts
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'references', slug);

// frontend/src/app/api/projects/[slug]/history/route.ts
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'history', slug);

// frontend/src/app/api/users/[id]/avatar/route.ts
const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'avatars');
```

### No Code Changes Needed!

Once volume is mounted at `/app/public/uploads`, these routes will automatically use the persistent volume:
- `process.cwd()` = `/app` (container root)
- `/app/public/uploads` = mounted volume
- Files persist across restarts ✅

### Database Tracking

Enhance API routes to track uploads in DB:

```typescript
// After successful file write
const uploadRecord = await dbAdapter.query(
  `INSERT INTO public.uploads (file_path, file_size, project_id, uploaded_by, created_at)
   VALUES ($1, $2, $3, $4, NOW())
   RETURNING id`,
  [
    `public/uploads/concept-art/${slug}/${filename}`,
    file.size,
    projectId,
    session.user.id
  ]
);
```

---

## Testing File Persistence

### Verify Files Exist After Deployment

```bash
# 1. Deploy via Coolify
# Wait for deployment to complete

# 2. Check if files are still there
curl https://www.veritablegames.com/public/uploads/concept-art/[slug]/[filename].jpg
# Should return 200 OK (not 404)

# 3. SSH and verify
ssh user@192.168.1.15
docker run --rm -v veritable-uploads:/mnt/uploads alpine ls /mnt/uploads/concept-art/
# Should list all uploaded files
```

### Restart Container and Verify Persistence

```bash
# Stop container
docker stop m4s0kwo4kc4oooocck4sswc4

# Start container
docker start m4s0kwo4kc4oooocck4sswc4

# Files should still be there
docker run --rm -v veritable-uploads:/mnt/uploads alpine ls /mnt/uploads/
# All files should still exist
```

---

## Troubleshooting

### "Files missing after deployment"

**Cause**: Volume not mounted in container

**Fix**:
```bash
# Verify volume is mounted
docker inspect m4s0kwo4kc4oooocck4sswc4 | grep -A 20 Mounts

# Should show:
# "Mounts": [
#   {
#     "Type": "volume",
#     "Name": "veritable-uploads",
#     "Source": "/var/lib/docker/volumes/veritable-uploads/_data",
#     "Destination": "/app/public/uploads",
#     ...
#   }
# ]

# If missing: reconfigure in Coolify and redeploy
```

### "Uploads fail with 'permission denied'"

**Cause**: Volume permissions incorrect

**Fix**:
```bash
# Fix ownership on volume
docker run --rm -v veritable-uploads:/mnt/uploads alpine chown -R 1000:1000 /mnt/uploads/
```

### "rsync sync fails"

**Cause**: SSH keys or path issues

**Fix**:
```bash
# Test SSH connection
ssh user@192.168.1.15 "echo 'SSH works'"

# Verify rsync is installed
ssh user@192.168.1.15 "which rsync"

# Test rsync with verbose output
rsync -avvz frontend/public/uploads/ user@192.168.1.15:/tmp/test/
```

---

## Performance Impact

### Deployment Time Reduction

**Before** (with 1.1GB in image):
- Docker build: 5-10 minutes
- Image push: 2-3 minutes
- Total: 7-13 minutes per deployment

**After** (volume mount):
- Docker build: <1 minute (no uploads)
- Image push: 30 seconds (small image)
- Total: <2 minutes per deployment

**Improvement**: 6-13x faster deployments ⚡

### Storage Usage

```
Before:
├── Docker image 1: 1.2 GB (includes uploads)
├── Docker image 2: 1.2 GB (old, failed deploy)
└── Docker image 3: 1.2 GB (current)
Total: 3.6 GB minimum

After:
├── Docker image: 50 MB (no uploads)
└── Volume: 1.1 GB (shared across all versions)
Total: 1.15 GB
Savings: ~2.5 GB per deployment ✅
```

---

## Related Files

- **[EXTERNALIZED_FILE_ARCHITECTURE_INVESTIGATION.md](./EXTERNALIZED_FILE_ARCHITECTURE_INVESTIGATION.md)** - Current server state analysis
- **[CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)** - SSH and server access
- **[COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md)** - Deployment configuration
- **[.dockerignore](../../frontend/.dockerignore)** - Docker exclusions (includes public/uploads)

---

## Next Steps

1. ✅ Create Docker volumes (Step 1)
2. ⏳ Transfer existing 1.1GB uploads (Step 2)
3. ⏳ Configure Coolify volume mounts (Step 3)
4. ⏳ Verify volume access (Step 4)
5. ⏳ Set up sync automation (Optional)
6. ⏳ Test file persistence after deployment

---

**Status**: Ready for implementation
**Estimated Implementation Time**: 30-45 minutes
**Risk Level**: Low (volume-based, no code changes required)

