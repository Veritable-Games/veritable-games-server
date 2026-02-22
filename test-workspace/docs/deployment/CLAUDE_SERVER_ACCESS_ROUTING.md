# Claude Code Server Access & Routing Solution

**Created**: November 2025
**Server**: Veritable Games Production (192.168.1.15)
**Purpose**: Document how Claude Code can access and help manage the Coolify-deployed server

---

## Overview

This document explains how Claude Code can route into your self-hosted Coolify server to help with setup, configuration, troubleshooting, and maintenance tasks.

### Current Server Configuration

- **Server IP**: 192.168.1.15
- **Hostname**: veritable-games-server
- **OS**: Ubuntu Server 22.04.5 LTS
- **User**: `user`
- **SSH**: Enabled (keys from GitHub imported)
- **Coolify Dashboard**: http://192.168.1.15:8000
- **Application**: http://192.168.1.15:3000
- **Network**: Local network (WiFi - wlp4s0)

---

## Routing Methods

### Method 1: Direct SSH Access (Primary)

**How It Works**:
Claude Code can execute SSH commands directly to your server through the Bash tool.

**Prerequisites**:
1. SSH access configured from your local machine to server
2. SSH keys or password authentication set up
3. Server reachable from your local network

**Usage Example**:
```bash
# Execute command on remote server
ssh user@192.168.1.15 "docker ps"

# Interactive session for multiple commands
ssh user@192.168.1.15 << 'EOF'
  docker ps
  cd /var/lib/docker
  df -h
EOF
```

**What I Can Help With**:
- ✅ Check container status
- ✅ View logs from Coolify/application
- ✅ Execute database commands
- ✅ Monitor resource usage
- ✅ Configure environment variables
- ✅ Troubleshoot deployment issues
- ✅ Set up backups
- ✅ Update configurations

**Security**:
- Uses your existing SSH authentication
- Commands logged in shell history
- Requires explicit user permission for each operation

---

### Method 2: Docker Container Access

**How It Works**:
Claude Code can access running Docker containers to manage the application directly.

**Common Containers**:
```bash
# List all containers
ssh user@192.168.1.15 "docker ps"

# Common container patterns in Coolify:
# - Application: coolify-app-[hash]
# - PostgreSQL: coolify-postgres-[hash]
# - Coolify itself: coolify-coolify-1
```

**Usage Examples**:

**Application Container**:
```bash
# Execute commands in app container
ssh user@192.168.1.15 "docker exec -it coolify-app-[hash] bash -c 'cd /app/frontend && npm run db:health'"

# Check application logs
ssh user@192.168.1.15 "docker logs coolify-app-[hash] --tail 100"

# Run database migrations
ssh user@192.168.1.15 "docker exec coolify-app-[hash] bash -c 'cd /app/frontend && node scripts/migrations/migrate-schema.js'"
```

**PostgreSQL Container**:
```bash
# Connect to PostgreSQL
ssh user@192.168.1.15 "docker exec -it coolify-postgres-[hash] psql -U veritablegames_user -d veritablegames"

# Backup database
ssh user@192.168.1.15 "docker exec coolify-postgres-[hash] pg_dump -U veritablegames_user veritablegames > backup.sql"

# Check database size
ssh user@192.168.1.15 "docker exec coolify-postgres-[hash] psql -U veritablegames_user -d veritablegames -c 'SELECT pg_size_pretty(pg_database_size(current_database()));'"
```

**What I Can Help With**:
- ✅ Initialize database schemas
- ✅ Run migrations
- ✅ Check application health
- ✅ Debug errors in real-time
- ✅ Manage environment variables
- ✅ Backup/restore data
- ✅ Performance monitoring

---

### Method 3: Coolify API Access (Advanced)

**How It Works**:
Coolify exposes a REST API that can be used for programmatic management.

**Setup**:
1. Generate API token in Coolify dashboard
2. Use token for authenticated API requests

**Usage Example**:
```bash
# Get application status
ssh user@192.168.1.15 "curl -H 'Authorization: Bearer YOUR_TOKEN' http://localhost:8000/api/applications/[app-id]"

# Trigger deployment
ssh user@192.168.1.15 "curl -X POST -H 'Authorization: Bearer YOUR_TOKEN' http://localhost:8000/api/applications/[app-id]/deploy"
```

**What I Can Help With**:
- ✅ Automated deployments
- ✅ Check deployment status
- ✅ Manage multiple applications
- ✅ Integrate with CI/CD

