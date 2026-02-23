# Coolify 502 Bad Gateway Troubleshooting Guide

**Date Created**: 2026-02-12
**Scenario**: Coolify web interface shows 502 error while main website remains live

---

## Symptom Overview

```
❌ Coolify Interface: 502 Bad Gateway at coolify.veritablegames.com
✅ Main Website: Live and accessible at www.veritablegames.com
❌ SSH Access: Cannot connect to 192.168.1.15 (No route to host)
❌ WireGuard VPN: Interface not active on diagnostic machine
```

### Error Details
```
Bad gateway Error code 502
Host: coolify.veritablegames.com
Via: Cloudflare

What happened?
The web server reported a bad gateway error.
```

---

## Key Diagnostic Questions

### 1. Is the Server Actually Down?
**NO** - If the main website (www.veritablegames.com) is still accessible and responding normally, the server is running.

**Key Insight**: The application container is healthy, but either:
- The Coolify container has crashed
- There's a network routing issue
- The diagnostic machine is on a different network

### 2. Where Are You Connecting From?
**Critical**: The inability to reach 192.168.1.15 suggests:
- **Diagnostic machine is NOT on the same local network** as the production server
- **WireGuard VPN is not active** on the diagnostic machine
- **Need to use WireGuard VPN** to access server remotely

### 3. Which Services Use Which Networks?

| Service | Network Path | Notes |
|---------|-------------|-------|
| **www.veritablegames.com** | Cloudflare Tunnel → Server | Always accessible if server is up |
| **coolify.veritablegames.com** | Cloudflare → Coolify container | Requires Coolify container running |
| **SSH (192.168.1.15)** | Local network only | Only accessible from same LAN |
| **SSH (10.100.0.1)** | WireGuard VPN required | Requires active VPN connection |

---

## Diagnosis Steps

### Step 1: Verify Main Website is Actually Live
```bash
curl -I https://www.veritablegames.com
# Should return: HTTP/2 200
```

**If website is down**: Server is actually offline, proceed to physical access troubleshooting.

**If website is up**: Continue to Step 2.

### Step 2: Determine Your Network Location
```bash
# Check if you're on the same local network as server
ping -c 2 192.168.1.15

# Check if WireGuard VPN is active
ip addr show wg0

# Check your current network
ip route | grep default
```

**Results interpretation**:
- `192.168.1.15` reachable → You're on same LAN, server has network issue
- `192.168.1.15` unreachable + no wg0 → You're remote, need VPN
- `wg0` interface exists → VPN active, use `ssh user@10.100.0.1`

### Step 3: Check Coolify Container Status

**If on local network**:
```bash
ssh user@192.168.1.15 "docker ps --filter 'name=coolify' --format '{{.Names}}\t{{.Status}}'"
```

**If using WireGuard VPN**:
```bash
# First, activate WireGuard (see CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)
sudo wg-quick up wg0

# Then connect via VPN IP
ssh user@10.100.0.1 "docker ps --filter 'name=coolify' --format '{{.Names}}\t{{.Status}}'"
```

**Expected results**:
- `coolify-coolify-1` or similar - Container exists and should show status
- If no output: Container is down

### Step 4: Check All Containers
```bash
ssh user@[IP] "docker ps --format '{{.Names}}\t{{.Status}}' | head -20"
```

**Look for**:
- Application container (m4s0kwo4kc4oooocck4sswc4) - Should be "Up"
- Coolify container (coolify-*) - May be "Exited" or missing

### Step 5: Check Docker Logs
```bash
# Check Coolify logs
ssh user@[IP] "docker logs coolify-coolify-1 --tail 100"

# Check if container exists but stopped
ssh user@[IP] "docker ps -a --filter 'name=coolify'"
```

---

## Resolution Steps

### If Coolify Container is Down

**Restart Coolify stack**:
```bash
ssh user@[IP] "cd /data/coolify/source && docker compose up -d"
```

**If that fails, check disk space**:
```bash
ssh user@[IP] "df -h"
# If /data partition is full, need to clean up
```

### If Server is Truly Unreachable

**You're probably not on the correct network**:

1. **Are you in the same building as the server?**
   - YES → Check if you're on the same WiFi/LAN
   - NO → You need WireGuard VPN

2. **Activate WireGuard VPN**:
   ```bash
   sudo wg-quick up wg0
   # Verify: ip addr show wg0
   # Should show: inet 10.100.0.2/24
   ```

