# WireGuard Incident Recovery & Prevention Session
**Date**: March 2, 2026
**Status**: ✅ COMPLETE - Documentation & Prevention Ready
**Impact**: Production Laptop Network

---

## Incident Summary

A previous Claude model created WireGuard configurations with **incorrect AllowedIPs** that broke production network access to the laptop:

```
❌ BROKEN CONFIG (deleted)
AllowedIPs = 10.100.0.0/24,192.168.1.0/24

✅ CORRECT CONFIG (documented)
AllowedIPs = 10.100.0.0/24                  (ONLY VPN subnet)
```

**Result**: Network became unreachable, laptop required full reset

---

## Root Cause: Linux Routing Metrics Conflict

### How It Broke

```
NORMAL STATE (WiFi Only)
$ ip route show
192.168.1.0/24 dev wlp4s0 proto kernel metric 600

BROKEN STATE (WireGuard with wrong AllowedIPs)
$ ip route show
192.168.1.0/24 dev wg0 proto kernel metric 50    ← PREFERRED (lower metric)
192.168.1.0/24 dev wlp4s0 proto kernel metric 600
```

When trying to reach 192.168.1.15 (VPN endpoint):
1. Kernel chooses metric-50 route (wg0 interface)
2. Sends packet OUT the VPN tunnel
3. But WireGuard can't complete handshake without reaching endpoint
4. Circular dependency: need tunnel to reach endpoint, need endpoint to create tunnel
5. **Network breaks completely** - all traffic unreachable

---

## What Was Done

### 1. Deleted Broken Templates ✅
- Removed: `docs/server/wireguard/configs/wg0_home.conf`
- Removed: `docs/server/wireguard/configs/wg0_away.conf`
- Reason: Templates are error-prone and can be blindly copied
- Commit: `d4f34263` - Pushed to GitHub

### 2. Created Prevention Documentation ✅

**WIREGUARD_SETUP_AND_RECOVERY_MASTER.md** (427 lines)
- Complete setup procedure with 6 validation phases
- Mandatory testing before activating
- Emergency recovery if things break
- "THE ONE RULE" emphasized throughout
- Uses NetworkManager nmconnection format (not templates)

**WHY_WIREGUARD_BROKE_NETWORK_TECHNICAL_ANALYSIS.md** (306 lines)
- Complete technical breakdown of routing metrics
- Timeline from activation to network failure
- Explanation of what "?" icon means
- How to prevent in future implementations

**NETWORK_AND_ACCESS_GUIDE.md** (updated)
- Added critical warning section about broken templates
- Documents what was wrong and why
- References master setup guide
- Persistent internet icon troubleshooting

### 3. Fixed YouTube Issues ✅

**Paragraph Formatting** - Split wall-of-text transcripts
- Implemented punctuation density detection
- Example: Resident Evil (476K chars, 0 periods) now readable
- Fallback: length-based splitting for non-punctuated text

**Preview Text** - YouTube cards now show summaries
- Detects metadata-only notes (stats like "3948 characters, 741 words")
- Falls through to content extraction
- Production deployment: Commit 77f4c31

---

## Pending Verification Tasks

### When Laptop Is Restored & Connected

```bash
# 1. SSH to server via WireGuard
ssh user@10.100.0.1

# 2. Verify server WireGuard config
sudo wg show wg0
# Check: AllowedIPs = 10.100.0.0/24 (must be correct)
# Check: Has peer entry for laptop (10.100.0.2 or 10.100.0.3)

# 3. Test VPN connectivity
ping 10.100.0.2     # Should reach laptop's VPN IP
```

### Test Master Setup Guide
- Follow procedures in `WIREGUARD_SETUP_AND_RECOVERY_MASTER.md`
- Verify on clean laptop installation
- Test both home and away network connectivity

### Verify YouTube Deployment
- Check production: https://www.veritablegames.com
- Open YouTube transcript - verify paragraph breaks
- Check library card - verify preview text shows

---

## Critical Learning

### Why Templates Failed

1. **No validation** - Can be blindly copied without testing
2. **Silent errors** - Interface shows "UP" even when broken
3. **Catastrophic impact** - One wrong parameter breaks everything
4. **No recovery guidance** - Model didn't understand what went wrong

### Why Master Guide Works

1. **Explicit validation** - 6 phases of mandatory testing
2. **Self-documenting** - "THE ONE RULE" repeated with warnings
3. **Educational** - Explains WHY each step matters
4. **Emergency procedures** - How to recover if things break
5. **Forces understanding** - Can't succeed without reading and understanding

---

## Key Files Created/Modified

**Documentation Created**:
- `docs/server/wireguard/WIREGUARD_SETUP_AND_RECOVERY_MASTER.md` - Complete guide (427 lines)
- `docs/server/wireguard/WHY_WIREGUARD_BROKE_NETWORK_TECHNICAL_ANALYSIS.md` - Technical analysis (306 lines)
- `docs/veritable-games/WIREGUARD_INCIDENT_RECOVERY_SESSION_MARCH_2_2026.md` - This file

**Documentation Updated**:
- `docs/server/NETWORK_AND_ACCESS_GUIDE.md` - Added critical warnings

**Files Deleted**:
- `docs/server/wireguard/configs/wg0_home.conf` - Broken template
- `docs/server/wireguard/configs/wg0_away.conf` - Broken template

**Code Changed**:
- `frontend/src/components/library/LibraryDocumentContentClient.tsx` - Paragraph formatting
- `frontend/src/lib/utils/preview-generator.ts` - Preview text generation

**Git Commits**:
- `d4f34263` - Deleted broken templates with detailed explanation
- `77f4c31` - YouTube transcript fixes (earlier, already deployed)

---

## The One Critical Rule

**Never forget this**:

```
AllowedIPs = 10.100.0.0/24 ONLY

NEVER include:
- 192.168.1.0/24 (home network)
- 10.0.0.0/8 (other subnets)
- Any other network where your VPN endpoint lives
```

When accessing VPN endpoint on same network (192.168.1.15 from 192.168.1.x):
- You access it DIRECTLY via WiFi
- NOT through VPN tunnel
- VPN only carries traffic to VPN subnet (10.100.0.0/24)

---

## For Future Claude Models

If resuming server work:
1. Read this file for context
2. Check `WIREGUARD_SETUP_AND_RECOVERY_MASTER.md` for any VPN procedures
3. Remember: Templates are gone - use master guide instead
4. Test explicitly before activating any VPN configuration
5. Verify home AND away network access before considering it done

---

**Status**: All prevention measures in place. Server is safe. Waiting for laptop to come back online.
