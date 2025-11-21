# Troubleshooting Guide

## Container Won't Start

### Symptom
Container crashes immediately after deployment or keeps restarting (crash-loop).

### Diagnosis

```bash
# Check container logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100

# Check container status
docker ps --filter "name=m4s0kwo4kc4oooocck4sswc4"
docker ps -a --filter "name=m4s0kwo4kc4oooocck4sswc4"
```

### Common Causes

1. **Missing DATABASE_URL environment variable**
   ```bash
   # Look for in logs:
   "❌ DATABASE_URL or POSTGRES_URL environment variable not set"
   ```
   **Fix:** Add DATABASE_URL in Coolify environment variables

2. **Database connection refused**
   ```bash
   # Verify PostgreSQL is running
   docker ps | grep postgres
   docker exec veritable-games-postgres psql -U postgres -c "SELECT 1;"
   ```
   **Fix:** Ensure PostgreSQL container is running and accessible

3. **Port conflicts**
   ```bash
   # Check if port 3000 is available
   netstat -tuln | grep 3000
   ```
   **Fix:** Stop conflicting service or change app port

4. **Build failures**
   - Check Coolify build logs in web UI
   - Look for missing dependencies or build errors
   **Fix:** Review package.json, fix dependency issues

## Database Connection Issues

### Verify PostgreSQL Accessibility

```bash
# Test connection
docker exec veritable-games-postgres psql -U postgres -c "SELECT 1;"

# Check if database exists
docker exec veritable-games-postgres psql -U postgres -c "\l" | grep veritable_games

# Verify container network
docker inspect veritable-games-postgres | grep NetworkMode
```

### Check Connection String Format

Correct format:
```
postgresql://username:password@host:port/database
```

For Docker networks:
```
postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
```

### Common Issues

1. **Wrong host name** - Use Docker container name, not localhost
2. **Wrong port** - Default is 5432 for PostgreSQL
3. **Database doesn't exist** - Run migrations to create schema
4. **Network isolation** - Ensure containers are on same Docker network

## Authentication Failures

### Common Issues

1. **Missing SESSION_SECRET or ENCRYPTION_KEY**
   - Check Coolify environment variables
   - Generate new secrets if missing

2. **Incorrect NEXT_PUBLIC_SITE_URL**
   - Cookie domain mismatch
   - Must match production domain exactly

3. **Database schema mismatch**
   - Run migrations to update schema
   - Check for pending migrations

4. **Password hash corruption**
   - See `AUTHENTICATION_FIX_GUIDE.md` (if available)
   - May need to reset user passwords

### Debug Commands

```bash
# Check session table
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM auth.sessions WHERE expires_at > NOW();"

# Verify user exists
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT id, username, email FROM auth.users WHERE username = 'admin';"

# Check for expired sessions
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM auth.sessions WHERE expires_at <= NOW();"
```

## Deployment Issues

### Auto-Deploy Not Triggering

**Option 1: Use Coolify CLI (Preferred)**
```bash
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

**Option 2: Use Web UI**
- Access Coolify: http://192.168.1.15:8000
- Navigate to application
- Click "Deploy" button manually

### Deployment Verification

```bash
# Check deployed commit (wait 2-5 minutes after push)
docker inspect m4s0kwo4kc4oooocck4sswc4 \
  --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT

# Compare with latest commit
cd /home/user/veritable-games-site
git log -1 --oneline

# They should match after deployment completes
```

### Build Takes Too Long

- Typical build time: 2-5 minutes
- If longer than 10 minutes, check Coolify build logs
- May indicate network issues or dependency problems

## Performance Issues

### Slow Database Queries

```bash
# Check database performance
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Check for long-running queries
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT pid, now() - query_start as duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC;"
```

### High Memory Usage

```bash
# Check container memory usage
docker stats m4s0kwo4kc4oooocck4sswc4 --no-stream

# Check PostgreSQL memory
docker stats veritable-games-postgres --no-stream
```

## Log Analysis

### Application Logs

```bash
# Recent logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100

# Follow logs in real-time
docker logs m4s0kwo4kc4oooocck4sswc4 --follow

# Filter for errors
docker logs m4s0kwo4kc4oooocck4sswc4 2>&1 | grep -i error
```

### Database Logs

```bash
# PostgreSQL logs
docker logs veritable-games-postgres --tail 100

# Follow PostgreSQL logs
docker logs veritable-games-postgres --follow
```

## Recovery Procedures

### Container Restart

```bash
# Graceful restart
docker restart m4s0kwo4kc4oooocck4sswc4

# Force restart (if hanging)
docker kill m4s0kwo4kc4oooocck4sswc4
# Wait for Coolify to restart it automatically
```

### Database Recovery

```bash
# Backup before recovery
docker exec veritable-games-postgres pg_dump -U postgres veritable_games > backup.sql

# Restore from backup
docker exec -i veritable-games-postgres psql -U postgres -d veritable_games < backup.sql
```

### Emergency Rollback

```bash
# Revert to previous commit
cd /home/user/veritable-games-site
git log --oneline -5  # Find previous good commit
git revert <commit-hash>
git push origin main

# Or force deploy previous commit
git reset --hard <previous-commit-hash>
git push origin main --force  # Use with caution!

# Trigger deployment
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

## Getting Help

If issues persist:
1. Check Coolify build logs for detailed error messages
2. Review application logs for stack traces
3. Verify all environment variables are set correctly
4. Consult project documentation in `/home/user/docs/`
5. Check git history for recent changes that may have introduced issues
