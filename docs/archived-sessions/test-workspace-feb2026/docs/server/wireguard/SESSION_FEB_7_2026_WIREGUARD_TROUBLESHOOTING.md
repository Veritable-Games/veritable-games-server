# WireGuard Troubleshooting Session - February 7, 2026

**Status**: BLOCKED - Need server-side help to fix DDNS
**Problem**: Cannot connect to home server via WireGuard from public network
**Root Causes Found**:
1. Dual-interface conflict (FIXED with new script)
2. DDNS pointing to wrong IP (NEEDS SERVER-SIDE FIX)

---

## Summary for Server-Side Claude

The laptop cannot connect via WireGuard when on a public network. We need help from the server to:

1. **Find the home network's actual public IP**
2. **Update the Cloudflare DDNS record for `wg.veritablegames.com`**
3. **Verify WireGuard is listening on the correct interface**

---

## Problem 1: Dual Interface Conflict (FIXED)

### What Was Happening
Both `wg0-home` and `wg0-away` interfaces were running simultaneously, causing routing conflicts:

```
$ ip link show | grep wg0
112: wg0-away: <POINTOPOINT,NOARP,UP,LOWER_UP>
113: wg0-home: <POINTOPOINT,NOARP,UP,LOWER_UP>  ← BOTH UP!

$ ip route | grep 10.100.0
10.100.0.0/24 dev wg0-away proto kernel scope link src 10.100.0.2
10.100.0.0/24 dev wg0-home proto static scope link metric 50   ← CONFLICT
10.100.0.0/24 dev wg0-home proto kernel scope link src 10.100.0.2
```

### Root Cause
Both configs use the same IP address (`10.100.0.2/24`). The old auto-switch script (v1) didn't properly tear down the old interface before starting the new one.

### Fix Applied
New auto-switch script v2 deployed to laptop:
- Location: `/etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch`
- Source: `docs/server/wireguard/configs/99-wireguard-auto-switch-v2`

Key improvements:
- Uses `wg-quick` instead of `nmcli` for reliability
- Explicitly tears down ALL wg0-* interfaces before starting target
- Verifies interfaces are actually down before proceeding
- Better logging to `/var/log/wireguard-switch.log`

**Status**: FIXED on laptop

---

## Problem 2: DDNS Pointing to Wrong IP (NEEDS FIX)

### Current State
```
$ host wg.veritablegames.com
wg.veritablegames.com has address 172.221.18.109
```

The IP `172.221.18.109` is a **Cloudflare IP**, not the home network's public IP.

### Evidence
```
$ sudo wg show wg0-away
interface: wg0-away
  public key: brTvUtYCQYlWdc1WkIFChLsvYhQZ1nmyxF4BjQ11DSY=
  listening port: 57364

peer: Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
  endpoint: 172.221.18.109:51820
  allowed ips: 10.100.0.1/32
  transfer: 0 B received, 444 B sent     ← NO DATA RECEIVED
  persistent keepalive: every 25 seconds
                        ↑ NO "latest handshake" = server unreachable
```

### What Server Needs To Do

#### Step 1: Find the actual public IP
```bash
# Run on server (192.168.1.15)
curl -s ifconfig.me
# or
curl -s icanhazip.com
# or
curl -s api.ipify.org
```

This will return something like `73.xxx.xxx.xxx` or `98.xxx.xxx.xxx` (typical residential IP).

#### Step 2: Update Cloudflare DNS
Go to Cloudflare dashboard → veritablegames.com → DNS:
1. Find the `wg` A record
2. Change the IP from `172.221.18.109` to the actual public IP from Step 1
3. Ensure the proxy is OFF (gray cloud, not orange)
4. Save

#### Step 3: Verify WireGuard is listening
```bash
# On server
sudo wg show wg0
# Should show the interface is up

sudo ss -tulpn | grep 51820
# Should show: udp UNCONN 0 0 0.0.0.0:51820

# Check if port is open from WAN
# (Can't test this from inside the network)
```

#### Step 4: Check router port forwarding
Ensure the home router forwards:
- **External port**: 51820/UDP
- **Internal IP**: 192.168.1.15
- **Internal port**: 51820/UDP

