# OpenVPN Removal from Server

**Date**: November 15, 2025
**Machine**: Server (192.168.1.15, veritable-games-server)
**Status**: ✅ Complete - OpenVPN removed without affecting WireGuard or SSH

---

## Overview

OpenVPN was removed from the server to prevent routing conflicts with the private WireGuard VPN tunnel.

**Background**: OpenVPN previously caused routing conflicts on the laptop by routing local network traffic (192.168.1.0/24) through the tun0 tunnel, breaking WireGuard handshakes. While the laptop's OpenVPN was already stopped, the server still had OpenVPN running.

---

## What Was Removed

### OpenVPN Service

**Before Removal**:
```
Process: openvpn (PID 1337) - running since Nov 15 02:09
Interface: tun0 (10.200.0.1)
Route: 10.200.0.0/24 dev tun0
Config: /etc/openvpn/server.conf
Status: Active and enabled for auto-start
```

**Actions Taken**:
1. ✅ Backed up configuration: `/home/user/wireguard-backups/openvpn-backup/`
2. ✅ Stopped service: `systemctl stop openvpn@server`
3. ✅ Stopped base service: `systemctl stop openvpn`
4. ✅ Disabled auto-start: `systemctl disable openvpn@server`
5. ✅ Disabled base service: `systemctl disable openvpn`
6. ✅ Verified tun0 interface removed automatically
7. ✅ Verified 10.200.0.0/24 route removed automatically

**After Removal**:
```
Process: None
Interface: None (tun0 removed)
Route: None (10.200.0.0/24 removed)
Status: Disabled (will not start on boot)
```

### Configuration Backup

**Location**: `/home/user/wireguard-backups/openvpn-backup/openvpn/`

**Files Backed Up**:
- `server.conf` - Main server configuration
- `ca.crt` - Certificate Authority certificate
- `server.crt` - Server certificate
- `server.key` - Server private key
- `dh.pem` - Diffie-Hellman parameters
- `ipp.txt` - IP pool assignments
- `update-resolv-conf` - DNS resolver script
- Complete `client/`, `server/`, and `easy-rsa/` directories

**Restoration** (if ever needed):
```bash
sudo cp -r /home/user/wireguard-backups/openvpn-backup/openvpn/* /etc/openvpn/
sudo systemctl enable openvpn@server
sudo systemctl start openvpn@server
```

---

## Verification Results

### ✅ WireGuard VPN (Protected - Still Working)

**Status After OpenVPN Removal**:
```
Interface: wg0 (UP and RUNNING)
VPN IP: 10.100.0.1/24
Port: 51820
Peer: brTvUtYCQYlWdc1WkIFChLsvYhQZ1nmyxF4BjQ11DSY= (laptop)
Latest Handshake: 44 seconds ago (ACTIVE)
Transfer: 52.59 KiB received, 43.18 KiB sent
Route: 10.100.0.0/24 dev wg0 proto kernel scope link src 10.100.0.1
```

**Connectivity Test**:
```bash
ping -c 2 10.100.0.2
# Result: 0% packet loss, 4.16-4.19ms latency
# ✅ WireGuard VPN routing working
```

### ✅ Regular Network (Still Working)

**Status After OpenVPN Removal**:
```
Default Gateway: 192.168.1.1
Local Network: 192.168.1.0/24
```

**Connectivity Test**:
```bash
ping -c 2 192.168.1.1
# Result: 0% packet loss, 2.93-3.91ms latency
# ✅ Regular network routing working
```

### ✅ SSH Access (Still Working)

**Direct SSH** (192.168.1.15):
- ✅ Accessible from local network
- ✅ No routing conflicts

**VPN SSH** (10.100.0.1):
- ✅ Accessible via WireGuard tunnel
- ✅ Server → Laptop: `ssh user@10.100.0.2`

---

## Current VPN Infrastructure

### Active VPN: WireGuard Only

**Server (192.168.1.15)**:
- Interface: `wg0`
- VPN IP: `10.100.0.1/24`
- Port: `51820`
- Purpose: Private server ↔ laptop routing

**Laptop (192.168.1.175)**:
- Interface: `wg0_laptop`
- VPN IP: `10.100.0.2/24`
- Port: `44780`
- Purpose: Private laptop ↔ server routing

**Tunnel Status**: ✅ Fully operational, bidirectional

### Removed VPN: OpenVPN

**Server**:
- ❌ Service disabled and stopped
- ❌ tun0 interface removed
- ❌ Routes removed
- ✅ Configuration backed up

**Laptop**:
- ❌ Service already stopped (November 15, earlier session)
- ❌ Conflicting routes already removed
- ✅ No longer interfering with WireGuard

---

## Why This Was Done

### Problem: OpenVPN Routing Conflicts

**On Laptop** (discovered earlier):
- OpenVPN routed 192.168.1.0/24 through tun0 tunnel
- This intercepted WireGuard UDP packets destined for 192.168.1.15:51820
- WireGuard handshakes failed (packets never reached server)
- Took THREE sessions to diagnose (Nov 5, 12, 15)

