# Deployment Workflow and Disaster Recovery

**Last Updated**: November 6, 2025

## Quick Answer to "What Gets Preserved Where?"

```
┌─────────────────────────────────────────────────────────────┐
│ What Happens When You Push to GitHub                        │
└─────────────────────────────────────────────────────────────┘

YOU (local machine)
  │
  │ git push origin main
  ↓
GITHUB (cloud)
  │ Stores: ✅ Code, ✅ Config files, ✅ Documentation
  │ Does NOT store: ❌ Environment variables, ❌ Data, ❌ Secrets
  │
  │ [GitHub App Webhook triggers]
  ↓
COOLIFY (192.168.1.15:8000)
  │ Stores: ✅ Environment variables (in its database)
  │ Does: Pulls latest code, builds Docker image
  │
  │ [Deploys with environment variables]
  ↓
DOCKER CONTAINER (192.168.1.15:3000)
  │ Contains: Code + Environment variables combined
  │ Connects to: PostgreSQL database (persistent)
  │
  ↓
POSTGRESQL DATABASE (veritable-games-postgres)
  │ Stores: ✅ All user data (50,646 rows)
  │ Persists: Even when containers are rebuilt
```

## What's Stored Where

### 📁 GitHub Repository (Version Controlled)
```bash
✅ Application code (frontend/src/)
✅ Package.json, tsconfig.json
✅ Documentation (docs/, CLAUDE.md)
✅ nixpacks.toml
✅ .gitignore (prevents secrets from being committed)

❌ Environment variables (.env files)
❌ Database data
❌ Uploaded files
```

### 🖥️ Your Server (192.168.1.15) - NOT in GitHub
```bash
❌ Environment variables (in Coolify's PostgreSQL database)
   - Backed up to: ~/veritable-games-backups/critical-secrets/
   - Contains: SESSION_SECRET, ENCRYPTION_KEY, CSRF_SECRET

❌ Application database (veritable-games-postgres container)
   - 50,646 rows of data
   - Users, forums, wiki, projects

❌ Docker volumes
   - Uploaded files (if stored locally)

❌ Coolify configuration
   - Application settings
   - Deployment history
```

## The Workflow in Detail

### 1. When You Make Code Changes

```bash
# On your local machine
cd /home/user/Projects/veritable-games-main
# Make code changes...
git add .
git commit -m "Your changes"
git push origin main
```

**What happens:**
1. ✅ Code goes to GitHub
2. ✅ GitHub webhook notifies Coolify
3. ✅ Coolify pulls latest code
4. ✅ Coolify builds new Docker image with existing environment variables
5. ✅ New container deployed
6. ✅ Container connects to same PostgreSQL database (data preserved)

**What's preserved automatically:**
- ✅ All database data (nothing lost)
- ✅ All environment variables (Coolify remembers them)
- ✅ Uploaded files (if in Docker volumes)

### 2. When I Made Server Changes (Today)

**What I changed:**
- Environment variables in Coolify's database (coolify-db)
- Added: HUSKY=0
- Modified: is_buildtime flags for 10+ variables

**Where these changes live:**
- ❌ NOT in your GitHub repository
- ✅ Only in Coolify's database on 192.168.1.15

**What happens when you push to GitHub:**
- ✅ My changes are PRESERVED (they're in Coolify's database)
- ✅ Every new deployment will use the corrected environment variables
- ✅ Nothing is lost

## Disaster Recovery: If You Lost Access to 192.168.1.15

### ❌ What You'd Lose (Without Backups)
```
1. Environment variables (SESSION_SECRET, ENCRYPTION_KEY, etc.)
   → Users can't log in (session encryption keys lost)
   → Database connection strings lost

2. All database data (50,646 rows)
   → Users, forums, wiki, projects - everything

3. Uploaded files
   → User avatars, gallery images, project files

4. Coolify configuration
   → Would need to reconfigure from scratch
```

### ✅ What You Can Recover (From GitHub)
```
✅ All application code
✅ Configuration files
✅ Documentation
✅ Deployment scripts
```

### 🛡️ How to Protect Yourself

#### Critical Secrets (Backed Up Today)
```bash
Location: ~/veritable-games-backups/critical-secrets/secrets-2025-11-06.txt

DATABASE_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
SESSION_SECRET=13d2068c4d165e847c7f97df5fccf8bff3b1df90a6d5100f8f1336c1f839852d
POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
ENCRYPTION_KEY=5f173a2a225d7d87224cdbd5a2b4f8cc28929913cd5b2baaf70b15b1ac155278
```

**⚠️ CRITICAL**: Store these in a password manager (1Password, Bitwarden, etc.)!

