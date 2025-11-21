# Server Maintenance Scripts

**Location**: `/home/user/wireguard-backups/`
**Created**: November 15, 2025
**Purpose**: Automated health checks and backups for VPN and Coolify infrastructure

---

## Available Scripts

### 1. verify-wg-tunnel.sh

**Purpose**: Verify WireGuard VPN tunnel is operational

**Usage**:
```bash
bash /home/user/wireguard-backups/verify-wg-tunnel.sh
```

**Checks**:
- WireGuard interface exists (wg0)
- Peer configuration present
- Recent handshake (<3 minutes)
- Ping test to remote peer
- SSH connectivity test

**Output**:
```
=== WireGuard Tunnel Verification ===

✅ Interface wg0 exists
✅ WireGuard running on wg0
✅ Peer configured (1 peer)
✅ Recent handshake: 45s ago

Testing connectivity to laptop (10.100.0.2)...
✅ Ping successful (0% packet loss)
⚠️  SSH not accessible (may need key authorization)

=== ✅ WireGuard tunnel fully operational ===
```

**Recommended**: Run weekly or after any network changes

---

### 2. backup-wg-config.sh

**Purpose**: Backup WireGuard configuration and status

**Usage**:
```bash
bash /home/user/wireguard-backups/backup-wg-config.sh
```

**Backs up**:
- `/etc/wireguard/wg0.conf` → `wg0.conf.YYYYMMDD_HHMMSS`
- `wg show wg0` output → `wg0-status.YYYYMMDD_HHMMSS.txt`

**Output**:
```
=== WireGuard Configuration Backup ===
Timestamp: 20251115_192749

Backing up SERVER configuration...
✅ Config: /home/user/wireguard-backups/wg0.conf.20251115_192749
✅ Status: /home/user/wireguard-backups/wg0-status.20251115_192749.txt

✅ WireGuard config backed up to /home/user/wireguard-backups
```

**Recommended**: Run monthly or before any WireGuard changes

---

### 3. coolify-diagnostic.sh

**Purpose**: Comprehensive Coolify health check and diagnostics

**Usage**:
```bash
bash /home/user/wireguard-backups/coolify-diagnostic.sh
```

**Checks**:
- Container health (all 6 Coolify containers)
- Empty environment variables (corrupted data)
- Recent unserialize errors (Laravel issues)
- Cache status (bootstrap + views)
- Database connection
- Application configuration
- Disk space usage
- Recent deployment status

**Output**:
```
=== Coolify Diagnostic Report ===
Generated: Sat Nov 15 07:53:26 PM UTC 2025

1. Container Health:
   coolify-sentinel: Up 53 minutes (healthy)
   coolify: Up 2 hours (healthy)
   coolify-realtime: Up 18 hours (healthy)
   coolify-db: Up 18 hours (healthy)
   coolify-redis: Up 18 hours (healthy)
   coolify-proxy: Up 18 hours (healthy)

2. Empty Environment Variables:
   Count:      0

3. Recent Unserialize Errors (last 24 hours):
   Total unserialize errors: 0

4. Laravel Cache Status:
   Bootstrap cache: 36.0K
   View cache: 28.0K

5. Database Connection:
   ✅ Database OK

6. Application Configuration:
   Application found: Yes
   Environment variables:     42

7. Disk Space:
   Filesystem                Size      Used Available Use% Mounted on
   overlay                 937.8G    593.5G    296.6G  67% /

8. Recent Deployment Status:

=== Recommendations ===
(none - all systems healthy)

=== Diagnostic Complete ===
```

**Recommended**: Run weekly or when troubleshooting Coolify issues

---

## Maintenance Schedule

### Weekly
```bash
# WireGuard health check
bash /home/user/wireguard-backups/verify-wg-tunnel.sh

# Coolify diagnostic
bash /home/user/wireguard-backups/coolify-diagnostic.sh
```

### Monthly
```bash
# Backup WireGuard config
bash /home/user/wireguard-backups/backup-wg-config.sh

# Clear Coolify caches
docker exec coolify php artisan optimize:clear

# PostgreSQL backup
docker exec veritable-games-postgres pg_dumpall -U postgres > /home/user/backups/postgres-$(date +%Y%m%d).sql
```

### After Changes
```bash
# Always verify before and after
bash /home/user/wireguard-backups/verify-wg-tunnel.sh
bash /home/user/wireguard-backups/coolify-diagnostic.sh
```

---

## Backups Directory

**OpenVPN Backup**:
- Location: `/home/user/wireguard-backups/openvpn-backup/`
- Contents: Complete OpenVPN configuration (removed from server Nov 15, 2025)
- Purpose: Recovery if ever needed (not recommended - use WireGuard)

**WireGuard Backups**:
- Location: `/home/user/wireguard-backups/`
- Format: `wg0.conf.YYYYMMDD_HHMMSS` (config) + `wg0-status.YYYYMMDD_HHMMSS.txt` (status)
- Retention: Manual cleanup (keep last 10 backups)

---

## Troubleshooting

### Script Permission Issues
```bash
chmod +x /home/user/wireguard-backups/*.sh
```

### Sudo Password Required
Most scripts need sudo access. If prompted:
- Password: `Atochastertl25!`
- Or run with: `sudo bash script-name.sh`

### WireGuard Tunnel Down
```bash
# Check interface
sudo wg show wg0

# If missing, bring up
sudo wg-quick up wg0

# Verify
bash /home/user/wireguard-backups/verify-wg-tunnel.sh
```

### Coolify Errors
```bash
# Run diagnostic
bash /home/user/wireguard-backups/coolify-diagnostic.sh

# If cache issues, clear
docker exec coolify php artisan optimize:clear

# If container issues, check logs
docker logs coolify --tail 100
```

---

## Related Documentation

**Server Documentation**:
- `/home/user/CLAUDE.md` - Server operations guide
- `/home/user/CONTAINER_PROTECTION_AND_RECOVERY.md` - Container protection

**Repository Documentation**:
- `docs/server/WIREGUARD_PROTECTION_AND_RECOVERY.md` - WireGuard recovery procedures
- `docs/server/OPENVPN_REMOVAL_NOVEMBER_15_2025.md` - OpenVPN removal
- `docs/server/COOLIFY_UNSERIALIZE_76_BYTE_ERROR_FIX.md` - Coolify error fix

---

**Created**: November 15, 2025
**Maintainer**: Automated scripts for server operations
**Status**: ✅ All scripts tested and operational
