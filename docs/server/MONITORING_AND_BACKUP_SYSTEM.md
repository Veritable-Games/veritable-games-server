# Server Monitoring and Backup System
**Created**: November 22, 2025
**Updated**: February 14, 2026
**Server**: veritable-games-server (192.168.1.15)
**Purpose**: Prevent future disk failures and ensure data safety

---

## 🎯 Overview

After the disk failure incident on November 22, 2025, we implemented a comprehensive monitoring and backup system. **Updated February 2026** with GFS (Grandfather-Father-Son) backup strategy on HDD storage.

### What's Installed

1. **SMART Monitoring** - Detects disk health issues before failure
2. **GFS PostgreSQL Backups** - Hourly/daily/weekly/monthly/yearly retention (50GB budget)
3. **Docker Volume Backups** - Daily/weekly retention for gallery, uploads, libraries
4. **Disk Usage Monitoring** - Every 6 hours with alerts at 80% usage
5. **Comprehensive Health Checks** - Every 30 minutes, full system status
6. **BTCPay Backups** - Daily at 3 AM

---

## 📊 Monitoring System

### 1. SMART Disk Health Monitoring

**Service**: `smartmontools.service`
**Status**: `systemctl status smartmontools`
**Checks**: Runs automatically every 30 minutes

**What it monitors**:
- Disk health status (PASSED/FAILED)
- Reallocated sectors (bad blocks)
- Pending sectors (about to fail)
- Power-on hours (disk age)
- Temperature

**Check disk health manually**:
```bash
# Quick health check
sudo smartctl -H /dev/sda
sudo smartctl -H /dev/sdb

# Detailed SMART data
sudo smartctl -a /dev/sda
sudo smartctl -a /dev/sdb

# Run long test (takes ~1 hour)
sudo smartctl -t long /dev/sda
```

**Current Disk Info**:
- `/dev/sda`: Samsung SSD 850 PRO 1TB (24,609 power-on hours, ~2.8 years)
- `/dev/sdb`: Samsung SSD 850 PRO 512GB

---

### 2. GFS PostgreSQL Backups (February 2026)

**Location**: `/data/backups/` (HDD - 5.5TB drive)
**Symlink**: `/home/user/backups` → `/data/backups/`
**Strategy**: Grandfather-Father-Son (GFS)
**Storage Budget**: 50GB max, 40GB alert threshold

#### Retention Tiers

| Tier | Location | Retention | Schedule |
|------|----------|-----------|----------|
| Hourly | `hourly/` | 24 backups | Every hour |
| Daily | `daily/` | 7 days | Midnight |
| Weekly | `weekly/` | 4 weeks | Sunday midnight |
| Monthly | `monthly/` | 12 months | 1st of month |
| Yearly | `yearly/` | 3 years | January 1st |

#### Scripts

| Script | Purpose | Schedule |
|--------|---------|----------|
| `gfs-postgres-backup.sh` | PostgreSQL GFS backups | Hourly |
| `gfs-volume-backup.sh` | Docker volume backups | Daily 4 AM |
| `backup-monitor.sh` | Storage monitoring | Daily 6 AM |
| `backup-btcpay.sh` | BTCPay Server backups | Daily 3 AM |

**Manual backup**:
```bash
# Run GFS backup manually
/data/backups/scripts/gfs-postgres-backup.sh

# Check backup log
tail -50 /data/backups/logs/gfs-backup.log

# List recent hourly backups
ls -lh /data/backups/hourly/ | tail -5

# Check storage usage
/data/backups/scripts/backup-monitor.sh
```

**Restore from backup**:
```bash
# Stop application container first
docker stop m4s0kwo4kc4oooocck4sswc4

# Restore from most recent hourly
gunzip < /data/backups/hourly/postgres-hourly-YYYYMMDD-HHMM.sql.gz | \
  docker exec -i veritable-games-postgres psql -U postgres

# Or restore from daily/weekly/monthly as needed
gunzip < /data/backups/daily/postgres-daily-YYYYMMDD.sql.gz | \
  docker exec -i veritable-games-postgres psql -U postgres

# Restart application
docker start m4s0kwo4kc4oooocck4sswc4
```

**Current storage**: ~8.8GB / 50GB budget (18%)

---

### 3. Docker Volume Backups

**Script**: `/data/backups/scripts/gfs-volume-backup.sh`
**Schedule**: Daily at 4 AM
**Retention**: 7 days daily, 4 weeks weekly

**Volumes backed up**:
- `gallery` - Image uploads (~959MB)
- `uploads` - User uploads (~724KB)
- `anarchist-lib` - Anarchist library data (~421MB)

**Location**: `/data/backups/volumes/`

