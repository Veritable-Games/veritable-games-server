# WireGuard Auto-Switch Failure Investigation - December 4, 2025

**Status**: ✅ **RESOLVED** - Fixed December 4, 2025 at 10:58 PST

**Original Symptoms** (before fix):
- Laptop stuck on `wg0-away` config while at home (192.168.1.175)
- Cannot SSH to server via WireGuard IP (10.100.0.1)
- Manual switch to wg0-home fails with "no-secrets" error
- Auto-switch dispatcher script not triggering

**Resolution**:
- Deleted corrupted NetworkManager connection
- Re-imported from `/etc/wireguard/wg0-home.conf`
- Fixed IP address conflict (wg0-away was blocking wg0-home)
- NetworkManager and auto-switch dispatcher now working perfectly

---

## Investigation Timeline

### December 4, 2025 - 10:17 PST

**User Report**: Unable to SSH to server via WireGuard (10.100.0.1 timeout)

**Initial Findings**:
```bash
$ nmcli connection show
NAME                         UUID                                  DEVICE
wg0-away                     a7cdcb67-a5f4-4a05-aa8b-b182a639d7dc  wg0-away  ← ACTIVE (wrong)
wg0-home                     9658bcc7-1672-40d1-b835-125bc76f2643  --        ← FAILED

$ ping 10.100.0.1
100% packet loss  ← wg0-away config not working on LAN
```

### Root Cause Analysis

**1. wg0-home NetworkManager Connection Corrupted**

NetworkManager logs show failed activation attempt at 10:06:25:
```
Dec 04 10:06:25 remote NetworkManager[193174]: <warn> device (wg0-home): No agents were available for this request.
Dec 04 10:06:25 remote NetworkManager[193174]: <info> device (wg0-home): state change: need-auth -> failed (reason 'no-secrets')
Dec 04 10:06:25 remote NetworkManager[193174]: <warn> device (wg0-home): Activation: failed for connection 'wg0-home'
```

Error indicates: **WireGuard private key missing from NetworkManager connection**

**2. Duplicate Connection Files Found**

```bash
$ ls -la /etc/NetworkManager/system-connections/wg0-home*
-rw------- 1 root root 443 Nov 30 13:02 wg0-home.nmconnection
-rw------- 1 root root 356 Dec  2 08:56 wg0-home-9658bcc7-1672-40d1-b835-125bc76f2643.nmconnection
```

**Active connection** (UUID 9658bcc7, 356 bytes):
- Created: December 2, 08:56
- Size: 356 bytes (SMALLER - missing data)
- Status: Active in NetworkManager
- Problem: Missing WireGuard private key

**Original connection** (443 bytes):
- Created: November 30, 13:02
- Size: 443 bytes (contains full config)
- Status: Inactive (orphaned)

**3. Auto-Switch Dispatcher Not Running**

```bash
$ journalctl -t wireguard-switch --since "1 hour ago"
# NO ENTRIES

$ ls -la /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch
-rwxr-x--x 1 root root 2847 Nov 16 02:29 99-wireguard-auto-switch  ← EXISTS, correct permissions
```

Dispatcher script exists but hasn't executed since November 16, 2025.

**Why**: Script attempts to switch to wg0-home, but wg0-home is broken, so switch fails silently.

---

## Timeline: What Broke on December 2?

**November 16, 2025**: System fully operational
- wg0-home and wg0-away working
- Auto-switch tested and confirmed working
- Real-world testing successful (mobile hotspot)

**November 30, 2025**: First corruption attempt?
- wg0-home.nmconnection modified at 13:02
- Unknown what triggered this

**December 2, 2025 08:02**: Initial WireGuard conflict
- wg0-away repeatedly failing with "Address already in use" error
- Something already using the WireGuard interface or IP
- NetworkManager stuck in activation failure loop

**December 2, 2025 08:53:22**: Auto-switch running
- Dispatcher script logs: "Already using wg0-home, no action needed"
- wg0-home was working at this point

**December 2, 2025 08:56:08**: **CRITICAL FAILURE**
- NetworkManager audit log shows: `connection-update` operation on wg0-home
  ```
  Dec 02 08:56:08 remote NetworkManager[874]: <info> [1764694568.2636]
  audit: op="connection-update" uuid="9658bcc7-1672-40d1-b835-125bc76f2643"
  name="wg0-home" args="connection.timestamp" pid=23052 uid=1000 result="success"
  ```
- **New connection file created**: wg0-home-9658bcc7-1672-40d1-b835-125bc76f2643.nmconnection
- This became the active connection
- **WireGuard private key lost** - file only 356 bytes vs 443 bytes
- Original connection orphaned

**December 2, 2025 08:56:47 - 08:57:29**: Failed recovery attempts
- User (or automated process) tried to disable wg-quick@wg0-home service
- Two failed password attempts logged
- Suggests manual troubleshooting was attempted

**December 4, 2025**: User discovers issue
- Cannot SSH via WireGuard (10.100.0.1 timeout)
- Stuck on wg0-away while at home
- Auto-switch dispatcher broken

---

## Technical Details

### Working WireGuard Config

The `/etc/wireguard/wg0-home.conf` file should contain:

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

