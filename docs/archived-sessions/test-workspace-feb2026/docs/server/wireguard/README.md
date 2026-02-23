# WireGuard Private Network Routing - Configuration Files

This directory contains ready-to-deploy WireGuard configurations for secure VPN access to your home network from anywhere.

## Files

- `wg0_home.conf` - WireGuard config for when at home on local network
- `wg0_away.conf` - WireGuard config for when away on different networks
- `99-wireguard-auto-switch` - NetworkManager dispatcher script for automatic switching
- `setup-wireguard.sh` - Automated setup script that deploys everything

## Quick Start

### Option 1: Automatic Setup (Recommended)

```bash
# On Laptop:
cd wireguard-configs
sudo ./setup-wireguard.sh --laptop

# On Server:
sudo ./setup-wireguard.sh --server

# Or both at once (requires access to both machines):
sudo ./setup-wireguard.sh --all
```

### Option 2: Manual Setup

#### On Laptop:

```bash
# Copy configs to WireGuard directory
sudo cp wg0_home.conf /etc/wireguard/wg0_home.conf
sudo cp wg0_away.conf /etc/wireguard/wg0_away.conf
sudo chmod 600 /etc/wireguard/wg0_*.conf

# Import into NetworkManager
sudo nmcli connection import type wireguard file /etc/wireguard/wg0_home.conf
sudo nmcli connection import type wireguard file /etc/wireguard/wg0_away.conf

# Install auto-switch dispatcher
sudo cp 99-wireguard-auto-switch /etc/NetworkManager/dispatcher.d/
sudo chmod +x /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch

# Test
sudo wg-quick up wg0_home
ping 192.168.1.15
sudo wg-quick down wg0_home
```

#### On Server:

```bash
# Enable IP forwarding
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward = 1" | sudo tee -a /etc/sysctl.d/99-wg-forward.conf
sudo sysctl -p

# (Optional) Setup NAT for inter-network routing
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -A FORWARD -i wg0 -j ACCEPT
sudo iptables -A FORWARD -o wg0 -j ACCEPT
sudo apt-get install iptables-persistent
sudo netfilter-persistent save

# Verify WireGuard is listening
sudo wg show wg0
```

## What This Does

### When at Home
- Laptop uses `wg0_home.conf`
- Connects to server at local IP `192.168.1.15:51820`
- Has access to entire home network `192.168.1.0/24`
- Uses larger MTU (1420) for better speed
- Uses home router DNS (192.168.1.1)

### When Away
- Laptop automatically switches to `wg0_away.conf`
- Connects to server via public DDNS `wg.veritablegames.com:51820`
- Still has access to entire home network `192.168.1.0/24`
- Uses smaller MTU (1280) for internet stability
- Uses Cloudflare DNS (1.1.1.1) for privacy

### Automatic Switching
- NetworkManager dispatcher monitors network changes
- Automatically switches between configs based on gateway IP
- No manual intervention needed
- Seamless experience whether at home or away

## Testing

### Basic Connectivity
```bash
# Test from laptop (at home)
sudo wg-quick up wg0_home
ping 192.168.1.15

# If using auto-switch, verify it's active
nmcli connection show --active | grep wg0

# Check handshake with server
sudo wg show wg0_home | grep "latest handshake"
```

### Access Services
```bash
# SSH to server
ssh user@192.168.1.15

# Access Coolify dashboard
curl -I http://192.168.1.15:8000

# Access application
curl -I http://192.168.1.15:3000

# Access other home devices
ping 192.168.1.1  # (router)
```

### From Different Network
```bash
# Disconnect from home WiFi
# Connect to different network (office, hotel, phone hotspot)
# Manually start WireGuard
sudo wg-quick up wg0_away

# Test connectivity (should work through tunnel)
ping 192.168.1.15
ssh user@192.168.1.15
curl http://192.168.1.15:8000
```

## Troubleshooting

### Connection Refused
```bash
# Check if tunnel is up
sudo wg show wg0_home
# Should show "latest handshake: X seconds ago"

# If not, restart tunnel
sudo wg-quick down wg0_home
sudo wg-quick up wg0_home
```

### Cannot Reach 192.168.1.x Network
```bash
# Verify routes are set up
ip route | grep wg0

# Should show:
# 192.168.1.0/24 dev wg0_home ...
# 10.100.0.0/24 dev wg0_home ...

# If not, restart WireGuard
sudo wg-quick down wg0_home
sudo wg-quick up wg0_home
```

