# Deploy Monitoring Service to Production

**Created**: December 29, 2025
**Status**: Ready for deployment
**Target**: Production server (192.168.1.15)

---

## Prerequisites

Before deploying, ensure:
- ✅ SSH access to production server (192.168.1.15)
- ✅ git is installed on production server
- ✅ Node.js 20.x is installed
- ✅ npm is available
- ✅ Application is running (http://192.168.1.15:3000)

---

## Deployment Steps

### Step 1: SSH to Production Server

```bash
ssh root@192.168.1.15
```

Or if using key-based auth:
```bash
ssh -i /path/to/key root@192.168.1.15
```

### Step 2: Navigate to Application Directory

```bash
cd /home/veritable-games  # or wherever the app is deployed
# OR
cd /root/veritable-games-main  # or current path
```

To find the application directory:
```bash
# Find where Coolify has deployed the app
docker inspect veritable-games-main | grep -i "workdir\|path" | head -5
```

### Step 3: Pull Latest Code

```bash
git pull origin main
```

Expected output:
```
Updating xxxxx..xxxxx
Fast-forward
 frontend/scripts/monitoring/health-monitor.js | 400 insertions(+)
 frontend/scripts/monitoring/start-monitoring-service.sh | 150 insertions(+)
 frontend/.env.monitoring.template | 25 insertions(+)
 docs/operations/PRODUCTION_MONITORING_SETUP.md | 150 insertions(+)
 docs/operations/MONITORING_ALERTS_REFERENCE.md | 200 insertions(+)
 ...
```

### Step 4: Navigate to Frontend Directory

```bash
cd frontend
```

### Step 5: Install/Update Dependencies (if needed)

```bash
npm install
```

### Step 6: Configure Environment

Copy the monitoring template:
```bash
cp .env.monitoring.template .env.local
```

Optional: Edit `.env.local` to configure email alerts:
```bash
nano .env.local
```

Add your email address:
```bash
ALERT_EMAIL=your-email@company.com
```

### Step 7: Start Monitoring Service

```bash
npm run monitor:start
```

You should see:
```
═══════════════════════════════════════════════════════
Veritable Games - Production Monitoring Service Starter
═══════════════════════════════════════════════════════

✅ Node.js v20.x.x
✅ Logs directory: logs/
✅ Monitoring script found

Running health check to verify configuration...

{
  "application": {
    "success": true,
    "health": {
      "status": "healthy",
      ...
    }
  },
  "domain": { ... }
}

Starting monitoring service in background...

✅ Monitoring service started
✅ Process ID: 12345
✅ Logs: logs/monitor.log

✅ Status server responding on http://localhost:3030

Available monitoring endpoints:
  Status:  curl -s http://localhost:3030/ | jq '.'
  Metrics: curl -s http://localhost:3030/metrics | jq '.'
  Alerts:  curl -s http://localhost:3030/alerts | jq '.'
```

### Step 8: Verify Deployment

Check that monitoring is running:
```bash
ps aux | grep "health-monitor.js"
```

Check logs:
```bash
tail logs/monitor.log
```

Expected:
```
[2025-12-29T23:30:45.123Z] ✅: Starting production health monitoring
[2025-12-29T23:30:45.456Z] INFO: Check interval: 300s
[2025-12-29T23:30:45.789Z] INFO: Status server listening on http://0.0.0.0:3030
[2025-12-29T23:30:50.000Z] INFO: Running health checks...
```

### Step 9: Test Status Endpoints

On the production server:
```bash
# Local test
curl -s http://localhost:3030/ | jq '.'

# Or from another machine
curl -s http://192.168.1.15:3030/ | jq '.'
```

Expected response:
```json
{
  "status": "running",
  "uptime": 120,
  "lastChecks": {
    "application": {
      "success": true,
      "health": {
        "status": "healthy",
        ...
      }
    },
    "domain": {
      "success": true,
      "status": 307,
      ...
    }
  },
  "recentAlerts": [],
  "config": {
    "checkInterval": 300,
    "thresholds": { ... }
  }
}
```

### Step 10: Configure Auto-Restart (Optional but Recommended)

#### Option A: Systemd Service (Recommended)

Create `/etc/systemd/system/veritable-games-monitor.service`:

```bash
sudo nano /etc/systemd/system/veritable-games-monitor.service
```

Copy this content:
```ini
[Unit]
Description=Veritable Games Production Health Monitor
After=network.target
Wants=veritable-games.service

[Service]
Type=simple
User=root
WorkingDirectory=/home/veritable-games/frontend
ExecStart=/usr/bin/npm run monitor:health
Restart=always
RestartSec=10
StandardOutput=append:/var/log/veritable-games-monitor.log
StandardError=append:/var/log/veritable-games-monitor.log

[Install]
WantedBy=multi-user.target
```

Enable the service:
```bash
sudo systemctl enable veritable-games-monitor.service
sudo systemctl start veritable-games-monitor.service
sudo systemctl status veritable-games-monitor.service
```

Check logs:
```bash
journalctl -u veritable-games-monitor.service -f
```

#### Option B: Docker Integration

If using Docker, add to docker-compose or Coolify webhook:

```yaml
services:
  app:
    # ... existing config

  monitor:
    image: node:20
    working_dir: /app/frontend
    volumes:
      - ./:/app
    environment:
      - ALERT_EMAIL=${ALERT_EMAIL}
    command: npm run monitor:health
    restart: always
    depends_on:
      - app
```

---

## Monitoring Commands (On Production Server)

### View Current Status
```bash
curl -s http://localhost:3030/ | jq '.'
```

### View Metrics
```bash
curl -s http://localhost:3030/metrics | jq '.metrics[0:5]'  # First 5 metrics
```

### View Alerts
```bash
curl -s http://localhost:3030/alerts | jq '.alerts[-5:]'  # Last 5 alerts
```

### View Real-Time Logs
```bash
tail -f frontend/logs/monitor.log
```

### Search Logs for Errors
```bash
grep "ERROR\|CRITICAL" frontend/logs/monitor.log
```

### Stop Monitoring
```bash
npm run monitor:stop
```

### Restart Monitoring
```bash
npm run monitor:stop
sleep 2
npm run monitor:start
```

---

## Remote Monitoring (From Your Machine)

### Query Production Monitoring Status

```bash
# View dashboard
curl -s http://192.168.1.15:3030/ | jq '.'

# View metrics
curl -s http://192.168.1.15:3030/metrics | jq '.'

# View alerts
curl -s http://192.168.1.15:3030/alerts | jq '.'

# Check application health directly
curl -s http://192.168.1.15:3000/api/health | jq '.'
```

### Create a Local Monitoring Script

Save as `check-production.sh`:

```bash
#!/bin/bash

echo "=== Veritable Games Production Status ==="
echo ""

echo "Health Status:"
curl -s http://192.168.1.15:3030/ | jq '.lastChecks'

echo ""
echo "Recent Alerts:"
curl -s http://192.168.1.15:3030/alerts | jq '.alerts[-3:]'

echo ""
echo "Container Status:"
docker ps | grep veritable-games
```

Run:
```bash
bash check-production.sh
```

---

## Verification Checklist

After deployment, verify:

- [ ] Monitoring service is running: `ps aux | grep health-monitor`
- [ ] Status server responding: `curl -s http://localhost:3030/`
- [ ] Health checks passing: `curl -s http://192.168.1.15:3030/ | jq '.lastChecks.application.success'`
- [ ] Database connected: `curl -s http://192.168.1.15:3030/ | jq '.lastChecks.application.health.database.status'`
- [ ] Domain accessible: `curl -s http://192.168.1.15:3030/ | jq '.lastChecks.domain.success'`
- [ ] Logs being written: `ls -lh frontend/logs/monitor.log`
- [ ] No errors in logs: `grep "ERROR" frontend/logs/monitor.log | wc -l`

---

## Troubleshooting

### Error: "Cannot connect to health endpoint"

```bash
# Check if application is running
curl http://192.168.1.15:3000/api/health

# Check if port 3000 is open
netstat -tulpn | grep 3000

# Restart application
docker restart <container-id>
```

### Error: "Permission denied" on logs

```bash
mkdir -p frontend/logs
chmod 755 frontend/logs
npm run monitor:start
```

### Monitoring service not starting

```bash
# Check for port conflicts
netstat -tulpn | grep 3030

# Check logs
tail -50 frontend/logs/monitor.log

# Run health check directly
npm run monitor:check
```

### Status server not responding

```bash
# Check if process is still running
ps aux | grep health-monitor

# Restart monitoring
npm run monitor:stop
npm run monitor:start

# Check if port is being used
lsof -i :3030
```

---

## Post-Deployment Configuration

### Configure Email Alerts (Optional)

1. Edit `.env.local`:
   ```bash
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USER=your-email@gmail.com
   MAIL_PASS=your-app-password
   ```
2. Edit `scripts/monitoring/health-monitor.js`:
   ```javascript
   features: {
     emailAlerts: true,  // Change to true
     // ...
   }
   ```
3. Restart monitoring

---

## Documentation Reference

- **Setup Guide**: docs/operations/PRODUCTION_MONITORING_SETUP.md
- **Alert Handling**: docs/operations/MONITORING_ALERTS_REFERENCE.md
- **Deployment Summary**: docs/operations/MONITORING_SETUP_COMPLETE.md
- **Alert Reference**: docs/deployment/PRODUCTION_SMOKE_TEST_DECEMBER_29_2025.md

---

## Support

For issues or questions:

1. Check monitoring logs: `tail -f frontend/logs/monitor.log`
2. Review documentation in `docs/operations/`
3. Test health endpoint: `curl http://localhost:3000/api/health`
4. Verify status server: `curl http://localhost:3030/`

---

## Deployment Confirmation

Once deployed, you should see:

✅ Monitoring service running in background
✅ Status server responding on port 3030
✅ Health checks running every 5 minutes
✅ Logs being written to `frontend/logs/monitor.log`
✅ Alert system ready for Slack/email configuration
✅ Dashboard accessible at http://192.168.1.15:3030/

**Deployment Status**: Ready to execute
**Estimated Time**: 5-10 minutes
**Risk Level**: Low (additive, no changes to core app)

---

**Next Step**: Execute the deployment steps on the production server (192.168.1.15)
