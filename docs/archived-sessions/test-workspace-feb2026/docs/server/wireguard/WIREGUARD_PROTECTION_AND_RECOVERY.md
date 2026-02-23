# WireGuard VPN Protection & Recovery

**Date**: November 15, 2025
**Status**: ✅ PROTECTED - Private routing solution
**Purpose**: Prevent accidental breakage during public routing setup

---

## 🚨 CRITICAL: DO NOT MODIFY THESE COMPONENTS 🚨

### Protected WireGuard Configuration

**This VPN tunnel took THREE sessions to fix (Nov 5, 12, 15)** - do NOT break it again!

### ❌ ABSOLUTELY PROHIBITED

**NEVER do these without user approval:**

1. **❌ NEVER stop WireGuard interfaces**
   ```bash
   # DON'T RUN THESE:
   sudo wg-quick down wg0           # Server interface
   sudo wg-quick down wg0_laptop    # Laptop interface
   sudo systemctl stop wg-quick@wg0
   ```

2. **❌ NEVER modify WireGuard peer configurations**
   ```bash
   # DON'T RUN THESE:
   sudo wg set wg0 peer <key> remove
   sudo wg set wg0_laptop peer <key> remove
   ```

3. **❌ NEVER change routing for 10.100.0.0/24 subnet**
   ```bash
   # DON'T RUN THESE:
   sudo ip route del 10.100.0.0/24
   sudo ip route add 10.100.0.0/24 via <some-other-gateway>
   ```

4. **❌ NEVER start OpenVPN or conflicting VPN services**
   ```bash
   # DON'T RUN THESE:
   sudo systemctl start openvpn
   # OpenVPN previously broke WireGuard by routing 192.168.1.0/24 through tun0
   ```

5. **❌ NEVER modify these config files**
   - Server: `/etc/wireguard/wg0.conf`
   - Laptop: `/etc/wireguard/wg0_laptop.conf` or `/tmp/wg0_laptop.conf`

### ✅ PROTECTED RESOURCES

**Server (192.168.1.15)**:
```
Interface: wg0
  Address: 10.100.0.1/24
  Listen Port: 51820
  Public Key: Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=
  Peer: brTvUtYCQYlWdc1WkIFChLsvYhQZ1nmyxF4BjQ11DSY= (laptop)
  Allowed IPs: 10.100.0.2/32
```

**Laptop (192.168.1.175)**:
```
Interface: wg0_laptop
  Address: 10.100.0.2/24
  Listen Port: 44780
  Public Key: brTvUtYCQYlWdc1WkIFChLsvYhQZ1nmyxF4BjQ11DSY=
  Peer: Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg= (server)
  Allowed IPs: 10.100.0.1/32
  Persistent Keepalive: 25 seconds
```

---

## 🔒 Protection Measures

### 1. Configuration Backups (Automated)

**Server backup location**: `/home/user/wireguard-backups/`
**Laptop backup location**: `/home/user/wireguard-backups/`

**Backup script** (already run, configurations saved):
```bash
#!/bin/bash
# Location: /home/user/wireguard-backups/backup-wg-config.sh

BACKUP_DIR="/home/user/wireguard-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Server
if [ "$(hostname)" = "veritable-games-server" ]; then
  sudo cp /etc/wireguard/wg0.conf "$BACKUP_DIR/wg0.conf.$TIMESTAMP"
  sudo wg show wg0 > "$BACKUP_DIR/wg0-status.$TIMESTAMP.txt"
fi

# Laptop
if [ "$(hostname)" = "remote" ]; then
  sudo cp /etc/wireguard/wg0_laptop.conf "$BACKUP_DIR/wg0_laptop.conf.$TIMESTAMP" 2>/dev/null || \
  sudo cp /tmp/wg0_laptop.conf "$BACKUP_DIR/wg0_laptop.conf.$TIMESTAMP"
  sudo wg show wg0_laptop > "$BACKUP_DIR/wg0_laptop-status.$TIMESTAMP.txt"
fi

echo "✅ WireGuard config backed up to $BACKUP_DIR"
```

### 2. Verification Script

**Location**: `/home/user/wireguard-backups/verify-wg-tunnel.sh`

