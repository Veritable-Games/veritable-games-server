# Coolify Local Hosting Guide
**Veritable Games Platform - Self-Hosted Deployment**
**Last Updated**: November 5, 2025
**Status**: ✅ Successfully deployed and tested

---

## Overview

This guide walks you through deploying Veritable Games Platform on your **local machine** using Coolify, an open-source self-hosted alternative to Vercel/Heroku.

### What You'll Get

- ✅ Full control over hosting environment
- ✅ No monthly fees or bandwidth limits
- ✅ Local PostgreSQL database (no cloud dependency)
- ✅ Automatic deployments from GitHub
- ✅ SSL certificates via Let's Encrypt (for public access)
- ✅ Built-in monitoring and logging

### What You'll Need

- **Hardware**: 2 CPU cores, 4GB RAM minimum (8GB recommended), 50GB free storage
- **OS**: Ubuntu 22.04 LTS or 24.04 LTS (fresh installation recommended)
- **Network**: Static IP or dynamic DNS if you want public access
- **Time**: ~30-60 minutes for initial setup

---

## Architecture: Local Hosting vs Cloud

### Cloud Hosting (Vercel + Neon)
```
User → Internet → Vercel (serverless) → Neon PostgreSQL (cloud)
        ↑                                    ↑
        $0-20/month                          $0-20/month
```

### Local Hosting (Coolify)
```
User → Internet → Your Machine (Coolify) → Local PostgreSQL
        ↑                                    ↑
        Router/DNS                           Same machine
        Your electricity only                No cloud costs
```

---

## Part 1: Install Ubuntu (If Needed)

### Option A: Dedicated Machine

1. **Download Ubuntu Server 24.04 LTS**
   - Visit: https://ubuntu.com/download/server
   - Get: `ubuntu-24.04-live-server-amd64.iso`

