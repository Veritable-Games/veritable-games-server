# Server Recovery Guide

**Last Updated**: November 4, 2025
**Server**: 192.168.1.15 (veritable-games-server)
**OS**: Ubuntu Server 22.04.5 LTS

---

## Quick Recovery Checklist

### After Server Power Cycle

**Expected Auto-Start** ✅:
1. Docker daemon (systemd service)
2. Coolify containers (restart: always)
3. PostgreSQL container (restart: unless-stopped)
4. pgAdmin container (restart: unless-stopped)
5. Application containers (managed by Coolify)

**Wait Time**: 3-4 minutes for full system boot

**Verification**:
```bash
# On server (if you have physical/SSH access):
docker ps

# From laptop:
ping 192.168.1.15
curl http://192.168.1.15:3000/api/health
curl http://192.168.1.15:8000  # Coolify
```

---

## Power Cycle Scenarios

### Scenario 1: Server Reboot (Planned)

```bash
# On server:
sudo reboot
```

**What Happens**:
1. ✅ Server reboots
2. ✅ Docker daemon starts (systemd)
3. ✅ Coolify starts automatically
4. ✅ PostgreSQL starts automatically
5. ✅ Application starts automatically

**No manual intervention needed** ✅

---

### Scenario 2: Unexpected Power Loss

**What Happens**:
- Same as planned reboot
- All services auto-start
- Data integrity depends on database WAL

**Verification Steps**:
1. Wait 3-4 minutes
2. Check http://192.168.1.15:3000
3. Verify database: `curl http://192.168.1.15:3000/api/health`

---

### Scenario 3: Laptop Reconnection

**After laptop powers back on**:
1. Connect to WiFi (same network)
2. Open browser → http://192.168.1.15:3000
3. Works immediately (server stayed running)

**No action needed** ✅

---

## Services Status Check

### Quick Status Check (from laptop)

```bash
# Check if server is online
ping -c 3 192.168.1.15

# Check application health
curl http://192.168.1.15:3000/api/health

# Expected response:
# {"status":"healthy","timestamp":"...","database":{"status":"connected"}}

# Check Coolify dashboard
curl -I http://192.168.1.15:8000
```

### Detailed Status (on server)

```bash
# Check all containers
docker ps

# Check PostgreSQL specifically
docker ps --filter "name=postgres"

# Check Coolify containers
docker ps --filter "name=coolify"

# Check Docker logs
docker logs veritable-games-postgres --tail 50
```

---

## Manual Recovery Procedures

### If PostgreSQL Didn't Start

```bash
# Check if container exists but stopped
docker ps -a | grep postgres

# Start it manually
docker start veritable-games-postgres

# Check logs for errors
docker logs veritable-games-postgres

# Or use docker-compose
cd /home/user/Projects/veritable-games-main
docker-compose up -d postgres
```

### If Coolify Didn't Start

```bash
# Check Coolify installation directory
cd /data/coolify/source

# Restart Coolify
docker compose restart

# Check Coolify logs
docker compose logs -f
```

### If Application Didn't Start

