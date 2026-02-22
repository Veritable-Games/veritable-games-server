# WireGuard Public Network Fix - Session Summary

**Date**: February 13, 2026
**Duration**: ~15 minutes
**Status**: ✅ Resolved

---

## Issue

User on public network couldn't access server via WireGuard VPN. Interface was UP but had no connectivity.

## Root Cause

Wrong WireGuard interface active:
- **Active**: `wg0-home` (connects to LAN endpoint `192.168.1.15:51820`)
- **Needed**: `wg0-away` (connects to public endpoint `wg.veritablegames.com:51820`)

Private IP `192.168.1.15` is unreachable from public networks.

## Fix

```bash
nmcli connection down wg0-home
nmcli connection up wg0-away
```

## Result

✅ VPN fully operational:
- Ping to 10.100.0.1: 54ms, 0% loss
- Coolify accessible: http://10.100.0.1:8000
- App accessible: http://10.100.0.1:3000
- SSH working: user@10.100.0.1
- Bidirectional: Server can reach laptop

## Key Learnings

1. **Two interfaces for two scenarios**:
   - `wg0-home`: Use when on home network (192.168.1.x)
   - `wg0-away`: Use when on public/other networks

2. **Auto-switch system**: Installed but didn't trigger (no network change event occurred)

3. **Always use VPN IPs**: Use `10.100.0.1` instead of `192.168.1.15` when connected via VPN

## Documentation Created

- **Main**: `docs/server/wireguard/WIREGUARD_PUBLIC_NETWORK_FIX_FEB_2026.md` (comprehensive 15,000+ word guide)
- **Updated**: `docs/server/wireguard/README.md` (added references)

## Related Documents

- `WIREGUARD_DUAL_INTERFACE_ANALYSIS_FEB_2026.md` - Dual-interface conflicts
- `WIREGUARD_COOLIFY_ACCESS.md` - Use 10.100.0.1 not 192.168.1.15
- `WIREGUARD_AUTO_SWITCH_FAILURE_DEC_2025.md` - Previous auto-switch issues

## Quick Reference

```bash
# Check which interface is active
nmcli connection show --active | grep wg0

# Switch to away (public networks)
nmcli connection down wg0-home && nmcli connection up wg0-away

# Switch to home (home network)
nmcli connection down wg0-away && nmcli connection up wg0-home

# Test connectivity
ping -c 3 10.100.0.1
curl http://10.100.0.1:8000
ssh user@10.100.0.1
```
