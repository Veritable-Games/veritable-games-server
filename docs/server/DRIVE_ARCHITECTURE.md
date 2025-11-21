# Server Drive Architecture

**Last Updated:** November 14, 2025

## Overview

The production server (veritable-games-server, 192.168.1.15) uses a **dual-drive architecture** with intentional separation between user data and system services.

## Physical Configuration

### Drive 1: sdb (476.9GB SSD) - Primary System & User Data
**Purpose:** Root filesystem, user data, application code

**Partitions:**
- `sdb1` → `/boot/efi` (1.1GB, vfat)
  - EFI boot partition
  - Usage: 6.2MB / 1.1GB (1%)

- `sdb2` → `/` (468GB, ext4)
  - Root filesystem
  - Usage: 108GB / 468GB (25%, 336GB free)

**Contains:**
- `/home/user/` - All user files and projects
- `/home/user/projects/veritable-games/site/` - VG production repository (~2GB)
- `/home/user/projects/veritable-games/resources/` - Literature archives (~3.1GB + 30GB extracted)
- `/home/user/repository/` - Code archive (~30GB)
- `/home/user/docs/` - All documentation
- `/home/user/shared/` - Shared resources
- System binaries, libraries, configuration

### Drive 2: sda (953.9GB HDD) - System Services & Docker
**Purpose:** Isolate growing services data from user data

**Partitions:**
- `sda` → `/var` (938GB, ext4, entire drive)
  - Usage: 32GB / 938GB (4%, 859GB free)

**Contains:**
- `/var/lib/docker/` - Docker images, containers, volumes
- `/var/log/` - System and application logs (~1.8GB)
- `/var/lib/snapd/` - Snap packages (~1.7GB)
- `/var/cache/` - Package caches (~157MB)
- `/var/backups/` - System backups (~2.2MB)

## Architecture Rationale

### 1. Separation of Concerns
**User Data (sdb):**
- Application code
- Git repositories
- User files and projects
- Static content

**Services Data (sda):**
- Docker images and containers
- Database volumes
- System logs
- Build artifacts
- Ephemeral data

### 2. Resilience Benefits
- **Docker bloat protection:** Docker can grow to hundreds of GB without filling `/home/user`
- **Log isolation:** Runaway logging won't affect user space
- **Service independence:** System services can't starve user data space
- **Easier recovery:** User data remains accessible even if services fail

### 3. Performance Optimization
- **Faster drive for code:** User repositories on primary SSD for fast git operations
- **Larger drive for growth:** 954GB for Docker which has unpredictable growth patterns
- **I/O separation:** Heavy Docker I/O doesn't compete with user file access

### 4. Backup Strategy
- **User data:** Smaller, more important, backed up frequently from sdb
- **Service data:** Reproducible from images/configs, less critical to backup
- **Database data:** Lives in Docker volumes on sda, backed up separately

## Current Usage (November 2025)

### sdb2 (Root) - 108GB / 468GB (25% used)
```
Major consumers:
- System files: ~40GB
- VG repository: ~2GB
- VG resources: ~33GB (3.1GB archives + 30GB extracted)
- Repository archive: ~30GB (extracted)
- Miscellaneous: ~3GB
```

### sda (/var) - 32GB / 938GB (4% used)
```
Major consumers:
- Docker images: ~15-20GB
  - Coolify platform images
  - VG application images (multiple versions)
  - PostgreSQL images
  - Supporting services
- Docker volumes: ~5-10GB
  - PostgreSQL data
  - Coolify data
  - Application data
- System logs: ~1.8GB
- Snap packages: ~1.7GB
- Other system data: ~3GB
```

## fstab Configuration

```bash
# /etc/fstab
/dev/disk/by-uuid/f4fe8106-5c46-4cf2-ad35-de7dc4478bac / ext4 defaults 0 1
/dev/disk/by-uuid/1CB1-E5EF /boot/efi vfat defaults 0 1
/dev/disk/by-uuid/9a3fc94d-007e-4ae8-aabf-9088ba33d57b /var ext4 defaults 0 1
/swap.img	none	swap	sw	0	0
```

## Verification Commands

### Check Drive Configuration
```bash
# List all block devices
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT,LABEL

# Show filesystem usage
df -h

# Show mount configuration
mount | grep -E "sda|sdb"
```

### Monitor Space Usage
```bash
# Overall disk usage
df -h

# User data usage (root filesystem)
df -h /home/user

# Services usage (/var)
df -h /var

# Docker space usage
docker system df -v

# Find large directories
du -sh /home/user/* | sort -h | tail -10
du -sh /var/* | sort -h | tail -10
```

