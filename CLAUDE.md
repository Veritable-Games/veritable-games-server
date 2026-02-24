# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🚨 READ THIS FIRST: Veritable Games Production Server 🚨

**CRITICAL: This is `/home/user/CLAUDE.md` - SERVER-LEVEL guidance for the Veritable Games production server**

### ✅ THIS DIRECTORY (`/home/user`) IS NOW A GIT REPOSITORY ✅

**Updated**: November 21, 2025 - This directory is now tracked as `veritable-games-server` repository

If you just invoked `/init` and are reading this, you need to understand:

- **You are on the PRODUCTION SERVER** (192.168.1.15)
- **This directory (`/home/user`) IS NOW a git repository** - server configuration and infrastructure tracking
- **GitHub Repository**: https://github.com/Veritable-Games/veritable-games-server
- **The Veritable Games project has its OWN separate git repository** (tracked as submodule)
- **This file** covers server-wide operations, infrastructure, and deployment workflows
- **Project CLAUDE.md file** covers project-specific development, architecture, and coding patterns

### 📍 Which CLAUDE.md Should You Read?

**Use this decision tree:**

```
Q: What are you trying to do?

A: Work on Veritable Games codebase (Next.js, React, TypeScript)
   → Navigate to: /home/user/projects/veritable-games/site/
   → Read: /home/user/projects/veritable-games/site/CLAUDE.md
   → That file covers: Architecture, coding patterns, database, development

A: Server operations (git workflows, deployments, Docker, PostgreSQL)
   → You are in the right place!
   → Keep reading THIS file

A: I just ran /init in /home/user
   → You are in the server configuration repository
   → This tracks server infrastructure, not application code
   → For application development, navigate to:
     /home/user/projects/veritable-games/site/
```

### 📂 File Locations Reference

| File Location | Purpose | Scope |
|---------------|---------|-------|
| `/home/user/CLAUDE.md` | **THIS FILE** - Server operations | Server-level guidance |
| `/home/user/projects/veritable-games/site/CLAUDE.md` | Veritable Games development | VG coding, architecture, patterns |

---

## 🚨 ACTIVE: Document Library Audit, Cleanup & Deduplication - PHASE 3 COMPLETE, PHASE 4 IN PROGRESS (February 23, 2026)

**📖 READ THIS NEXT**: Phase 4 Multi-Collection Audit Status

**Status**:
- ✅ LIBRARY AUDIT COMPLETE - All 2,561 documents processed
- ✅ PHASE 3C UI DEPLOYED - Duplicate review interface live at `/admin/duplicates`
- ⏳ MARXIST AUDIT IN PROGRESS - 12,728 documents initialized, first batch ready
- ✅ PHASE 3A & 3B COMPLETE - 75,829 fingerprints generated, 621 duplicate clusters identified

**Location**: `/home/user/projects/veritable-games/resources/processing/audit-scripts/`
**Latest**: Marxist audit system deployed, ready for metadata review

### Phase 3 Summary

✅ **Phase 3A: Fingerprint Generation** (Complete)
- Marxist: 12,728 fingerprints ✅
- YouTube: 60,544 fingerprints ✅
- Library: 2,557 fingerprints ✅ (earlier)
- **Total**: 75,829 fingerprints generated in 51 minutes
- **Error rate**: 0%

✅ **Phase 3B: Duplicate Detection** (Complete)
- **Exact matches (Layer 1)**: 316 clusters (confidence 1.0)
- **Fuzzy matches (Layer 2)**: 160 clusters (confidence 0.8)
- **Near-duplicates (Layer 3)**: 145 clusters (confidence 0.75)
- **Total clusters**: 621
- **Documents in duplicates**: 566 (0.7% of corpus)

### Duplicate Detection by Source
```
Library:  169 docs (6.6% of 2,561)
Marxist:  180 docs (1.4% of 12,728)
YouTube:  217 docs (0.4% of 60,544)
```

### Next Steps: Phase 3C Manual Review (Optional)

**Quick Commands**:
```bash
# Navigate to audit scripts
cd /home/user/projects/veritable-games/resources/processing/audit-scripts

# View Phase 3 results
cat PHASE3_RESULTS.md

# Query duplicate clusters
psql postgresql://postgres:postgres@localhost:5432/veritable_games
SELECT source, COUNT(*) as count FROM shared.document_fingerprints GROUP BY source;
SELECT cluster_type, COUNT(*) as count FROM shared.duplicate_clusters GROUP BY cluster_type;
```

### What Was Accomplished

1. **Phase 1**: Metadata audit of Library collection (2,561 docs, 94.5% reviewed)
2. **Phase 2**: Content cleanup - title extraction & formatting fixes (48K docs)
3. **Phase 3A**: Generated 75,829 document fingerprints (MD5, SHA256, MinHash)
4. **Phase 3B**: Detected 621 duplicate clusters across collections

### What's Ready for Phase 3C

- ✅ **Exact duplicates ready for auto-merge**: 316 clusters (100% confidence)
- 🔍 **Medium/low confidence clusters ready for manual review**: 305 clusters
- 📊 **Admin UI not yet created** - can review via direct database queries
- ✨ **Zero data loss guarantee** - all operations reversible