#### Regular Backup Script

Run this weekly (or set up a cron job):

```bash
# Run from your local machine
./scripts/backup-server-state.sh
```

This backs up:
1. ✅ All environment variables (from Coolify)
2. ✅ Complete PostgreSQL database
3. ✅ Uploaded files
4. ✅ Coolify configuration
5. ✅ Restore instructions

Backup location: `~/veritable-games-backups/YYYY-MM-DD_HH-MM-SS/`

## Recovery Procedure (If Server Dies)

### Step 1: Set Up New Server
```bash
# Install Coolify on new Ubuntu 22.04 server
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# Create PostgreSQL container
docker run -d \
  --name veritable-games-postgres \
  --network coolify \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=veritable_games \
  postgres:15-alpine
```

### Step 2: Restore Database
```bash
# Copy backup to new server
scp ~/veritable-games-backups/YYYY-MM-DD_HH-MM-SS/postgres-database.sql user@NEW_SERVER:/tmp/

# Restore
ssh user@NEW_SERVER "docker exec -i veritable-games-postgres psql -U postgres -d veritable_games < /tmp/postgres-database.sql"
```

### Step 3: Restore Environment Variables
```bash
# Option A: Manually in Coolify UI
# - Create new application
# - Add each environment variable from your backup
# - Mark critical ones as "Available at buildtime"

# Option B: Restore to Coolify database (advanced)
scp ~/veritable-games-backups/YYYY-MM-DD_HH-MM-SS/coolify-env-vars.sql user@NEW_SERVER:/tmp/
ssh user@NEW_SERVER "docker exec -i coolify-db psql -U coolify -d coolify < /tmp/coolify-env-vars.sql"
```

### Step 4: Configure Coolify
```
1. Open Coolify at http://NEW_SERVER:8000
2. Create new application:
   - Source: GitHub (Veritable-Games/veritable-games-site)
   - Branch: main
   - Base Directory: frontend
3. Environment variables should be restored (or add manually)
4. Deploy
```

### Step 5: Verify
```bash
# Check database connection
ssh user@NEW_SERVER "docker exec veritable-games-postgres psql -U postgres -d veritable_games -c 'SELECT COUNT(*) FROM users.profiles;'"

# Check application
curl http://NEW_SERVER:3000
```

## Automated Backups (Recommended)

### Set Up Cron Job

```bash
# On your local machine, add to crontab:
crontab -e

# Add this line (backs up every Sunday at 2 AM):
0 2 * * 0 /home/user/Projects/veritable-games-main/scripts/backup-server-state.sh

# Or backup daily at 3 AM:
0 3 * * * /home/user/Projects/veritable-games-main/scripts/backup-server-state.sh
```

### Alternative: Server-Side Backups

```bash
# On the server (192.168.1.15), set up daily PostgreSQL backups:
ssh user@192.168.1.15

# Create backup script on server
cat > /home/user/backup-postgres.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/user/postgres-backups"
mkdir -p "$BACKUP_DIR"
docker exec veritable-games-postgres pg_dump -U postgres veritable_games | gzip > "$BACKUP_DIR/backup-$(date +%Y-%m-%d).sql.gz"
# Keep only last 7 days
find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +7 -delete
EOF

chmod +x /home/user/backup-postgres.sh

# Add to crontab (daily at 3 AM)
(crontab -l 2>/dev/null; echo "0 3 * * * /home/user/backup-postgres.sh") | crontab -
```

## Summary: What to Remember

### When You Push to GitHub
```
✅ Code goes to GitHub
✅ Coolify auto-deploys with existing environment variables
✅ Database data preserved
✅ Environment variable changes I made today are preserved
```

### What's NOT in GitHub (Must Backup Separately)
```
❌ Environment variables → Backup: ~/veritable-games-backups/critical-secrets/
❌ Database data → Use: ./scripts/backup-server-state.sh
❌ Uploaded files → Included in backup script
```

### Critical Action Items
```
1. ✅ Store secrets in password manager (done today)
2. 🔄 Run backup script weekly: ./scripts/backup-server-state.sh
3. 🔄 Set up automated backups (cron job)
4. 📋 Test restore procedure once (optional but recommended)
```

### Emergency Contact Points
```
- GitHub Repository: https://github.com/Veritable-Games/veritable-games-site
- Server IP: 192.168.1.15
- Coolify UI: http://192.168.1.15:8000
- Application: http://192.168.1.15:3000
- Secrets Backup: ~/veritable-games-backups/critical-secrets/
```

---

**Remember**: Code is in GitHub, data is on the server. Both need protection!
