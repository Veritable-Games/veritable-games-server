# /var Drive Hardware Failure - Incident Report

**Date**: November 27, 2025, 01:40 UTC
**Severity**: 🚨 CRITICAL - Hardware Failure
**Status**: ACTIVE - Drive currently failing
**Impact**: Production services down

---

## Executive Summary

The Samsung SSD 850 (/dev/sda) mounted at `/var` is experiencing catastrophic hardware failure. The drive is currently mounted but experiencing widespread I/O errors preventing Docker, PostgreSQL, and other critical services from operating.

**✅ CRITICAL DATA IS SAFE**: Database backups exist on healthy drive (/dev/sdb2)
**⚠️ SERVICE IMPACT**: Production services are down
**❌ DATA LOSS WINDOW**: ~24 hours of database changes since last backup

---

## Technical Details

### Failed Hardware

**Drive**: Samsung SSD 850
**Device**: `/dev/sda`
**Mount Point**: `/var`
**Partition Size**: 938GB
**Used Space**: 79GB (9%)
**UUID**: `9a3fc94d-007e-4ae8-aabf-9088ba33d57b`

### Failure Indicators

```
1. Drive Size Reported as 0
   - System cannot determine drive capacity
   - `hdparm -I /dev/sda` returns no data

2. SCSI Target Failure
   - Error: DID_BAD_TARGET (drive not responding)
   - Read Capacity(16) failed
   - Read Capacity(10) failed

3. Filesystem I/O Errors
   - EXT4 superblock write failures
   - Journal aborted
   - Directory block read errors (-5)
   - Buffer I/O errors across multiple logical blocks

4. Specific Error Sectors
   - Sector 1895891224
   - Sector 1895891200
   - Sector 190086983-190086985
   - Sector 1120215720
   - Many others
```

### Timeline

```
[Boot Time]        Drive mounted successfully
[~5 hours ago]     Mass write failures began
                   - Tag#30, Tag#0, Tag#5, Tag#10, Tag#14 failures
                   - Journal aborted
                   - Superblock I/O errors
[30 minutes ago]   Docker attempted restart - failed
[15 minutes ago]   Phase 1 script execution attempted - blocked
[Now]              Drive mounted but unreadable/unwritable
```

---

## Impact Assessment

### 🚨 Services Affected

**Docker Daemon**
- Status: DOWN
- Cause: Cannot read `/var/lib/docker/volumes/`
- Effect: All containers stopped

**PostgreSQL Database**
- Container: `veritable-games-postgres`
- Status: INACCESSIBLE (container not running)
- Data Location: `/var/lib/docker/volumes/` (unreadable)
- Effect: All database operations blocked

**Veritable Games Application**
- Container: `m4s0kwo4kc4oooocck4sswc4`
- Status: DOWN (Docker not running)
- URL: https://www.veritablegames.com - OFFLINE

**BTCPayServer**
- Status: LIKELY DOWN (Docker-based)

**Coolify**
- Status: DEGRADED
- Can access web UI but cannot manage containers

**systemd-journald**
- Status: DEGRADED
- Cannot rotate logs to `/var/log/journal/`

**Library PDF Reconversion Workflow**
- Phase 1 Scripts: BLOCKED (need database access)
- Phase 2-6: NOT STARTED

### ✅ Data Safety Status

**SAFE - On /dev/sdb2 (477GB SSD, healthy)**
```
/home/user/backups/postgres-daily-20251126-020001.sql.gz    169MB  ✅
/home/user/backups/postgres-daily-20251125-020001.sql.gz    169MB  ✅
/home/user/backups/postgres-daily-20251124-020001.sql.gz    181MB  ✅
/home/user/backups/pre-migration-20251126-212608.sql.gz     169MB  ✅
/home/user/backups/postgres-pre-category-removal-*.sql      503MB  ✅

/home/user/projects/veritable-games/                        ALL ✅
/home/user/docs/                                            ALL ✅
/home/user/repository/                                      ALL ✅
/home/user/archives/                                        ALL ✅
```

