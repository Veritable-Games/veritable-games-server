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

## 📰 RECENT WORK: Storage Migration Complete (December 4, 2025)

**🚨 READ THIS IF YOU'RE A NEW SESSION**: `/home/user/docs/server/RECENT_WORK_DEC_2025.md`

**TL;DR**:
- Samsung SSD (/dev/sda) failed for the SECOND TIME (first: Nov 27, second: Dec 4)
- Completed hybrid SSD/HDD storage migration
- **NEW ARCHITECTURE**: Performance data on SSD, Bitcoin blockchain on HDD
- Docker relocated: `/var/lib/docker` → `/home/user/docker-ssd`
- All services operational, zero data loss
- Tag cleanup preserved (11,986 tags)
- **Old /var drive retired** - DO NOT USE /dev/sda

**Key Changes**:
- Docker data-root: `/home/user/docker-ssd/` (SSD)
- Bitcoin blockchain: `/data/docker-hdd-volumes/` (HDD, bind-mounted)
- Emergency backup at `/data/var-migration-backup/` (keep 48h)

**⏳ PENDING TASK: Wipe Old Samsung SSD After Next Reboot**
- **When**: After next server reboot (when /dev/sda is no longer mounted)
- **Why**: Old Samsung SSD (/dev/sda) is still mounted at /var with 78GB old data
- **What**: `/etc/fstab` already updated to prevent auto-mount on reboot
- **How to wipe after reboot**:
  ```bash
  # Verify drive is unmounted
  df -h | grep sda  # Should show nothing

  # Option 1: Wipe filesystem signatures (quick)
  sudo wipefs -a /dev/sda

  # Option 2: Zero out drive (thorough, takes longer)
  sudo dd if=/dev/zero of=/dev/sda bs=1M status=progress

  # Then optionally physically disconnect the drive
  ```

**See full documentation**: `/home/user/docs/server/RECENT_WORK_DEC_2025.md`

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

#### 4. SSH Authentication

SSH key is already configured and auto-loads on login. If you need to manually load it:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519  # Enter passphrase if prompted
```

#### 5. Available Tools

**✅ Configured and Ready:**
- **Git:** Direct push to GitHub enabled (SSH key auto-loads)
- **Coolify CLI:** Manual deployment control (`coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4`)
- **Docker:** Container inspection and log access
- **PostgreSQL:** Database operations via docker exec

**Quick Access:**
```bash
# Veritable Games repository
cd ~/projects/veritable-games/site

# Deploy immediately
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4

# Check status
coolify resource list
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

- **Unified Tag Schema** (Nov 2025): MOSTLY COMPLETE
  - ✅ Database migration: 19,952 tags in `shared.tags`
  - ✅ Tag extraction: 194,664 associations for anarchist documents
  - ✅ Frontend routing: Deployed
  - ❌ Anarchist tags API endpoint: Missing from container
  - See `docs/veritable-games/UNIFIED_TAG_SCHEMA_STATUS.md` for details

- **Anarchist Library:** COMPLETE - 24,643 texts imported across 27 languages
- **Marxists.org Archive:** IN PROGRESS - ~6,584 texts downloaded (scraper running)
  - Location: `/home/user/projects/veritable-games/resources/data/scraping/marxists-org/`
  - Target: 12,735 total texts

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

**Last Updated**: November 16, 2025
