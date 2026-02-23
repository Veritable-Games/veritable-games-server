# WireGuard Public Routing Setup - November 15-16, 2025

**Status**: ✅ **FULLY OPERATIONAL** - All features working including SSH over public networks

**Goal**: Enable laptop to connect to server's WireGuard tunnel from anywhere (not just home network) using Cloudflare DDNS for dynamic IP updates.

---

## Overview

Setting up automatic public routing for WireGuard tunnel between:
- **Server**: 192.168.1.15 (always at home, WireGuard endpoint)
- **Laptop**: 192.168.1.175 (mobile, needs to connect from anywhere)

**Architecture**:
```
Laptop (Away) → Internet → wg.veritablegames.com (DDNS) → Router:51820 → Server WireGuard
Laptop (Home) → Direct LAN → Server WireGuard (faster, local connection)
```

---

## ✅ Phase 1: Cloudflare API Setup (COMPLETE)

**Completed**: November 16, 2025

**Cloudflare DNS Configuration**:
- **Domain**: wg.veritablegames.com
- **Zone ID**: `9151263ddaf6aa95026ec46c6404435a`
- **API Token**: `jMlW9bMp7aFdCT112xRdX5x5YRI5BSgtt2F_YLh3`
  - Permissions: Zone → DNS → Edit
  - Resources: Include → Specific zone → veritablegames.com
  - Client IP filtering:
    - `172.221.18.109` (IPv4 - shared by both machines through NAT)
    - `2600:6c4e:97f:6a65::/64` (IPv6 subnet - covers both laptop and server)

**Why IPv6 Subnet Was Needed**:
Initially added only IPv4 and laptop's IPv6, but server has different IPv6 address:
- Laptop IPv6: `2600:6c4e:97f:6a65:5d67:de0:fdb3:cf54`
- Server IPv6: `2600:6c4e:97f:6a65::164f`
- Solution: Added entire `/64` subnet to cover both

**DNS Record Status**:
```bash
$ host wg.veritablegames.com
wg.veritablegames.com has address 172.221.18.109
```

---

## ✅ Phase 2: Server DDNS Update Script (COMPLETE)

**Completed**: November 16, 2025

**Script Location**: `/usr/local/bin/cloudflare-ddns-update.py`

**Features**:
- Detects current public IPv4 using `ipv4.icanhazip.com` (forced IPv4, not IPv6)
- Queries Cloudflare API for existing DNS record
- Creates new record if doesn't exist
- Updates existing record if IP changed
- No action if IP unchanged (avoids unnecessary API calls)
- Logs to both syslog and stdout

**Configuration File**: `/etc/cloudflare-ddns/.env`
```bash
CLOUDFLARE_API_TOKEN=jMlW9bMp7aFdCT112xRdX5x5YRI5BSgtt2F_YLh3
CLOUDFLARE_ZONE_ID=9151263ddaf6aa95026ec46c6404435a
DDNS_DOMAIN=wg.veritablegames.com
```
- Permissions: `600` (root only)
- Owner: root:root

**DNS Record Details**:
- **Type**: A (IPv4)
- **Name**: wg.veritablegames.com
- **Content**: 172.221.18.109 (current public IP)
- **TTL**: 300 seconds (5 minutes)
- **Proxied**: false ✅ (CRITICAL - must be DNS-only for WireGuard)

**Test Results**:
```bash
$ ssh user@192.168.1.15 'sudo /usr/local/bin/cloudflare-ddns-update.py'
[2025-11-16 00:21:09] Starting DDNS update for wg.veritablegames.com
[2025-11-16 00:21:10] Current public IPv4: 172.221.18.109
[2025-11-16 00:21:11] ✓ Created DNS record: wg.veritablegames.com -> 172.221.18.109
[2025-11-16 00:21:11] ✓ DDNS update completed successfully
```

---

## ✅ Phase 3: Systemd Service & Timer (COMPLETE)

**Completed**: November 16, 2025

**Service File**: `/etc/systemd/system/cloudflare-ddns.service`
**Timer File**: `/etc/systemd/system/cloudflare-ddns.timer`

**Configuration**:
- Runs on boot (after 2 minutes for network stabilization)
- Runs every 5 minutes continuously
- Persistent (catches up if system was off)

**Status**:
```bash
$ systemctl status cloudflare-ddns.timer
● cloudflare-ddns.timer - Cloudflare Dynamic DNS Update Timer
     Loaded: loaded (/etc/systemd/system/cloudflare-ddns.timer; enabled)
     Active: active (waiting)
    Trigger: Next run in ~5 minutes
```

