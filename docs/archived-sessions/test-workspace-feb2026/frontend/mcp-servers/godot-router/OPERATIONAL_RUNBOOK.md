# Operational Runbook

## Table of Contents

1. Daily Operations
2. Incident Response
3. Troubleshooting Common Issues
4. Maintenance Procedures
5. Scaling & Capacity Planning
6. Security & Compliance

---

## Daily Operations

### Start of Shift Checklist

**Every 8 hours** (beginning of shift):

```bash
# 1. Check system health
curl -s http://localhost:3002/api/health/readiness | jq .

# Expected: { "status": "healthy", "timestamp": "2025-01-01T00:00:00Z" }
# If status is "degraded", investigate immediately

# 2. Check instance status
curl -s http://localhost:3002/api/health/mcp | jq '
  {
    total: .summary.totalInstances,
    healthy: .summary.healthyInstances,
    unhealthy: .summary.unhealthyInstances,
    crashLoop: .summary.crashLoopInstances
  }'

# Expected: All instances healthy, zero crash loops
# If unhealthy > 0, investigate instance logs

# 3. Check metrics
curl -s http://localhost:3002/api/metrics/prometheus | grep -E "^mcp_" | head -10

# 4. Check database connections
psql $DATABASE_URL -c "
  SELECT count(*) as active_connections
  FROM pg_stat_activity
  WHERE datname = 'veritable_games';"

# Expected: <20 connections
# If >25, check for connection leaks

# 5. Check disk space
df -h /tmp /var | awk 'NR==1 || /tmp|var/ {print $1, $5}'

# Expected: All <80% used
# If >80%, clean up old socket files or logs

# 6. Review error logs
grep ERROR logs/godot-mcp-router.log | tail -20

# Expected: No errors in last 8 hours
# If errors present, investigate and document
```

### Hourly Monitoring

```bash
#!/bin/bash
# Run every hour

ALERT_THRESHOLD_ERROR_RATE=0.05  # 5%
ALERT_THRESHOLD_LATENCY=500      # 500ms

# Check error rate
ERROR_RATE=$(curl -s http://localhost:3002/api/metrics/prometheus | \
  grep 'mcp_errors_total' | awk '{sum+=$2} END {print sum}')

if (( $(echo "$ERROR_RATE > $ALERT_THRESHOLD_ERROR_RATE" | bc -l) )); then
  echo "ALERT: High error rate detected: $ERROR_RATE"
  # Send to Slack, PagerDuty, etc.
fi

# Check latency
P95_LATENCY=$(curl -s http://localhost:3002/api/metrics/prometheus | \
  grep 'mcp_request_duration_seconds_bucket{le="0.5"}' | awk '{print $2}')

if (( $(echo "$P95_LATENCY > $ALERT_THRESHOLD_LATENCY" | bc -l) )); then
  echo "ALERT: High latency detected: ${P95_LATENCY}ms"
fi

# Check instance crashes
CRASH_COUNT=$(curl -s http://localhost:3002/api/health/mcp | \
  jq '.summary.crashLoopInstances')

if [ "$CRASH_COUNT" -gt 0 ]; then
  echo "ALERT: $CRASH_COUNT instances in crash loop"
fi
```

---

## Incident Response

### Severity Levels

| Level            | Response Time | Escalation       |
| ---------------- | ------------- | ---------------- |
| **P1: Critical** | Immediate     | Page on-call     |
| **P2: High**     | 15 minutes    | Notify team lead |
| **P3: Medium**   | 1 hour        | File ticket      |
| **P4: Low**      | 24 hours      | Plan fix         |

### P1: System Down (All instances failing)

