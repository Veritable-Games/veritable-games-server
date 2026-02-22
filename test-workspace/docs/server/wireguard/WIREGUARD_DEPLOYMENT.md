# Deploy WireGuard Private Network Access - Quick Start

**Status**: Ready to deploy
**Date**: December 7, 2025

---

## What You Now Have

All configuration files are ready in your repository at:
```
wireguard-configs/
├── wg0_home.conf          # Config for home network
├── wg0_away.conf          # Config for away/remote networks
├── 99-wireguard-auto-switch  # Auto-switching dispatcher
├── setup-wireguard.sh     # Automated setup script
└── README.md              # Full documentation
```

## Deploy to Laptop (5 minutes)

### Option A: Automated Setup (Recommended)

```bash
# Clone/pull latest repo
git pull origin main

# Navigate to configs
cd wireguard-configs

# Run setup script
sudo bash setup-wireguard.sh --laptop

# Script will:
# ✓ Install wg0_home.conf to /etc/wireguard/
# ✓ Install wg0_away.conf to /etc/wireguard/
# ✓ Import both to NetworkManager
# ✓ Install auto-switch dispatcher
# ✓ Run connectivity tests
```

### Option B: Manual Setup

```bash
# Copy configs
sudo cp wireguard-configs/wg0_home.conf /etc/wireguard/
sudo cp wireguard-configs/wg0_away.conf /etc/wireguard/
sudo chmod 600 /etc/wireguard/wg0_*.conf

# Import to NetworkManager
sudo nmcli connection import type wireguard file /etc/wireguard/wg0_home.conf
sudo nmcli connection import type wireguard file /etc/wireguard/wg0_away.conf

# Install dispatcher
sudo cp wireguard-configs/99-wireguard-auto-switch /etc/NetworkManager/dispatcher.d/
sudo chmod +x /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch

# Test
sudo wg-quick up wg0_home
ping 192.168.1.15  # Should work
sudo wg-quick down wg0_home
```

## Deploy to Server (5 minutes)

### Option A: Automated Setup

```bash
# SSH to server
ssh user@192.168.1.15

# Clone/pull latest repo
git pull origin main
cd wireguard-configs

# Run setup script
sudo bash setup-wireguard.sh --server

# Script will:
# ✓ Enable IP forwarding
# ✓ Configure NAT rules
# ✓ Open firewall port 51820
# ✓ Verify WireGuard is running
```

### Option B: Manual Setup

```bash
# SSH to server
ssh user@192.168.1.15

# Enable IP forwarding
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward = 1" | sudo tee -a /etc/sysctl.d/99-wg-forward.conf
sudo sysctl -p

# Setup NAT (optional, for inter-network routing)
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -A FORWARD -i wg0 -j ACCEPT
sudo iptables -A FORWARD -o wg0 -j ACCEPT
sudo apt-get install iptables-persistent
sudo netfilter-persistent save

# Verify WireGuard
sudo wg show wg0
```

## Verify It Works

### Test 1: From Home Network

```bash
# Activate tunnel
sudo wg-quick up wg0_home

# Check status
sudo wg show wg0_home

# Ping server through tunnel
ping 192.168.1.15

# Access Coolify
curl -I http://192.168.1.15:8000

# SSH to server
ssh user@192.168.1.15

# Turn off
sudo wg-quick down wg0_home
```

### Test 2: From Different Network

```bash
# Disconnect from home WiFi
# Connect to different network (office, coffee shop, hotel, hotspot)

# Manually activate away config
sudo wg-quick up wg0_away

# Verify tunnel is up
sudo wg show wg0_away
# Should show "latest handshake: X seconds ago"

# Test connectivity (through tunnel)
ping 192.168.1.15
ssh user@192.168.1.15
curl http://192.168.1.15:8000

# Turn off
sudo wg-quick down wg0_away
```

### Test 3: Auto-Switch

```bash
# At home, start WireGuard
sudo wg-quick up wg0_home

# Monitor auto-switch events
sudo journalctl -t wireguard-switch -f

# Change WiFi networks and watch it auto-switch
# (Switch from home network to mobile hotspot, etc.)

# Should see log entries like:
# [wireguard-switch] Home network detected - Action: up
# [wireguard-switch] Away network detected - Action: up
# [wireguard-switch] Switching WireGuard: wg0-home → wg0-away
```

