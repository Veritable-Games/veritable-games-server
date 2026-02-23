📍 **Navigation**: [CLAUDE.md](../../CLAUDE.md) > [docs/](../README.md) > [DEPLOYMENT_DOCUMENTATION_INDEX.md](../DEPLOYMENT_DOCUMENTATION_INDEX.md) > [deployment/](./README.md) > Production Access Guide

---

# Claude Code Production Access Guide

**Last Updated**: November 6, 2025
**Status**: ✅ Production deployment working
**Purpose**: Enable future Claude Code sessions to resume work with full server access

---

## 🎯 Quick Context

You are working on **Veritable Games**, a Next.js 15 community platform deployed via Coolify on a self-hosted Ubuntu server. The production site is **fully operational** with PostgreSQL database, auto-deployment from GitHub, and all user data backed up in git.

### Current Production Setup (November 2025)
```
┌─────────────────────────────────────────────────────────────┐
│ Production Architecture                                      │
└─────────────────────────────────────────────────────────────┘

GitHub Repository
  ↓ (push triggers webhook)
Coolify (192.168.1.15:8000)
  ↓ (builds & deploys)
Docker Container (m4s0kwo4kc4oooocck4sswc4)
  ↓ (connects to)
PostgreSQL Container (veritable-games-postgres)
  - Database: veritable_games
  - 2 users (admin + test user)
  - All data backed up in git: database-backup.sql
```

---

## 🔑 Server Access

### SSH Connection
```bash
# Primary server (local network - same LAN)
ssh user@192.168.1.15

# Remote access via WireGuard VPN (when on public network)
ssh user@10.100.0.1

# SSH Key (already configured)
# Key: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEOsqIQ8wQZmyCbsaMhrkZT5lG1sc1YqJlXtUfqFyLNX
# Fingerprint: SHA256:PjrD+sx7YsrKwMQ2m20nv5ITLqlKcS+fw0exF+t6ch4=
```

### WireGuard VPN Access (Remote Networks)
When NOT on the local network (192.168.1.x), use WireGuard VPN:

| Access Method | IP Address | When to Use |
|---------------|------------|-------------|
| **Local LAN** | 192.168.1.15 | Same network as server |
| **WireGuard VPN** | 10.100.0.1 | Public WiFi, mobile, remote |

**⚠️ CRITICAL**: Never modify WireGuard (wg0) interfaces or 10.100.0.0/24 routes.
See [docs/guides/MACHINE_IDENTIFICATION.md](../guides/MACHINE_IDENTIFICATION.md) for details.

### SSH Setup Script (if access is lost)
If SSH access fails, have the user run this on the server:

```bash
#!/bin/bash
# Run ON THE SERVER (192.168.1.15) to restore Claude Code access

mkdir -p ~/.ssh
chmod 700 ~/.ssh

echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEOsqIQ8wQZmyCbsaMhrkZT5lG1sc1YqJlXtUfqFyLNX claude-code-access" >> ~/.ssh/authorized_keys

chmod 600 ~/.ssh/authorized_keys

echo "✓ Claude Code SSH access restored"
```

### Access Verification
```bash
# Test SSH connection
ssh user@192.168.1.15 "echo '✓ SSH access working'"

# Check services
ssh user@192.168.1.15 "docker ps --format '{{.Names}}\t{{.Status}}'"
```

---

## 🚀 Coolify Configuration

### Access Points
- **Coolify UI**: http://192.168.1.15:8000
- **Local Network Access**: http://192.168.1.15:3000 (direct port, bypasses Traefik)
- **Published Domain**: https://www.veritablegames.com (Cloudflare → Traefik → App)

⚠️ **CRITICAL**: These are TWO DIFFERENT routing paths! See [CLOUDFLARE_DOMAIN_ROUTING_FIX.md](./CLOUDFLARE_DOMAIN_ROUTING_FIX.md) for details.

### Coolify Database
```bash
# Coolify stores configuration in PostgreSQL
Container: coolify-db
Database: coolify
User: coolify

# View environment variables
ssh user@192.168.1.15 \
  "docker exec coolify-db psql -U coolify -d coolify \
   -c 'SELECT key, is_buildtime, is_runtime FROM environment_variables WHERE resourceable_id = 1;'"
```

### GitHub App Integration (Auto-Deploy)