### How to Resume

See: `/home/user/projects/veritable-games/resources/processing/audit-scripts/LIBRARY_AUDIT_WORKFLOW.md`

**TL;DR**:
1. Get next batch: `python3 metadata_audit.py next --count 10`
2. For each document:
   - Look up in database
   - Research missing author/date
   - Update database
   - Mark as fixed in audit
3. Repeat until complete
4. Save progress: `python3 metadata_audit.py finalize-round --name "Round_X"`

### Database Tables (Phase 3)

**Fingerprints**:
- `shared.document_fingerprints` (75,829 rows)
  - Content hashes (MD5, SHA256, normalized), MinHash, word count
  - All collections except Anarchist (content files missing)

**Duplicates**:
- `shared.duplicate_clusters` (621 rows)
  - Cluster type, confidence score, review status
- `shared.cluster_documents` (1,519 rows)
  - Document-to-cluster mappings, canonical marking

**Earlier Audit**:
- `library.metadata_audit_log` - Library collection audit trail
- `library.library_documents` - Library documents (all 2,561)

### Known Issues

⚠️ **Anarchist Collection**: Content files not found on disk
- Database has 24,643 records with file_path references
- Files expected in `/data/archives/veritable-games/anarchist_library_texts/`
- Files do NOT exist on current server
- Can be added to deduplication if files are restored
- Workaround: Use only Marxist/YouTube/Library for now (75K docs)

### Future Work

**Phase 3C**: Manual review & merge of duplicate clusters
- Review 305 medium/low-confidence clusters
- Auto-merge 316 exact-match clusters
- Implement tag consolidation strategy
- Estimated effort: 40-80 hours

**Phase 4**: Optional
- Restore Anarchist content files if available
- Add Anarchist to deduplication
- Cross-verify with Anarchist Library upstream

---

## 📰 PRIOR WORK: Storage Migration Complete (December 4, 2025)

**See**: `/home/user/docs/server/RECENT_WORK_DEC_2025.md`

**TL;DR**:
- Samsung SSD (/dev/sda) failed for the SECOND TIME (first: Nov 27, second: Dec 4)
- Completed hybrid SSD/HDD storage migration
- **NEW ARCHITECTURE**: Performance data on SSD, Bitcoin blockchain on HDD
- Docker relocated: `/var/lib/docker` → `/home/user/docker-ssd`
- All services operational, zero data loss
- Tag cleanup preserved (11,986 tags)
- **Old /var drive retired** - Old Samsung SSD physically removed (February 2026)

**Key Changes**:
- Docker data-root: `/home/user/docker-ssd/` (SSD)
- Bitcoin blockchain: `/data/docker-hdd-volumes/` (HDD, bind-mounted)
- Emergency backup at `/data/var-migration-backup/` (keep 48h)

---

## ⚠️ CRITICAL: Production Server Environment

**Updated**: December 4, 2025 (Storage architecture updated)

You're working on the Veritable Games production server (192.168.1.15).

### Server Configuration Repository

**veritable-games-server** - This repository
   - **GitHub**: https://github.com/cwcorella-git/veritable-games-server
   - **Purpose**: Server configuration, infrastructure documentation, deployment procedures
   - **Size**: ~1 MB (excludes 59 GB of data/archives via .gitignore)
   - **Submodules**:
     - `projects/veritable-games/site/` → Veritable Games application code
     - `btcpayserver-docker/` → BTCPayServer infrastructure

### Active Project

**Veritable Games** - Production application (git submodule)
   - Repository: `/home/user/projects/veritable-games/site/`
   - GitHub: https://github.com/Veritable-Games/veritable-games-site
   - Resources: `/home/user/projects/veritable-games/resources/`
   - URL: https://www.veritablegames.com
   - **For coding work**: Read `/home/user/projects/veritable-games/site/CLAUDE.md`

---

## 🚨 CRITICAL: CONTAINER PROTECTION (READ BEFORE ANY DOCKER OPERATIONS) 🚨

**INCIDENT RECOVERY**: November 15, 2025 - Previous model broke production by creating unauthorized PostgreSQL container

### ❌ ABSOLUTELY PROHIBITED - DO NOT DO THESE:

1. **❌ NEVER create new PostgreSQL containers**
   - We have ONE production database: `veritable-games-postgres`
   - It contains all production data (13 schemas, 170 tables)
   - Creating a new one WILL BREAK THE SITE

2. **❌ NEVER modify `veritable-games-postgres` container**
   - Do not stop it
   - Do not remove it
   - Do not change its configuration
   - Do not modify its networks

3. **❌ NEVER change database connection strings without user approval**
   - DATABASE_URL must point to `veritable-games-postgres`
   - POSTGRES_URL must point to `veritable-games-postgres`
   - Changing these breaks the application

### ✅ PROTECTED CONTAINERS (READ-ONLY FOR CLAUDE)

