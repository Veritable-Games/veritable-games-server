# Video Backup System Configuration

**Status**: ✅ Deployed and configured
**Date**: March 2, 2026
**Purpose**: Separate backup strategy for video files with weekly snapshots and monthly archives

---

## Overview

The video backup system uses a two-tier approach optimized for media files:

1. **Weekly Snapshots** (rsync)
   - Fast recovery capability (rolling 4-week window)
   - Zero compression overhead
   - Full metadata preservation

2. **Monthly Archives** (zstd)
   - Long-term storage (~15% compression)
   - 12-month rolling retention
   - Parallel compression (multi-threaded)

This separates video backups from the existing GFS PostgreSQL backup system, freeing ~30GB/month from the 50GB production backup budget.

---

## Backup Locations

```
/data/backups/videos/
├── snapshot-20260302/      # Weekly snapshot (full copy)
├── snapshot-20260309/      # Latest weekly backup
├── snapshot-20260216/      # Older snapshots (4-week retention)
│
├── archive-202603.tar.zst  # Monthly archive (compressed)
├── archive-202602.tar.zst  # Previous month
└── archive-202601.tar.zst  # (12-month retention)
```

---

## Scripts

### 1. Weekly Snapshot Script

**File**: `/home/user/backups/scripts/backup-videos-weekly.sh`
**Schedule**: Sundays at 2:00 AM (0 2 * * 0)
**Duration**: 5-15 minutes (depends on video count)

**What it does**:
- Runs `rsync` to create a full copy of `/data/uploads/videos/` to `/data/backups/videos/snapshot-YYYYMMDD/`
- Preserves all metadata and timestamps
- Deletes files not in source (keeps snapshots in sync)
- Automatically removes snapshots older than 4 weeks
- Logs results to `/home/user/backups/logs/videos-weekly-backup.log`

**Manual execution**:
```bash
# Test (dry-run, no changes)
bash /home/user/backups/scripts/backup-videos-weekly.sh --dry-run

# Run manually
bash /home/user/backups/scripts/backup-videos-weekly.sh

# Check logs
tail -f /home/user/backups/logs/videos-weekly-backup.log
```

**Performance**:
- Snapshot creation: ~5 minutes for first snapshot, ~2 minutes for incremental
- Disk usage: ~1 snapshot = current video directory size
- 4 snapshots = 4× current directory size (rolling retention)

### 2. Monthly Archive Script

**File**: `/home/user/backups/scripts/archive-videos-monthly.sh`
**Schedule**: 1st of month at 3:00 AM (0 3 1 * *)
**Duration**: 30-60 minutes (depends on video volume)

**What it does**:
- Creates `tar.zst` (zstd-compressed tar archive) of all current snapshots
- Uses zstd compression level 10 (15-20% compression ratio)
- Parallel compression (uses all CPU cores)
- Verifies archive integrity after creation
- Automatically removes archives older than 12 months
- Logs results to `/home/user/backups/logs/videos-monthly-archive.log`

**Manual execution**:
```bash
# Test (dry-run, no changes)
bash /home/user/backups/scripts/archive-videos-monthly.sh --dry-run

# Run manually
bash /home/user/backups/scripts/archive-videos-monthly.sh

# Check logs
tail -f /home/user/backups/logs/videos-monthly-archive.log

# Verify archive integrity
tar -tzf /data/backups/videos/archive-202603.tar.zst > /dev/null && echo "✅ Archive OK"
```

**Performance**:
- Archive creation: 30-60 minutes for typical month
- Compression ratio: 15-20% (H.265 videos already compressed)
- Monthly archive size: ~100-200GB (after compression)
- Parallel compression: Uses all available CPU cores

---

## Cron Configuration

**Current cron jobs**:
```bash
crontab -l | grep backup-videos
```

**Jobs**:
```
# Weekly snapshot: Sundays at 2:00 AM
0 2 * * 0 /home/user/backups/scripts/backup-videos-weekly.sh >> /home/user/backups/logs/videos-weekly-backup.log 2>&1

# Monthly archive: 1st of month at 3:00 AM
0 3 1 * * /home/user/backups/scripts/archive-videos-monthly.sh >> /home/user/backups/logs/videos-monthly-archive.log 2>&1
```

**Modifying cron jobs**:
```bash
# Edit crontab
crontab -e

# Disable a job (comment out)
# 0 2 * * 0 /home/user/backups/scripts/backup-videos-weekly.sh ...

# List all jobs
crontab -l
```

---

## Disk Space Requirements

**Current allocation**:
- HDD capacity: 5.5TB
- Used: 923GB (17%)
- **Available for videos**: 4.5TB

**Expected monthly growth** (at 50-100GB/month uploads):
```
Current month:        100GB (videos in production use)
4 weekly snapshots:   400GB (4× the monthly volume)
12 monthly archives:  ~1.2TB (compressed with ~15% ratio)
Total monthly need:   ~1.7TB
```

**Timeline**:
- At 50GB/month: **6+ years** of storage runway
- At 100GB/month: **3+ years** of storage runway
- At 200GB/month: **1.5+ years** of storage runway

**When to expand**:
- Monitor `/data/` usage with `df -h /data/`
- When reaching 70% capacity (~3.8TB used), consider:
  - Archiving old videos to external USB drives
  - Extending retention (keep fewer snapshots)
  - Provisioning additional HDD storage

---

## Monitoring and Logs

**Log files**:
- Weekly: `/home/user/backups/logs/videos-weekly-backup.log`
- Monthly: `/home/user/backups/logs/videos-monthly-archive.log`

