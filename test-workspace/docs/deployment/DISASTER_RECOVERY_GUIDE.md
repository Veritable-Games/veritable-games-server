# Disaster Recovery Guide
## Veritable Games - Power Outages & Server Migration

**Last Updated:** November 5, 2025
**Critical:** No UPS/battery backup. Must recover from sudden power loss.

---

## 🚨 Emergency Scenarios

### Scenario 1: Power Outage (Desktop Server)
**Cause:** Power loss, no UPS/battery backup
**Impact:** Server shuts down abruptly, containers stop
**Data at Risk:** Database changes since last git commit

### Scenario 2: Server Hardware Failure
**Cause:** Hardware failure, needs replacement
**Impact:** Need to rebuild on new hardware
**Data at Risk:** Anything not in git

### Scenario 3: Server Migration
**Cause:** Moving to new physical location or hardware
**Impact:** Need to set up from scratch
**Data at Risk:** None if properly backed up

---

## 🛡️ Protection Strategy

### Layer 1: Git (Primary Backup) ✅
**What's protected:**
- All code
- All images/videos in `public/uploads/`
- All configuration files
- Database exports (JSON)

**Recovery time:** ~30 minutes to full deployment

### Layer 2: Regular Exports (Secondary Backup) ✅
**What's protected:**
- Database content (wiki, projects, gallery metadata)

**Recovery time:** Additional ~5 minutes to import

### Layer 3: PostgreSQL Dumps (Tertiary Backup)
**What's protected:**
- Complete database state including forums

**Recovery time:** Additional ~10 minutes to restore

---

## 📅 Backup Routine (Critical)

### Daily (Automated)
```bash
# Set up cron job to run daily at 2 AM
# This pulls content from production and commits to git
crontab -e

# Add this line:
0 2 * * * cd /home/user/Projects/veritable-games-main/frontend && ./scripts/sync/pull-production-content.sh && git add -A && git commit -m "Auto backup $(date +\%Y-\%m-\%d)" && git push
```

### Weekly (Manual Check)
```bash
# Manually run and verify
./scripts/sync/pull-production-content.sh
git status  # Check what changed
git diff    # Review changes
git add -A
git commit -m "Weekly backup $(date +%Y-%m-%d)"
git push
```

### Before Power Down (If Planned)
```bash
# Pull everything before shutting down
./scripts/sync/pull-production-content.sh
git add -A && git commit -m "Pre-shutdown backup" && git push
```

---

## 🔧 Recovery Procedures

### Recovery from Power Outage

**Time Required:** 5-15 minutes

```bash
# 1. Power on server
# 2. Check Docker containers
ssh user@192.168.1.15 "docker ps"

# 3. Check application is running
curl http://192.168.1.15:8000

# 4. Check health
ssh user@192.168.1.15 "docker exec [container-name] curl http://localhost:3000/api/health"

# 5. If containers didn't auto-start, restart them
ssh user@192.168.1.15 "
  docker start coolify
  docker start veritable-games-postgres
  # Wait for Coolify to restart app automatically
"

# 6. Verify site is accessible
# Go to: http://192.168.1.15:8000
# Check your application status

# 7. Check for data loss
# - Check recent wiki pages
# - Check recent project updates
# - Verify images are accessible

# 8. If data was lost (changes since last backup):
#    You'll need to recreate those changes manually
#    This is why regular backups to git are critical!
```

---

### Recovery from Complete Server Loss

**Time Required:** 30-60 minutes

#### Step 1: Set Up New Server

```bash
# Install Ubuntu 22.04 LTS on new hardware
# Set up SSH access (copy your public key)
# Install Coolify:
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

#### Step 2: Configure Coolify

```bash
# 1. Access Coolify: http://[new-ip]:8000
# 2. Create new server (localhost)
# 3. Connect to GitHub (install GitHub App)
# 4. Create new application
#    - Source: GitHub repository (veritable-games-main)
#    - Base Directory: frontend
#    - Build Pack: nixpacks
```

#### Step 3: Add Environment Variables

**Option A: Via Coolify UI**
1. Go to application → Environment Variables
2. Add all variables from `/tmp/add-coolify-env.txt`
3. Mark build-time variables appropriately

**Option B: Via saved script**
```bash
# If you saved environment variables to a script
scp /tmp/restore-env-direct.php user@[new-ip]:/tmp/
ssh user@[new-ip] "
  docker cp /tmp/restore-env-direct.php coolify:/tmp/
  docker exec coolify php /tmp/restore-env-direct.php
