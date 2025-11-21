#!/bin/bash
# Coolify Diagnostic Script
# Checks for common issues causing unserialize() errors

echo "=== Coolify Diagnostic Report ==="
echo "Generated: $(date)"
echo ""

# Check container health
echo "1. Container Health:"
docker ps --filter "name=coolify" --format "{{.Names}}: {{.Status}}" | sed 's/^/   /'
echo ""

# Check for empty environment variables
echo "2. Empty Environment Variables:"
EMPTY_COUNT=$(docker exec coolify-db psql -U coolify -d coolify -t -c "SELECT COUNT(*) FROM environment_variables WHERE value IS NULL OR value = '';")
echo "   Count: $EMPTY_COUNT"
if [ "$EMPTY_COUNT" -gt 0 ]; then
  echo "   ⚠️  Found empty variables:"
  docker exec coolify-db psql -U coolify -d coolify -c "SELECT id, key, resourceable_type FROM environment_variables WHERE value IS NULL OR value = '' LIMIT 5;"
fi
echo ""

# Check Laravel logs for unserialize errors
echo "3. Recent Unserialize Errors (last 24 hours):"
UNSERIALIZE_ERRORS=$(docker exec coolify grep -c "unserialize" /var/www/html/storage/logs/laravel.log 2>/dev/null || echo "0")
echo "   Total unserialize errors: $UNSERIALIZE_ERRORS"
if [ "$UNSERIALIZE_ERRORS" -gt 0 ]; then
  echo "   Last 3 errors:"
  docker exec coolify grep "unserialize" /var/www/html/storage/logs/laravel.log | tail -3 | sed 's/^/   /'
fi
echo ""

# Check for corrupted cache
echo "4. Laravel Cache Status:"
CACHE_SIZE=$(docker exec coolify du -sh /var/www/html/bootstrap/cache 2>/dev/null | awk '{print $1}')
VIEW_CACHE_SIZE=$(docker exec coolify du -sh /var/www/html/storage/framework/views 2>/dev/null | awk '{print $1}')
echo "   Bootstrap cache: $CACHE_SIZE"
echo "   View cache: $VIEW_CACHE_SIZE"
echo ""

# Check database connection
echo "5. Database Connection:"
if docker exec coolify-db psql -U coolify -d coolify -c "SELECT 1;" > /dev/null 2>&1; then
  echo "   ✅ Database OK"
else
  echo "   ❌ Database connection failed"
fi
echo ""

# Check for NULL values in critical tables
echo "6. Application Configuration:"
APP_COUNT=$(docker exec coolify-db psql -U coolify -d coolify -t -c "SELECT COUNT(*) FROM applications WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';")
echo "   Application found: $([ "$APP_COUNT" -eq 1 ] && echo "Yes" || echo "No")"

ENV_COUNT=$(docker exec coolify-db psql -U coolify -d coolify -t -c "SELECT COUNT(*) FROM environment_variables WHERE resourceable_type = 'App\\Models\\Application' AND resourceable_id = (SELECT id FROM applications WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4');")
echo "   Environment variables: $ENV_COUNT"
echo ""

# Check disk space
echo "7. Disk Space:"
docker exec coolify df -h | grep -E "Filesystem|/$" | sed 's/^/   /'
echo ""

# Check recent deployments
echo "8. Recent Deployment Status:"
docker exec coolify-db psql -U coolify -d coolify -t -c "SELECT status FROM application_deployment_queues WHERE application_uuid = 'm4s0kwo4kc4oooocck4sswc4' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null | sed 's/^/   Last deployment status: /'
echo ""

# Recommendations
echo "=== Recommendations ==="
if [ "$EMPTY_COUNT" -gt 0 ]; then
  echo "⚠️  Clear empty environment variables:"
  echo "   docker exec coolify-db psql -U coolify -d coolify -c \"DELETE FROM environment_variables WHERE value IS NULL OR value = '';\""
fi

if [ "$UNSERIALIZE_ERRORS" -gt 0 ]; then
  echo "⚠️  Clear Laravel caches:"
  echo "   docker exec coolify php artisan optimize:clear"
fi

echo ""
echo "=== Diagnostic Complete ==="
