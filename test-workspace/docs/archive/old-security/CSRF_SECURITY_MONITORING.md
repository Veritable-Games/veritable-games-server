# 🔒 CSRF Security Monitoring & Rollback Procedures

## Production Monitoring Setup

### Security Event Logging

Add enhanced logging to track CSRF verification events and potential attacks:

```typescript
// Add to middleware.ts after CSRF verification
const logCSRFEvent = (
  result: 'success' | 'failure' | 'session_transition',
  request: NextRequest,
  error?: string,
  metadata?: any
) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: result === 'failure' ? 'WARN' : 'INFO',
    category: 'SECURITY',
    event: 'csrf_verification',
    result,
    path: request.nextUrl.pathname,
    method: request.method,
    session_id: request.cookies.get('session_id')?.value?.substring(0, 8) + '***',
    client_ip: getClientIP(request),
    user_agent: request.headers.get('user-agent')?.substring(0, 100),
    error,
    metadata,
    build_version: process.env.BUILD_VERSION || 'unknown',
  };

  if (result === 'failure') {
    console.warn('CSRF_VERIFICATION_FAILED', JSON.stringify(logEntry));
  } else {
    console.log('CSRF_VERIFICATION', JSON.stringify(logEntry));
  }

  // Send to monitoring service (Sentry, DataDog, etc.)
  if (process.env.NODE_ENV === 'production') {
    // Example: sendToMonitoring('csrf_event', logEntry);
  }
};
```

### Real-time Monitoring Dashboard

#### Key Metrics to Track

```json
{
  "csrf_metrics": {
    "verification_success_rate": "98.5%",
    "verification_failure_rate": "1.5%",
    "session_transitions_per_hour": 245,
    "token_refresh_requests_per_hour": 189,
    "average_verification_latency_ms": 3.2,
    "unique_sessions_with_failures": 12
  },
  "security_alerts": {
    "cross_session_attacks": 0,
    "missing_token_requests": 23,
    "expired_token_requests": 7,
    "malformed_token_requests": 2
  },
  "performance_metrics": {
    "p95_verification_latency_ms": 8.1,
    "p99_verification_latency_ms": 15.3,
    "memory_usage_mb": 234.5,
    "cpu_usage_percent": 12.3
  }
}
```

#### Alert Thresholds

```yaml
alerts:
  critical:
    - csrf_failure_rate > 5%
    - cross_session_attacks > 0
    - verification_latency_p95 > 50ms
  warning:
    - csrf_failure_rate > 2%
    - missing_token_requests > 100/hour
    - session_transitions > 1000/hour
  info:
    - token_refresh_requests > 500/hour
    - new_session_creation_spike
```

### Security Event Monitoring Script

```bash
#!/bin/bash
# csrf-monitor.sh - Real-time CSRF security monitoring

LOGFILE="/var/log/veritable-games/security.log"
ALERT_WEBHOOK="https://hooks.slack.com/your-webhook"

monitor_csrf_events() {
  echo "🔒 Starting CSRF security monitoring..."

  # Monitor for failure patterns
  tail -f $LOGFILE | grep "CSRF_VERIFICATION" | while read line; do
    # Parse log entry
    result=$(echo $line | jq -r '.result')
    error=$(echo $line | jq -r '.error')
    timestamp=$(echo $line | jq -r '.timestamp')
    path=$(echo $line | jq -r '.path')

    # Check for security events
    if [[ "$result" == "failure" && "$error" == "session_mismatch" ]]; then
      send_alert "🚨 CRITICAL: Potential CSRF attack detected" "$line"
    elif [[ "$result" == "failure" ]]; then
      increment_failure_counter
    fi

    # Check failure rate every minute
    if [[ $(($(date +%s) % 60)) == 0 ]]; then
      check_failure_rate
    fi
  done
}

check_failure_rate() {
  # Calculate failure rate over last 5 minutes
  failures=$(grep -c "CSRF_VERIFICATION_FAILED" <(tail -1000 $LOGFILE))
  total=$(grep -c "CSRF_VERIFICATION" <(tail -1000 $LOGFILE))

  if [[ $total -gt 0 ]]; then
    failure_rate=$((failures * 100 / total))

    if [[ $failure_rate -gt 5 ]]; then
      send_alert "🚨 HIGH CSRF failure rate: ${failure_rate}%" "Consider rollback"
    elif [[ $failure_rate -gt 2 ]]; then
      send_alert "⚠️ Elevated CSRF failures: ${failure_rate}%" "Monitor closely"
    fi
  fi
}

send_alert() {
  local message="$1"
  local details="$2"

  curl -X POST $ALERT_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{
      \"text\": \"$message\",
      \"attachments\": [{
        \"color\": \"danger\",
        \"fields\": [{
          \"title\": \"Details\",
          \"value\": \"$details\",
          \"short\": false
        }]
      }]
    }"

  echo "$(date): ALERT SENT - $message" >> /var/log/csrf-alerts.log
}

# Start monitoring
monitor_csrf_events
```

