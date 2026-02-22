# Coolify Not Loading - Diagnostic & Resolution Guide
**Date**: December 7, 2025
**Issue**: Coolify dashboard (http://192.168.1.15:8000) not loading
**Status**: Investigation in progress

---

## Quick Diagnosis Commands

### Check 1: Is Coolify Container Running?
```bash
# SSH into server and list containers
ssh user@192.168.1.15 "docker ps | grep coolify"

# Expected output should show:
# - coolify-coolify-1 (the main Coolify service)
# - Status: "Up X hours"
```

### Check 2: Check Coolify Logs
```bash
# View recent Coolify logs
ssh user@192.168.1.15 "docker logs coolify-coolify-1 --tail 100"

# Look for errors like:
# - Port binding issues (8000 already in use)
# - Database connection errors
# - Startup failures
```

### Check 3: Is Port 8000 Accessible?
```bash
# From your local machine
ping 192.168.1.15
curl -v http://192.168.1.15:8000

# From the server itself
ssh user@192.168.1.15 "sudo netstat -tulpn | grep 8000"
# OR
ssh user@192.168.1.15 "sudo ss -tulpn | grep 8000"

# Expected: LISTEN on 0.0.0.0:8000 or 127.0.0.1:8000
```

### Check 4: Docker System Health
```bash
# Check Docker daemon status
ssh user@192.168.1.15 "sudo systemctl status docker"

# Check Docker system disk space
ssh user@192.168.1.15 "docker system df"

# Check for out of memory issues
ssh user@192.168.1.15 "free -h"

# Check disk space
ssh user@192.168.1.15 "df -h"
```

### Check 5: Coolify-specific Issues
```bash
# Check if Coolify database exists
ssh user@192.168.1.15 "docker exec coolify-coolify-1 ls -la /data"

# Check Coolify version
ssh user@192.168.1.15 "docker inspect coolify-coolify-1 | grep -i version"

# Check environment variables
ssh user@192.168.1.15 "docker inspect coolify-coolify-1 --format='{{.Config.Env}}' | tr ',' '\n'"
```

---

## Common Issues & Fixes

### Issue 1: Port 8000 Already in Use
**Symptom**: Coolify container exits with "Address already in use"

**Diagnosis**:
```bash
ssh user@192.168.1.15 "sudo netstat -tulpn | grep 8000"
```

**Fix**:
```bash
# Find what's using port 8000
ssh user@192.168.1.15 "sudo lsof -i :8000"

# Kill the process OR
# Change Coolify port in docker-compose.yml:
# ports:
#   - "8001:3000"  (changed from 8000)

# Then restart
docker-compose restart coolify-coolify-1
```

---

### Issue 2: Out of Disk Space
**Symptom**: Coolify crashes or becomes unresponsive
**Likely location**: `/var` partition (Docker volumes, databases)

**Diagnosis**:
```bash
ssh user@192.168.1.15 "df -h /var"

# Check Docker usage
ssh user@192.168.1.15 "docker system df"

# Find large containers/images
ssh user@192.168.1.15 "docker images --format '{{.Size}}\t{{.Repository}}' | sort -rh | head -10"
```

**Fix**:
```bash
# Clean up unused Docker resources
ssh user@192.168.1.15 "docker system prune -a"

# Remove old images
ssh user@192.168.1.15 "docker image prune -a --filter 'until=72h'"
```

---

### Issue 3: Coolify Database Corrupted
**Symptom**: Coolify starts but dashboard is blank or throws errors

**Diagnosis**:
```bash
ssh user@192.168.1.15 "docker logs coolify-coolify-1 | grep -i 'database\|error\|failed'"
```

**Fix**:
```bash
# Backup current Coolify data
ssh user@192.168.1.15 "sudo cp -r /var/lib/docker/volumes/coolify_* ~/coolify_backup_$(date +%s)"

# Restart Coolify
ssh user@192.168.1.15 "docker-compose restart coolify-coolify-1"

# Wait 2-3 minutes, then check
sleep 120
curl http://192.168.1.15:8000
```

---

### Issue 4: Docker Daemon Not Running
**Symptom**: Can't SSH to server and run docker commands

**Diagnosis**:
```bash
ssh user@192.168.1.15 "sudo systemctl status docker"
```

**Fix**:
```bash
# Start Docker
ssh user@192.168.1.15 "sudo systemctl start docker"

# Enable on boot
ssh user@192.168.1.15 "sudo systemctl enable docker"

# Verify
ssh user@192.168.1.15 "docker ps"
```

---

## Deployment Restart Procedure

Once Coolify is responsive again, here's how to redeploy the application:

### Via Coolify UI (Preferred)
1. Open http://192.168.1.15:8000
2. Navigate to Applications → Veritable Games
3. Click "Deploy" button
4. Wait 2-5 minutes for deployment to complete
5. Verify at http://192.168.1.15:3000 and https://www.veritablegames.com

### Via Command Line
```bash
# Find application UUID
ssh user@192.168.1.15 "docker exec coolify-coolify-1 coolify app list"

# Trigger deployment
ssh user@192.168.1.15 "docker exec coolify-coolify-1 coolify deploy <uuid>"

# Monitor progress
ssh user@192.168.1.15 "docker logs <container-id> -f"
```

---

## Server Access Information

**Server Details**:
- **IP Address**: 192.168.1.15
- **Hostname**: veritable-games-server
- **OS**: Ubuntu Server 22.04.5 LTS
- **User**: `user`
- **Coolify Dashboard**: http://192.168.1.15:8000
- **Application**: http://192.168.1.15:3000
- **Domain**: https://www.veritablegames.com

**SSH Access**:
```bash
# Direct SSH
ssh user@192.168.1.15

# Execute commands remotely
ssh user@192.168.1.15 "command here"
```

---

## Related Documentation

- **[COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md)** - Complete deployment guide
- **[TROUBLESHOOTING_QUICKSTART.md](./TROUBLESHOOTING_QUICKSTART.md)** - Common issues and fixes
- **[CLAUDE_SERVER_ACCESS_ROUTING.md](./CLAUDE_SERVER_ACCESS_ROUTING.md)** - How to access and manage the server
- **[SERVER_RECOVERY_GUIDE.md](./SERVER_RECOVERY_GUIDE.md)** - Emergency recovery procedures
- **[SITE_404_INCIDENT_NOVEMBER_27_2025.md](./SITE_404_INCIDENT_NOVEMBER_27_2025.md)** - Recent incident resolution

---

## Next Steps

1. **Run diagnostic commands** above to identify the specific issue
2. **Check logs** to understand root cause
3. **Apply appropriate fix** from the "Common Issues" section
4. **Verify Coolify is accessible** before attempting deployment
5. **Document the issue** for future reference

If Coolify continues to have issues, consider:
- **Checking system resources** (disk space, RAM, CPU)
- **Reviewing recent changes** that might have caused the issue
- **Restarting Docker daemon** completely
- **Consulting Coolify documentation**: https://coolify.io/docs