**Monitoring**:
```bash
# View recent updates
journalctl -u cloudflare-ddns.service --since "1 hour ago"

# Check next run time
systemctl list-timers cloudflare-ddns.timer
```

---

## ✅ Phase 4: Router Port Forwarding (COMPLETE)

**Completed**: November 16, 2025

**Port Forwarding Rule Configured**:
- **Service Name**: WireGuard
- **External Port**: 51820
- **Protocol**: UDP
- **Internal IP**: 192.168.1.15 (veritable-games-server)
- **Internal Port**: 51820

**Router**: Spectrum router at 192.168.1.1
**IP Reservation**: Already configured for veritable-games-server (192.168.1.15)

**Testing**:
```bash
# DNS resolution working
$ host wg.veritablegames.com
wg.veritablegames.com has address 172.221.18.109

# Port appears reachable
$ python3 -c "import socket; sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); sock.sendto(b'test', ('wg.veritablegames.com', 51820))"
✓ Sent UDP packet to wg.veritablegames.com:51820
```

**Note**: Full port forwarding verification requires testing from outside the home network (NAT hairpinning limitation).

---

## ✅ Phase 5: Laptop Dual WireGuard Configs (COMPLETE)

**Completed**: November 16, 2025

**Config Files Created**:
- `/etc/wireguard/wg0-home.conf` - Direct LAN connection (home network)
- `/etc/wireguard/wg0-away.conf` - Public DDNS connection (away from home)

### Home Config (`wg0-home.conf`)
```ini
[Interface]
Address = 10.100.0.2/24
PrivateKey = qHhR4ujr6zf73bT/hRoZ0ipP35B9a+8pKXsYZy4d5F8=
MTU = 1420

[Peer]
PublicKey = Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
Endpoint = 192.168.1.15:51820
AllowedIPs = 10.100.0.1/32
PersistentKeepalive = 25
```

### Away Config (`wg0-away.conf`)
```ini
[Interface]
Address = 10.100.0.2/24
PrivateKey = qHhR4ujr6zf73bT/hRoZ0ipP35B9a+8pKXsYZy4d5F8=
MTU = 1280

[Peer]
PublicKey = Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
Endpoint = wg.veritablegames.com:51820
AllowedIPs = 10.100.0.1/32
PersistentKeepalive = 25
```

**Key Differences**:
- **Home**: `Endpoint = 192.168.1.15:51820` (direct LAN), `MTU = 1420` (standard)
- **Away**: `Endpoint = wg.veritablegames.com:51820` (public DDNS), `MTU = 1280` (mobile-friendly)

**MTU Settings Explained**:
- **Home (1420)**: Standard WireGuard MTU, optimal for LAN
- **Away (1280)**: Reduced MTU for mobile networks to prevent packet fragmentation and fix SSH hanging issue

**Permissions**: 600 (root only), both configs installed and verified.

---

## ✅ Phase 6: NetworkManager Dispatcher Script (COMPLETE)

**Completed**: November 16, 2025

**Script Location**: `/etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch`

**Functionality**:
- Automatically detects network location by pinging router (192.168.1.1)
- If home: Switches to `wg0-home` (direct LAN)
- If away: Switches to `wg0-away` (public DDNS)
- Logs all transitions to syslog
- Handles cleanup of old WireGuard interfaces

**Test Results** (Manual Trigger):
```bash
$ sudo /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch eth0 up
[2025-11-16 02:32:13] Network interface eth0 came up, checking location...
[2025-11-16 02:32:13] ✓ Detected home network (router 192.168.1.1 reachable)
[2025-11-16 02:32:13] Switching WireGuard from wg0_laptop wg0 to wg0-home...
[2025-11-16 02:32:14] ✓ Successfully switched to wg0-home (home network)
```

**Verification**:
```bash
$ sudo wg show
interface: wg0-home
  public key: brTvUtYCQYlWdc1WkIFChLsvYhQZ1nmyxF4BjQ11DSY=
  private key: (hidden)
  listening port: 50208
  peer: Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
    endpoint: 192.168.1.15:51820
    allowed ips: 10.100.0.1/32
    latest handshake: 26 seconds ago
    transfer: 440 B received, 808 B sent
    persistent keepalive: every 25 seconds

$ ping -c 2 10.100.0.1
PING 10.100.0.1 (10.100.0.1) 56(84) bytes of data.
64 bytes from 10.100.0.1: icmp_seq=1 ttl=64 time=4.41 ms
64 bytes from 10.100.0.1: icmp_seq=2 ttl=64 time=8.29 ms
--- 10.100.0.1 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss
```

