# Uptime Kuma Monitoring Setup Guide

**Deployment Date**: November 10, 2025
**Status**: ✅ Container running, ready for configuration
**Access URL**: http://192.168.1.15:3001

---

## Quick Start (5 minutes)

### Step 1: Access Uptime Kuma Web Interface
```
URL: http://192.168.1.15:3001
```

On first access, you'll see the setup wizard. Complete these steps:
1. Click "Create your first admin account"
2. Enter Username: `admin`
3. Enter Password: `(create a strong password, save it)`
4. Click "Create"
5. Log in with your credentials

### Step 2: Add First Monitor (Domain)
Once logged in:
1. Click "Add Monitor" (or "+" button)
2. Fill in:
   - **Name**: `Production Domain - HTTPS`
   - **Type**: HTTP(s)
   - **URL**: `https://www.veritablegames.com`
   - **Heartbeat Interval**: 60 (seconds)
   - **Retries**: 3
   - **Expected Status Code**: 200, 307 (both OK for redirects)
3. Click "Save"
4. Monitor should show "UP" status (green) within 1-2 minutes

---

## Complete Monitor Configuration

### Monitor 1: Published Domain (HTTPS)
```
Type: HTTP(s)
URL: https://www.veritablegames.com
Name: Production Domain - HTTPS
Port: 443 (auto)
Heartbeat Interval: 60 seconds
Retries: 3
Expected Status Code: 200, 307
Timeout: 10 seconds
Alert when: Down for 2 minutes
```

**Why**: Detects 502 Bad Gateway errors, SSL issues, domain routing problems.

---

### Monitor 2: Local Network IP (HTTP)
```
Type: HTTP(s)
URL: http://192.168.1.15:3000
Name: Local IP - HTTP
Port: 3000 (auto)
Heartbeat Interval: 60 seconds
Retries: 2
Expected Status Code: 200, 307
Timeout: 10 seconds
Alert when: Down for 1 minute
```

**Why**: Detects container crashes, application failures before they hit domain.

---

### Monitor 3: Application Health Endpoint
```
Type: HTTP(s)
URL: http://192.168.1.15:3000/api/health
Name: Health Check Endpoint
Port: 3000 (auto)
Heartbeat Interval: 30 seconds
Retries: 2
Expected Status Code: 200
Timeout: 5 seconds
Alert when: Down immediately
```

**Why**: Direct application health check (requires `/api/health` endpoint to be implemented).

---

### Monitor 4: PostgreSQL Database
```
Type: PostgreSQL
Host: veritable-games-postgres-new
Port: 5432
Database: veritable_games
Username: postgres
Password: secure_postgres_password
Heartbeat Interval: 60 seconds
Alert when: Connection fails immediately
```

**Why**: Database disconnection detection.

---

### Monitor 5: Docker Container Status
```
Type: Docker Container
Container: m4s0kwo4kc4oooocck4sswc4
Check: Status (must be "running")
Heartbeat Interval: 30 seconds
Alert when: Status != running OR restart count > 5 in 10 minutes
```

**Note**: Requires Docker socket access. May need additional configuration.

---

## Notification Channels Setup

### Option A: Email Notifications (Gmail)

**Step 1**: Go to Settings → Notifications → Add Notification

**Fill in**:
```
Type: Email (SMTP)
SMTP Host: smtp.gmail.com
SMTP Port: 587
Secure (TLS): Yes
Username: your-email@gmail.com
Password: (Gmail app-specific password, NOT your regular password)
From Email: monitoring@yourdomain.com (any value)
```

**How to get Gmail app password**:
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer"
3. Copy the 16-character password
4. Paste into Uptime Kuma

**Test**: Click "Test" button to verify connection works.

---

### Option B: Discord Webhook (Recommended)

**Step 1**: Create Discord webhook in your server
1. Open your Discord server
2. Settings → Integrations → Webhooks
3. "Create Webhook"
4. Copy the Webhook URL

**Step 2**: Add to Uptime Kuma
1. Go to Settings → Notifications → Add Notification
2. Type: Discord
3. Webhook URL: (paste the URL from above)
4. Avatar URL: (optional)
5. Test and save

**Example Webhook URL**:
```
https://discordapp.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz
```

---

### Option C: Generic Webhook

For integrations with Slack, Microsoft Teams, or custom endpoints:

```
Type: Webhook
URL: (your endpoint URL)
HTTP Method: POST
Headers: Content-Type: application/json
Body Template:
{
  "monitor": "{monitor.name}",
  "status": "{status}",
  "message": "{msg}",
  "timestamp": "{heartbeat.time}"
}
```

---

## Alert Rules Configuration

### Rule 1: Critical - Domain Returns 502 Error

**Setting**: When monitor shows RED (down)
```
Monitor: Production Domain - HTTPS
Condition: Down for 2 minutes
Notification: Email + Discord (Immediate)
Message: "🚨 CRITICAL: Production domain returning errors. Check Traefik routing."
```

---

### Rule 2: Critical - Application Container Crashed

**Setting**: When monitor shows RED (down)
```
Monitor: Local IP - HTTP
Condition: Down for 1 minute
Notification: Email + Discord (Immediate)
Message: "🚨 CRITICAL: Application container not responding. Check Docker logs."
```

---

### Rule 3: Warning - Container Restart Loop

**Setting**: When monitor detects multiple restarts
```
Monitor: Docker Container Status
Condition: Restart count > 3 in 10 minutes
Notification: Discord (Medium priority)
Message: "⚠️ WARNING: Container restarting frequently. Check for startup errors."
```

---

### Rule 4: Critical - Database Disconnected