---

## Practical Use Cases & Examples

### Use Case 1: Initial Database Setup

**Scenario**: After deployment, initialize all 10 database schemas

**Claude Code Can**:
```bash
# Step 1: Find the application container
ssh user@192.168.1.15 "docker ps | grep app"

# Step 2: Run database health check
ssh user@192.168.1.15 "docker exec coolify-app-[hash] bash -c 'cd /app/frontend && npm run db:health'"

# Step 3: Initialize schemas if needed
ssh user@192.168.1.15 "docker exec coolify-app-[hash] bash -c 'cd /app/frontend && node scripts/init-schemas.js'"
```

---

### Use Case 2: Troubleshoot Build Failures

**Scenario**: Deployment fails, need to check logs and diagnose

**Claude Code Can**:
```bash
# Check Coolify deployment logs
ssh user@192.168.1.15 "docker logs coolify-coolify-1 --tail 200"

# Check application container logs
ssh user@192.168.1.15 "docker logs coolify-app-[hash] --tail 100"

# Check resource usage
ssh user@192.168.1.15 "docker stats --no-stream"

# Check disk space
ssh user@192.168.1.15 "df -h"
```

---

### Use Case 3: Environment Variable Configuration

**Scenario**: Need to add or update environment variables

**Claude Code Can**:
```bash
# Method 1: Via Coolify dashboard (manual)
# Navigate to Application → Environment Variables

# Method 2: Via Docker (for debugging)
ssh user@192.168.1.15 "docker exec coolify-app-[hash] printenv | grep DATABASE"

# Method 3: Recreate container with new env vars
# Done through Coolify redeployment
```

---

### Use Case 4: Database Backup & Restore

**Scenario**: Need to backup database before major changes

**Claude Code Can**:
```bash
# Create backup
ssh user@192.168.1.15 << 'EOF'
  mkdir -p /opt/backups
  docker exec coolify-postgres-[hash] pg_dump -U veritablegames_user veritablegames | gzip > /opt/backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz
  ls -lh /opt/backups/
EOF

# Restore from backup
ssh user@192.168.1.15 "gunzip -c /opt/backups/backup_20251102_143000.sql.gz | docker exec -i coolify-postgres-[hash] psql -U veritablegames_user veritablegames"
```

---

### Use Case 5: Monitor Application Health

**Scenario**: Check if everything is running correctly

**Claude Code Can**:
```bash
# Check all services
ssh user@192.168.1.15 << 'EOF'
  echo "=== Docker Containers ==="
  docker ps

  echo -e "\n=== Disk Usage ==="
  df -h

  echo -e "\n=== Memory Usage ==="
  free -h

  echo -e "\n=== Application Health ==="
  curl -s http://localhost:3000/api/health || echo "Health endpoint not available"

  echo -e "\n=== Recent Logs ==="
  docker logs $(docker ps -q -f name=app) --tail 20
EOF
```

---

### Use Case 6: Update Application Configuration

**Scenario**: Need to modify Next.js configuration or package.json

**Claude Code Can**:
```bash
# Access application files (read-only in container)
ssh user@192.168.1.15 "docker exec coolify-app-[hash] cat /app/frontend/package.json"

# To make changes: Update GitHub repo, trigger redeploy
# Coolify will automatically rebuild from updated code
```

---

## Security Considerations

### What I Need From You

1. **Permission for Each Operation**
   - I will ask before executing commands
   - Sensitive operations require explicit approval
   - All commands are visible before execution

2. **SSH Access**
   - You must have SSH access configured
   - I use your existing authentication
   - No separate credentials stored

3. **Container Names**
   - Container names include random hashes
   - You'll need to provide exact names or I'll discover them first

### What I Cannot Do

❌ **Cannot access without your permission**
❌ **Cannot bypass your authentication**
❌ **Cannot access from outside your network** (server is on local network only)
❌ **Cannot modify files directly in running containers** (must redeploy)
❌ **Cannot access Coolify dashboard directly** (web UI only)

### Best Practices

✅ **Always verify commands before execution**
✅ **Use read-only commands first (ps, logs, cat)**
✅ **Test destructive commands in development first**
✅ **Keep backups before major changes**
✅ **Monitor logs after configuration changes**

---

## Quick Command Reference

### Discovery Commands (Safe)
```bash
# List all containers
ssh user@192.168.1.15 "docker ps"

# Show resource usage
ssh user@192.168.1.15 "docker stats --no-stream"

# Check disk space
ssh user@192.168.1.15 "df -h"

# View recent logs
ssh user@192.168.1.15 "docker logs [container] --tail 50"
```