**Manual backup**:
```bash
/data/backups/scripts/gfs-volume-backup.sh
tail -20 /data/backups/logs/volume-backup.log
```

---

### 4. Disk Usage Monitoring

**Script**: `/data/backups/scripts/disk-usage-monitor.sh`
**Schedule**: Every 6 hours
**Alert threshold**: 80% usage
**Monitors**: `/`, `/var`, `/data` partitions

**Manual check**:
```bash
# Run monitor manually
/data/backups/scripts/disk-usage-monitor.sh

# Check logs
tail -20 /data/backups/logs/disk-monitor.log

# View disk usage
df -h
```

**Current architecture** (December 2025):
- `/` (sdb): SSD - User data, Docker
- `/data` (sda): HDD 5.5TB - Backups, archives, large files

**If backup storage exceeds budget**:
1. GFS script auto-cleans oldest backups
2. Emergency cleanup triggers at 50GB
3. Check: `/data/backups/scripts/backup-monitor.sh`

---

### 4. Temperature Monitoring

**Tool**: `lm-sensors`
**Check manually**: `sensors`
**Included in**: Health check script (every 30 minutes)

**Safe temperature ranges**:
- **CPU**: < 70°C (normal), 70-85°C (warm), > 85°C (critical)
- **Disks**: < 50°C (normal), 50-60°C (warm), > 60°C (critical)

**Current temperatures**:
- CPU (Ryzen 9 5900X): ~46-54°C
- Disk /dev/sda: ~22-24°C
- Disk /dev/sdb: ~19°C

**Check temperatures**:
```bash
# All sensors
sensors

# CPU only
sensors | grep "Tctl"

# Disk temps
sudo smartctl -A /dev/sda | grep Temperature
sudo smartctl -A /dev/sdb | grep Temperature
```

---

### 5. Comprehensive Health Checks

**Script**: `/home/user/backups/system-health-check.sh`
**Schedule**: Every 30 minutes
**Log**: `/home/user/backups/health-check.log`

**What it checks**:
- ✓ SMART health status (both disks)
- ✓ Disk temperatures
- ✓ CPU temperature
- ✓ Disk usage (/ and /var)
- ✓ Docker status (running + container count)
- ✓ PostgreSQL accessibility (+ document count)

**Run manual health check**:
```bash
# Run full health check
/home/user/backups/system-health-check.sh

# View recent checks
tail -50 /home/user/backups/health-check.log

# View latest check
tail -20 /home/user/backups/health-check.log
```

**Example output**:
```
========================================
[2025-11-22 19:51:13] System Health Check
========================================

DISK HEALTH (SMART):
[2025-11-22 19:51:13] ✓ /dev/sda: PASSED
[2025-11-22 19:51:13] ✓ /dev/sdb: PASSED

DISK TEMPERATURES:
[2025-11-22 19:51:13] ✓ /dev/sda: 22°C
[2025-11-22 19:51:13] ✓ /dev/sdb: 19°C

CPU TEMPERATURE:
[2025-11-22 19:51:13] ✓ CPU: 54.0°C

DISK USAGE:
[2025-11-22 19:51:13] ✓ /: 28% used (320G free)
[2025-11-22 19:51:13] ✓ /var: 82% used (164G free)

DOCKER STATUS:
[2025-11-22 19:51:13] ✓ Docker running (18 containers)

DATABASE:
[2025-11-22 19:51:13] ✓ PostgreSQL accessible (4678 published docs)
```

---

## ⏰ Automated Schedule

All monitoring runs automatically via cron:

```crontab
# Auto-deploy (existing)
* * * * * /home/user/scripts/auto-deploy.sh

# GFS PostgreSQL backup (hourly - handles all retention tiers)
0 * * * * /bin/bash /data/backups/scripts/gfs-postgres-backup.sh

# GFS Volume backup (daily at 4 AM)
0 4 * * * /bin/bash /data/backups/scripts/gfs-volume-backup.sh

# Backup storage monitor (daily at 6 AM)
0 6 * * * /bin/bash /data/backups/scripts/backup-monitor.sh

# BTCPay backup (daily at 3 AM)
0 3 * * * /bin/bash /home/user/backups/scripts/backup-btcpay.sh >> /data/backups/logs/btcpay.log 2>&1

# Disk usage monitor (every 6 hours)
0 */6 * * * /bin/bash /home/user/backups/scripts/disk-usage-monitor.sh >> /data/backups/logs/disk-monitor.log 2>&1

# System health check (every 30 minutes)
*/30 * * * * /bin/bash /home/user/backups/scripts/system-health-check.sh >> /data/backups/logs/health-check.log 2>&1
```

