# Deployment Troubleshooting Quick Reference

**Quick fixes for common deployment issues**

---

## 🚨 Site Returns 404 on Domain (But Direct IP Works)

**Symptoms**:
- ❌ https://www.veritablegames.com returns 404
- ✅ http://192.168.1.15:3000 works fine
- Container shows "unhealthy" in `docker ps`

**Quick Diagnosis**:
```bash
# 1. Check container health
ssh user@192.168.1.15 "docker ps | grep m4s0kwo"
# Look for: "Up X minutes (unhealthy)" vs "Up X minutes (healthy)"

# 2. Test health endpoint
ssh user@192.168.1.15 "docker exec m4s0kwo4kc4oooocck4sswc4 curl http://localhost:3000/api/health"
# Expected: {"status":"healthy","database":{"status":"connected"}}

# 3. Check Traefik routing
ssh user@192.168.1.15 "docker logs coolify-proxy --tail 30 | grep -E 'ERR|m4s0kwo'"
# Look for: "empty args for matcher Host" or routing errors
```

**Quick Fix**:
1. **Redeploy via Coolify UI**:
   - Go to http://192.168.1.15:8000
   - Navigate to application
   - Click "Deploy" button
   - Wait 2-5 minutes

2. **OR via Coolify CLI**:
   ```bash
   coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
   ```

3. **Verify fix** (~60 seconds after deployment):
   ```bash
   # Check site
   curl -I https://www.veritablegames.com

   # Check health
   ssh user@192.168.1.15 "docker ps | grep m4s0kwo | grep healthy"
   ```

**Root Cause**: Stale Traefik routing configuration or application crash loop preventing health checks

**Prevention**: Monitor container health status in Coolify dashboard

**Related Incident**: [SITE_404_INCIDENT_NOVEMBER_27_2025.md](./SITE_404_INCIDENT_NOVEMBER_27_2025.md)

---

## 🔴 Site Returns 502 Bad Gateway

**Symptoms**:
- ❌ https://www.veritablegames.com returns "bad gateway"
- Direct IP may or may not work

**Quick Diagnosis**:
```bash
# 1. Check if container is running
ssh user@192.168.1.15 "docker ps | grep m4s0kwo"

# 2. Check container logs for errors
ssh user@192.168.1.15 "docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50"

# 3. Check database connectivity
ssh user@192.168.1.15 "docker logs veritable-games-postgres --tail 20"
```

**Quick Fix**:

**If container is NOT running**:
```bash
# Check recent logs
ssh user@192.168.1.15 "docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100"

# Look for environment variable errors
# Common: "DATABASE_URL or POSTGRES_URL environment variable not set"
```
→ **Fix**: Add missing environment variables via Coolify UI, then redeploy

**If container IS running but crashing**:
```bash
# Check for crash loop
ssh user@192.168.1.15 "docker ps -a | grep m4s0kwo"
# Look for: "Restarting" status
```
→ **Fix**: Check logs for error, fix root cause, redeploy

**Root Cause**:
- Missing environment variables (POSTGRES_URL)
- Database connection issues
- Application crashes during startup

**Prevention**: Verify all environment variables before deployment

**Related Incident**: [PRODUCTION_502_FIX_COMPLETE_NOV10_2025.md](./PRODUCTION_502_FIX_COMPLETE_NOV10_2025.md)

---

## ⚠️ Container Shows "Unhealthy"

**Symptoms**:
- `docker ps` shows "(unhealthy)" status
- Site may return 404 or work intermittently

**Quick Diagnosis**:
```bash
# 1. Check health check status
ssh user@192.168.1.15 "docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{json .State.Health}}' | jq ."

# 2. Test health endpoint manually
ssh user@192.168.1.15 "docker exec m4s0kwo4kc4oooocck4sswc4 curl -v http://localhost:3000/api/health"
```

**Common Causes**:

**A. Health endpoint not responding** (connection refused):
- Application crashed or not listening
- Database connectivity issues
- Application hung/frozen

**Fix**: Restart container or redeploy
```bash
ssh user@192.168.1.15 "docker restart m4s0kwo4kc4oooocck4sswc4"
# Wait 60 seconds, check health again
```

**B. Health endpoint slow to respond** (timeout):
- Database queries taking too long
- Application under heavy load

