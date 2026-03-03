# Video Storage Bind-Mount Configuration

**Status**: Ready for Coolify configuration
**Date**: March 2, 2026
**Purpose**: Configure HDD bind-mount for video storage in production application container

---

## Summary

The `/data/uploads/videos/` directory structure has been created on the HDD (5.5TB drive) with 4.5TB available free space. The application container needs to bind-mount this directory to `/app/public/uploads/videos/` for video file access.

## Current State

**HDD Directory**: ✅ Created at `/data/uploads/videos/`
```
/data/uploads/videos/
├── projects/        # Project-specific video assets
├── concept-art/     # Concept art & design videos
├── references/      # Reference materials
├── history/         # Historical content
└── archived/        # Legacy videos
```

**Container Status**: Ready to mount (write permissions verified)

## Coolify Web UI Configuration

### Step 1: Access Coolify Dashboard
1. Open browser: http://192.168.1.15:8000 (local) or http://10.100.0.1:8000 (VPN)
2. Login with Coolify credentials

### Step 2: Navigate to Application Settings
1. Go to: **Applications** → **veritable-games** (UUID: m4s0kwo4kc4oooocck4sswc4)
2. Click on **Volumes** tab

### Step 3: Add New Volume Bind-Mount
1. Click **+ Add Volume**
2. Select **Bind Mount** type (NOT volume)
3. Configure:
   - **Source Path**: `/data/uploads/videos`
   - **Destination Path**: `/app/public/uploads/videos`
   - **Read/Write**: Enable (RW)

### Step 4: Deploy
1. Click **Save** and **Redeploy**
2. Wait 2-5 minutes for deployment
3. Verify in container: `docker inspect m4s0kwo4kc4oooocck4sswc4 | grep -A 5 "/data/uploads/videos"`

## Alternative: Coolify API Configuration

If web UI is unavailable, you can add the volume via Coolify API:

```bash
# Set API token and URL
export COOLIFY_API_TOKEN="<your-api-token>"
export COOLIFY_API_URL="http://10.100.0.1:8000"

# Add bind-mount volume
curl -X POST "$COOLIFY_API_URL/api/v1/applications/m4s0kwo4kc4oooocck4sswc4/volumes" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "veritable-games-videos",
    "source": "/data/uploads/videos",
    "destination": "/app/public/uploads/videos",
    "mount_point": "/app/public/uploads/videos",
    "volume_type": "bind",
    "read_only": false
  }'

# Trigger deployment
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
```

## Verification Commands

**After deployment is complete**, verify the mount is active:

```bash
# Check container mounts
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{json .Mounts}}' | jq '.[] | select(.Source | contains("uploads/videos"))'

# Should output:
# {
#   "Type": "bind",
#   "Source": "/data/uploads/videos",
#   "Destination": "/app/public/uploads/videos",
#   "Mode": "rw",
#   "RW": true
# }

# Test write access from container
docker exec m4s0kwo4kc4oooocck4sswc4 touch /app/public/uploads/videos/test.txt
docker exec m4s0kwo4kc4oooocck4sswc4 ls -la /app/public/uploads/videos/
```

## Disk Space Verification

**Current HDD Status**:
- Drive: `/dev/sda` (5.5TB total)
- Used: 923GB (17%)
- Available: **4.5TB** (83%)
- Video directory: 28KB (freshly created)

**Capacity Planning**:
- Expected video uploads: 50-100GB/month
- Runway at current rate: **4-5 years**
- Comfortable capacity: Keep below 70% (3.8TB usage)

## Related Documentation

- **Technical Analysis**: `/home/user/.claude/projects/-home-user/memory/GALLERY_VIDEO_STORAGE_TECHNICAL_ANALYSIS.md`
- **Implementation Roadmap**: Phase 2 of gallery system audit
- **Backup Strategy**: `/home/user/.claude/projects/-home-user/memory/TODO.md` (Phase 3)

## Rollback Plan

If issues occur after deployment:

```bash
# Remove the bind-mount from Coolify web UI (Applications → veritable-games → Volumes)
# Or via API:

curl -X DELETE "$COOLIFY_API_URL/api/v1/applications/m4s0kwo4kc4oooocck4sswc4/volumes/{volume-id}" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"

# Redeploy
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
```

---

**Status**: Awaiting Coolify bind-mount configuration
**Next**: Proceed to Phase 3 (Backup System Configuration) after deployment confirmation