**View cron jobs**:
```bash
crontab -l
```

**Edit cron jobs**:
```bash
crontab -e
```

---

## 🚨 Alert System

### Current Alerts

**Disk Usage**: Logs warning if `/` or `/var` exceed 90%
**SMART Health**: Logs warning if disk health != PASSED
**Temperature**: Logs warning if CPU > 70°C or disk > 50°C
**Docker**: Logs warning if Docker is not running
**Database**: Logs warning if PostgreSQL not accessible

### Where to Check

All alerts are logged to:
- `/home/user/backups/backup.log` - Backup script results
- `/home/user/backups/disk-monitor.log` - Disk usage warnings
- `/home/user/backups/health-check.log` - Full health status

**Check for warnings**:
```bash
# Search all logs for warnings
grep -i "warning\|failed\|critical\|hot" /home/user/backups/*.log

# Check last hour
find /home/user/backups/ -name "*.log" -exec grep "$(date '+%Y-%m-%d %H:')" {} \;
```

---

## 📁 File Locations

### Scripts (on HDD)
```
/data/backups/scripts/gfs-postgres-backup.sh  - GFS PostgreSQL backup (all tiers)
/data/backups/scripts/gfs-volume-backup.sh    - Docker volume backups
/data/backups/scripts/backup-monitor.sh       - Storage monitoring
/data/backups/scripts/backup-btcpay.sh        - BTCPay backups
/data/backups/scripts/disk-usage-monitor.sh   - Disk usage check
/data/backups/scripts/system-health-check.sh  - Full health check
```

### Logs
```
/data/backups/logs/gfs-backup.log      - GFS PostgreSQL backup log
/data/backups/logs/volume-backup.log   - Volume backup log
/data/backups/logs/monitor.log         - Storage monitor reports
/data/backups/logs/btcpay.log          - BTCPay backup log
/data/backups/logs/disk-monitor.log    - Disk usage alerts
/data/backups/logs/health-check.log    - Health check history
```

### Backups (GFS on HDD)
```
/data/backups/hourly/   - Last 24 hourly backups
/data/backups/daily/    - Last 7 daily backups
/data/backups/weekly/   - Last 4 weekly backups
/data/backups/monthly/  - Last 12 monthly backups
/data/backups/yearly/   - Last 3 yearly backups
/data/backups/volumes/  - Docker volume backups
/data/backups/btcpay/   - BTCPay Server backups
/data/backups/legacy/   - Pre-migration backups (DO NOT DELETE)
```

### Symlink
```
/home/user/backups → /data/backups/  (unified access)
```

---

## 🛠️ Maintenance Tasks

### Weekly

**Check health logs for warnings**:
```bash
# Review last week
grep -A 2 "⚠" /home/user/backups/health-check.log | tail -50
```

**Verify backups exist**:
```bash
# Check last 7 days
ls -lh /home/user/backups/postgres-daily-*.gz | tail -7
```

**Check SMART long test**:
```bash
# Run long test (takes ~1 hour)
sudo smartctl -t long /dev/sda
sudo smartctl -t long /dev/sdb

# Check results later
sudo smartctl -a /dev/sda | grep -A 10 "test result"
```

### Monthly

**Test backup restoration**:
```bash
# Create test database
docker exec -i veritable-games-postgres createdb -U postgres test_restore

# Restore to test database
gunzip < /home/user/backups/postgres-daily-20251122-194904.sql.gz | \
  docker exec -i veritable-games-postgres psql -U postgres test_restore

# Verify data
docker exec veritable-games-postgres psql -U postgres test_restore \
  -c "SELECT COUNT(*) FROM library.library_documents;"

# Drop test database
docker exec veritable-games-postgres dropdb -U postgres test_restore
```

**Review disk growth**:
```bash
# Check /var growth trend
du -sh /var/lib/docker/
du -sh /var/log/
```

**Clean old backups manually** (if needed):
```bash
# List backups older than 30 days
find /home/user/backups/ -name "postgres-daily-*.sql.gz" -mtime +30

# Delete if desired (automatic cleanup is enabled)
find /home/user/backups/ -name "postgres-daily-*.sql.gz" -mtime +30 -delete
```

### After Any Disk Warnings

**If SMART health shows warnings**:
```bash
# Get detailed SMART data
sudo smartctl -a /dev/sda

# Look for:
# - Reallocated_Sector_Ct > 0 (bad blocks)
# - Current_Pending_Sector > 0 (sectors about to fail)
# - Offline_Uncorrectable > 0 (unreadable sectors)

# If any are > 0: Plan disk replacement immediately
```