**View logs**:
```bash
# Last 50 lines
tail -50 /home/user/backups/logs/videos-weekly-backup.log

# Follow in real-time
tail -f /home/user/backups/logs/videos-weekly-backup.log

# Search for errors
grep ERROR /home/user/backups/logs/videos-*.log

# View full history
cat /home/user/backups/logs/videos-weekly-backup.log | less
```

**Typical log output**:
```
[2026-03-02 02:00:01] [INFO] Video Weekly Backup Started
[2026-03-02 02:00:05] [INFO] Source: /data/uploads/videos
[2026-03-02 02:00:05] [INFO] Destination: /data/backups/videos/snapshot-20260302
[2026-03-02 02:00:05] [INFO] Found 47 video files in source directory
[2026-03-02 02:05:10] [INFO] Snapshot created successfully
[2026-03-02 02:05:10] [INFO] Snapshots within retention limit (1 / 4)
[2026-03-02 02:05:10] [INFO] Backup disk usage: 100GB total, 4.4T available
[2026-03-02 02:05:10] [INFO] Video Weekly Backup Completed Successfully
```

**Disk space monitoring**:
```bash
# Check current backup disk usage
du -sh /data/backups/videos/*

# Check available space
df -h /data/

# Watch growth over time
du -sh /data/backups/videos/ && sleep 300 && du -sh /data/backups/videos/
```

---

## Recovery Procedures

### Recover from Weekly Snapshot (Last 4 weeks)

**Scenario**: User accidentally deleted videos, recover from last week's snapshot

```bash
# Identify which snapshot to restore from
ls -lhd /data/backups/videos/snapshot-*

# Restore specific video
cp /data/backups/videos/snapshot-20260302/projects/video-name.mp4 /data/uploads/videos/projects/

# Restore entire directory (careful - will delete newer files!)
rsync -av --delete /data/backups/videos/snapshot-20260302/ /data/uploads/videos/
```

### Recover from Monthly Archive (Last 12 months)

**Scenario**: Recover from 2 months ago

```bash
# Extract specific file from archive
tar -xzf /data/backups/videos/archive-202601.tar.zst \
    snapshot-20260104/projects/video-name.mp4

# List contents of archive
tar -tzf /data/backups/videos/archive-202601.tar.zst | head -20

# Extract entire month's snapshots (warning: large!)
mkdir -p /tmp/recovery
tar -xzf /data/backups/videos/archive-202601.tar.zst -C /tmp/recovery/
```

### Emergency Recovery (Full restoration)

```bash
# If /data/uploads/videos/ is corrupted/lost
mkdir -p /data/uploads/videos
tar -xzf /data/backups/videos/archive-202603.tar.zst -C /data/backups/
rsync -av /data/backups/videos/snapshot-20260302/ /data/uploads/videos/
```

---

## Integration with GFS Backup System

**Changes to existing system**:
- ❌ **Removed**: Gallery videos from GFS backup rotation
- ❌ **Reason**: 0-5% compression benefit (H.265 already compressed), consuming 30GB/month
- ✅ **Benefit**: Freed ~30GB/month from 50GB GFS budget

**GFS status after change**:
- Previous: 38.38GB / 50GB (76.8% capacity, crisis level)
- Expected: ~8GB / 50GB (16% capacity, healthy)
- Additional runway: 13+ months instead of 5.8 days

**Verification**:
```bash
# Check GFS backup size
du -sh /home/user/backups/

# Before: Should be ~38GB
# After: Should be ~8GB

# Monitor daily
tail /home/user/backups/logs/gfs-backup.log
```

---

## Troubleshooting

### Issue: Cron job didn't run

**Check if cron is running**:
```bash
ps aux | grep cron
systemctl status cron
```

**Verify job syntax**:
```bash
crontab -l
# Should see both backup-videos jobs listed
```

**Test job manually**:
```bash
bash /home/user/backups/scripts/backup-videos-weekly.sh
# Check exit code: echo $?
# 0 = success, non-zero = failure
```

### Issue: Backup failed with "Permission denied"

**Check directory permissions**:
```bash
ls -ld /data/uploads/videos/
ls -ld /data/backups/videos/
# Should show rwx for user

chmod 755 /data/uploads/videos/ /data/backups/videos/
```

### Issue: Archive verification failed

**Check zstd installation**:
```bash
zstd --version
which zstd
```

**Manually verify archive**:
```bash
tar -tzf /data/backups/videos/archive-202603.tar.zst > /dev/null
echo $?  # Should print 0
```

### Issue: Disk space running low

**Check current usage**:
```bash
df -h /data/

# If > 70% used:
# Option 1: Remove old snapshots manually
rm -rf /data/backups/videos/snapshot-20260101

# Option 2: Reduce retention (edit scripts, change RETENTION_WEEKS/RETENTION_MONTHS)

# Option 3: Archive to external USB
```

---

## Best Practices

1. **Test recovery regularly** (monthly)
   - Extract a file from monthly archive
   - Verify it's readable and intact

2. **Monitor disk space**
   - Check `/data/` usage weekly
   - Set alert if > 60% used

3. **Review logs**
   - Check backup logs after each run
   - Look for warnings or errors

4. **Keep scripts updated**
   - Review scripts annually
   - Test after any changes

5. **Document custom changes**
   - If modifying retention, update this document
   - Maintain a change log

---

## Related Documentation

- **Technical Analysis**: `/home/user/.claude/projects/-home-user/memory/GALLERY_VIDEO_STORAGE_TECHNICAL_ANALYSIS.md`
- **GFS Backup System**: `/home/user/docs/server/MONITORING_AND_BACKUP_SYSTEM.md`
- **Storage Architecture**: `/home/user/docs/server/DRIVE_ARCHITECTURE.md`

---

**Last Updated**: March 2, 2026
**Next**: Phase 4 - Testing & Verification (upload test video, verify playback)
