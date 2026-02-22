# WireGuard Private Network Routing - Enhanced Setup
**Date**: December 7, 2025
**Status**: 🚀 Implementation Guide
**Goal**: Secure VPN access between private networks using WireGuard

---

## Overview

**Current Setup** (Local Network Only):
```
Laptop (192.168.1.175) ←→ Server (192.168.1.15)
   └─ WireGuard: 10.100.0.2 ←→ 10.100.0.1 ✅
```

**Enhanced Setup** (Private Network Access):
```
Laptop (Any Network) ←→ WireGuard Tunnel ←→ Server's Private Network
   
When Away:
  - Laptop at Starbucks (192.168.x.x) → WireGuard → Access 192.168.1.x devices
  - Laptop at Hotel (10.x.x.x) → WireGuard → Access 192.168.1.x devices

When Home:
  - Laptop (192.168.1.175) → Direct LAN (fast)
  - OR WireGuard tunnel (for consistency)
```

---

## Why This Matters

**Current Problem**:
- Can only access `10.100.0.1` (server VPN IP)
- Cannot access `192.168.1.x` network through the tunnel
- If you're on a different network (hotel, coffee shop, office), you can't reach home devices

**Solution**:
- Route entire `192.168.1.0/24` subnet through WireGuard tunnel
- Access any device on home network from anywhere
- Automatic failover between direct LAN and VPN

---

## Implementation: Two Approaches

### Approach A: Full Subnet Routing (Recommended)

**What it does**: Routes all traffic to `192.168.1.0/24` through the VPN tunnel

**Pros**:
- ✅ Can access any device on home network (printers, NAS, Coolify, etc.)
- ✅ Works from any network (coffee shop, hotel, office)
- ✅ Fast - local network traffic still goes direct when at home
- ✅ Single tunnel for all access

**Cons**:
- ⚠️ Network conflicts if you're on a network using `192.168.1.x` (common in hotels)
  - Solution: Two config files (one for home, one for away)
  - Auto-switch based on current network

**Setup Steps**:

#### Step 1: Modify Laptop WireGuard Config

**File**: `/etc/wireguard/wg0_laptop.conf` or `/tmp/wg0_laptop.conf`

Change this line:
```ini
AllowedIPs = 10.100.0.1/32         # Current: only server VPN IP
```

To this:
```ini
AllowedIPs = 10.100.0.0/24, 192.168.1.0/24    # Add: entire home network
```

**Full modified config**:
```ini
[Interface]
Address = 10.100.0.2/24
PrivateKey = qHhR4ujr6zf73bT/hRoZ0ipP35B9a+8pKXsYZy4d5F8=
MTU = 1420

[Peer]
PublicKey = Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
Endpoint = 192.168.1.15:51820
AllowedIPs = 10.100.0.0/24, 192.168.1.0/24    # ← CHANGED: Added 192.168.1.0/24
PersistentKeepalive = 25
```

#### Step 2: Reload WireGuard Interface

```bash
# Bring down current interface
sudo wg-quick down wg0_laptop

# Bring up with new config
sudo wg-quick up wg0_laptop

# Verify routes
ip route | grep wg0_laptop
# Should show:
#   192.168.1.0/24 dev wg0_laptop ...
#   10.100.0.0/24 dev wg0_laptop ...
```

#### Step 3: Test Connectivity

```bash
# Test access to server's private IP
ping 192.168.1.15
# Should work through WireGuard tunnel

# Test access to Coolify
curl http://192.168.1.15:8000
# Should work from anywhere

# Test access to any home device (if accessible)
ssh user@192.168.1.15
# Should work through tunnel
```

### Approach B: Split Configs (Recommended for Hotels/Conflicts)

**What it does**: Two different WireGuard configs - one for home, one for away

**Benefits**:
- ✅ Avoids network conflicts
- ✅ Works on any network (even `192.168.1.x` networks)
- ✅ Automatic switching based on network

#### Setup: Two Configs

**Config 1: Home Network** (`wg0_home.conf`)
```ini
[Interface]
Address = 10.100.0.2/24
PrivateKey = qHhR4ujr6zf73bT/hRoZ0ipP35B9a+8pKXsYZy4d5F8=
MTU = 1420
DNS = 192.168.1.1  # Home WiFi router

[Peer]
PublicKey = Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
Endpoint = 192.168.1.15:51820  # Direct local IP
AllowedIPs = 10.100.0.0/24, 192.168.1.0/24
PersistentKeepalive = 25
```