**If disk usage > 90%**:
```bash
# Find large directories
du -h /var/lib/docker/ | sort -rh | head -20
du -h /var/log/ | sort -rh | head -10

# Clean Docker
docker system prune -a
docker volume prune
```

**If temperature > 70°C (CPU) or > 50°C (disk)**:
```bash
# Check for dust/airflow issues
# Check case fans are running
# Consider adding cooling
```

---

## 🔄 Recovery Procedures

### If Disk Fails Again

1. **Check health status**:
   ```bash
   sudo smartctl -H /dev/sda
   cat /sys/block/sda/size  # Should NOT be 0
   ```

2. **If disk shows errors**:
   ```bash
   # Boot from Live USB
   # Run filesystem check
   sudo e2fsck -b 32768 -y /dev/sda
   ```

3. **If disk is dead**:
   ```bash
   # Replace disk
   # Format new disk
   sudo mkfs.ext4 /dev/sda

   # Mount at /var
   sudo mount /dev/sda /var

   # Restore Docker volumes
   # Restore from latest backup
   gunzip < /home/user/backups/postgres-daily-*.sql.gz | \
     docker exec -i veritable-games-postgres psql -U postgres
   ```

### If PostgreSQL Gets Corrupted

```bash
# Stop application
docker stop m4s0kwo4kc4oooocck4sswc4

# Find latest backup
ls -lht /home/user/backups/postgres-daily-*.sql.gz | head -1

# Restore
gunzip < /home/user/backups/postgres-daily-20251122-194904.sql.gz | \
  docker exec -i veritable-games-postgres psql -U postgres

# Verify
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM library.library_documents WHERE status='published';"

# Should show 4678 documents

# Restart application
docker start m4s0kwo4kc4oooocck4sswc4
```

---

## 📊 Data Safety Status

### What's Protected

✅ **PostgreSQL Database** - Daily backups, 30-day retention
✅ **User files** - On /home/user (separate disk from Docker)
✅ **Git repositories** - On /home/user + pushed to GitHub
✅ **Scripts** - All monitoring/backup scripts on /home/user
✅ **Cleanup work** - Committed to database (backed up daily)

### What's NOT Backed Up

⚠️ **Docker images** - Can be re-pulled
⚠️ **Docker build cache** - Can be rebuilt
⚠️ **System logs** - Not critical
⚠️ **Temp files** - Not needed

### Backup Verification

**Latest backup**: `/home/user/backups/postgres-daily-20251122-194904.sql.gz`
**Size**: 171MB compressed
**Contains**: 4,678 library documents + all cleanup work
**Verified**: ✓ Database accessible and complete

---

## 🎓 Lessons from Nov 22 Disk Failure

### What Went Wrong

1. No SMART monitoring → Disk failed without warning
2. No automated backups → Nearly lost cleanup work
3. No disk usage tracking → /var was at 82%
4. No temperature monitoring → Couldn't rule out overheating

### What We Fixed

1. ✅ SMART monitoring installed and running
2. ✅ Daily PostgreSQL backups with 30-day retention
3. ✅ Hourly disk usage checks with 90% alerts
4. ✅ Temperature monitoring every 30 minutes
5. ✅ Comprehensive health checks every 30 minutes
6. ✅ All logs centralized in `/home/user/backups/`

### Result

**Before**: Disk failure caused 4-hour outage, nearly lost 1.4M+ cleanup operations
**After**: Would detect disk issues days/weeks early + can restore from backup in 15 minutes

---

## 📞 Quick Reference

### Check System Health
```bash
/data/backups/scripts/system-health-check.sh
tail -20 /data/backups/logs/health-check.log
```

### Manual Backup
```bash
# PostgreSQL (creates hourly backup, promotes to daily/weekly/etc as needed)
/data/backups/scripts/gfs-postgres-backup.sh

# Docker volumes
/data/backups/scripts/gfs-volume-backup.sh
```

### Check Backup Storage
```bash
/data/backups/scripts/backup-monitor.sh
du -sh /data/backups/
```

### Check Disk Health
```bash
sudo smartctl -H /dev/sda
sudo smartctl -H /dev/sdb
```

### Check Temperatures
```bash
sensors
```

### View Recent Logs
```bash
tail -50 /data/backups/logs/*.log
```

### Test Backup Restoration
```bash
# Create test DB and restore from most recent hourly
docker exec veritable-games-postgres createdb -U postgres test_restore
gunzip < /data/backups/hourly/postgres-hourly-*.sql.gz | head -1 | \
  docker exec -i veritable-games-postgres psql -U postgres test_restore
```

---

**Last Updated**: February 14, 2026
**Next Review**: Weekly health log review recommended
**Status**: All systems operational ✅
**See Also**: `/data/README.md` for HDD structure and backup details
