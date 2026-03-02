# Veritable Games Server Infrastructure

Production server configuration and infrastructure documentation for the Veritable Games platform hosted at 192.168.1.15.

## Overview

This repository tracks the server-level configuration, infrastructure documentation, and deployment procedures for the Veritable Games production environment. The server runs Ubuntu Server 22.04.5 LTS with a dual-drive architecture, Docker containerization via Coolify, and PostgreSQL 15 for production data.

**Production URL**: https://www.veritablegames.com | **Local**: http://192.168.1.15:3000

**Documentation**: [CLAUDE.md](CLAUDE.md) | **Platform**: Coolify + Docker + Nixpacks

## Key Infrastructure

### Production Environment

**Server Details**:
- **Hostname**: veritable-games-server
- **IP Address**: 192.168.1.15 (local network)
- **OS**: Ubuntu Server 22.04.5 LTS
- **Architecture**: Dual-drive (477GB root + 5.5TB /data) with hybrid SSD/HDD storage
- **Deployment**: Coolify (self-hosted PaaS)
- **Containerization**: Docker with Nixpacks buildpacks
- **VPN**: WireGuard (10.100.0.0/24 subnet)

**Application Stack**:
- **Web Application**: Next.js 15 + React 19 + TypeScript
- **Database**: PostgreSQL 15-alpine (veritable-games-postgres)
- **Reverse Proxy**: Traefik (managed by Coolify)
- **Container Runtime**: Docker 24+
- **Process Management**: Docker Compose via Coolify

### Storage Architecture

**Drive 1** - `/dev/sdb2` (477GB): User data and application code
- Mount: `/` (root filesystem)
- Usage: 163GB / 468GB (37% used, 282GB free)
- Contains: `/home/user/`, projects, git repositories, archives

**Drive 2** - `/dev/sda1` (5.5TB): High-capacity storage and services
- Mount: `/data`
- Usage: 923GB / 5.5TB (17% used, 4.5TB free)
- Contains: Docker volumes/images/containers, PostgreSQL data, Bitcoin blockchain, backups

**Drive 3** - `/mnt/flash` (932GB): USB external drive
- Status: Mounted and available for backup/archive
- Contains: Optional backup destination

**Rationale**:
- `/dev/sdb2`: User data and application code on faster SATA drive
- `/dev/sda1`: High-capacity HDD for Docker, blockchain, and backups
- `/mnt/flash`: Emergency backup destination (external USB)
- Docker data-root: `/home/user/docker-ssd/` (SSD performance), Bitcoin blockchain on `/data` (HDD capacity)

See [docs/server/DRIVE_ARCHITECTURE.md](docs/server/DRIVE_ARCHITECTURE.md) and [docs/server/RECENT_WORK_DEC_2025.md](docs/server/RECENT_WORK_DEC_2025.md).

## Repository Structure

```
/home/user/                          # Server home directory (THIS REPOSITORY)
├── projects/                        # Active projects
│   ├── veritable-games/            # VG project
│   │   ├── site/                   # VG application (git submodule)
│   │   └── resources/              # Scripts, data, migrations (24.6GB)
│   └── README.md                   # Project organization guide
├── docs/                           # Infrastructure documentation
│   ├── server/                     # Server management guides
│   ├── veritable-games/           # VG-specific documentation
│   │   └── planning/               # Project planning documents
│   └── reference/                  # Technical references
├── backups/                        # Database backups & monitoring (2.5GB)
│   ├── scripts/                    # Backup & health check scripts
│   ├── migration-scripts-archive/ # Archived one-time migrations
│   ├── postgres-daily-*.sql.gz    # Daily PostgreSQL backups
│   └── *.log                      # Monitoring logs
├── btcpayserver-docker/            # BTCPay Server infrastructure (git submodule)
├── docker-ssd/                     # Docker data-root (performance, SSD)
├── repository/                     # Development tools archive (5.9GB)
│   └── [metadata tracked, binaries gitignored]
├── archives/                       # Reference materials (16GB gitignored)
├── Downloads/                      # Downloaded files and temporary storage
├── frontend/                       # Frontend utilities and tools
├── scripts/                        # Server-level utility scripts
├── Projects/                       # Additional project directories
├── snap/                           # Snap package data (system-managed)
├── .claude.json                   # Claude Code configuration
├── .gitignore                     # Excludes 54GB (sensitive data, archives)
├── CLAUDE.md                      # Server-level guidance for AI assistants
└── README.md                      # This file
```