**SAFE - Recently backed up to /data (5.5TB HDD, healthy)**
```
/data/projects/DODEC/        535.7GB  ✅ (rsync completed 01:40)
/data/projects/SITE/         [size]   ✅ (rsync in progress)
/data/projects/REFERENCES/   [size]   ✅ (rsync in progress)
/data/projects/ENACT/        [size]   ✅ (rsync in progress)
/data/projects/NOXII/        [size]   ✅ (rsync in progress)
```

**AT RISK - On /dev/sda (/var, FAILING)**
```
/var/lib/docker/volumes/     [size]   🚨 UNREADABLE
└── PostgreSQL live data              🚨 CURRENT STATE LOST

Docker images                [size]   🚨 MAY BE LOST
Docker container states      [size]   🚨 MAY BE LOST
/var/log/journal/            [size]   🚨 INCOMPLETE
/var/cache/                  [size]   ⚠️  Replaceable
/var/tmp/                    [size]   ⚠️  Temporary
```

---

## Data Loss Assessment

### Database Changes (Last 24 Hours)

**Last Successful Backup**: November 26, 2025 at 02:00 AM
**Current Time**: November 27, 2025 at 01:40 AM
**Data Loss Window**: ~23.5 hours

**Potential Lost Data**:
- User registrations (if any)
- New documents imported (if any)
- Tag associations created (if any)
- Forum posts (if any)
- Wiki edits (if any)
- Library document modifications

**Assessment**: Loss window is significant but may have minimal impact depending on site activity in the past 24 hours. Veritable Games is in early deployment phase.

### Application State

**Lost**:
- Docker container runtime states
- Temporary files in `/var/tmp/`
- System logs from past 5 hours (when failures began)

**Recoverable**:
- All application code (git repository on /dev/sdb2)
- Database structure and content (from backups)
- Environment variables (stored in Coolify DB)
- Docker images (can be rebuilt/pulled)

---

## Recovery Options

### Option 1: Emergency Read-Only Recovery (RECOMMENDED FIRST STEP)

**Goal**: Attempt to read PostgreSQL data before complete drive failure

**Risk**: LOW - Read-only operations won't damage data
**Time**: 30 minutes
**Success Probability**: 20-30% (drive may be too far gone)

**Steps**:
```bash
# 1. Remount /var as read-only (prevent further damage)
sudo mount -o remount,ro /var

# 2. Try to access Docker volume directory
sudo ls /var/lib/docker/volumes/

# 3. If readable, identify PostgreSQL volume
sudo find /var/lib/docker/volumes -name "pg_data" -o -name "*postgres*"

# 4. If found, attempt emergency backup
sudo tar czf /home/user/backups/emergency-postgres-$(date +%Y%m%d-%H%M%S).tar.gz \
  /var/lib/docker/volumes/[postgres-volume-name]/

# 5. If successful, compare with Nov 26 backup
```

**Outcome**:
- ✅ SUCCESS: Recover database state from past 24 hours
- ❌ FAILURE: Proceed to Option 2

### Option 2: Restore from Nov 26 Backup (FASTEST)

**Goal**: Get services back online with 24-hour data loss

**Risk**: LOW - Backups are on healthy drive
**Time**: 1-2 hours
**Success Probability**: 95%

