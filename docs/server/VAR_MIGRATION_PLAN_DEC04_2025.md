# /var Drive Migration Plan - Second Failure
**Date**: December 4, 2025, 05:25 UTC
**Severity**: 🚨 CRITICAL - Second Hardware Failure
**Status**: ACTIVE - Drive failed again

---

## Executive Summary

The Samsung SSD 850 (/dev/sda) has **FAILED FOR THE SECOND TIME** (first failure: Nov 27, 2025). This is the SAME drive that failed a week ago and "recovered" after reboot.

**THIS DRIVE CANNOT BE TRUSTED** - Even if it recovers after reboot, it will fail again.

**Solution**: Migrate /var to /data (/dev/sdc1) which has 4.7TB free space.

---

## Critical Information

### Failed Drive (Second Failure)
- **Drive**: Samsung SSD 850
- **Device**: `/dev/sda`
- **Current Size**: **0B** (failed - should be 938G)
- **First Failure**: November 27, 2025
- **Second Failure**: December 4, 2025 (~1 week later)
- **Mount Point**: `/var` (currently unmountable)
- **Status**: **CATASTROPHIC HARDWARE FAILURE**

### What's on /var (sda)
Based on the dual-drive architecture documentation:

**Critical Data**:
- `/var/lib/docker/` - All Docker data
  - Container images
  - Container runtime data
  - **Docker volumes** (includes PostgreSQL database)
- `/var/lib/docker/volumes/` - PostgreSQL live database ⚠️ MOST CRITICAL

**System Data** (replaceable):
- `/var/log/` - System logs
- `/var/cache/` - Package cache
- `/var/tmp/` - Temporary files

### Available Migration Targets

**Option 1: /data (/dev/sdc1) - RECOMMENDED**
- Type: 5.5TB HDD
- Free Space: 4.7TB (plenty of room)
- Status: Healthy
- Pros: Massive space, isolated from system drive
- Cons: Slower than SSD (but better than no drive)

**Option 2: /home/user (/dev/sdb2)**
- Type: 477GB SSD
- Free Space: 211GB
- Status: Healthy
- Pros: SSD speed
- Cons: Limited space, shares partition with user data

**DECISION**: Use /data (/dev/sdc1) due to abundant space.

---

## Migration Strategy

### If Drive Recovers After Reboot (Like Last Time)

If the drive recovers after reboot (shows non-zero size), we have a **BRIEF WINDOW** to migrate data before next failure.

#### Phase 1: Emergency Data Rescue (30-60 minutes)

**DO THIS IMMEDIATELY AFTER REBOOT**:

```bash
# 1. Check if drive recovered
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE
# If sda shows non-zero size, proceed

# 2. Verify /var is readable
ls -la /var/lib/docker/volumes/ 2>&1
# If readable, continue. If I/O error, skip to Phase 2.

# 3. Create emergency backup location
sudo mkdir -p /data/var-migration-backup
sudo chmod 755 /data/var-migration-backup

# 4. Stop Docker to ensure consistent copy
sudo systemctl stop docker

# 5. Copy ENTIRE /var to /data (CRITICAL - DO NOT INTERRUPT)
# This may take 30-60 minutes depending on /var size (~80GB)
sudo rsync -avh --progress /var/ /data/var-migration-backup/ \
  --log-file=/home/user/var-migration-rsync.log

# 6. Monitor progress in another terminal
tail -f /home/user/var-migration-rsync.log

# 7. Verify copy completed successfully
echo $?  # Should return 0
du -sh /var
du -sh /data/var-migration-backup
# Sizes should match

# 8. Create verification checksums (optional but recommended)
sudo find /var -type f -exec md5sum {} \; > /home/user/var-checksums-original.txt
sudo find /data/var-migration-backup -type f -exec md5sum {} \; > /home/user/var-checksums-backup.txt
```

#### Phase 2: Reconfigure System (15 minutes)

**ONLY proceed after Phase 1 completes successfully**:

```bash
# 1. Backup current fstab
sudo cp /etc/fstab /etc/fstab.backup-$(date +%Y%m%d-%H%M%S)

# 2. Unmount failing drive
sudo umount /var
# If this fails with "device busy", reboot first then continue

# 3. Create permanent /var location on /data
sudo mkdir -p /data/var
sudo chmod 755 /data/var

# 4. Move migrated data to final location
sudo mv /data/var-migration-backup/* /data/var/
sudo rmdir /data/var-migration-backup

# 5. Edit /etc/fstab
sudo nano /etc/fstab

# Find the line that looks like:
#   UUID=9a3fc94d-007e-4ae8-aabf-9088ba33d57b  /var  ext4  defaults  0  2
#
# Comment it out:
#   # OLD FAILED DRIVE - DO NOT USE
#   # UUID=9a3fc94d-007e-4ae8-aabf-9088ba33d57b  /var  ext4  defaults  0  2
#
# Add new bind mount:
   /data/var    /var    none    bind    0 0

# Save and exit (Ctrl+X, Y, Enter)

# 6. Verify fstab syntax
cat /etc/fstab | grep var
```

#### Phase 3: Reboot and Verify (10 minutes)

```bash
# 1. Reboot to apply fstab changes
sudo reboot

# 2. After reboot, verify /var mount
mount | grep /var
# Should show: /data/var on /var type none (bind)

# 3. Check /var contents are accessible
ls -la /var/lib/docker/
ls -la /var/lib/docker/volumes/

# 4. Start Docker
sudo systemctl start docker
sudo systemctl status docker

# 5. Check Docker containers
docker ps -a

# 6. Check PostgreSQL
docker exec veritable-games-postgres psql -U postgres -c "SELECT 1;"

# 7. Verify database content
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM shared.tags;"
# Should return: ~11,986 (after tag cleanup)

# 8. Restart application
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4

# 9. Test website
curl -I https://www.veritablegames.com
```

---

### If Drive Does NOT Recover After Reboot

If the drive remains failed (size=0, I/O errors), we must restore from backup.

#### Phase 1: Accept Data Loss and Restore

```bash
# 1. Check if drive recovered
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE
# If sda still shows 0 or errors, proceed with restoration

# 2. Create new /var location
sudo mkdir -p /data/var
sudo chmod 755 /data/var

# 3. Update /etc/fstab (same as above)
sudo nano /etc/fstab
# Comment out old sda line
# Add: /data/var    /var    none    bind    0 0

# 4. Reboot
sudo reboot

# 5. After reboot, verify mount
mount | grep /var
# Should show: /data/var on /var type none (bind)

# 6. Reinstall Docker (clean slate)
sudo apt update
sudo apt install --reinstall docker.io docker-compose

# 7. Create PostgreSQL container
cd /home/user/projects/veritable-games/resources
docker-compose up -d

# 8. Wait for PostgreSQL to start
sleep 10
docker ps | grep postgres

# 9. Restore database from latest backup
# Check for post-tag-cleanup backup first
ls -lh /home/user/backups/postgres*.sql* | tail -5

# Restore most recent backup
LATEST_BACKUP=$(ls -t /home/user/backups/postgres*.sql.gz | head -1)
echo "Restoring from: $LATEST_BACKUP"

gunzip -c "$LATEST_BACKUP" | \
  docker exec -i veritable-games-postgres psql -U postgres

# 10. Verify restoration
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM shared.tags;"
# Should match count from before failure

# 11. Restart application
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

#### Data Loss Assessment (If Restoring from Backup)

**Tag Cleanup Work Status**:
- ✅ Completed BEFORE drive failure:
  - Phase 3: Fragment tags deleted (11 tags)
  - Phase 5: Generic words deleted (2 tags)
  - Phase 6: Single-use library tags deleted (1,870 tags)
  - Author tags deleted (20 tags)
  - **Result**: 13,687 → 11,986 tags

- ⏸️ Pending (NOT completed before failure):
  - Language tags deletion (22 tags) - BLOCKED by drive failure

**Conclusion**: If drive doesn't recover, tag cleanup work IS SAFE because it was committed to database before failure. The pending language tag deletion can be done after restoration.

---

## Recovery Decision Tree

```
START: Server is down, /dev/sda shows 0 bytes
  │
  ├─→ [Reboot Server]
  │
  ├─→ After Reboot: Check lsblk
  │
  ├─→ Does sda show non-zero size?
  │   │
  │   ├─→ YES: Drive recovered (temporary)
  │   │   │
  │   │   ├─→ [Phase 1: Emergency Rescue - 60 min]
  │   │   │    - rsync /var → /data/var-migration-backup
  │   │   │    - Verify copy successful
  │   │   │
  │   │   ├─→ [Phase 2: Reconfigure - 15 min]
  │   │   │    - Update /etc/fstab
  │   │   │    - Move data to /data/var
  │   │   │
  │   │   └─→ [Phase 3: Verify - 10 min]
  │   │        - Reboot
  │   │        - Test services
  │   │        - ✅ SUCCESS: No data loss
  │   │
  │   └─→ NO: Drive still failed
  │       │
  │       ├─→ [Phase 1: Restore from Backup]
  │       │    - Create /data/var
  │       │    - Update /etc/fstab
  │       │    - Reinstall Docker
  │       │    - Restore PostgreSQL from backup
  │       │
  │       └─→ ⚠️ ACCEPT DATA LOSS
  │            - Tag cleanup work: SAFE (committed before failure)
  │            - Pending language tag deletion: Re-run after restore
  │
  └─→ END: Services restored on /data
