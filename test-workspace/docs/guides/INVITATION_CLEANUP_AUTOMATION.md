# Invitation Cleanup Automation Guide

**Last Updated**: October 29, 2025
**Audience**: System Administrators, DevOps Engineers
**Difficulty**: Beginner to Intermediate

---

## Table of Contents

1. [Overview](#overview)
2. [Manual Cleanup](#manual-cleanup)
3. [Automated Cleanup (Cron/Scheduled Tasks)](#automated-cleanup-cronscheduled-tasks)
4. [Linux/Mac Setup](#linuxmac-setup)
5. [Windows Setup](#windows-setup)
6. [Docker/Container Setup](#dockercontainer-setup)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The invitation cleanup script removes expired invitations from the database to:
- **Improve performance** - Smaller database, faster queries
- **Maintain cleanliness** - Remove stale data
- **Comply with retention policies** - Auto-delete after expiration

**Recommended Frequency**: Daily (2 AM) or Weekly (Sunday 2 AM)

**Script Location**: `frontend/scripts/cleanup-expired-invitations.js`

**NPM Commands**:
```bash
npm run invitations:cleanup              # Clean expired invitations
npm run invitations:cleanup:dry-run      # Preview deletions
npm run invitations:cleanup:verbose      # Detailed output
```

---

## Manual Cleanup

### Test First (Dry Run)

Always test before scheduling:

```bash
cd /path/to/frontend

# Preview what would be deleted
npm run invitations:cleanup:dry-run

# Show detailed information
npm run invitations:cleanup:verbose
```

### Manual Execution

```bash
cd /path/to/frontend
npm run invitations:cleanup
```

**Expected Output**:
```
🧹 Expired Invitations Cleanup

✅ Connected to database: /path/to/data/auth.db

📊 Current Invitation Statistics:
   Total invitations: 42
   Active (unexpired, unused): 12
   Used: 15
   Revoked: 10
   Expired: 5

🔍 Found 5 expired invitations

✅ Successfully deleted 5 expired invitations

📊 Updated Statistics:
   Total invitations: 37 (5 removed)
   Active (unexpired, unused): 12
   Used: 15
   Revoked: 10
   Expired: 0

✅ Database connection closed
```

---

## Automated Cleanup (Cron/Scheduled Tasks)

### Prerequisites

1. **Working Installation**
   ```bash
   # Verify script works manually
   cd /path/to/frontend
   npm run invitations:cleanup:dry-run
   ```

2. **Proper Permissions**
   ```bash
   # Ensure script is executable
   chmod +x scripts/cleanup-expired-invitations.js

   # Ensure user has database write permissions
   ls -la data/auth.db
   ```

3. **Logging Directory** (optional but recommended)
   ```bash
   mkdir -p logs
   chmod 755 logs
   ```

---

## Linux/Mac Setup

### Method 1: Crontab (Recommended)

**Step 1: Edit Crontab**

```bash
crontab -e
```

**Step 2: Add Cleanup Job**

```bash
# Daily at 2 AM (recommended)
0 2 * * * cd /home/user/Projects/web/veritable-games-main/frontend && npm run invitations:cleanup >> logs/cleanup.log 2>&1

# Weekly on Sunday at 2 AM
0 2 * * 0 cd /home/user/Projects/web/veritable-games-main/frontend && npm run invitations:cleanup >> logs/cleanup.log 2>&1

# Twice daily (2 AM and 2 PM)
0 2,14 * * * cd /home/user/Projects/web/veritable-games-main/frontend && npm run invitations:cleanup >> logs/cleanup.log 2>&1
```

**Cron Schedule Format**:
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday=0)
│ │ │ │ │
* * * * * command to execute
```

**Common Schedules**:
- `0 2 * * *` - Daily at 2 AM
- `0 2 * * 0` - Weekly on Sunday at 2 AM
- `0 2 1 * *` - Monthly on 1st at 2 AM
- `*/30 * * * *` - Every 30 minutes
- `0 */6 * * *` - Every 6 hours

**Step 3: Verify Cron Job**

```bash
# List current cron jobs
crontab -l

# Check cron service status
systemctl status cron        # Ubuntu/Debian
systemctl status crond       # CentOS/RHEL
```

**Step 4: Monitor Logs**

```bash
# View cleanup logs
tail -f logs/cleanup.log

# View last 50 lines
tail -n 50 logs/cleanup.log

# View cron system logs
grep CRON /var/log/syslog    # Ubuntu/Debian
grep CRON /var/log/cron      # CentOS/RHEL
```

---

### Method 2: Systemd Timer (Advanced)

**Step 1: Create Service File**

```bash
sudo nano /etc/systemd/system/invitation-cleanup.service
```

```ini
[Unit]
Description=Clean up expired invitation tokens
After=network.target

[Service]
Type=oneshot
User=www-data
WorkingDirectory=/home/user/Projects/web/veritable-games-main/frontend
ExecStart=/usr/bin/npm run invitations:cleanup
StandardOutput=append:/var/log/invitation-cleanup.log
StandardError=append:/var/log/invitation-cleanup.log

[Install]
WantedBy=multi-user.target
```

**Step 2: Create Timer File**

```bash
sudo nano /etc/systemd/system/invitation-cleanup.timer
```

```ini
[Unit]
Description=Run invitation cleanup daily at 2 AM

[Timer]
OnCalendar=daily
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

**Step 3: Enable and Start**

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable timer
sudo systemctl enable invitation-cleanup.timer

# Start timer
sudo systemctl start invitation-cleanup.timer

# Check timer status
sudo systemctl status invitation-cleanup.timer

# List all timers
sudo systemctl list-timers --all
```

**Step 4: Test Service**

```bash
# Run service manually
sudo systemctl start invitation-cleanup.service

# View logs
sudo journalctl -u invitation-cleanup.service -f
```

---

## Windows Setup

### Method 1: Task Scheduler (GUI)

**Step 1: Open Task Scheduler**
- Press `Win + R`
- Type `taskschd.msc`
- Press Enter

**Step 2: Create New Task**
1. Click "Create Basic Task" in right panel
2. Name: "Invitation Cleanup"
3. Description: "Clean up expired invitation tokens daily"
4. Trigger: Daily at 2:00 AM
5. Action: Start a Program

**Step 3: Configure Action**
- Program/script: `npm.cmd`
- Add arguments: `run invitations:cleanup`
- Start in: `C:\path\to\veritable-games-main\frontend`

**Step 4: Advanced Settings**
- Run whether user is logged on or not
- Run with highest privileges
- Configure for: Windows 10/11

---

### Method 2: Task Scheduler (Command Line)

```powershell
# Create scheduled task
schtasks /create /tn "InvitationCleanup" /tr "cmd /c cd C:\path\to\frontend && npm run invitations:cleanup >> logs\cleanup.log 2>&1" /sc daily /st 02:00 /ru SYSTEM

# List tasks
schtasks /query /tn "InvitationCleanup"

# Run task manually
schtasks /run /tn "InvitationCleanup"

# Delete task
schtasks /delete /tn "InvitationCleanup" /f
```

---

### Method 3: PowerShell Script

**Create scheduled-cleanup.ps1**:

```powershell
# Invitation Cleanup Script for Windows
$frontendPath = "C:\path\to\frontend"
$logPath = "$frontendPath\logs\cleanup.log"

# Change to frontend directory
Set-Location $frontendPath

# Run cleanup and log output
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logPath -Value "--- Cleanup started at $timestamp ---"

npm run invitations:cleanup 2>&1 | Tee-Object -FilePath $logPath -Append

Add-Content -Path $logPath -Value "--- Cleanup completed ---`n"
```

**Schedule with Task Scheduler**:
- Program: `powershell.exe`
- Arguments: `-ExecutionPolicy Bypass -File C:\path\to\scheduled-cleanup.ps1`

---

## Docker/Container Setup

### Docker Compose with Cron

**Add to docker-compose.yml**:

```yaml
services:
  app:
    # ... existing app config ...

  cleanup:
    image: node:20-alpine
    volumes:
      - ./frontend:/app
    working_dir: /app
    entrypoint: /bin/sh -c
    command:
      - |
        echo "0 2 * * * cd /app && npm run invitations:cleanup >> /app/logs/cleanup.log 2>&1" | crontab -
        crond -f
    depends_on:
      - app
```

---

### Kubernetes CronJob

**invitation-cleanup-cronjob.yaml**:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: invitation-cleanup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cleanup
            image: node:20-alpine
            command:
            - /bin/sh
            - -c
            - cd /app && npm run invitations:cleanup
            volumeMounts:
            - name: app-data
              mountPath: /app
          restartPolicy: OnFailure
          volumes:
          - name: app-data
            persistentVolumeClaim:
              claimName: app-pvc
```

**Deploy**:
```bash
kubectl apply -f invitation-cleanup-cronjob.yaml

# Verify
kubectl get cronjobs
kubectl get jobs
```

---

## Monitoring & Alerts

### Log Rotation

**Linux (logrotate)**:

Create `/etc/logrotate.d/invitation-cleanup`:

```
/path/to/frontend/logs/cleanup.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
}
```

---

### Email Notifications

**Linux (with cron)**:

```bash
# Add MAILTO to crontab
MAILTO=admin@example.com
0 2 * * * cd /path/to/frontend && npm run invitations:cleanup
```

**Ensure mail is configured**:
```bash
# Test mail
echo "Test email" | mail -s "Cron Test" admin@example.com
```

---

### Health Checks

**Create monitoring script** (`scripts/check-cleanup-health.sh`):

```bash
#!/bin/bash

# Check last cleanup time
LAST_CLEANUP=$(grep "Successfully deleted" logs/cleanup.log | tail -1)

if [ -z "$LAST_CLEANUP" ]; then
    echo "ERROR: No cleanup logs found"
    exit 1
fi

# Check for errors in recent logs
ERRORS=$(grep -c "ERROR\|Failed" logs/cleanup.log | tail -100)

if [ "$ERRORS" -gt 0 ]; then
    echo "WARNING: $ERRORS errors in recent logs"
    exit 1
fi

echo "OK: Cleanup running normally"
exit 0
```

**Add to monitoring system**:
```bash
# Nagios/Icinga check
*/30 * * * * /path/to/scripts/check-cleanup-health.sh
```

---

## Troubleshooting

### Problem: Cron Job Not Running

**Check 1: Verify cron service**
```bash
systemctl status cron
sudo systemctl start cron
```

**Check 2: Verify crontab syntax**
```bash
crontab -l
```

**Check 3: Check system logs**
```bash
grep CRON /var/log/syslog | tail -20
```

**Check 4: Test manually**
```bash
cd /path/to/frontend && npm run invitations:cleanup
```

---

### Problem: Permission Denied

**Fix database permissions**:
```bash
chmod 664 data/auth.db
chown www-data:www-data data/auth.db
```

**Fix script permissions**:
```bash
chmod +x scripts/cleanup-expired-invitations.js
```

---

### Problem: No Logs Generated

**Create log directory**:
```bash
mkdir -p logs
chmod 755 logs
```

**Test logging**:
```bash
npm run invitations:cleanup >> logs/test.log 2>&1
cat logs/test.log
```

---

### Problem: Database Locked

**Cause**: Database in use by another process

**Solution**:
```bash
# Check processes using database
lsof data/auth.db

# Wait for operations to complete
# Or stop competing processes
```

---

## Best Practices

1. **Test First**: Always run with `--dry-run` before scheduling
2. **Log Everything**: Redirect output to log files
3. **Monitor Logs**: Check logs regularly for errors
4. **Rotate Logs**: Implement log rotation to prevent disk fill
5. **Email Alerts**: Configure email notifications for failures
6. **Off-Hours**: Schedule during low-traffic periods (2-4 AM)
7. **Backup First**: Ensure database backups are current
8. **Document**: Record cron schedule in team documentation

---

## Quick Reference

### NPM Commands
```bash
npm run invitations:cleanup              # Run cleanup
npm run invitations:cleanup:dry-run      # Preview
npm run invitations:cleanup:verbose      # Detailed output
```

### Cron Examples
```bash
0 2 * * *    # Daily at 2 AM
0 2 * * 0    # Weekly on Sunday at 2 AM
0 2 1 * *    # Monthly on 1st at 2 AM
```

### Common Paths
```bash
# Script
frontend/scripts/cleanup-expired-invitations.js

# Database
frontend/data/auth.db

# Logs
frontend/logs/cleanup.log
```

---

## Related Documentation

- **Feature Overview**: [docs/features/INVITATION_SYSTEM.md](../features/INVITATION_SYSTEM.md)
- **Admin Guide**: [docs/guides/ADMIN_INVITATION_MANAGEMENT.md](./ADMIN_INVITATION_MANAGEMENT.md)
- **Testing Guide**: [docs/guides/TESTING.md](./TESTING.md)

---

**For questions or issues**: Contact system administrator or review troubleshooting section.