**Steps**:
```bash
# 1. Replace or repair /var drive (see Hardware Options below)

# 2. Restore Docker setup
sudo systemctl start docker

# 3. Recreate PostgreSQL container (use existing docker-compose.yml)
cd /home/user/projects/veritable-games/resources
docker-compose up -d

# 4. Restore database from backup
gunzip -c /home/user/backups/postgres-daily-20251126-020001.sql.gz | \
  docker exec -i veritable-games-postgres psql -U postgres

# 5. Verify restoration
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM library.library_documents;"

# 6. Restart application container via Coolify
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

**Data Impact**:
- ✅ All data through Nov 26 02:00 AM
- ❌ Lost: Changes from past 24 hours

### Option 3: Drive Repair Attempt (NOT RECOMMENDED)

**Goal**: Repair filesystem corruption with fsck

**Risk**: VERY HIGH - May cause total data loss
**Time**: 2-4 hours
**Success Probability**: 10-15% (hardware failure, not just filesystem)

**Why Not Recommended**:
- Error pattern indicates hardware failure (DID_BAD_TARGET)
- Drive not responding to capacity queries
- Filesystem repairs won't fix failing hardware
- May corrupt readable data during repair attempt

**Only attempt if**:
- Option 1 emergency recovery failed
- Past 24 hours of data is mission-critical
- You accept risk of total data loss

---

## Hardware Replacement Options

### Option A: Temporary - Move /var to /data

**Pros**:
- Immediate solution (30 minutes)
- Uses existing healthy 5.5TB drive
- No new hardware required

**Cons**:
- /data is HDD, slower than SSD
- Docker performance degradation
- Single point of failure

**Steps**:
```bash
# 1. Stop all services
sudo systemctl stop docker

# 2. Create /data/var directory
sudo mkdir -p /data/var

# 3. Update /etc/fstab
# Comment out old /var mount
# Add: /data/var    /var    none    bind    0 0

# 4. Reboot and verify
sudo reboot
mount | grep /var

# 5. Restore Docker and database
```

### Option B: Permanent - Replace Samsung SSD 850

**Pros**:
- Proper long-term solution
- Restore original performance
- Separate drive for /var (isolation)

**Cons**:
- Requires new SSD purchase
- Downtime during replacement
- Physical access to server

**Recommended Drive**:
- Size: 1TB SSD (overkill, but future-proof)
- Type: NVMe M.2 or SATA SSD
- Examples: Samsung 870 EVO, Crucial MX500, WD Blue

**Steps**:
```bash
# 1. Purchase replacement SSD

# 2. Install new drive physically

# 3. Format and partition
sudo mkfs.ext4 /dev/sdX
sudo blkid /dev/sdX  # Get UUID

# 4. Update /etc/fstab with new UUID

# 5. Mount and restore
sudo mount /dev/sdX /var
# Restore Docker and database (see Option 2)
```

### Option C: Cloud Migration (LONG-TERM)

**Pros**:
- No hardware maintenance
- Automatic backups
- Scalability

**Cons**:
- Monthly costs
- Migration complexity
- Dependency on provider

**Not immediate solution** - consider after stabilizing current setup

---

## Immediate Action Plan (RECOMMENDED)

### 1. Emergency Assessment (5 minutes)

```bash
# Check if any data is still readable
sudo mount -o remount,ro /var
sudo ls -la /var/lib/docker/volumes/ 2>&1 | tee emergency-check.log
```

**Decision Point**:
- If readable: Proceed to step 2
- If unreadable: Skip to step 3

### 2. Emergency Data Recovery (15-30 minutes)

**ONLY IF STEP 1 SUCCEEDED**

```bash
# Try to backup Docker volumes
sudo rsync -avh /var/lib/docker/volumes/ \
  /home/user/backups/emergency-docker-volumes-$(date +%Y%m%d-%H%M%S)/ \
  --log-file=/home/user/backups/emergency-rsync.log

# Monitor progress
tail -f /home/user/backups/emergency-rsync.log
```

**If this works**: You'll recover the current database state

**If this fails**: Accept 24-hour data loss and proceed

### 3. Temporary Recovery (1 hour)

**Option**: Move /var to /data (Option A above)

```bash
# Stop Docker
sudo systemctl stop docker

# Backup /etc/fstab
sudo cp /etc/fstab /etc/fstab.backup-$(date +%Y%m%d-%H%M%S)

# Create new /var location
sudo mkdir -p /data/var
sudo chmod 755 /data/var