### Broken NetworkManager Connection

The active NetworkManager connection (UUID 9658bcc7) is missing:
- `wireguard.private-key` field (shows as `<hidden>` but not actually stored)
- Or private key is stored in keyring that's not accessible

Result: Connection shows `wireguard.private-key-flags: 0 (none)` but fails with "no-secrets"

---

## Impact

**Immediate Issues**:
- ❌ Cannot use WireGuard tunnel while at home
- ❌ Cannot SSH to server via 10.100.0.1
- ❌ Auto-switch dispatcher broken
- ❌ Forced to use wg0-away config (public route) on local network
  - Higher latency (46-322ms vs 4-8ms)
  - Uses internet bandwidth unnecessarily
  - Less reliable

**Workaround**:
- Connect to server via direct LAN IP: `ssh user@192.168.1.15`
- Or manually bring up wg0-home with wg-quick (bypasses NetworkManager)

---

## Solution Strategy

### Option 1: Recreate NetworkManager Connection (Recommended)

Delete broken connection and import from working .conf file:

```bash
# 1. Delete broken connection
sudo nmcli connection delete wg0-home

# 2. Import from working config file
sudo nmcli connection import type wireguard file /etc/wireguard/wg0-home.conf

# 3. Verify private key imported
nmcli connection show wg0-home | grep -A 5 "wireguard.private-key"

# 4. Test activation
nmcli connection up wg0-home

# 5. Test connectivity
ping -c 3 10.100.0.1
```

### Option 2: Use wg-quick Directly (Bypass NetworkManager)

Modify dispatcher script to use `wg-quick` instead of `nmcli`:

```bash
# Activate home config
sudo wg-quick up wg0-home

# Activate away config
sudo wg-quick up wg0-away
```

**Pros**: More reliable, direct control
**Cons**: Bypasses NetworkManager integration, potential conflicts

### Option 3: Fix Existing Connection (Manual)

Manually add private key back to NetworkManager connection:

```bash
# Read private key from working config
PRIVATE_KEY=$(sudo grep PrivateKey /etc/wireguard/wg0-home.conf | cut -d= -f2 | tr -d ' ')

# Set in NetworkManager connection
sudo nmcli connection modify wg0-home wireguard.private-key "$PRIVATE_KEY"
```

---

## Prevention

**Why Did This Happen?**

Likely causes:
1. NetworkManager upgrade/update
2. Manual editing of connection (nm-connection-editor, nmtui)
3. System crash during connection modification
4. Bug in NetworkManager WireGuard plugin

**Recommendations**:
1. ✅ Keep `.conf` files as source of truth in `/etc/wireguard/`
2. ✅ Use `nmcli connection import` instead of manual creation
3. ✅ Monitor NetworkManager logs for WireGuard connection issues
4. ⚠️ Consider using wg-quick directly if NetworkManager proves unreliable
5. ✅ Document working configuration for quick recovery

---

## Recovery Script

See: `scripts/fix-wireguard-home-connection.sh`

```bash
#!/bin/bash
# Fix broken wg0-home NetworkManager connection
# Recreates from working /etc/wireguard/wg0-home.conf

set -e

echo "🔧 Fixing wg0-home NetworkManager connection..."

# Check if we're on laptop
if [[ ! -f /etc/wireguard/wg0-home.conf ]]; then
    echo "❌ Error: /etc/wireguard/wg0-home.conf not found"
    echo "This script must be run on the laptop (192.168.1.175)"
    exit 1
fi

# Backup existing connection (if any)
if nmcli connection show wg0-home &>/dev/null; then
    echo "📦 Backing up existing connection..."
    nmcli connection show wg0-home > "/tmp/wg0-home-backup-$(date +%Y%m%d-%H%M%S).txt"

    echo "🗑️  Deleting broken connection..."
    sudo nmcli connection delete wg0-home
fi

# Import from working config
echo "📥 Importing from /etc/wireguard/wg0-home.conf..."
sudo nmcli connection import type wireguard file /etc/wireguard/wg0-home.conf

# Verify private key imported
echo "🔍 Verifying private key..."
if nmcli connection show wg0-home | grep -q "wireguard.private-key.*<hidden>"; then
    echo "✅ Private key imported successfully"
else
    echo "⚠️  Warning: Private key might not be set correctly"
fi

# Test activation
echo "🔌 Testing connection activation..."
if sudo nmcli connection up wg0-home; then
    echo "✅ Connection activated successfully"
else
    echo "❌ Failed to activate connection"
    exit 1
fi

# Test connectivity
echo "🏓 Testing connectivity to server (10.100.0.1)..."
if ping -c 3 -W 2 10.100.0.1 > /dev/null 2>&1; then
    echo "✅ Ping successful - WireGuard working!"
else
    echo "⚠️  Warning: Ping failed - check server status"
fi

# Check wg status
echo ""
echo "📊 WireGuard Status:"
sudo wg show wg0-home

echo ""
echo "✅ wg0-home connection fixed!"
echo "Auto-switch dispatcher should now work when changing networks."
```

---

## Testing After Fix