## Rollback Procedures

### Emergency Rollback (< 2 minutes)

```bash
#!/bin/bash
# emergency-rollback.sh - Immediate CSRF vulnerability revert

echo "🚨 EMERGENCY ROLLBACK: Reverting CSRF security changes"

# 1. Disable session binding immediately
cat > /tmp/csrf-emergency-patch.js << 'EOF'
// Emergency patch to disable session binding
const fs = require('fs');
const middlewarePath = './src/lib/security/middleware.ts';

let content = fs.readFileSync(middlewarePath, 'utf8');

// Replace session binding with undefined
content = content.replace(
  /await verifyTokenWithSessionBinding\([^)]+\)/g,
  'csrfManager.verifyToken(csrfToken, csrfSecret, undefined)'
);

fs.writeFileSync(middlewarePath, content);
console.log('✅ Emergency patch applied - session binding disabled');
EOF

node /tmp/csrf-emergency-patch.js

# 2. Rebuild and restart
npm run build
pm2 restart veritable-games

# 3. Verify system is functional
sleep 5
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "✅ System recovered - CSRF protection reduced to token-only"
  echo "⚠️  Session binding disabled - security reduced but functional"
else
  echo "❌ System still not responding - escalate immediately"
  exit 1
fi

# 4. Alert team
echo "Emergency rollback completed at $(date)" | mail -s "CSRF Emergency Rollback" team@company.com
```

### Gradual Rollback (5-10 minutes)

```bash
#!/bin/bash
# gradual-rollback.sh - Controlled CSRF rollback with feature flags

echo "🔄 GRADUAL ROLLBACK: Adding CSRF feature flags"

# 1. Add feature flag to disable session binding
cat > /tmp/csrf-feature-flag.patch << 'EOF'
// Add environment variable control
const CSRF_SESSION_BINDING_ENABLED = process.env.CSRF_SESSION_BINDING === 'true';

async function verifyTokenWithSessionBinding(
  csrfToken: string,
  csrfSecret: string,
  sessionId: string | undefined,
  request: NextRequest
): Promise<{ valid: boolean; error?: string }> {
  // Feature flag: allow disabling session binding
  if (!CSRF_SESSION_BINDING_ENABLED) {
    console.log('CSRF: Session binding disabled via feature flag');
    return csrfManager.verifyToken(csrfToken, csrfSecret, undefined);
  }

  // ... rest of existing function
EOF

# Apply feature flag patch
patch src/lib/security/middleware.ts < /tmp/csrf-feature-flag.patch

# 2. Set environment variable to disable
echo "CSRF_SESSION_BINDING=false" >> .env.local

# 3. Rebuild with feature flag
npm run build
pm2 restart veritable-games

echo "✅ Gradual rollback complete - session binding disabled via feature flag"
echo "📊 Monitor metrics for 1 hour before permanent revert"
```

### Full Revert (15-30 minutes)