```bash
# 1. Immediate actions (0-5 min)
# - Page on-call
# - Post to #incidents Slack channel
# - Start incident call
# - Begin logging timeline

# 2. Diagnosis (5-15 min)
# Check health endpoint
curl -i http://localhost:3002/api/health/readiness

# If 503: System is down
# Check:
# a) Is process running?
ps aux | grep "node dist/router.js"

# b) Is database reachable?
psql $DATABASE_URL -c "SELECT 1"

# c) Are any processes hung?
netstat -an | grep godot-mcp | wc -l

# d) Are there permission issues?
ls -la /tmp/godot-mcp-*.sock

# 3. Recovery options
# Option A: Restart service
sudo systemctl restart godot-mcp-router
sleep 10
curl -i http://localhost:3002/api/health/readiness

# Option B: Check logs for issues
sudo journalctl -u godot-mcp-router -n 100 -f

# Option C: Scale down and back up (Kubernetes)
kubectl scale deployment godot-mcp-router --replicas=0
sleep 5
kubectl scale deployment godot-mcp-router --replicas=2
kubectl rollout status deployment/godot-mcp-router

# 4. Verification (after recovery)
# Wait 5 minutes for all instances to come up
curl http://localhost:3002/api/health/mcp | jq '.summary'

# Expected: totalInstances > 0, unhealthyInstances = 0

# 5. Communication
# - Post resolution in #incidents
# - Create post-mortem ticket
# - Schedule incident review
```

### P2: High Error Rate (>5%)

```bash
# 1. Identify error source
curl -s http://localhost:3002/api/metrics/prometheus | \
  grep 'mcp_errors_total' | sort -k2 -nr | head -5

# Example output:
# mcp_errors_database_total 42
# mcp_errors_timeout_total 15
# mcp_errors_validation_total 8

# 2. Check affected component
# For database errors:
psql $DATABASE_URL -c "
  SELECT name, state, wait_event_type
  FROM pg_stat_activity
  WHERE datname = 'veritable_games'
  ORDER BY state_change DESC;"

# For timeout errors:
grep TIMEOUT logs/godot-mcp-router.log | tail -20

# For validation errors:
grep VALIDATION logs/godot-mcp-router.log | tail -20

# 3. Mitigate immediately
# a) If database: increase pool size
export DATABASE_POOL_SIZE=15
systemctl restart godot-mcp-router

# b) If timeout: increase timeout threshold
export SOCKET_TIMEOUT=10000
systemctl restart godot-mcp-router

# c) If validation: rollback recent deploy
git checkout v1.x.x
npm run build
systemctl restart godot-mcp-router

# 4. Monitor recovery
watch -n 5 'curl -s http://localhost:3002/api/metrics/prometheus | grep "mcp_errors_total"'

# 5. Root cause analysis
# Review changes from last deployment
git log --oneline -10

# Check resource usage during incident
# Look for spikes in CPU, memory, or connections
```

### P3: Degraded Performance (Latency >200ms)

```bash
# 1. Identify bottleneck
curl -s http://localhost:3002/api/metrics/prometheus | grep -E "duration|latency"

# 2. Check resource usage
ps aux | grep node
top -p $(pgrep -f "node dist/router.js")

# 3. Check database query performance
psql $DATABASE_URL << EOF
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE datname = 'veritable_games'
ORDER BY mean_exec_time DESC
LIMIT 10;
EOF

# 4. Optimize if needed
# a) Kill long-running queries
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE query_start < NOW() - INTERVAL '5 minutes'
AND datname = 'veritable_games';

# b) Increase connection pool size
export DATABASE_POOL_SIZE=15

# c) Increase caching
export CACHE_TTL=60000

# 5. Monitor for recovery
watch -n 5 'curl -s http://localhost:3002/api/metrics/prometheus | grep "request_duration"'
```

### P4: Minor Issues (Warnings, info alerts)

```bash
# Create ticket
# Schedule fix during maintenance window
# No immediate action required

# Document in ticket:
# - Time of occurrence
# - Frequency
# - Expected impact
# - Proposed fix
```

---

## Troubleshooting Common Issues

### Issue 1: Instance Spawn Failures

**Symptom:**

```
Spawn failed: EADDRINUSE: Address already in use
```

**Root Cause:**

- Old socket file not cleaned up
- Process still running but not responding

**Solution:**