# Update fstab
# (Edit /etc/fstab as described in Option A)

# Reboot
sudo reboot

# After reboot:
sudo systemctl start docker
cd /home/user/projects/veritable-games/resources
docker-compose up -d

# Restore database
gunzip -c /home/user/backups/postgres-daily-20251126-020001.sql.gz | \
  docker exec -i veritable-games-postgres psql -U postgres

# Verify
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM library.library_documents WHERE created_by = 3;"
# Should return: 4,449 documents
```

### 4. Service Verification (15 minutes)

```bash
# Check Docker
docker ps -a

# Check PostgreSQL
docker exec veritable-games-postgres psql -U postgres -c "SELECT version();"

# Check database content
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT schemaname, COUNT(*) FROM pg_tables WHERE schemaname IN ('library', 'anarchist', 'shared') GROUP BY schemaname;"

# Restart application
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4

# Wait 2-5 minutes, then check
curl -I https://www.veritablegames.com
```

### 5. Documentation & Planning (30 minutes)

- Document exactly what happened
- Create timeline of events
- Plan permanent fix (SSD replacement)
- Update backup procedures
- Consider additional monitoring

---

## Prevention & Monitoring

### Enhanced Backup Strategy

**Daily Database Backups**: ✅ Already implemented (02:00 AM daily)

**Add**:
```bash
# Hourly incremental backups during active development
0 * * * * docker exec veritable-games-postgres pg_dump -U postgres veritable_games | gzip > /home/user/backups/hourly/postgres-$(date +\%Y\%m\%d-\%H00).sql.gz

# Keep only last 24 hours
0 0 * * * find /home/user/backups/hourly -name "*.sql.gz" -mtime +1 -delete

# Weekly full server backup to external location
0 3 * * 0 rsync -avh /home/user/ external-backup-location/
```

### Drive Health Monitoring

**Install smartmontools monitoring** (if drive database accessible):
```bash
# Add to crontab:
0 6 * * * smartctl -H /dev/sdb2 | grep -v "PASSED" && echo "SSD WARNING" | mail -s "Drive Health Alert" user@example.com
```

**Monitor disk space**:
```bash
# Already exists in /home/user/backups/scripts/
# Ensure it's running via cron
```

### Database Backup Verification

**Add verification step**:
```bash
# Test restore weekly
0 4 * * 1 /home/user/backups/scripts/test-backup-restore.sh
```

Create `/home/user/backups/scripts/test-backup-restore.sh`:
```bash
#!/bin/bash
# Test database backup restoration

BACKUP="/home/user/backups/postgres-daily-$(date +%Y%m%d)-020001.sql.gz"
TEST_DB="veritable_games_test"

# Create test database
docker exec veritable-games-postgres psql -U postgres -c "DROP DATABASE IF EXISTS $TEST_DB;"
docker exec veritable-games-postgres psql -U postgres -c "CREATE DATABASE $TEST_DB;"

# Restore backup
gunzip -c "$BACKUP" | docker exec -i veritable-games-postgres psql -U postgres -d $TEST_DB

# Verify
RESULT=$(docker exec veritable-games-postgres psql -U postgres -d $TEST_DB -t -c "SELECT COUNT(*) FROM library.library_documents;")

if [ "$RESULT" -gt 4000 ]; then
    echo "✅ Backup restoration test PASSED: $RESULT documents"
else
    echo "❌ Backup restoration test FAILED: Only $RESULT documents"
    exit 1
fi