**Git Submodules**:
- `projects/veritable-games/site/` → https://github.com/Veritable-Games/veritable-games-site
- `btcpayserver-docker/` → https://github.com/btcpayserver/btcpayserver-docker

**Repository Statistics**:
- Tracked: 93,199 files (server repo + submodules)
- Excluded: ~54 GB via .gitignore (sensitive data, archives, large binaries)
- Created: November 21, 2025
- Updated: March 2, 2026

## Quick Reference

### Application Container

**Container ID**: `m4s0kwo4kc4oooocck4sswc4`
**Type**: Next.js application (Nixpacks build)
**Repository**: https://github.com/Veritable-Games/veritable-games-site
**Branch**: main
**Network**: coolify, veritable-games-network
**Auto-deploy**: ✅ Enabled (push to GitHub triggers rebuild)

```bash
# View application logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100

# Check deployed commit
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT

# Manual deployment
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

### Production Database

**Container**: `veritable-games-postgres`
**Image**: postgres:15-alpine
**Database**: veritable_games
**Schemas**: 17 active (public, anarchist, shared, library, auth, wiki, forums, cache, content, donations, main, marxist, messaging, system, users, x402_payments, youtube)
**Tables**: 233 tables across all schemas
**Networks**: coolify + veritable-games-network (dual-network for isolation)

```bash
# Access PostgreSQL CLI
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games

# Database health check
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT 1;"

# Full database backup
docker exec veritable-games-postgres pg_dumpall -U postgres > /home/user/backups/postgres-$(date +%Y%m%d-%H%M%S).sql

# Backup specific schema
docker exec veritable-games-postgres pg_dump -U postgres -d veritable_games -n anarchist > anarchist-backup.sql
```

### Coolify Management

**Dashboard**: http://192.168.1.15:8000
**CLI**: `coolify` command (installed globally)

```bash
# List all resources
coolify resource list

# Check deployment status
coolify resource get m4s0kwo4kc4oooocck4sswc4

# View deployment logs
coolify resource logs m4s0kwo4kc4oooocck4sswc4

# Trigger manual deployment
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

## Development Workflow

### Standard Git Workflow

```bash
# Navigate to server repository
cd /home/user

# Pull latest changes
git pull origin main

# Make infrastructure changes
# Edit server configs, update documentation, etc.

# Commit changes
git add [files]
git commit -m "Description of infrastructure changes"

# Push to GitHub
git push origin main
```

### Application Development Workflow

For application code changes, work in the submodule:

```bash
# Navigate to application repository
cd /home/user/projects/veritable-games/site

# Pull latest changes
git pull origin main

# Make code changes
# Edit application files using Read/Write/Edit tools

# Run type checking (REQUIRED before commit)
cd frontend
npm run type-check

# Commit and push (from site/ directory)
cd /home/user/projects/veritable-games/site
git add [files]
git commit -m "Description of code changes"
git push origin main

# Wait 2-5 minutes for Coolify auto-deployment
# Or trigger immediately: coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

**Critical Rules**:
- ✅ Edit files in git repositories (NOT inside containers)
- ✅ Use Read, Write, Edit tools for code changes
- ✅ Commit and push to GitHub for deployment
- ✅ Let Coolify handle container updates
- ❌ Never edit files inside containers with `docker exec`
- ❌ Never use `docker cp` to modify container files
- ❌ Changes in containers are ephemeral and will be lost

See [docs/server/CONTAINER_TO_GIT_AUTOMATION.md](docs/server/CONTAINER_TO_GIT_AUTOMATION.md) for detailed workflow.

## Infrastructure Documentation

### Complete Documentation Inventory

**Project Inventory** ⭐ NEW:
- [SERVER_PROJECT_INVENTORY.md](docs/server/SERVER_PROJECT_INVENTORY.md) (500+ lines) - Complete project inventory with 18 components
  - 3 Godot game projects (41 versions total, 50.9 GB)
  - 1 massive Unity project (499 GB, 7 years of development)
  - 60+ website versions (66 GB)
  - Literature archives & database snapshots (~344 GB)
  - Complete storage breakdown (~1.1 TB)

**Core Documentation** (2,650+ lines):
- [INFRASTRUCTURE_INVENTORY.md](docs/deployment/INFRASTRUCTURE_INVENTORY.md) (750 lines) - Complete Docker infrastructure map
- [POSTGRES_PRODUCTION_CONFIG.md](docs/deployment/POSTGRES_PRODUCTION_CONFIG.md) (600 lines) - Database configuration and procedures
- [VOLUME_BACKUP_STRATEGY.md](docs/deployment/VOLUME_BACKUP_STRATEGY.md) (650 lines) - Volume backup and recovery procedures
- [CLEANUP_SUMMARY_NOV_21_2025.md](docs/server/CLEANUP_SUMMARY_NOV_21_2025.md) (500 lines) - Recent infrastructure cleanup

**Server Management**:
- [DRIVE_ARCHITECTURE.md](docs/server/DRIVE_ARCHITECTURE.md) - Dual-drive setup and file placement rules
- [REPOSITORY_ARCHITECTURE.md](docs/server/REPOSITORY_ARCHITECTURE.md) - Tool archives organization (5.9GB)
- [CONTAINER_PROTECTION_AND_RECOVERY.md](docs/server/CONTAINER_PROTECTION_AND_RECOVERY.md) - Container safety protocols
- [CONTAINER_TO_GIT_AUTOMATION.md](docs/server/CONTAINER_TO_GIT_AUTOMATION.md) - Deployment workflow automation

**PDF Conversion** ⭐ NEW (November 26, 2025):
- [PDF_CONVERSION_WORKFLOW.md](projects/veritable-games/resources/data/PDF_CONVERSION_WORKFLOW.md) - Complete PDF→Markdown conversion guide
  - Status: Production ready (75% artifact fix rate)
  - Tool: marker_single (AI-powered OCR)
  - Performance: ~3.5 min/PDF, 100% success rate
  - Scripts: 3 active + 63 archived (organized Nov 26, 2025)

**Deployment Configuration**:
- [coolify-app-config.json](docs/deployment/coolify-app-config.json) - Application configuration export
- [coolify-env-vars-TEMPLATE.txt](docs/deployment/coolify-env-vars-TEMPLATE.txt) - Environment variable template (28 vars)

**Troubleshooting & Incidents**:
- [COOLIFY_RESTORATION_NOV27_2025.md](docs/server/COOLIFY_RESTORATION_NOV27_2025.md) - Coolify restoration after drive failure
- [WIREGUARD_INCIDENT_RECOVERY_SESSION_MARCH_2_2026.md](docs/veritable-games/WIREGUARD_INCIDENT_RECOVERY_SESSION_MARCH_2_2026.md) - WireGuard network failure analysis (March 2, 2026)
- [TOKEN_ROTATION_REQUIRED.md](docs/server/TOKEN_ROTATION_REQUIRED.md) - Security token management

**Security & SSH**:
- [SSH_KEY_SETUP_FEBRUARY_2026.md](docs/server/SSH_KEY_SETUP_FEBRUARY_2026.md) - SSH key configuration and deployment
- [SSH_KEY_SECURITY_PLAN_2026.md](docs/server/SSH_KEY_SECURITY_PLAN_2026.md) - SSH key security strategy

### Documentation Hub

Complete documentation index: [docs/README.md](docs/README.md)

## Critical Procedures

### Container Protection Protocol

⚠️ **CRITICAL**: Production containers contain all live data. Follow these rules:

**Protected Containers** (DO NOT MODIFY):
- `veritable-games-postgres` - Production database (17 schemas, 233 tables)
- `m4s0kwo4kc4oooocck4sswc4` - Application container (managed by Coolify)

**Before ANY container operation**:
1. Ask for explicit user approval
2. Document current state
3. Create database backup: `docker exec veritable-games-postgres pg_dumpall -U postgres > backup.sql`
4. Plan rollback procedure
5. Show plan and wait for confirmation

**Never**:
- ❌ Create new PostgreSQL containers (we have ONE production database)
- ❌ Stop/remove/modify `veritable-games-postgres` without approval
- ❌ Change database connection strings without approval
- ❌ Edit files inside containers (use git repository instead)

See [docs/server/CONTAINER_PROTECTION_AND_RECOVERY.md](docs/server/CONTAINER_PROTECTION_AND_RECOVERY.md) for complete protocols.

### Deployment Verification

```bash
# 1. Check application is running
curl -f http://192.168.1.15:3000/api/health || echo "Application down"