```bash
# 1. Find old socket files
ls -la /tmp/godot-mcp-*.sock

# 2. Check if process is running
for sock in /tmp/godot-mcp-*.sock; do
  pid=$(lsof $sock | tail -1 | awk '{print $2}')
  if [ -z "$pid" ]; then
    echo "Stale socket: $sock"
    rm $sock
  fi
done

# 3. Verify no processes running on sockets
netstat -an | grep /tmp/godot-mcp-*.sock

# 4. Restart router
systemctl restart godot-mcp-router
```

### Issue 2: Database Connection Pool Exhaustion

**Symptom:**

```
Error: ECONNREFUSED: no available connections in pool
```

**Root Cause:**

- Connections not being released (leak)
- Long-running operations
- Too many concurrent instances

**Solution:**

```bash
# 1. Check active connections
psql $DATABASE_URL -c "
  SELECT count(*) as active_connections,
         datname,
         client_addr,
         state
  FROM pg_stat_activity
  WHERE datname = 'veritable_games'
  GROUP BY datname, client_addr, state;"

# 2. Identify long-running queries
psql $DATABASE_URL -c "
  SELECT pid, now() - pg_stat_activity.query_start as duration, query
  FROM pg_stat_activity
  WHERE datname = 'veritable_games'
  AND state != 'idle'
  ORDER BY duration DESC;"

# 3. Kill long-running queries (>5 minutes)
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE query_start < NOW() - INTERVAL '5 minutes'
AND datname = 'veritable_games';

# 4. Increase pool size temporarily
export DATABASE_POOL_SIZE=20
systemctl restart godot-mcp-router

# 5. Monitor recovery
watch -n 5 "psql $DATABASE_URL -c \
  \"SELECT count(*) FROM pg_stat_activity \
  WHERE datname = 'veritable_games';\""
```

### Issue 3: Circuit Breaker Open

**Symptom:**

```
Error: Circuit breaker is OPEN. Retry in 25000ms
```

**Root Cause:**

- Persistent failures (3+ consecutive)
- External service unavailable
- Resource exhaustion

**Solution:**

```bash
# 1. Identify which breaker is open
curl -s http://localhost:3002/api/health/mcp | \
  jq '.instances[] | select(.circuitBreakerState=="OPEN")'

# 2. Check what's causing failures
grep "circuit breaker" logs/godot-mcp-router.log | tail -20

# 3. Fix root cause
# - If database: increase pool, optimize queries
# - If socket: check network connectivity
# - If spawn: check Godot project validity

# 4. Circuit will auto-recover after timeout (30s default)
# Wait and verify
sleep 35
curl http://localhost:3002/api/health/mcp | \
  jq '.instances[] | select(.circuitBreakerState=="HALF_OPEN")'

# 5. If still failing, investigate deeper
tail -100 logs/godot-mcp-router.log | grep -A5 "HALF_OPEN"
```

### Issue 4: Crash Loop Detection

**Symptom:**

```
Instance has exceeded max restart attempts. Entering crash loop protection.
```

**Root Cause:**

- Corrupted state file
- Invalid configuration
- Incompatible Godot version
- Script syntax errors

**Solution:**

```bash
# 1. View crash logs
curl http://localhost:3002/api/health/mcp | \
  jq '.instances[] | select(.crashLoopDetected)'

# 2. Check instance logs
docker logs godot-mcp-router | grep "version_id: X" | tail -50

# 3. Clean instance state
curl -X DELETE http://localhost:3002/api/instances/{versionId}/state

# 4. Verify Godot project
cat /path/to/godot-project/project.godot | grep -E "script_class|export"

# 5. Attempt manual restart
curl -X POST http://localhost:3002/api/instances/{versionId}/restart

# 6. If still failing, rebuild instance
# a) Update Godot version
# b) Fix project configuration
# c) Run tests locally first

# 7. Monitor restart cycle
watch -n 5 "curl -s http://localhost:3002/api/health/mcp | \
  jq '.instances[] | select(.id==X)'"
```

### Issue 5: High Memory Usage

**Symptom:**

```
Memory usage: 512MB per instance (expected: 150MB)
```

**Root Cause:**

- Memory leak in instance
- Large build cache
- Event buffer not clearing

**Solution:**