**Config 2: Away Network** (`wg0_away.conf`)
```ini
[Interface]
Address = 10.100.0.2/24
PrivateKey = qHhR4ujr6zf73bT/hRoZ0ipP35B9a+8pKXsYZy4d5F8=
MTU = 1280  # Smaller MTU for internet stability
DNS = 1.1.1.1  # Cloudflare DNS

[Peer]
PublicKey = Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
Endpoint = wg.veritablegames.com:51820  # Public DDNS (from your existing setup!)
AllowedIPs = 10.100.0.0/24, 192.168.1.0/24
PersistentKeepalive = 25
```

**Manual Switching**:
```bash
# When at home
sudo wg-quick down wg0_away
sudo wg-quick up wg0_home

# When away
sudo wg-quick down wg0_home
sudo wg-quick up wg0_away
```

**Automatic Switching** (Using NetworkManager):
```bash
# Import both configs
nmcli connection import type wireguard file /etc/wireguard/wg0_home.conf
nmcli connection import type wireguard file /etc/wireguard/wg0_away.conf

# Create dispatcher script to auto-switch
cat > /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch << 'EOF'
#!/bin/bash
# Auto-switch WireGuard config based on current network

INTERFACE=$1
ACTION=$2

if [ "$ACTION" != "up" ] && [ "$ACTION" != "down" ]; then
  exit 0
fi

# Get current network
GATEWAY=$(ip route | grep default | awk '{print $3}')
CURRENT_GATEWAY=$(ip route show | grep via | grep -v wg | head -1 | awk '{print $3}')

# Check if we're on home network (gateway is 192.168.1.x)
if echo "$CURRENT_GATEWAY" | grep -q "^192.168.1"; then
  # Home network - use wg0_home
  TARGET_CONFIG="wg0-home"
else
  # Away network - use wg0_away
  TARGET_CONFIG="wg0-away"
fi

# Switch configs if needed
CURRENT=$(nmcli -t -f NAME,DEVICE con show --active | grep wg0 | cut -d: -f1)

if [ "$CURRENT" != "$TARGET_CONFIG" ]; then
  echo "[$(date)] Switching WireGuard: $CURRENT → $TARGET_CONFIG"
  nmcli connection down "$CURRENT" 2>/dev/null || true
  nmcli connection up "$TARGET_CONFIG"
fi
EOF

chmod +x /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch
```

---

## Server-Side Configuration

Your server already has WireGuard configured correctly. Just verify it's set up for routing:

### Step 1: Enable IP Forwarding

```bash
ssh user@192.168.1.15

# Check if IP forwarding is enabled
cat /proc/sys/net/ipv4/ip_forward
# Should output: 1 (enabled)

# If not enabled:
sudo sysctl -w net.ipv4.ip_forward=1

# Persist it:
echo "net.ipv4.ip_forward = 1" | sudo tee -a /etc/sysctl.d/99-wg-forward.conf
sudo sysctl -p
```

### Step 2: Configure NAT/Routing (Optional)

If you want the server to act as a gateway for other devices on `192.168.1.x`:

```bash
ssh user@192.168.1.15

# Enable masquerading (NAT) for WireGuard traffic
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -A FORWARD -i wg0 -j ACCEPT
sudo iptables -A FORWARD -o wg0 -j ACCEPT

# Persist with iptables-persistent
sudo apt-get install iptables-persistent
sudo netfilter-persistent save
```

### Step 3: Verify Server Routing

```bash
ssh user@192.168.1.15

# Check WireGuard is listening
sudo wg show wg0

# Check firewall rules
sudo ufw status
# Make sure port 51820 is allowed

# Verify routes
ip route | grep 192.168.1
```

---

## Testing the Setup

### Test 1: Basic Connectivity

```bash
# From laptop (when away), connect to WireGuard
sudo wg-quick up wg0_away

# Ping server
ping 192.168.1.15
# Should work

# SSH to server
ssh user@192.168.1.15 "hostname"
# Should return: veritable-games-server
```

### Test 2: Access Services

```bash
# Access Coolify dashboard
curl -I http://192.168.1.15:8000

# Access application
curl -I http://192.168.1.15:3000

# Check services on network
nmap -p 22,80,443,8000,3000 192.168.1.15
```

### Test 3: From Different Networks

```bash
# Simulate being on a different network
# 1. Disconnect from home WiFi
# 2. Connect to different WiFi (or mobile hotspot)
# 3. Start WireGuard tunnel (wg0_away.conf)
# 4. Access server and services:

ssh user@192.168.1.15 "docker ps"
curl http://192.168.1.15:8000
```

---

## Troubleshooting