**Production Database** (DO NOT TOUCH):
- Name: `veritable-games-postgres`
- Image: `postgres:15-alpine`
- Networks: `veritable-games-network` + `coolify`
- Data: All production data since deployment
- **Ask user before ANY modifications**

**Application Container** (Managed by Coolify):
- Name: `m4s0kwo4kc4oooocck4sswc4`
- Managed by: Coolify auto-deployment
- **Only modify via git push → Coolify deployment**

### 📋 Container Change Protocol

**BEFORE any container operation, you MUST**:
1. ✅ Ask user for explicit approval
2. ✅ Document current state
3. ✅ Create database backup: `docker exec veritable-games-postgres pg_dumpall -U postgres > backup.sql`
4. ✅ Plan rollback procedure
5. ✅ Show user the plan and wait for confirmation

### 📖 Recovery Documentation

If something goes wrong, see: `/home/user/docs/server/CONTAINER_PROTECTION_AND_RECOVERY.md`

This document contains:
- Full incident report (what went wrong)
- Emergency recovery procedures
- Container inventory and purposes
- Verification checklists
- Quick command reference

---

## ⚠️ CRITICAL: Git Workflow for Claude Models (READ THIS FIRST)

### For the Next Claude Model Working on This Server

**You are on the production server (192.168.1.15)**. Here's what you MUST know:

#### 1. Repository Location

**✅ VERITABLE GAMES:**
```bash
/home/user/projects/veritable-games/site/
```

**❌ ARCHIVED Repository (DO NOT USE):**
```bash
/home/user/veritable-games-migration-ARCHIVED-2025-11-13/
```

**❌ NOT A REPOSITORY:**
```bash
/home/user/  # This is the HOME DIRECTORY, not a git repo!
```

#### 2. Workflow: Edit in Repository, NEVER in Container

```
✅ CORRECT:
Repository (/home/user/projects/veritable-games/site/)
  → Edit files with Read/Write/Edit tools
  → Commit to git
  → Push to GitHub
  → Auto-deploy via Coolify

❌ WRONG:
Container (m4s0kwo4kc4oooocck4sswc4)
  → docker exec to edit files
  → Changes are LOST on next deploy
```

#### 3. Standard Workflow Commands

```bash
# Navigate to repository
cd /home/user/projects/veritable-games/site

# Pull latest changes (ALWAYS do this first)
git pull origin main

# Make your changes using Read/Write/Edit tools
# ... edit files ...

# Stage and commit
git add [files]
git commit -m "your message"

# Push to GitHub (triggers auto-deploy)
git push origin main

# Wait 2-5 minutes for Coolify to deploy
```

#### 4. SSH & GitHub Authentication

**✅ Status**: Operational (February 24, 2026)

**SSH Deploy Key**: `~/.ssh/id_ed25519` (ED25519)
- Fingerprint: `SHA256:vVAHBc6oSxZ2RxBPmMt+7mLJ2ipIIVqBZojYwCXFBNY`
- Registered on `Veritable-Games/veritable-games-server` (Deploy Key ID: 142959403)
- Permissions: Read + Write

**Repository Access**:
- `veritable-games-server`: SSH push via deploy key ✅
- `veritable-games-site`: HTTPS push via gh credentials ✅

**Coolify Auto-Deploy**: Uses GitHub App
- App: `veritable-games-server` (App ID: 2235824)
- Triggers on webhook from GitHub push
- Private key stored in Coolify

**Verification**:
```bash
# Test SSH key authentication
ssh -T git@github.com
# Expected: "Hi Veritable-Games/veritable-games-server! You've successfully authenticated..."

# Test gh CLI
gh auth status
# Expected: "✓ Logged in to github.com account cwcorella-git"

# Test push (server repo)
cd /home/user
git push origin main --dry-run

# Test push (site repo)
cd /home/user/projects/veritable-games/site
git push origin main --dry-run
```

**📖 Full Documentation**: See `/home/user/docs/server/SSH_KEY_SETUP_FEBRUARY_2026.md`
- Complete key setup details
- Deployment flow overview
- Troubleshooting guide
- Key rotation procedures

#### 5. Available Tools

**✅ Configured and Ready:**
- **Git:** Deploy key for push to `veritable-games-server` repo
- **Coolify:** GitHub App for auto-deployments (webhook-triggered)
- **Coolify CLI:** Manual deployment control (`coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4`)
- **Docker:** Container inspection and log access
- **PostgreSQL:** Database operations via docker exec

**Quick Access:**
```bash
# Veritable Games repository
cd ~/projects/veritable-games/site

# Push triggers auto-deploy via GitHub App webhook
git push origin main

# Manual deploy (if webhook fails)
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4

# Check deployed commit
docker inspect m4s0kwo4kc4oooocck4sswc4 | grep SOURCE_COMMIT
```

#### 6. Critical Rules