```bash
#!/bin/bash
# full-revert.sh - Complete revert to pre-fix state

echo "🔄 FULL REVERT: Returning to pre-fix state"

# 1. Git revert the security changes
git log --oneline -10  # Show recent commits
echo "Enter commit hash to revert to (before CSRF fix):"
read REVERT_COMMIT

# 2. Create revert branch
git checkout -b emergency-revert-$(date +%Y%m%d-%H%M%S)
git reset --hard $REVERT_COMMIT

# 3. Update changelog
echo "## Emergency Revert - $(date)" >> SECURITY_INCIDENTS.md
echo "- Reverted CSRF session binding due to production issues" >> SECURITY_INCIDENTS.md
echo "- Security temporarily reduced - monitoring for attacks" >> SECURITY_INCIDENTS.md

# 4. Deploy revert
npm run build
pm2 restart veritable-games

# 5. Verify functionality
echo "Testing core functionality..."
npm test -- --testPathPattern="auth|csrf" --bail

# 6. Security monitoring enhancement
echo "⚠️  SECURITY NOTICE: CSRF protection temporarily reduced"
echo "📊 Enhanced monitoring enabled for security events"
echo "🔄 Fix-forward approach recommended within 48 hours"
```

## Post-Rollback Actions

### 1. Incident Response

```markdown
## Security Incident Report

**Incident**: CSRF Security Fix Rollback
**Date**: $(date)
**Severity**: Medium (Reduced Security Posture)
**Status**: Monitoring

### Actions Taken

- [ ] CSRF session binding reverted
- [ ] System functionality restored
- [ ] Enhanced monitoring enabled
- [ ] Team notified
- [ ] Security audit scheduled

### Mitigation Measures

- [ ] Increased rate limiting on auth endpoints
- [ ] Enhanced logging for suspicious activity
- [ ] Manual review of authentication attempts
- [ ] Temporary IP allowlisting if needed

### Follow-up Required

- [ ] Root cause analysis within 24 hours
- [ ] Fixed implementation within 48 hours
- [ ] Security team review before next deployment
- [ ] Update security testing procedures
```

### 2. Enhanced Security Monitoring (Temporary)

```bash
# Temporary additional security measures
echo "Implementing temporary security enhancements..."

# 1. Reduce rate limits
export AUTH_RATE_LIMIT=3  # Reduce from 5 to 3 attempts per 15 minutes
export API_RATE_LIMIT=30  # Reduce from 60 to 30 requests per minute

# 2. Enable additional logging
export SECURITY_LOG_LEVEL=debug
export LOG_ALL_REQUESTS=true

# 3. Enable IP monitoring
export ENABLE_IP_TRACKING=true
export SUSPICIOUS_IP_THRESHOLD=50  # requests per hour

# 4. Restart with enhanced security
pm2 restart veritable-games --update-env
```

### 3. Communication Plan

```bash
#!/bin/bash
# notify-stakeholders.sh

STAKEHOLDERS="team@company.com security@company.com ops@company.com"
STATUS_PAGE="https://status.company.com"

send_notifications() {
  local message="$1"
  local priority="$2"

  # Email notifications
  for email in $STAKEHOLDERS; do
    echo "$message" | mail -s "[$priority] CSRF Security Update" $email
  done

  # Slack notification
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{\"text\": \"[$priority] $message\"}"

  # Status page update if needed
  if [[ "$priority" == "CRITICAL" ]]; then
    curl -X POST "$STATUS_PAGE/incidents" \
      -d "title=Security Update&message=$message&status=investigating"
  fi
}

# Send appropriate notification based on rollback type
case "$1" in
  "emergency")
    send_notifications "Emergency CSRF rollback completed. System functional with reduced security. Monitoring closely." "CRITICAL"
    ;;
  "gradual")
    send_notifications "CSRF feature disabled via feature flag. Monitoring performance and security metrics." "WARNING"
    ;;
  "full")
    send_notifications "Full CSRF security revert completed. Enhanced monitoring active. Fix-forward planned." "HIGH"
    ;;
esac
```

## Success Metrics for Re-deployment

Before attempting the fix again, ensure:

- [ ] CSRF failure rate < 0.1% in testing
- [ ] All authentication flows tested automatically
- [ ] Session transition handling verified
- [ ] Performance impact < 5ms additional latency
- [ ] Comprehensive monitoring in place
- [ ] Rollback procedures tested and ready
- [ ] Security team approval obtained
- [ ] Staged deployment plan prepared

This monitoring and rollback strategy ensures we can quickly recover from any issues while maintaining security visibility.