**GitHub App Details:**
- **App ID**: 2235824
- **Client ID**: Iv23liZCkXeiH3ov0OOY
- **Client Secret**: `dff81c56e5db84d96ed23e54ef270d021e38d350`
- **Installation ID**: 93092275
- **Webhook Secret**: `a7f9e2d8c4b1f6a3e9d7c2f8b5a1e6d9c3f7b2a8e4d1f9c6b3a7e2d8f5c1b9a4e7d3f6c2a8b5e1d9f4c7a3b6e8d2f1c5a9b7e4d6f3c1a8b5e2d9f7c44wKCRV9E`

**How it works:**
1. User pushes to `main` branch on GitHub
2. GitHub webhook notifies Coolify
3. Coolify pulls latest code
4. Coolify builds Docker image (using nixpacks)
5. Coolify deploys new container
6. Container connects to existing PostgreSQL database (data preserved)

**Build Configuration:**
- **Base Directory**: `frontend` ⚠️ CRITICAL - must be set in Coolify
- **Build Pack**: nixpacks (handles better-sqlite3 native dependencies)
- **Build Time**: ~3 minutes from push to live

### Application Routing Configuration ⚠️ CRITICAL

**Current Setup**: Direct Port Publishing (Recommended)

The application uses **direct port publishing** instead of domain-based Traefik routing to avoid complex routing issues.

**Coolify Database Settings**:
```bash
# Connect to Coolify database
ssh user@192.168.1.15 "docker exec -i coolify-db psql -U coolify -d coolify"

# View current routing configuration
SELECT uuid, name, fqdn, ports_mappings
FROM applications
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';

# Expected output:
# uuid: m4s0kwo4kc4oooocck4sswc4
# name: veritable-games-site
# fqdn: NULL (no domain routing)
# ports_mappings: 3000:3000 (direct port access)
```