2. **Create Bootable USB**
   - Windows: Use Rufus (https://rufus.ie)
   - Mac: Use balenaEtcher (https://etcher.balena.io)
   - Linux: `sudo dd if=ubuntu-24.04.iso of=/dev/sdX bs=4M`

3. **Install Ubuntu**
   - Boot from USB
   - Choose "Ubuntu Server" installation
   - Select "Install OpenSSH server" when prompted
   - Create user account (remember credentials!)

### Option B: Virtual Machine (Testing)

**Using VirtualBox** (free):
```bash
# Install VirtualBox
# Download from: https://www.virtualbox.org

# Create VM:
# - Type: Linux
# - Version: Ubuntu (64-bit)
# - RAM: 4096 MB minimum
# - Disk: 50 GB dynamic VDI
# - Network: Bridged Adapter (for network access)
```

---

## Part 2: Install Coolify

### Step 1: Connect to Your Server

**If using dedicated machine**:
```bash
# From another computer on same network
ssh username@192.168.1.xxx
```

**If using VM locally**:
```bash
# Find VM IP
ip addr show

# SSH from host machine
ssh username@[VM_IP]
```

### Step 2: Update System

```bash
# Update package list
sudo apt update

# Upgrade packages
sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git
```

### Step 3: Install Coolify

```bash
# Run official installation script
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

**What this does**:
- Installs Docker & Docker Compose
- Creates Coolify configuration
- Sets up networking
- Starts Coolify containers
- Generates SSH keys

**Installation takes**: ~5-10 minutes

**Expected output**:
```
✓ Docker installed
✓ Docker Compose installed
✓ Coolify configuration created
✓ SSH keys generated
✓ Coolify started

🎉 Coolify is ready!
Visit: http://YOUR_SERVER_IP:8000
```

### Step 4: Initial Coolify Setup

1. **Access Coolify Dashboard**
   ```
   http://192.168.1.xxx:8000
   ```

2. **Create Admin Account**
   - Email: your-email@example.com
   - Password: Strong password (save this!)
   - **IMPORTANT**: First user becomes root admin

3. **Skip Team/Cloud Setup**
   - Click "Skip" or "Use Self-Hosted"

---

## Part 3: Deploy Veritable Games Platform

### Step 1: Connect GitHub Repository

1. **In Coolify Dashboard**:
   - Go to "Projects" → "Create New Project"
   - Name: `Veritable Games`

2. **Add Git Source**:
   - **Recommended**: Install GitHub App (easier, more secure)
     - Click "Install GitHub App"
     - Select repositories to give Coolify access
     - Authorize and return to Coolify
   - **Alternative**: Use Personal Access Token
     - Create token at https://github.com/settings/tokens
     - Required scopes: `repo`, `workflow`

3. **Create Application**:
   - Select your GitHub source
   - Repository: `veritable-games-main` (or your fork)
   - Branch: `main`

### ⚠️ CRITICAL: Configure Build Settings

**These settings are REQUIRED for Veritable Games to build correctly.**

4. **Essential Build Configuration**:

   **Base Directory**: `frontend` ⚠️ **MUST BE SET**
   - Veritable Games is a monorepo with Next.js app in `frontend/` subdirectory
   - Without this, build will fail with "next: not found" error
   - Set this in: Application → General → Base Directory

   **Port**: `3000` (Next.js default)

   **Build Pack**: Nixpacks (auto-detect)

### ⚠️ CRITICAL: Build Dependencies Configuration

**Note on `better-sqlite3`**: The development environment uses `better-sqlite3` for local testing, but **production deployments use PostgreSQL only**. The `nixpacks.toml` configuration is maintained for development compatibility.

5. **Ensure `nixpacks.toml` is in repository root** (already configured):

   ```toml
   # File: veritable-games-main/nixpacks.toml
   [variables]
   NIXPACKS_NODE_VERSION = "20"

   [phases.setup]
   aptPkgs = ["python3", "build-essential"]
   ```

   **What this does**:
   - Pins Node.js to version 20 (required for better-sqlite3 compatibility)
   - Installs Python 3 and build tools for dev dependencies
   - Production database is PostgreSQL (no SQLite needed at runtime)

   **Status**: ✅ Already committed to repository

   **File location**: Repository root (`veritable-games-main/nixpacks.toml`)

### Step 1a: GitHub Webhook (Automatic)

When you connect GitHub App, Coolify automatically creates a webhook for auto-deployment:
- Push to `main` branch → Coolify rebuilds and redeploys automatically
- Verify webhook: GitHub → Repository → Settings → Webhooks

### Step 2: Set Up Local PostgreSQL Database

**In Coolify Dashboard**:

1. **Create Database**:
   - Go to "Databases" → "New Database"
   - Type: PostgreSQL 15
   - Name: `veritablegames`
   - Username: `veritablegames_user`
   - Password: Generate strong password
   - Port: `5432`

2. **Wait for Database to Start** (~2 minutes)

3. **Get Connection String**:
   ```
   postgresql://veritablegames_user:PASSWORD@localhost:5432/veritablegames
   ```

### Step 3: Configure Environment Variables

**In Coolify Project Settings** → Environment Variables:

```bash
# Database
DATABASE_MODE=postgres
POSTGRES_URL=postgresql://veritablegames_user:PASSWORD@postgres:5432/veritablegames
POSTGRES_PRISMA_URL=postgresql://veritablegames_user:PASSWORD@postgres:5432/veritablegames
POSTGRES_SSL=false  # Local hosting doesn't need SSL

# Security (generate with: openssl rand -hex 32)
SESSION_SECRET=your_64_char_hex_here
CSRF_SECRET=your_64_char_hex_here
ENCRYPTION_KEY=your_64_char_hex_here

# Application
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=http://your-local-ip:3000

# Optimization (local hosting can use higher values)
POSTGRES_POOL_MAX=10
POSTGRES_POOL_MIN=2
POSTGRES_CONNECTION_TIMEOUT=30000
```

**Generate secrets**:
```bash
# Run on your local machine
openssl rand -hex 32  # For SESSION_SECRET
openssl rand -hex 32  # For CSRF_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
```

### Step 4: Deploy

1. **Click "Deploy" in Coolify**
2. **Monitor Build Logs** (~3-5 minutes first time)
3. **Wait for "Deployment Successful"**

### Step 5: Initialize Database Schema

**SSH into Coolify container**:
```bash
# On your server
docker exec -it [coolify-app-container] bash

# Run database health check
cd /app/frontend
npm run db:health
```

Or use the migration script if available:
```bash
node scripts/migrations/migrate-schema.js
```

---

## Part 4: Access Your Site

### Local Network Access

```
http://192.168.1.xxx:3000
```

Replace `192.168.1.xxx` with your server's IP address.

### Public Internet Access (Optional)

#### Option 1: Port Forwarding (Simple)

1. **Find your public IP**: https://whatismyipaddress.com
2. **Configure Router**:
   - Forward port `80` → `3000` (HTTP)
   - Forward port `443` → `3000` (HTTPS, if using SSL)
3. **Access**: `http://YOUR_PUBLIC_IP`

**Downsides**:
- Public IP may change (need dynamic DNS)
- Security concerns (exposed to internet)

#### Option 2: Cloudflare Tunnel (Recommended)

**Free, secure, no port forwarding needed!**

```bash
# Install Cloudflare Tunnel
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create veritable-games

# Route traffic
cloudflared tunnel route dns veritable-games yourdomain.com

# Run tunnel
cloudflared tunnel run veritable-games
```

**Result**: Access via `https://yourdomain.com` - no IP address needed!

#### Option 3: Tailscale (Private Network)

Access your site from anywhere without exposing to public internet.

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Connect
sudo tailscale up

# Access from any device on Tailscale network
http://tailscale-machine-name:3000
```

---

## Database Options: Local vs Cloud PostgreSQL

### Short Answer: **Local PostgreSQL** is recommended for Coolify self-hosted deployments.

### Comparison

| Feature | Cloud PostgreSQL | Local PostgreSQL |
|---------|------------------|------------------|
| **Cost** | $0-20/month (varies by provider) | Electricity only |
| **Storage** | Limited by plan | Limited by your disk |
| **Speed** | Network latency | Instant (same machine) |
| **Backups** | Automatic | You manage |
| **Availability** | 24/7 cloud | Depends on your uptime |
| **Maintenance** | Managed | You manage |
| **Scalability** | Auto-scales | Manual |

### When to Use Each

**Use Local PostgreSQL** (with Coolify):
- ✅ Learning/development
- ✅ Private/internal site
- ✅ Low traffic personal project
- ✅ Want full control
- ✅ Minimize costs

**Use Cloud PostgreSQL**:
- ✅ High availability required
- ✅ Don't want to manage backups
- ✅ Global audience (CDN)
- ✅ Auto-scaling needs
- ✅ Can't maintain local server 24/7

### Hybrid Approach

You can use **both**:
1. **Local PostgreSQL** for development/testing
2. **Cloud PostgreSQL** for production backup
3. **Periodic sync** between them

---

## Maintenance & Monitoring

### Backup Database (CRITICAL!)

**Automated daily backup**:
```bash
# Create backup script
sudo nano /opt/backup-db.sh
```

```bash
#!/bin/bash
# Backup Veritable Games database

BACKUP_DIR="/opt/backups/veritablegames"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="veritablegames"

mkdir -p $BACKUP_DIR

# Backup database
docker exec [postgres-container] pg_dump -U veritablegames_user $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

**Make executable & schedule**:
```bash
sudo chmod +x /opt/backup-db.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add line:
0 2 * * * /opt/backup-db.sh
```

### Monitor Resources

**Install monitoring**:
```bash
# htop for CPU/RAM
sudo apt install htop

# ncdu for disk usage
sudo apt install ncdu

# Check resources
htop
ncdu /
```

**Coolify Dashboard** also shows:
- Container status
- Resource usage
- Deployment logs
- Error logs

### Update Coolify

```bash
# Coolify updates itself automatically
# Or manually:
docker exec -it coolify-coolify-1 php artisan update
```

---

## Troubleshooting

### Coolify Won't Start

```bash
# Check Docker
sudo systemctl status docker

# Restart Coolify
docker compose -f /data/coolify/source/docker-compose.yml restart
```

### Database Connection Failed

```bash
# Check PostgreSQL container
docker ps | grep postgres

# View logs
docker logs [postgres-container-name]

# Test connection
docker exec -it [postgres-container] psql -U veritablegames_user -d veritablegames
```

### Build Fails

**Check build logs in Coolify Dashboard**

#### Build Fails with "next: not found"

**Symptom**: Build fails, npm only installs 1 package in root directory
**Cause**: Base Directory not set to `frontend`
**Fix**:
```
1. Go to Application → General → Base Directory
2. Set to: frontend
3. Redeploy
```

#### Build Fails with "gyp ERR! find Python"

**Symptom**: npm fails during better-sqlite3 compilation
```
npm error gyp ERR! find Python
npm error gyp ERR! find Python You need to install the latest version of Python.
```

**Cause**: Missing Python and build tools for native module compilation
**Fix**:
```bash
# Create nixpacks.toml in repository root
cat > nixpacks.toml << 'EOF'
[phases.setup]
aptPkgs = ["python3", "build-essential"]
EOF

git add nixpacks.toml
git commit -m "Add build dependencies for better-sqlite3"
git push origin main
```

#### Build Fails with "make: cc: No such file or directory"

**Symptom**: Build fails after Python is installed
**Cause**: Missing GCC compiler
**Fix**: Same as above - `build-essential` package provides gcc, g++, make

#### Build Fails with TypeScript Errors

**Symptom**: Build succeeds until TypeScript checking, then fails
**Cause**: TypeScript errors in code
**Fix**:
```bash
# Test locally first
cd frontend
npm run type-check

# Fix any errors shown, then push
```

Common issues:
- Missing environment variables
- TypeScript errors (run `npm run type-check` locally first)
- Out of memory (increase RAM)

### Port Already in Use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill process if needed
sudo kill [PID]
```

### Site Not Accessible

```bash
# Check firewall
sudo ufw status

# Allow ports if needed
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp  # Coolify dashboard
```

---

## Cost Analysis

### Local Hosting (Coolify)

**One-time costs**:
- Old computer/server: $0-300 (reuse existing)
- Or Raspberry Pi 4 8GB: $75

**Monthly costs**:
- Electricity: ~$5-15/month (depends on power usage)
- Internet: $0 (use existing connection)
- Domain (optional): $12/year

**Total first year**: ~$100-300 + $60-180 = **$160-480**

### Cloud Hosting (Vercel + Neon)

**Monthly costs**:
- Vercel free tier: $0 (up to 100GB bandwidth)
- Neon free tier: $0 (0.5GB storage)
- **If you exceed free tier**: $20-60/month

**Total first year**: $0-720

### Break-even Point

If you exceed free tiers consistently, local hosting pays for itself in 3-12 months.

---

## Next Steps

1. **Test Deployment**:
   - Visit `http://your-server-ip:3000`
   - Create test user
   - Post in forums
   - Upload test image

2. **Set Up Monitoring**:
   - Install uptime monitoring (UptimeRobot free tier)
   - Configure email alerts
   - Set up backup verification

3. **Secure Your Server**:
   - Enable UFW firewall
   - Disable root SSH login
   - Set up fail2ban
   - Keep system updated

4. **Plan for Growth**:
   - Monitor resource usage
   - Plan storage expansion
   - Consider CDN for static assets
   - Implement caching (Redis)

---

## Resources

- **Coolify Docs**: https://coolify.io/docs
- **Coolify Discord**: https://discord.gg/coolify
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Next.js Deployment**: https://nextjs.org/docs/deployment

---

**Need help?** Check `docs/TROUBLESHOOTING.md` or ask in project discussions.