3. **Connect via VPN**:
   ```bash
   ssh user@10.100.0.1
   ```

### If Website is Also Down (Actual Outage)

**Physical access required**:
1. Check server power (lights, fans)
2. Check network cable connection
3. Connect monitor/keyboard directly
4. Check system logs: `journalctl -xe`
5. Restart server if needed: `sudo reboot`

---

## Common Causes

### 1. Coolify Container OOM (Out of Memory)
```bash
# Check if Coolify was killed
ssh user@[IP] "docker inspect coolify-coolify-1 | grep -A 5 'OOMKilled'"
```

**Fix**: Restart container
```bash
ssh user@[IP] "docker restart coolify-coolify-1"
```

### 2. Disk Space Full
```bash
ssh user@[IP] "df -h /data"
# If >95% full, clean up
```

**Fix**: Clean up Docker resources
```bash
ssh user@[IP] "docker system prune -af --volumes"
```

### 3. Coolify Database Corruption
```bash
# Check Coolify database container
ssh user@[IP] "docker logs coolify-postgres-1 --tail 50"
```

### 4. Network Split Brain
- Application uses Cloudflare Tunnel (always accessible)
- Coolify uses direct connection (requires local network or VPN)
- If routing changes, Coolify may become inaccessible while app stays up

### 5. Cloudflare DNS/Proxy Issue
```bash
# Check if Coolify domain resolves
dig coolify.veritablegames.com

# Check if proxied through Cloudflare
dig coolify.veritablegames.com +short
# If returns Cloudflare IPs, it's proxied
```

---

## Prevention

### Monitoring
```bash
# Add health check for Coolify
curl -f http://192.168.1.15:8000/api/health || echo "Coolify down"
```

### Resource Limits
Ensure Coolify has sufficient resources in docker-compose.yml:
```yaml
services:
  coolify:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

### Automatic Restart
Ensure Coolify has restart policy:
```yaml
services:
  coolify:
    restart: unless-stopped
```

---

## Network Troubleshooting Matrix

| Symptom | Local Network Test | VPN Status | Likely Cause |
|---------|-------------------|------------|--------------|
| Website up, Coolify 502, SSH fails | `ping 192.168.1.15` fails | wg0 down | You're remote, need VPN |
| Website up, Coolify 502, SSH works | `ping 192.168.1.15` succeeds | N/A | Coolify container down |
| Website down, Coolify 502, SSH fails | `ping 192.168.1.15` fails | wg0 down | Server actually down OR need VPN |
| Website down, Coolify down, SSH works | `ping 192.168.1.15` succeeds | N/A | Docker daemon issue |

---

## Quick Reference Commands

```bash
# Check if you need VPN
ping -c 2 192.168.1.15 && echo "Local network OK" || echo "Need VPN"

# Activate VPN
sudo wg-quick up wg0

# SSH via VPN
ssh user@10.100.0.1

# Check Coolify
ssh user@10.100.0.1 "docker ps | grep coolify"

# Restart Coolify
ssh user@10.100.0.1 "docker restart coolify-coolify-1"

# Check all containers
ssh user@10.100.0.1 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

# Check disk space
ssh user@10.100.0.1 "df -h"

# Check memory
ssh user@10.100.0.1 "free -h"
```

---

## Related Documentation

- [CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md) - Complete access setup
- [SYSTEM_ARCHITECTURE_AND_DEPLOYMENT_WORKFLOW.md](./SYSTEM_ARCHITECTURE_AND_DEPLOYMENT_WORKFLOW.md) - Infrastructure overview
- [docs/guides/MACHINE_IDENTIFICATION.md](../guides/MACHINE_IDENTIFICATION.md) - Network topology

---

## Notes from Incident: 2026-02-12

**Observed**:
- Coolify showed 502 at coolify.veritablegames.com
- Main site (www.veritablegames.com) was fully functional
- SSH to 192.168.1.15 failed with "No route to host"
- WireGuard VPN not active on diagnostic machine

**Diagnosis**:
- Server was actually online (website proved this)
- Diagnostic machine was not on same local network as server
- Needed to use WireGuard VPN to access server

**Resolution**:
- User confirmed website was live
- Issue was network access, not server down
- Documented this edge case for future reference

**Key Lesson**: Always check if main website is accessible before assuming server is down. The 502 on Coolify may be a Coolify-specific issue or network access issue, not a full server outage.