**Fix**: Check database performance, consider increasing health check timeout

**C. Health endpoint returning error** (500 status):
- Database connection failed
- Application logic error

**Fix**: Check application logs, fix database connection

**Root Cause**: Varies - application crash, database issues, network problems

**Prevention**:
- Monitor health check status
- Add health check logging
- Set up automated alerts

---

## 🔧 Traefik Routing Errors

**Symptoms**:
- Traefik logs show "error while adding rule Host(``)"
- Routing rules malformed
- Domain not routing to container

**Quick Diagnosis**:
```bash
# Check Traefik logs
ssh user@192.168.1.15 "docker logs coolify-proxy --tail 50 | grep -E 'ERR.*m4s0kwo|empty.*Host'"

# Check container routing labels
ssh user@192.168.1.15 "docker inspect m4s0kwo4kc4oooocck4sswc4 | grep -A2 'traefik.http.routers.*rule'"
```

**Expected Output**:
```
traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule: Host(`www.veritablegames.com`) && PathPrefix(`/`)
traefik.http.routers.https-0-m4s0kwo4kc4oooocck4sswc4.rule: Host(`www.veritablegames.com`) && PathPrefix(`/`)
```

**If Malformed** (e.g., `Host(``)`):
1. Check FQDN in Coolify database:
   ```bash
   ssh user@192.168.1.15 "docker exec coolify-db psql -U coolify -d coolify \
     -c \"SELECT uuid, fqdn FROM applications WHERE uuid='m4s0kwo4kc4oooocck4sswc4';\""
   ```

2. If FQDN is NULL or wrong, update it:
   ```bash
   ssh user@192.168.1.15 "docker exec coolify-db psql -U coolify -d coolify \
     -c \"UPDATE applications SET fqdn='www.veritablegames.com' WHERE uuid='m4s0kwo4kc4oooocck4sswc4';\""
   ```

3. Redeploy to regenerate labels

**Root Cause**: NULL FQDN in database, stale routing configuration

**Prevention**: Always set FQDN in Coolify before first deployment

**Related**: [CLOUDFLARE_DOMAIN_ROUTING_FIX.md](./CLOUDFLARE_DOMAIN_ROUTING_FIX.md)

---

## 🗄️ Database Connection Issues

**Symptoms**:
- Application logs show "DATABASE_URL or POSTGRES_URL environment variable not set"
- Application crash-looping
- Health check returns database error

**Quick Diagnosis**:
```bash
# 1. Check environment variables
ssh user@192.168.1.15 "docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep -i postgres"

# 2. Test database connectivity
ssh user@192.168.1.15 "docker exec m4s0kwo4kc4oooocck4sswc4 node -p \"process.env.POSTGRES_URL\""
```

**Expected**:
```
POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
```

**If Missing**:
1. Check Coolify environment variables:
   ```bash
   coolify app env list m4s0kwo4kc4oooocck4sswc4 | grep -i postgres
   ```

2. Add via Coolify UI:
   - Go to http://192.168.1.15:8000
   - Application → Environment
   - Add `POSTGRES_URL` with connection string
   - Check "Is Build Variable" and "Is Runtime"
   - Save and redeploy

**Root Cause**: Missing or deleted environment variables

**Prevention**: Back up environment variables before Coolify upgrades

**Related**: [COOLIFY_ENVIRONMENT_VARIABLES.md](./COOLIFY_ENVIRONMENT_VARIABLES.md)

---

## 📦 Build Failures

**Symptoms**:
- Coolify deployment shows "FAIL"
- Build logs show errors
- Application not starting after deployment

**Quick Diagnosis**:
```bash
# Check recent deployment logs
ssh user@192.168.1.15 "docker logs coolify --tail 100 | grep 'ApplicationDeploymentJob'"
```

**Common Causes**:

**A. TypeScript errors**:
```bash
cd frontend
npm run type-check
```
→ **Fix**: Resolve TypeScript errors, commit, push

**B. Missing dependencies**:
```bash
cd frontend
npm install
```
→ **Fix**: Commit package-lock.json, push

**C. Build timeout** (large build context):
- Check .dockerignore includes `public/uploads/`
- Verify frontend/nixpacks.toml exists

**D. Node version mismatch**:
- Ensure package.json specifies Node version
- Check Coolify uses correct Node version