"
```

#### Step 4: Set Up PostgreSQL Container

```bash
# Copy docker-compose.yml to new server
scp /path/to/docker-compose.yml user@[new-ip]:/home/user/

# Start PostgreSQL
ssh user@[new-ip] "
  cd /home/user
  docker-compose up -d postgres
  docker network connect coolify veritable-games-postgres
"
```

#### Step 5: Deploy Application

```bash
# In Coolify UI:
# 1. Click "Deploy"
# 2. Wait for build to complete (~3 minutes)
# 3. Check deployment logs
```

#### Step 6: Restore Database Content

```bash
# SSH to new server
ssh user@[new-ip]

# Find container name
docker ps | grep veritable

# Enter container
docker exec -it [container-name] sh

# Inside container, run restore script
cd /app
./scripts/import/restore-all.sh

# This will import:
# - Wiki pages from data/exports/wiki-pages.json
# - Projects from data/exports/projects.json
# - Gallery metadata from data/exports/gallery-images.json
```

#### Step 7: Verify Recovery

```bash
# Check health
curl http://[new-ip]:3000/api/health

# Check content
# - Visit wiki pages
# - Check projects
# - Verify gallery images load
# - Test creating new content

# Check database
ssh user@[new-ip] "docker exec veritable-games-postgres psql -U postgres -d veritable_games -c 'SELECT COUNT(*) FROM wiki.wiki_pages;'"
```

---

### Recovery from Partial Data Loss

**Time Required:** 10-20 minutes

If you lose database content but containers are still running:

```bash
# 1. SSH to server
ssh user@192.168.1.15

# 2. Find container name
docker ps | grep veritable

# 3. Enter container
docker exec -it [container-name] sh

# 4. Inside container, restore from git exports
cd /app
node scripts/import/import-wiki-from-json.js data/exports/wiki-pages.json
node scripts/import/import-projects-from-json.js data/exports/projects.json
node scripts/import/import-gallery-from-json.js data/exports/gallery-images.json

# Or use master script:
./scripts/import/restore-all.sh
```

---

## 📊 Data Loss Scenarios

### What You'll NEVER Lose (In Git)
✅ All code
✅ All images in `public/uploads/`
✅ All videos in `public/uploads/`
✅ All avatars in `data/uploads/`
✅ Database exports (as of last commit)

### What You MIGHT Lose (Not Yet in Git)
⚠️ Wiki pages created since last backup
⚠️ Projects updated since last backup
⚠️ Gallery metadata added since last backup
⚠️ Forum posts (if not backed up separately)

### How to Minimize Loss

**Golden Rule:** Commit to git immediately after adding important content

```bash
# After adding content via web UI:
./scripts/sync/pull-production-content.sh
git add -A
git commit -m "Add [description of content]"
git push

# This takes 30 seconds and ensures content is backed up to GitHub
```

---

## 🔄 Server Migration Checklist

### Before Migration

- [ ] Run `./scripts/sync/pull-production-content.sh`
- [ ] Commit all changes to git
- [ ] Push to GitHub
- [ ] Verify GitHub has latest commits
- [ ] Export PostgreSQL database (optional, for forums)
  ```bash
  ssh user@192.168.1.15 "docker exec veritable-games-postgres pg_dump -U postgres veritable_games | gzip > /tmp/backup.sql.gz"
  scp user@192.168.1.15:/tmp/backup.sql.gz ~/backups/
  ```
- [ ] Document current environment variables (already saved)
- [ ] Take screenshots of Coolify configuration

### During Migration

- [ ] Follow "Recovery from Complete Server Loss" steps above
- [ ] Set up new server
- [ ] Install Coolify
- [ ] Connect to GitHub
- [ ] Configure environment variables
- [ ] Deploy application
- [ ] Restore database content

### After Migration

- [ ] Verify all content is accessible
- [ ] Test creating new content
- [ ] Update DNS if IP changed
- [ ] Update local SSH config with new IP
- [ ] Test auto-deployment (make a small commit and push)
- [ ] Set up automated backups (cron job)

---

## 🎯 Best Practices for Power Outage Resilience

### 1. Commit Often

```bash
# After adding significant content
git add public/uploads/
git commit -m "Add screenshots for Project X"
git push