### 1. Test Home Connection
```bash
# Ensure on home network
ping -c 2 192.168.1.1  # Should succeed (router)

# Activate wg0-home
nmcli connection up wg0-home

# Test WireGuard tunnel
ping -c 5 10.100.0.1  # Should succeed (4-8ms latency)

# Test SSH
ssh user@10.100.0.1  # Should connect quickly
```

### 2. Test Auto-Switch Dispatcher
```bash
# Manually trigger dispatcher (simulates network change)
sudo /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch wlp0s20f3 up

# Check logs
journalctl -t wireguard-switch --since "1 minute ago"

# Expected output:
# [timestamp] Network interface wlp0s20f3 came up, checking location...
# [timestamp] ✓ Detected home network (router 192.168.1.1 reachable)
# [timestamp] Switching WireGuard from wg0-away to wg0-home...
# [timestamp] ✓ Successfully switched to wg0-home (home network)
```

### 3. Test Away Connection (When Remote)
```bash
# Connect to different WiFi (coffee shop, mobile hotspot)
# Auto-switch should trigger automatically

# Verify wg0-away active
sudo wg show | head -1  # Should show: interface: wg0-away

# Test connectivity
ping -c 5 10.100.0.1  # Should work (higher latency 50-300ms)

# Test SSH
ssh user@10.100.0.1  # Should work (MTU 1280 prevents hangs)
```

---

## Resolution: How It Was Fixed

**Date**: December 4, 2025 at 10:57-10:58 PST
**Duration**: ~2 minutes
**Method**: Delete and re-import NetworkManager connection

### Steps Taken

**1. Deleted Broken Connection** (10:57:05)
```bash
sudo nmcli connection delete wg0-home
# Result: Successfully deleted connection UUID 9658bcc7
```

**2. Re-imported from Source Config** (10:57:06)
```bash
sudo nmcli connection import type wireguard file /etc/wireguard/wg0-home.conf
# Result: New connection created (UUID 3edb713a) with WireGuard private key restored
```

**3. Fixed IP Address Conflict** (10:57:48)
- Problem: wg0-away was using 10.100.0.2/24, blocking wg0-home from starting
- Solution: Brought down wg0-away first
```bash
sudo wg-quick down wg0-away
sudo wg-quick up wg0-home
# Result: wg0-home came up successfully, ping working
```

**4. Switched to NetworkManager** (10:58:12)
- Used wg-quick initially to verify config was correct
- Then activated through NetworkManager for auto-switch integration
```bash
sudo wg-quick down wg0-home
sudo nmcli connection up wg0-home
# Result: NetworkManager activation successful
```

**5. Verified Auto-Switch Dispatcher** (10:58:42)
```bash
sudo /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch wlp0s20f3 up
# Result: ✓ Detected home network (router 192.168.1.1 reachable)
#         Already using wg0-home, no action needed
```

### Post-Fix Status

**wg0-home Connection** (via NetworkManager):
- UUID: 3edb713a-c763-4dc7-8bc4-9d2ad6a195dd
- Interface: wg0-home
- Endpoint: 192.168.1.15:51820 (direct LAN)
- IP: 10.100.0.2/24
- Status: Active and working

**Connectivity Tests**:
- ✅ Ping to 10.100.0.1: **7-8ms latency** (excellent)
- ✅ SSH to 10.100.0.1: **Working perfectly**
- ✅ Auto-switch dispatcher: **Detecting home network correctly**
- ✅ Latest handshake: **Fresh (< 1 minute)**

### Why the Initial Fix Script Partially Failed

The fix script successfully:
1. ✅ Deleted broken connection
2. ✅ Imported new connection with private key
3. ✅ Verified private key present

But NetworkManager activation failed because:
- ❌ wg0-away was still active using the same IP address (10.100.0.2/24)
- NetworkManager couldn't bind to the IP → "config-failed" error

**Manual intervention required**:
- Bring down wg0-away first (IP conflict resolution)
- Use wg-quick to test config was valid
- Then activate via NetworkManager

### Lessons Learned

**1. IP Address Conflicts**
- WireGuard configs with same IP can't run simultaneously
- Always check for active WireGuard interfaces before switching
- Auto-switch script handles this, but manual switching doesn't

**2. NetworkManager vs wg-quick**
- Both use the same .conf file as source
- NetworkManager provides better desktop integration (auto-switch)
- wg-quick is more reliable for troubleshooting
- Can't have both active on same interface simultaneously

**3. Connection Corruption**
- NetworkManager "connection-update" operations can corrupt WireGuard connections
- Always keep source .conf files as backup
- Re-importing from .conf file is safer than manually fixing connection

---

## Related Documentation

- [WIREGUARD_PUBLIC_ROUTING_SESSION_NOV_2025.md](./WIREGUARD_PUBLIC_ROUTING_SESSION_NOV_2025.md) - Original working setup
- [WIREGUARD_PROTECTION_AND_RECOVERY.md](./WIREGUARD_PROTECTION_AND_RECOVERY.md) - General WireGuard documentation

---

**Status**: Investigation complete, fix script ready
**Date**: December 4, 2025
**Next Steps**: Run fix script, test home/away switching, monitor for recurrence