```bash
# 1. Verify memory usage
ps aux | grep -E "node dist" | grep -v grep

# 2. Get heap snapshot (for profiling)
# This requires --inspect flag - restart with:
node --inspect dist/router.js

# 3. Take heap snapshot
node -e "
  const http = require('http');
  http.get('http://localhost:9229/json', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(JSON.parse(data)));
  });
"

# 4. Immediate mitigation: increase memory limit
export NODE_OPTIONS="--max-old-space-size=2048"
systemctl restart godot-mcp-router

# 5. If issue persists: restart service
systemctl restart godot-mcp-router
# Monitor memory after restart
watch -n 2 'ps aux | grep node'

# 6. Schedule deep investigation
# Analyze heap dump with Chrome DevTools
# Look for: retained objects, global references, leaking listeners
```

---

## Maintenance Procedures

### Weekly Maintenance

**Every Monday 2:00 AM UTC** (low traffic window):

```bash
#!/bin/bash
# Weekly maintenance script

LOG_DIR="logs"
BACKUP_DIR="backups"
KEEP_DAYS=30

# 1. Rotate logs
find $LOG_DIR -name "*.log" -mtime +$KEEP_DAYS -delete

# 2. Backup database
pg_dump $DATABASE_URL | gzip > \
  $BACKUP_DIR/database_$(date +%Y%m%d_%H%M%S).sql.gz

# 3. Cleanup old socket files
find /tmp -name "godot-mcp-*.sock" -mtime +7 -delete

# 4. Run vacuum on database
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# 5. Check for updates
npm outdated

# 6. Generate report
echo "Weekly maintenance completed at $(date)" >> maintenance.log
echo "Backups: $(ls -1 $BACKUP_DIR | wc -l)" >> maintenance.log
echo "Database size: $(du -sh /var/lib/postgresql)" >> maintenance.log
```

### Monthly Maintenance

**First Sunday of month 3:00 AM UTC**:

```bash
# 1. Update dependencies (non-breaking)
npm update

# 2. Security audit
npm audit

# 3. Performance analysis
# Review error logs, latency trends, resource usage

# 4. Capacity planning
# Project growth for next quarter

# 5. Review and update documentation
# - Runbooks
# - Architecture diagrams
# - Configuration reference

# 6. Test disaster recovery
# - Restore from backup
# - Verify data integrity
# - Document any issues

# 7. Team training
# - Review new features
# - Discuss incidents from month
# - Update on-call procedures
```

### Quarterly Maintenance

**Every 3 months**:

```bash
# 1. Major dependency updates
npm update --save

# 2. Review and optimize database
# - Analyze slow queries
# - Update indexes
# - Review table sizes

# 3. Performance tuning
# - Adjust pool sizes
# - Review timeout values
# - Optimize hot paths

# 4. Security review
# - Check for vulnerabilities
# - Review access controls
# - Update security policies

# 5. Disaster recovery drill
# - Full production restore
# - Multi-region failover
# - Document lessons learned

# 6. Strategic planning
# - Plan for next quarter
# - Technology upgrades
# - Team growth
```

---

## Scaling & Capacity Planning

### Vertical Scaling (More Resources)

When hitting resource limits per instance:

```bash
# Check current limits
ps aux | head -5
top -p $(pgrep -f "node dist/router.js") -n 1

# Increase memory
export NODE_OPTIONS="--max-old-space-size=4096"
systemctl restart godot-mcp-router

# Increase CPU affinity (Kubernetes)
kubectl patch deployment godot-mcp-router --type='json' \
  -p='[{
    "op": "replace",
    "path": "/spec/template/spec/containers/0/resources/requests/cpu",
    "value": "1000m"
  }]'

# Increase database pool
export DATABASE_POOL_SIZE=20
systemctl restart godot-mcp-router
```

### Horizontal Scaling (More Instances)

When single instance can't handle load:

```bash
# Kubernetes: Scale replicas
kubectl scale deployment godot-mcp-router --replicas=4

# Docker Compose: Scale services
docker-compose up -d --scale router=4

# Systemd: Run multiple instances on different ports
# Update systemd service to use ports 3002, 3003, 3004, 3005
# Use load balancer to distribute traffic
```