## What This Enables

### From Anywhere
```bash
# SSH directly to server
ssh user@192.168.1.15

# Access Coolify dashboard
curl http://192.168.1.15:8000
# Or in browser: http://192.168.1.15:8000

# Access your application
curl http://192.168.1.15:3000

# Access any device on home network
ping 192.168.1.1    # Router
ssh user@192.168.1.20  # Any machine on network
```

### No Exposure to Internet
- Services NOT exposed to public internet
- Only accessible through VPN tunnel
- All traffic encrypted end-to-end
- Laptop's private IP hidden from internet

### Automatic Switching
- Detects home/away network automatically
- Switches config seamlessly
- No manual switching needed
- Works on WiFi + mobile hotspots

## Network Architecture

```
┌─────────────────────────────────────────────────┐
│         Your Home Network (192.168.1.0/24)     │
├─────────────────────────────────────────────────┤
│                                                 │
│  Server (192.168.1.15)                         │
│  ├─ Coolify (port 8000)                        │
│  ├─ Application (port 3000)                    │
│  ├─ Docker containers                          │
│  └─ PostgreSQL database                        │
│                                                 │
│  WireGuard VPN IP: 10.100.0.1                  │
│  Listening: UDP port 51820                     │
│                                                 │
└─────────────────────────────────────────────────┘
           ↑
           │ Encrypted VPN Tunnel
           │ UDP/51820
           ↓
┌─────────────────────────────────────────────────┐
│  Your Laptop (Remote Location)                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  WireGuard VPN IP: 10.100.0.2                  │
│                                                 │
│  When at home:                                  │
│  ├─ Connect via: 192.168.1.15:51820            │
│  └─ Endpoint: Direct LAN IP                    │
│                                                 │
│  When away:                                     │
│  ├─ Connect via: wg.veritablegames.com:51820   │
│  └─ Endpoint: Public DDNS                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Troubleshooting

### Can't Connect
```bash
# Check tunnel is up
sudo wg show

# Check routes
ip route | grep wg0

# Test ping
ping 10.100.0.1

# Check firewall
sudo ufw status
# Should allow 51820/udp
```

### Auto-Switch Not Working
```bash
# Check dispatcher is installed
ls -la /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch

# Monitor dispatcher
sudo journalctl -t wireguard-switch -f

# Monitor NetworkManager
sudo journalctl -u NetworkManager -f

# Manual test
ip route show | grep "^default"
```

### Slow Performance
```bash
# Check MTU
ip link show wg0_home
# home = 1420 (local, faster)
# away = 1280 (internet, safer)

# Check latency
ping -c 5 192.168.1.15 | tail -1

# Check handshake status
sudo wg show wg0_home | grep "latest handshake"
```

## Documentation

For detailed information, see:
- `wireguard-configs/README.md` - Full setup guide
- `docs/server/WIREGUARD_PRIVATE_NETWORK_ROUTING.md` - Implementation details
- `docs/server/WIREGUARD_COOLIFY_ACCESS.md` - Accessing Coolify over VPN

## Quick Commands Reference

```bash
# Start home tunnel
sudo wg-quick up wg0_home

# Start away tunnel
sudo wg-quick up wg0_away

# Check status
sudo wg show

# Stop tunnel
sudo wg-quick down wg0_home

# Monitor auto-switch logs
sudo journalctl -t wireguard-switch -f

# Test connectivity
ping 192.168.1.15

# SSH to server
ssh user@192.168.1.15

# Access Coolify
curl http://192.168.1.15:8000
```

## Next Steps

1. ✅ **Pull latest repo** - Get the new configs
2. ⬜ **Deploy to laptop** - Run setup script (5 min)
3. ⬜ **Deploy to server** - Run setup script (5 min)
4. ⬜ **Test at home** - Verify wg0_home works
5. ⬜ **Test away** - Use phone hotspot, verify wg0_away works
6. ⬜ **Enable auto-switch** - Change networks, watch it switch
7. ⬜ **Enjoy** - Access server from anywhere securely!

---

**Total Setup Time**: ~15 minutes
**Downtime**: ~2 minutes (brief WireGuard config changes)
**Risk Level**: Very Low (non-breaking changes, can rollback immediately)

Ready to go! 🚀