```

---

## Post-Migration Validation Checklist

After successful migration (either path):

- [ ] `/var` is mounted from `/data/var` (bind mount)
- [ ] Docker daemon starts: `sudo systemctl status docker`
- [ ] Docker containers list: `docker ps -a`
- [ ] PostgreSQL accessible: `docker exec veritable-games-postgres psql -U postgres -c "SELECT 1;"`
- [ ] Database content intact: Check tag count (~11,986)
- [ ] Application container running
- [ ] Website loads: `curl -I https://www.veritablegames.com`
- [ ] BTCPayServer running (if applicable)
- [ ] Coolify UI accessible

---

## Critical Notes

### ⚠️ DO NOT Trust This Drive Ever Again

Even if the Samsung SSD 850 recovers after reboot:
- It has now failed TWICE (Nov 27, Dec 4)
- This is a **pattern of catastrophic failure**
- Next failure could be permanent (no recovery)
- **DO NOT** store any critical data on /dev/sda ever again

### Recommended Actions After Migration

1. **Physically disconnect /dev/sda** to prevent accidental use
2. **Update documentation** to reflect new /var location
3. **Create immediate backup** after migration succeeds
4. **Test backup restoration** within 24 hours
5. **Monitor /data drive health** with SMART

### Performance Considerations

**Moving /var to HDD (/data)**:
- Docker will be slower (HDD vs SSD)
- Database queries will be slower
- Acceptable tradeoff for stability
- Future: Can migrate to new SSD when resources available

---

## Emergency Contact Information

**Server**: veritable-games-server (192.168.1.15)
**Failed Drive**: /dev/sda (Samsung SSD 850)
**Migration Target**: /dev/sdc1 (/data) - 5.5TB HDD
**Backup Location**: /home/user/backups/

**Related Documentation**:
- `/home/user/docs/server/VAR_DRIVE_FAILURE_INCIDENT_NOV27_2025.md` - First failure
- `/home/user/docs/server/DRIVE_RECOVERY_STATUS_NOV27_2025.md` - First recovery
- `/home/user/CLAUDE.md` - Server operations guide
- `/home/user/docs/server/DRIVE_ARCHITECTURE.md` - Drive architecture

---

## Execution Log

**To be filled during actual migration**:

```
[YYYY-MM-DD HH:MM] - Started migration process
[YYYY-MM-DD HH:MM] - Drive recovery status: [YES/NO]
[YYYY-MM-DD HH:MM] - Migration path chosen: [Emergency Rescue / Restore from Backup]
[YYYY-MM-DD HH:MM] - Phase 1 completed
[YYYY-MM-DD HH:MM] - Phase 2 completed
[YYYY-MM-DD HH:MM] - Phase 3 completed
[YYYY-MM-DD HH:MM] - Services verified operational
[YYYY-MM-DD HH:MM] - Migration COMPLETE
```

---

**END OF MIGRATION PLAN**