# 2. Check database connectivity
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT 1;" || echo "Database down"

# 3. Verify deployed commit matches git
DEPLOYED=$(docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT | cut -d'=' -f2)
LATEST=$(cd /home/user/projects/veritable-games/site && git rev-parse HEAD)
if [ "$DEPLOYED" = "$LATEST" ]; then
    echo "✅ Deployment up to date"
else
    echo "⚠️ Deployment behind: $DEPLOYED vs $LATEST"
fi

# 4. Check container health
docker ps --filter "name=m4s0kwo4kc4oooocck4sswc4" --format "{{.Status}}"
```

### Backup Procedures

**Daily Backups** (Automated - Recommended):
```bash
# Database backup (compressed)
docker exec veritable-games-postgres pg_dumpall -U postgres | gzip > /home/user/backups/postgres-$(date +%Y%m%d-%H%M%S).sql.gz

# Critical volumes backup
docker run --rm -v m4s0kwo4kc4oooocck4sswc4-veritable-gallery:/data -v /home/user/backups:/backup ubuntu tar czf /backup/gallery-$(date +%Y%m%d).tar.gz /data
```

**Weekly Backups** (Recommended):
```bash
# Full infrastructure snapshot
tar czf /home/user/backups/infrastructure-$(date +%Y%m%d).tar.gz \
  /home/user/docs/ \
  /home/user/wireguard-backups/ \
  /home/user/CLAUDE.md \
  /home/user/.gitignore

# WireGuard configuration
bash /home/user/wireguard-backups/backup-wg-config.sh
```

**Off-site Backups** (Recommended):
- Transfer to laptop via WireGuard
- Consider S3 or Backblaze B2 for automated off-site
- Scripts provided in [VOLUME_BACKUP_STRATEGY.md](docs/deployment/VOLUME_BACKUP_STRATEGY.md)

### Health Monitoring

**Weekly Health Checks** (Recommended):
```bash
# Disk space check (root and /data)
df -h / /data

# Database health
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT 1;"

# Application container status
docker ps --filter "name=m4s0kwo4kc4oooocck4sswc4"
```

**Monthly Maintenance**:
```bash
# Clear Coolify caches
docker exec coolify php artisan optimize:clear

# Clean old database backups (keep latest 3)
cd /home/user/backups
ls -t postgres-* | tail -n +4 | xargs rm -f

# Clean npm cache
npm cache clean --force

# System updates
sudo apt update && sudo apt upgrade -y
```

## Security Configuration

### Network Security

**WireGuard VPN**:
- Interface: wg0 (10.100.0.0/24)
- Server: 10.100.0.1
- Laptop: 10.100.0.2
- Status: Active (removed conflicting OpenVPN Nov 15, 2025)

**Firewall** (UFW):
```bash
# Check firewall status
sudo ufw status

# Allow WireGuard
sudo ufw allow 51820/udp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Authentication

**SSH Access**:
- Key-based authentication only (no password)
- Key: `~/.ssh/id_ed25519` (auto-loads via ssh-agent)
- User: `user@192.168.1.15`

**GitHub Authentication**:
- CLI: `gh` (GitHub CLI)
- Method: Personal Access Token (PAT)
- Scopes: repo, workflow, admin:repo_hook
- Status: ⚠️ Rotation required (see [TOKEN_ROTATION_REQUIRED.md](docs/server/TOKEN_ROTATION_REQUIRED.md))

**Coolify Authentication**:
- CLI: `coolify` command
- Method: API token
- Status: ⚠️ Rotation required (see [TOKEN_ROTATION_REQUIRED.md](docs/server/TOKEN_ROTATION_REQUIRED.md))

### Container Security

**Database Credentials**:
- PostgreSQL password: Environment variable in Coolify
- Access: Only from Docker networks (coolify, veritable-games-network)
- Not exposed to host or internet

**Application Secrets**:
- SESSION_SECRET: 32-byte hex (openssl rand -hex 32)
- ENCRYPTION_KEY: 32-byte hex
- Managed via Coolify environment variables
- Never committed to git

## Performance Optimization

### Database Performance

**PostgreSQL Configuration**:
- max_connections: 100
- shared_buffers: 256MB
- effective_cache_size: 1GB
- maintenance_work_mem: 64MB
- checkpoint_completion_target: 0.9
- wal_buffers: 16MB