## Growth Planning

### Expected Growth Patterns

**sdb (Root) - Moderate Growth**
- User projects: Slow growth
- Literature archives: Periodic large additions (10-50GB)
- Code repositories: Minimal growth
- **Projection:** ~200GB in 1 year at current rate

**sda (/var) - High Growth Potential**
- Docker images: Can grow to 100-200GB+ (accumulates old versions)
- PostgreSQL data: 5-10GB growth per year with current archive activity
- Logs: 1-2GB/month if not rotated
- Build caches: 10-50GB if not cleaned
- **Projection:** Could reach 200-300GB in 1 year without cleanup

### Cleanup Recommendations

**Regular Maintenance (Monthly):**
```bash
# Remove old Docker images
docker image prune -a --filter "until=720h"  # Older than 30 days

# Remove unused Docker volumes
docker volume prune

# Clean build cache
docker builder prune

# Rotate logs (automatic with logrotate, but verify)
journalctl --vacuum-time=30d
```

**Space Recovery (When Needed):**
```bash
# Remove all unused Docker resources
docker system prune -a --volumes

# Check Docker space usage
docker system df

# Find and remove old log files
find /var/log -name "*.gz" -mtime +90 -delete
find /var/log -name "*.old" -mtime +90 -delete
```

## Best Practices for Claude Models

### When Adding Large Data

**User-facing content (code, projects, documents):**
- Store in `/home/user/` (on sdb)
- Examples: Git repositories, archives, documentation
- Reason: Faster access, better organized, easier backup

**Service/infrastructure data:**
- Store in `/var/` (on sda)
- Examples: Docker volumes, databases, build artifacts
- Reason: Won't fill user space, isolated from user data

### When Considering Docker Operations

**Docker lives on sda (/var):**
- Docker images can grow large - 859GB available
- Old images accumulate - cleanup regularly
- Build cache can be aggressive - won't affect user space

**Database volumes:**
- Already on sda via Docker
- PostgreSQL data isolated from user data
- Can grow significantly without concern

### File Placement Decision Tree

```
Q: Where should I store this data?

A: Is it user-created or application code?
   → /home/user/ (sdb) - User data drive

A: Is it a Docker volume, container, or image?
   → /var/lib/docker/ (sda) - Automatically handled

A: Is it a database file or log?
   → /var/ (sda) - Services drive

A: Is it a backup or archive?
   → /home/user/shared/archives/ (sdb) - User data drive
   OR
   → /var/backups/ (sda) - If automated system backup

A: Is it temporary build artifact?
   → /tmp/ (sdb, automatically cleaned)
   OR
   → /var/tmp/ (sda, persists across reboots)
```

## Monitoring & Alerts

### Warning Thresholds

**sdb (Root):**
- **Warning:** 70% full (327GB used)
- **Critical:** 85% full (398GB used)
- **Action:** Review and archive old projects

**sda (/var):**
- **Warning:** 70% full (656GB used)
- **Critical:** 85% full (797GB used)
- **Action:** Clean Docker images and volumes

### Quick Status Check
```bash
# Add to .bashrc for easy monitoring
alias diskstatus='df -h | grep -E "Filesystem|sda|sdb2"'

# Run anytime
diskstatus
```

## Disaster Recovery

### sdb Failure (User Data Loss)
**Impact:** CRITICAL - Loses all user data and code

**Recovery:**
1. Replace drive
2. Reinstall OS
3. Restore from git repository (VG)
4. Re-clone literature archives from laptop backups
5. Reconfigure system

**Prevention:**
- Regular git pushes to GitHub (automated via Coolify)
- Periodic backups of `/home/user/` to external storage
- Keep important data in version control

### sda Failure (Services Loss)
**Impact:** MODERATE - Loses Docker state and logs

**Recovery:**
1. Replace drive
2. Mount as `/var`
3. Reinstall Docker
4. Coolify auto-deploys from GitHub
5. Rebuild PostgreSQL from backups

**Prevention:**
- Regular PostgreSQL dumps
- Docker volumes backed up if critical
- All infrastructure as code (deployable from GitHub)

## See Also

- `/home/user/CLAUDE.md` - Server-level guidance
- `/home/user/docs/server/CONTAINER_TO_GIT_AUTOMATION.md` - Container workflow
- `/home/user/docs/reference/troubleshooting.md` - Troubleshooting guide
- `/home/user/docs/operations/PRODUCTION_OPERATIONS.md` - Production monitoring

---

**Last Updated:** November 14, 2025
**Verified Configuration:** Working as designed, no issues