# Do this BEFORE a storm, holiday, or any risky time
```

### 2. Automated Daily Backups

Set up a cron job to auto-commit daily:

```bash
# Edit crontab
crontab -e

# Add this line (runs at 2 AM every day):
0 2 * * * cd /home/user/Projects/veritable-games-main/frontend && ./scripts/sync/pull-production-content.sh && git add -A && git commit -m "Auto backup $(date +\%Y-\%m-\%d)" && git push >> /tmp/auto-backup.log 2>&1
```

### 3. Manual Pre-Shutdown Backups

Before any planned shutdown:

```bash
./scripts/sync/pull-production-content.sh
git add -A
git commit -m "Pre-shutdown backup"
git push
```

### 4. Monitor Weather

Before storms or severe weather:

```bash
# Pull everything
./scripts/sync/pull-production-content.sh
git add -A && git commit -m "Pre-storm backup" && git push

# Consider shutting down server safely before storm hits
ssh user@192.168.1.15 "sudo shutdown -h now"
```

### 5. Keep Git Clean

```bash
# Regularly check git status
git status

# Make sure nothing important is uncommitted
git diff

# Push frequently
git push
```

---

## 🆘 Emergency Contacts

### If Server Won't Boot

**Hardware Issues:**
- Check power connections
- Check monitor/keyboard to see boot messages
- Try different power outlet
- Check for hardware failures (beep codes, LED patterns)

**Software Issues:**
- Boot into recovery mode
- Check disk space: `df -h`
- Check Docker: `sudo systemctl status docker`
- Check logs: `journalctl -xe`

### If Data Is Lost

**Priority 1: Check Git**
```bash
# See all recent commits
git log --oneline -20

# Check what's in your last commit
git show HEAD

# All your content should be there!
```

**Priority 2: Restore from Git**
```bash
# Fresh clone of repo
git clone https://github.com/[your-username]/veritable-games-main.git
cd veritable-games-main/frontend

# All your images, code, and database exports are here
ls -la public/uploads/
ls -la data/exports/
```

**Priority 3: Rebuild Server**
- Follow "Recovery from Complete Server Loss" procedure above
- Takes 30-60 minutes
- Everything will be restored from git

---

## 📞 Quick Reference Commands

### Check Server Status
```bash
# Ping server
ping 192.168.1.15

# Check if Coolify is running
curl http://192.168.1.15:8000

# Check Docker
ssh user@192.168.1.15 "docker ps"

# Check application health
ssh user@192.168.1.15 "docker exec [container] curl http://localhost:3000/api/health"
```

### Pull Latest Content
```bash
./scripts/sync/pull-production-content.sh
git add -A
git commit -m "Backup $(date +%Y-%m-%d)"
git push
```

### Restore Database Content
```bash
# On server, inside container:
./scripts/import/restore-all.sh

# Or individually:
node scripts/import/import-wiki-from-json.js data/exports/wiki-pages.json
node scripts/import/import-projects-from-json.js data/exports/projects.json
node scripts/import/import-gallery-from-json.js data/exports/gallery-images.json
```

### Emergency: Redeploy from Git
```bash
# In Coolify UI: http://192.168.1.15:8000
# Click application → Click "Redeploy"
# Everything will be restored from git
```

---

## 🎓 Remember

1. **Git is your lifeline** - Commit frequently, push often
2. **Server is temporary** - Hardware can fail, power can go out
3. **Automate backups** - Set up cron jobs for daily backups
4. **Test recovery** - Practice recovery procedure before you need it
5. **Document changes** - Keep this guide updated with your setup

**Recovery Time Summary:**
- Power outage recovery: 5-15 minutes
- Complete server rebuild: 30-60 minutes
- Data loss (recent changes): 10-20 minutes to restore exports

**Maximum Data Loss:**
- With daily backups: Max 24 hours of changes
- With frequent commits: Minutes of changes
- Files (images/videos): ZERO loss (always in git)

---

**You're prepared!** With git as your backup and these recovery procedures, you can recover from any disaster in under an hour.
