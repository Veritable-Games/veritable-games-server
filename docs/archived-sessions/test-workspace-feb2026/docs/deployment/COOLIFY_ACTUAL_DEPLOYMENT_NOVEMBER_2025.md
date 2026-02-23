📍 **Navigation**: [CLAUDE.md](../../CLAUDE.md) > [docs/](../README.md) > [DEPLOYMENT_DOCUMENTATION_INDEX.md](../DEPLOYMENT_DOCUMENTATION_INDEX.md) > [deployment/](./README.md) > Coolify Actual Deployment

---

# Coolify Actual Deployment - November 2025

**Veritable Games Platform - Successful Self-Hosted Deployment**

**Deployment Date**: November 5, 2025
**Status**: ✅ Production deployment successful
**Server**: Ubuntu Server 22.04 LTS
**Deployment Method**: Coolify + GitHub App + Nixpacks

---

## Overview

This document records the **actual deployment** that successfully deployed Veritable Games to a self-hosted Ubuntu Server using Coolify. It includes all the issues encountered, solutions applied, and critical configuration details that made the deployment work.

**This is the "real world" deployment guide** - not theory, but what actually worked.

---

## Table of Contents

1. [Prerequisites & Server Setup](#prerequisites--server-setup)
2. [Coolify Installation](#coolify-installation)
3. [GitHub Integration](#github-integration)
4. [Application Configuration](#application-configuration)
5. [Critical Build Issues & Solutions](#critical-build-issues--solutions)
6. [Environment Variables](#environment-variables)
7. [Deployment Success](#deployment-success)
8. [Next Steps](#next-steps)

---

## Prerequisites & Server Setup

### Server Specifications

- **OS**: Ubuntu Server 22.04.5 LTS (Jammy)
- **CPU**: 2+ cores
- **RAM**: 4GB+
- **Storage**:
  - 500GB NVMe (system - `/`)
  - Extra drive mounted to `/var` (Docker volumes, PostgreSQL, uploads)
- **Network**: WiFi (Intel Wi-Fi 6 AX200) - wlp4s0 interface

### Ubuntu Installation Choices

**Network Configuration**:
- Interface: wlp4s0 (WiFi)
- Configuration: DHCP (automatic)
- DNS: Google DNS (8.8.8.8, 8.8.4.4)

**Storage Configuration** (CRITICAL):
- Primary drive (500GB): Root filesystem (`/`, `/boot`, swap)
- Extra drive: Mounted to `/var` with ext4
- **Why `/var`**: Docker stores everything in `/var/lib/docker/`, so PostgreSQL data, uploads, and Coolify data automatically use the large drive
- LVM: Kept enabled for flexibility
- Encryption: Disabled (to avoid password at every boot)

**User Setup**:
- User: `user`
- Hostname: `veritable-games-server`
- SSH: OpenSSH server installed during setup
- SSH Keys: Imported from GitHub during installation

### Post-Installation Updates

```bash
# Initial system update
sudo apt update
sudo apt upgrade -y

# If packages held back, use full-upgrade
sudo apt full-upgrade -y
```

### Docker Installation

```bash
# Prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository (SINGLE LINE - multi-line caused issues)
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu jammy stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Verify
docker --version
docker compose version
```

**Issue Encountered**: Multi-line echo command created malformed repository file
**Solution**: Use single-line command for repository setup

### Node.js Installation

```bash
# Remove old Node.js (Ubuntu repo had ancient v12)
sudo apt purge -y nodejs npm libnode-dev libnode72
sudo apt autoremove -y
sudo apt clean

# Add NodeSource repository for Node.js 24 LTS
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -

# Install
sudo apt update
sudo apt install -y nodejs

# Verify
node --version  # v24.11.0
npm --version   # v10.x
```

**Issue Encountered**: Old Node.js 12 conflicted with new Node.js 24
**Solution**: Completely purge all old Node.js packages before installing new version

### Git Configuration

```bash
# Git was already installed
git config --global user.name "Your Name"
git config --global user.email "christopher@corella.com"
```

---

## Coolify Installation

### Install Coolify

```bash
# Run official installation script
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

**Installation takes**: 5-10 minutes

**What it does**:
- Installs/verifies Docker & Docker Compose
- Creates Coolify configuration
- Sets up Docker networks
- Starts Coolify containers
- Makes Coolify accessible on port 8000

### Access Coolify Dashboard

1. **Find server IP**:
   ```bash
   ip addr show wlp4s0
   # Look for inet 192.168.1.xxx
   ```

2. **Access from laptop's browser**:
   ```
   http://192.168.1.15:8000
   ```

3. **Complete Setup Wizard**:
   - Email: your email
   - Password: strong password (save it!)
   - First user becomes root admin

4. **Server Configuration**:
   - Server name: `veritable-games-server`
   - Accept defaults

---

## GitHub Integration

### Connect GitHub App (Recommended Method)

1. **In Coolify Dashboard**:
   - Go to: Sources → Add New Source
   - Select: GitHub
   - Choose: "Install GitHub App"

2. **GitHub Authorization**:
   - Redirected to GitHub
   - Select repositories to give Coolify access:
     - Option 1: All repositories
     - Option 2: Only `veritable-games-main` (recommended)
   - Authorize the app
   - Redirected back to Coolify

**Result**: GitHub App automatically creates webhooks for auto-deployment

**GitHub App vs Personal Access Token**: GitHub App is easier, more secure, and provides better granular access control.

---

## Application Configuration

### Create New Project

1. **In Coolify**: Projects → Create New Project
2. **Project Name**: `Veritable Games`
3. **Add Resource** → **Application**

### Configure Application - CRITICAL SETTINGS

**Basic Settings**:
- **Name**: `veritable-games`
- **Source**: GitHub (the GitHub App you just connected)
- **Repository**: Select `veritable-games-main`
- **Branch**: `main`

**Build Settings** (THE CRITICAL PART):

⚠️ **CRITICAL: Base Directory MUST be set to `frontend`**

```
Base Directory: frontend
```

**Why this is critical**:
- Veritable Games is a monorepo with the Next.js app in `frontend/` subdirectory
- `package.json`, `next.config.ts`, and all source code are in `frontend/`
- Without this setting, Nixpacks runs `npm install` in root directory (which has no package.json)
- Results in "next: not found" error

**Port**: `3000` (Next.js default)

**Build Pack**: Nixpacks (auto-detect)

### ⚠️ CRITICAL: Create nixpacks.toml Configuration

The application uses `better-sqlite3`, a native Node.js module that requires Python and build tools to compile during `npm install`.

**Create file in frontend directory**:

```bash
# In your local development machine, in project root:
cat > frontend/nixpacks.toml << 'EOF'
[phases.setup]
aptPkgs = ["python3", "build-essential"]
EOF

git add frontend/nixpacks.toml
git commit -m "Add nixpacks.toml for better-sqlite3 build dependencies"
git push origin main
```

**File location**: `veritable-games-main/frontend/nixpacks.toml` (in frontend directory, NOT root)

**What this does**:
- Tells Nixpacks to install Python 3 and build tools via apt-get
- Installs gcc, g++, make, and other compilation tools
- Ensures `better-sqlite3` can compile its native components during build

**Why environment variables didn't work**:
- Tried `NIXPACKS_APT_PKGS=python3 build-essential` (failed - space parsing)
- Tried `NIXPACKS_APT_PKGS=python3,build-essential` (failed - comma not recognized)
- Tried `NIXPACKS_PKGS=python312:gcc` (failed - Nix packages didn't provide correct gcc in PATH)
- Config file is more reliable and version-controlled

---

## Critical Build Issues & Solutions

### Issue 1: "next: not found" Error

**Error Log**:
```
npm i ran in root and only installed 1 package
next: not found
```

**Root Cause**: Base Directory not set, Nixpacks ran commands in root directory

**Solution**: Set Base Directory to `frontend` in Coolify application settings

### Issue 2: Missing Python for better-sqlite3

**Error Log**:
```
npm error gyp ERR! find Python
npm error gyp ERR! find Python You need to install the latest version of Python.
```

**Root Cause**: `better-sqlite3` is a native module requiring Python and build tools

**Attempted Solutions**:
1. ❌ `NIXPACKS_APT_PKGS=python3 build-essential` - space parsing issue
2. ❌ `NIXPACKS_APT_PKGS=python3,build-essential` - comma not recognized
3. ❌ `NIXPACKS_PKGS=python312:gcc` - Nix packages didn't work correctly

**Working Solution**: Created `nixpacks.toml` with:
```toml
[phases.setup]
aptPkgs = ["python3", "build-essential"]
```

**Result**: ✅ Python 3.12.3 and complete build toolchain installed

### Issue 3: Missing GCC Compiler

**Error Log**:
```
npm error make: cc: No such file or directory
```

**Root Cause**: After Python installed, still missing GCC compiler

**Solution**: The `nixpacks.toml` file includes `build-essential` which provides:
- gcc-13
- g++-13
- make
- libc6-dev
- dpkg-dev

**Result**: ✅ Complete toolchain available for native module compilation

### Issue 4: TypeScript Build Error

**Error**:
```
Type error: Import declaration conflicts with local declaration of 'Plyr'.
File: frontend/src/components/references/VideoCardPlyr.tsx:20:8
```

**Code causing error**:
```typescript
import type Plyr from 'plyr';  // Line 20
const Plyr = dynamic(() => import('plyr-react'), {  // Line 23 - conflict!
```

**Root Cause**: Same identifier `Plyr` used for both type import and constant declaration

**Solution**: Renamed type import to avoid collision

```typescript
// Changed to:
import type PlyrType from 'plyr';
const Plyr = dynamic(() => import('plyr-react'), {
```

**Result**: ✅ TypeScript compilation successful

---

## Environment Variables

### Required Environment Variables

Configure in Coolify: Application → Environment Variables

**Build-Time Variables** (optional but recommended):
```bash
# Node version (optional - Nixpacks auto-detects)
NIXPACKS_NODE_VERSION=24
```

**Runtime Variables** (REQUIRED):

```bash
# Authentication (REQUIRED - generate with: openssl rand -hex 32)
SESSION_SECRET=your-64-char-hex-here
CSRF_SECRET=your-64-char-hex-here
ENCRYPTION_KEY=your-64-char-hex-here

# Node Environment
NODE_ENV=production

# Database (for future PostgreSQL setup)
# Currently using SQLite in development mode
# DATABASE_URL=postgresql://user:pass@postgres:5432/veritable_games
```

**Generate secrets**:
```bash
# On your local machine:
openssl rand -hex 32  # SESSION_SECRET
openssl rand -hex 32  # CSRF_SECRET
openssl rand -hex 32  # ENCRYPTION_KEY
```

**Important Notes**:
- Do NOT set NODE_ENV as build-time variable (prevents devDependencies installation)
- Set NODE_ENV only as runtime variable
- Database URL will be needed when PostgreSQL is set up

---

## Deployment Success

### Final Deployment

After all fixes applied:

1. **Pushed changes**:
   - `nixpacks.toml` created and committed
   - `VideoCardPlyr.tsx` TypeScript fix committed
   - Pushed to GitHub main branch

2. **Coolify Auto-Deploy**:
   - Webhook triggered automatically
   - Coolify pulled latest code
   - Build process started

3. **Build Log** (successful):
   ```
   2025-Nov-05 02:49:59... Starting deployment...
   Building application...
   Installing dependencies...
   Building Next.js application...
   Optimizing production build...
   Creating Docker image...
   2025-Nov-05 02:52:01... Rolling update completed.
   Application running on port 3000
   ```

4. **Deployment Time**: ~3 minutes

**Status**: ✅ Application successfully deployed and running

### Accessing the Deployed Application

**Local Network**:
```
http://192.168.1.15:3000
```

**From Development Machine**:
- Access via server IP
- Test all features

---

## Next Steps

### 1. Set Up PostgreSQL Database

Currently using SQLite (development configuration). For production:

**Option A: Coolify Built-in PostgreSQL**:
1. In Coolify: Add Resource → Database → PostgreSQL
2. Version: PostgreSQL 15
3. Database: `veritable_games`
4. Password: Generate secure password
5. Coolify provides connection string
6. Update DATABASE_URL environment variable

**Option B: Use Docker Compose from Repo**:
1. Repository has `docker-compose.yml` with PostgreSQL
2. Enable "Use Docker Compose" in Coolify
3. Coolify uses your compose file automatically

**After PostgreSQL Setup**:
```bash
# Run database migrations
# Access Coolify application terminal:
cd frontend
npm run db:health
# Run migration scripts if needed
```

### 2. Test Deployment Thoroughly

- ✅ Homepage loads
- ✅ User registration/login works
- ✅ Forums functionality
- ✅ Wiki functionality
- ✅ Gallery image uploads
- ✅ Projects section
- ✅ 3D stellar visualization

### 3. Configure Domain (Optional)

**For public access**:

1. **In Coolify**: Application → Domains
2. **Add domain**: `veritablegames.com`, `www.veritablegames.com`
3. **Update DNS** (in Squarespace or domain registrar):
   ```
   A     @     192.168.1.15  (or your public IP)
   A     www   192.168.1.15
   ```

**SSL Certificate**:
- Coolify can auto-generate Let's Encrypt SSL
- Enable "Auto SSL" in domain settings
- Requires port 80 and 443 accessible from internet

**Alternative for home server**:
- Use Cloudflare Tunnel (free, no port forwarding needed)
- Use Tailscale for private network access
- Keep development on local IP for now

### 4. Set Up Backups

**Database Backup** (once PostgreSQL is set up):
```bash
# Create backup script
sudo nano /opt/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/veritablegames"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="veritable_games"

mkdir -p $BACKUP_DIR

docker exec [postgres-container] pg_dump -U postgres $DB_NAME | \
  gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

**Schedule with cron**:
```bash
sudo chmod +x /opt/backup-db.sh
sudo crontab -e
# Add: 0 2 * * * /opt/backup-db.sh
```

### 5. Monitoring

**Check Application**:
- Coolify Dashboard → Application → Logs
- Monitor CPU/RAM usage
- Check disk space: `df -h /var`

**Docker Volume Usage**:
```bash
docker system df
docker volume ls
```

---

## Lessons Learned

### What Worked Well

1. **Mounting `/var` to large drive**: Perfect solution, Docker automatically uses it
2. **GitHub App integration**: Easier than Personal Access Token
3. **nixpacks.toml for build dependencies**: More reliable than environment variables
4. **Auto-deploy via webhook**: Push to GitHub, Coolify deploys automatically

### Critical Issues & Solutions

1. **Monorepo structure**: MUST set Base Directory to `frontend`
2. **Native modules**: Create `nixpacks.toml` with build dependencies
3. **TypeScript naming conflicts**: Be careful with type imports vs constant names
4. **Multi-line commands**: Use single-line for repository setup

### Recommendations

1. **Always set Base Directory** for monorepo projects
2. **Use config files** (nixpacks.toml) over environment variables for complex configuration
3. **Test locally first**: Run `npm run type-check` before pushing
4. **Monitor build logs**: Coolify provides real-time logs, watch them
5. **Keep NODE_ENV=production** only for runtime, not build-time

---

## Architecture Recap

### Storage Layout

```
/var/lib/docker/volumes/                    ← On large extra drive
├── veritable-games-main_postgres_data/     ← PostgreSQL (future)
├── veritable-games-main_uploads/           ← User uploads (future)
├── coolify_data/                           ← Coolify configuration
└── [other volumes]
```

### Container Architecture

```
┌─────────────────────────────────────────┐
│       Coolify (Port 8000)               │
│       Management Interface              │
└─────────────────────────────────────────┘
                │
    ┌───────────┴───────────┐
    ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Veritable Games │    │  PostgreSQL 15   │
│  (Next.js App)   │◄───│  (Future)        │
│   Port 3000      │    │   Port 5432      │
└──────────────────┘    └──────────────────┘
        │                       │
        └───────────┬───────────┘
                    ▼
            Docker Volumes
         (Stored in /var)
```

### Deployment Workflow

```
Development Laptop         GitHub              Server (Coolify)
┌──────────┐              ┌────────┐           ┌─────────────────┐
│          │              │        │           │                 │
│ 1. Write │─── push ────>│  Repo  │─webhook──>│ 2. Auto-deploy  │
│   code   │              │        │           │                 │
│          │              └────────┘           │ 3. Build & run  │
│          │                                   │    (3 minutes)  │
│          │<────── access site ───────────────│ 4. Site live    │
│          │   http://192.168.1.15:3000       │    Port 3000    │
└──────────┘                                   └─────────────────┘
```

---

## Troubleshooting Reference

### Build Fails with "next: not found"

**Symptom**: Build fails, npm only installs 1 package
**Cause**: Base Directory not set
**Fix**: Set Base Directory to `frontend` in Coolify settings

### Build Fails with "gyp ERR! find Python"

**Symptom**: npm fails during better-sqlite3 compilation
**Cause**: Missing Python and build tools
**Fix**: Create `nixpacks.toml` with aptPkgs for python3 and build-essential

### Build Fails with TypeScript Errors

**Symptom**: Build succeeds until TypeScript checking
**Cause**: TypeScript errors in code
**Fix**: Run `npm run type-check` locally, fix errors, push changes

### Can't Access Coolify Dashboard

**Check**:
```bash
# Is Coolify running?
docker ps | grep coolify

# Check firewall
sudo ufw status

# Allow port if needed
sudo ufw allow 8000/tcp
```

### Application Not Accessible

**Check**:
```bash
# Is application container running?
docker ps | grep veritable-games

# Check application logs
# In Coolify: Application → Logs

# Check port
sudo netstat -tulpn | grep 3000
```

---

## Resources

- **Coolify Documentation**: https://coolify.io/docs
- **Nixpacks Documentation**: https://nixpacks.com/docs
- **Project Repository**: Repository includes complete documentation
- **Server IP**: 192.168.1.15
- **Coolify Dashboard**: http://192.168.1.15:8000

---

## Summary

**Deployment Status**: ✅ Successfully deployed
**Deployment Date**: November 5, 2025, 02:52 UTC
**Server**: Ubuntu 22.04 LTS on local hardware
**Method**: Coolify + GitHub App + Nixpacks auto-deploy
**Critical Configurations**:
- Base Directory: `frontend`
- Build Dependencies: nixpacks.toml with python3 and build-essential
- Auto-deploy: Enabled via GitHub App webhook

**Next Critical Step**: Set up PostgreSQL database for production

**This deployment is production-ready** for local/internal use. For public internet access, add PostgreSQL, configure domain/SSL, and set up proper backups.

---

**Document Created**: November 5, 2025
**Status**: Deployment successful, PostgreSQL setup pending
**Confidence Level**: High - this is the actual working deployment
