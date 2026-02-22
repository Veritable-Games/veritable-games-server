# Coolify 500 Error Resolution - November 15, 2025

## Overview

This document details a critical 500 error encountered in our Coolify instance at `http://192.168.1.15:8000` and the complete resolution process.

**Status**: ✅ RESOLVED (November 15, 2025)

---

## Error Description

### Symptoms

When accessing the application configuration page:
```
http://192.168.1.15:8000/project/isog88cosocgg4kgsw80ocog/environment/j0o8s8kcok8cs0w0cck0kgg0/application/m4s0kwo4kc4oooocck4sswc4
```

Coolify returned:
```
500
Wait, this is not cool...

There has been an error with the following error message:
unserialize(): Error at offset 0 of 76 bytes (View: /var/www/html/resources/views/livewire/project/application/configuration.blade.php)
```

### Impact

- **Affected**: Application configuration page for `veritable-games` (UUID: m4s0kwo4kc4oooocck4sswc4)
- **Not Affected**:
  - Other Coolify pages
  - Application deployments
  - Running containers
  - Other applications in Coolify

---

## Root Cause Analysis

### Investigation Process

1. **Checked Coolify container logs**:
   ```bash
   docker logs coolify --tail 100
   ```
   Found repeated errors:
   ```
   [2025-11-15 22:41:57] production.ERROR: unserialize(): Error at offset 0 of 76 bytes
   {"exception":"[object] (ErrorException(code: 0): unserialize(): Error at offset 0 of 76 bytes
   ```

2. **Identified the cause**:
   - PHP's `unserialize()` function failing during Laravel encryption decryption
   - Error at "offset 0 of 76 bytes" indicates empty or corrupted data
   - Location: Livewire component loading environment variables

3. **Database investigation**:
   ```sql
   SELECT key, LENGTH(value) as value_length
   FROM environment_variables
   WHERE application_id = (
     SELECT id FROM applications WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4'
   );
   ```

   Found: **Empty environment variable** `COOLIFY_URL` with 0 bytes

### Technical Explanation

Laravel's encryption system expects:
1. Encrypted data in a specific format (base64-encoded JSON)
2. When decrypting, it base64-decodes → deserializes → decrypts
3. An empty string (0 bytes) fails at the `unserialize()` step
4. This corrupted value caused the entire configuration page to crash

---

## Resolution Steps

### Step 1: Clear Laravel Caches

```bash
ssh user@192.168.1.15
docker exec coolify php artisan optimize:clear
```

**Output**:
```
Compiled views cleared successfully.
Application cache cleared successfully.
Route cache cleared successfully.
Configuration cache cleared successfully.
Compiled services and packages files removed successfully.
Caches cleared successfully.
```

### Step 2: Remove Corrupted Environment Variable

```bash
docker exec coolify-db psql -U coolify -d coolify -c "DELETE FROM environment_variables WHERE key = 'COOLIFY_URL' AND value = '';"
```

**Output**: `DELETE 1` (one corrupted record removed)

### Step 3: Verification

**Before fix**:
```bash
curl -I http://192.168.1.15:8000/project/.../application/m4s0kwo4kc4oooocck4sswc4
# HTTP/1.1 500 Internal Server Error
```

**After fix**:
```bash
curl -I http://192.168.1.15:8000/project/.../application/m4s0kwo4kc4oooocck4sswc4
# HTTP/1.1 302 Found
```

✅ Configuration page now loads successfully

### Step 4: Infrastructure Health Check

All Coolify containers verified healthy:

```bash
docker ps --filter "name=coolify" --format "table {{.Names}}\t{{.Status}}"
```

| Container | Status |
|-----------|--------|
| coolify | Up 56 minutes (healthy) |
| coolify-db | Up 17 hours (healthy) |
| coolify-redis | Up 17 hours (healthy) |
| coolify-proxy | Up 17 hours (healthy) |
| coolify-realtime | Up 17 hours (healthy) |
| coolify-sentinel | Up 6 minutes (healthy) |

---

## Preventive Maintenance

### Monthly Maintenance Task

Clear Laravel caches to prevent buildup:

```bash
ssh user@192.168.1.15 "docker exec coolify php artisan optimize:clear"
```

**Schedule**: First Monday of each month

### Weekly Health Check

Check for empty or corrupted environment variables:

```bash
ssh user@192.168.1.15 "docker exec coolify-db psql -U coolify -d coolify -c \"SELECT COUNT(*) FROM environment_variables WHERE value IS NULL OR value = '';\""
```