**Setting**: When PostgreSQL monitor fails
```
Monitor: PostgreSQL Database
Condition: Down immediately
Notification: Email + Discord (IMMEDIATE)
Message: "🚨 CRITICAL: Database unreachable. Production data at risk!"
```

---

## Alert Response Checklist

### When you receive a 502 error alert:
- [ ] Check if domain is accessible: `curl -I https://www.veritablegames.com`
- [ ] Check if local IP works: `curl -I http://192.168.1.15:3000`
- [ ] Check Traefik logs: `docker logs traefik | tail -50`
- [ ] Check application logs: `docker logs m4s0kwo4kc4oooocck4sswc4 | tail -50`
- [ ] Check if container is running: `docker ps | grep m4s0k`

### When you receive a "container crashed" alert:
- [ ] Check container status: `docker ps -a | grep m4s0kwo4kc4oooocck4sswc4`
- [ ] Check logs for exit code: `docker logs m4s0kwo4kc4oooocck4sswc4 | tail -50`
- [ ] Check environment variables: `docker inspect m4s0kwo4kc4oooocck4sswc4 | grep -A 50 "Env"`
- [ ] Manually restart if needed: `docker restart m4s0kwo4kc4oooocck4sswc4`

### When you receive a "database disconnected" alert:
- [ ] Check database container: `docker ps | grep postgres`
- [ ] Check database logs: `docker logs veritable-games-postgres-new | tail -20`
- [ ] Check connection from app: `docker exec m4s0kwo4kc4oooocck4sswc4 psql $DATABASE_URL -c "SELECT 1"`
- [ ] Restart database if needed: `docker restart veritable-games-postgres-new`

---

## Dashboard Customization

### Creating a Status Page

**Enable public status page**:
1. Go to Settings → Appearance
2. Toggle "Show public status page" = ON
3. Set page title: "Veritable Games - Service Status"
4. Access public status page: http://192.168.1.15:3001/status

**Use case**: Share with users/stakeholders to show service health

---

### Grouping Monitors

Organize monitors by category:
1. Create groups in Settings
2. Assign monitors to groups:
   - "Production Access" (domain + local IP)
   - "Application Health" (health endpoint)
   - "Infrastructure" (database, containers)
3. Helps when managing many monitors

---

## Maintenance & Troubleshooting

### Backing Up Uptime Kuma Data
```bash
# Backup the database
docker exec uptime-kuma cat /app/data/kuma.db > /tmp/uptime-kuma-backup.db

# Copy to safe location
scp user@192.168.1.15:/tmp/uptime-kuma-backup.db ~/backups/
```

### Updating Uptime Kuma
```bash
# Pull latest image
docker pull louislam/uptime-kuma:latest

# Stop and remove old container
docker stop uptime-kuma
docker rm uptime-kuma

# Redeploy (data persists in volume)
docker run -d \
  --name uptime-kuma \
  --restart unless-stopped \
  --network coolify \
  -p 3001:3001 \
  -v uptime-kuma-data:/app/data \
  louislam/uptime-kuma:latest
```

### Common Issues

**"Cannot connect to monitor"**
- Check firewall rules
- Verify URL is correct
- Check if target service is actually running
- Try telnet: `telnet 192.168.1.15 3000`

**"Notifications not sending"**
- Test notification channel in Settings
- Check SMTP credentials (especially Gmail app password)
- Verify firewall allows outbound SMTP (port 587)
- Check Discord webhook URL is valid

**"Dashboard not loading"**
- Check container is running: `docker ps | grep uptime-kuma`
- Check logs: `docker logs uptime-kuma`
- Try accessing: http://192.168.1.15:3001
- Restart if needed: `docker restart uptime-kuma`

---

## Monitor Status Meanings

| Status | Color | Meaning |
|--------|-------|---------|
| UP | 🟢 Green | Service is responding normally |
| DOWN | 🔴 Red | Service not responding (alert triggered) |
| PAUSE | ⚫ Grey | Monitor paused manually |
| MAINTENANCE | 🟡 Yellow | Maintenance mode (ignore issues) |

---

## Performance Tips

1. **Don't set interval too low**: <30s intervals create high CPU usage
2. **Use appropriate timeout**: 5-10 seconds is standard
3. **Limit retries**: 2-3 retries usually sufficient
4. **Archive old data**: Uptime Kuma auto-archives after 60 days

---

## Security Recommendations

1. **Change admin password**: Use strong password (16+ characters)
2. **Restrict access**: Put behind Traefik with authentication if publicly exposed
3. **Backup regularly**: Export data monthly
4. **Monitor the monitor**: Set up external health checks on Uptime Kuma itself
5. **Use HTTPS for webhook notifications**: Especially for sensitive data

---

## Integration with Existing Monitoring

Once configured, Uptime Kuma provides:
- ✅ HTTP endpoint monitoring (domain + local IP)
- ✅ Database connectivity detection
- ✅ Container health tracking
- ✅ Real-time alerting (Discord/Email)
- ✅ Historical uptime statistics
- ✅ Status page for stakeholders
- ✅ Automatic retry on failures

---

## Next Steps

1. **Access Uptime Kuma**: http://192.168.1.15:3001
2. **Create admin account** with a strong password
3. **Add monitors** following the configuration above
4. **Test notifications** by manually pausing a monitor
5. **Share status page** with your team
6. **Monitor next deployment** to verify `.dockerignore` fix works

---

**Setup Time**: ~30-45 minutes (including notification channel configuration)
**Ongoing Maintenance**: ~5 minutes/week (reviewing alerts, archiving data)

For detailed Uptime Kuma documentation, visit: https://uptime.kuma.pet/