### Slow Performance
```bash
# Check latency
ping -c 5 192.168.1.15

# If slow, check MTU (might need adjustment)
ip link show wg0_home | grep mtu

# For away config, 1280 is safer than 1420
```

### Auto-Switch Not Working
```bash
# Check dispatcher script is installed
ls -la /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch

# Check permissions
sudo chmod +x /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch

# Monitor NetworkManager
sudo journalctl -u NetworkManager -f

# Monitor dispatcher
sudo journalctl -t wireguard-switch -f

# Manually check what should happen
ip route show | grep "^default"  # Check current gateway
```

### Both Interfaces Up (Dual Interface Conflict)
If you see BOTH `wg0-home` and `wg0-away` active simultaneously:
```bash
# Check current state
ip link show | grep wg0

# If both are up, manually fix:
sudo wg-quick down wg0-home
sudo wg-quick down wg0-away

# Start the correct one
# (home network = 192.168.1.x gateway)
sudo wg-quick up wg0-home
# (away network = any other gateway)
sudo wg-quick up wg0-away
```

**Root cause**: Both configs use the same IP (`10.100.0.2/24`), causing binding conflicts.

**Fix**: Deploy the v2 auto-switch script:
```bash
sudo cp docs/server/wireguard/configs/99-wireguard-auto-switch-v2 \
        /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch
sudo chmod 755 /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch
```

See: `WIREGUARD_DUAL_INTERFACE_ANALYSIS_FEB_2026.md` for full details.

### Server Not Responding
```bash
# On server, verify WireGuard is running
ssh user@192.168.1.15
sudo wg show wg0

# Check if it sees the laptop peer
sudo wg show wg0 | grep peer

# Check if port 51820 is listening
sudo ss -tulpn | grep 51820

# Check if IP forwarding is enabled
cat /proc/sys/net/ipv4/ip_forward
# Should output: 1
```

## Security Notes

- ✅ All traffic encrypted end-to-end
- ✅ Private network never exposed to internet
- ✅ Only accessible through authenticated WireGuard tunnel
- ✅ Standard Linux firewall rules apply
- ✅ Can be disabled anytime

## Configuration Details

### Laptop Keys
- **Private Key**: `qHhR4ujr6zf73bT/hRoZ0ipP35B9a+8pKXsYZy4d5F8=`
- **Public Key**: `brTvUtYCQYlWdc1WkIFChLsvYhQZ1nmyxF4BjQ11DSY=`
- **VPN Address**: `10.100.0.2/24`

### Server Keys
- **Public Key**: `Fje4Wkq4CM43yM5poesfGcDcD8Jvv90A279D2i1E5Vg=`
- **VPN Address**: `10.100.0.1/24`
- **Listen Port**: `51820/UDP`

### WireGuard Endpoints
- **Home**: `192.168.1.15:51820` (direct local IP)
- **Away**: `wg.veritablegames.com:51820` (public DDNS)

## Maintenance

### Monitoring
```bash
# Check tunnel status
sudo wg show

# Monitor logs
sudo journalctl -u systemd-networkd -f

# Check auto-switch
sudo journalctl -t wireguard-switch -f
```

### Updating Configs
If you need to change settings:

1. Edit the relevant `.conf` file
2. Reload NetworkManager: `nmcli connection reload`
3. Restart the connection: `nmcli connection down wg0-home && nmcli connection up wg0-home`

### Disabling VPN
```bash
# Temporarily
sudo wg-quick down wg0_home

# Permanently (disable auto-connect)
nmcli connection modify wg0-home connection.autoconnect false
```

## Support

For detailed setup documentation, see:
- `docs/server/WIREGUARD_PRIVATE_NETWORK_ROUTING.md` - Complete implementation guide
- `docs/server/WIREGUARD_COOLIFY_ACCESS.md` - Accessing Coolify over VPN
- `docs/server/WIREGUARD_PUBLIC_ROUTING_SESSION_NOV_2025.md` - Public network setup
- `docs/server/WIREGUARD_PUBLIC_NETWORK_FIX_FEB_2026.md` - Troubleshooting wrong interface on public network
- `docs/server/WIREGUARD_DUAL_INTERFACE_ANALYSIS_FEB_2026.md` - Dual-interface conflicts and v2 auto-switch fix

## References

- WireGuard Documentation: https://www.wireguard.com/
- NetworkManager Dispatcher: https://developer.gnome.org/NetworkManager/stable/
- Your Coolify Server: http://192.168.1.15:8000 (through VPN)