- ✅ **DO**: Edit files in the repository
- ✅ **DO**: Use Read, Write, Edit tools
- ✅ **DO**: Commit and push to GitHub
- ✅ **DO**: Use Coolify CLI for immediate deployments
- ✅ **DO**: Let deployment systems handle container updates
- ✅ **DO**: Navigate to the repository BEFORE running /init
- ❌ **DON'T**: Edit files inside containers with `docker exec`
- ❌ **DON'T**: Copy files into containers with `docker cp`
- ❌ **DON'T**: Use the archived repository
- ❌ **DON'T**: Run /init from /home/user (it's not a git repo!)

#### 7. Verification

```bash
# Check you're in the right repository
pwd
# Should show /home/user/projects/veritable-games/site
# For server ops: /home/user is fine (but not a git repo)

# Check remote is GitHub (when in a repository)
git remote -v
# Should show: git@github.com:Veritable-Games/veritable-games-site.git

# Check you can push (when in a repository)
git push origin main --dry-run
```

#### 8. Deployment Verification

```bash
# Check deployed commit (wait 2-5 minutes after push)
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT

# Compare with latest commit
cd /home/user/projects/veritable-games/site
git log -1 --oneline

# They should match after deployment completes
```

---

## Server & Deployment Setup

### Remote Server Configuration

**Server:** `veritable-games-server`
- **Hostname:** veritable-games-server
- **IP:** 192.168.1.15
- **User:** `user`
- **Working Directory:** `/home/user/`
- **Primary URL:** https://www.veritablegames.com
- **Local Access:** http://192.168.1.15:3000
- **Access:** SSH with key authentication

### Dual-Drive Architecture

**The server uses TWO physical drives with intentional separation:**

**Drive 1 (sdb, 477GB):** User data & application code
- Mounted at: `/` (root filesystem)
- Contains: `/home/user/`, all projects, git repositories
- Usage: 108GB / 468GB (25% used, 336GB free)

**Drive 2 (sda, 954GB):** System services & Docker
- Mounted at: `/var`
- Contains: Docker images/containers/volumes, logs, system services
- Usage: 32GB / 938GB (4% used, 859GB free)

**Why this matters:**
- ✅ Docker growth won't fill `/home/user/`
- ✅ User data isolated from service data
- ✅ Larger drive for Docker's unpredictable growth
- ✅ Better backup strategy (separate concerns)

**File placement rules:**
- User projects, code, archives → `/home/user/` (on sdb)
- Docker volumes, databases, logs → `/var/` (on sda, automatic)

📝 **Complete documentation:** [docs/server/DRIVE_ARCHITECTURE.md](./docs/server/DRIVE_ARCHITECTURE.md)

### Directory Structure

```
/home/user/                      # Server home directory (git repository)
├── projects/                    # Project organization
│   └── veritable-games/        # VG project
│       ├── site/               # VG production repository (git submodule)
│       │   ├── CLAUDE.md       # VG-specific development guide
│       │   ├── frontend/       # Next.js application
│       │   ├── docs/           # VG documentation
│       │   └── .git/           # VG git repository
│       └── resources/          # VG project resources
│           ├── data/           # Literature archives (3.1GB)
│           ├── scripts/        # Import scripts, utilities
│           ├── sql/            # Migrations
│           ├── logs/           # Script logs
│           └── docker-compose.yml  # Local DB
├── docs/                       # Server documentation
│   ├── veritable-games/        # VG-specific docs
│   │   └── planning/           # Project planning documents
│   ├── server/                 # Server operations docs
│   └── reference/              # General reference
├── backups/                    # Database backups & monitoring (2.5GB)
│   ├── scripts/                # Backup & health check scripts
│   ├── migration-scripts-archive/  # Archived one-time migrations
│   ├── postgres-daily-*.sql.gz # Daily PostgreSQL backups
│   ├── backup.log              # Backup results
│   ├── disk-monitor.log        # Disk usage alerts
│   └── health-check.log        # System health history
├── repository/                 # Development tool archives (5.9GB)
│   ├── AI-ML/                  # LLM/RAG tools, ML frameworks
│   ├── Development-Tools/      # AI assistants, notebooks, testing
│   ├── Web-Development/        # Next.js related tools
│   └── [see REPOSITORY_ARCHITECTURE.md for details]
├── archives/                   # Reference materials (16GB)
│   ├── ai-ml-data/            # Embeddings, training data
│   ├── learning/              # Tutorials and courses
│   ├── game-development/      # Godot, graphics, physics
│   ├── entertainment/         # Media tools, astronomy
│   └── hardware/              # Device drivers
├── shared/                     # Cross-project resources
│   ├── archives/               # SSH keys, backups
│   └── packages/               # System packages
├── wireguard-backups/          # WireGuard VPN configs & health scripts
├── btcpayserver-docker/        # BTCPayServer infrastructure (git submodule)
├── snap/                       # Snap package data (system-managed)
├── .claude.json                # Claude Code configuration
├── CLAUDE.md                   # THIS FILE - Server-level guidance
└── README.md                   # Repository documentation
```

See `/home/user/projects/README.md` for detailed structure documentation.

### Deployment Infrastructure

**Coolify** - Self-hosted deployment platform
- Web interface: http://192.168.1.15:8000
- Manages containers and automatic deployments
- CLI installed: `coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4`