**In Coolify Dashboard** (http://192.168.1.15:8000):
1. Navigate to your application
2. Check deployment status
3. Click "Redeploy" if needed
4. Monitor logs

---

## Database Recovery

### PostgreSQL Health Check

```bash
# Test connection from host
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT 1;"

# Check database size
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT pg_size_pretty(pg_database_size('veritable_games'));"

# Check table count
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT schemaname, COUNT(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') GROUP BY schemaname;"
```

### PostgreSQL Backup

**Manual Backup**:
```bash
# Create backup
docker exec veritable-games-postgres pg_dump -U postgres veritable_games | gzip > /var/backups/veritable-games-$(date +%Y%m%d_%H%M%S).sql.gz

# Verify backup
gunzip -c /var/backups/veritable-games-*.sql.gz | head -20
```

**Restore from Backup**:
```bash
# Stop application (in Coolify dashboard)

# Drop and recreate database
docker exec veritable-games-postgres psql -U postgres -c "DROP DATABASE IF EXISTS veritable_games;"
docker exec veritable-games-postgres psql -U postgres -c "CREATE DATABASE veritable_games;"

# Restore backup
gunzip -c /var/backups/veritable-games-YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i veritable-games-postgres psql -U postgres -d veritable_games

# Restart application (in Coolify dashboard)
```

---

## Network Issues

### Server IP Changed

If router assigns different IP to server:

1. **Find new IP on server**:
   ```bash
   ip addr show wlp4s0 | grep "inet "
   ```

2. **Update bookmarks/URLs** to new IP

3. **Optional: Set static IP**:
   - Configure in router (DHCP reservation)
   - Or configure on server in netplan

### WiFi Router Reboot

**What Happens**:
- Server and laptop get same IPs back (usually)
- If IPs change, find new server IP

**No data loss** ✅

---

## Automated Services

### What Auto-Starts After Reboot

| Service | Auto-Start | Method |
|---------|-----------|--------|
| Docker Daemon | ✅ Yes | systemd |
| Coolify | ✅ Yes | Docker restart: always |
| PostgreSQL | ✅ Yes | Docker restart: unless-stopped |
| pgAdmin | ✅ Yes | Docker restart: unless-stopped |
| Application | ✅ Yes | Coolify management |

### What Requires Manual Start

| Service | When Needed | How to Start |
|---------|-------------|--------------|
| docker-compose | Only if using standalone | `docker-compose up -d` |
| Application deployment | Only if Coolify fails | Manual deploy in Coolify UI |

---

## Troubleshooting Common Issues

### Issue: "Cannot connect to application"

**Check**:
1. Is server on? `ping 192.168.1.15`
2. Is Docker running? `ssh user@192.168.1.15 'docker ps'` (if SSH worked)
3. Is Coolify running? `curl http://192.168.1.15:8000`

**Fix**:
- If server off: Power on, wait 3-4 minutes
- If Docker stopped: `sudo systemctl start docker`
- If Coolify stopped: See "If Coolify Didn't Start" above

### Issue: "Database connection failed"

**Check**:
```bash
# Is PostgreSQL running?
docker ps | grep postgres

# Can it connect?
docker exec veritable-games-postgres pg_isready -U postgres
```

**Fix**:
```bash
# Start PostgreSQL
docker start veritable-games-postgres

# Or with docker-compose
docker-compose up -d postgres

# Check application health
curl http://192.168.1.15:3000/api/health
```

### Issue: "Application unhealthy in Coolify"

**Check**:
1. Coolify dashboard → Application → Logs
2. Look for error messages
3. Check deployment status

**Common Fixes**:
- Redeploy latest commit
- Check environment variables set correctly
- Verify DATABASE_URL points to correct PostgreSQL
- Check nixpacks.toml exists (required for better-sqlite3)

---

## Monitoring

### Health Check Script

Create `/opt/health-check.sh`:
```bash
#!/bin/bash

# Check application health
HEALTH=$(curl -s http://localhost:3000/api/health)
STATUS=$(echo $HEALTH | jq -r '.status' 2>/dev/null)

if [ "$STATUS" != "healthy" ]; then
  echo "$(date): Application unhealthy: $HEALTH" >> /var/log/app-health.log
  # Optional: Send notification
fi
```

**Schedule with cron**:
```bash
sudo crontab -e
# Add:
*/5 * * * * /opt/health-check.sh
```

---

## Emergency Contacts

**Documentation**:
- Deployment Guide: `docs/deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md`
- Database Guide: `docs/deployment/POSTGRESQL_MIGRATION_COMPLETE.md`
- Manual Steps: `docs/deployment/COOLIFY_MANUAL_STEPS.md`

**Quick Commands Reference**:
```bash
# Server status
ping 192.168.1.15
curl http://192.168.1.15:3000/api/health

# Container status
docker ps

# Restart PostgreSQL
docker restart veritable-games-postgres

# Restart Coolify
cd /data/coolify/source && docker compose restart

# Check logs
docker logs veritable-games-postgres --tail 100
```

---

## Data Backup Location

**Recommended Backup Location**: `/var/backups/veritable-games/`

**What to Backup**:
1. PostgreSQL database (daily)
2. Uploaded files (`/uploads/` in application)
3. Coolify configuration (monthly)

**Retention**: Keep 30 days of daily backups

---

**Status**: All services configured for automatic recovery after power cycle ✅
