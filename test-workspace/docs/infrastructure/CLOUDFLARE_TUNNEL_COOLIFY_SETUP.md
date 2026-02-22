# Cloudflare Tunnel - Coolify Public Access

**Date**: February 9, 2026
**Status**: Active and working

## Overview

Coolify admin interface is now publicly accessible via Cloudflare Tunnel at:
**https://coolify.veritablegames.com**

## Configuration

### Tunnel Details
- **Tunnel Name**: veritable-games
- **Tunnel ID**: `b74fbc5b-0d7c-419d-ba50-0bf848f53993`
- **Service**: Managed via Cloudflare Zero Trust dashboard (token-based)

### Routes Configured
| Hostname | Service | Purpose |
|----------|---------|---------|
| `veritablegames.com` | `http://localhost:3000` | Main website |
| `www.veritablegames.com` | `http://localhost:3000` | Main website (www) |
| `coolify.veritablegames.com` | `http://localhost:8000` | Coolify admin panel |
| `btcpay.veritablegames.com` | `http://10.0.3.9:49392` | BTCPay Server |
| `ws.veritablegames.com` | `http://localhost:3002` | WebSocket server |

### Server Configuration
- **cloudflared version**: 2026.2.0
- **Service**: `/etc/systemd/system/cloudflared.service` (enabled)
- **Apt repo**: Cloudflare official repo configured for auto-updates

## Managing Routes

To add/modify routes:
1. Go to: https://one.dash.cloudflare.com/
2. Navigate: **Networks** → **Tunnels** → **veritable-games**
3. Click **Published application routes** tab
4. Add or edit hostname routes

## DDNS Configuration (WireGuard)

The DDNS for WireGuard VPN is also configured:
- **Domain**: `wg.veritablegames.com`
- **Script**: `/usr/local/bin/cloudflare-ddns-update.py`
- **Config**: `/etc/cloudflare-ddns/.env`
- **Timer**: Runs every 5 minutes via systemd

### DDNS Credentials
```
CLOUDFLARE_API_TOKEN=6Xs7IM4CS13DwRBaWvbU3pX5g4_Kw3gnAoNsz2BB
CLOUDFLARE_ZONE_ID=9151263ddaf6aa95026ec46c6404435a
DDNS_DOMAIN=wg.veritablegames.com
```

## Troubleshooting

### Check tunnel status
```bash
sudo systemctl status cloudflared
```

### View tunnel logs
```bash
sudo journalctl -u cloudflared -f
```

### Check DDNS status
```bash
sudo systemctl status cloudflare-ddns.timer
sudo journalctl -u cloudflare-ddns.service --since "1 hour ago"
```

### Manual DDNS update
```bash
sudo systemctl start cloudflare-ddns.service
```

## Security Notes

- Coolify admin panel is publicly accessible - ensure strong password
- DDNS API token has limited scope (DNS edit for veritablegames.com only)
- WireGuard VPN uses strong cryptographic authentication