**Application Container:**
- **ID:** `m4s0kwo4kc4oooocck4sswc4`
- **Type:** Next.js app in Node container (Nixpacks build)
- **Current commit:** 679fb6d (November 14, 2025)

**Database:**
- **Container:** `veritable-games-postgres` (postgres:15-alpine)
- **Database:** `veritable_games`
- **Schemas:** public, anarchist, shared, library, auth, wiki, forums

### ⚠️ CRITICAL: Container Ephemeral Changes

**WARNING: Changes made inside running containers are EPHEMERAL and will be LOST on redeployment!**

**✅ CORRECT WORKFLOW: Edit files in git repository directly**

```bash
# 1. Navigate to repository
cd /home/user/projects/veritable-games/site

# 2. Edit files directly in the repository
# Use Read, Write, Edit tools - NOT docker exec

# 3. Commit changes
git add [files]
git commit -m "your message"

# 4. Push to GitHub
git push origin main

# 5. Wait for Coolify to deploy (2-5 minutes)
```

**❌ NEVER edit files in containers** - Use git repository as source of truth

See `docs/server/CONTAINER_TO_GIT_AUTOMATION.md` for detailed workflow documentation.

---

## Project Overview

### Veritable Games Platform

Multi-purpose radical literature archival and community platform:

**Application:** Full-stack web application with wiki, forums, user management, library system

**Political Literature Archive:** Large-scale scraping and archival system:
- **Anarchist Library:** 24,643 texts across 27 languages (COMPLETED)
- **Marxists.org:** Targeting 50K-150K texts (IN PROGRESS - currently ~6,584 downloaded)

**Technology Stack:**
- **Frontend:** Next.js/React
- **Database:** PostgreSQL 15 (Alpine) in production
- **Runtime:** Node.js with pg/postgres drivers
- **Python:** requests, BeautifulSoup4, html2text, PyYAML, psycopg2
- **Infrastructure:** Docker, Coolify, Traefik, Nixpacks

**Key Directories:**
- **Repository:** `/home/user/projects/veritable-games/site/`
- **Resources:** `/home/user/projects/veritable-games/resources/`
  - `data/` - Literature archives (3.1GB)
  - `scripts/` - Python import scripts
  - `sql/` - Database migrations
  - `logs/` - Script execution logs
  - `docker-compose.yml` - Local PostgreSQL environment
- **Documentation:** `/home/user/docs/veritable-games/`

**🔗 For development work:** See `/home/user/projects/veritable-games/site/CLAUDE.md`

---

## 🛠️ Server Maintenance & Diagnostic Tools

**Updated**: November 15, 2025

### Automated Health Check Scripts

**Location**: `/home/user/wireguard-backups/`

All scripts created and tested for production use:

#### 1. WireGuard VPN Health Check
```bash
bash /home/user/wireguard-backups/verify-wg-tunnel.sh
```

**Checks**:
- ✅ WireGuard interface exists (wg0)
- ✅ Peer configuration present
- ✅ Recent handshake (<3 minutes)
- ✅ Ping test to laptop (10.100.0.2)
- ✅ SSH connectivity test

**Output**: Pass/fail status with detailed diagnostics

#### 2. WireGuard Configuration Backup
```bash
bash /home/user/wireguard-backups/backup-wg-config.sh
```

**Backs up**:
- `/etc/wireguard/wg0.conf` (configuration file)
- `wg show wg0` (current status)
- Timestamped backups: `wg0.conf.YYYYMMDD_HHMMSS`

**Location**: `/home/user/wireguard-backups/`

#### 3. Coolify Health Diagnostic
```bash
bash /home/user/wireguard-backups/coolify-diagnostic.sh
```

**Comprehensive check**:
- ✅ Container health (all 6 Coolify containers)
- ✅ Empty environment variables (corrupted data)
- ✅ Recent unserialize errors (Laravel issues)
- ✅ Cache status (bootstrap + views)
- ✅ Database connection
- ✅ Application configuration
- ✅ Disk space usage
- ✅ Recent deployment status

**Output**: Full diagnostic report with automated recommendations

### OpenVPN Status: REMOVED

**Date Removed**: November 15, 2025

OpenVPN has been **completely removed** from the server to prevent routing conflicts with WireGuard:

- ❌ Service stopped: `systemctl stop openvpn@server`
- ❌ Auto-start disabled: `systemctl disable openvpn`
- ❌ Interface removed: `tun0` no longer exists
- ❌ Routes removed: `10.200.0.0/24` cleaned up
- ✅ Configuration backed up: `/home/user/wireguard-backups/openvpn-backup/`

**Why removed**: OpenVPN routed local network traffic (192.168.1.0/24) through tun0, breaking WireGuard UDP packet delivery and causing handshake failures.

**Current VPN**: WireGuard only (`wg0` interface, 10.100.0.0/24 subnet)

**📖 Documentation**: `/home/user/projects/veritable-games/site/docs/server/OPENVPN_REMOVAL_NOVEMBER_15_2025.md`

### Maintenance Schedule