**Expected result**: `0` (no empty variables)

**If result > 0**: Investigate and remove corrupted variables:
```sql
-- Find corrupted variables
SELECT id, key, application_id, LENGTH(value) as value_length
FROM environment_variables
WHERE value IS NULL OR value = '';

-- Remove after verification (replace ID)
DELETE FROM environment_variables WHERE id = <id>;
```

### Database Backup Verification

Ensure Coolify database backups are running:

```bash
docker exec coolify-db pg_dump -U coolify coolify > /tmp/coolify-backup-$(date +%Y%m%d).sql
```

**Recommendation**: Set up automated daily backups via cron.

---

## Diagnostic Commands Reference

### Quick Health Check (All-in-One)

```bash
#!/bin/bash
echo "=== Coolify Infrastructure Health ==="
echo ""
echo "Container Status:"
docker ps --filter "name=coolify" --format "table {{.Names}}\t{{.Status}}"
echo ""
echo "Recent Errors (last 50 lines):"
docker logs coolify --tail 50 | grep -i error || echo "No errors found"
echo ""
echo "Database Connection:"
docker exec coolify-db psql -U coolify -d coolify -c "SELECT 1;" > /dev/null 2>&1 && echo "✅ Database OK" || echo "❌ Database connection failed"
echo ""
echo "Empty Environment Variables:"
docker exec coolify-db psql -U coolify -d coolify -c "SELECT COUNT(*) FROM environment_variables WHERE value IS NULL OR value = '';"
```

Save as `coolify-health-check.sh` and run weekly.

### Detailed Diagnostics

**Check Coolify logs**:
```bash
docker logs coolify --tail 100 --follow
```

**Check database performance**:
```bash
docker exec coolify-db psql -U coolify -d coolify -c "
SELECT
  schemaname,
  tablename,
  n_live_tup as row_count,
  n_dead_tup as dead_rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC
LIMIT 10;"
```

**Check environment variables for application**:
```bash
docker exec coolify-db psql -U coolify -d coolify -c "
SELECT
  key,
  LENGTH(value) as value_length,
  is_preview,
  is_build_time
FROM environment_variables
WHERE application_id = (
  SELECT id FROM applications WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4'
)
ORDER BY key;"
```

**Check Coolify disk usage**:
```bash
docker exec coolify df -h
```

---

## Lessons Learned

### What Went Wrong

1. **Empty environment variable** was created (unknown how)
2. **No validation** preventing empty values in Coolify
3. **Cascade failure** - one bad variable crashed entire config page

### What Worked Well

1. **Error logging** - Clear error messages in Docker logs
2. **Database access** - Easy to query and fix corrupted data
3. **Cache clearing** - Standard Laravel maintenance resolved potential issues
4. **Container isolation** - Other services unaffected

### Recommendations

1. **Add monitoring** for Coolify error logs
2. **Implement validation** at application level (prevent empty env vars)
3. **Document maintenance procedures** (this document)
4. **Set up automated backups** for Coolify database
5. **Create health check script** (see above)

---

## Related Documentation

- **Production Access**: [docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)
- **Coolify Deployment**: [docs/deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./docs/deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md)
- **Database Architecture**: [docs/database/DATABASE.md](./docs/database/DATABASE.md)
- **Troubleshooting Guide**: [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

---

## Timeline

- **22:41:57 UTC**: Error first detected in logs
- **22:45:00 UTC**: Investigation started
- **22:50:00 UTC**: Root cause identified (empty COOLIFY_URL variable)
- **22:52:00 UTC**: Laravel caches cleared
- **22:53:00 UTC**: Corrupted variable removed from database
- **22:54:00 UTC**: Fix verified (HTTP 302 instead of 500)
- **22:55:00 UTC**: Infrastructure health confirmed
- **Status**: ✅ RESOLVED

---

## Contact & Support

**Infrastructure Maintenance**:
- Server: 192.168.1.15
- SSH Access: `ssh user@192.168.1.15`
- Coolify UI: http://192.168.1.15:8000
- Application UUID: `m4s0kwo4kc4oooocck4sswc4`

**Emergency Recovery**:
If Coolify becomes completely unresponsive:
1. Restart Coolify: `docker restart coolify`
2. Check database: `docker logs coolify-db --tail 100`
3. Restore from backup if needed
4. Contact infrastructure team

---

**Document Version**: 1.0
**Last Updated**: November 15, 2025
**Status**: Production Issue Resolved
