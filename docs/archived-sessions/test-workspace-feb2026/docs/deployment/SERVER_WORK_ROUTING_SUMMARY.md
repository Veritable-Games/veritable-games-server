# Server Work & Routing Summary

**Last Updated**: December 7, 2025

---

## Quick Access to Server

### SSH into Server
```bash
ssh user@192.168.1.15
```

### Check Application Status
```bash
ssh user@192.168.1.15 "docker ps | grep -E 'veritable|app'"
```

### View Application Logs
```bash
ssh user@192.168.1.15 "docker logs <container-id> --tail 50"
```

### Access Coolify Dashboard
- **URL**: http://192.168.1.15:8000
- **Purpose**: Deploy, monitor, manage the application

### Access Application Directly
- **URL**: http://192.168.1.15:3000 (local network)
- **URL**: https://www.veritablegames.com (via domain)

---

## Current Server Configuration

| Component | Details |
|-----------|---------|
| **Server IP** | 192.168.1.15 |
| **Hostname** | veritable-games-server |
| **OS** | Ubuntu Server 22.04.5 LTS |
| **SSH User** | `user` |
| **Container Runtime** | Docker + Coolify |
| **Coolify Dashboard** | http://192.168.1.15:8000 |
| **App Port** | 3000 (local) |
| **Domain** | www.veritablegames.com (via Traefik/proxy) |

---

## Routing Architecture

### Network Flow
```
User Browser
    ↓
Domain: www.veritablegames.com (Cloudflare DNS)
    ↓
Server: 192.168.1.15 (Ubuntu Server)
    ↓
Traefik Proxy (reverse proxy)
    ↓
Docker Container (Application - port 3000)
    ↓
Next.js Application + PostgreSQL Database
```

### Traefik Configuration
- **Proxy**: Traefik (managed by Coolify)
- **Host Routing**: Routes `www.veritablegames.com` → application container
- **Health Checks**: `/api/health` endpoint monitored continuously
- **SSL/TLS**: Handled by Traefik + Let's Encrypt

### Direct IP Access
```
Browser → http://192.168.1.15:3000
    ↓
Bypasses Traefik
    ↓
Direct Docker Container Access
```

---

## Recent Server Work

### Issue: 404 on Domain (November 27, 2025)
**Symptom**: www.veritablegames.com returned 404
**Root Cause**: Stale Traefik routing configuration + health check failures
**Resolution**: Redeployment via Coolify UI
**Related Doc**: [SITE_404_INCIDENT_NOVEMBER_27_2025.md](./SITE_404_INCIDENT_NOVEMBER_27_2025.md)

