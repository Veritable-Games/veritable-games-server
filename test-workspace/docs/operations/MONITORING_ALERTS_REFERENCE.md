# Production Monitoring Alerts Reference

**Last Updated**: December 29, 2025
**Purpose**: Quick reference for understanding and responding to monitoring alerts

---

## Alert Types

### 🔴 Critical Alerts

These require immediate action. On-call engineer should be paged.

#### 1. Application Health Endpoint Not Responding

**Alert Message**: `Application Health: Application health endpoint not responding`

**Severity**: 🔴 CRITICAL

**Root Causes**:
- Application container crashed
- Network connectivity issue
- Health endpoint code error
- Port 3000 not exposed

**Investigation Steps**:
```bash
# 1. Check if container is running
docker ps | grep veritable-games

# 2. Check container health status
docker inspect <container-id> | grep -i health

# 3. Check if port 3000 is responding
curl -I http://192.168.1.15:3000/api/health

# 4. Check container logs
docker logs <container-id> | tail -50

# 5. Check CPU/Memory
docker stats <container-id>
```

**Quick Fix**:
```bash
# Restart container
docker restart <container-id>

# If that doesn't work, check for resource issues
docker system df
```

**Prevention**:
- Set up resource limits in docker-compose
- Configure health check probes
- Monitor for memory leaks

---

#### 2. Database Not Connected

**Alert Message**: `Database Connection: Database not connected`

**Severity**: 🔴 CRITICAL

**Root Causes**:
- PostgreSQL server down
- Network connectivity to 192.168.1.15:5432
- Invalid DATABASE_URL environment variable
- Connection pool exhausted

**Investigation Steps**:
```bash
# 1. Check if database is reachable
curl -I http://192.168.1.15:5432 || echo "Port not HTTP"

# 2. Test PostgreSQL connection directly
psql -h 192.168.1.15 -U postgres -d veritable_games -c "SELECT 1"

# 3. Check database logs
docker logs postgres-container | tail -50

# 4. Check connection pool
psql -h 192.168.1.15 -U postgres -c "SELECT * FROM pg_stat_activity"
```

**Quick Fix**:
```bash
# Verify DATABASE_URL is set correctly
echo $DATABASE_URL

# Restart PostgreSQL
docker restart postgres-container

# Clear stuck connections (if needed)
psql -h 192.168.1.15 -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'veritable_games' AND pid != pg_backend_pid()"
```

**Prevention**:
- Set up database monitoring
- Configure automatic failover
- Use connection pooling (PgBouncer)

---

#### 3. Domain Not Responding

**Alert Message**: `Domain Availability: Domain not responding`

**Severity**: 🔴 CRITICAL

**Root Causes**:
- CloudFlare Tunnel down
- DNS resolution failure
- SSL certificate expired
- Network routing issue

**Investigation Steps**:
```bash
# 1. Check domain DNS
nslookup www.veritablegames.com

# 2. Test HTTPS connection
curl -I https://www.veritablegames.com

# 3. Check CloudFlare tunnel status
ssh root@192.168.1.15 'cloudflared tunnel status' 2>/dev/null || echo "Tunnel not accessible"

# 4. Check SSL certificate
curl -I https://www.veritablegames.com | grep -i "certificate\|expires"

# 5. Check application logs
docker logs <container-id> | grep -i "error\|connection"
```

**Quick Fix**:
```bash
# Restart CloudFlare tunnel
ssh root@192.168.1.15 'systemctl restart cloudflared' 2>/dev/null

# Or manually reconnect
ssh root@192.168.1.15 'cloudflared tunnel run' &
```

**Prevention**:
- Set up domain monitoring separate from app health
- Configure SSL certificate auto-renewal
- Monitor CloudFlare tunnel status

---

### 🟡 Warning Alerts

These indicate degradation or potential issues. Investigation within 4 hours recommended.

#### 1. Response Time Slow

**Alert Message**: `Response Time: API response slow: 1250ms`

**Severity**: 🟡 WARNING

**Root Causes**:
- Database query optimization needed
- External API calls slow
- Server under load
- Memory swapping