See [POSTGRES_PRODUCTION_CONFIG.md](docs/deployment/POSTGRES_PRODUCTION_CONFIG.md) for tuning guide.

### Application Performance

**Build Performance**:
- Nixpacks build: ~3 minutes
- Turbopack (dev): Fast refresh in <1s
- Next.js production build: ~30-40s

**Runtime Performance**:
- Database queries: 5-30ms (FTS5 full-text search)
- API response time: 50-200ms average
- Page load (server components): <500ms
- Optimistic UI: Instant feedback with React 19

## Common Operations

### Viewing Logs

```bash
# Application logs (live tail)
docker logs -f m4s0kwo4kc4oooocck4sswc4

# Application logs (last 100 lines)
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100

# Database logs
docker logs veritable-games-postgres --tail 50

# Coolify logs
docker logs coolify --tail 100

# System logs
journalctl -u docker -n 100
```

### Database Operations

```bash
# Access psql shell
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games

# Run SQL query from command line
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT COUNT(*) FROM anarchist.documents;"

# List all schemas
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "\dn"

# List tables in schema
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "\dt anarchist.*"

# Database size
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT pg_size_pretty(pg_database_size('veritable_games'));"
```

### Container Management

```bash
# List all running containers
docker ps

# Inspect container configuration
docker inspect m4s0kwo4kc4oooocck4sswc4

# Check container resource usage
docker stats m4s0kwo4kc4oooocck4sswc4 --no-stream

# View container networks
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{json .NetworkSettings.Networks}}' | jq

# Check environment variables (redacted)
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep -v PASSWORD
```

## Troubleshooting

### Application Not Responding

```bash
# 1. Check if container is running
docker ps --filter "name=m4s0kwo4kc4oooocck4sswc4"

# 2. Check application logs for errors
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50

# 3. Check if database is accessible
docker exec veritable-games-postgres psql -U postgres -c "SELECT 1;"

# 4. Restart application container (via Coolify)
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

### Database Connection Failed

```bash
# 1. Verify PostgreSQL is running
docker ps --filter "name=veritable-games-postgres"

# 2. Check database logs
docker logs veritable-games-postgres --tail 50

# 3. Verify network connectivity
docker exec m4s0kwo4kc4oooocck4sswc4 nc -zv veritable-games-postgres 5432

# 4. Check if database is accepting connections
docker exec veritable-games-postgres psql -U postgres -c "SELECT 1;"
```

### Deployment Not Triggering

```bash
# 1. Check Coolify is running
docker ps --filter "name=coolify"

# 2. Check GitHub webhook (in Coolify UI)
# Visit: http://192.168.1.15:8000/project/[project-id]/application/m4s0kwo4kc4oooocck4sswc4/webhooks

# 3. Manually trigger deployment
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4

# 4. Check deployment logs
coolify resource logs m4s0kwo4kc4oooocck4sswc4
```

### WireGuard VPN Not Working

```bash
# Check WireGuard status
sudo wg show wg0

# Test connectivity to laptop
ping 10.100.0.2

# Restart WireGuard
sudo systemctl restart wg-quick@wg0

# See detailed incident analysis: docs/veritable-games/WIREGUARD_INCIDENT_RECOVERY_SESSION_MARCH_2_2026.md
```

## Production Checklist

Before deploying to production, verify:

**Database**:
- ✅ DATABASE_URL or POSTGRES_URL set in Coolify (REQUIRED)
- ✅ Format: `postgresql://postgres:PASSWORD@veritable-games-postgres:5432/veritable_games`
- ✅ Database container running and healthy

**Application**:
- ✅ SESSION_SECRET generated (openssl rand -hex 32)
- ✅ ENCRYPTION_KEY generated (openssl rand -hex 32)
- ✅ NODE_ENV=production
- ✅ NEXT_PUBLIC_SITE_URL=https://www.veritablegames.com

**Infrastructure**:
- ✅ Docker containers running (17 containers)
- ✅ Coolify dashboard accessible
- ✅ Auto-deploy webhook configured
- ✅ Backup scripts tested and scheduled

**Security**:
- ✅ Firewall configured (UFW)
- ✅ SSH key authentication only
- ✅ WireGuard VPN operational
- ✅ Secrets not committed to git
- ⚠️ Token rotation completed (see [TOKEN_ROTATION_REQUIRED.md](docs/server/TOKEN_ROTATION_REQUIRED.md))

