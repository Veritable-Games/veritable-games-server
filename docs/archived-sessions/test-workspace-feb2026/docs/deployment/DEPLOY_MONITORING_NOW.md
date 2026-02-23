# 🚀 Production Monitoring Deployment Instructions

**Status**: ✅ Ready for immediate deployment
**Date**: December 29, 2025
**Target**: Production server (192.168.1.15)
**Estimated Time**: 5-10 minutes

---

## 📋 Pre-Deployment Checklist

Before you start, verify:

- [ ] SSH access to production server (192.168.1.15)
- [ ] Application is running: `curl http://192.168.1.15:3000/api/health`
- [ ] git is installed on production server
- [ ] Node.js 20.x is installed
- [ ] npm is available

---

## ⚡ Quick Deployment (5 minutes)

### Option 1: Automated Script (Recommended)

The easiest way to deploy. Run this on the production server:

```bash
# 1. SSH to production
ssh root@192.168.1.15

# 2. Navigate to application directory
cd /home/veritable-games  # or wherever the app is deployed

# 3. Run automated deployment
bash scripts/deploy-monitoring-production.sh
```

**What it does**:
- ✅ Pulls latest code from GitHub
- ✅ Verifies all prerequisites
- ✅ Checks application is running
- ✅ Stops any existing monitoring service
- ✅ Installs dependencies
- ✅ Runs health checks
- ✅ Starts monitoring service in background
- ✅ Verifies service is operational
- ✅ Creates deployment record

**Expected output**:
```
✅ PRODUCTION MONITORING DEPLOYED SUCCESSFULLY
Service running (PID: 12345)
Status server: http://localhost:3030
```

### Option 2: Manual Steps (10 minutes)

Follow the detailed guide in:
```
docs/operations/DEPLOY_MONITORING_TO_PRODUCTION.md
```

10-step process with verification at each stage.

---

## ✅ Verification After Deployment

### 1. Check Service is Running

```bash
ps aux | grep "health-monitor.js"
```

Should show:
```
root      12345  0.0  0.5 XXX XXX Ss 23:30 0:00 node scripts/monitoring/health-monitor.js start
```

### 2. View Status Dashboard

```bash
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
        "status": "healthy"
      }
    },
    "domain": {
      "success": true,
      "status": 307
    }
  },
  "recentAlerts": []
}
```

### 3. Check Application Health

```bash
curl -s http://192.168.1.15:3030/ | jq '.lastChecks.application.health'
```

### 4. View Recent Metrics

```bash
curl -s http://192.168.1.15:3030/metrics | jq '.metrics[-1]'
```

### 5. Check Alert History

```bash
curl -s http://192.168.1.15:3030/alerts | jq '.alerts[-3:]'
```

### 6. Monitor Logs

```bash
tail -50 frontend/logs/monitor.log
```

---

## 🎯 Immediate Actions After Deployment

### 1. Verify Monitoring is Running (< 1 minute)

```bash
# Quick verification
curl -s http://192.168.1.15:3030/status 2>/dev/null && echo "✅ Monitoring active"
```

### 2. Configure Email Alerts (Optional, 2-3 minutes)

1. Set up SMTP credentials in `.env.local`
2. Edit `scripts/monitoring/health-monitor.js` to enable email
3. Restart monitoring

### 3. Set Up Auto-Restart (Optional, 5 minutes)

**Create systemd service** (so monitoring restarts on server reboot):

```bash
sudo bash << 'EOF'
cat > /etc/systemd/system/veritable-games-monitor.service <<'SERVICE'
[Unit]
Description=Veritable Games Production Health Monitor
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/veritable-games/frontend
ExecStart=/usr/bin/npm run monitor:health
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

systemctl enable veritable-games-monitor.service
systemctl start veritable-games-monitor.service
systemctl status veritable-games-monitor.service
EOF
```

---

## 📊 Post-Deployment Monitoring

### View Dashboard

```bash
# Every 30 seconds, refresh status
watch -n 30 'curl -s http://192.168.1.15:3030/ | jq ".lastChecks"'
```

### Monitor Alerts

```bash
# Watch logs in real-time
tail -f frontend/logs/monitor.log

# Or check alerts programmatically
while true; do
  curl -s http://192.168.1.15:3030/alerts | jq '.alerts[-1]'
  sleep 60
done
```

### Check Performance Metrics

```bash
# Get last 10 metrics
curl -s http://192.168.1.15:3030/metrics | jq '.metrics[-10:]'

# Average response time
curl -s http://192.168.1.15:3030/metrics | jq '[.metrics[].application.responseTime] | add/length'
```

