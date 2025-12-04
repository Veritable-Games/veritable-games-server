# Recent Server Work - December 2025

**Last Updated**: December 4, 2025
**Status**: ✅ Production Operational
**Critical**: Read this if you're a new Claude session connecting to this server

---

## 🚨 What Just Happened (December 4, 2025)

### The Problem: Second Drive Failure

The Samsung SSD 850 (/dev/sda) **FAILED FOR THE SECOND TIME**:
- **First failure**: November 27, 2025 (recovered after reboot)
- **Second failure**: December 4, 2025 (same drive, same symptoms)
- **Symptoms**: Drive showed 0 bytes, I/O errors, complete inaccessibility
- **Recovery**: Rebooted, drive temporarily recovered (showing 953.9G)

**Critical lesson**: This drive is **PERMANENTLY UNRELIABLE** and has been retired from production use.

### The Solution: Hybrid SSD/HDD Storage Migration

We completed a **comprehensive hybrid storage migration** to eliminate dependence on the failing drive:

**Migration Duration**: ~23 minutes (06:08 - 06:31 UTC)
**Data Loss**: None
**Service Downtime**: ~15 minutes
**Approach**: Optimal hybrid architecture (user chose Option B)

---

## 🏗️ New Storage Architecture

### **SSD (/dev/sdb2) - Performance-Critical Data**