**Investigation Steps**:
```bash
# 1. Check response times from different endpoints
time curl http://192.168.1.15:3000/api/health
time curl http://192.168.1.15:3000/api/projects
time curl http://192.168.1.15:3000/api/library/documents

# 2. Monitor system resources
docker stats <container-id>
top -b -n 1 | head -20

# 3. Check application logs for slow queries
grep -i "slow\|took\|duration" logs/app.log | tail -20

# 4. Review database query logs
psql -h 192.168.1.15 -U postgres -d veritable_games -c "SELECT * FROM pg_stat_statements WHERE mean_exec_time > 1000 ORDER BY mean_exec_time DESC LIMIT 10"
```

**Quick Fix**:
```bash
# 1. Clear any caches
redis-cli FLUSHALL 2>/dev/null || echo "No Redis"

# 2. Analyze slow queries
psql -h 192.168.1.15 -U postgres -d veritable_games -c "ANALYZE;"

# 3. Scale up if under heavy load
# (Requires infrastructure changes - escalate to SRE)
```

**Prevention**:
- Add database indexes for common queries
- Implement query caching
- Set up query performance monitoring
- Configure application-level caching

---

#### 2. Memory Usage High

**Alert Message**: `Memory Usage: High memory usage: 175MB`

**Severity**: 🟡 WARNING

**Root Causes**:
- Memory leak in application
- Too many connections in pool
- Large data sets being processed
- Node.js heap growing

**Investigation Steps**:
```bash
# 1. Check memory usage over time
docker stats <container-id> --no-stream | tail -5

# 2. Check for memory leak patterns
tail -f logs/monitor.log | grep "Memory Usage"

# 3. Check Node.js heap
curl http://192.168.1.15:3000/api/health | jq '.memory'

# 4. Check connection pool size
curl http://192.168.1.15:3000/api/health | jq '.database.connectionPool'

# 5. Check process details
ps aux | grep node
```

**Quick Fix**:
```bash
# 1. Restart container (graceful restart recommended)
docker restart --signal=SIGTERM <container-id>

# 2. If memory keeps growing, check for memory leaks
node --max_old_space_size=256 <app.js>
```

**Prevention**:
- Set memory limits in docker-compose
- Profile application for memory leaks
- Implement proper connection cleanup
- Monitor heap size trends

---

#### 3. Domain Response Slow

**Alert Message**: `Domain Latency: Domain response slow: 6500ms`

**Severity**: 🟡 WARNING (but close to 🔴 if > 10s)

**Root Causes**:
- CloudFlare Tunnel latency
- Application server slow
- Network congestion
- SSL handshake slow

**Investigation Steps**:
```bash
# 1. Separate tunnel vs app latency
time curl -w "\nDNS: %{time_namelookup}\nConnect: %{time_connect}\nApp: %{time_starttransfer}\nTotal: %{time_total}\n" https://www.veritablegames.com

# 2. Check tunnel metrics
curl -s http://192.168.1.15:3000/api/health | jq '.responseTime'

# 3. Check network connectivity
ping -c 3 192.168.1.15

# 4. Check CloudFlare tunnel status
ssh root@192.168.1.15 'cloudflared tunnel status' 2>/dev/null
```

**Quick Fix**:
```bash
# 1. Restart tunnel
ssh root@192.168.1.15 'systemctl restart cloudflared'

# 2. Clear DNS cache
nslookup -norecurse www.veritablegames.com
```

**Prevention**:
- Use faster DNS providers (1.1.1.1, 8.8.8.8)
- Enable CloudFlare caching
- Monitor tunnel performance metrics
- Consider regional replicas for low latency

---

### ℹ️ Info Alerts

These are logged for historical analysis. No immediate action needed.

#### 1. Health Check Success

**Alert Message**: `Application Health: Health check completed successfully`

**Severity**: ℹ️ INFO

**Purpose**: Track successful checks for uptime statistics

**Action**: None - healthy operation indicator

---

## Alert Response Workflow

### Priority 1: 🔴 Critical Alerts (Respond < 5 minutes)

```
1. Page on-call engineer
2. Create incident in tracking system
3. Perform investigation steps
4. Apply quick fix if applicable
5. Monitor for recurrence
6. Post-mortem after 24 hours
```

### Priority 2: 🟡 Warning Alerts (Investigate < 4 hours)