```bash
#!/bin/bash
# Verify WireGuard tunnel is operational

echo "=== WireGuard Tunnel Verification ==="
echo ""

if [ "$(hostname)" = "veritable-games-server" ]; then
  INTERFACE="wg0"
  REMOTE_IP="10.100.0.2"
  REMOTE_NAME="laptop"
elif [ "$(hostname)" = "remote" ]; then
  INTERFACE="wg0_laptop"
  REMOTE_IP="10.100.0.1"
  REMOTE_NAME="server"
else
  echo "❌ Unknown hostname"
  exit 1
fi

# Check interface exists
if ! ip link show $INTERFACE &>/dev/null; then
  echo "❌ Interface $INTERFACE not found"
  echo "   Run: sudo wg-quick up $INTERFACE"
  exit 1
fi

echo "✅ Interface $INTERFACE exists"

# Check WireGuard status
if ! sudo wg show $INTERFACE &>/dev/null; then
  echo "❌ WireGuard not running on $INTERFACE"
  exit 1
fi

echo "✅ WireGuard running on $INTERFACE"

# Check peer configuration
PEER_COUNT=$(sudo wg show $INTERFACE peers | wc -l)
if [ "$PEER_COUNT" -eq 0 ]; then
  echo "❌ No peers configured"
  exit 1
fi

echo "✅ Peer configured ($PEER_COUNT peer)"

# Check handshake
HANDSHAKE=$(sudo wg show $INTERFACE latest-handshakes | awk '{print $2}')
CURRENT_TIME=$(date +%s)
TIME_SINCE_HANDSHAKE=$((CURRENT_TIME - HANDSHAKE))

if [ "$TIME_SINCE_HANDSHAKE" -gt 180 ]; then
  echo "⚠️  Last handshake: ${TIME_SINCE_HANDSHAKE}s ago (>3 minutes - may be stale)"
else
  echo "✅ Recent handshake: ${TIME_SINCE_HANDSHAKE}s ago"
fi

# Test connectivity
echo ""
echo "Testing connectivity to $REMOTE_NAME ($REMOTE_IP)..."
if ping -c 3 -W 2 $REMOTE_IP &>/dev/null; then
  echo "✅ Ping successful (0% packet loss)"
else
  echo "❌ Ping failed"
  exit 1
fi

# Test SSH (optional, may require key)
if timeout 5 ssh -o ConnectTimeout=3 -o BatchMode=yes user@$REMOTE_IP "echo 'SSH OK'" &>/dev/null; then
  echo "✅ SSH accessible"
else
  echo "⚠️  SSH not accessible (may need key authorization)"
fi

echo ""
echo "=== ✅ WireGuard tunnel fully operational ==="
```

### 3. Read-Only Configuration Protection

**Make configs read-only** (prevents accidental overwrites):

```bash
# Server
sudo chmod 400 /etc/wireguard/wg0.conf
sudo chown root:root /etc/wireguard/wg0.conf

# Laptop
sudo chmod 400 /etc/wireguard/wg0_laptop.conf
sudo chown root:root /etc/wireguard/wg0_laptop.conf
```

**To modify** (requires explicit intent):
```bash
sudo chmod 600 /etc/wireguard/wg0.conf     # Make writable
# Edit file
sudo chmod 400 /etc/wireguard/wg0.conf     # Make read-only again
```

### 4. Systemd Service Protection

**Enable persistent WireGuard service**:

```bash
# Server
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0

# Laptop
sudo systemctl enable wg-quick@wg0_laptop
sudo systemctl start wg-quick@wg0_laptop
```

**Check status**:
```bash
# Server
sudo systemctl status wg-quick@wg0

# Laptop
sudo systemctl status wg-quick@wg0_laptop
```

---

## 📋 Public Routing Setup Guidelines

### Separation Strategy

**Private Routing (WireGuard - PROTECTED)**:
- Subnet: `10.100.0.0/24`
- Purpose: Server ↔ Laptop SSH access
- Interface: `wg0` (server), `wg0_laptop` (laptop)
- **DO NOT TOUCH**

**Public Routing (New Setup - SEPARATE)**:
- Use different subnet (e.g., `10.200.0.0/24`, `10.8.0.0/24`)
- Use different interface names (e.g., `wg1`, `wg_public`, `cloudflared`)
- Different ports (avoid 51820, 44780)
- **Keep completely separate from private WireGuard**

### Safe Public Routing Options

**Option 1: Cloudflare Tunnel** (Recommended)
- ✅ No VPN conflicts (uses HTTP tunnel)
- ✅ No routing table changes needed
- ✅ Separate from WireGuard completely
- Tool: `cloudflared tunnel`
- Docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

**Option 2: WireGuard on Different Interface**
- ✅ Use `wg1` or `wg_public` interface (NOT `wg0`)
- ✅ Use different subnet: `10.200.0.0/24`
- ✅ Different port: `51821` (NOT 51820)
- Example config: `/etc/wireguard/wg1.conf`

**Option 3: Tailscale** (Mesh VPN)
- ✅ Separate daemon, no conflict with WireGuard
- ✅ Uses `tailscale0` interface
- ✅ Automatic key rotation and routing
- Tool: `tailscale`

**Option 4: ngrok / localtunnel**
- ✅ HTTP tunneling, no VPN conflicts
- ✅ No system-level routing changes
- ✅ Easiest for quick public access

### ❌ Unsafe Approaches

**DO NOT use these (will break WireGuard)**:
- ❌ Reusing `wg0` or `wg0_laptop` for public routing
- ❌ Changing routes for `10.100.0.0/24` subnet
- ❌ Starting OpenVPN (routing conflicts)
- ❌ Modifying existing WireGuard peer configurations
- ❌ Using port 51820 or 44780 for public routing