---

## 🔧 Troubleshooting

### Monitoring Service Not Starting

```bash
# Check what's wrong
npm run monitor:check

# Check for port conflicts
lsof -i :3030

# Check logs
tail -50 frontend/logs/monitor.log
```

### Status Server Not Responding

```bash
# Verify process is running
ps aux | grep health-monitor.js

# Restart service
npm run monitor:stop
sleep 2
npm run monitor:start
```

### Application Health Endpoint Failing

```bash
# Test health endpoint directly
curl http://192.168.1.15:3000/api/health

# Check if app is running
docker ps | grep veritable-games

# Restart app if needed
docker restart <container-id>
```

See `docs/operations/MONITORING_ALERTS_REFERENCE.md` for detailed troubleshooting.

---

## 📚 Documentation

After deployment, review:

1. **PRODUCTION_MONITORING_SETUP.md** - Complete configuration guide
2. **MONITORING_ALERTS_REFERENCE.md** - Alert types and responses
3. **MONITORING_SETUP_COMPLETE.md** - Architecture and features

---

## 🎯 What Gets Monitored

### Application Metrics (Checked every 5 minutes)
- ✅ Response time (alert if > 1000ms)
- ✅ Memory usage (alert if > 150MB)
- ✅ Database connectivity (alert if disconnected)
- ✅ Uptime/stability
- ✅ API endpoint availability

### Public Domain
- ✅ HTTPS connectivity
- ✅ SSL certificate
- ✅ Response time
- ✅ HTTP status

### Status Endpoints (Real-time, port 3030)
- `GET /` - Current status
- `GET /metrics` - Collected metrics history
- `GET /alerts` - Alert history

---

## 📋 Success Criteria

Deployment is successful when:

✅ Service is running: `ps aux | grep health-monitor.js`
✅ Status server responding: `curl http://localhost:3030/`
✅ Health checks passing: `curl http://localhost:3030/status`
✅ Application healthy: Database connected, no errors
✅ Logs being written: `ls -lh logs/monitor.log`
✅ No critical errors in logs: `grep "ERROR" logs/monitor.log`

---

## 🚀 Running the Deployment

### Step 1: SSH to Production

```bash
ssh root@192.168.1.15
```

### Step 2: Navigate to App Directory

```bash
cd /home/veritable-games  # or your deployment directory
```

### Step 3: Run Deployment

**Automated (Recommended)**:
```bash
bash scripts/deploy-monitoring-production.sh
```

**Or Manual**:
```bash
# Step by step from DEPLOY_MONITORING_TO_PRODUCTION.md
```

### Step 4: Verify

```bash
# Should see output like:
# ✅ Monitoring service started
# ✅ Process ID: 12345
# ✅ Status server responding on http://localhost:3030
```

---

## ⚠️ Important Notes

- **Non-breaking**: This only adds monitoring, doesn't change application code
- **Low risk**: Can be stopped anytime with `npm run monitor:stop`
- **Easy rollback**: Just stop the service, no cleanup needed
- **Background service**: Runs independently of main application
- **Port 3030**: Only needs to be accessible from localhost (or your network)

---

## 📞 Support During Deployment

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review `docs/operations/MONITORING_ALERTS_REFERENCE.md`
3. Check service logs: `tail -f frontend/logs/monitor.log`
4. Verify app is running: `curl http://localhost:3000/api/health`

---

## ✨ What Happens After Deployment

Once running, the monitoring system will:

1. **Every 5 minutes**: Check application health
2. **Every 5 minutes**: Check public domain
3. **Real-time**: Store metrics and alert history
4. **On threshold breach**: Generate alerts (if configured)
5. **Continuously**: Expose status via JSON endpoints on port 3030

You can view the status anytime with:
```bash
curl -s http://192.168.1.15:3030/ | jq '.'
```

---

## 🎉 Summary

**Deployment is ready. Choose your method:**

### Quick (5 min):
```bash
bash scripts/deploy-monitoring-production.sh
```

### Detailed (10 min):
Follow `docs/operations/DEPLOY_MONITORING_TO_PRODUCTION.md`

**Both methods achieve the same result - a fully operational production monitoring system.**

---

**Next Step**: Execute one of the deployment methods above on the production server.

Once deployed, the monitoring system will provide continuous visibility into application health and enable rapid response to any issues.

**Estimated completion**: < 10 minutes
**Risk level**: Low (additive, easily reversible)
**Status**: ✅ Ready for deployment