```
1. Log alert details
2. Schedule investigation
3. Collect baseline metrics
4. Identify pattern or one-off
5. If pattern: create ticket for fix
6. If one-off: document in runbook
```

### Priority 3: ℹ️ Info Alerts (Archive > 30 days)

```
1. Collect metrics
2. Identify trends
3. Use for capacity planning
4. Shared in weekly metrics review
```

---

## Alert Escalation Matrix

| Alert Type | P1 (ASAP) | P2 (Hours) | P3 (Daily) | Action |
|-----------|-----------|-----------|-----------|--------|
| App Down | YES | - | - | Page engineer, restart |
| DB Down | YES | - | - | Page DBA, check connectivity |
| Domain Down | YES | - | - | Page ops, check tunnel |
| Response Slow | - | YES | - | Investigate, optimize |
| Memory High | - | YES | - | Monitor, restart if needed |
| Domain Slow | - | YES | - | Check tunnel, optimize |
| Checks Passing | - | - | YES | Archive, analyze trends |

---

## Common Alert Patterns

### Pattern 1: Recurring Memory Growth

**Symptom**: Memory usage increases 10-20MB per day

**Diagnosis**:
- Memory leak in application code
- Connection pool not cleaning up
- Caching without eviction

**Solution**:
1. Profile application with Node.js profiler
2. Check for unreleased event listeners
3. Implement cache eviction policy
4. Review connection handling

---

### Pattern 2: Slow Responses During Peak Hours

**Symptom**: Response time > 1000ms between 9-10 AM and 4-5 PM

**Diagnosis**:
- Database under load
- Unoptimized queries
- Missing indexes
- Insufficient connection pool

**Solution**:
1. Add database indexes for peak queries
2. Increase connection pool size
3. Implement query caching
4. Consider read replicas

---

### Pattern 3: Domain Latency Spikes

**Symptom**: Domain response varies 200ms to 5000ms randomly

**Diagnosis**:
- CloudFlare Tunnel connectivity
- DNS resolution variance
- SSL session reuse issues
- Network congestion

**Solution**:
1. Use persistent DNS
2. Enable SSL session caching
3. Monitor tunnel metrics continuously
4. Consider direct IP access

---

## Setting Up Alert Notifications

### Email Integration

```bash
# Add to .env.local
ALERT_EMAIL=admin@veritablegames.com
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password

# Restart monitoring
npm run monitor:stop
npm run monitor:start
```

---

## Monitoring Thresholds

Current thresholds (adjustable in `health-monitor.js`):

```javascript
{
  responseTime: 1000,      // Alert if > 1000ms
  memoryUsage: 150,        // Alert if > 150MB
  memoryPercent: 85,       // Alert if > 85%
  databaseLatency: 500,    // Alert if > 500ms
  apiErrorRate: 5          // Alert if > 5%
}
```

---

## False Positive Prevention

### Configuration Check

Before investigating, verify:

1. ✅ Monitoring script is running
2. ✅ Health endpoint is responding
3. ✅ Network connectivity is good
4. ✅ Database is actually slow (not monitoring script issue)

### Common False Positives

**Issue**: First check always times out

**Cause**: Cold start, DNS resolution

**Solution**: Increase check timeout, enable DNS caching

---

## Runbook Template

For each alert type, maintain a runbook:

```
# [Alert Type] Runbook

## Symptom
- What does the alert say?
- How frequently does it occur?

## Diagnosis
- Step 1: Check X
- Step 2: Verify Y
- Step 3: Analyze Z

## Resolution
- Option A: Quick fix
- Option B: Proper fix
- Option C: Escalation

## Prevention
- What caused it?
- How to prevent recurrence?

## Testing
- How to verify fix worked?
- How to test alert system?
```

---

## Next Steps

1. ✅ Understand alert types (Critical, Warning, Info)
2. ⏳ Configure email notifications (optional)
3. ⏳ Test alert firing and notifications
4. ⏳ Document team escalation procedures
5. ⏳ Create runbooks for each alert type
6. ⏳ Schedule weekly alert review
7. ⏳ Track alert trends for capacity planning

---

**Document Version**: 1.0.0
**Last Review**: December 29, 2025
**Next Review**: January 15, 2026