**Weekly** (Recommended):
```bash
# WireGuard health check
bash /home/user/wireguard-backups/verify-wg-tunnel.sh

# Coolify diagnostic
bash /home/user/wireguard-backups/coolify-diagnostic.sh
```

**Monthly** (Recommended):
```bash
# Backup WireGuard config
bash /home/user/wireguard-backups/backup-wg-config.sh

# Clear Coolify caches
docker exec coolify php artisan optimize:clear

# PostgreSQL backup
docker exec veritable-games-postgres pg_dumpall -U postgres > /home/user/backups/postgres-$(date +%Y%m%d).sql
```

**After any changes**:
```bash
# Always verify before and after
bash /home/user/wireguard-backups/verify-wg-tunnel.sh
bash /home/user/wireguard-backups/coolify-diagnostic.sh
```

### Recent Issues Resolved (November 15, 2025)

**1. Coolify Unserialize Error (RESOLVED)**:
- **Issue**: `unserialize(): Error at offset 0 of 76 bytes`
- **Cause**: Plain-text environment variables (DATABASE_URL, POSTGRES_URL) with 76-byte values
- **Fix**: Deleted corrupted variables (IDs 80, 81), cleared caches
- **Prevention**: Run `coolify-diagnostic.sh` weekly to detect corrupted variables
- **📖 Documentation**: `docs/server/COOLIFY_UNSERIALIZE_76_BYTE_ERROR_FIX.md`

**2. OpenVPN Routing Conflicts (RESOLVED)**:
- **Issue**: WireGuard handshakes failing, routing conflicts
- **Cause**: OpenVPN routing 192.168.1.0/24 through tun0
- **Fix**: Removed OpenVPN completely from server
- **Prevention**: Use WireGuard only, no conflicting VPN services
- **📖 Documentation**: `docs/server/OPENVPN_REMOVAL_NOVEMBER_15_2025.md`

**3. Container Protection Incident (RESOLVED)**:
- **Issue**: Unauthorized PostgreSQL container creation broke production
- **Fix**: Reverted to original container, added protection warnings
- **Prevention**: Read container protection section before ANY Docker operations
- **📖 Documentation**: `/home/user/docs/server/CONTAINER_PROTECTION_AND_RECOVERY.md`

---

## Common Operations

### Database Operations (Veritable Games)

```bash
# Access PostgreSQL CLI
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games

# Backup database
docker exec veritable-games-postgres pg_dump -U postgres veritable_games > backup.sql

# Check database health
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT 1;"
```

### Application Container (Veritable Games)

```bash
# Check container status
docker ps --filter "name=m4s0kwo4kc4oooocck4sswc4"

# View logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100

# Check environment variables
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}'

# Check deployed commit
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT
```

### Deployment

Option 1: Automatic (Default)
```bash
cd /home/user/projects/veritable-games/site
git push origin main
# Wait 2-5 minutes for Coolify auto-deploy
```

Option 2: Manual (Immediate)
```bash
cd /home/user/projects/veritable-games/site
git push origin main
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

### Data Processing

```bash
# Navigate to project resources
cd /home/user/projects/veritable-games/resources

# Import anarchist documents
python3 scripts/import_anarchist_documents_postgres.py data/converted-markdown

# Check scraper status
ps aux | grep scrape_marxists_org
tail -f data/scraping/marxists-org/scrape.log
```

### PDF Conversion Workflow

**Status:** ✅ Production Ready (November 26, 2025)

**Overview:**
AI-powered PDF→Markdown conversion using marker_single with automated cleanup.

**Performance:**
- Single PDF: ~3.5 minutes average
- Quality: 75% automatic artifact cleanup
- Success rate: 100% conversion, clean readable output

**Quick Start:**
```bash
# Navigate to library PDFs
cd /home/user/projects/veritable-games/resources/data/library-pdfs

# Convert single PDF
marker_single "document.pdf" \
  --output_dir "output" \
  --output_format markdown \
  --disable_multiprocessing

# Apply cleanup (fixes page breaks, spacing, punctuation)
python3 ../../scripts/cleanup_pdf_artifacts.py \
  --file "output/document.md" \
  --skip-ocr \
  --output "document-CLEANED.md"