# Cleanup
docker exec veritable-games-postgres psql -U postgres -c "DROP DATABASE $TEST_DB;"
```

---

## Lessons Learned

### What Went Right ✅

1. **Automated daily backups**: Saved from complete data loss
2. **Dual-drive architecture**: User data isolated on healthy drive
3. **Project backup synchronization**: Someone anticipated this and started rsync
4. **Quick detection**: Issue found before complete drive failure

### What Needs Improvement ⚠️

1. **SMART monitoring**: No proactive drive health alerts
2. **Backup frequency**: 24-hour window is too large for production
3. **No real-time replication**: Single point of failure
4. **Drive age**: Samsung 850 SSD is aging (released 2014)

### Recommended Improvements

1. **Hourly backups** during active development
2. **SMART monitoring** with email alerts
3. **Weekly backup testing** (verify restores work)
4. **Hardware replacement schedule** (replace SSDs every 5 years)
5. **Monitoring dashboard** for drive health, disk space, service status
6. **Documented recovery procedures** (this document is a start)

---

## Recovery Checklist

### Pre-Recovery Verification
- [ ] Confirm backup exists: `/home/user/backups/postgres-daily-20251126-020001.sql.gz`
- [ ] Verify backup integrity: `gunzip -t backup.sql.gz`
- [ ] Check available disk space on /data: `df -h /data`
- [ ] Document current state: `dmesg > /home/user/pre-recovery-dmesg.log`
- [ ] Create recovery log: `script -a /home/user/recovery-log-$(date +%Y%m%d-%H%M%S).txt`

### Recovery Execution
- [ ] Attempt emergency read-only recovery (Option 1)
- [ ] If failed, proceed to temporary /var relocation (Option A)
- [ ] Update /etc/fstab
- [ ] Reboot server
- [ ] Verify /var mount: `mount | grep /var`
- [ ] Start Docker: `sudo systemctl start docker`
- [ ] Create PostgreSQL container: `docker-compose up -d`
- [ ] Restore database from backup
- [ ] Verify table counts match expected values
- [ ] Restart application via Coolify
- [ ] Test website functionality

### Post-Recovery Validation
- [ ] Verify website loads: `curl -I https://www.veritablegames.com`
- [ ] Check database queries work
- [ ] Verify user can log in
- [ ] Test document search
- [ ] Check tag system
- [ ] Review error logs
- [ ] Document data loss (if any)
- [ ] Notify stakeholders

### Permanent Fix Planning
- [ ] Order replacement SSD
- [ ] Schedule maintenance window
- [ ] Plan drive replacement procedure
- [ ] Update documentation
- [ ] Implement enhanced monitoring
- [ ] Schedule backup verification tests

---

## Contact Information

**Server**: veritable-games-server (192.168.1.15)
**Location**: `/home/user/`
**Report Date**: November 27, 2025
**Report Author**: Claude Code

**Related Documentation**:
- `/home/user/CLAUDE.md` - Server operations guide
- `/home/user/docs/server/DRIVE_ARCHITECTURE.md` - Drive configuration
- `/home/user/docs/server/CONTAINER_PROTECTION_AND_RECOVERY.md` - Container recovery
- `/etc/fstab` - Filesystem mount configuration

---

## Appendix: Error Log Samples

### Kernel Messages (dmesg)
```
[18270.514950] EXT4-fs warning (device sda): ext4_end_bio:342: I/O error 10 writing to inode 59244734 starting block 6938634)
[18270.514957] Buffer I/O error on device sda, logical block 190086983
[18270.515904] sd 1:0:0:0: [sda] Read Capacity(16) failed: Result: hostbyte=DID_BAD_TARGET driverbyte=DRIVER_OK
[18270.517853] JBD2: I/O error when updating journal superblock for sda-8.
[18270.532595] Buffer I/O error on dev sda, logical block 0, lost sync page write
[18270.533495] EXT4-fs (sda): I/O error while writing superblock
```

### Drive Information
```
Model: Samsung SSD 850
Device: /dev/sda
Size: 0 (FAILED - should be ~1TB)
UUID: 9a3fc94d-007e-4ae8-aabf-9088ba33d57b
Mount: /var (mounted but degraded)
```

### Docker Failure
```
chmod /var/lib/docker: input/output error
Cannot start Docker daemon
```

---

**END OF REPORT**