### Capacity Planning Formula

```
Required Capacity = (Avg Load * Peak Multiplier) + Buffer
Peak Multiplier = 2-3x (typical SaaS)
Buffer = 20% headroom

Example:
- Avg 100 concurrent instances
- Peak = 300 concurrent instances
- With 20% buffer = 360 instances capacity
- Each physical server handles 100 instances
- Need: 4 servers (360 / 100 = 3.6, round up)
```

### Monitoring Growth

```bash
#!/bin/bash
# Run daily to track growth

DATE=$(date +%Y-%m-%d)

# Get metrics
TOTAL_INSTANCES=$(curl -s http://localhost:3002/api/health/mcp | \
  jq '.summary.totalInstances')

AVG_LATENCY=$(curl -s http://localhost:3002/api/metrics/prometheus | \
  grep 'mcp_request_duration_seconds' | \
  awk '{sum+=$2; count++} END {print sum/count}')

ERROR_RATE=$(curl -s http://localhost:3002/api/metrics/prometheus | \
  grep 'mcp_errors_total' | \
  awk '{sum+=$2} END {print sum}')

# Log metrics
echo "$DATE | Instances: $TOTAL_INSTANCES | Latency: ${AVG_LATENCY}s | Errors: $ERROR_RATE" \
  >> capacity.log

# Alert if approaching capacity
if [ "$TOTAL_INSTANCES" -gt 80 ]; then
  echo "ALERT: Approaching capacity (80% of $TOTAL_INSTANCES)"
  # Send to Slack/PagerDuty
fi
```

---

## Security & Compliance

### Access Control

```bash
# 1. Restrict SSH access
sudo vim /etc/ssh/sshd_config
# Add: AllowUsers deploy@specific_ip

# 2. Setup sudo for deployment user
sudo visudo
# Add: deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart godot-mcp-router

# 3. Restrict database access
psql $DATABASE_URL -c "
  CREATE ROLE godot_app WITH PASSWORD 'secure_password';
  GRANT SELECT, UPDATE, INSERT ON godot_versions TO godot_app;
  REVOKE DELETE, DROP ON godot_versions FROM godot_app;"

# 4. Setup firewall rules
sudo ufw allow 3002/tcp from 10.0.0.0/8
sudo ufw deny 3002/tcp from any
```

### Secrets Management

```bash
# 1. Use environment variables (never in code)
export DATABASE_PASSWORD='...'
export SLACK_WEBHOOK_URL='...'

# 2. Use secrets manager (production)
# HashiCorp Vault, AWS Secrets Manager, etc.

# 3. Rotate secrets regularly
# Every 90 days minimum

# 4. Audit access
# Log who accessed what, when
```

### Compliance & Auditing

```bash
# 1. Enable audit logging
export ENABLE_AUDIT_LOG=true

# 2. Log sensitive operations
# - Who restarted service
# - When instances were created/deleted
# - Database migrations
# - Configuration changes

# 3. Review logs regularly
grep "AUDIT" logs/godot-mcp-router.log | head -20

# 4. Archive logs for compliance
# Keep for 1+ years
tar czf logs_$(date +%Y%m).tar.gz logs/
mv logs_$(date +%Y%m).tar.gz /archive/
```

---

## Escalation Path

```
Level 1: On-Call Engineer
├─ Run initial diagnosis
├─ Check dashboards & logs
├─ Attempt standard remediation
└─ P1: Escalate to Level 2 immediately

Level 2: Tech Lead
├─ Review diagnostic work
├─ Authorize non-standard changes
├─ Coordinate with team
└─ P1/P2: May escalate to Level 3

Level 3: Engineering Manager/CTO
├─ Strategic decisions
├─ Resource allocation
├─ External communication
└─ Major incidents only
```

---

## Contact Information

- **On-Call Engineer:** [Schedule link]
- **Tech Lead:** [Slack handle]
- **Engineering Manager:** [Slack/Email]
- **Incident Channel:** #godot-mcp-incidents
- **Critical Alert Webhook:** [PagerDuty/Slack]

---

This runbook should be reviewed and updated quarterly or when procedures change.