### Issue: Coolify Not Loading (December 7, 2025)
**Symptom**: Coolify dashboard (http://192.168.1.15:8000) unresponsive
**Status**: Investigating
**Related Doc**: [COOLIFY_NOT_LOADING_DIAGNOSTIC_DECEMBER_2025.md](./COOLIFY_NOT_LOADING_DIAGNOSTIC_DECEMBER_2025.md)

---

## Common Server Tasks

### Task 1: Deploy New Code
1. Push code to `main` branch on GitHub
2. Access Coolify at http://192.168.1.15:8000
3. Click "Deploy" on Veritable Games application
4. Wait 2-5 minutes
5. Verify at https://www.veritablegames.com

### Task 2: Check Application Health
```bash
# Via direct IP
curl http://192.168.1.15:3000/api/health

# Via SSH
ssh user@192.168.1.15 "curl http://localhost:3000/api/health"

# Expected response:
# {"status":"healthy","database":{"status":"connected"}}
```

### Task 3: View Application Logs
```bash
# Find container ID
ssh user@192.168.1.15 "docker ps | grep veritable"

# View logs
ssh user@192.168.1.15 "docker logs <container-id> --tail 100"

# Follow logs (live)
ssh user@192.168.1.15 "docker logs <container-id> -f"
```

### Task 4: Access Database
```bash
# Find PostgreSQL container
ssh user@192.168.1.15 "docker ps | grep postgres"

# Connect to database
ssh user@192.168.1.15 "docker exec -it <postgres-container> psql -U veritablegames_user -d veritablegames"

# Example: Check table count
ssh user@192.168.1.15 "docker exec <postgres-container> psql -U veritablegames_user -d veritablegames -c \"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';\""
```

### Task 5: Restart Application
```bash
# Via Coolify UI:
# 1. Navigate to application
# 2. Click "Stop" then "Start"

# Via command line:
ssh user@192.168.1.15 "docker restart <container-id>"
```

### Task 6: View System Resources
```bash
# Disk usage
ssh user@192.168.1.15 "df -h"

# Memory usage
ssh user@192.168.1.15 "free -h"

# Docker statistics
ssh user@192.168.1.15 "docker stats"

# Running containers
ssh user@192.168.1.15 "docker ps"
```

---

## Troubleshooting Guide

**Issue**: Site returns 404 on domain
- See: [TROUBLESHOOTING_QUICKSTART.md](./TROUBLESHOOTING_QUICKSTART.md) - "Site Returns 404 on Domain"
- Quick fix: Redeploy via Coolify

**Issue**: Site returns 502 Bad Gateway
- See: [TROUBLESHOOTING_QUICKSTART.md](./TROUBLESHOOTING_QUICKSTART.md) - "Site Returns 502"
- Quick fix: Check container logs, verify environment variables

**Issue**: Container shows "unhealthy"
- See: [TROUBLESHOOTING_QUICKSTART.md](./TROUBLESHOOTING_QUICKSTART.md) - "Container Shows Unhealthy"
- Quick fix: Test `/api/health` endpoint, restart container

**Issue**: Coolify dashboard not loading
- See: [COOLIFY_NOT_LOADING_DIAGNOSTIC_DECEMBER_2025.md](./COOLIFY_NOT_LOADING_DIAGNOSTIC_DECEMBER_2025.md)
- Quick fix: Run diagnostic commands, check Docker status

---

## Emergency Recovery

If the server is in a critical state:

1. **Check server is reachable**:
   ```bash
   ping 192.168.1.15
   ```

2. **SSH into server**:
   ```bash
   ssh user@192.168.1.15
   ```

3. **Check Docker status**:
   ```bash
   sudo systemctl status docker
   ```

4. **Restart Docker if needed**:
   ```bash
   sudo systemctl restart docker
   ```

5. **Review logs**:
   ```bash
   docker logs coolify-coolify-1
   docker ps -a
   ```

See: [SERVER_RECOVERY_GUIDE.md](./SERVER_RECOVERY_GUIDE.md) for detailed recovery procedures.

---

## Documentation Index

**Deployment & Operations**:
- [DEPLOYMENT_DOCUMENTATION_INDEX.md](./DEPLOYMENT_DOCUMENTATION_INDEX.md) - Master index
- [COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md) - Complete deployment guide
- [CLAUDE_SERVER_ACCESS_ROUTING.md](./CLAUDE_SERVER_ACCESS_ROUTING.md) - How to access server remotely

**Troubleshooting**:
- [TROUBLESHOOTING_QUICKSTART.md](./TROUBLESHOOTING_QUICKSTART.md) - Common issues & quick fixes
- [COOLIFY_NOT_LOADING_DIAGNOSTIC_DECEMBER_2025.md](./COOLIFY_NOT_LOADING_DIAGNOSTIC_DECEMBER_2025.md) - Coolify dashboard issues
- [SERVER_RECOVERY_GUIDE.md](./SERVER_RECOVERY_GUIDE.md) - Emergency recovery

**Recent Incidents**:
- [SITE_404_INCIDENT_NOVEMBER_27_2025.md](./SITE_404_INCIDENT_NOVEMBER_27_2025.md) - 404 errors & resolution

**Infrastructure**:
- [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md) - System design
- [DATABASE_ARCHITECTURE_ANALYSIS_FOR_COOLIFY.md](./DATABASE_ARCHITECTURE_ANALYSIS_FOR_COOLIFY.md) - Database setup
- [DOCKER_NETWORKING_SOLUTIONS.md](./DOCKER_NETWORKING_SOLUTIONS.md) - Docker/Traefik networking
