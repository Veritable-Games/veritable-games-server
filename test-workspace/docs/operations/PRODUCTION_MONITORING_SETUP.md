# Production Health Monitoring Setup Guide

**Last Updated**: December 29, 2025
**Status**: ✅ Ready for deployment

---

## Overview

The production health monitoring system continuously tracks critical application metrics and sends alerts when thresholds are exceeded. This guide covers setup, configuration, deployment, and troubleshooting.

### Key Features

- ✅ **Continuous Monitoring**: Checks application health every 5 minutes
- ✅ **Multi-channel Alerting**: Email and file logging
- ✅ **Metrics Dashboard**: Real-time status endpoints on port 3030
- ✅ **Alert History**: Persistent storage of all alerts with timestamps
- ✅ **Threshold-based**: Configurable thresholds for response time, memory, database
- ✅ **Production Ready**: Full error handling, logging, graceful shutdown

---

## Quick Start

### 1. Deploy Monitoring Script

The monitoring script is already created at:
```
frontend/scripts/monitoring/health-monitor.js
```

### 2. Start Monitoring Service

**On Production Server (192.168.1.15)**:

```bash
# SSH to production server
ssh root@192.168.1.15

# Navigate to application
cd /path/to/veritable-games-main/frontend

# Start continuous monitoring (runs indefinitely)
npm run monitor:health

# OR run single health check
npm run monitor:check
```

### 3. View Monitoring Status

**Local Machine**:
```bash
# Current status
curl -s http://192.168.1.15:3030/ | jq '.'

# Recent metrics (last 100)
curl -s http://192.168.1.15:3030/metrics | jq '.'

# Alert history
curl -s http://192.168.1.15:3030/alerts | jq '.'
```

---

## Configuration

### Environment Variables

Create `.env.local` in `frontend/` directory with:

```bash
# Alert Email (optional)
ALERT_EMAIL=admin@veritablegames.com

# Custom Log File Location (optional)
MONITOR_LOG_FILE=/var/log/veritable-games-monitor.log
```

### Health Check Thresholds

Edit `frontend/scripts/monitoring/health-monitor.js` to modify thresholds:

```javascript
const CONFIG = {
  checkInterval: 300,  // Check every 5 minutes (in seconds)

  thresholds: {
    responseTime: 1000,    // Alert if response > 1000ms
    memoryUsage: 150,      // Alert if memory > 150MB
    memoryPercent: 85,     // Alert if memory > 85% of allocation
    databaseLatency: 500,   // Alert if database response > 500ms
    apiErrorRate: 5,       // Alert if error rate > 5%
  },

  features: {
    emailAlerts: false,    // Set to true to enable email alerts
    fileLogging: true,     // Enable file logging
    consoleLogging: true,  // Enable console logging
  }
};
```

---

## Alert Severity Levels

### 🔴 Critical Alerts

Sent immediately when critical services fail:

- **Application Health**: Health endpoint not responding
- **Database Connection**: PostgreSQL not connected
- **Domain Availability**: Public domain not responding

**Response**: Check logs, restart container, verify database connectivity

### 🟡 Warning Alerts

Sent when performance degrades:

- **Response Time**: API response > 1000ms
- **Memory Usage**: > 150MB
- **Domain Latency**: Response > 5000ms

**Response**: Monitor closely, check for memory leaks, consider scaling

### ℹ️ Info Alerts

Logged but not escalated:

- **Health Check Success**: Normal operations
- **Metrics**: Periodic stats collection

**Response**: No action needed, for historical analysis

---

## Email Integration Setup

### 1. Configure Mail Server

The monitoring system supports SMTP mail sending. Set environment variables:

```bash
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password
MAIL_FROM=alerts@veritablegames.com
```

### 2. Enable Email Alerts

Edit `health-monitor.js`:

```javascript
features: {
  emailAlerts: true,  // Enable email notifications
  // ... rest of config
}
```

### 3. Verify Configuration

Test with:
```bash
npm run monitor:check
```

---

## Monitoring Dashboard

### Status Server Endpoints

The monitoring script exposes a status server on port 3030 with three JSON endpoints:

#### Current Status
```bash
GET http://192.168.1.15:3030/

Response:
{
  "status": "running",
  "uptime": 3600,  // seconds
  "lastChecks": {
    "application": { ... },
    "domain": { ... }
  },
  "recentAlerts": [
    {
      "timestamp": "2025-12-29T23:30:00.000Z",
      "type": "Response Time",
      "severity": "warning",
      "message": "API response slow: 1250ms"
    }
  ],
  "config": {
    "checkInterval": 300,
    "thresholds": { ... }
  }
}
```

#### Metrics History
```bash
GET http://192.168.1.15:3030/metrics

Response:
{
  "metrics": [
    {
      "timestamp": "2025-12-29T23:25:00.000Z",
      "application": { ... },
      "domain": { ... }
    },
    // ... (up to 100 most recent)
  ],
  "count": 1000  // total metrics collected
}
```

#### Alert History
```bash
GET http://192.168.1.15:3030/alerts

Response:
{
  "alerts": [
    {
      "timestamp": "2025-12-29T23:30:00.000Z",
      "type": "Database Connection",
      "severity": "critical",
      "message": "Database not connected",
      "details": { ... }
    },
    // ... all alerts in order
  ],
  "count": 45  // total alerts
}
```

### Creating a Custom Dashboard

You can create a web-based dashboard by querying these endpoints:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Veritable Games Monitoring</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .status { padding: 20px; border-radius: 8px; margin: 10px 0; }
    .healthy { background: #d4edda; border: 1px solid #28a745; }
    .warning { background: #fff3cd; border: 1px solid #ffc107; }
    .critical { background: #f8d7da; border: 1px solid #dc3545; }
  </style>
</head>
<body>
  <h1>Veritable Games Monitoring Dashboard</h1>

  <div id="status" class="status"></div>
  <div id="alerts" class="status"></div>

  <script>
    async function updateDashboard() {
      // Fetch status
      const statusRes = await fetch('http://192.168.1.15:3030/');
      const status = await statusRes.json();

      // Fetch alerts
      const alertsRes = await fetch('http://192.168.1.15:3030/alerts');
      const alerts = await alertsRes.json();

      // Render status
      const statusDiv = document.getElementById('status');
      const appHealth = status.lastChecks.application;
      statusDiv.className = `status ${appHealth.success ? 'healthy' : 'critical'}`;
      statusDiv.innerHTML = `
        <h2>Status: ${appHealth.success ? '✅ Healthy' : '❌ Down'}</h2>
        <p>Uptime: ${Math.floor(status.uptime / 60)} minutes</p>
        <p>Response Time: ${appHealth.responseTime}ms</p>
        <p>Database: ${appHealth.health.database.status}</p>
      `;

      // Render recent alerts
      const alertsDiv = document.getElementById('alerts');
      const recentAlerts = alerts.alerts.slice(-5);
      alertsDiv.innerHTML = `<h2>Recent Alerts (${alerts.count} total)</h2>
        ${recentAlerts.map(a => `
          <div class="status ${a.severity === 'critical' ? 'critical' : 'warning'}">
            <strong>${a.type}:</strong> ${a.message}
            <br><small>${a.timestamp}</small>
          </div>
        `).join('')}
      `;
    }

    updateDashboard();
    setInterval(updateDashboard, 30000);  // Refresh every 30 seconds
  </script>
</body>
</html>
```

---

## Running Monitoring in Production

### Option 1: Direct Process (Development Testing)

```bash
npm run monitor:health
```

**Pros**: Simple, direct output
**Cons**: Stops when terminal closes

### Option 2: Background Service (Recommended for Production)

```bash
# Start in background
nohup npm run monitor:health > frontend/logs/monitor.log 2>&1 &

# Check status
ps aux | grep "health-monitor.js"

# Stop service
pkill -f "health-monitor.js"
```

### Option 3: Systemd Service (Linux)

Create `/etc/systemd/system/veritable-games-monitor.service`:

```ini
[Unit]
Description=Veritable Games Production Health Monitor
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/user/Projects/veritable-games-main/frontend
ExecStart=/usr/bin/npm run monitor:health
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable veritable-games-monitor.service
sudo systemctl start veritable-games-monitor.service
sudo systemctl status veritable-games-monitor.service
```

### Option 4: Docker Container Integration

Add monitoring to docker-compose or Coolify:

```yaml
version: '3.8'
services:
  app:
    # ... existing app config

  monitor:
    image: node:20
    working_dir: /app
    volumes:
      - ./:/app
    environment:
      - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
      - ALERT_EMAIL=${ALERT_EMAIL}
    command: npm run monitor:health
    networks:
      - app-network
    depends_on:
      - app
```

---

## Viewing Logs

### Log File Location

By default: `frontend/logs/monitor.log`

### View Last 50 Lines

```bash
tail -50 frontend/logs/monitor.log
```

### Watch Logs in Real-Time

```bash
tail -f frontend/logs/monitor.log
```

### Search Logs for Errors

```bash
grep "ERROR\|CRITICAL\|WARN" frontend/logs/monitor.log

# With timestamps
grep -E "ERROR|CRITICAL" frontend/logs/monitor.log | head -20
```

### Log Format

Each log entry contains:
```
[2025-12-29T23:30:45.123Z] LEVEL: Message
```

- `[timestamp]`: ISO 8601 timestamp
- `LEVEL`: INFO, WARN, ERROR, or ✅ (success)
- `Message`: Log message with context

---

## Troubleshooting

### Issue: "Cannot connect to health endpoint"

**Cause**: Application not running or health endpoint not exposed

**Solution**:
```bash
# Check if app is running
curl http://192.168.1.15:3000/api/health

# Check if port 3000 is open
netstat -tulpn | grep 3000

# Restart application
docker restart <container-id>
```

### Issue: "Permission denied" on log file

**Cause**: Log directory doesn't have write permissions

**Solution**:
```bash
# Create logs directory
mkdir -p frontend/logs
chmod 755 frontend/logs

# Run monitoring again
npm run monitor:health
```

### Issue: "Slack webhook failed"

**Cause**: Invalid webhook URL or network issue

**Solution**:
```bash
# Verify webhook URL
echo $SLACK_WEBHOOK_URL

# Test webhook manually
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test alert"}' \
  $SLACK_WEBHOOK_URL

# Check network connectivity
curl -I https://hooks.slack.com
```

### Issue: High memory usage alerts

**Cause**: Memory leak in application

**Solution**:
```bash
# Check memory in container
docker stats <container-id>

# Review application logs for errors
docker logs <container-id> | grep -i error

# Restart container
docker restart <container-id>
```

---

## Performance Targets

### Response Times

- **Excellent**: < 100ms
- **Good**: 100-500ms
- **Acceptable**: 500-1000ms
- **Warning**: > 1000ms

### Memory Usage

- **Excellent**: < 100MB
- **Good**: 100-150MB
- **Acceptable**: 150-200MB
- **Warning**: > 200MB

### Database Latency

- **Excellent**: < 50ms
- **Good**: 50-100ms
- **Acceptable**: 100-500ms
- **Warning**: > 500ms

---

## Alerting Strategy

### Critical Alerts → Immediate Action

- Page on-call engineer immediately
- Open incident tracking
- Disable auto-recovery if in safe state

### Warning Alerts → Investigation

- Log alert with context
- Monitor for patterns
- Schedule investigation within 4 hours

### Info Alerts → Historical Analysis

- Collect metrics
- Identify trends
- Use for capacity planning

---

## Next Steps

1. ✅ Deploy monitoring script to production
2. ⏳ Configure Slack webhook URL in .env.local
3. ⏳ Start monitoring service: `npm run monitor:health`
4. ⏳ Create monitoring dashboard (see sample HTML above)
5. ⏳ Test Slack alerts with manual trigger
6. ⏳ Add systemd service for auto-restart
7. ⏳ Document alert response procedures

---

## Support & Debugging

For detailed health check output:
```bash
npm run monitor:check
```

For status dashboard data:
```bash
curl -s http://192.168.1.15:3030/ | jq '.lastChecks'
```

For comprehensive logs:
```bash
grep -A 5 "CRITICAL\|ERROR" frontend/logs/monitor.log
```

---

**Status**: Production monitoring system ready for deployment
**Version**: 1.0.0
**Last Updated**: December 29, 2025
