# WireGuard Dual-Interface Conflict Analysis

**Date**: February 7, 2026
**Status**: Fix implemented, awaiting deployment
**Issue**: Both `wg0-home` and `wg0-away` interfaces running simultaneously, causing routing conflicts

---

## Executive Summary

The WireGuard auto-switch system has been experiencing intermittent failures where both interfaces (`wg0-home` and `wg0-away`) remain active simultaneously, causing routing conflicts and VPN connectivity failures.

**Root Cause**: Both configurations use the identical IP address (`10.100.0.2/24`), and the auto-switch script (v1) doesn't properly ensure the old interface is down before starting the new one.

**Fix**: New auto-switch script (v2) that explicitly tears down ALL WireGuard interfaces before starting the target.

---

## Technical Analysis

### Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐
│     Laptop      │         │     Server      │
│  10.100.0.2/24  │◄───────►│  10.100.0.1/24  │
│                 │   VPN   │  192.168.1.15   │
└─────────────────┘         └─────────────────┘
        │
        ├── wg0-home: Direct to 192.168.1.15:51820 (LAN)
        │             MTU 1420, DNS 192.168.1.1
        │
        └── wg0-away: Via wg.veritablegames.com:51820 (Internet)
                      MTU 1280, DNS 1.1.1.1
```

### The Problem

Both configurations share:
- **Same VPN IP**: `10.100.0.2/24`
- **Same private key**: `qHhR4...`
- **Same AllowedIPs**: `10.100.0.0/24, 192.168.1.0/24`

When the auto-switch script runs:

```
1. Script detects network change (home ↔ away)
2. Calls: nmcli connection down wg0-away
3. Sleeps 1 second
4. Calls: nmcli connection up wg0-home
5. BUT: wg0-away may still be releasing the IP
6. RESULT: wg0-home fails to bind, OR both interfaces get created
```

### Evidence from Logs

**Feb 7, 2026 21:17:38** - Script ran but created conflict:
```
wireguard-switch: Starting wg0-away...
wireguard-switch: [#] ip link add wg0-away type wireguard
wireguard-switch: [#] ip -4 address add 10.100.0.2/24 dev wg0-away
wireguard-switch: ✓ Successfully switched to wg0-away
```

But `wg0-home` was still present from earlier:
```
$ ip link show | grep wg0
112: wg0-away: <POINTOPOINT,NOARP,UP,LOWER_UP>
113: wg0-home: <POINTOPOINT,NOARP,UP,LOWER_UP>  ← SHOULD NOT BE HERE
```

**Result**: Route table confusion:
```
10.100.0.0/24 dev wg0-away proto kernel scope link src 10.100.0.2
10.100.0.0/24 dev wg0-home proto static scope link metric 50
10.100.0.0/24 dev wg0-home proto kernel scope link src 10.100.0.2 metric 50
```

### Historical Incidents

| Date | Issue | Cause | Resolution |
|------|-------|-------|------------|
| Nov 15, 2025 | OpenVPN routing conflict | OpenVPN captured WireGuard traffic | Removed OpenVPN |
| Dec 2, 2025 | wg0-home corrupted | NetworkManager lost private key | Re-imported from .conf |
| Dec 4, 2025 | Auto-switch failed | IP address conflict | Manual teardown |
| Feb 7, 2026 | Dual interfaces | Script race condition | **v2 script fix** |

---

## Solution: Auto-Switch Script v2

### Key Changes

1. **Use wg-quick instead of nmcli**
   - More reliable interface management
   - Direct control over WireGuard state
   - Avoids NetworkManager corruption issues

2. **Explicit teardown of ALL interfaces**
   ```bash
   # Before starting target, stop everything
   if ip link show wg0-away &>/dev/null; then
     wg-quick down wg0-away
   fi
   if ip link show wg0-home &>/dev/null; then
     wg-quick down wg0-home
   fi
   ```

3. **Verification before proceeding**
   ```bash
   # Confirm interfaces are actually down
   REMAINING=$(ip link show 2>/dev/null | grep -oE "wg0-(home|away)" || true)
   if [ -n "$REMAINING" ]; then
     # Force removal
     ip link delete "$iface"
   fi
   ```

4. **Better logging**
   - Logs to both systemd journal AND `/var/log/wireguard-switch.log`
   - Includes output from wg-quick commands
   - Tests connectivity after switch

### Deployment Instructions

```bash
# 1. Backup current script
sudo cp /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch \
        /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch.bak

# 2. Install new script
sudo cp docs/server/wireguard/configs/99-wireguard-auto-switch-v2 \
        /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch

# 3. Set permissions
sudo chmod 755 /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch
sudo chown root:root /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch

# 4. Test manually
sudo /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch wlp0s20f3 up

# 5. Verify logs
journalctl -t wireguard-switch --since "1 minute ago"
cat /var/log/wireguard-switch.log | tail -20
```

---

## Alternative Fix: Different IP Addresses

A more robust long-term fix would use different IPs for each config:

```ini
# wg0-home.conf
Address = 10.100.0.2/24

# wg0-away.conf
Address = 10.100.0.3/24  # Different IP
```

**Server config update required**:
```ini
[Peer]
# Laptop - home connection
PublicKey = brTvUtYCQYlWdc1WkIFChLsvYhQZ1nmyxF4BjQ11DSY=
AllowedIPs = 10.100.0.2/32

[Peer]
# Laptop - away connection (same key, different IP)
PublicKey = brTvUtYCQYlWdc1WkIFChLsvYhQZ1nmyxF4BjQ11DSY=
AllowedIPs = 10.100.0.3/32
```

**Trade-off**: This requires server-side changes and could complicate routing. The v2 script fix is simpler.

---

## Monitoring

### Check current state
```bash
# Which interfaces are up?
ip link show | grep wg0

# Route table
ip route | grep 10.100.0

# WireGuard status
sudo wg show
```

### View switch history
```bash
# Recent switches
journalctl -t wireguard-switch --since "24 hours ago"

# Or from log file
tail -50 /var/log/wireguard-switch.log
```

### Manual recovery if stuck
```bash
# Nuclear option: tear down everything and restart
sudo wg-quick down wg0-home 2>/dev/null
sudo wg-quick down wg0-away 2>/dev/null
sudo ip link delete wg0-home 2>/dev/null
sudo ip link delete wg0-away 2>/dev/null

# Start correct one based on network
# Home network:
sudo wg-quick up wg0-home

# Away network:
sudo wg-quick up wg0-away
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `/etc/wireguard/wg0-home.conf` | Home network config (endpoint: 192.168.1.15) |
| `/etc/wireguard/wg0-away.conf` | Away network config (endpoint: wg.veritablegames.com) |
| `/etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch` | Auto-switch script |
| `/var/log/wireguard-switch.log` | Switch history log (v2 only) |
| `docs/server/wireguard/configs/99-wireguard-auto-switch-v2` | Fixed script (deploy this) |

---

## Conclusion

The WireGuard dual-interface conflict is a race condition in the v1 auto-switch script. The v2 script fixes this by:

1. Always tearing down ALL interfaces before starting target
2. Verifying interfaces are actually down
3. Using wg-quick for more reliable control
4. Better logging for debugging

Deploy the v2 script and the conflicts should be eliminated.
