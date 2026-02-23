# Veritable Games Server Migration Guide

**Date**: February 6, 2026
**Purpose**: Complete server rebuild guide for new hardware
**Target Hardware**: AMD Ryzen 9 7900X + W7900 48GB + Samsung 9100 PRO 2TB NVMe
**Estimated Time**: 45-90 minutes

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [New Drive Layout](#2-new-drive-layout)
3. [Phase 1: Base System Installation](#3-phase-1-base-system-installation)
4. [Phase 2: Docker & Coolify Setup](#4-phase-2-docker--coolify-setup)
5. [Phase 3: PostgreSQL Database](#5-phase-3-postgresql-database)
6. [Phase 4: Application Deployment](#6-phase-4-application-deployment)
7. [Phase 5: Network Configuration](#7-phase-5-network-configuration)
8. [Phase 6: Data Migration](#8-phase-6-data-migration)
9. [Phase 7: Monitoring & Automation](#9-phase-7-monitoring--automation)
10. [Environment Variables Reference](#10-environment-variables-reference)
11. [Verification Checklist](#11-verification-checklist)
12. [Troubleshooting](#12-troubleshooting)

**Appendices:**
- [Appendix A: WireGuard Configuration](#appendix-a-wireguard-configuration-actual-keys)
- [Appendix B: BTCPay Server Setup](#appendix-b-btcpay-server-setup)
- [Appendix C: Cloudflare Tunnel Configuration](#appendix-c-cloudflare-tunnel-configuration)
- [Appendix D: Complete Environment Variables](#appendix-d-complete-environment-variables)
- [Appendix E: Backup & Recovery Scripts](#appendix-e-backup--recovery-scripts)
- [Appendix F: Service Architecture Diagram](#appendix-f-service-architecture-diagram)
- [Appendix G: Port Reference](#appendix-g-port-reference)
- [Appendix H: Quick Recovery Commands](#appendix-h-quick-recovery-commands)
- [Appendix I: AMD GPU Setup for LLM Inference](#appendix-i-amd-gpu-setup-for-llm-inference)
- [Appendix J: Coolify Advanced Configuration](#appendix-j-coolify-advanced-configuration)
- [Appendix K: SSH Key Configuration](#appendix-k-ssh-key-configuration)
- [Appendix L: fail2ban Configuration](#appendix-l-fail2ban-configuration)
- [Appendix M: Migration Timeline Summary](#appendix-m-migration-timeline-summary)

---

## 1. Current Architecture

### Server Specifications (Old)

| Component | Current Spec |
|-----------|-------------|
| **CPU** | AMD Ryzen 9 5900X (12C/24T) |
| **RAM** | 64GB DDR4 |
| **Storage** | 512GB SSD (sdb) + 5.5TB HDD (sdc) + 1TB SSD (sda, FAILED) |
| **OS** | Ubuntu 22.04 LTS |
| **IP** | 192.168.1.15 (local), 10.100.0.1 (WireGuard) |

### Services Running

| Service | Port | Container/Process |
|---------|------|-------------------|
| **Veritable Games App** | 3000 | `m4s0kwo4kc4oooocck4sswc4` |
| **WebSocket Server** | 3002 | Same container |
| **WebSocket Health** | 3003 | Same container |
| **PostgreSQL 15** | 5432 | `veritable-games-postgres` |
| **Coolify Dashboard** | 8000 | `coolify` |
| **Traefik (reverse proxy)** | 80/443 | Coolify-managed |
| **WireGuard VPN** | 51820/UDP | System service |

### Database Structure

- **Engine**: PostgreSQL 15
- **Schemas**: 10 (auth, forums, wiki, users, content, library, messaging, system, cache, main)
- **Tables**: 155 total
- **Indexes**: 273 total

### Docker Volumes

| Volume Name | Size | Purpose |
|-------------|------|---------|
| `anarchist-library` | 3.1GB | 24,643 anarchist texts |
| `m4s0kwo4kc4oooocck4sswc4-marxists-library` | 100GB+ | Marxists.org archive |
| `m4s0kwo4kc4oooocck4sswc4-veritable-gallery` | Variable | User uploads |
| `m4s0kwo4kc4oooocck4sswc4-godot-projects` | Variable | Godot project files |
| `m4s0kwo4kc4oooocck4sswc4-godot-builds` | Variable | Build artifacts |
| `generated_postgres_datadir` | ~200MB | PostgreSQL data |

---

## 2. New Drive Layout

### Primary: Samsung 9100 PRO 2TB NVMe (Boot Drive)

```
/dev/nvme0n1 (2TB)
├── /dev/nvme0n1p1 - EFI System Partition (512MB)
├── /dev/nvme0n1p2 - / (root, 500GB)
│   ├── /home/user/
│   ├── /var/lib/docker/
│   └── All system files
└── /dev/nvme0n1p3 - /data (1.4TB, for Docker volumes)
    └── Symlinked or bind-mounted for large volumes
```

### Secondary: Old 512GB SSD

```
/dev/sda (512GB)
└── /mnt/backup
    ├── Database backups
    ├── Configuration backups
    └── Redundant copies
```

### Tertiary: Old 5.5TB HDD

```
/dev/sdb (5.5TB)
└── /mnt/archive
    ├── Literature archives (anarchist-library source)
    ├── Marxists.org archive
    ├── Large media files
    └── Cold storage
```

### fstab Configuration

```bash
# /etc/fstab additions for old drives
UUID=<512GB-SSD-UUID>  /mnt/backup   ext4  defaults,noatime  0  2
UUID=<5.5TB-HDD-UUID>  /mnt/archive  ext4  defaults,noatime  0  2
```

---

## 3. Phase 1: Base System Installation

### 3.1 Install Ubuntu Server 24.04 LTS

1. Download Ubuntu Server 24.04 LTS ISO
2. Create bootable USB with Rufus/Balena Etcher
3. Boot from USB, select "Install Ubuntu Server"
4. Configure:
   - Language: English
   - Keyboard: US
   - Network: DHCP initially (configure static later)
   - Storage: Use entire NVMe disk (guided partitioning)
   - Username: `user`
   - Server name: `veritable-games-server`
   - Install OpenSSH server: Yes

### 3.2 Post-Installation Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Set static IP
sudo nano /etc/netplan/00-installer-config.yaml
```

```yaml
# /etc/netplan/00-installer-config.yaml
network:
  version: 2
  ethernets:
    enp6s0:  # Adjust interface name
      addresses:
        - 192.168.1.15/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
```

```bash
# Apply network config
sudo netplan apply

# Set hostname
sudo hostnamectl set-hostname veritable-games-server

# Set timezone
sudo timedatectl set-timezone America/Los_Angeles  # Adjust as needed
```

### 3.3 Install Required Packages

```bash
# Essential packages
sudo apt install -y \
  curl wget git vim nano htop \
  net-tools openssh-server \
  apt-transport-https ca-certificates \
  software-properties-common \
  build-essential \
  python3 python3-pip python3-venv \
  libpq-dev postgresql-client \
  imagemagick ffmpeg \
  openssl fail2ban \
  unzip jq \
  smartmontools nvme-cli \
  ufw

# Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 3.4 Configure Firewall

```bash
# Enable UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow required ports
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 3000/tcp    # Next.js (internal)
sudo ufw allow 8000/tcp    # Coolify
sudo ufw allow 51820/udp   # WireGuard

# Enable firewall
sudo ufw enable
sudo ufw status
```

### 3.5 Mount Old Drives

```bash
# List available drives
lsblk
sudo fdisk -l

# Create mount points
sudo mkdir -p /mnt/backup /mnt/archive

# Get UUIDs
sudo blkid

# Add to fstab
sudo nano /etc/fstab
# Add lines for each drive (see Section 2)

# Mount all
sudo mount -a

# Verify
df -h
```

---

## 4. Phase 2: Docker & Coolify Setup

### 4.1 Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Enable Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Verify
docker --version
docker run hello-world
```

### 4.2 Configure Docker Storage

```bash
# Create Docker daemon config for storage location
sudo mkdir -p /etc/docker
sudo nano /etc/docker/daemon.json
```

```json
{
  "data-root": "/var/lib/docker",
  "storage-driver": "overlay2",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
# Restart Docker
sudo systemctl restart docker
```

### 4.3 Install Coolify

```bash
# Install Coolify (self-hosted)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash

# Wait for installation (2-3 minutes)
# Coolify will be available at http://192.168.1.15:8000

# Check Coolify containers
docker ps | grep coolify
```

### 4.4 Initial Coolify Setup

1. Open browser: `http://192.168.1.15:8000`
2. Create admin account
3. Add server: "localhost" (self-hosted)
4. Connect GitHub:
   - Settings → Sources → Add GitHub App
   - Authorize Veritable-Games organization
5. Verify server connection in Coolify dashboard

---

## 5. Phase 3: PostgreSQL Database

### 5.1 Create Docker Network

```bash
# Create application network
docker network create veritable-games-network

# Verify
docker network ls
```

### 5.2 Deploy PostgreSQL Container

```bash
# Generate secure password
POSTGRES_PASSWORD=$(openssl rand -base64 32)
echo "Save this password: $POSTGRES_PASSWORD"

# Create PostgreSQL container
docker run -d \
  --name veritable-games-postgres \
  --network veritable-games-network \
  --restart unless-stopped \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_DB=veritable_games \
  -v postgres_data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:15-alpine

# Verify container is running
docker ps | grep postgres
docker logs veritable-games-postgres
```

### 5.3 Option A: Restore from Backup

If you have a database backup from the old server:

```bash
# Copy backup file to new server
scp user@old-server:/path/to/backup.sql.gz /tmp/

# Restore database
zcat /tmp/backup.sql.gz | docker exec -i veritable-games-postgres \
  psql -U postgres -d veritable_games

# Verify restoration
docker exec -it veritable-games-postgres \
  psql -U postgres -d veritable_games -c "\dn"
```

### 5.4 Option B: Fresh Database Setup

If starting fresh or no backup available:

```bash
# Clone repository first
cd /home/user
mkdir -p Projects
cd Projects
git clone https://github.com/Veritable-Games/veritable-games-main.git
cd veritable-games-main/frontend

# Install dependencies
npm install

# Set database URL for scripts
export DATABASE_URL="postgresql://postgres:$POSTGRES_PASSWORD@localhost:5432/veritable_games"
export DATABASE_MODE=production

# Create schemas
npm run pg:create-schemas

# Run migrations
npm run db:migrate:production

# Verify
npm run db:health
```

### 5.5 Database Health Check

```bash
# Connect to database
docker exec -it veritable-games-postgres \
  psql -U postgres -d veritable_games

# Check schemas
\dn

# Expected output:
#   Name    |  Owner
# ----------+----------
#  auth     | postgres
#  cache    | postgres
#  content  | postgres
#  forums   | postgres
#  library  | postgres
#  main     | postgres
#  messaging| postgres
#  system   | postgres
#  users    | postgres
#  wiki     | postgres

# Check table count
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema');
# Expected: ~155 tables

# Exit
\q
```

---

## 6. Phase 4: Application Deployment

### 6.1 Create Application in Coolify

1. Open Coolify: `http://192.168.1.15:8000`
2. Projects → New Project → "Veritable Games"
3. Add Resource → Public Repository (or GitHub App)
4. Repository: `https://github.com/Veritable-Games/veritable-games-main`
5. Branch: `main`
6. Build Pack: Nixpacks
7. Base Directory: `frontend`

### 6.2 Configure Environment Variables

In Coolify → Application → Environment Variables, add:

```bash
# Database
DATABASE_MODE=production
POSTGRES_URL=postgresql://postgres:YOUR_PASSWORD@veritable-games-postgres:5432/veritable_games
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@veritable-games-postgres:5432/veritable_games
POSTGRES_SSL=false

# Application
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://www.veritablegames.com
NEXTAUTH_URL=https://www.veritablegames.com

# Security (generate fresh values!)
SESSION_SECRET=<run: openssl rand -hex 32>
CSRF_SECRET=<run: openssl rand -hex 32>
ENCRYPTION_KEY=<run: openssl rand -hex 32>

# WebSocket
NEXT_PUBLIC_WS_URL=wss://www.veritablegames.com
WS_PORT=3002
WS_HEALTH_PORT=3003

# Features
ENABLE_FORUMS=true
ENABLE_WIKI=true
ENABLE_LIBRARY=true
ENABLE_WORKSPACE=true

# Build
CI=true
NEXT_TELEMETRY_DISABLED=1
```

### 6.3 Configure Ports

In Coolify → Application → Network:

- Port 3000 → Exposed (main application)
- Port 3002 → Exposed (WebSocket)
- Port 3003 → Internal only (health check)

### 6.4 Configure Docker Volumes

In Coolify → Application → Storages, add persistent volumes:

| Volume Name | Mount Path |
|-------------|------------|
| `anarchist-library` | `/app/frontend/public/library/anarchist` |
| `marxists-library` | `/app/frontend/public/library/marxists` |
| `veritable-gallery` | `/app/frontend/public/uploads` |
| `godot-projects` | `/app/frontend/godot-projects` |
| `godot-builds` | `/app/frontend/public/godot-builds` |

### 6.5 Deploy Application

1. Click "Deploy" in Coolify
2. Monitor build logs (takes 3-5 minutes)
3. Wait for "Running" status
4. Test: `curl http://192.168.1.15:3000/api/health`

---

## 7. Phase 5: Network Configuration

### 7.1 WireGuard VPN Setup

```bash
# Install WireGuard
sudo apt install -y wireguard wireguard-tools

# Generate server keys
wg genkey | sudo tee /etc/wireguard/server_private.key
sudo chmod 600 /etc/wireguard/server_private.key
sudo cat /etc/wireguard/server_private.key | wg pubkey | sudo tee /etc/wireguard/server_public.key

# Create WireGuard config
sudo nano /etc/wireguard/wg0.conf
```

```ini
# /etc/wireguard/wg0.conf
[Interface]
PrivateKey = <SERVER_PRIVATE_KEY>
Address = 10.100.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# Laptop peer
[Peer]
PublicKey = <LAPTOP_PUBLIC_KEY>
AllowedIPs = 10.100.0.2/32
```

```bash
# Enable IP forwarding
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Start WireGuard
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0

# Verify
sudo wg show
```

### 7.2 Cloudflare Tunnel Setup

1. Log in to Cloudflare Dashboard
2. Zero Trust → Access → Tunnels
3. Create new tunnel: "veritable-games-tunnel"
4. Install cloudflared on server:

```bash
# Install cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create veritable-games

# Configure tunnel
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

```yaml
# ~/.cloudflared/config.yml
tunnel: <TUNNEL_ID>
credentials-file: /home/user/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: www.veritablegames.com
    service: http://localhost:3000
  - hostname: veritablegames.com
    service: http://localhost:3000
  - service: http_status:404
```

```bash
# Route DNS
cloudflared tunnel route dns veritable-games www.veritablegames.com

# Install as service
sudo cloudflared service install

# Start tunnel
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Verify
sudo systemctl status cloudflared
curl https://www.veritablegames.com
```

---

## 8. Phase 6: Data Migration

### 8.1 Restore Literature Archives

If archives are on the old drives:

```bash
# Check old drive contents
ls -la /mnt/archive/

# Create Docker volumes if not exists
docker volume create anarchist-library
docker volume create marxists-library

# Copy anarchist library to volume
docker run --rm \
  -v /mnt/archive/anarchist-library:/source:ro \
  -v anarchist-library:/dest \
  alpine cp -av /source/. /dest/

# Copy marxists library to volume
docker run --rm \
  -v /mnt/archive/marxists-library:/source:ro \
  -v marxists-library:/dest \
  alpine cp -av /source/. /dest/

# Verify
docker run --rm -v anarchist-library:/data alpine ls -la /data | head
docker run --rm -v anarchist-library:/data alpine du -sh /data
```

### 8.2 Restore User Uploads

```bash
# Create gallery volume
docker volume create veritable-gallery

# Copy uploads if they exist on old drive
docker run --rm \
  -v /mnt/backup/uploads:/source:ro \
  -v veritable-gallery:/dest \
  alpine cp -av /source/. /dest/
```

### 8.3 Restore Godot Projects

```bash
# Create Godot volumes
docker volume create godot-projects
docker volume create godot-builds

# Copy if available
docker run --rm \
  -v /mnt/archive/godot-projects:/source:ro \
  -v godot-projects:/dest \
  alpine cp -av /source/. /dest/
```

### 8.4 Verify Volume Contents

```bash
# List all volumes
docker volume ls

# Check sizes
for vol in anarchist-library marxists-library veritable-gallery godot-projects; do
  echo "=== $vol ==="
  docker run --rm -v $vol:/data alpine du -sh /data 2>/dev/null || echo "Empty or not found"
done
```

---

## 9. Phase 7: Monitoring & Automation

### 9.1 Auto-Deploy Script

```bash
# Create scripts directory
mkdir -p /home/user/scripts /home/user/logs

# Create auto-deploy script
cat > /home/user/scripts/auto-deploy.sh << 'EOF'
#!/bin/bash
# Auto-deploy script - checks for new commits and triggers deployment

LOG_FILE="/home/user/logs/auto-deploy.log"
REPO_PATH="/home/user/Projects/veritable-games-main"
APP_UUID="m4s0kwo4kc4oooocck4sswc4"  # Update with actual Coolify UUID

cd "$REPO_PATH" || exit 1

# Fetch latest
git fetch origin main --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] New commits detected. Deploying..." >> "$LOG_FILE"
    git pull origin main --quiet
    coolify deploy by-uuid "$APP_UUID" >> "$LOG_FILE" 2>&1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deployment triggered." >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] No new commits." >> "$LOG_FILE"
fi
EOF

chmod +x /home/user/scripts/auto-deploy.sh
```

### 9.2 Cron Jobs

```bash
# Edit crontab
crontab -e
```

```cron
# Auto-deploy check every hour
0 * * * * /home/user/scripts/auto-deploy.sh

# Database backup daily at 3 AM
0 3 * * * docker exec veritable-games-postgres pg_dump -U postgres veritable_games | gzip > /mnt/backup/db-$(date +\%Y\%m\%d).sql.gz

# Clean old backups (keep 30 days)
0 4 * * * find /mnt/backup -name "db-*.sql.gz" -mtime +30 -delete

# Docker cleanup weekly
0 5 * * 0 docker system prune -af --volumes --filter "until=168h"
```

### 9.3 SMART Monitoring

```bash
# Create SMART check script
cat > /home/user/scripts/smart-check.sh << 'EOF'
#!/bin/bash
LOG_FILE="/home/user/logs/smart-check.log"

echo "=== SMART Check $(date) ===" >> "$LOG_FILE"

for drive in /dev/nvme0n1 /dev/sda /dev/sdb; do
    if [ -e "$drive" ]; then
        echo "--- $drive ---" >> "$LOG_FILE"
        sudo smartctl -H "$drive" >> "$LOG_FILE" 2>&1
    fi
done
EOF

chmod +x /home/user/scripts/smart-check.sh

# Add to crontab (daily)
# 0 6 * * * /home/user/scripts/smart-check.sh
```

### 9.4 Health Check Script

```bash
cat > /home/user/scripts/health-check.sh << 'EOF'
#!/bin/bash
LOG_FILE="/home/user/logs/health-check.log"

echo "=== Health Check $(date) ===" >> "$LOG_FILE"

# Check application
APP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
echo "App: $APP_STATUS" >> "$LOG_FILE"

# Check database
DB_STATUS=$(docker exec veritable-games-postgres pg_isready -U postgres 2>&1)
echo "DB: $DB_STATUS" >> "$LOG_FILE"

# Check disk space
echo "Disk:" >> "$LOG_FILE"
df -h / /mnt/backup /mnt/archive 2>/dev/null >> "$LOG_FILE"

# Alert if issues
if [ "$APP_STATUS" != "200" ]; then
    echo "WARNING: Application unhealthy!" >> "$LOG_FILE"
fi
EOF

chmod +x /home/user/scripts/health-check.sh
```

---

## 10. Environment Variables Reference

### Required Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_MODE` | `production` | Must be "production" for PostgreSQL |
| `POSTGRES_URL` | `postgresql://postgres:pass@host:5432/db` | Full PostgreSQL connection string |
| `SESSION_SECRET` | `<64 hex chars>` | Session encryption key |
| `CSRF_SECRET` | `<64 hex chars>` | CSRF token signing key |
| `ENCRYPTION_KEY` | `<64 hex chars>` | Data encryption key |
| `NODE_ENV` | `production` | Node environment |
| `NEXT_PUBLIC_BASE_URL` | `https://www.veritablegames.com` | Public URL |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_FORUMS` | `true` | Enable forums feature |
| `ENABLE_WIKI` | `true` | Enable wiki feature |
| `ENABLE_LIBRARY` | `true` | Enable document library |
| `ENABLE_WORKSPACE` | `true` | Enable infinite canvas |
| `WS_PORT` | `3002` | WebSocket server port |
| `LOG_LEVEL` | `info` | Logging verbosity |

### Generate Secrets

```bash
# Generate all three secrets at once
echo "SESSION_SECRET=$(openssl rand -hex 32)"
echo "CSRF_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

---

## 11. Verification Checklist

### System Level

- [ ] Ubuntu Server installed and updated
- [ ] Static IP configured (192.168.1.15)
- [ ] SSH key authentication working
- [ ] Firewall (UFW) configured and enabled
- [ ] Old drives mounted at /mnt/backup and /mnt/archive
- [ ] Node.js 20 installed
- [ ] Docker installed and running

### Docker Level

- [ ] Coolify installed and accessible at :8000
- [ ] PostgreSQL container running
- [ ] Application container running
- [ ] Docker network created (veritable-games-network)
- [ ] All volumes created and populated

### Database Level

- [ ] PostgreSQL accepting connections
- [ ] All 10 schemas present
- [ ] Tables created (~155)
- [ ] Data restored or migrated
- [ ] `npm run db:health` passes

### Application Level

- [ ] Application responds at http://192.168.1.15:3000
- [ ] `/api/health` returns 200
- [ ] Can log in with valid credentials
- [ ] Forums load correctly
- [ ] Wiki pages display
- [ ] Library documents accessible
- [ ] File uploads work

### Network Level

- [ ] WireGuard VPN operational (10.100.0.1)
- [ ] Cloudflare Tunnel connected
- [ ] https://www.veritablegames.com accessible
- [ ] SSL certificate valid

### Automation Level

- [ ] Auto-deploy script installed
- [ ] Cron jobs configured
- [ ] Database backups running
- [ ] Health checks scheduled
- [ ] SMART monitoring active

---

## 12. Troubleshooting

### Application Won't Start

```bash
# Check container logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100

# Common issues:
# 1. Missing DATABASE_URL → Add POSTGRES_URL to environment
# 2. Database not ready → Wait for PostgreSQL, then restart app
# 3. Port conflict → Check: lsof -i :3000
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs veritable-games-postgres --tail 50

# Test connection
docker exec -it veritable-games-postgres psql -U postgres -c "SELECT 1;"

# Verify network
docker network inspect veritable-games-network
```

### Coolify Not Deploying

```bash
# Check Coolify logs
docker logs coolify --tail 100

# Verify GitHub connection in Coolify UI
# Check webhook delivery in GitHub repo settings

# Manual deploy
coolify deploy by-uuid <APP_UUID>
```

### WireGuard Not Connecting

```bash
# Check service status
sudo systemctl status wg-quick@wg0

# View WireGuard status
sudo wg show

# Check firewall
sudo ufw status | grep 51820

# Restart WireGuard
sudo systemctl restart wg-quick@wg0
```

### Cloudflare Tunnel Issues

```bash
# Check tunnel status
sudo systemctl status cloudflared

# View tunnel logs
sudo journalctl -u cloudflared -f

# Restart tunnel
sudo systemctl restart cloudflared
```

---

## Quick Reference Commands

```bash
# Start all services
sudo systemctl start docker
docker start veritable-games-postgres
# (Coolify manages app container)

# Stop all services
docker stop m4s0kwo4kc4oooocck4sswc4
docker stop veritable-games-postgres

# View logs
docker logs m4s0kwo4kc4oooocck4sswc4 -f
docker logs veritable-games-postgres -f

# Database backup
docker exec veritable-games-postgres pg_dump -U postgres veritable_games > backup.sql

# Database restore
cat backup.sql | docker exec -i veritable-games-postgres psql -U postgres -d veritable_games

# Check disk space
df -h

# Check Docker disk usage
docker system df
```

---

---

## Appendix A: WireGuard Configuration (ACTUAL KEYS)

### Server Configuration (/etc/wireguard/wg0.conf)

```ini
[Interface]
Address = 10.100.0.1/24
PrivateKey = <SERVER_PRIVATE_KEY>  # Generate new or recover from backup
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# Laptop peer
[Peer]
PublicKey = brTvUtYCQYlWdc1WkIFChLsvYhQZ1nmyxF4BjQ11DSY=
AllowedIPs = 10.100.0.2/32
```

### Laptop Configuration - Home (wg0_home.conf)

```ini
[Interface]
Address = 10.100.0.2/24
PrivateKey = qHhR4ujr6zf73bT/hRoZ0ipP35B9a+8pKXsYZy4d5F8=
MTU = 1420
DNS = 192.168.1.1

[Peer]
PublicKey = Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
Endpoint = 192.168.1.15:51820
AllowedIPs = 10.100.0.0/24, 192.168.1.0/24
PersistentKeepalive = 25
```

### Laptop Configuration - Away (wg0_away.conf)

```ini
[Interface]
Address = 10.100.0.2/24
PrivateKey = qHhR4ujr6zf73bT/hRoZ0ipP35B9a+8pKXsYZy4d5F8=
MTU = 1280
DNS = 1.1.1.1

[Peer]
PublicKey = Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
Endpoint = wg.veritablegames.com:51820
AllowedIPs = 10.100.0.0/24, 192.168.1.0/24
PersistentKeepalive = 25
```

### Key Reference

| Device | Type | Key |
|--------|------|-----|
| **Laptop** | Private | `qHhR4ujr6zf73bT/hRoZ0ipP35B9a+8pKXsYZy4d5F8=` |
| **Laptop** | Public | `brTvUtYCQYlWdc1WkIFChLsvYhQZ1nmyxF4BjQ11DSY=` |
| **Server** | Public | `Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=` |
| **Server** | Private | (Recover from backup or generate new pair) |

### WireGuard Endpoints

| Location | Endpoint |
|----------|----------|
| **Home (local)** | `192.168.1.15:51820` |
| **Away (public)** | `wg.veritablegames.com:51820` |

---

## Appendix B: BTCPay Server Setup

### BTCPay Container Info

| Setting | Value |
|---------|-------|
| **Container Name** | `generated_btcpayserver_1` |
| **Internal Port** | `49392` |
| **Public URL** | `https://btcpay.veritablegames.com` |
| **Webhook Endpoint** | `https://www.veritablegames.com/api/webhooks/btcpay` |

### BTCPay Docker Configuration

```bash
# BTCPay runs via docker-compose in /var/lib/btcpayserver

# Start BTCPay
cd /var/lib/btcpayserver
docker-compose up -d

# Check status
docker ps | grep btcpay

# View logs
docker logs generated_btcpayserver_1 --tail 50
```

### BTCPay Environment Variables

```bash
# In /var/lib/docker/volumes/btcpayserver_datadir/_data/.env
BTCPAY_HOST=btcpay.veritablegames.com
BTCPAY_PROTOCOL=https
```

### Cloudflare Tunnel Route for BTCPay

```yaml
# Add to cloudflared config.yml
ingress:
  - hostname: btcpay.veritablegames.com
    service: http://generated_btcpayserver_1:49392
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s
```

---

## Appendix C: Cloudflare Tunnel Configuration

### Tunnel Information

| Setting | Value |
|---------|-------|
| **Tunnel Name** | `veritable-games` |
| **Tunnel ID** | `b74fbc5b-0d7c-419d-ba50-0bf848f53993` |
| **Credentials File** | `/home/user/.cloudflared/b74fbc5b-0d7c-419d-ba50-0bf848f53993.json` |

### Full Tunnel Configuration

```yaml
# ~/.cloudflared/config.yml
tunnel: b74fbc5b-0d7c-419d-ba50-0bf848f53993
credentials-file: /home/user/.cloudflared/b74fbc5b-0d7c-419d-ba50-0bf848f53993.json

ingress:
  # Main application
  - hostname: www.veritablegames.com
    service: http://m4s0kwo4kc4oooocck4sswc4:3000

  # BTCPay Server
  - hostname: btcpay.veritablegames.com
    service: http://generated_btcpayserver_1:49392
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s

  # Catch-all (must be last)
  - service: http_status:404
```

### DNS Records (Cloudflare)

| Subdomain | Type | Target |
|-----------|------|--------|
| `www` | CNAME | `b74fbc5b-0d7c-419d-ba50-0bf848f53993.cfargotunnel.com` |
| `btcpay` | CNAME | `b74fbc5b-0d7c-419d-ba50-0bf848f53993.cfargotunnel.com` |
| `wg` | A | Your public IP (for WireGuard DDNS) |

### Cloudflared Service Setup

```bash
# Install cloudflared
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Copy credentials from backup
mkdir -p ~/.cloudflared
# Copy b74fbc5b-0d7c-419d-ba50-0bf848f53993.json to ~/.cloudflared/

# Install as service
sudo cloudflared service install

# Start and enable
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

---

## Appendix D: Complete Environment Variables

### Production Environment Variables (Coolify)

```bash
# === DATABASE ===
DATABASE_MODE=production
POSTGRES_URL=postgresql://postgres:YOUR_PASSWORD@veritable-games-postgres:5432/veritable_games
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@veritable-games-postgres:5432/veritable_games
POSTGRES_SSL=false
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=2
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=5000

# === APPLICATION ===
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://www.veritablegames.com
NEXT_PUBLIC_SITE_URL=https://www.veritablegames.com
NEXT_PUBLIC_API_URL=https://www.veritablegames.com/api
NEXTAUTH_URL=https://www.veritablegames.com

# === SECURITY (GENERATE NEW!) ===
SESSION_SECRET=<openssl rand -hex 32>
CSRF_SECRET=<openssl rand -hex 32>
ENCRYPTION_KEY=<openssl rand -hex 32>

# === COOKIES (HTTP-only deployment) ===
COOKIE_SECURE_FLAG=false
COOKIE_USE_SECURE_PREFIX=false

# === WEBSOCKET ===
NEXT_PUBLIC_WORKSPACE_WEBSOCKET_ENABLED=false
NEXT_PUBLIC_WS_URL=ws://192.168.1.15:3002
WS_PORT=3002
WS_HEALTH_PORT=3003

# === FEATURES ===
ENABLE_FORUMS=true
ENABLE_WIKI=true
ENABLE_LIBRARY=true
ENABLE_3D_VIEWER=true
ENABLE_WORKSPACE=true
ADMIN_ENABLED=false

# === GODOT ===
GODOT_PROJECTS_PATH=/app/godot-projects
GODOT_BUILDS_PATH=/app/godot-builds

# === BUILD ===
CI=true
NEXT_TELEMETRY_DISABLED=1

# === LOGGING ===
LOG_LEVEL=info
```

### Generate New Secrets

```bash
#!/bin/bash
echo "SESSION_SECRET=$(openssl rand -hex 32)"
echo "CSRF_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '=' | head -c 32)"
```

---

## Appendix E: Backup & Recovery Scripts

### Auto-Deploy Monitor Script

```bash
#!/bin/bash
# /home/user/scripts/auto-deploy.sh
# Runs hourly via cron

LOG_FILE="/home/user/logs/auto-deploy.log"
REPO_PATH="/home/user/Projects/veritable-games-main"
APP_UUID="m4s0kwo4kc4oooocck4sswc4"

cd "$REPO_PATH" || exit 1

# Fetch latest
git fetch origin main --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] New commits detected. Deploying..." >> "$LOG_FILE"
    git pull origin main --quiet
    coolify deploy by-uuid "$APP_UUID" >> "$LOG_FILE" 2>&1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deployment triggered." >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] No new commits." >> "$LOG_FILE"
fi
```

### Database Backup Script

```bash
#!/bin/bash
# /home/user/scripts/db-backup.sh
# Runs daily via cron

BACKUP_DIR="/mnt/backup/database"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# PostgreSQL backup
docker exec veritable-games-postgres \
  pg_dump -U postgres veritable_games \
  | gzip > "$BACKUP_DIR/veritable_games_$DATE.sql.gz"

# Keep only last 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "[$(date)] Backup complete: veritable_games_$DATE.sql.gz"
```

### Crontab Configuration

```cron
# Edit with: crontab -e

# Auto-deploy check every hour
0 * * * * /home/user/scripts/auto-deploy.sh

# Database backup daily at 3 AM
0 3 * * * /home/user/scripts/db-backup.sh >> /home/user/logs/backup.log 2>&1

# SMART check weekly
0 6 * * 0 /home/user/scripts/smart-check.sh >> /home/user/logs/smart.log 2>&1

# Docker cleanup monthly
0 4 1 * * docker system prune -af --volumes --filter "until=720h" >> /home/user/logs/docker-cleanup.log 2>&1
```

---

## Appendix F: Service Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet Users                           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare (DNS + SSL + CDN)                   │
│  - www.veritablegames.com                                   │
│  - btcpay.veritablegames.com                                │
└─────────────────────────┬───────────────────────────────────┘
                          │ Cloudflare Tunnel (QUIC)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           Ubuntu Server (192.168.1.15 / 10.100.0.1)         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  cloudflared │  │   WireGuard  │  │    Docker    │       │
│  │  (tunnel)    │  │   (VPN)      │  │   daemon     │       │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘       │
│         │                                    │               │
│         ▼                                    ▼               │
│  ┌────────────────────────────────────────────────────┐     │
│  │              Docker Network                         │     │
│  │  ┌─────────────────┐  ┌─────────────────┐          │     │
│  │  │  Application    │  │  PostgreSQL     │          │     │
│  │  │  :3000          │  │  :5432          │          │     │
│  │  │  (Next.js 15)   │  │  (15-alpine)    │          │     │
│  │  └─────────────────┘  └─────────────────┘          │     │
│  │  ┌─────────────────┐  ┌─────────────────┐          │     │
│  │  │  WebSocket      │  │  BTCPay Server  │          │     │
│  │  │  :3002          │  │  :49392         │          │     │
│  │  └─────────────────┘  └─────────────────┘          │     │
│  │  ┌─────────────────┐  ┌─────────────────┐          │     │
│  │  │  Coolify        │  │  Traefik        │          │     │
│  │  │  :8000          │  │  :80/:443       │          │     │
│  │  └─────────────────┘  └─────────────────┘          │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Storage:                                                    │
│  ├── /dev/nvme0n1 (2TB NVMe) - Boot + Docker                │
│  ├── /dev/sda (512GB SSD) - /mnt/backup                     │
│  └── /dev/sdb (5.5TB HDD) - /mnt/archive                    │
│                                                              │
│  Docker Volumes:                                             │
│  ├── postgres_data (database)                               │
│  ├── anarchist-library (24,643 docs)                        │
│  ├── marxists-library (500K+ docs)                          │
│  ├── veritable-gallery (uploads)                            │
│  └── godot-projects/builds                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Appendix G: Port Reference

| Port | Service | Access |
|------|---------|--------|
| 22 | SSH | Internal + WireGuard |
| 80 | HTTP (Traefik) | Public via Cloudflare |
| 443 | HTTPS (Traefik) | Public via Cloudflare |
| 3000 | Next.js App | Internal |
| 3002 | WebSocket Server | Internal |
| 3003 | WebSocket Health | Internal |
| 5432 | PostgreSQL | Internal |
| 8000 | Coolify Dashboard | Internal + WireGuard |
| 49392 | BTCPay Server | Internal |
| 51820/UDP | WireGuard VPN | Public |

---

## Appendix H: Quick Recovery Commands

### Power Outage Recovery

```bash
# 1. Check if server is reachable
ping 192.168.1.15

# 2. SSH and check Docker
ssh user@192.168.1.15 "docker ps"

# 3. If containers aren't running
ssh user@192.168.1.15 "
docker start veritable-games-postgres
sleep 5
# Coolify should auto-start the app
"

# 4. Verify application
curl http://192.168.1.15:3000/api/health
```

### Database Restore

```bash
# From backup file
zcat /mnt/backup/database/veritable_games_YYYYMMDD.sql.gz | \
  docker exec -i veritable-games-postgres psql -U postgres -d veritable_games
```

### Emergency Redeploy

```bash
# Via Coolify CLI
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4

# Or via Docker
docker stop m4s0kwo4kc4oooocck4sswc4
docker rm m4s0kwo4kc4oooocck4sswc4
# Then trigger deploy from Coolify dashboard
```

### Check All Services

```bash
ssh user@192.168.1.15 "
echo '=== Docker Containers ==='
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo ''
echo '=== Disk Usage ==='
df -h / /mnt/backup /mnt/archive 2>/dev/null

echo ''
echo '=== WireGuard ==='
sudo wg show

echo ''
echo '=== Cloudflared ==='
systemctl status cloudflared --no-pager | head -5
"
```

---

---

## Appendix I: AMD GPU Setup for LLM Inference

### ROCm Installation (AMD GPU Driver Stack)

```bash
# Add ROCm repository
wget https://repo.radeon.com/rocm/rocm.gpg.key -O - | \
  sudo gpg --dearmor -o /etc/apt/keyrings/rocm.gpg

echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/rocm.gpg] https://repo.radeon.com/rocm/apt/6.0 jammy main" | \
  sudo tee /etc/apt/sources.list.d/rocm.list

# Install ROCm
sudo apt update
sudo apt install -y rocm-hip-sdk rocm-opencl-sdk

# Add user to render and video groups
sudo usermod -aG render,video $USER

# Verify installation
rocm-smi
# Should show W7900 GPU
```

### Expected W7900 LLM Performance

| Model | Quantization | VRAM Usage | Speed |
|-------|--------------|------------|-------|
| Llama 3.3 70B | Q4_K_M | ~40GB | 11-13 tok/s |
| Llama 3.1 70B | Q4_K_M | ~40GB | 11-13 tok/s |
| Qwen 2.5 32B | Q4_K_M | ~20GB | 18-22 tok/s |
| Llama 3.1 8B | Q4_K_M | ~6GB | 45+ tok/s |

### Ollama Installation (Recommended for Ease of Use)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Ollama auto-detects ROCm if installed
# Verify GPU is being used
ollama run llama3.1:70b "Hello" --verbose

# Pull common models
ollama pull llama3.1:70b-instruct-q4_K_M
ollama pull qwen2.5:32b-instruct-q4_K_M
ollama pull codellama:34b-instruct-q4_K_M
```

### llama.cpp with ROCm (Alternative - More Control)

```bash
# Clone and build with ROCm support
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Build with ROCm/HIP support
make clean
CMAKE_ARGS="-DGGML_HIPBLAS=ON" make -j$(nproc)

# Download model (example: Llama 3.1 70B Q4)
# Place in ~/models/ directory

# Run inference
./llama-cli -m ~/models/llama-3.1-70b-instruct-q4_K_M.gguf \
  -p "Hello, how are you?" \
  -n 256 \
  --n-gpu-layers 99
```

### Docker with ROCm Support

```bash
# For containerized LLM inference
docker run -d \
  --name ollama \
  --device=/dev/kfd \
  --device=/dev/dri \
  --group-add video \
  --group-add render \
  -v ollama:/root/.ollama \
  -p 11434:11434 \
  ollama/ollama:rocm

# Verify GPU access in container
docker exec ollama rocm-smi
```

---

## Appendix J: Coolify Advanced Configuration

### Coolify Database Direct Access

```bash
# Access Coolify's internal database (for debugging)
docker exec -it coolify-db psql -U coolify -d coolify

# Check application FQDN
SELECT uuid, name, fqdn, ports_mappings FROM applications;

# Fix FQDN if needed
UPDATE applications SET fqdn = 'www.veritablegames.com' WHERE name = 'veritable-games';
```

### Traefik Label Debugging

```bash
# Check container's Traefik labels
docker inspect m4s0kwo4kc4oooocck4sswc4 --format '{{range $key, $value := .Config.Labels}}{{if hasPrefix "traefik" $key}}{{printf "%s = %s\n" $key $value}}{{end}}{{end}}'

# View Traefik proxy logs
docker logs coolify-proxy --tail 100 2>&1 | grep -E '(error|rule|Host)'
```

### Environment Variables in Coolify

**Build-time variables** (embedded in image):
- `NEXT_PUBLIC_*` - Must have "Build Variable" checkbox checked
- Used during `npm run build`

**Runtime variables** (injected at container start):
- `DATABASE_URL`, `SESSION_SECRET`, etc.
- Keep "Build Variable" unchecked

### Nixpacks Configuration

Create `nixpacks.toml` in repository root:

```toml
# nixpacks.toml
[variables]
NIXPACKS_NODE_VERSION = "20"

[phases.setup]
aptPkgs = ["python3", "build-essential", "libpq-dev"]

[phases.install]
cmds = ["npm ci --prefer-offline --no-audit"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm run start"
```

---

## Appendix K: SSH Key Configuration

### Generate New SSH Key for GitHub

```bash
# Generate Ed25519 key (recommended)
ssh-keygen -t ed25519 -C "server@veritablegames.com"

# Add to SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Display public key (add to GitHub)
cat ~/.ssh/id_ed25519.pub
```

### Auto-load SSH Key on Login

```bash
# Add to ~/.bashrc
cat >> ~/.bashrc << 'EOF'
# Auto-start SSH agent and add key
if [ -z "$SSH_AUTH_SOCK" ]; then
    eval "$(ssh-agent -s)" > /dev/null
    ssh-add ~/.ssh/id_ed25519 2>/dev/null
fi
EOF

source ~/.bashrc
```

### GitHub SSH Configuration

```bash
# Add to GitHub: Settings → SSH and GPG keys → New SSH key
# Paste the contents of ~/.ssh/id_ed25519.pub

# Test connection
ssh -T git@github.com
# Should say: "Hi Veritable-Games! You've successfully authenticated"

# Configure git
git config --global user.name "Veritable Games"
git config --global user.email "server@veritablegames.com"
```

---

## Appendix L: fail2ban Configuration

### Install and Configure fail2ban

```bash
# Install
sudo apt install -y fail2ban

# Create local config
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

```ini
# /etc/fail2ban/jail.local
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h
```

```bash
# Enable and start
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status sshd
```

---

## Appendix M: Migration Timeline Summary

### Phase Overview

| Phase | Duration | Description |
|-------|----------|-------------|
| 1 | 30-45 min | Ubuntu Server installation |
| 2 | 15-20 min | Docker & Coolify setup |
| 3 | 15-20 min | PostgreSQL database |
| 4 | 20-30 min | Application deployment |
| 5 | 20-30 min | Network configuration |
| 6 | Variable | Data migration (depends on size) |
| 7 | 15-20 min | Monitoring & automation |
| **Total** | **2-3 hours** | (excluding data transfer time) |

### Critical Path Items

1. **Before building**: Back up existing database and Docker volumes
2. **Phase 3**: Test database connection before proceeding
3. **Phase 4**: Verify all environment variables are set
4. **Phase 5**: Test WireGuard before disconnecting old server
5. **Phase 6**: Verify volume data after migration

### Go/No-Go Checklist

Before decommissioning old server:

- [ ] New server responds at https://www.veritablegames.com
- [ ] Database queries return expected data
- [ ] User authentication works
- [ ] File uploads work and persist
- [ ] WireGuard VPN connects from laptop
- [ ] Backups are running on new server
- [ ] Old server database backed up to external location

---

*Document created: February 6, 2026*
*For new server build with Ryzen 9 7900X + W7900 48GB + Samsung 9100 PRO 2TB*
*Includes: System architecture, WireGuard VPN, Cloudflare Tunnel, BTCPay Server, PostgreSQL, Docker volumes, ROCm/LLM setup*