**On Server** (removed today):
- OpenVPN was running but not actively causing issues
- Removed preemptively to prevent future conflicts
- Ensures clean environment for public routing setup

### Solution: Single VPN (WireGuard)

**Benefits**:
- ✅ No routing conflicts
- ✅ Simpler network topology
- ✅ One VPN to maintain
- ✅ Clear separation for public routing (can use different subnet)

---

## Implications for Future Public Routing

### Protected Private Routing

**WireGuard VPN (10.100.0.0/24)** - DO NOT MODIFY:
- Server: `wg0` interface
- Laptop: `wg0_laptop` interface
- Purpose: Private server ↔ laptop SSH access

### Available Public Routing Options

**Safe Approaches** (No conflict with WireGuard):

1. **Cloudflare Tunnel** (Recommended):
   - Uses HTTP tunnel, not VPN
   - No routing table changes
   - No port conflicts
   - Tool: `cloudflared tunnel`

2. **WireGuard on wg1**:
   - Different interface: `wg1` (NOT `wg0`)
   - Different subnet: `10.200.0.0/24` (NOT `10.100.0.0/24`)
   - Different port: `51821` (NOT `51820`)

3. **Tailscale**:
   - Uses `tailscale0` interface
   - Separate daemon
   - No conflicts with WireGuard

4. **ngrok / localtunnel**:
   - HTTP tunneling
   - No system routing changes
   - Quick public access

**Unsafe Approaches** (Will break private WireGuard):
- ❌ Reinstalling OpenVPN (routing conflicts)
- ❌ Reusing `wg0` interface for public routing
- ❌ Using subnet `10.100.0.0/24` for anything else
- ❌ Using port 51820 or 44780 for other services

---

## Disabled Services

**OpenVPN Services** (all disabled):
```
openvpn-client@.service    disabled
openvpn-server@.service    disabled
openvpn.service            disabled
openvpn@.service           indirect (disabled)
```

These will NOT start automatically on reboot.

---

## Commands Used

### Backup Configuration
```bash
mkdir -p /home/user/wireguard-backups/openvpn-backup
sudo cp -r /etc/openvpn /home/user/wireguard-backups/openvpn-backup/
```

### Stop OpenVPN
```bash
sudo systemctl stop openvpn@server
sudo systemctl stop openvpn
```

### Disable Auto-Start
```bash
sudo systemctl disable openvpn@server
sudo systemctl disable openvpn
```

### Verify Removal
```bash
# Check service status
systemctl status openvpn@server
systemctl list-unit-files | grep openvpn

# Check interfaces
ip link show | grep -E "tun|tap"

# Check routes
ip route | grep -E "tun|10.200"

# Check processes
ps aux | grep openvpn
```

### Verify WireGuard Still Works
```bash
# Check WireGuard status
sudo wg show wg0

# Test VPN connectivity
ping -c 2 10.100.0.2

# Test regular network
ping -c 2 192.168.1.1
```

---

## Recovery (If Needed)

### Restore OpenVPN

**If you need OpenVPN back** (not recommended):

```bash
# Restore configuration
sudo cp -r /home/user/wireguard-backups/openvpn-backup/openvpn/* /etc/openvpn/

# Enable and start
sudo systemctl enable openvpn@server
sudo systemctl start openvpn@server

# Verify
systemctl status openvpn@server
```

**⚠️ WARNING**: This will likely cause routing conflicts with WireGuard again!

### Better Alternative

If you need another VPN, use a **separate infrastructure**:
- Different interface name (`wg1`, NOT `wg0`)
- Different subnet (`10.200.0.0/24`, NOT `10.100.0.0/24`)
- Different ports (NOT 51820 or 44780)

---

## Timeline

**November 15, 2025**:
- 19:32 UTC - Backed up OpenVPN configuration
- 19:34 UTC - Stopped OpenVPN services
- 19:34 UTC - Verified tun0 interface removed
- 19:35 UTC - Disabled OpenVPN auto-start
- 19:35 UTC - Verified WireGuard still operational
- 19:36 UTC - Verified regular network still working
- Status: ✅ Complete

---

## Summary

**What Changed**:
- ✅ OpenVPN removed from server
- ✅ tun0 interface removed
- ✅ 10.200.0.0/24 routes removed
- ✅ OpenVPN disabled from auto-start
- ✅ Configuration backed up for recovery

**What Stayed the Same**:
- ✅ WireGuard VPN fully operational (10.100.0.0/24)
- ✅ Regular network routing working (192.168.1.0/24)
- ✅ SSH access preserved (both direct and via VPN)
- ✅ No impact on production services

**Result**: Clean VPN environment with only WireGuard, ready for public routing setup without conflicts.

---

**Document Version**: 1.0
**Last Updated**: November 15, 2025
**Status**: ✅ OpenVPN Removed - WireGuard Protected
