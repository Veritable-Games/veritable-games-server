# Immediate Actions: Coolify Not Loading

**Date**: December 7, 2025
**Goal**: Quick diagnostic to identify why Coolify dashboard is unresponsive

---

## START HERE: 5-Minute Diagnostic

### Step 1: SSH into Server (30 seconds)
```bash
ssh user@192.168.1.15
```

### Step 2: Check if Coolify Container is Running (30 seconds)
```bash
docker ps | grep coolify
```

**Expected Output**:
```
coolify-coolify-1    ...    Up X hours
```

**If NOT in list**:
- Container crashed
- Docker daemon issue
- Go to "Issue: Container Not Running" below

### Step 3: Check Coolify Logs (1 minute)
```bash
docker logs coolify-coolify-1 --tail 50
```

**Look for**:
- 🔴 `ERROR` or `FATAL` messages
- 🔴 Port binding errors (":8000 Address already in use")
- 🔴 Database connection errors
- 🔴 "panic" or "crash" messages

### Step 4: Test Port 8000 (1 minute)
```bash
# From your local machine
curl -v http://192.168.1.15:8000

# If that hangs or times out:
# From the server
ssh user@192.168.1.15 "netstat -tulpn | grep 8000"
# OR
ssh user@192.168.1.15 "ss -tulpn | grep 8000"
```

**Expected**: Port 8000 should be LISTEN

### Step 5: Check System Resources (1 minute)
```bash
# Disk space
ssh user@192.168.1.15 "df -h | grep /var"

# Memory
ssh user@192.168.1.15 "free -h"
```

**Red Flags**:
- 🔴 Disk usage > 90%
- 🔴 Memory usage > 90%
- 🔴 "/var" partition full

---

## Common Issues & Quick Fixes

### Issue: Coolify Container Not Running
```bash
# Check status
docker ps -a | grep coolify

# If shows "Exited"
docker logs coolify-coolify-1 | tail -100

# Restart it
docker restart coolify-coolify-1

# Wait 30-60 seconds
sleep 60

# Check if it's up now
docker ps | grep coolify

# Try accessing dashboard
curl http://192.168.1.15:8000
```

---

### Issue: Port 8000 Address Already in Use
```bash
# Find what's using the port
lsof -i :8000

# Kill the process (if it's not Coolify)
kill -9 <PID>

# OR stop conflicting service
systemctl stop <service-name>

# Restart Coolify
docker restart coolify-coolify-1
```

---

### Issue: Disk Space Full (/var partition)
```bash
# Check usage
df -h /var

# If > 90%: Clean up Docker
docker system prune -a --volumes

# Remove old images
docker image prune -a --filter "until=72h"

# Check space again
df -h /var
```

---

### Issue: Docker Daemon Not Responding
```bash
# Check Docker status
sudo systemctl status docker

# If inactive: Start it
sudo systemctl start docker

# Verify
docker ps

# Enable on boot
sudo systemctl enable docker
```

---

### Issue: Coolify Database Corrupted
```bash
# Backup current data
sudo cp -r /var/lib/docker/volumes/ ~/docker_volumes_backup_$(date +%s)

# Stop and remove Coolify container
docker stop coolify-coolify-1
docker rm coolify-coolify-1

# Redeploy Coolify
# (this requires docker-compose.yml)
docker-compose up -d coolify-coolify-1

# Wait 2-3 minutes
sleep 120

# Check dashboard
curl http://192.168.1.15:8000
```

---

## Success Criteria

✅ Coolify dashboard loads at http://192.168.1.15:8000
✅ Can see applications list
✅ Can click into Veritable Games application
✅ Deployment button is accessible

---

## Next: Deploy Your Code

Once Coolify is responsive:

### Option 1: Via UI (Recommended)
1. Open http://192.168.1.15:8000
2. Click on "Veritable Games" application
3. Click "Deploy" button
4. Wait 2-5 minutes
5. Verify at https://www.veritablegames.com

### Option 2: Via Command Line
```bash
# Find the application UUID (from Coolify UI or check config)
docker exec coolify-coolify-1 coolify app list

# Trigger deployment
docker exec coolify-coolify-1 coolify deploy <uuid>

# Monitor
docker logs <app-container-id> -f
```

---

## If Still Stuck

Check these detailed guides:

1. **COOLIFY_NOT_LOADING_DIAGNOSTIC_DECEMBER_2025.md**
   - Complete diagnostic flowchart
   - All possible error conditions
   - Detailed solutions for each issue

2. **SERVER_WORK_ROUTING_SUMMARY.md**
   - Server architecture overview
   - Common server tasks
   - Related documentation links

3. **TROUBLESHOOTING_QUICKSTART.md**
   - Site 404 errors
   - Site 502 errors
   - Container unhealthy status

4. **CLAUDE_SERVER_ACCESS_ROUTING.md**
   - How to SSH and run remote commands
   - Docker container management
   - Database access patterns

---

## Server Details (For Reference)

```
Server: 192.168.1.15
User: user
Coolify Dashboard: http://192.168.1.15:8000
Application: http://192.168.1.15:3000
Domain: https://www.veritablegames.com
```

---

**Last Updated**: December 7, 2025
**Status**: Awaiting server diagnostic feedback