```

**Batch Processing:**
```bash
cd /home/user/projects/veritable-games/resources/processing/unconverted-pdfs
bash batch_pdf_converter_marker.sh
```

**What Gets Fixed:**
- ✅ Sentences broken across paragraphs (page breaks)
- ✅ Missing spaces after punctuation
- ✅ CamelCase word splitting (theWord → the Word)
- ✅ Broken URLs with spaces
- ✅ 13,061 Unicode character fixes

**Documentation:**
- **Complete Guide:** `/home/user/projects/veritable-games/resources/data/PDF_CONVERSION_WORKFLOW.md`
- **Scripts:** `/home/user/projects/veritable-games/resources/scripts/`
  - `cleanup_pdf_artifacts.py` - Main cleanup script
  - `archived/` - 63 archived scripts (migrations, old converters)

**Tools:**
- **marker_single:** Installed via pipx (`~/.local/bin/marker_single`)
- **Installation:** `pipx install marker-pdf`

---

## Production Deployment Checklist

**Critical requirements before deploying to production:**

1. ✅ **DATABASE_URL** or **POSTGRES_URL** set in Coolify (REQUIRED - app will crash without it)
   - Format: `postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games`
   - Must be set in Coolify UI under Environment Variables
2. ✅ **DATABASE_MODE=postgres** (NOT sqlite)
3. ✅ **Generate secrets:**
   - `SESSION_SECRET` (openssl rand -hex 32)
   - `ENCRYPTION_KEY` (openssl rand -hex 32)
4. ✅ **NODE_ENV=production**
5. ✅ **NEXT_PUBLIC_SITE_URL=https://www.veritablegames.com**

**⚠️ CRITICAL: The app container will crash-loop if DATABASE_URL/POSTGRES_URL is not set!**

**Verification:**
```bash
# Check environment variables in container
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep -E "DATABASE|NODE_ENV"

# Check application logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50
```

---

## Current Project Status

- **Platform:** Active development, PostgreSQL in production
  - Container: `m4s0kwo4kc4oooocck4sswc4` (commit 679fb6d)
  - Status: Operational
  - URL: https://www.veritablegames.com

- **PDF Conversion Workflow** (Nov 26, 2025): ✅ PRODUCTION READY
  - Tool: marker_single (AI-powered OCR + layout detection)
  - Cleanup: cleanup_pdf_artifacts.py (75% artifact fix rate)
  - Performance: ~3.5 min/PDF average, 100% success rate
  - Quality: Clean, readable markdown with preserved structure
  - Scripts: 3 active + 63 archived (organized Nov 26, 2025)
  - Documentation: `/home/user/projects/veritable-games/resources/data/PDF_CONVERSION_WORKFLOW.md`

- **Unified Tag Schema** (Nov 2025 - Feb 2026): ✅ COMPLETE
  - ✅ Database migration: 19,952 tags in `shared.tags`
  - ✅ Tag extraction: 194,664 associations for anarchist documents
  - ✅ Frontend routing: Deployed
  - ✅ Anarchist tags API endpoint: Deployed
  - ✅ YouTube integration: 60,816 transcripts + 215,702 tag associations
  - ✅ Marxist integration: 342 documents + 3,262 tag associations
  - **Total across all 4 sources**: ~93,000 documents, ~414,000 tag associations
  - See `docs/veritable-games/UNIFIED_TAG_SCHEMA_STATUS.md` for details

- **Library Collections**: COMPLETE
  - ✅ Anarchist Library: 24,643 texts across 27 languages
  - ✅ YouTube Transcripts: 60,816 transcripts from 499 channels (imported Feb 20, 2026)
  - ✅ Marxist Library: 342 documents with rich metadata (imported Feb 20, 2026)
  - ✅ User Library: ~7,500 documents
  - **Note on Marxist**: Only 2.7% of 12,728 documents had extractable metadata (author+category). Requires investigation of metadata enrichment strategy.
  - Location: `/home/user/projects/veritable-games/resources/data/scraping/marxists-org/`

---

## 📋 Library Import Pipeline - Complete Workflow

**Updated**: November 28, 2025

**Master Document**: `/home/user/projects/veritable-games/MASTER_WORKFLOW_TIMELINE.md`

This master document contains the **complete 5-stage pipeline** from content acquisition to production deployment:

**Current Status**:
- **Stage 1A: NSD Sourcing** - 378/1,890 documents (20.0%), target 400
- **Stage 1B: PDF Conversion** - 900/2,535 completed (35.5%), 1,635 remaining
- **Stages 2-5**: Ready to begin after Stage 1 completion

**Timeline**: 1-2 weeks total to complete all stages

**What's in the master document**:
- Complete 5-stage workflow (Acquisition → Metadata → Import → Tags → Deployment)
- Current metrics and progress tracking
- Detailed timelines for each stage
- Documentation structure and references
- Decision points and success criteria
- Emergency procedures and troubleshooting

**Key Documentation References**:
- Stage 1A (NSD Sourcing): Session reports in `/home/user/projects/veritable-games/resources/processing/reconversion-scripts/`
- Stage 1B (PDF Conversion): `/home/user/projects/veritable-games/resources/data/PDF_CONVERSION_WORKFLOW.md`
- Stage 2A (Metadata): `/home/user/docs/veritable-games/LIBRARY_METADATA_EXTRACTION_REPORT.md`
- Stage 2B/4 (Tags): `/home/user/docs/veritable-games/UNIFIED_TAG_SCHEMA_STATUS.md`
- Stage 3A (Import): `/home/user/projects/veritable-games/resources/processing/reconversion-scripts/README_COMPLETE_WORKFLOW.md`

**Current Work - Laptop PDF Reconversion (December 2025 - February 2026)**:
- **Document**: `/home/user/docs/veritable-games/LAPTOP_PDF_RECONVERSION_DECEMBER_2025.md`
- **Status**: ✅ Phase 2c COMPLETE (February 14, 2026)
- **Results**: 174 xlarge PDFs converted (0 failures), 960 markdown files (571MB)
- **Output**: `reconversion-output-phase2c/`
- **Scope**: 830 unique PDFs from laptop library → database import
- **Innovation**: Phase 0 metadata linking + enhanced Phase 3 priority system + tag restoration
- **Next Steps**: Phase 3 (metadata injection) and Phase 4 (database import)

**When to Reference**:
- ✅ Starting any library-related work (sourcing, conversion, import)
- ✅ Planning next steps after completing a workflow stage
- ✅ Understanding dependencies between workflow stages
- ✅ Checking current progress metrics
- ✅ Finding relevant documentation for a specific task

---

## Quick Troubleshooting

### Container Crash-Looping (Veritable Games)

```bash
# Check logs for DATABASE_URL error
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 30