**Verification**:
```bash
# Application responds
curl -f http://192.168.1.15:3000/api/health

# Database connectivity
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT 1;"

# Deployed commit matches latest
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT
```

## Recent Infrastructure Changes

### March 2, 2026 - WireGuard Incident Recovery & Documentation
- ✅ Complete analysis of network failure incident
- ✅ Created comprehensive recovery guide (WIREGUARD_INCIDENT_RECOVERY_SESSION_MARCH_2_2026.md)
- ✅ Deleted broken template configurations
- ✅ Prevented future routing conflicts with mandatory validation procedures
- ✅ Added critical warnings to CLAUDE.md and setup guides

### March 1, 2026 - Marxist Library Metadata Audit COMPLETE
- ✅ **100% COMPLETION**: All 12,728 documents enriched with author/date metadata
- ✅ Rate: ~25 documents/hour (far exceeding 2-4 month estimate)
- ✅ URL path analysis method: 100% success rate (no external requests needed)
- ✅ Author mapping database: 80+ authors with proper names extracted
- ✅ Session duration: 1 week (Feb 24 - Mar 1, 2026)

### March 1, 2026 - YouTube Transcript Cleanup Deployed
- ✅ Paragraph formatting for wall-of-text transcripts
- ✅ Preview text generation for YouTube documents
- ✅ Metadata detection for content extraction
- ✅ Deployed to production (commit 77f4c31)

### February 23, 2026 - Document Deduplication Phase 3 Complete
- ✅ Phase 3A: 75,829 document fingerprints generated (0% error rate)
- ✅ Phase 3B: 621 duplicate clusters identified across 3 collections
- ✅ Exact matches: 316 clusters (100% confidence, ready for auto-merge)
- ✅ Fuzzy/near-duplicate: 305 clusters (ready for manual review)

### December 4, 2025 - Hybrid SSD/HDD Storage Migration
- ✅ Completed migration after second Samsung SSD failure
- ✅ **NEW ARCHITECTURE**: Docker on `/home/user/docker-ssd/` (SSD), Bitcoin on `/data` (HDD)
- ✅ All services operational, zero data loss
- ✅ Old Samsung SSD physically removed (February 2026)

### November 26, 2025 - PDF Conversion Workflow
- ✅ Production-ready PDF→Markdown conversion workflow
- ✅ AI-powered conversion using marker_single (75% artifact fix rate)
- ✅ Automated cleanup script with 6 pattern fixes
- ✅ Organized 63 archived scripts (95% reduction in clutter)
- ✅ Created comprehensive documentation (PDF_CONVERSION_WORKFLOW.md)
- 📊 Performance: ~3.5 min/PDF, 100% success rate

### November 21, 2025 - Repository Initialization
- ✅ Converted `/home/user` to tracked git repository
- ✅ Created comprehensive infrastructure documentation (2,650+ lines)
- ✅ Organized 54 GB of data with strategic .gitignore
- ✅ Added git submodules (veritable-games-site, btcpayserver-docker)
- ✅ Cleaned up 3.05 GB of obsolete data
- ✅ Migrated to Veritable-Games organization

### November 15, 2025 - Network Cleanup & Container Protection
- ✅ Removed OpenVPN (conflicted with WireGuard routing)
- ✅ Resolved WireGuard handshake failures
- ✅ Resolved Coolify unserialize error (corrupted environment variables)
- ✅ Added container protection protocols after incident recovery

### November 5, 2025 - Production Deployment
- ✅ Deployed Veritable Games to production
- ✅ Migrated SQLite → PostgreSQL (24,599 documents)
- ✅ Configured Coolify auto-deployment
- ✅ Set up dual-network architecture (coolify + veritable-games-network)

## Getting Help

**Infrastructure Questions**: See [CLAUDE.md](CLAUDE.md) - Server-level guidance
**Application Development**: See [projects/veritable-games/site/CLAUDE.md](projects/veritable-games/site/CLAUDE.md)
**Documentation Hub**: See [docs/README.md](docs/README.md)
**Troubleshooting**: See documentation files in [docs/server/](docs/server/)

## License

Private repository - All rights reserved.

---

**Last Updated**: March 2, 2026
**Repository Created**: November 21, 2025
**GitHub**: https://github.com/Veritable-Games/veritable-games-server
**Organization**: Veritable Games
**Server**: 192.168.1.15 (Ubuntu Server 22.04.5 LTS)