**Status**: ✅ Script installed, tested, and working correctly

---

## ✅ Phase 7: Real-World Testing (COMPLETE)

**Completed**: November 16, 2025

**Test Environment**: Mobile hotspot (away from home network)

**Results**: WireGuard tunnel successfully established from public network

**Test Procedure (When Away)**:

### 1. Verify Auto-Switch Occurred
```bash
# Check dispatcher logs
journalctl -t wireguard-switch --since "5 minutes ago"

# Expected output:
# [timestamp] Network interface wlan0 came up, checking location...
# [timestamp] ✓ Detected away network (router 192.168.1.1 not reachable)
# [timestamp] Switching WireGuard from wg0-home to wg0-away...
# [timestamp] ✓ Successfully switched to wg0-away (away network)
```

### 2. Verify Correct Config Active
```bash
sudo wg show

# Expected output:
# interface: wg0-away
#   endpoint: <PUBLIC_IP>:51820  ← Should resolve from wg.veritablegames.com
#   latest handshake: X seconds ago  ← Should be recent
#   transfer: X KiB received, Y KiB sent  ← Should show bidirectional traffic
```

### 3. Test VPN Connectivity
```bash
# Ping server through tunnel
ping -c 5 10.100.0.1
# Expected: 0% packet loss

# SSH to server through tunnel
ssh user@10.100.0.1
# Expected: Successful connection
```

### 4. Verify Using Public Route
```bash
# Check that endpoint resolved correctly
sudo wg show wg0-away | grep endpoint
# Should show: endpoint: <your_current_public_IP>:51820
# (Resolved from wg.veritablegames.com)

# Verify DDNS is current
host wg.veritablegames.com
# Should match your home's public IP
```

**Manual Switch Test** (If Auto-Switch Fails):
```bash
sudo wg-quick down wg0-home
sudo wg-quick up wg0-away
```

**Success Criteria**:
- ✅ Auto-switch triggers when joining away network
- ✅ `wg0-away` config activates
- ✅ WireGuard handshake succeeds
- ✅ Ping to 10.100.0.1 works
- ⚠️ SSH to 10.100.0.1 hangs (investigation needed)
- ✅ Bidirectional traffic flows

### Actual Test Results (November 16, 2025)

**1. Auto-Switch**: ✅ SUCCESS
```
Nov 16 12:25:31 remote wireguard-switch[88382]: ✓ Detected away network (router 192.168.1.1 not reachable)
Nov 16 12:25:31 remote wireguard-switch[88465]: ✓ Successfully switched to wg0-away (away network)
```

**2. WireGuard Handshake**: ✅ ESTABLISHED
- **Laptop Endpoint**: 172.221.18.109:51820 (wg.veritablegames.com)
- **Server Sees Laptop**: 172.56.169.16:41861 (mobile hotspot public IP)
- **Latest Handshake**: Active (< 2 minutes)
- **Transfer**: 301.70 KiB received, 130.23 KiB sent (bidirectional)

**3. Connectivity Tests**:
- **Laptop → Server Ping**: ✅ 67/68 packets (98.5% success, 46-322ms latency)
- **Server → Laptop Ping**: ✅ 5/5 packets (0% loss, 65-75ms latency)
- **SSH Connection**: ✅ **WORKING** (after MTU fix)

**Resolution**: MTU mismatch was causing SSH to hang. Fixed by setting `MTU = 1280` in away config.

---

## Summary: What's Working Now

### ✅ Server (192.168.1.15)
- **DDNS Script**: Running via systemd timer, updates every 5 minutes
- **DNS Record**: wg.veritablegames.com → 172.221.18.109 (auto-updating)
- **WireGuard**: Listening on port 51820
- **Router**: Port forwarding UDP 51820 → 192.168.1.15

### ✅ Laptop (192.168.1.175)
- **Dual Configs**: wg0-home.conf and wg0-away.conf installed
- **Auto-Switch**: NetworkManager dispatcher script active and working
- **Away Network Test**: ✅ Successfully tested via mobile hotspot
- **VPN**: Fully operational from public networks (ICMP/ping working)

### ✅ Issues Resolved
- **SSH Connectivity**: SSH was hanging over public route (ping worked)
  - **Root Cause**: MTU mismatch - mobile networks require smaller MTU than default 1420
  - **Fix Applied**: Added `MTU = 1280` to `wg0-away.conf` (November 16, 2025, 21:30 UTC)
  - **Status**: ✅ **CONFIRMED WORKING** - Tested and verified on mobile hotspot (November 16, 2025)
  - **Result**: SSH now works perfectly over public route

