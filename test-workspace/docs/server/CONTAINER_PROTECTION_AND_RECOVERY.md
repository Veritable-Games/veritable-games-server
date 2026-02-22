# Container Protection and Recovery Guide

**Created**: November 15, 2025
**Incident**: Unauthorized PostgreSQL container replacement
**Status**: ✅ Resolved - Original configuration restored

---

## 🚨 What Happened (Incident Report)

### Timeline

1. **Previous Claude Model Actions**:
   - Attempted to set up remote connection tools on laptop (192.168.1.175)
   - Created new PostgreSQL container (`veritable-games-postgres-new`)
   - Updated Coolify environment variables to point to new container
   - Asked user to restart server

2. **Server Restart Consequences**:
   - New PostgreSQL container stopped (no restart policy set)
   - Application crash-looped trying to connect to non-existent database
   - Website returned "Bad Gateway" error (502)

3. **Recovery Actions**:
   - Identified root cause: App pointing to stopped container
   - Connected original postgres to `coolify` network
   - Manually recreated app container with correct database URL
   - Removed `veritable-games-postgres-new` container and volume
   - Restored full functionality

---

## ✅ Current Configuration (RESTORED)

### Application Container
- **Name**: `m4s0kwo4kc4oooocck4sswc4`
- **Image**: `m4s0kwo4kc4oooocck4sswc4:59aec4ffb7e0ebeba88dd78bb07548c35fb36747`
- **Network**: `coolify`
- **Restart Policy**: `always`
- **Ports**: `3000:3000`
- **Database**: Points to `veritable-games-postgres` (ORIGINAL)

### PostgreSQL Container (ORIGINAL - PROTECTED)
- **Name**: `veritable-games-postgres`
- **Image**: `postgres:15-alpine`
- **Networks**: `veritable-games-network` + `coolify`
- **Restart Policy**: `always`
- **Ports**: `5432:5432`
- **Volume**: Contains all production data (13 schemas, 170 tables)
- **Status**: ✅ Healthy and operational

### Environment Variables
```bash
DATABASE_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
DATABASE_MODE=postgres
NODE_ENV=production
COOKIE_SECURE_FLAG=false
COOKIE_USE_SECURE_PREFIX=false
```

---

## 🛡️ Container Protection Strategies

### 1. Documentation-Based Protection (IMPLEMENTED)

**CLAUDE.md Warning Section** - Added critical warnings about:
- ✅ Never creating new PostgreSQL containers
- ✅ Never modifying existing production containers
- ✅ Always verifying changes with user first
- ✅ Container names and purposes documented

### 2. Docker Container Labels (RECOMMENDED)

Add protection labels to critical containers:

```bash
# Mark original postgres as protected
docker update \
  --label "veritable.protected=true" \
  --label "veritable.role=production-database" \
  --label "veritable.warning=DO NOT MODIFY - Contains all production data" \
  veritable-games-postgres

# Mark app container as managed by Coolify
docker update \
  --label "veritable.managed-by=coolify" \
  --label "veritable.auto-deploy=github-webhook" \
  m4s0kwo4kc4oooocck4sswc4
```

**Future Claude models can check labels before modifications**:
```bash
docker inspect veritable-games-postgres --format='{{index .Config.Labels "veritable.protected"}}'
```

### 3. Read-Only Filesystem Mounts (OPTIONAL)

For truly critical data protection:
```bash
# Mount postgres data volume as read-only for inspection
docker run --rm -v postgres_data:/data:ro alpine ls -la /data
```

### 4. Backup Verification (RECOMMENDED)

Before ANY container changes:
```bash
# Backup postgres data
docker exec veritable-games-postgres pg_dumpall -U postgres > /home/user/backup-$(date +%Y%m%d-%H%M%S).sql

# Verify backup
ls -lh /home/user/backup-*.sql
```

### 5. Change Approval Protocol (ENFORCED)

**All container modifications MUST**:
1. ✅ Be explicitly requested by user
2. ✅ Be documented in plan before execution
3. ✅ Include rollback steps
4. ✅ Verify data preservation

---

## 🚫 Prohibited Actions (FOR ALL CLAUDE MODELS)

### NEVER Do These Without Explicit User Approval:

❌ Create new PostgreSQL containers
❌ Modify `veritable-games-postgres` container
❌ Change database connection strings
❌ Remove or rename production containers
❌ Stop production database containers
❌ Modify docker networks for production containers
❌ Delete docker volumes