---

## 🔧 Recovery Procedures

### If WireGuard Tunnel Breaks

**1. Check if interface is up**:
```bash
# Server
sudo wg show wg0

# Laptop
sudo wg show wg0_laptop
```

**If interface not found**:
```bash
# Server
sudo wg-quick up wg0

# Laptop
sudo wg-quick up wg0_laptop
```

**2. Check peer configuration**:
```bash
# Should show peer with recent handshake
sudo wg show <interface>
```

**If no peer or stale handshake**:
```bash
# Server - re-add laptop peer
sudo wg set wg0 peer brTvUtYCQYlWdc1WkIFChLsvYhQZ1nmyxF4BjQ11DSY= allowed-ips 10.100.0.2/32

# Laptop - restart interface
sudo wg-quick down wg0_laptop
sudo wg-quick up wg0_laptop
```

**3. Check routing table**:
```bash
ip route | grep 10.100
```

**Expected routes**:
- Server: `10.100.0.0/24 dev wg0 proto kernel scope link src 10.100.0.1`
- Laptop: `10.100.0.0/24 dev wg0_laptop proto kernel scope link src 10.100.0.2`

**If routes missing**:
```bash
# Restart WireGuard interface (recreates routes)
sudo wg-quick down <interface>
sudo wg-quick up <interface>
```

**4. Check for routing conflicts**:
```bash
# Check if OpenVPN is running
systemctl status openvpn

# Check for conflicting routes
ip route | grep 192.168.1
```

**If OpenVPN is running**:
```bash
sudo systemctl stop openvpn
sudo ip route del 192.168.1.0/24 via 10.200.0.1 dev tun0  # If exists
```

### Full Reset (Nuclear Option)

**If everything is broken**, restore from backup:

```bash
# 1. Stop current WireGuard
sudo wg-quick down wg0  # or wg0_laptop on laptop

# 2. Restore config from backup
sudo cp /home/user/wireguard-backups/wg0.conf.YYYYMMDD_HHMMSS /etc/wireguard/wg0.conf

# 3. Restart WireGuard
sudo wg-quick up wg0

# 4. Verify
bash /home/user/wireguard-backups/verify-wg-tunnel.sh
```

---

## 📊 Monitoring

### Daily Health Check

```bash
# Run verification script
bash /home/user/wireguard-backups/verify-wg-tunnel.sh
```

### Weekly Backup

```bash
# Backup current config
bash /home/user/wireguard-backups/backup-wg-config.sh
```

### Signs of Problems

**Watch for these**:
- ⚠️ Handshake older than 3 minutes
- ⚠️ Ping timeout to remote VPN IP
- ⚠️ SSH timeout to remote VPN IP
- ⚠️ WireGuard interface missing from `ip link show`
- ⚠️ No peer in `wg show <interface>`

---

## 📖 Quick Command Reference

### Server Commands

```bash
# Status
sudo wg show wg0
systemctl status wg-quick@wg0
ping -c 3 10.100.0.2

# Restart
sudo wg-quick down wg0
sudo wg-quick up wg0

# SSH to laptop
ssh user@10.100.0.2

# Backup
bash /home/user/wireguard-backups/backup-wg-config.sh

# Verify
bash /home/user/wireguard-backups/verify-wg-tunnel.sh
```

### Laptop Commands

```bash
# Status
sudo wg show wg0_laptop
systemctl status wg-quick@wg0_laptop
ping -c 3 10.100.0.1

# Restart
sudo wg-quick down wg0_laptop
sudo wg-quick up wg0_laptop

# SSH to server
ssh user@10.100.0.1

# Backup
bash /home/user/wireguard-backups/backup-wg-config.sh

# Verify
bash /home/user/wireguard-backups/verify-wg-tunnel.sh
```

---

## 🎯 Summary

**Protected Components**:
- ✅ WireGuard interfaces: `wg0` (server), `wg0_laptop` (laptop)
- ✅ VPN subnet: `10.100.0.0/24`
- ✅ Config files: `/etc/wireguard/*.conf`
- ✅ Systemd services: `wg-quick@wg0`, `wg-quick@wg0_laptop`

**Protection Methods**:
- ✅ Configuration backups (automated)
- ✅ Verification script (health checks)
- ✅ Read-only config files
- ✅ Systemd service persistence
- ✅ Documentation warnings

**For Public Routing**:
- ✅ Use separate interfaces/subnets
- ✅ Recommended: Cloudflare Tunnel (no conflicts)
- ✅ Alternative: WireGuard on `wg1` with `10.200.0.0/24`
- ❌ Never modify existing `wg0`/`wg0_laptop` setup

**If Something Breaks**:
1. Run verification script: `bash /home/user/wireguard-backups/verify-wg-tunnel.sh`
2. Check this document's recovery procedures
3. Restore from backup if needed

---

**Document Version**: 1.0
**Last Updated**: November 15, 2025
**Status**: ✅ Protected - Private WireGuard VPN
