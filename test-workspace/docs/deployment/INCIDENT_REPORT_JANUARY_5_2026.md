# Incident Report: January 5, 2026

**Date**: January 5, 2026
**Duration**: ~2 hours
**Severity**: High (site down)
**Status**: ✅ Resolved

---

## Summary

Production site (www.veritablegames.com) was down with 502 Bad Gateway error. Multiple issues were discovered and resolved:

1. Cloudflare Tunnel misconfiguration
2. Container healthcheck IPv6/IPv4 mismatch
3. WebSocket server crash due to missing dependencies
4. Favicon quality issues (unrelated, fixed during session)

---

## Issue 1: 502 Bad Gateway

### Symptoms
- Site returned "Bad gateway" error via Cloudflare
- Container was running but marked "unhealthy"

### Root Cause
Cloudflare Tunnel was pointing to old Docker container IP (`10.0.1.6:3000`) instead of current container IP (`10.0.1.9`).

**Why this happened**: Docker container IPs change on restart. The tunnel was configured with a static container IP instead of using `localhost`.

### Resolution
User updated Cloudflare dashboard tunnel configuration:
- **Before**: `http://10.0.1.6:3000`
- **After**: `http://localhost:3000`

### Prevention
- Always use `localhost` or Docker service names for container routing
- Never use container IPs (10.0.1.x) as they change on restart

---

## Issue 2: Container Healthcheck Failure

### Symptoms
- Container status: "unhealthy"
- Application accessible via direct IP but Coolify showed unhealthy

### Root Cause
Healthcheck used `localhost` which resolved to IPv6 `::1`, but Next.js only listens on IPv4 `0.0.0.0`.

### Resolution
Updated Coolify database healthcheck configuration:
```sql
UPDATE applications
SET health_check_host = '127.0.0.1'
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';
```

### Prevention
- Always use `127.0.0.1` instead of `localhost` for healthchecks
- Test healthchecks work before deploying

---

## Issue 3: WebSocket Server Crash

### Symptoms
- WebSocket server failing to start in production
- Error: `Cannot find module '../src/lib/database/adapter.js'`

### Root Cause
WebSocket server (`server/websocket-server.ts`) imports from `src/lib/database/adapter.js` using relative paths, but the `src/lib/` directory is not included in the production Docker build.

### Resolution
Disabled WebSocket server in `start-production.sh`:
```bash
# WebSocket server disabled - not production-ready
echo "⏭️  WebSocket server disabled (multi-user not ready)"
```

### Prevention
- WebSocket server needs proper bundling before production deployment
- See: [docs/deployment/WEBSOCKET_DEPLOYMENT_CHECKLIST.md](./WEBSOCKET_DEPLOYMENT_CHECKLIST.md)
- See: [docs/features/WORKSPACE_COMPREHENSIVE_ANALYSIS_NOV_2025.md](../features/WORKSPACE_COMPREHENSIVE_ANALYSIS_NOV_2025.md)

---

## Issue 4: Favicon Quality

### Symptoms
- Favicon appeared blurry/compressed in browser tabs
- White logo on transparent background invisible on light tabs

### Root Cause
Previous favicon generation used low-quality downscaling and the white logo on transparent background was invisible on light browser themes.

### Resolution
Generated new favicons from high-res source (`logoWhiteIcon.png` 1167x1271):
- Used Lanczos filter for crisp downscaling
- Added dark background (`#0a0a0a`) matching site theme
- Created multi-size ICO (16, 32, 48px) + apple-touch-icon (180px)

### Files Changed
- `frontend/public/favicon.ico`
- `frontend/public/favicon-16x16.png`
- `frontend/public/favicon-32x32.png`
- `frontend/public/favicon-48x48.png`
- `frontend/public/apple-touch-icon.png`

---

## Timeline

| Time | Event |
|------|-------|
| ~16:00 | User reports 502 Bad Gateway on live site |
| ~16:15 | SSH access established via WireGuard VPN (10.100.0.1) |
| ~16:30 | Cloudflare Tunnel misconfiguration identified |
| ~16:45 | User fixes Cloudflare tunnel to use `localhost` |
| ~17:00 | Container health issues identified |
| ~17:30 | Healthcheck IPv4/IPv6 fix applied |
| ~17:45 | WebSocket server disabled |
| ~18:00 | Container healthy, site fully operational |
| ~18:30 | Favicon quality fix completed |

---

## Documentation Updates Made

1. **CLAUDE.md**: Added prominent "Production Server Access" section with SSH and WireGuard info
2. **CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md**: Added WireGuard VPN access instructions
3. **This incident report**: Created for future reference

---

## Lessons Learned

1. **Always check documentation first** - SSH credentials and server access info were already documented but not prominently referenced in CLAUDE.md
2. **Container IPs are ephemeral** - Never configure routing with container IPs (10.0.1.x), use `localhost` or service names
3. **IPv6 localhost issues** - Use `127.0.0.1` instead of `localhost` for healthchecks
4. **WebSocket server not production-ready** - Needs bundling work before deployment

---

## Related Files

- [CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md) - Server access reference
- [WEBSOCKET_DEPLOYMENT_CHECKLIST.md](./WEBSOCKET_DEPLOYMENT_CHECKLIST.md) - WebSocket deployment requirements
- [CLOUDFLARE_DOMAIN_ROUTING_FIX.md](./CLOUDFLARE_DOMAIN_ROUTING_FIX.md) - Cloudflare tunnel configuration
- [frontend/start-production.sh](../../frontend/start-production.sh) - Production startup script

---

**Report Author**: Claude Code
**Verified By**: User
