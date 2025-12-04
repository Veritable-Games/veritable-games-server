# Hybrid Storage Architecture Plan - Veritable Games Server
**Date**: December 4, 2025
**Status**: RESEARCH AND PLANNING (DO NOT EXECUTE)
**Purpose**: Design split storage strategy for failing SSD migration

---

## Executive Summary

This document provides a comprehensive plan to migrate from the failing Samsung SSD 850 (/dev/sda) to a hybrid storage architecture that:
- Keeps performance-critical data (PostgreSQL, application volumes) on SSD (/dev/sdb2)
- Moves large, growing data (Bitcoin blockchain) to HDD (/dev/sdc1)
- Maintains system recoverability and operational stability

**Current Status**: Emergency rsync backup in progress (86GB /var → /data)
**Target Architecture**: Hybrid SSD/HDD with selective volume placement
**Migration Strategy**: Per-volume relocation using Docker volume driver options

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Volume Inventory](#volume-inventory)
3. [Migration Approach](#migration-approach)
4. [Docker Configuration](#docker-configuration)
5. [Migration Procedure](#migration-procedure)
6. [Risks and Mitigation](#risks-and-mitigation)
7. [Rollback Procedure](#rollback-procedure)
8. [Testing Plan](#testing-plan)
9. [Future Considerations](#future-considerations)

---

## Architecture Overview

### Current State (Failed)

```
/dev/sda (938GB SSD - FAILED TWICE)
└── /var
    └── /var/lib/docker/
        ├── volumes/ (70GB)
        │   ├── generated_bitcoin_datadir (60GB) - Bitcoin blockchain
        │   ├── user_postgres_data (1GB) - VG database
        │   ├── generated_postgres_datadir (99MB) - BTCPay database
        │   ├── anarchist-library (1.3GB)
        │   ├── veritable-gallery (1.1GB)
        │   └── [22 other volumes] (~5GB)
        └── overlay2/ (16GB) - Docker images
```

### Target Architecture (Hybrid)

```
/dev/sdb2 (468GB SSD - Healthy)
├── / (root filesystem)
└── /var (bind mount to /mnt/ssd-volumes)
    └── /mnt/ssd-volumes/
        ├── lib/docker/
        │   ├── overlay2/ (16GB) - Docker images/layers
        │   └── containers/ (52MB) - Container runtime data
        └── volumes/ (10GB total for performance-critical volumes)
            ├── user_postgres_data/ (1GB) - VG PostgreSQL
            ├── generated_postgres_datadir/ (99MB) - BTCPay PostgreSQL
            ├── coolify-db/ (78MB) - Coolify PostgreSQL
            ├── anarchist-library/ (1.3GB) - Fast serving
            ├── m4s0kwo4kc4oooocck4sswc4-anarchist-library/ (1.3GB)
            ├── veritable-gallery/ (1.1GB) - Fast serving
            ├── m4s0kwo4kc4oooocck4sswc4-veritable-gallery/ (976MB)
            └── [app volumes] (~3GB)

/dev/sdc1 (5.5TB HDD - Healthy, 4.7TB free)
└── /data
    └── docker-hdd-volumes/
        ├── generated_bitcoin_datadir/ (60GB → 100GB pruned)
        └── [future large volumes]
```

### Placement Strategy

**SSD (/dev/sdb2) - Performance Critical**:
- PostgreSQL databases (requires fast I/O)
- Application data volumes (frequent access)
- User-facing content (anarchist library, gallery)
- Docker images/layers (build performance)
- Container runtime data

**HDD (/dev/sdc1) - Large & Sequential**:
- Bitcoin blockchain (60GB, sequential reads)
- Lightning data (if it grows large)
- Future large archives
- BTCPay backup storage

### Rationale

**Why Not Full /var Migration?**
- Wastes 211GB of available SSD space
- All services lose SSD performance unnecessarily
- PostgreSQL on HDD = 10-50x slower queries
- Application responsiveness degraded

**Why Hybrid Split?**
- Optimizes available resources (211GB SSD + 4.7TB HDD)
- Keeps critical services fast
- Accommodates Bitcoin's growth (current 60GB → 500GB+ eventually)
- Maintains system responsiveness

---

## Volume Inventory

### Complete Volume Analysis

| Volume Name | Current Size | Growth Rate | Proposed Location | Priority | Rationale |
|-------------|-------------|-------------|-------------------|----------|-----------|
| **BTCPay Server Volumes** |
| `generated_bitcoin_datadir` | 60GB | ~50GB/year | HDD | P1 | Large, sequential, will grow to 500GB+ |
| `generated_bitcoin_wallet_datadir` | 144KB | Minimal | SSD | P2 | Critical, tiny, needs backup |
| `generated_btcpay_datadir` | 40KB | Minimal | SSD | P2 | Config data, fast access |
| `generated_clightning_bitcoin_datadir` | 54MB | Moderate | SSD | P2 | Lightning node, frequent access |
| `generated_clightning_bitcoin_rtl_datadir` | Small | Minimal | SSD | P3 | UI state |
| `generated_nbxplorer_datadir` | 68KB | Minimal | SSD | P2 | BTCPay blockchain indexer |
| `generated_postgres_datadir` | 99MB | Slow | SSD | P1 | Database, needs fast I/O |
| `generated_tor_datadir` | Small | Minimal | SSD | P3 | Tor state |
| `generated_tor_servicesdir` | Small | Minimal | SSD | P3 | Tor hidden services |
| `generated_tor_torrcdir` | Small | Minimal | SSD | P3 | Tor config |
| **Veritable Games Volumes** |
| `user_postgres_data` | 1010MB | 100-200MB/year | SSD | P1 | PRIMARY DATABASE - CRITICAL |
| `anarchist-library` | 1.3GB | Complete | SSD | P2 | User-facing, fast serving |
| `m4s0kwo4kc4oooocck4sswc4-anarchist-library` | 1.3GB | Duplicate? | SSD | P2 | Check if duplicate or active |
| `veritable-gallery` | 1.1GB | Slow | SSD | P2 | Image serving, user-facing |
| `m4s0kwo4kc4oooocck4sswc4-veritable-gallery` | 976MB | Active | SSD | P2 | Active container volume |
| `marxists-library` | Unknown | Growing | SSD/HDD | P3 | Assess size, may move to HDD |
| `m4s0kwo4kc4oooocck4sswc4-marxists-library` | Unknown | Growing | SSD/HDD | P3 | Check usage |
| `veritable-news` | Unknown | TBD | SSD | P3 | Likely small |
| `veritable-user-uploads` | Unknown | Growing | SSD | P2 | User content |
| `veritable-wiki` | Unknown | Growing | SSD | P2 | Wiki content |
| **Coolify Volumes** |
| `coolify-db` | 78MB | Slow | SSD | P1 | PostgreSQL, critical for Coolify |
| `coolify-redis` | 660KB | Minimal | SSD | P2 | Cache, fast access needed |
| **Other** |
| `uptime-kuma-data` | Unknown | Minimal | SSD | P3 | Monitoring data |
| `user_pgadmin_data` | Unknown | Minimal | SSD | P3 | Admin UI state |

### Priority Definitions

- **P1 (Critical)**: Database volumes, must stay on SSD for performance
- **P2 (Important)**: Application data, user-facing content, frequent access
- **P3 (Standard)**: Configuration, logs, non-critical data

### Storage Math

**SSD Requirements** (P1 + P2):
- PostgreSQL databases: ~1.2GB
- Application volumes: ~7GB
- Docker images/overlay2: ~16GB
- Container runtime: 52MB
- **Total**: ~24GB (leaves 187GB free on /dev/sdb2)

**HDD Targets**:
- Bitcoin blockchain: 60GB (current) → 100GB (after pruning)
- Future growth: 4.6TB available

---

## Migration Approach

### Strategy: Per-Volume Bind Mounts

**Chosen Approach**: Use Docker volume `driver_opts` to specify custom mount points for individual volumes.

**Why This Approach?**
1. Granular control - each volume can go to optimal location
2. No global Docker data-root change (preserves existing volumes)
3. Volumes can be migrated one at a time (low risk)
4. Easy to test and rollback individual volumes
5. Well-documented in Docker Compose 3.8+ ([source](https://stackoverflow.com/questions/36387032/how-to-set-a-path-on-host-for-a-named-volume-in-docker-compose-yml))

**Alternative Considered**: Global data-root change
- **Pros**: Simple configuration
- **Cons**: Moves EVERYTHING, all-or-nothing, higher risk
- **Verdict**: Rejected - doesn't allow SSD/HDD split

### Migration Phases

**Phase 1: Prepare Storage Locations** (30 minutes)
- Create directories on SSD and HDD
- Set permissions
- Test write access

**Phase 2: Migrate Non-Critical Volumes** (1 hour)
- Start with small, non-critical volumes
- Test container restart after each
- Verify data integrity

**Phase 3: Migrate Bitcoin Blockchain** (2-4 hours)
- Largest volume (60GB)
- Stop BTCPay services
- rsync to HDD
- Update docker-compose
- Restart and verify

**Phase 4: Migrate Remaining Volumes** (1 hour)
- Complete remaining volumes
- Full service restart
- End-to-end testing

**Phase 5: Cleanup** (30 minutes)
- Remove old volume data from /var
- Document new locations
- Update monitoring

**Total Estimated Time**: 5-7 hours (can be done in stages)

---

## Docker Configuration

### BTCPay Server docker-compose.yml Changes

**Current Configuration** (`/home/user/btcpayserver-docker/Generated/docker-compose.generated.yml`):

```yaml
volumes:
  btcpay_datadir:
  btcpay_pluginsdir:
  bitcoin_datadir:
  bitcoin_wallet_datadir:
  clightning_bitcoin_datadir:
  clightning_bitcoin_rtl_datadir:
  tor_datadir:
  tor_torrcdir:
  tor_servicesdir:
  nbxplorer_datadir:
  postgres_datadir:
```

**Proposed Hybrid Configuration**:

```yaml
volumes:
  # PERFORMANCE-CRITICAL VOLUMES (SSD)
  btcpay_datadir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_btcpay_datadir

  btcpay_pluginsdir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_btcpay_pluginsdir

  bitcoin_wallet_datadir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_bitcoin_wallet_datadir

  postgres_datadir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_postgres_datadir

  clightning_bitcoin_datadir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_clightning_bitcoin_datadir

  clightning_bitcoin_rtl_datadir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_clightning_bitcoin_rtl_datadir

  nbxplorer_datadir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_nbxplorer_datadir

  tor_datadir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_tor_datadir

  tor_torrcdir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_tor_torrcdir

  tor_servicesdir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_tor_servicesdir

  # LARGE STORAGE VOLUMES (HDD)
  bitcoin_datadir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/docker-hdd-volumes/generated_bitcoin_datadir
```

### Veritable Games docker-compose.yml Changes

**File**: `/home/user/projects/veritable-games/resources/docker-compose.yml`

**Current**:
```yaml
volumes:
  postgres_data:
```

**Proposed**:
```yaml
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/user_postgres_data

  anarchist_library:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/anarchist-library

  veritable_gallery:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/veritable-gallery

  # Add other VG volumes as needed
```

### Coolify Volumes

**Note**: Coolify uses bind mounts to `/data/coolify/`, already on HDD. No changes needed.

### Directory Structure

**SSD Mount Point** (`/mnt/ssd-volumes/`):
```
/mnt/ssd-volumes/
├── volumes/
│   ├── generated_btcpay_datadir/
│   ├── generated_bitcoin_wallet_datadir/
│   ├── generated_postgres_datadir/
│   ├── user_postgres_data/
│   ├── anarchist-library/
│   ├── veritable-gallery/
│   └── [other SSD volumes]
└── docker-system/
    ├── overlay2/
    └── containers/
```

**HDD Mount Point** (`/data/docker-hdd-volumes/`):
```
/data/docker-hdd-volumes/
├── generated_bitcoin_datadir/
└── [future large volumes]
```

---

## Migration Procedure

### Prerequisites

**Before Starting**:
1. Current rsync backup to /data/var-migration-backup MUST be complete
2. Verify backup: `du -sh /data/var-migration-backup` (should be ~86GB)
3. Create fresh PostgreSQL dumps:
   ```bash
   docker exec veritable-games-postgres pg_dumpall -U postgres > /home/user/backups/postgres-pre-migration-$(date +%Y%m%d).sql
   docker exec generated_postgres_1 pg_dumpall -U postgres > /home/user/backups/btcpay-pre-migration-$(date +%Y%m%d).sql
   ```
4. Document current container state:
   ```bash
   docker ps -a > /home/user/backups/container-state-pre-migration.txt
   docker volume ls > /home/user/backups/volume-list-pre-migration.txt
   ```

### Step-by-Step Migration

#### Phase 1: Prepare Storage Locations (30 minutes)

**1.1 Create SSD mount point**:
```bash
# Create directory
sudo mkdir -p /mnt/ssd-volumes/volumes
sudo mkdir -p /mnt/ssd-volumes/docker-system
sudo chown -R root:root /mnt/ssd-volumes
sudo chmod 755 /mnt/ssd-volumes

# Verify space
df -h /mnt/ssd-volumes
# Should show 211GB available on /dev/sdb2
```

**1.2 Create HDD mount point**:
```bash
# Create directory
sudo mkdir -p /data/docker-hdd-volumes
sudo chown -R root:root /data/docker-hdd-volumes
sudo chmod 755 /data/docker-hdd-volumes

# Verify space
df -h /data/docker-hdd-volumes
# Should show 4.7TB available on /dev/sdc1
```

**1.3 Update /etc/fstab for /var bind mount**:
```bash
# Backup fstab
sudo cp /etc/fstab /etc/fstab.backup-$(date +%Y%m%d-%H%M%S)

# Edit fstab
sudo nano /etc/fstab

# Add line:
/mnt/ssd-volumes  /var  none  bind  0 0

# Save and exit
```

**Verification**:
```bash
# Test mount without rebooting
sudo mount -a

# Should see no errors
# Check mount
mount | grep /var
# Should show: /mnt/ssd-volumes on /var type none (bind)
```

#### Phase 2: Stop Services (5 minutes)

```bash
# Stop all Docker containers
docker stop $(docker ps -aq)

# Verify all stopped
docker ps -a | grep -v "Exited"
# Should show no running containers

# Stop Docker daemon
sudo systemctl stop docker

# Verify stopped
sudo systemctl status docker
# Should show: inactive (dead)
```

#### Phase 3: Migrate Docker System Files (15 minutes)

**3.1 Move overlay2 (Docker images/layers)**:
```bash
# Create target
sudo mkdir -p /mnt/ssd-volumes/docker-system/overlay2

# Move data (16GB, ~5 minutes on SSD)
sudo rsync -avh --progress /var/lib/docker/overlay2/ /mnt/ssd-volumes/docker-system/overlay2/

# Verify
sudo du -sh /var/lib/docker/overlay2
sudo du -sh /mnt/ssd-volumes/docker-system/overlay2
# Sizes should match

# Backup old, create symlink
sudo mv /var/lib/docker/overlay2 /var/lib/docker/overlay2.backup
sudo ln -s /mnt/ssd-volumes/docker-system/overlay2 /var/lib/docker/overlay2
```

**3.2 Move containers directory**:
```bash
sudo mkdir -p /mnt/ssd-volumes/docker-system/containers
sudo rsync -avh --progress /var/lib/docker/containers/ /mnt/ssd-volumes/docker-system/containers/
sudo mv /var/lib/docker/containers /var/lib/docker/containers.backup
sudo ln -s /mnt/ssd-volumes/docker-system/containers /var/lib/docker/containers
```

#### Phase 4: Migrate Performance-Critical Volumes to SSD (1 hour)

**Priority 1: PostgreSQL Databases**

**4.1 Veritable Games PostgreSQL** (1GB):
```bash
# Create target directory
sudo mkdir -p /mnt/ssd-volumes/volumes/user_postgres_data

# Copy data
sudo rsync -avh --progress \
  /var/lib/docker/volumes/user_postgres_data/_data/ \
  /mnt/ssd-volumes/volumes/user_postgres_data/

# Verify sizes match
sudo du -sh /var/lib/docker/volumes/user_postgres_data/_data
sudo du -sh /mnt/ssd-volumes/volumes/user_postgres_data
```

**4.2 BTCPay PostgreSQL** (99MB):
```bash
sudo mkdir -p /mnt/ssd-volumes/volumes/generated_postgres_datadir
sudo rsync -avh --progress \
  /var/lib/docker/volumes/generated_postgres_datadir/_data/ \
  /mnt/ssd-volumes/volumes/generated_postgres_datadir/
```

**4.3 Coolify PostgreSQL** (78MB):
```bash
sudo mkdir -p /mnt/ssd-volumes/volumes/coolify-db
sudo rsync -avh --progress \
  /var/lib/docker/volumes/coolify-db/_data/ \
  /mnt/ssd-volumes/volumes/coolify-db/
```

**Priority 2: Application Volumes**

**4.4 Anarchist Library** (1.3GB each):
```bash
# Original volume
sudo mkdir -p /mnt/ssd-volumes/volumes/anarchist-library
sudo rsync -avh --progress \
  /var/lib/docker/volumes/anarchist-library/_data/ \
  /mnt/ssd-volumes/volumes/anarchist-library/

# Application volume
sudo mkdir -p /mnt/ssd-volumes/volumes/m4s0kwo4kc4oooocck4sswc4-anarchist-library
sudo rsync -avh --progress \
  /var/lib/docker/volumes/m4s0kwo4kc4oooocck4sswc4-anarchist-library/_data/ \
  /mnt/ssd-volumes/volumes/m4s0kwo4kc4oooocck4sswc4-anarchist-library/
```

**4.5 Veritable Gallery** (~1GB each):
```bash
sudo mkdir -p /mnt/ssd-volumes/volumes/veritable-gallery
sudo rsync -avh --progress \
  /var/lib/docker/volumes/veritable-gallery/_data/ \
  /mnt/ssd-volumes/volumes/veritable-gallery/

sudo mkdir -p /mnt/ssd-volumes/volumes/m4s0kwo4kc4oooocck4sswc4-veritable-gallery
sudo rsync -avh --progress \
  /var/lib/docker/volumes/m4s0kwo4kc4oooocck4sswc4-veritable-gallery/_data/ \
  /mnt/ssd-volumes/volumes/m4s0kwo4kc4oooocck4sswc4-veritable-gallery/
```

**4.6 BTCPay Application Volumes** (all small):
```bash
# Bitcoin wallet (144KB - CRITICAL)
sudo mkdir -p /mnt/ssd-volumes/volumes/generated_bitcoin_wallet_datadir
sudo rsync -avh --progress \
  /var/lib/docker/volumes/generated_bitcoin_wallet_datadir/_data/ \
  /mnt/ssd-volumes/volumes/generated_bitcoin_wallet_datadir/

# Lightning (54MB)
sudo mkdir -p /mnt/ssd-volumes/volumes/generated_clightning_bitcoin_datadir
sudo rsync -avh --progress \
  /var/lib/docker/volumes/generated_clightning_bitcoin_datadir/_data/ \
  /mnt/ssd-volumes/volumes/generated_clightning_bitcoin_datadir/

# NBXplorer (68KB)
sudo mkdir -p /mnt/ssd-volumes/volumes/generated_nbxplorer_datadir
sudo rsync -avh --progress \
  /var/lib/docker/volumes/generated_nbxplorer_datadir/_data/ \
  /mnt/ssd-volumes/volumes/generated_nbxplorer_datadir/

# BTCPay data (40KB)
sudo mkdir -p /mnt/ssd-volumes/volumes/generated_btcpay_datadir
sudo rsync -avh --progress \
  /var/lib/docker/volumes/generated_btcpay_datadir/_data/ \
  /mnt/ssd-volumes/volumes/generated_btcpay_datadir/

# Tor volumes (all small)
sudo mkdir -p /mnt/ssd-volumes/volumes/generated_tor_datadir
sudo rsync -avh --progress \
  /var/lib/docker/volumes/generated_tor_datadir/_data/ \
  /mnt/ssd-volumes/volumes/generated_tor_datadir/

sudo mkdir -p /mnt/ssd-volumes/volumes/generated_tor_servicesdir
sudo rsync -avh --progress \
  /var/lib/docker/volumes/generated_tor_servicesdir/_data/ \
  /mnt/ssd-volumes/volumes/generated_tor_servicesdir/

sudo mkdir -p /mnt/ssd-volumes/volumes/generated_tor_torrcdir
sudo rsync -avh --progress \
  /var/lib/docker/volumes/generated_tor_torrcdir/_data/ \
  /mnt/ssd-volumes/volumes/generated_tor_torrcdir/

# Lightning RTL
sudo mkdir -p /mnt/ssd-volumes/volumes/generated_clightning_bitcoin_rtl_datadir
sudo rsync -avh --progress \
  /var/lib/docker/volumes/generated_clightning_bitcoin_rtl_datadir/_data/ \
  /mnt/ssd-volumes/volumes/generated_clightning_bitcoin_rtl_datadir/

# BTCPay plugins
sudo mkdir -p /mnt/ssd-volumes/volumes/generated_btcpay_pluginsdir
sudo rsync -avh --progress \
  /var/lib/docker/volumes/generated_btcpay_pluginsdir/_data/ \
  /mnt/ssd-volumes/volumes/generated_btcpay_pluginsdir/
```

**4.7 Other SSD Volumes**:
```bash
# Coolify Redis
sudo mkdir -p /mnt/ssd-volumes/volumes/coolify-redis
sudo rsync -avh --progress \
  /var/lib/docker/volumes/coolify-redis/_data/ \
  /mnt/ssd-volumes/volumes/coolify-redis/

# Uptime Kuma
sudo mkdir -p /mnt/ssd-volumes/volumes/uptime-kuma-data
sudo rsync -avh --progress \
  /var/lib/docker/volumes/uptime-kuma-data/_data/ \
  /mnt/ssd-volumes/volumes/uptime-kuma-data/

# PgAdmin
sudo mkdir -p /mnt/ssd-volumes/volumes/user_pgadmin_data
sudo rsync -avh --progress \
  /var/lib/docker/volumes/user_pgadmin_data/_data/ \
  /mnt/ssd-volumes/volumes/user_pgadmin_data/
```

#### Phase 5: Migrate Bitcoin Blockchain to HDD (2-4 hours)

**5.1 Copy Bitcoin blockchain** (60GB - LARGEST VOLUME):
```bash
# Create target
sudo mkdir -p /data/docker-hdd-volumes/generated_bitcoin_datadir

# Copy with progress (this will take 2-4 hours on HDD)
sudo rsync -avh --progress --info=progress2 \
  /var/lib/docker/volumes/generated_bitcoin_datadir/_data/ \
  /data/docker-hdd-volumes/generated_bitcoin_datadir/ \
  --log-file=/home/user/bitcoin-migration-$(date +%Y%m%d-%H%M%S).log

# Monitor in another terminal
tail -f /home/user/bitcoin-migration-*.log

# Verify after completion
sudo du -sh /var/lib/docker/volumes/generated_bitcoin_datadir/_data
sudo du -sh /data/docker-hdd-volumes/generated_bitcoin_datadir
# Should both show ~60GB
```

#### Phase 6: Update Docker Compose Configurations (15 minutes)

**6.1 Update BTCPay docker-compose**:
```bash
cd /home/user/btcpayserver-docker

# Backup current config
cp Generated/docker-compose.generated.yml.backup Generated/docker-compose.generated.yml.backup-pre-hybrid

# Edit the active compose file
# NOTE: BTCPay regenerates this file, so we need to modify the template
# Location: docker-compose-generator/docker-fragments/

# For now, manually edit the generated file for testing:
nano Generated/docker-compose.generated.yml.backup

# Replace the volumes: section at the bottom with the hybrid configuration
# (See "Docker Configuration" section above for full YAML)
```

**Important**: BTCPay Server uses a docker-compose generator. For permanent changes:
1. Identify which fragment files are being used
2. Create custom fragment with volume configurations
3. Re-run btcpay-setup.sh with custom fragment
4. OR: Manually maintain docker-compose.generated.yml (not recommended)

**6.2 Create standalone docker-compose for hybrid volumes**:

Create `/home/user/btcpayserver-docker/docker-compose.hybrid-volumes.yml`:
```yaml
version: "3"

# This file defines volume configurations for hybrid storage
# Use with: docker-compose -f docker-compose.generated.yml -f docker-compose.hybrid-volumes.yml up

volumes:
  # SSD VOLUMES
  btcpay_datadir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_btcpay_datadir

  bitcoin_wallet_datadir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_bitcoin_wallet_datadir

  postgres_datadir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd-volumes/volumes/generated_postgres_datadir

  # HDD VOLUMES
  bitcoin_datadir:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/docker-hdd-volumes/generated_bitcoin_datadir
```

**6.3 Update Veritable Games docker-compose**:
```bash
cd /home/user/projects/veritable-games/resources

# Backup
cp docker-compose.yml docker-compose.yml.backup-$(date +%Y%m%d)

# Edit
nano docker-compose.yml

# Update volumes section (see Docker Configuration section above)
```

#### Phase 7: Rename Old Docker Volumes (Safety Net) (10 minutes)

**Instead of deleting, rename old volumes for safety**:
```bash
cd /var/lib/docker/volumes

# Rename volumes to .backup suffix
sudo mv generated_bitcoin_datadir generated_bitcoin_datadir.backup
sudo mv user_postgres_data user_postgres_data.backup
sudo mv generated_postgres_datadir generated_postgres_datadir.backup
# ... repeat for all migrated volumes

# Create placeholder directories (Docker will use bind mounts instead)
sudo mkdir generated_bitcoin_datadir
sudo mkdir user_postgres_data
# ... etc
```

#### Phase 8: Start Docker and Test (30 minutes)

**8.1 Start Docker daemon**:
```bash
sudo systemctl start docker
sudo systemctl status docker
# Should show: active (running)

# Check Docker root
docker info | grep "Docker Root Dir"
# Should still show: /var/lib/docker
```

**8.2 Test with non-critical container first**:
```bash
# Start Coolify (has its own bind mounts, good test)
docker start coolify-db
docker start coolify-redis
docker start coolify

# Wait 30 seconds
sleep 30

# Check logs
docker logs coolify --tail 50
# Should show normal startup, no volume errors

# Check volumes mounted correctly
docker inspect coolify | grep -A 5 Mounts
```

**8.3 Start PostgreSQL containers**:
```bash
# Veritable Games PostgreSQL
docker start veritable-games-postgres

# Wait 10 seconds
sleep 10

# Test connection
docker exec veritable-games-postgres psql -U postgres -c "SELECT version();"

# Check data
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM shared.tags;"
# Should show expected count

# BTCPay PostgreSQL
docker start generated_postgres_1
sleep 10
docker exec generated_postgres_1 psql -U postgres -c "SELECT version();"
```

**8.4 Start BTCPay services**:
```bash
cd /home/user/btcpayserver-docker

# Start Bitcoin node (now using HDD volume)
docker start btcpayserver_bitcoind

# Wait and check logs
sleep 30
docker logs btcpayserver_bitcoind --tail 50
# Should show Bitcoin Core starting, loading blockchain

# Check blockchain access
docker exec btcpayserver_bitcoind bitcoin-cli getblockchaininfo
# Should show normal response

# Start other BTCPay services
docker start generated_nbxplorer_1
docker start btcpayserver_clightning_bitcoin
docker start generated_btcpayserver_1

# Check all running
docker ps | grep btcpay
```

**8.5 Start Veritable Games application**:
```bash
docker start m4s0kwo4kc4oooocck4sswc4

# Wait for startup
sleep 60

# Check logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100

# Test website
curl -I https://www.veritablegames.com
# Should return HTTP 200
```

#### Phase 9: Verification and Testing (1 hour)

**9.1 Volume Mount Verification**:
```bash
# Check all containers see correct volumes
for container in $(docker ps -q); do
  echo "=== $(docker inspect --format='{{.Name}}' $container) ==="
  docker inspect $container --format='{{range .Mounts}}{{.Type}}: {{.Source}} -> {{.Destination}}{{println}}{{end}}'
  echo ""
done

# Verify PostgreSQL data directories
docker exec veritable-games-postgres ls -lh /var/lib/postgresql/data/
docker exec generated_postgres_1 ls -lh /var/lib/postgresql/data/

# Verify Bitcoin data directory
docker exec btcpayserver_bitcoind ls -lh /data/
```

**9.2 Performance Testing**:
```bash
# PostgreSQL query performance (should be fast - SSD)
time docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM library.documents;"

# Bitcoin RPC response time (acceptable on HDD - sequential reads)
time docker exec btcpayserver_bitcoind bitcoin-cli getblockchaininfo
```

**9.3 Application Testing**:
```bash
# Test Veritable Games website
curl https://www.veritablegames.com/library | grep -o "<title>.*</title>"
curl https://www.veritablegames.com/api/health

# Test BTCPay Server
curl -I https://btcpay.veritablegames.com
# Should return HTTP 200

# Test Coolify
curl -I http://192.168.1.15:8000
```

**9.4 Disk Usage Verification**:
```bash
# SSD usage
df -h /mnt/ssd-volumes
# Should show ~24GB used, ~187GB free

# HDD usage
df -h /data
# Should show Bitcoin blockchain (~60GB) + existing data

# Old /var usage (should be empty except backups)
sudo du -sh /var/lib/docker/volumes/*.backup
```

#### Phase 10: Cleanup (After 24-48 Hours of Stable Operation)

**Only after confirming everything works for 24-48 hours**:

```bash
# Remove old volume backups
sudo rm -rf /var/lib/docker/volumes/*.backup

# Remove backup from /data (after confirming hybrid works)
sudo rm -rf /data/var-migration-backup

# Update documentation
nano /home/user/CLAUDE.md
# Document new hybrid storage architecture

# Create backup of new configuration
sudo rsync -avh /mnt/ssd-volumes/ /home/user/backups/ssd-volumes-$(date +%Y%m%d)/
```

---

## Risks and Mitigation

### Risk 1: Data Corruption During Migration

**Risk Level**: MEDIUM
**Impact**: Database corruption, application failure

**Mitigation**:
1. Stop all containers before copying volumes
2. Use `rsync -a` to preserve permissions and ownership
3. Verify checksums after copy:
   ```bash
   find /var/lib/docker/volumes/user_postgres_data/_data -type f -exec md5sum {} \; > /tmp/checksums-old.txt
   find /mnt/ssd-volumes/volumes/user_postgres_data -type f -exec md5sum {} \; > /tmp/checksums-new.txt
   diff /tmp/checksums-old.txt /tmp/checksums-new.txt
   ```
4. Keep old volumes as `.backup` until verified working
5. Have PostgreSQL dumps ready for restoration

**Recovery**: Restore from .backup volumes or PostgreSQL dumps

### Risk 2: Incorrect Permissions

**Risk Level**: HIGH
**Impact**: Containers can't access data, startup failures

**Mitigation**:
1. Use `rsync -a` to preserve ownership
2. Verify ownership matches original:
   ```bash
   ls -la /var/lib/docker/volumes/user_postgres_data/_data/
   ls -la /mnt/ssd-volumes/volumes/user_postgres_data/
   # Should show same user:group (typically root:root or 999:999 for postgres)
   ```
3. Fix permissions if needed:
   ```bash
   sudo chown -R $(stat -c '%u:%g' /var/lib/docker/volumes/user_postgres_data/_data) \
     /mnt/ssd-volumes/volumes/user_postgres_data
   ```

**Recovery**: Fix permissions before starting containers

### Risk 3: Docker Compose Volume Definition Errors

**Risk Level**: MEDIUM
**Impact**: Docker creates new empty volumes instead of using bind mounts

**Mitigation**:
1. Test with one container first (Coolify)
2. Verify mount points after container starts:
   ```bash
   docker inspect <container> | grep -A 10 Mounts
   ```
3. Check for new empty volumes:
   ```bash
   docker volume ls | grep $(date +%Y%m%d)
   # Should not show new volumes created today
   ```

**Recovery**: Stop container, fix docker-compose.yml, remove new empty volume, restart

### Risk 4: /var Bind Mount Failure

**Risk Level**: LOW
**Impact**: Docker can't start, system issues

**Mitigation**:
1. Test fstab changes with `mount -a` before rebooting
2. Keep fstab backup for quick restoration
3. Ensure /mnt/ssd-volumes exists before adding to fstab

**Recovery**: Boot to recovery mode, restore fstab, reboot

### Risk 5: HDD Performance Degradation

**Risk Level**: LOW
**Impact**: Bitcoin sync slower, BTCPay response time increases

**Mitigation**:
1. Bitcoin blockchain is already sequential I/O (HDD-friendly)
2. Monitor BTCPay response times after migration
3. Consider Bitcoin pruning to reduce HDD I/O
4. Keep option to move back to SSD if needed

**Recovery**: Not critical, acceptable performance tradeoff

### Risk 6: Space Exhaustion on SSD

**Risk Level**: LOW
**Impact**: Application volumes can't grow

**Mitigation**:
1. Monitor SSD usage regularly
2. Current allocation: 24GB used, 187GB free (plenty of headroom)
3. Move additional volumes to HDD if needed
4. Implement disk usage alerts

**Recovery**: Move non-critical volumes to HDD

### Risk 7: BTCPay Docker Compose Regeneration

**Risk Level**: MEDIUM
**Impact**: Running `btcpay-update.sh` overwrites volume configs

**Mitigation**:
1. Use overlay docker-compose file (docker-compose.hybrid-volumes.yml)
2. Document custom changes clearly
3. Test btcpay-update.sh in dry-run first
4. Keep backup of working docker-compose

**Recovery**: Restore docker-compose.hybrid-volumes.yml, restart services

---

## Rollback Procedure

### If Migration Fails - Complete Rollback

**Time Required**: 30-60 minutes
**When to Use**: Migration catastrophically fails, need to restore original state

**Step 1: Stop Everything**
```bash
docker stop $(docker ps -aq)
sudo systemctl stop docker
```

**Step 2: Restore fstab**
```bash
sudo cp /etc/fstab.backup-YYYYMMDD-HHMMSS /etc/fstab
```

**Step 3: Remove bind mounts**
```bash
# Remove /var bind mount if added
sudo umount /var 2>/dev/null || true

# Remove symlinks
sudo rm /var/lib/docker/overlay2 2>/dev/null || true
sudo rm /var/lib/docker/containers 2>/dev/null || true
```

**Step 4: Restore original volumes**
```bash
cd /var/lib/docker/volumes

# Restore from backups
sudo rm -rf generated_bitcoin_datadir
sudo mv generated_bitcoin_datadir.backup generated_bitcoin_datadir

sudo rm -rf user_postgres_data
sudo mv user_postgres_data.backup user_postgres_data

# Repeat for all volumes
```

**Step 5: Restore docker-compose configs**
```bash
cd /home/user/btcpayserver-docker
cp Generated/docker-compose.generated.yml.backup-pre-hybrid Generated/docker-compose.generated.yml.backup

cd /home/user/projects/veritable-games/resources
cp docker-compose.yml.backup-YYYYMMDD docker-compose.yml
```

**Step 6: Restart Docker**
```bash
sudo systemctl start docker
docker start $(docker ps -aq)
```

**Step 7: Verify Rollback**
```bash
# Check containers
docker ps -a

# Check PostgreSQL
docker exec veritable-games-postgres psql -U postgres -c "SELECT 1;"

# Check website
curl -I https://www.veritablegames.com
```

### Partial Rollback - Single Volume

**If one volume fails but others work**:

```bash
# Stop affected container
docker stop <container-name>

# Restore volume
cd /var/lib/docker/volumes
sudo rm -rf <volume-name>
sudo mv <volume-name>.backup <volume-name>

# Revert docker-compose for that volume
# (remove driver_opts section)

# Restart container
docker start <container-name>
```

---

## Testing Plan

### Pre-Migration Testing (Before Any Changes)

**Test 1: Baseline Performance**
```bash
# PostgreSQL query performance
time docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM library.documents;"
# Record time: _____ seconds

# Bitcoin RPC latency
time docker exec btcpayserver_bitcoind bitcoin-cli getblockchaininfo
# Record time: _____ seconds

# Website response time
time curl -I https://www.veritablegames.com
# Record time: _____ seconds
```

**Test 2: Backup Verification**
```bash
# Verify PostgreSQL dumps restore correctly
gunzip -c /home/user/backups/postgres-pre-migration-YYYYMMDD.sql | wc -l
# Should show reasonable line count (thousands+)

# Verify rsync backup
ls -lh /data/var-migration-backup/lib/docker/volumes/
# Should show all expected volumes
```

### During Migration Testing (After Each Phase)

**Test 3: Volume Copy Verification**
```bash
# After copying each volume, verify:
ORIGINAL_SIZE=$(sudo du -sb /var/lib/docker/volumes/VOLUME_NAME/_data | cut -f1)
NEW_SIZE=$(sudo du -sb /mnt/ssd-volumes/volumes/VOLUME_NAME | cut -f1)

if [ "$ORIGINAL_SIZE" -eq "$NEW_SIZE" ]; then
  echo "✓ Volume copied successfully: $ORIGINAL_SIZE bytes"
else
  echo "✗ SIZE MISMATCH! Original: $ORIGINAL_SIZE, New: $NEW_SIZE"
  exit 1
fi
```

**Test 4: Container Start Test**
```bash
# After starting each container
docker inspect CONTAINER_NAME --format='{{.State.Status}}'
# Should show: running

docker logs CONTAINER_NAME --tail 20
# Should show normal startup, no volume errors
```

### Post-Migration Testing (After Complete Migration)

**Test 5: Data Integrity**
```bash
# PostgreSQL data check
docker exec veritable-games-postgres psql -U postgres -d veritable_games <<EOF
SELECT
  (SELECT COUNT(*) FROM shared.tags) as tag_count,
  (SELECT COUNT(*) FROM library.documents) as doc_count,
  (SELECT COUNT(*) FROM auth.users) as user_count;
EOF
# Compare with pre-migration counts

# Bitcoin blockchain verification
docker exec btcpayserver_bitcoind bitcoin-cli verifychain
# Should complete without errors

# Lightning node verification
docker exec btcpayserver_clightning_bitcoin lightning-cli getinfo
# Should show correct node ID
```

**Test 6: Performance Comparison**
```bash
# Re-run baseline tests, compare times
# PostgreSQL (should be similar - both SSD)
time docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM library.documents;"
# Compare with baseline

# Bitcoin (may be slower - now HDD, but acceptable)
time docker exec btcpayserver_bitcoind bitcoin-cli getblockchaininfo
# Should be < 5 seconds still

# Website (should be same - app logic unchanged)
time curl -I https://www.veritablegames.com
```

**Test 7: End-to-End Application Testing**
```bash
# Veritable Games Library
curl https://www.veritablegames.com/library/anarchist | grep -o "documents" | wc -l
# Should show results

# BTCPay invoice creation
# (Manual test in BTCPay web UI)
# Create test invoice, verify it appears in database

# Coolify deployment
# (Manual test)
# Trigger deployment, verify it works
```

**Test 8: Disk Space Verification**
```bash
# SSD usage check
df -h /mnt/ssd-volumes
# Should show ~24GB used (databases + app volumes)

# HDD usage check
df -h /data
# Should show ~60GB (Bitcoin blockchain)

# Verify old /var is not growing
du -sh /var/lib/docker/volumes/*.backup
# Should be static (not growing)
```

### 24-Hour Stability Testing

**Test 9: Monitor for 24 Hours**
```bash
# Create monitoring script
cat > /home/user/hybrid-storage-monitor.sh <<'EOF'
#!/bin/bash
while true; do
  echo "=== $(date) ==="

  # Container status
  docker ps --format "{{.Names}}: {{.Status}}" | grep -v "Up"

  # Disk usage
  df -h /mnt/ssd-volumes | tail -1
  df -h /data | tail -1

  # PostgreSQL health
  docker exec veritable-games-postgres psql -U postgres -c "SELECT 1;" 2>&1 | grep -v "1 row"

  echo ""
  sleep 3600  # Check every hour
done
EOF

chmod +x /home/user/hybrid-storage-monitor.sh

# Run in background
nohup /home/user/hybrid-storage-monitor.sh > /home/user/hybrid-storage-monitor.log 2>&1 &

# Check logs
tail -f /home/user/hybrid-storage-monitor.log
```

**Test 10: Reboot Test**
```bash
# After 24 hours of stability, test reboot
sudo reboot

# After reboot, verify:
# - All containers auto-start
# - All volumes mount correctly
# - All services respond

docker ps -a
curl -I https://www.veritablegames.com
curl -I https://btcpay.veritablegames.com
```

### Success Criteria

**Migration is successful if**:
- ✅ All containers start without errors
- ✅ All volumes mount to correct locations (SSD or HDD)
- ✅ PostgreSQL databases accessible and complete
- ✅ Bitcoin blockchain loads correctly
- ✅ Websites respond normally (< 3 second response time)
- ✅ No data loss (all counts match pre-migration)
- ✅ System stable for 24 hours
- ✅ Survives reboot test
- ✅ SSD usage < 30GB (leaving room for growth)
- ✅ HDD usage shows Bitcoin blockchain

---

## Future Considerations

### 1. Bitcoin Blockchain Pruning

**Current**: 60GB blockchain (full node)
**Potential**: 100GB pruned node (recommended for hybrid setup)

**Why Prune?**
- Reduces HDD I/O
- Frees up space for future growth
- Still fully validates all blocks
- Works fine for BTCPay Server ([source](https://github.com/btcpayserver/btcpayserver-docker))

**How to Enable Pruning** ([source](https://docs.btcpayserver.org/FAQ/Synchronization/)):

Edit `/home/user/btcpayserver-docker/Generated/docker-compose.generated.yml`:
```yaml
bitcoind:
  environment:
    BITCOIN_EXTRA_ARGS: |
      prune=100000  # Keep ~100GB of blocks (~1 year)
      # ... other args
```

**Pruning Options**:
- `prune=100000` → ~100GB (~1 year of blocks) - RECOMMENDED
- `prune=50000` → ~50GB (~6 months)
- `prune=25000` → ~25GB (~3 months)
- `prune=5000` → ~5GB (~2 weeks, Lightning not supported)

**Migration to Pruned Node**:
1. Stop Bitcoin container
2. Add prune parameter
3. Restart container
4. Bitcoin will prune on next startup
5. Space freed gradually

**Estimated Timeline**: 2-3 days for full pruning to complete

### 2. Additional Volume Migrations

**Candidates for HDD Migration** (if they grow large):
- Marxists Library (currently unknown size)
  - If > 5GB → move to HDD
  - If < 5GB → keep on SSD
- Future literature archives
- Backup volumes (already on HDD at /data/coolify/backups)

**Decision Criteria**:
- Size > 5GB → HDD candidate
- Infrequent access → HDD candidate
- Sequential I/O → HDD OK
- Random I/O / database → keep on SSD

### 3. SSD Space Monitoring

**Set up Automated Alerts**:

Create `/home/user/backups/scripts/ssd-space-monitor.sh`:
```bash
#!/bin/bash

SSD_USAGE=$(df /mnt/ssd-volumes | tail -1 | awk '{print $5}' | sed 's/%//')

if [ "$SSD_USAGE" -gt 70 ]; then
  echo "WARNING: SSD usage at ${SSD_USAGE}%" | \
    tee -a /home/user/backups/ssd-alerts.log

  # List largest volumes
  du -sh /mnt/ssd-volumes/volumes/* | sort -h | tail -10
fi
```

Add to cron:
```bash
0 */6 * * * /home/user/backups/scripts/ssd-space-monitor.sh
```

### 4. Future SSD Upgrade Path

**When SSD space becomes constrained** (> 70% used):

**Option A**: Move more volumes to HDD
- Identify low-usage volumes
- Migrate to HDD using same procedure

**Option B**: Add second SSD
- Install additional SSD
- Mount at `/mnt/ssd-volumes-2`
- Migrate some volumes to new SSD

**Option C**: Replace SSD with larger one
- Buy larger SSD (1TB+)
- Clone SSD to new drive
- Replace hardware
- Expand partition

### 5. HDD Health Monitoring

**Monitor HDD health** (critical for Bitcoin blockchain):

```bash
# Install smartmontools
sudo apt install smartmontools

# Check HDD health
sudo smartctl -a /dev/sdc

# Add to weekly cron
0 2 * * 0 sudo smartctl -a /dev/sdc > /home/user/backups/hdd-health-$(date +%Y%m%d).txt
```

**Warning signs**:
- Reallocated sectors > 0
- Current pending sectors > 0
- Offline uncorrectable > 0
- Temperature > 55°C

### 6. Backup Strategy Updates

**Current**: Daily PostgreSQL dumps to /home/user/backups

**Add**:
1. **Weekly SSD volume snapshots**:
   ```bash
   sudo rsync -a /mnt/ssd-volumes/volumes/ /data/backups/ssd-volumes-weekly/
   ```

2. **Monthly Bitcoin blockchain backup** (after pruning):
   ```bash
   # Only if pruned to 100GB (manageable size)
   sudo rsync -a /data/docker-hdd-volumes/generated_bitcoin_datadir/ \
     /data/backups/bitcoin-blockchain-monthly/
   ```

3. **Offsite backups** (critical data only):
   - PostgreSQL dumps → rsync to laptop
   - Bitcoin wallet.dat → encrypted USB
   - Lightning hsm_secret → encrypted USB

### 7. Performance Optimization

**If HDD performance becomes a bottleneck**:

**Option A**: Enable HDD write cache
```bash
sudo hdparm -W1 /dev/sdc  # Enable write cache
```

**Option B**: Tune filesystem for large files
```bash
# Remount with optimized options
sudo mount -o remount,noatime,nodiratime,commit=60 /data
```

**Option C**: Add read cache
```bash
# Use bcache or dm-cache to cache HDD reads on SSD
# (Advanced - requires kernel modules)
```

### 8. Container Growth Projections

**5-Year Projection**:

| Volume | Current | 1 Year | 5 Years | Strategy |
|--------|---------|--------|---------|----------|
| VG PostgreSQL | 1GB | 1.2GB | 2GB | SSD (plenty of room) |
| Bitcoin blockchain (pruned) | 60GB | 100GB | 100GB | HDD (capped by pruning) |
| Anarchist library | 1.3GB | 1.3GB | 1.3GB | SSD (static) |
| Marxists library | TBD | 5GB | 5GB | SSD or HDD |
| User uploads | 0 | 1GB | 10GB | SSD → HDD at 5GB |
| **Total SSD** | 24GB | 30GB | 40GB | Safe (170GB headroom) |
| **Total HDD** | 60GB | 105GB | 120GB | Safe (4.5TB headroom) |

**Conclusion**: Current hybrid architecture sustainable for 5+ years with no hardware upgrades needed.

### 9. Documentation Maintenance

**Update These Files After Migration**:
1. `/home/user/CLAUDE.md` - Document hybrid storage
2. `/home/user/docs/server/DRIVE_ARCHITECTURE.md` - Update drive usage
3. `/home/user/docs/server/CONTAINER_PROTECTION_AND_RECOVERY.md` - Update volume locations
4. `/home/user/docs/server/BTCPAY_DISASTER_RECOVERY_GUIDE.md` - Update backup paths

**Create New Documentation**:
1. `/home/user/docs/server/HYBRID_STORAGE_OPERATIONS.md` - Day-to-day operations
2. `/home/user/docs/server/VOLUME_MIGRATION_HISTORY.md` - Track migrations

### 10. Alternative Approaches (For Reference)

**If Hybrid Proves Too Complex**:

**Plan B**: Full Migration to HDD
- Move entire /var to /data
- Accept slower performance for all services
- Simpler to maintain
- 4.7TB space available

**Plan C**: External Storage
- Add USB3 external drive
- Move Bitcoin blockchain to external
- Keep critical data on internal drives
- Risk: USB disconnect issues

**Plan D**: Cloud-Hybrid
- Keep local PostgreSQL (low latency needed)
- Move Bitcoin to cloud VPS (Voltage, Luna Node)
- Use BTCPay's external node support
- Cost: $20-50/month

---

## Summary and Recommendations

### Recommended Approach

**PRIMARY RECOMMENDATION**: Hybrid SSD/HDD storage with per-volume bind mounts

**Why This is Best**:
1. ✅ Optimizes available resources (211GB SSD + 4.7TB HDD)
2. ✅ Keeps critical services fast (PostgreSQL on SSD)
3. ✅ Accommodates Bitcoin growth (HDD for blockchain)
4. ✅ Low risk (volumes migrated one at a time)
5. ✅ Easily reversible (keep .backup volumes)
6. ✅ Sustainable long-term (5+ year capacity)

**Estimated Downtime**:
- Planning: 1-2 hours
- Execution: 5-7 hours (can stage over multiple days)
- Total: Can be done in a weekend with minimal impact

**Success Probability**: HIGH (90%+)
- Well-documented procedure
- Multiple rollback points
- Extensive testing plan
- Based on proven Docker features

### Alternative If Hybrid Too Complex

**ALTERNATIVE**: Simple /var migration to HDD

If the hybrid approach seems too complex:
1. Follow existing `/home/user/docs/server/VAR_MIGRATION_PLAN_DEC04_2025.md`
2. Accept slower performance for all services
3. Simpler implementation (one bind mount)
4. Trade-off: PostgreSQL will be slower on HDD

**When to Choose Alternative**:
- Need quickest possible recovery
- Prefer simplicity over optimization
- Willing to accept performance degradation
- Can upgrade to hybrid later if needed

### Key Success Factors

1. **Complete current rsync backup first** - Safety net
2. **Test with non-critical containers first** - Coolify, uptime-kuma
3. **Migrate in phases** - Don't do everything at once
4. **Keep .backup volumes for 48 hours** - Easy rollback
5. **Monitor for 24 hours before cleanup** - Verify stability
6. **Document everything** - Update CLAUDE.md and other docs

### Next Steps

**Immediate** (After drive recovers or after rsync completes):
1. Verify current backup status
2. Create fresh PostgreSQL dumps
3. Review this plan with user
4. Get approval to proceed

**Phase 1 Execution** (Day 1):
1. Create mount points
2. Migrate Docker system files
3. Test with Coolify

**Phase 2 Execution** (Day 2):
1. Migrate PostgreSQL volumes
2. Test database access
3. Migrate application volumes

**Phase 3 Execution** (Day 3):
1. Migrate Bitcoin blockchain
2. Update docker-compose configs
3. Full system restart and testing

**Post-Migration** (Day 4+):
1. 24-hour stability monitoring
2. Performance comparison
3. Documentation updates
4. Cleanup old volumes

---

## Technical References

### Docker Documentation
- [Bind mounts | Docker Docs](https://docs.docker.com/engine/storage/bind-mounts/)
- [Volumes | Docker Docs](https://docs.docker.com/engine/storage/volumes/)
- [Docker volume plugins | Docker Docs](https://docs.docker.com/engine/extend/plugins_volume/)
- [Define and manage volumes in Docker Compose](https://docs.docker.com/reference/compose-file/volumes/)

### Docker Volume Configuration
- [How to set a path on host for a named volume in docker-compose.yml - Stack Overflow](https://stackoverflow.com/questions/36387032/how-to-set-a-path-on-host-for-a-named-volume-in-docker-compose-yml)
- [Docker daemon configuration overview](https://docs.docker.com/engine/daemon/)
- [How to Change Docker's Default Data Directory](https://linuxiac.com/how-to-change-docker-data-directory/)

### BTCPay Server
- [GitHub - btcpayserver/btcpayserver-docker](https://github.com/btcpayserver/btcpayserver-docker)
- [Synchronization FAQ | BTCPay Server](https://docs.btcpayserver.org/FAQ/Synchronization/)
- [Bitcoin Blockchain Size Management: Pruning and Storage Optimization Guide | Markaicode](https://markaicode.com/bitcoin-blockchain-size-management-pruning-storage-optimization/)

### Performance Optimization
- [Optimizing Docker Storage: Volume Management and Disk I/O | overcast blog](https://overcast.blog/optimizing-docker-storage-volume-management-and-disk-i-o-0c4e6af35886)
- [Why does a pick between HDD and SSD matter when synchronizing cryptocurrency over the internet? - Server Fault](https://serverfault.com/questions/1165243/why-does-a-pick-between-hdd-and-ssd-matter-when-synchronizing-cryptocurrency-ove)

### Local Server Documentation
- `/home/user/CLAUDE.md` - Server-level guidance
- `/home/user/docs/server/DRIVE_ARCHITECTURE.md` - Dual-drive architecture
- `/home/user/docs/server/VAR_MIGRATION_PLAN_DEC04_2025.md` - Emergency migration plan
- `/home/user/docs/server/BTCPAY_DISASTER_RECOVERY_GUIDE.md` - BTCPay recovery procedures
- `/home/user/docs/server/CONTAINER_PROTECTION_AND_RECOVERY.md` - Container safeguards

---

**Document Version**: 1.0
**Created**: December 4, 2025
**Status**: PLANNING COMPLETE - AWAITING APPROVAL TO EXECUTE
**Estimated Implementation Time**: 5-7 hours over 3 days
**Risk Level**: LOW-MEDIUM (with proper testing and rollback procedures)

**END OF HYBRID STORAGE ARCHITECTURE PLAN**