**Location**: `/home/user/docker-ssd/` (Docker's new data-root)
**Size**: 83GB used, 197GB free
**Purpose**: Fast access for performance-sensitive workloads

**What's on the SSD:**
- ✅ Docker system (images, containers, buildkit)
- ✅ PostgreSQL databases
  - `veritable_games` database (11,986 tags after cleanup)
  - BTCPay PostgreSQL database
  - Coolify PostgreSQL database
- ✅ Anarchist library volume (1.3GB)
- ✅ Veritable gallery volume (1.1GB)
- ✅ Application volumes (Coolify, Veritable Games app)

**Why SSD**: Database queries, website serving, and library access need fast I/O for responsive user experience.

### **HDD (/dev/sdc1) - Large Data Storage**

**Location**: `/data/`
**Size**: 904GB used, 4.5TB free
**Purpose**: Large, growing data that doesn't need SSD speed

**What's on the HDD:**
- ✅ Bitcoin blockchain (60GB at `/data/docker-hdd-volumes/generated_bitcoin_datadir/`)
  - Bind-mounted into Docker SSD location
  - Will grow to 500GB+ over time
  - Can be pruned to 100GB cap if needed
- ✅ Project archives (633GB)
- ✅ Reference materials (124GB)
- ✅ Migration backup (4.8GB - delete after 48h stability)

**Why HDD**: Bitcoin blockchain is read sequentially, grows indefinitely, and doesn't benefit significantly from SSD speed.

### **Old Samsung SSD (/dev/sda) - RETIRED**

**Status**: ⚠️ Still mounted at `/var` but **NO LONGER USED**
**Size**: 78GB of old Docker data
**Action**: Unmount and physically disconnect after 48 hours of stability

---

## ✅ Current System Status

### All Services Verified Operational

| Service | Status | Verification |
|---------|--------|--------------|
| **Veritable Games Website** | ✅ ONLINE | https://www.veritablegames.com (HTTP 307 redirect) |
| **PostgreSQL Database** | ✅ WORKING | 11,986 tags (tag cleanup preserved) |
| **BTCPay Server** | ✅ SYNCED | Bitcoin block 926,372+ |
| **Bitcoin Blockchain** | ✅ ON HDD | 60GB, actively syncing |
| **Coolify** | ✅ RUNNING | Deployment system operational |
| **Stripe Integration** | ✅ READY | Payment processing available |
| **All 18 Containers** | ✅ RUNNING | All healthy status |

### Tag Cleanup Work (Preserved)

**Context**: User was running aggressive tag cleanup before drive failure.

**Status**: ✅ All cleanup work preserved in database
- Started: 13,687 tags
- Fragments deleted: 11 tags
- Generic words deleted: 2 tags
- Single-use library tags deleted: 1,870 tags
- Author tags deleted: 20 tags
- **Final count**: 11,986 tags

**Pending work**: 22 language tags deletion (blocked by drive failure, can be completed now)

---

## 📋 Configuration Changes

### Docker Configuration

**File**: `/etc/docker/daemon.json`

**Change**: Updated `data-root` to point to SSD
```json
{
  "data-root": "/home/user/docker-ssd",
  ...
}
```

**Backup**: `/etc/docker/daemon.json.backup-20251204-062520`

### Bitcoin Volume Bind Mount

**Configuration**: Bitcoin blockchain bind-mounted from HDD to SSD location

**Physical location**: `/data/docker-hdd-volumes/generated_bitcoin_datadir/_data`
**Mount point**: `/home/user/docker-ssd/volumes/generated_bitcoin_datadir/_data`

**Why**: Keeps Bitcoin on HDD while appearing in Docker's SSD volumes directory.

### BTCPay Server

**Status**: No changes required (bind mount handled automatically)

**Future option**: Enable Bitcoin pruning to cap at 100GB
- Current: 60GB (full node)
- Pruned: 100GB cap (~1 year of blocks)
- Config: `BITCOIN_EXTRA_ARGS: prune=100000` in BTCPay docker-compose

---

## 📖 Documentation Created

### Migration Planning & Execution

1. **`VAR_MIGRATION_PLAN_DEC04_2025.md`**
   - Emergency migration plan created after second drive failure
   - Decision tree for recovery scenarios
   - Procedures for rsync backup and restoration

2. **`HYBRID_STORAGE_ARCHITECTURE_PLAN.md`** (82 pages)
   - Comprehensive architecture design
   - Volume inventory (all 28 Docker volumes analyzed)
   - Migration procedures with verification steps
   - Risk assessment and mitigation strategies
   - Bitcoin pruning configuration guide

3. **`HYBRID_MIGRATION_EXECUTION_LOG_DEC04_2025.md`**
   - Complete execution log of migration
   - Commands run, output captured
   - Verification results
   - Rollback procedures

### Related Documentation

4. **`VAR_DRIVE_FAILURE_INCIDENT_NOV27_2025.md`** (from first failure)
   - First failure timeline and recovery
   - Warning that drive would fail again (it did)

5. **`DRIVE_RECOVERY_STATUS_NOV27_2025.md`** (from first failure)
   - Analysis of first recovery
   - SMART data showing drive age and wear

---

## 🔍 What to Monitor

### 48-Hour Stability Period (Dec 4-6, 2025)

**Purpose**: Verify hybrid architecture is stable before final cleanup

**Monitor these:**
- ✅ All Docker containers stay running
- ✅ PostgreSQL database remains accessible
- ✅ Website continues serving requests
- ✅ Bitcoin blockchain continues syncing
- ✅ No I/O errors in logs (`dmesg`, Docker logs)

**Check commands:**
```bash
# Container status
docker ps -a

# Database connectivity
docker exec veritable-games-postgres psql -U postgres -c "SELECT 1;"

# Tag count verification
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM shared.tags;"
# Should return: 11,986

# Website status
curl -I https://www.veritablegames.com

# Bitcoin sync status
docker logs btcpayserver_bitcoind --tail 10

# Check for I/O errors
sudo dmesg | grep -i "error\|fail" | tail -20
```

### After 48 Hours (December 6, 2025)

**Cleanup tasks:**
```bash
# 1. Remove old Docker data on Samsung SSD
sudo rm -rf /var/lib/docker/

# 2. Remove migration backup
sudo rm -rf /data/var-migration-backup/

# 3. Update /etc/fstab to unmount Samsung SSD
sudo nano /etc/fstab
# Comment out or remove the /dev/sda line

# 4. Unmount the Samsung SSD
sudo umount /var

# 5. Optionally: Physically disconnect the Samsung SSD
```

---

## 🎯 Key Takeaways for Future Sessions

### 1. Storage Layout is Now Hybrid

**Don't assume** everything is on `/var` or a single drive anymore.

**SSD path**: `/home/user/docker-ssd/`
**HDD path**: `/data/docker-hdd-volumes/`
**Old /var**: Retired, no longer in use

### 2. Docker Data-Root Changed

**Old**: `/var/lib/docker`
**New**: `/home/user/docker-ssd`

**Configuration**: `/etc/docker/daemon.json`

### 3. Bitcoin is on HDD (by design)

The Bitcoin blockchain is intentionally on the HDD despite Docker being on the SSD. This is a **performance optimization**, not an error.

### 4. Tag Cleanup is Incomplete

User was in the middle of aggressive tag cleanup when drive failed. Work preserved, but 22 language tags still need deletion (user wanted them removed).

**To complete**:
```sql
-- Delete language tags (22 tags: english, spanish, french, etc.)
-- See VAR_MIGRATION_PLAN_DEC04_2025.md for full list
```

### 5. Samsung SSD is Dead - Don't Use It

The Samsung SSD 850 (/dev/sda) has failed **TWICE** and is permanently unreliable. It's still mounted but not used. After 48h stability:
- Remove old data
- Unmount the drive
- Physically disconnect it

**Never** try to move data back to /dev/sda.

---

## 🚀 Performance Benefits

### Before Migration (Single Failing SSD)

- ❌ All data on unreliable Samsung SSD
- ❌ Drive could fail at any moment (it did)
- ❌ Bitcoin blockchain consuming valuable SSD space
- ⚠️ 211GB free space being wasted on healthy SSD

### After Migration (Hybrid SSD/HDD)

- ✅ Database on fast, healthy SSD (10-50x faster than HDD)
- ✅ Website serving from SSD (fast response times)
- ✅ Bitcoin on HDD (room to grow to 500GB+)
- ✅ 197GB free on SSD (can grow without issues)
- ✅ 4.5TB free on HDD (massive room for future growth)
- ✅ Failing drive completely retired

---

## 📞 Emergency Procedures

### If Services Don't Start After Reboot

**Likely cause**: Docker can't find data

**Check Docker data-root**:
```bash
cat /etc/docker/daemon.json | grep data-root
# Should show: "data-root": "/home/user/docker-ssd"
```

**Verify mount points**:
```bash
ls -la /home/user/docker-ssd/
# Should show Docker directories (volumes, overlay2, etc.)

ls -la /data/docker-hdd-volumes/
# Should show generated_bitcoin_datadir
```

**Restart Docker**:
```bash
sudo systemctl restart docker
docker ps
```

### If Database is Missing

**Check PostgreSQL container**:
```bash
docker ps | grep postgres
docker logs veritable-games-postgres --tail 50
```

**Verify data location**:
```bash
sudo ls -la /home/user/docker-ssd/volumes/user_postgres_data/_data/
# Should show PostgreSQL data files
```

**Test connection**:
```bash
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM shared.tags;"
# Should return: 11,986
```

### If Bitcoin Blockchain is Missing

**Check bind mount**:
```bash
# Physical location (should exist on HDD)
sudo ls -la /data/docker-hdd-volumes/generated_bitcoin_datadir/_data/

# Mount point (should be accessible from Docker)
sudo ls -la /home/user/docker-ssd/volumes/generated_bitcoin_datadir/_data/
```

**Check BTCPay container**:
```bash
docker logs btcpayserver_bitcoind --tail 50
```

### Rollback Procedure (If Everything Fails)

**Only use if migration completely broke**:

1. Stop Docker:
   ```bash
   sudo systemctl stop docker
   ```

2. Restore old Docker config:
   ```bash
   sudo cp /etc/docker/daemon.json.backup-20251204-062520 /etc/docker/daemon.json
   ```

3. Restore from migration backup:
   ```bash
   sudo rm -rf /var/lib/docker
   sudo rsync -av /data/var-migration-backup/lib/docker/ /var/lib/docker/
   ```

4. Start Docker:
   ```bash
   sudo systemctl start docker
   ```

**Note**: Emergency backup at `/data/var-migration-backup/` is kept for 48 hours for this purpose.

---

## 🔗 Related Documentation

**Server Operations**:
- `/home/user/CLAUDE.md` - Main server operations guide
- `/home/user/docs/server/DRIVE_ARCHITECTURE.md` - Dual-drive architecture overview
- `/home/user/docs/server/CONTAINER_PROTECTION_AND_RECOVERY.md` - Container safety protocols

**Recent Incidents**:
- `/home/user/docs/server/VAR_DRIVE_FAILURE_INCIDENT_NOV27_2025.md` - First failure
- `/home/user/docs/server/DRIVE_RECOVERY_STATUS_NOV27_2025.md` - First recovery analysis

**Migration Documentation**:
- `/home/user/docs/server/VAR_MIGRATION_PLAN_DEC04_2025.md` - Emergency migration plan
- `/home/user/docs/server/HYBRID_STORAGE_ARCHITECTURE_PLAN.md` - Comprehensive architecture
- `/home/user/docs/server/HYBRID_MIGRATION_EXECUTION_LOG_DEC04_2025.md` - Execution log

**Project-Specific**:
- `/home/user/projects/veritable-games/site/CLAUDE.md` - Veritable Games development guide
- `/home/user/projects/veritable-games/MASTER_WORKFLOW_TIMELINE.md` - Library import pipeline

---

## 📊 Quick Reference

### Storage Locations

| Data Type | Location | Drive | Size |
|-----------|----------|-------|------|
| Docker system | `/home/user/docker-ssd/` | SSD | 83GB |
| PostgreSQL DBs | `/home/user/docker-ssd/volumes/` | SSD | 1.2GB |
| Libraries | `/home/user/docker-ssd/volumes/` | SSD | 2.4GB |
| Bitcoin blockchain | `/data/docker-hdd-volumes/` | HDD | 60GB |
| Projects | `/data/projects/` | HDD | 633GB |
| Archives | `/data/archives/` | HDD | 124GB |
| Migration backup | `/data/var-migration-backup/` | HDD | 4.8GB |
| Old Docker (unused) | `/var/lib/docker/` | Old SSD | 78GB |

### Drive Summary

| Device | Mount | Type | Size | Free | Status |
|--------|-------|------|------|------|--------|
| /dev/sdb2 | / and /home/user | SSD | 468GB | 197GB | ✅ Healthy (primary) |
| /dev/sdc1 | /data | HDD | 5.5TB | 4.5TB | ✅ Healthy (storage) |
| /dev/sda | /var | SSD | 938GB | 813GB | ❌ Failed (retired) |

### Important Commands

```bash
# Check Docker location
cat /etc/docker/daemon.json | grep data-root

# Verify all containers
docker ps -a

# Check tag count (should be 11,986)
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM shared.tags;"

# Check Bitcoin sync
docker logs btcpayserver_bitcoind --tail 10

# Check website
curl -I https://www.veritablegames.com

# Check disk usage
df -h | grep -E "sdb2|sdc1|sda"
du -sh /home/user/docker-ssd
du -sh /data/docker-hdd-volumes
```

---

## 👤 User Context

**User's Concerns**:
- Website performance (library must load fast)
- BTCPay Server functionality
- Stripe payment integration
- Coolify deployment system
- Tag cleanup work preservation (11,986 tags)

**User's Trust**:
- Chose "Option B - Go optimal" for hybrid architecture
- Trusts Claude to restore all services completely
- Expects: website, BTCPay, Stripe, Coolify all working

**User's Next Steps**:
- Monitor for 48 hours
- Complete language tag deletion (22 tags)
- Consider Bitcoin pruning (60GB → 100GB cap)

---

**Migration Complete**: December 4, 2025 06:31 UTC
**Last Verified**: December 4, 2025 06:33 UTC
**Next Action**: Monitor for 48 hours, cleanup after stability confirmed

**Status**: ✅ **ALL SYSTEMS OPERATIONAL**