**Why Direct Port Publishing?**
- ✅ Eliminates Traefik routing complexity
- ✅ No "empty args for matcher Host" errors
- ✅ Direct access via IP:port (http://192.168.1.15:3000)
- ✅ More reliable for local network deployments
- ✅ Configuration persists across deployments

**If You Need to Fix Routing** (Bad Gateway Errors):
```sql
-- Run this in Coolify database if you get "bad gateway" errors
UPDATE applications
SET fqdn = NULL,
    ports_mappings = '3000:3000'
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';

-- Then redeploy via Coolify UI
```

**When to Use Domain Routing**:
- Public internet access required
- Multiple applications on one server
- SSL/TLS termination needed
- Custom domain (like veritablegames.com)

For production, the current direct port setup works perfectly for local network access. Domain routing can be added later if needed.

---

## 🗄️ Database Configuration

### PostgreSQL Container
```bash
Container Name: veritable-games-postgres
Image: postgres:15-alpine
Database: veritable_games
User: postgres
Password: postgres
Network: coolify (Docker network)
```

### Connection Strings
```bash
# From Docker container (application)
DATABASE_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games

# From host machine (for admin tasks)
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/veritable_games
```

### Database Access
```bash
# Connect to database
ssh user@192.168.1.15 \
  "docker exec -it veritable-games-postgres psql -U postgres -d veritable_games"

# Check users
ssh user@192.168.1.15 \
  "docker exec veritable-games-postgres psql -U postgres -d veritable_games \
   -c 'SELECT id, username, email FROM auth.users;'"

# Expected output:
# id | username  | email
# ----+-----------+--------------------------
#  1 | admin     | admin@veritablegames.com
# 22 | Test User | test@veritablegames.com
```

### Database Schema
- **10 schemas**: auth, forums, wiki, users, content, library, messaging, system, cache, main
- **155 tables** total
- **273 indexes**
- **2 users** currently in production

---

## 🔐 Critical Secrets

### Production Environment Variables (in Coolify)

⚠️ **These are stored in Coolify's database and injected into containers at runtime**

```bash
# Security Keys
SESSION_SECRET=13d2068c4d165e847c7f97df5fccf8bff3b1df90a6d5100f8f1336c1f839852d
ENCRYPTION_KEY=5f173a2a225d7d87224cdbd5a2b4f8cc28929913cd5b2baaf70b15b1ac155278
CSRF_SECRET=[automatically generated - check Coolify UI]

# Database Connection
DATABASE_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games

# Build Configuration
HUSKY=0
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# Cookie Security (CRITICAL for HTTP deployments - November 2025 fix)
# Must be set to 'false' for HTTP-only deployments
# Remove or set to 'true' when HTTPS/SSL is configured
COOKIE_SECURE_FLAG=false
```

### Viewing Production Environment Variables
```bash
# From running container
ssh user@192.168.1.15 \
  "docker exec m4s0kwo4kc4oooocck4sswc4 printenv | grep -E '(DATABASE_URL|SESSION_SECRET|ENCRYPTION_KEY)'"
```

### Coolify Admin Password
```
Password: Qt2rctLAeGuRlfGFMPHE4FIH
```

---

## 💾 What's in Git vs What's on Server

### ✅ In Git Repository (Backed Up)

```bash
# Code & Configuration
✅ All application code (frontend/src/)
✅ Package.json, dependencies
✅ Documentation (docs/, CLAUDE.md)
✅ nixpacks.toml (build configuration)

# Production Secrets (intentionally tracked - private repo)
✅ frontend/.env.local (all environment variables)
✅ database-backup.sql (complete database with 2 users)
✅ frontend/public/uploads/ (~1.1GB of user content)
   - avatars/
   - concept-art/
   - references/
   - videos/
   - history/
```

**Why secrets are in git:**
- This is a PRIVATE repository
- User explicitly requested all production files in git
- Enables complete recovery on new machine
- .gitignore modified to allow these files

### ❌ NOT in Git (Server Only)

```bash
# Coolify Configuration
❌ Coolify's PostgreSQL database (coolify-db)
❌ Docker volumes and networks
❌ Server logs

# Dynamic Data
❌ Real-time database changes (use database-backup.sql as baseline)
```

---

## 🔄 Common Operations

### Deploy Latest Code
```bash
# Method 1: Push to GitHub (auto-deploys)
git push origin main
# Wait ~3 minutes for Coolify to build and deploy

# Method 2: Manual deploy in Coolify UI
# Open http://192.168.1.15:8000, click "Deploy"
```

### Check Deployment Status
```bash
# View running containers
ssh user@192.168.1.15 "docker ps --format '{{.Names}}\t{{.Status}}\t{{.Image}}'"

# Check application logs
ssh user@192.168.1.15 "docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50"

# Check which commit is deployed
ssh user@192.168.1.15 "docker ps --format '{{.Image}}' | grep m4s0k"
# Image tag shows git commit hash
```

### Restart Application
```bash
# Restart container
ssh user@192.168.1.15 "docker restart m4s0kwo4kc4oooocck4sswc4"

# Or redeploy via Coolify UI
```

### Access Application Shell
```bash
# Access running container
ssh user@192.168.1.15 "docker exec -it m4s0kwo4kc4oooocck4sswc4 /bin/sh"

# Run commands in container
ssh user@192.168.1.15 "docker exec m4s0kwo4kc4oooocck4sswc4 npm run db:health"
```

---

## 💾 Backup & Recovery Procedures

### Regular Backups (Weekly)

**Backup Script** (run from local machine):
```bash
./scripts/backup-server-state.sh
```

This backs up:
1. Coolify environment variables
2. Complete PostgreSQL database
3. Coolify configuration
4. Uploaded files (if in volumes)
5. Restore instructions

**Backup Location**: `~/veritable-games-backups/YYYY-MM-DD_HH-MM-SS/`

### Database Backup (Manual)
```bash
# Export database from server
ssh user@192.168.1.15 \
  "docker exec veritable-games-postgres pg_dump -U postgres veritable_games" \
  > database-backup-$(date +%Y%m%d).sql

# Commit to git
git add database-backup-$(date +%Y%m%d).sql
git commit -m "backup: Database snapshot"
git push origin main
```

### Database Restore (from Git)
```bash
# 1. Copy backup to server
scp database-backup.sql user@192.168.1.15:/tmp/

# 2. Stop application
ssh user@192.168.1.15 "docker stop m4s0kwo4kc4oooocck4sswc4"

# 3. Drop and recreate database
ssh user@192.168.1.15 "
  docker exec veritable-games-postgres psql -U postgres -c 'DROP DATABASE veritable_games;'
  docker exec veritable-games-postgres psql -U postgres -c 'CREATE DATABASE veritable_games;'
"

# 4. Restore from backup
ssh user@192.168.1.15 \
  "docker exec -i veritable-games-postgres psql -U postgres -d veritable_games < /tmp/database-backup.sql"

# 5. Verify users exist
ssh user@192.168.1.15 \
  "docker exec veritable-games-postgres psql -U postgres -d veritable_games \
   -c 'SELECT id, username FROM auth.users;'"

# 6. Restart application
ssh user@192.168.1.15 "docker start m4s0kwo4kc4oooocck4sswc4"
```

### Complete Server Recovery (New Machine)

If the server dies, here's how to rebuild from git:

```bash
# 1. Set up new Ubuntu 22.04 server
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# 2. Create PostgreSQL container
docker run -d \
  --name veritable-games-postgres \
  --network coolify \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=veritable_games \
  postgres:15-alpine

# 3. Clone git repository
git clone https://github.com/Veritable-Games/veritable-games-site.git

# 4. Restore database
cd veritable-games-site
docker exec -i veritable-games-postgres psql -U postgres -d veritable_games < database-backup.sql

# 5. Configure Coolify
# - Create new application
# - Connect to GitHub repository
# - Set Base Directory: frontend
# - Add environment variables from frontend/.env.local
# - Deploy

# 6. Copy uploaded files
scp -r frontend/public/uploads/ user@NEW_SERVER:/path/to/deployment/
```

---

## 🐛 Troubleshooting

### 🔧 Recent Fixes (November 6, 2025)

**Authentication Fix Deployment**

**Issues Resolved:**
1. ✅ Truncated password hashes (24 chars → 60 chars bcrypt)
2. ✅ Cookie secure flag mismatch (HTTP deployment with secure cookies)

**Changes Made:**
- Migration script: `fix-truncated-password-hashes.js` (runs on startup)
- Environment variable: `COOKIE_SECURE_FLAG=false` (added to Coolify)
- Auto-migration enabled in production

**Verification:**
```bash
# Check migration ran successfully
ssh user@192.168.1.15 \
  "docker logs m4s0kwo4kc4oooocck4sswc4 | grep -A 5 'password hash'"

# Expected output:
# ✅ Fixed N password hash(es)
# ✅ All password hashes fixed successfully!

# Verify password hash lengths
ssh user@192.168.1.15 \
  "docker exec veritable-games-postgres psql -U postgres -d veritable_games \
   -c 'SELECT username, LENGTH(password_hash) as hash_length FROM users.users;'"

# Expected: All hashes should be 60 characters
```

---

### Common Issues

#### 1. "Bad Gateway" Error ⚠️ MOST COMMON ISSUE

**Symptoms**: Site returns "bad gateway" or 502 error, even though container is running.

**Root Cause**: Usually Traefik routing misconfiguration (empty `Host()` matcher) or domain-based routing issues.

**Quick Fix - Switch to Direct Port Publishing** (Recommended):

```bash
# 1. Connect to Coolify database
ssh user@192.168.1.15 "docker exec -i coolify-db psql -U coolify -d coolify"

# 2. Clear problematic FQDN and enable direct port access
UPDATE applications
SET fqdn = NULL,
    ports_mappings = '3000:3000'
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';

# 3. Exit database (Ctrl+D)

# 4. Redeploy via Coolify UI
# Go to http://192.168.1.15:8000 → Application → Deploy
```

**Benefits of Direct Port Publishing**:
- ✅ No Traefik routing complexity
- ✅ Direct access via http://192.168.1.15:3000
- ✅ Persists across all future deployments
- ✅ Eliminates routing errors

**If Direct Port Doesn't Work**:

```bash
# Check if container is running
ssh user@192.168.1.15 "docker ps | grep m4s0k"

# Check container logs for crashes
ssh user@192.168.1.15 "docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50"

# Check Traefik proxy logs
ssh user@192.168.1.15 "docker logs coolify-proxy --tail 30 2>&1 | grep -i 'error\|502'"

# Look for: "empty args for matcher Host" error

# Restart container as last resort
ssh user@192.168.1.15 "docker restart m4s0kwo4kc4oooocck4sswc4"
```

**Verification**:
```bash
# Test direct access
curl -I http://192.168.1.15:3000

# Expected: HTTP/1.1 200 OK or 301/302 redirect
```

**Reference**: See [docs/deployment/DEPLOYMENT_FIXES_NOVEMBER_7_2025.md](./DEPLOYMENT_FIXES_NOVEMBER_7_2025.md) Issue #4 for full technical details.

**⚠️ PUBLISHED DOMAIN (www.veritablegames.com) ISSUES ARE DIFFERENT!**

If the user reports "bad gateway" on **https://www.veritablegames.com** (not the local IP), see [CLOUDFLARE_DOMAIN_ROUTING_FIX.md](./CLOUDFLARE_DOMAIN_ROUTING_FIX.md) for Cloudflare → Traefik routing configuration.

#### 2. Login Fails (401 Error)
```bash
# Check if users exist in database
ssh user@192.168.1.15 \
  "docker exec veritable-games-postgres psql -U postgres -d veritable_games \
   -c 'SELECT COUNT(*) FROM auth.users;'"

# If 0 users, restore database from git backup (see above)
```

#### 3. Deployment Stuck
```bash
# Check Coolify logs
ssh user@192.168.1.15 "docker logs coolify --tail 100"

# Check build logs in Coolify UI
# Open http://192.168.1.15:8000 → Deployments → View Logs
```

#### 4. Environment Variables Not Working
```bash
# Verify variables in running container
ssh user@192.168.1.15 \
  "docker exec m4s0kwo4kc4oooocck4sswc4 printenv | grep DATABASE_URL"

# If missing, update in Coolify UI:
# 1. Open Coolify → Application → Environment Variables
# 2. Verify is_buildtime and is_runtime flags
# 3. Redeploy
```

#### 5. Database Connection Fails
```bash
# Check PostgreSQL container
ssh user@192.168.1.15 "docker ps | grep postgres"

# Check network connectivity
ssh user@192.168.1.15 \
  "docker exec m4s0kwo4kc4oooocck4sswc4 nc -zv veritable-games-postgres 5432"

# Check PostgreSQL logs
ssh user@192.168.1.15 "docker logs veritable-games-postgres --tail 50"
```

#### 6. Docker DNS Configuration (Connection Timeouts to 192.168.1.15:5432)

**⚠️ CRITICAL ISSUE**: Application fails to start with `connect ETIMEDOUT 192.168.1.15:5432`

**Root Cause**: `DATABASE_URL` environment variable is misconfigured to use host IP (192.168.1.15) instead of Docker internal DNS name. Containers cannot access host IPs directly.

**Symptoms**:
- Migration fails: `❌ Migration failed: connect ETIMEDOUT 192.168.1.15:5432`
- Application won't start
- Works with Tor/VPN in some cases (depends on network routing)

**Quick Fix**:

```bash
# 1. Connect to Coolify database
ssh user@192.168.1.15 "docker exec -i coolify-db psql -U coolify -d coolify"

# 2. Check current environment variables
SELECT uuid, key
FROM environment_variables
WHERE resourceable_id = 1 AND key IN ('DATABASE_URL', 'POSTGRES_URL');

# 3. Fix: Use correct Docker DNS names
# Delete any misconfigured DATABASE_URL
DELETE FROM environment_variables
WHERE resourceable_id = 1 AND key = 'DATABASE_URL' AND value LIKE '%192.168.1.15%';

# 4. Add DATABASE_URL with correct Docker DNS
INSERT INTO environment_variables (
  uuid, created_at, updated_at, key, value, is_buildtime, is_runtime,
  resourceable_id, resourceable_type
) VALUES (
  'docker-dns-fix-' || gen_random_uuid()::text,
  NOW(),
  NOW(),
  'DATABASE_URL',
  'postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games',
  false,
  true,
  1,
  'App'
);

# 5. Exit psql (Ctrl+D) and restart container
exit
```

```bash
# 6. Restart application container
ssh user@192.168.1.15 "docker stop m4s0kwo4kc4oooocck4sswc4 && sleep 2 && docker start m4s0kwo4kc4oooocck4sswc4"

# 7. Wait 15 seconds and check logs
sleep 15
ssh user@192.168.1.15 "docker logs m4s0kwo4kc4oooocck4sswc4 --tail 30"
```

**Docker DNS Reference**:

```
❌ WRONG (Host IP - not accessible from containers)
DATABASE_URL=postgresql://postgres:postgres@192.168.1.15:5432/veritable_games

✅ CORRECT (Docker internal DNS - accessible from containers)
DATABASE_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games

✅ ALSO CORRECT (Via Docker network, uses service name)
POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
```

**Why This Matters**:
- Containers run on isolated Docker network (`coolify`)
- Cannot access host machine IP (192.168.1.15) from inside container
- Must use Docker DNS name: `veritable-games-postgres` (service name in Docker network)
- Scripts should prefer `POSTGRES_URL` when available

**Prevention**:
- When setting environment variables in Coolify, always use Docker DNS names
- Update migration scripts to prefer `POSTGRES_URL` over `DATABASE_URL`
- See CLAUDE.md for critical Docker DNS rule

---

## 📋 Quick Reference Commands

### Server Health Check
```bash
# One-liner to check everything
ssh user@192.168.1.15 "
  echo '=== Docker Containers ==='
  docker ps --format '{{.Names}}\t{{.Status}}'
  echo ''
  echo '=== Application Status ==='
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:3000
  echo ''
  echo '=== Database Users ==='
  docker exec veritable-games-postgres psql -U postgres -d veritable_games -c 'SELECT COUNT(*) FROM auth.users;'
"
```

### View Latest Deployment
```bash
# Check git commit deployed
ssh user@192.168.1.15 "docker inspect m4s0kwo4kc4oooocck4sswc4 --format '{{.Config.Image}}'"

# Compare with GitHub
git log --oneline -1
```

### Emergency Database Backup
```bash
# Quick backup to local machine
ssh user@192.168.1.15 \
  "docker exec veritable-games-postgres pg_dump -U postgres veritable_games" \
  | gzip > emergency-backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

---

## 🎓 Architecture Decisions (Why Things Are This Way)

### Why Coolify Instead of Vercel?
- **Cost**: Free (self-hosted) vs $20+/month
- **Control**: Full server access, no platform limitations
- **Data Privacy**: Everything on local network
- **Learning**: Deployment experience without vendor lock-in

### Why PostgreSQL Instead of SQLite?
- **Migrated October 2025**: From 10 SQLite databases to single PostgreSQL
- **Reason**: Better concurrency, ACID compliance, production-ready
- **Migration**: 100% complete, 51,833 rows → 2 users (cleaned up test data)

### Why Secrets in Git?
- **Private Repository**: Never going public
- **User Request**: Explicit requirement for complete recovery capability
- **Trade-off**: Convenience > security theater for solo private project
- ⚠️ **Never** commit secrets to public repos

### Why Docker Containers?
- **Isolation**: App and database in separate containers
- **Coolify Standard**: Coolify manages everything via Docker
- **Portability**: Easy to move/backup/restore
- **Network**: Docker network `coolify` for inter-container communication

---

## 🚨 Critical Warnings

### 1. Never Delete Database Container
```bash
# ❌ WRONG - This deletes all data!
docker rm veritable-games-postgres

# ✅ RIGHT - Stop and start preserves data
docker stop veritable-games-postgres
docker start veritable-games-postgres
```

### 2. Always Set Base Directory in Coolify
- **Must be**: `frontend`
- **Not**: `.` (root)
- Coolify needs to know where package.json is

### 3. Don't Remove .env.local from Git
- User explicitly wants it tracked
- Required for complete recovery
- Already in .gitignore comments explaining this

### 4. Database Restore Requires App Shutdown
- Active connections prevent DROP DATABASE
- Always stop app container first

---

## 📚 Additional Resources

### Documentation Locations
```
docs/deployment/
├── COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md  # What actually worked
├── COOLIFY_LOCAL_HOSTING_GUIDE.md               # Setup guide
├── DEPLOYMENT_FAILURE_INVESTIGATION.md          # Past issues
├── DEPLOYMENT_WORKFLOW_AND_RECOVERY.md          # Workflow explanation
└── POSTGRESQL_MIGRATION_COMPLETE.md             # Migration history

CLAUDE.md                                         # Development guide
README.md                                         # Project overview
```

### External Links
- **Coolify Docs**: https://coolify.io/docs
- **PostgreSQL 15 Docs**: https://www.postgresql.org/docs/15/
- **Next.js 15 Docs**: https://nextjs.org/docs
- **Docker Docs**: https://docs.docker.com/

---

## ✅ Success Criteria

**You'll know everything is working when:**
1. ✅ SSH access to 192.168.1.15 works
2. ✅ Coolify UI accessible at http://192.168.1.15:8000
3. ✅ Application running at http://192.168.1.15:3000
4. ✅ Database has 2 users (admin + Test User)
5. ✅ Push to main branch auto-deploys in ~3 minutes
6. ✅ Login works with admin credentials

---

**Last verified working**: November 6, 2025
**Next review**: When issues arise or major changes made

**Remember**: If you're stuck, everything needed for complete recovery is in the git repository. The user can rebuild from scratch using git + the instructions in this document.