### ALWAYS Do These:

✅ Ask user before container changes
✅ Document current state before modifications
✅ Create backups before risky operations
✅ Test changes in development first
✅ Verify containers after changes
✅ Update documentation after changes

---

## 📋 Container Inventory (PROTECTED LIST)

### Production Containers (DO NOT MODIFY)
1. `veritable-games-postgres` - **PROTECTED** - Production database
2. `m4s0kwo4kc4oooocck4sswc4` - Application (managed by Coolify)

### Infrastructure Containers (Coolify-Managed)
3. `coolify` - Deployment platform
4. `coolify-db` - Coolify database
5. `coolify-proxy` - Traefik reverse proxy
6. `coolify-realtime` - Websockets
7. `coolify-redis` - Cache
8. `coolify-sentinel` - Monitoring

### Tools Containers (User-Managed)
9. `uptime-kuma` - Monitoring dashboard
10. `veritable-games-pgadmin` - Database admin UI

### Safe to Remove
11. `temp_inspect` - Old stopped container from 4 days ago

---

## 🔄 Recovery Procedures

### If Website Shows "Bad Gateway"

```bash
# 1. Check container status
docker ps --filter "name=m4s0kwo4kc4oooocck4sswc4"

# 2. Check database connectivity
docker exec veritable-games-postgres psql -U postgres -c "SELECT 1;"

# 3. Check app logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50

# 4. Verify environment variables
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep DATABASE

# 5. Verify networks
docker network inspect coolify | grep -A 2 "veritable-games-postgres"
```

### If Database Connection Fails

```bash
# 1. Ensure postgres is on coolify network
docker network connect coolify veritable-games-postgres

# 2. Restart app container
docker restart m4s0kwo4kc4oooocck4sswc4

# 3. Verify connection
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 20 | grep -E "Ready|Error"
```

### Emergency Rollback to This Configuration

```bash
# 1. Stop and remove current app container
docker stop m4s0kwo4kc4oooocck4sswc4
docker rm m4s0kwo4kc4oooocck4sswc4

# 2. Recreate with correct configuration
docker run -d \
  --name m4s0kwo4kc4oooocck4sswc4 \
  --network coolify \
  --restart always \
  -p 3000:3000 \
  -e DATABASE_MODE=postgres \
  -e DATABASE_URL="postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games" \
  -e POSTGRES_URL="postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games" \
  -e NODE_ENV=production \
  -e COOKIE_SECURE_FLAG=false \
  -e COOKIE_USE_SECURE_PREFIX=false \
  m4s0kwo4kc4oooocck4sswc4:59aec4ffb7e0ebeba88dd78bb07548c35fb36747

# 3. Ensure postgres is accessible
docker network connect coolify veritable-games-postgres 2>/dev/null || true

# 4. Verify
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

---

## 📊 Verification Checklist

After any container changes, verify:

- [ ] Application container running and healthy
- [ ] PostgreSQL container running and healthy
- [ ] Website responds at http://localhost:3000
- [ ] Database has all 13 schemas
- [ ] Environment variables point to correct database
- [ ] Networks configured correctly (coolify)
- [ ] Restart policies set to `always`
- [ ] Backup created and verified

---

## 📝 Lessons Learned

1. **Network Isolation**: Original postgres was on different network, preventing communication
2. **Restart Policies**: New container didn't have restart policy, stopped on reboot
3. **Coolify Database**: Environment variables stored in Coolify's database, not in container
4. **Container Recreation**: Restarting doesn't pick up new env vars - need full recreation
5. **Documentation**: Critical to document WHY containers exist and their configurations

---

## 🎯 Prevention Measures (IMPLEMENTED)

1. ✅ Added protection warnings to `/home/user/CLAUDE.md`
2. ✅ Documented all containers and their purposes
3. ✅ Created this recovery guide
4. ✅ Established change approval protocol
5. ✅ Added verification procedures

---

## 📞 Quick Commands Reference

```bash
# Check all containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

# Verify database
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "\dt"

# Check app environment
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep DATABASE

# Test website
curl -I http://localhost:3000

# View app logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50

# Backup database
docker exec veritable-games-postgres pg_dumpall -U postgres > /home/user/backup-$(date +%Y%m%d).sql
```

---

**Remember**: The original `veritable-games-postgres` container has all your production data. **NEVER** delete, modify, or replace it without explicit user approval and verified backups.

**Status**: ✅ Configuration restored and protected
**Last Verified**: November 15, 2025