# Fix: Add DATABASE_URL in Coolify, then redeploy
```

### Database Connection Failed

```bash
# Verify PostgreSQL is running
docker exec veritable-games-postgres psql -U postgres -c "SELECT 1;"
```

### Deployment Not Triggering

```bash
# Manual deployment
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

### Invoked /init in /home/user

If you just ran `/init` in `/home/user`:
- **Problem:** `/home/user` is NOT a git repository
- **Solution:** Navigate to the repository first:
  ```bash
  cd /home/user/projects/veritable-games/site
  ```
- Then run `/init` again if needed (though CLAUDE.md file already exists)

---

## Documentation

**All detailed documentation is in `/home/user/docs/`**

### Quick Links

- **docs/README.md** - Complete documentation index
- **docs/server/DRIVE_ARCHITECTURE.md** - Dual-drive setup & file placement rules
- **docs/server/REPOSITORY_ARCHITECTURE.md** - Repository & archives organization (5.6GB tools, 16GB reference)
- **docs/reference/troubleshooting.md** - Detailed troubleshooting guide
- **docs/reference/architecture.md** - System architecture details
- **docs/reference/security-configuration.md** - Security setup
- **docs/reference/docker-build.md** - Build process details
- **docs/reference/scripts-guide.md** - Scripts documentation
- **docs/reference/dual-machine-workflow.md** - Server/laptop workflow

### Project-Specific Documentation

- **📍 /home/user/projects/veritable-games/site/CLAUDE.md** - Main VG development guide
- **docs/veritable-games/UNIFIED_TAG_SCHEMA_STATUS.md** - Tag system implementation
- **docs/veritable-games/FORENSIC_ANALYSIS_REPORT.md** - Previous issue analysis
- **docs/veritable-games/SCHEMA_OVERRIDE_DIAGNOSIS.md** - Schema diagnosis
- **projects/veritable-games/resources/README.md** - Project resources guide

**Server Management:**
- **docs/server/DRIVE_ARCHITECTURE.md** - Dual-drive architecture strategy
- **docs/server/REPOSITORY_ARCHITECTURE.md** - Tool archives & reference materials
- **docs/server/CONTAINER_TO_GIT_AUTOMATION.md** - Container workflow automation
- **docs/server/tmate-setup-guide.md** - Remote access setup

**General:**
- **docs/guides/** - User guides
- **docs/operations/** - Operational procedures
- **projects/README.md** - Multi-project organization guide
- **shared/README.md** - Shared resources guide

---

## Server Responsibilities

**What Claude can do on this server:**
- ✅ Code changes (Next.js, React, TypeScript) for both projects
- ✅ Git operations (commit, push to GitHub) for both projects
- ✅ Database operations (migrations, backups, queries) for VG
- ✅ Python script execution (imports, scraping) for VG
- ✅ Container operations (inspection, logs) for VG
- ✅ Trigger deployments (via git push or Coolify CLI)

**What to avoid:**
- ❌ Editing files inside containers
- ❌ Using the archived repository
- ❌ Forgetting to git pull before starting work
- ❌ Running /init in /home/user (not a git repo!)

See `docs/reference/dual-machine-workflow.md` for complete workflow documentation.

---

## Adding New Projects

When adding new projects to this server:

1. Clone/create repository in `/home/user/projects/new-project/`
2. Add project section to this CLAUDE.md file
3. Create `/home/user/docs/new-project/` for project-specific docs
4. Update `/home/user/projects/README.md` with project info
5. Update `/home/user/docs/README.md` documentation index
6. **Consider creating** `/home/user/projects/new-project/CLAUDE.md` for project-specific development guidance

See `/home/user/projects/README.md` for detailed organization guidelines.

---

## 📍 Navigation Summary for Claude Models

**If you want to:**

1. **Code on Veritable Games** → `cd /home/user/projects/veritable-games/site && read CLAUDE.md`
2. **Deploy/manage infrastructure** → You're in the right place (this file)
3. **Run /init** → Navigate to the repository FIRST, then run /init
4. **Understand this server** → Keep reading this file

**Remember:**
- `/home/user/` = Server home directory (NOT a git repo)
- `/home/user/projects/veritable-games/site/` = VG git repository

---

**Last Updated**: February 14, 2026