### Issue: "Network unreachable" error

```bash
# Check if tunnel is up
sudo wg show wg0_laptop
# Should show "latest handshake" within last minute

# Check routes
ip route | grep 192.168.1
# Should show 192.168.1.0/24 dev wg0_laptop

# If not:
sudo wg-quick down wg0_laptop
sudo wg-quick up wg0_laptop
```

### Issue: Slow performance to server

```bash
# Check latency
ping -c 5 192.168.1.15 | tail -1
# Should be < 50ms when at home, 30-100ms when away

# Check MTU (may need adjustment)
ip link show wg0_laptop
# If MTU is 1420, try lowering to 1280 for away config

# Check WireGuard handshake
sudo wg show wg0_laptop
# "latest handshake" should be recent (< 1 minute)
```

### Issue: Cannot access other devices on network

```bash
# By default, WireGuard only routes what's in AllowedIPs
# To access other devices (192.168.1.x):

# Option 1: Add to AllowedIPs (simplest)
# Already done in config above

# Option 2: Use server as gateway (more complex)
# Set up NAT on server (see Server-Side Configuration step 2)
```

---

## Security Considerations

### What This Enables

✅ **Secure Access**: All traffic encrypted through WireGuard tunnel
✅ **Private Network Access**: Can reach any device on home network
✅ **No Direct Exposure**: Services (Coolify, app) not exposed to internet

### What This Does NOT Do

❌ **Does NOT** expose services to public internet
  - You can only access them through the VPN
  - Direct internet access still requires Cloudflare tunnel or port forwarding

❌ **Does NOT** compromise home network security
  - Other devices can't access your laptop through the tunnel
  - One-way routing (laptop can access home, not the reverse)

### Best Practices

1. **Use wg0_away config when traveling**
   - Smaller MTU for better compatibility
   - Uses public DDNS endpoint
   - Avoids network conflicts

2. **Use wg0_home config at home**
   - Larger MTU for speed
   - Direct IP endpoint (faster local)
   - Full subnet routing safe at home

3. **Monitor handshake status**
   ```bash
   # Check tunnel is still active
   watch -n 5 'sudo wg show wg0_laptop | grep handshake'
   ```

4. **Keep WireGuard updated**
   ```bash
   # Check version
   wg --version
   
   # Update if needed
   sudo apt update && sudo apt upgrade -y
   ```

---

## Complete Implementation Checklist

**Laptop Configuration**:
- [ ] Create `/etc/wireguard/wg0_home.conf` with home settings
- [ ] Create `/etc/wireguard/wg0_away.conf` with away settings
- [ ] Import both configs to NetworkManager
- [ ] Create auto-switch dispatcher script
- [ ] Test switching manually first
- [ ] Test connectivity from different networks

**Server Configuration**:
- [ ] Verify IP forwarding enabled (`net.ipv4.ip_forward = 1`)
- [ ] Configure NAT rules if needed (optional)
- [ ] Verify WireGuard interface listening
- [ ] Verify firewall allows port 51820
- [ ] Test from multiple client locations

**Verification**:
- [ ] Ping server from away network works
- [ ] SSH from away network works
- [ ] Access Coolify from away network works
- [ ] Access other home devices from away network works
- [ ] Home network still accessible directly (not through VPN)
- [ ] Auto-switch works (if using dispatcher)

---

## Quick Reference

### When At Home
```bash
# Use home config for direct access
sudo wg-quick down wg0_away
sudo wg-quick up wg0_home

# Access server directly (fast)
ssh user@192.168.1.15
ping 192.168.1.15
```

### When Away
```bash
# Use away config with public endpoint
sudo wg-quick down wg0_home
sudo wg-quick up wg0_away

# Access server through encrypted tunnel
ssh user@192.168.1.15
curl http://192.168.1.15:8000
```

### Emergency: Direct Phone Hotspot
```bash
# If WiFi available:
# 1. Connect phone to WiFi at home
# 2. Start personal hotspot
# 3. Connect laptop to hotspot
# 4. Use wg0_home config
# = Instant VPN access to home network
```

---

## Next Steps

1. **Test current setup** works from home network
2. **Implement Approach B** (split configs) for flexibility
3. **Test from away network** (hotel WiFi, office, etc.)
4. **Set up auto-switch** for seamless experience
5. **Document your setup** with your specific IPs and configs

Once this is working, you'll have:
- ✅ Secure access to server from anywhere
- ✅ Access to all home network services (Coolify, apps, storage)
- ✅ Automatic switching between local and VPN access
- ✅ Works even when away on different networks
