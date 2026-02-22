# Accessing Coolify Over WireGuard Tunnel

**Date**: November 16, 2025
**Status**: ✅ Working - Use VPN IP address

---

## The Issue

When connected to the WireGuard tunnel from a public network (away from home), Coolify at `http://192.168.1.15:8000` times out with "Connection timed out" error.

---

## Why This Happens

The current WireGuard configuration only routes traffic to the server's **VPN IP**, not the entire home network:

```ini
# In wg0-away.conf and wg0-home.conf
[Peer]
AllowedIPs = 10.100.0.1/32  # Only routes to VPN IP
```

**Result**:
- ✅ Traffic to `10.100.0.1` → Goes through VPN tunnel (works)
- ❌ Traffic to `192.168.1.15` → Tries to go directly over internet (times out)

Since `192.168.1.15` is a private IP address, it cannot be reached over the public internet.

---

## ✅ Solution: Use the VPN IP Address

**Access Coolify at:** `http://10.100.0.1:8000`

This works because:
- Coolify listens on all interfaces (including the WireGuard interface)
- The VPN tunnel routes `10.100.0.1/32` correctly
- Port 8000 is accessible on the WireGuard interface

**Verification**:
```bash
# Test from laptop (when away)
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/10.100.0.1/8000'
# Should succeed if tunnel is up
```

---

## 📋 Quick Reference

| Location | Coolify URL | Works? |
|----------|-------------|--------|
| **Home network** | `http://192.168.1.15:8000` | ✅ Yes (direct LAN) |
| **Home network** | `http://10.100.0.1:8000` | ✅ Yes (through VPN) |
| **Away network** | `http://192.168.1.15:8000` | ❌ No (not routed) |
| **Away network** | `http://10.100.0.1:8000` | ✅ Yes (through VPN) |

**Recommendation**: Use `http://10.100.0.1:8000` everywhere for consistency.

---

## 🔧 Optional: Route All Server Services Through VPN

If you want to access **all** server services (including at 192.168.1.x addresses), expand the allowed IPs:

### Modified Configuration

**Edit both configs** (`/etc/wireguard/wg0-home.conf` and `/etc/wireguard/wg0-away.conf`):

```ini
[Interface]
Address = 10.100.0.2/24
PrivateKey = qHhR4ujr6zf73bT/hRoZ0ipP35B9a+8pKXsYZy4d5F8=
MTU = 1420  # or 1280 for away

[Peer]
PublicKey = Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
Endpoint = 192.168.1.15:51820  # or wg.veritablegames.com:51820 for away
AllowedIPs = 10.100.0.1/32, 192.168.1.0/24  # ← Added 192.168.1.0/24
PersistentKeepalive = 25
```

### What This Does

- Routes **all** `192.168.1.x` traffic through the VPN tunnel
- Allows accessing services at their LAN IP addresses (192.168.1.15:8000)
- Enables access to other devices on the home network (router, NAS, etc.)

### Applying the Change

```bash
# Stop current tunnel
sudo wg-quick down wg0-away  # or wg0-home if testing at home

# Edit config
sudo nano /etc/wireguard/wg0-away.conf
# Add 192.168.1.0/24 to AllowedIPs

# Restart tunnel
sudo wg-quick up wg0-away

# Verify routing
ip route | grep wg0-away
# Should show: 192.168.1.0/24 dev wg0-away scope link
```

### ⚠️ Potential Issues

**Network conflicts**: If you connect to a network that uses `192.168.1.x` (very common), you'll have routing conflicts:
- Hotel/coffee shop with `192.168.1.x` subnet → Conflict
- Traffic meant for local network will go through VPN
- May cause connectivity issues

**Workaround**: Only add `192.168.1.0/24` to `wg0-home.conf` (not `wg0-away.conf`), since conflicts only happen when away.

---

## 🎯 Recommendation

**Keep the current setup** (`AllowedIPs = 10.100.0.1/32`) and use:
- ✅ `http://10.100.0.1:8000` for Coolify
- ✅ `ssh user@10.100.0.1` for SSH
- ✅ `http://10.100.0.1:3000` for Veritable Games app

This avoids routing conflicts while providing access to all services.

---

## Troubleshooting

### Coolify Not Loading at 10.100.0.1:8000

```bash
# 1. Check WireGuard tunnel is up
sudo wg show
# Should show "latest handshake" within last 2-3 minutes

# 2. Test connectivity
ping -c 3 10.100.0.1
# Should have 0% packet loss

# 3. Test port 8000
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/10.100.0.1/8000'
# Should succeed without errors

# 4. Check Coolify is running (from server)
ssh user@10.100.0.1 'docker ps --filter name=coolify'
# Should show coolify container running
```

### Still Not Working

- Verify you're using `http://` not `https://` (Coolify uses HTTP on port 8000)
- Check browser isn't caching old connection errors (try private/incognito window)
- Verify tunnel is using correct config: `sudo wg show | grep endpoint`
  - Should show `172.221.18.109:51820` or `192.168.1.15:51820`

---

**Document Version**: 1.0
**Last Updated**: November 16, 2025
**Status**: ✅ Working - Use VPN IP (10.100.0.1:8000)