---

## Server WireGuard Configuration Reference

### Server Config (`/etc/wireguard/wg0.conf`)
```ini
[Interface]
Address = 10.100.0.1/24
ListenPort = 51820
PrivateKey = <server-private-key>

[Peer]
# Laptop
PublicKey = brTvUtYCQYlWdc1WkIFChLsvYhQZ1nmyxF4BjQ11DSY=
AllowedIPs = 10.100.0.2/32
```

### Laptop "Away" Config (`/etc/wireguard/wg0-away.conf`)
```ini
[Interface]
Address = 10.100.0.2/24
PrivateKey = qHhR4ujr6zf73bT/hRoZ0ipP35B9a+8pKXsYZy4d5F8=
MTU = 1280
DNS = 1.1.1.1

[Peer]
PublicKey = Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
Endpoint = wg.veritablegames.com:51820   ← THIS DNS RECORD IS WRONG
AllowedIPs = 10.100.0.0/24, 192.168.1.0/24
PersistentKeepalive = 25
```

---

## Quick Diagnostic Commands (Run on Server)

```bash
# 1. Get public IP
echo "Public IP: $(curl -s ifconfig.me)"

# 2. Check WireGuard status
sudo wg show wg0

# 3. Check if listening on UDP 51820
sudo ss -tulpn | grep 51820

# 4. Check recent WireGuard logs
sudo journalctl -u wg-quick@wg0 --since "1 hour ago"

# 5. Verify IP forwarding is enabled
cat /proc/sys/net/ipv4/ip_forward
# Should output: 1

# 6. Check firewall allows 51820
sudo ufw status | grep 51820
# or
sudo iptables -L -n | grep 51820
```

---

## What Success Looks Like

After fixing DDNS, from the laptop on a public network:

```bash
$ ping -c 2 10.100.0.1
PING 10.100.0.1 (10.100.0.1) 56(84) bytes of data.
64 bytes from 10.100.0.1: icmp_seq=1 ttl=64 time=45.2 ms  ← SUCCESS
64 bytes from 10.100.0.1: icmp_seq=2 ttl=64 time=42.1 ms

$ sudo wg show wg0-away
peer: Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
  endpoint: <correct-public-ip>:51820
  allowed ips: 10.100.0.1/32
  latest handshake: 5 seconds ago     ← THIS SHOULD APPEAR
  transfer: 1.2 KiB received, 856 B sent

$ ssh user@10.100.0.1
user@server:~$   ← CONNECTED!
```

---

## Files Modified This Session

| File | Change |
|------|--------|
| `docs/server/wireguard/configs/99-wireguard-auto-switch-v2` | Created - new robust auto-switch script |
| `docs/server/wireguard/WIREGUARD_DUAL_INTERFACE_ANALYSIS_FEB_2026.md` | Created - full analysis |
| `docs/server/wireguard/README.md` | Updated - added dual interface troubleshooting |
| `/etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch` | Deployed v2 script (on laptop) |

---

## Action Items

### For Server-Side Claude:
1. [ ] Run `curl -s ifconfig.me` to get actual public IP
2. [ ] Update Cloudflare DNS: `wg` A record → actual public IP (gray cloud)
3. [ ] Verify `sudo wg show wg0` shows interface is up
4. [ ] Verify `sudo ss -tulpn | grep 51820` shows listening
5. [ ] Check router port forwarding for 51820/UDP → 192.168.1.15

### For User (When Back Home):
1. [ ] Test: `ping -c 2 10.100.0.1` from laptop
2. [ ] Test: `ssh user@10.100.0.1` from laptop
3. [ ] Go to public network and verify away connection works

---

## Contact/Handoff

This document created by Claude Code on laptop.
Server-side Claude can read this at:
`/home/user/Projects/veritable-games-main/docs/server/wireguard/SESSION_FEB_7_2026_WIREGUARD_TROUBLESHOOTING.md`

The git repo should be synced, or copy this file to the server manually.

---

**Last Updated**: February 7, 2026 ~21:20 PST