---

## Key Files Reference

### Server Files (192.168.1.15)
```
/usr/local/bin/cloudflare-ddns-update.py   # DDNS update script (755, root:root)
/etc/cloudflare-ddns/.env                   # API credentials (600, root:root)
/etc/systemd/system/cloudflare-ddns.service # Systemd service
/etc/systemd/system/cloudflare-ddns.timer   # Systemd timer
/etc/wireguard/wg0.conf                     # Server WireGuard config
```

### Laptop Files (192.168.1.175)
```
/etc/wireguard/wg0-home.conf                # Home config (600, root:root)
/etc/wireguard/wg0-away.conf                # Away config (600, root:root)
/etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch  # Auto-switch script (755, root:root)
```

---

## Troubleshooting

### DDNS Not Updating
```bash
# Check service status
ssh user@192.168.1.15 'systemctl status cloudflare-ddns.timer'

# View logs
ssh user@192.168.1.15 'journalctl -u cloudflare-ddns.service --since "1 hour ago"'

# Manual test
ssh user@192.168.1.15 'sudo /usr/local/bin/cloudflare-ddns-update.py'
```

### Auto-Switch Not Working
```bash
# Check dispatcher script exists
ls -la /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch

# View dispatcher logs
journalctl -t wireguard-switch --since "1 hour ago"

# Test manually
sudo /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch eth0 up
```

### WireGuard Not Connecting (Away)
```bash
# Check DNS resolution
host wg.veritablegames.com

# Check WireGuard status
sudo wg show wg0-away

# Check handshake
# If "latest handshake" is old or missing:
# - Port forwarding might not be working
# - Public IP might have changed
# - Server WireGuard might be down
```

### Port Forwarding Not Working
```bash
# Verify router rule is active (check router web UI)
# Verify server WireGuard is running
ssh user@192.168.1.15 'sudo wg show'

# Test from truly external network (not home network)
```

### SSH Hangs Over WireGuard (Ping Works)
**Symptom**: Ping works, but SSH connection hangs or times out
**Cause**: MTU mismatch - mobile networks often require smaller MTU than default 1420
**Solution**: Reduce MTU in away config

```bash
# Check current MTU
ip link show wg0-away | grep mtu

# Verify away config has MTU = 1280
sudo cat /etc/wireguard/wg0-away.conf

# If missing, add to [Interface] section:
# MTU = 1280

# Restart WireGuard to apply
sudo wg-quick down wg0-away
sudo wg-quick up wg0-away

# Test SSH again
ssh user@10.100.0.1
```

**Why This Works**:
- ICMP (ping) packets are small (84 bytes) and fit in any MTU
- SSH packets are larger and get fragmented on mobile networks
- MTU 1280 is the minimum guaranteed MTU for IPv6 and works reliably on most mobile networks
- Prevents packet fragmentation that causes SSH to hang

---

## Security Notes

**Cloudflare API Token**:
- ✅ Scoped to single zone (veritablegames.com)
- ✅ Limited to DNS edit only
- ✅ IP-restricted to home network
- ⚠️ Stored in plaintext (root-only access mitigates risk)

**WireGuard Security**:
- ✅ Strong cryptography (ChaCha20Poly1305)
- ✅ Public key authentication (no password)
- ⚠️ Port 51820 exposed to internet (mitigated by WireGuard's strong auth)

**Router Exposure**:
- ⚠️ UDP 51820 open to internet
- Mitigations:
  - Only WireGuard responds (not exploitable like HTTP)
  - Cryptographic authentication required
  - No other services on that port

---

## Next Steps for User

**When Away From Home**:
1. Connect to different WiFi network (coffee shop, mobile hotspot, work, etc.)
2. Check if auto-switch triggered: `journalctl -t wireguard-switch --since "5 minutes ago"`
3. Verify wg0-away active: `sudo wg show`
4. Test connectivity: `ping 10.100.0.1`
5. Report results for documentation

**Monitoring**:
```bash
# Check DDNS status
watch -n 60 'host wg.veritablegames.com'

# Monitor WireGuard
watch -n 5 'sudo wg show'

# View logs
journalctl -t wireguard-switch -f
```

---

**Session Completed**: November 16, 2025, 21:45 UTC
**Status**: ✅ **FULLY OPERATIONAL** - All testing complete, all issues resolved
**Achievement**: Successfully enabled remote SSH access to home server from any network worldwide
