# Docker Volume Backup Strategy

**Server:** veritable-games-server (192.168.1.15)
**Last Updated:** November 21, 2025
**Purpose:** Comprehensive backup and recovery strategy for all Docker volumes

---

## Table of Contents

1. [Volume Priority Matrix](#volume-priority-matrix)
2. [Backup Procedures](#backup-procedures)
3. [Recovery Procedures](#recovery-procedures)
4. [Automation Scripts](#automation-scripts)
5. [Testing & Verification](#testing--verification)
6. [Off-Site Backup Strategy](#off-site-backup-strategy)

---

## Volume Priority Matrix

### Critical Volumes (Backup Daily, Keep Forever)

| Volume Name | Size | Purpose | RPO | RTO | Backup Method |
|-------------|------|---------|-----|-----|---------------|
| `coolify-db` | ~500 MB | Coolify configuration database | 24h | 1h | pg_dump + volume copy |
| `generated_btcpay_datadir` | Variable | BTCPay stores/invoices | 24h | 2h | Volume copy |
| `generated_bitcoin_wallet_datadir` | Small | Bitcoin wallet keys | 0h | 1h | Volume copy (real-time) |
| `generated_clightning_bitcoin_datadir` | Variable | Lightning channel state | 0h | 1h | Volume copy (real-time) |
| `generated_postgres_datadir` | ~200 MB | BTCPay PostgreSQL | 24h | 1h | pg_dump + volume copy |
| `m4s0kwo4kc4oooocck4sswc4-veritable-gallery` | Variable | User gallery uploads | 24h | 4h | Volume copy |
| `m4s0kwo4kc4oooocck4sswc4-veritable-news` | Variable | News images | 24h | 4h | Volume copy |
| `m4s0kwo4kc4oooocck4sswc4-veritable-user-uploads` | Variable | User uploads | 24h | 4h | Volume copy |

**RPO (Recovery Point Objective):** Maximum acceptable data loss
**RTO (Recovery Time Objective):** Maximum acceptable downtime

---

### High Priority Volumes (Backup Weekly, Keep 3 Months)

| Volume Name | Size | Purpose | RPO | RTO | Backup Method |
|-------------|------|---------|-----|-----|---------------|
| `m4s0kwo4kc4oooocck4sswc4-anarchist-library` | ~1.3 GB | Anarchist Library texts | 7d | 6h | Volume copy |
| `m4s0kwo4kc4oooocck4sswc4-marxists-library` | ~236 MB | Marxists.org texts | 7d | 6h | Volume copy |
| `m4s0kwo4kc4oooocck4sswc4-veritable-wiki` | Variable | Wiki markdown files | 7d | 4h | Volume copy (git has backup too) |
| `uptime-kuma-data` | Small | Uptime monitoring config | 7d | 2h | Volume copy |
| `generated_tor_datadir` | Small | Tor onion keys | 7d | 4h | Volume copy |
| `generated_tor_servicesdir` | Small | Tor onion services | 7d | 4h | Volume copy |
| `generated_tor_torrcdir` | Small | Tor configuration | 7d | 2h | Volume copy |

---

### Medium Priority Volumes (Backup Monthly, Keep 1 Month)

| Volume Name | Size | Purpose | RPO | RTO | Backup Method |
|-------------|------|---------|-----|-----|---------------|
| `user_pgadmin_data` | ~50 MB | pgAdmin config | 30d | 1h | Volume copy |
| `generated_btcpay_pluginsdir` | Small | BTCPay plugins | 30d | 1h | Volume copy |
| `generated_clightning_bitcoin_rtl_datadir` | Small | RTL UI config | 30d | 1h | Volume copy |

---

### Low Priority Volumes (No Regular Backups)

| Volume Name | Size | Purpose | Reason Not Backed Up |
|-------------|------|---------|----------------------|
| `coolify-redis` | ~100 MB | Cache/sessions | Ephemeral data, auto-regenerates |
| `generated_bitcoin_datadir` | ~600 GB | Bitcoin blockchain | Can re-sync from network (takes days) |
| `generated_nbxplorer_datadir` | Variable | Blockchain index | Can reindex (takes hours) |
| `user_postgres_data` | Variable | Local dev database | Development only |
| `anarchist-library` | ~1.3 GB | Local dev data | Development only |
| `marxists-library` | ~236 MB | Local dev data | Development only |
| `veritable-gallery`, `veritable-news`, `veritable-user-uploads`, `veritable-wiki` | Variable | Old local dev volumes | Obsolete, not used |

**Note:** While `generated_bitcoin_datadir` is not regularly backed up due to size (600+ GB), it CAN be re-synced from the Bitcoin network if lost. Consider backing up if re-sync time (5-7 days) is unacceptable.

---

## Backup Procedures

### Volume Copy Method

**Advantages:**
- Complete data copy including all files and permissions
- Can be restored to any Docker instance
- Preserves exact state

**Disadvantage:**
- Requires stopping container for consistent backup (or risk inconsistency)

#### Standard Volume Backup

```bash
#!/bin/bash
# Backup a Docker volume to tar.gz archive

VOLUME_NAME=$1
BACKUP_DIR="/home/user/backups/volumes"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Create backup using temporary container
docker run --rm \
  -v "$VOLUME_NAME":/source:ro \
  -v "$BACKUP_DIR":/backup \
  alpine \
  tar -czf "/backup/${VOLUME_NAME}-${TIMESTAMP}.tar.gz" -C /source .

echo "Backup created: $BACKUP_DIR/${VOLUME_NAME}-${TIMESTAMP}.tar.gz"
```

**Usage:**
```bash
# Backup a single volume
./backup-volume.sh m4s0kwo4kc4oooocck4sswc4-veritable-gallery

# Backup all critical volumes
for vol in coolify-db m4s0kwo4kc4oooocck4sswc4-veritable-gallery m4s0kwo4kc4oooocck4sswc4-veritable-news; do
    ./backup-volume.sh "$vol"
done
```

---

### Database Volume Backup (PostgreSQL)

**Preferred Method:** Use pg_dump instead of volume copy

#### Coolify Database Backup

```bash
# Backup Coolify's PostgreSQL database
docker exec coolify-db pg_dumpall -U postgres | \
  gzip > /home/user/backups/volumes/coolify-db-$(date +%Y%m%d-%H%M%S).sql.gz
```

#### BTCPay PostgreSQL Backup

```bash
# Backup BTCPayServer's PostgreSQL database
docker exec generated_postgres_1 pg_dumpall -U postgres | \
  gzip > /home/user/backups/volumes/btcpay-postgres-$(date +%Y%m%d-%H%M%S).sql.gz
```

**Why prefer pg_dump over volume copy?**
- Smaller backup size (compressed SQL)
- No need to stop database
- Cross-version compatible
- Human-readable (can inspect/edit)
- Consistent snapshot

---

### Bitcoin Wallet Backup (CRITICAL)

**⚠️ CRITICAL:** Bitcoin wallets contain private keys. Loss means loss of funds.

```bash
# Backup Bitcoin Core wallet
docker exec btcpayserver_bitcoind bitcoin-cli dumpwallet /tmp/wallet-backup.dat

docker cp btcpayserver_bitcoind:/tmp/wallet-backup.dat \
  /home/user/backups/bitcoin/wallet-$(date +%Y%m%d-%H%M%S).dat

# Encrypt backup
openssl enc -aes-256-cbc -salt \
  -in /home/user/backups/bitcoin/wallet-$(date +%Y%m%d-%H%M%S).dat \
  -out /home/user/backups/bitcoin/wallet-$(date +%Y%m%d-%H%M%S).dat.enc

# Delete unencrypted backup
rm /home/user/backups/bitcoin/wallet-$(date +%Y%m%d-%H%M%S).dat
```

**Store encrypted wallet backup off-site immediately!**

---

### Lightning Channel Backup (CRITICAL)

**⚠️ CRITICAL:** Lightning channel state must be backed up to recover funds.

```bash
# C-Lightning automatically creates backups, but manually backup too
docker exec btcpayserver_clightning_bitcoin \
  lightning-cli --network=bitcoin listchannels > \
  /home/user/backups/lightning/channels-$(date +%Y%m%d-%H%M%S).json

# Backup entire Lightning data directory
docker run --rm \
  -v generated_clightning_bitcoin_datadir:/source:ro \
  -v /home/user/backups/lightning:/backup \
  alpine \
  tar -czf "/backup/clightning-$(date +%Y%m%d-%H%M%S).tar.gz" -C /source .
```

**⚠️ Important:** Lightning backups must be done AFTER every channel state change (payments, channel opens/closes).

---

## Recovery Procedures

### Volume Restore

```bash
#!/bin/bash
# Restore a Docker volume from tar.gz backup

BACKUP_FILE=$1
VOLUME_NAME=$2

# Verify volume exists
docker volume inspect "$VOLUME_NAME" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Creating volume: $VOLUME_NAME"
    docker volume create "$VOLUME_NAME"
fi

# Restore backup using temporary container
docker run --rm \
  -v "$VOLUME_NAME":/target \
  -v "$(dirname "$BACKUP_FILE")":/backup \
  alpine \
  tar -xzf "/backup/$(basename "$BACKUP_FILE")" -C /target

echo "Restored: $BACKUP_FILE -> $VOLUME_NAME"
```

**Usage:**
```bash
# Stop container using the volume
docker stop m4s0kwo4kc4oooocck4sswc4

# Restore volume
./restore-volume.sh /home/user/backups/volumes/m4s0kwo4kc4oooocck4sswc4-veritable-gallery-20251121.tar.gz \
  m4s0kwo4kc4oooocck4sswc4-veritable-gallery

# Restart container
docker start m4s0kwo4kc4oooocck4sswc4
```

---

### Database Restore

#### Coolify Database

```bash
# Stop Coolify
docker stop coolify

# Drop and recreate database
docker exec coolify-db psql -U postgres -c "DROP DATABASE IF EXISTS coolify;"
docker exec coolify-db psql -U postgres -c "CREATE DATABASE coolify;"

# Restore from backup
gunzip < /home/user/backups/volumes/coolify-db-20251121.sql.gz | \
  docker exec -i coolify-db psql -U postgres

# Restart Coolify
docker start coolify
```

#### BTCPay PostgreSQL

```bash
# Stop BTCPay
docker stop generated_btcpayserver_1

# Restore database
gunzip < /home/user/backups/volumes/btcpay-postgres-20251121.sql.gz | \
  docker exec -i generated_postgres_1 psql -U postgres

# Restart BTCPay
docker start generated_btcpayserver_1
```

---

### Bitcoin Wallet Restore

```bash
# Decrypt wallet backup
openssl enc -aes-256-cbc -d \
  -in /home/user/backups/bitcoin/wallet-20251121.dat.enc \
  -out /tmp/wallet-restore.dat

# Stop Bitcoin Core
docker stop btcpayserver_bitcoind

# Copy wallet file
docker cp /tmp/wallet-restore.dat btcpayserver_bitcoind:/root/.bitcoin/wallet.dat

# Restart Bitcoin Core
docker start btcpayserver_bitcoind

# Verify wallet loaded
docker exec btcpayserver_bitcoind bitcoin-cli getwalletinfo

# Secure delete decrypted file
shred -u /tmp/wallet-restore.dat
```

---

### Lightning Channel Restore

**⚠️ CAUTION:** Restoring old Lightning state can cause channel force-closures and fund loss. Only restore if you're certain it's the latest state.

```bash
# Stop Lightning node
docker stop btcpayserver_clightning_bitcoin

# Delete existing data
docker volume rm generated_clightning_bitcoin_datadir
docker volume create generated_clightning_bitcoin_datadir

# Restore from backup
docker run --rm \
  -v generated_clightning_bitcoin_datadir:/target \
  -v /home/user/backups/lightning:/backup \
  alpine \
  tar -xzf "/backup/clightning-20251121.tar.gz" -C /target

# Restart Lightning node
docker start btcpayserver_clightning_bitcoin

# Verify channels
docker exec btcpayserver_clightning_bitcoin lightning-cli --network=bitcoin listpeers
```

---

## Automation Scripts

### Daily Backup Script

Create `/home/user/scripts/daily-backup.sh`:

```bash
#!/bin/bash
# Daily Backup Script for Critical Volumes
# Run via cron: 0 3 * * * /home/user/scripts/daily-backup.sh

set -e
BACKUP_DIR="/home/user/backups/volumes/daily"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting daily backup..."

# Critical database backups
echo "Backing up Coolify database..."
docker exec coolify-db pg_dumpall -U postgres | \
  gzip > "$BACKUP_DIR/coolify-db-$TIMESTAMP.sql.gz"

echo "Backing up BTCPay database..."
docker exec generated_postgres_1 pg_dumpall -U postgres | \
  gzip > "$BACKUP_DIR/btcpay-postgres-$TIMESTAMP.sql.gz"

# Critical volume backups
CRITICAL_VOLUMES=(
  "m4s0kwo4kc4oooocck4sswc4-veritable-gallery"
  "m4s0kwo4kc4oooocck4sswc4-veritable-news"
  "m4s0kwo4kc4oooocck4sswc4-veritable-user-uploads"
  "generated_btcpay_datadir"
  "generated_bitcoin_wallet_datadir"
  "generated_clightning_bitcoin_datadir"
)

for vol in "${CRITICAL_VOLUMES[@]}"; do
    echo "Backing up volume: $vol"
    docker run --rm \
      -v "$vol":/source:ro \
      -v "$BACKUP_DIR":/backup \
      alpine \
      tar -czf "/backup/${vol}-${TIMESTAMP}.tar.gz" -C /source .
done

# Cleanup old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.tar.gz" -o -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Daily backup complete."
```

**Make executable and schedule:**
```bash
chmod +x /home/user/scripts/daily-backup.sh

# Add to crontab (3 AM daily)
(crontab -l 2>/dev/null; echo "0 3 * * * /home/user/scripts/daily-backup.sh >> /home/user/backups/volumes/backup.log 2>&1") | crontab -
```

---

### Weekly Backup Script

Create `/home/user/scripts/weekly-backup.sh`:

```bash
#!/bin/bash
# Weekly Backup Script for High-Priority Volumes
# Run via cron: 0 4 * * 0 /home/user/scripts/weekly-backup.sh (Sundays at 4 AM)

set -e
BACKUP_DIR="/home/user/backups/volumes/weekly"
TIMESTAMP=$(date +%Y%m%d)
RETENTION_WEEKS=12

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting weekly backup..."

# High-priority volumes
WEEKLY_VOLUMES=(
  "m4s0kwo4kc4oooocck4sswc4-anarchist-library"
  "m4s0kwo4kc4oooocck4sswc4-marxists-library"
  "m4s0kwo4kc4oooocck4sswc4-veritable-wiki"
  "uptime-kuma-data"
  "generated_tor_datadir"
  "generated_tor_servicesdir"
  "generated_tor_torrcdir"
)

for vol in "${WEEKLY_VOLUMES[@]}"; do
    echo "Backing up volume: $vol"
    docker run --rm \
      -v "$vol":/source:ro \
      -v "$BACKUP_DIR":/backup \
      alpine \
      tar -czf "/backup/${vol}-${TIMESTAMP}.tar.gz" -C /source .
done

# Cleanup old weekly backups
echo "Cleaning up backups older than $RETENTION_WEEKS weeks..."
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$((RETENTION_WEEKS * 7)) -delete

echo "[$(date)] Weekly backup complete."
```

**Make executable and schedule:**
```bash
chmod +x /home/user/scripts/weekly-backup.sh

# Add to crontab (Sundays at 4 AM)
(crontab -l 2>/dev/null; echo "0 4 * * 0 /home/user/scripts/weekly-backup.sh >> /home/user/backups/volumes/backup.log 2>&1") | crontab -
```

---

## Testing & Verification

### Backup Verification Procedure

**Test backups regularly to ensure they're usable!**

```bash
#!/bin/bash
# Test a volume backup by restoring to a temporary volume

BACKUP_FILE=$1
TEST_VOLUME="test-restore-$(date +%s)"

echo "Testing backup: $BACKUP_FILE"

# Create test volume
docker volume create "$TEST_VOLUME"

# Restore to test volume
docker run --rm \
  -v "$TEST_VOLUME":/target \
  -v "$(dirname "$BACKUP_FILE")":/backup \
  alpine \
  tar -xzf "/backup/$(basename "$BACKUP_FILE")" -C /target

# List contents
echo "Backup contents:"
docker run --rm -v "$TEST_VOLUME":/data alpine ls -lah /data

# Cleanup test volume
docker volume rm "$TEST_VOLUME"

echo "Backup test complete!"
```

### Quarterly Restore Test

**Run full restore test every 3 months:**

1. Select random critical backup
2. Restore to test volume
3. Spin up test container with restored volume
4. Verify data integrity
5. Document results

**Schedule:** First Sunday of each quarter

---

## Off-Site Backup Strategy

### Current State: ⚠️ NO OFF-SITE BACKUPS

**Risk:** Single point of failure (all backups on same server)

### Recommended Off-Site Solutions

#### Option 1: rsync to Remote Server

```bash
# Sync backups to remote server
rsync -avz --delete \
  /home/user/backups/volumes/ \
  user@remote-server.com:/backups/veritable-games-server/volumes/
```

#### Option 2: AWS S3

```bash
# Install AWS CLI
sudo apt install awscli

# Configure credentials
aws configure

# Sync to S3
aws s3 sync /home/user/backups/volumes/ \
  s3://veritable-games-backups/volumes/ \
  --storage-class STANDARD_IA  # Infrequent Access (cheaper)
```

#### Option 3: Backblaze B2

```bash
# Install B2 CLI
pip3 install b2

# Configure
b2 authorize-account <key_id> <application_key>

# Sync to B2
b2 sync /home/user/backups/volumes/ b2://veritable-games-backups/volumes/
```

#### Option 4: Manual External Drive

```bash
# Mount external drive
sudo mount /dev/sdb1 /mnt/backup-drive

# Copy backups
rsync -avz /home/user/backups/volumes/ /mnt/backup-drive/veritable-games-backups/

# Unmount
sudo umount /mnt/backup-drive
```

**Recommendation:** Implement at least TWO off-site backup methods:
1. Automated cloud sync (S3/B2) for daily/weekly backups
2. Monthly external drive backup for catastrophic recovery

---

## Backup Storage Requirements

### Estimated Storage Needs

| Backup Type | Frequency | Retention | Est. Size Per Backup | Total Storage Needed |
|-------------|-----------|-----------|---------------------|---------------------|
| Critical Volumes | Daily | 7 days | ~500 MB | ~3.5 GB |
| PostgreSQL | Daily | 7 days | ~700 MB | ~5 GB |
| Weekly Volumes | Weekly | 12 weeks | ~1.5 GB | ~18 GB |
| Bitcoin Wallet | Daily | Forever | ~10 MB | ~365 MB/year |
| Lightning | Daily | Forever | ~50 MB | ~18 GB/year |

**Total Local Storage:** ~50 GB/year (grows with user uploads)

**Off-Site Storage:** Same as local

**Current Available Space:**
- sdb (user data): 336 GB free ✅ Plenty of space
- sda (Docker): 859 GB free ✅ Plenty of space

---

## Disaster Recovery Scenarios

### Scenario 1: Volume Corruption

**Impact:** Single volume corrupted
**Recovery Time:** 30 minutes to 2 hours
**Procedure:**
1. Stop affected container
2. Delete corrupted volume
3. Create new volume
4. Restore from latest backup
5. Restart container
6. Verify data integrity

### Scenario 2: Complete Docker Failure

**Impact:** All containers/volumes lost
**Recovery Time:** 4-8 hours
**Procedure:**
1. Reinstall Docker
2. Recreate networks (see INFRASTRUCTURE_INVENTORY.md)
3. Restore volumes from backups (prioritize critical)
4. Restore databases from dumps
5. Recreate containers (see documentation)
6. Verify all services operational

### Scenario 3: Server Hardware Failure

**Impact:** Complete server loss
**Recovery Time:** 1-2 days (depends on hardware replacement)
**Procedure:**
1. Acquire new server hardware
2. Install Ubuntu Server
3. Install Docker
4. Copy backups from off-site storage
5. Follow Scenario 2 procedure
6. Update DNS if IP changed

### Scenario 4: Ransomware/Malicious Deletion

**Impact:** All local data encrypted/deleted
**Recovery Time:** 2-4 hours (if good off-site backups)
**Procedure:**
1. Disconnect server from network
2. Reinstall operating system (clean slate)
3. Reinstall Docker
4. Restore from off-site backups ONLY
5. Verify backups not infected
6. Rebuild infrastructure
7. Implement additional security measures

---

## Checklist: Backup System Health

Run this checklist monthly:

- [ ] Daily backup script running successfully?
- [ ] Weekly backup script running successfully?
- [ ] Check backup logs for errors
- [ ] Verify backup file sizes are reasonable
- [ ] Test restore of random backup file
- [ ] Verify backups are being copied off-site
- [ ] Check available disk space (>100 GB free)
- [ ] Review and update backup retention policies
- [ ] Document any new volumes that need backing up
- [ ] Test database dumps can be restored
- [ ] Verify Bitcoin wallet backups encrypted
- [ ] Update this documentation if infrastructure changed

---

## See Also

- [INFRASTRUCTURE_INVENTORY.md](./INFRASTRUCTURE_INVENTORY.md) - Complete volume inventory
- [POSTGRES_PRODUCTION_CONFIG.md](./POSTGRES_PRODUCTION_CONFIG.md) - PostgreSQL backup details
- [/home/user/CLAUDE.md](../../CLAUDE.md) - Server-level documentation
- [Docker Volume Documentation](https://docs.docker.com/storage/volumes/)