**Root Cause**: Varies - code errors, dependency issues, configuration

**Prevention**:
- Always run `npm run type-check` before pushing
- Test builds locally
- Monitor deployment logs

---

## 🌐 Cloudflare / DNS Issues

**Symptoms**:
- Domain not resolving
- SSL certificate errors
- Cloudflare showing errors

**Quick Diagnosis**:
```bash
# Check DNS resolution
nslookup www.veritablegames.com

# Check site from external network
curl -I https://www.veritablegames.com
```

**Common Fixes**:

**A. DNS not propagated**: Wait 5-10 minutes

**B. Cloudflare proxy disabled**:
- Check Cloudflare dashboard
- Ensure orange cloud (proxied) is enabled

**C. SSL/TLS mode wrong**:
- Cloudflare → SSL/TLS → Full (recommended)
- Or: Flexible (if Traefik SSL not configured)

**Root Cause**: DNS configuration, Cloudflare settings

**Prevention**: Always verify DNS after changes

---

## 🔍 General Troubleshooting Steps

### 1. Check All Services
```bash
# All containers
ssh user@192.168.1.15 "docker ps -a"

# Coolify services
ssh user@192.168.1.15 "docker ps | grep coolify"

# Application
ssh user@192.168.1.15 "docker ps | grep m4s0kwo"
```

### 2. Check Logs (Last 50 Lines)
```bash
# Application
ssh user@192.168.1.15 "docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50"

# Traefik
ssh user@192.168.1.15 "docker logs coolify-proxy --tail 50"

# PostgreSQL
ssh user@192.168.1.15 "docker logs veritable-games-postgres --tail 50"

# Coolify
ssh user@192.168.1.15 "docker logs coolify --tail 50"
```

### 3. Check Health
```bash
# Container health
ssh user@192.168.1.15 "docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{.State.Health.Status}}'"

# Health endpoint
ssh user@192.168.1.15 "docker exec m4s0kwo4kc4oooocck4sswc4 curl http://localhost:3000/api/health"

# Database health
ssh user@192.168.1.15 "docker exec veritable-games-postgres pg_isready"
```

### 4. Check Network
```bash
# Container network
ssh user@192.168.1.15 "docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'"

# Network connectivity
ssh user@192.168.1.15 "docker exec m4s0kwo4kc4oooocck4sswc4 ping -c 2 veritable-games-postgres"
```

### 5. Verify Environment
```bash
# Environment variables
ssh user@192.168.1.15 "docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep -E 'POSTGRES|DATABASE|NODE_ENV'"
```

---

## 🆘 When to Redeploy

**Redeploy is the solution when**:
- ✅ Container is unhealthy and restart doesn't fix it
- ✅ Traefik routing is malformed
- ✅ Health checks failing after code changes
- ✅ Environment variables updated
- ✅ Docker labels/configuration changed

**Redeploy is NOT needed when**:
- ❌ Just checking logs
- ❌ Testing endpoints
- ❌ Troubleshooting external services (DNS, Cloudflare)
- ❌ Database is down (fix database first)

---

## 📞 Escalation Path

**If quick fixes don't work**:

1. **Check Recent Changes**: Review recent commits, deployments, environment variable changes
2. **Review Incident Reports**: Check docs/deployment/ for similar issues
3. **Full Diagnostic**: Run all commands in "General Troubleshooting Steps"
4. **Backup & Restore**: Consider restoring from backup if critical
5. **Document New Issue**: Create new incident report for future reference

---

## 📚 Related Documentation

- [COOLIFY_CLI_GUIDE.md](./COOLIFY_CLI_GUIDE.md) - CLI commands reference
- [CLOUDFLARE_DOMAIN_ROUTING_FIX.md](./CLOUDFLARE_DOMAIN_ROUTING_FIX.md) - Domain routing details
- [COOLIFY_ENVIRONMENT_VARIABLES.md](./COOLIFY_ENVIRONMENT_VARIABLES.md) - Environment management
- [PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md) - Server access procedures
- [Incident Reports](./SITE_404_INCIDENT_NOVEMBER_27_2025.md) - Past incidents and solutions

---

**Last Updated**: November 27, 2025
**Maintainer**: Development Team
**Status**: Active Reference