### Application Commands
```bash
# Health check
ssh user@192.168.1.15 "docker exec [app-container] npm run db:health"

# Check environment
ssh user@192.168.1.15 "docker exec [app-container] printenv | grep -E 'NODE_ENV|DATABASE'"

# Application logs
ssh user@192.168.1.15 "docker logs [app-container] --tail 100 -f"
```

### Database Commands
```bash
# List databases
ssh user@192.168.1.15 "docker exec [postgres-container] psql -U veritablegames_user -l"

# Check database size
ssh user@192.168.1.15 "docker exec [postgres-container] psql -U veritablegames_user -c '\l+'"

# Backup
ssh user@192.168.1.15 "docker exec [postgres-container] pg_dump -U veritablegames_user veritablegames > backup.sql"
```

---

## Workflow Example: Complete Setup Session

Here's how a typical setup session would work:

### Session Start
```bash
# 1. Verify connectivity
ssh user@192.168.1.15 "echo 'Connected successfully'"

# 2. Identify containers
ssh user@192.168.1.15 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

# 3. Check application status
ssh user@192.168.1.15 "curl -s http://localhost:3000"
```

### Database Setup
```bash
# 4. Check database connection
ssh user@192.168.1.15 "docker exec coolify-postgres-xyz psql -U veritablegames_user -d veritablegames -c 'SELECT version();'"

# 5. Initialize schemas
ssh user@192.168.1.15 "docker exec coolify-app-abc bash -c 'cd /app/frontend && npm run db:health'"

# 6. Verify all schemas exist
ssh user@192.168.1.15 "docker exec coolify-postgres-xyz psql -U veritablegames_user -c '\dn'"
```

### Environment Configuration
```bash
# 7. Check current environment
ssh user@192.168.1.15 "docker exec coolify-app-abc printenv | grep DATABASE"

# 8. Update via Coolify dashboard (if needed)
# Navigate to: http://192.168.1.15:8000 → Application → Environment Variables

# 9. Redeploy to apply changes
# Click "Redeploy" in Coolify dashboard
```

### Verification
```bash
# 10. Verify deployment
ssh user@192.168.1.15 "docker logs coolify-app-abc --tail 50"

# 11. Test application
ssh user@192.168.1.15 "curl -s http://localhost:3000/api/health"

# 12. Final status check
ssh user@192.168.1.15 << 'EOF'
  echo "=== Deployment Status ==="
  docker ps
  echo -e "\n=== Resources ==="
  docker stats --no-stream
EOF
```

---

## Limitations & Workarounds

### Limitation 1: File Modifications
**Issue**: Cannot directly modify files in running containers
**Workaround**: Update GitHub repository, trigger Coolify redeploy

### Limitation 2: Coolify Dashboard Access
**Issue**: Cannot directly interact with Coolify web UI
**Workaround**: I can guide you through dashboard steps or use Coolify API

### Limitation 3: Container Name Discovery
**Issue**: Container names include random hashes
**Workaround**: Run discovery commands first to identify current names

### Limitation 4: Network Restrictions
**Issue**: Server only accessible from local network (192.168.1.x)
**Workaround**: You must be on same network or have VPN/tunnel configured

---

## Getting Started Checklist

Ready to let me help? Here's what we need:

- [x] Server is running and accessible ✅
- [x] SSH configured from your machine ✅
- [x] Coolify installed and running ✅
- [x] Application deployed (even if not configured) ✅
- [ ] Test SSH access: `ssh user@192.168.1.15 "echo 'Ready!'"`
- [ ] Identify container names: `ssh user@192.168.1.15 "docker ps"`
- [ ] Define what you need help with

---

## Summary

**I can help you with**:
✅ Database initialization and migrations
✅ Environment variable configuration
✅ Log analysis and troubleshooting
✅ Backup and restore operations
✅ Performance monitoring
✅ Health checks and verification
✅ Container management
✅ Configuration updates (via redeploy)

**How we'll work**:
1. You tell me what you need help with
2. I propose specific commands
3. You approve execution
4. I run commands via SSH and report results
5. We iterate until the task is complete

**Start now**: Just tell me what setup tasks you need help with, and I'll guide you through the process using the routing methods documented here!

---

**Created**: November 2025
**Last Updated**: November 2025
**Status**: Active routing solution for Coolify deployment at 192.168.1.15
