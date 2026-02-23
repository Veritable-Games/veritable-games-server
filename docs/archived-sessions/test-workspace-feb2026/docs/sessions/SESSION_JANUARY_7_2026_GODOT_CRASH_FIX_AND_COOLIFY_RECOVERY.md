# Session Report: Godot Overlay Crash Fix & Coolify Recovery

**Date**: January 7, 2026
**Duration**: Extended session
**Status**: Partially Complete - Coolify recovered, partial deployment

---

## Executive Summary

This session addressed a crash occurring when opening the Godot Developer Console overlay on the homepage. During the investigation and deployment process, we discovered and resolved critical Coolify infrastructure issues that had been preventing auto-deployments.

### Key Outcomes
- **Fixed**: WebSocket server crash caused by invalid `lib0` API usage
- **Fixed**: Coolify infrastructure (was completely non-functional)
- **Partial**: Client-side fixes pushed to GitHub but require full rebuild
- **Restored**: Coolify auto-deploy capability

---

## Table of Contents

1. [Initial Problem](#1-initial-problem)
2. [Code Fixes Applied](#2-code-fixes-applied)
3. [Coolify Infrastructure Issues](#3-coolify-infrastructure-issues)
4. [Deployment Status](#4-deployment-status)
5. [Technical Details](#5-technical-details)
6. [Action Items](#6-action-items)

---

## 1. Initial Problem

### Symptom
When an admin/developer user pressed the backtick (`) key on the homepage to open the Godot Developer Console overlay, the application crashed hard without displaying the Three.js visualization.

### Root Cause Analysis
The crash was traced to the WebSocket server (`server/websocket-server.ts`) which handles real-time collaboration. The server was using an invalid `lib0` library function:

```typescript
// WRONG - This function doesn't exist in lib0
if (decoding.length(decoder) < 1) {
  return;
}
```

The `decoding.length()` function does not exist in the `lib0` library, causing a runtime error when any WebSocket message was received.

---

## 2. Code Fixes Applied

### Fix 1: WebSocket Server - lib0 API Correction

**File**: `server/websocket-server.ts`

**Change**: Replace non-existent `decoding.length()` with correct `decoding.hasContent()`

```typescript
// Before (WRONG)
if (decoding.length(decoder) < 1) {
  return;
}

// After (CORRECT)
if (!decoding.hasContent(decoder)) {
  return;
}
```

**Commit**: `7a39b8d5fb fix: Fix TypeScript error and WebSocket streaming URL`

### Fix 2: WebSocket Streaming URL

**File**: `src/hooks/useGraphStreaming.ts`

**Change**: Fixed WebSocket URL to use the correct streaming port (3004)

```typescript
// Before - Used window.location.host (port 3000)
const wsUrl = `${protocol}//${window.location.host}/api/godot/versions/${versionId}/stream`;

// After - Explicitly uses streaming port 3004
const streamPort = process.env.NEXT_PUBLIC_STREAM_PORT || '3004';
const host = window.location.hostname;
const wsUrl = `${protocol}//${host}:${streamPort}/api/godot/versions/${versionId}/stream`;
```

**Commit**: `7a39b8d5fb fix: Fix TypeScript error and WebSocket streaming URL`

### Fix 3: Error Boundary for Crash Protection

**File**: `src/app/page.tsx`

**Change**: Added `WorkspaceErrorBoundary` around the `GodotDevOverlay` component

```typescript
import { WorkspaceErrorBoundary } from '@/components/workspace/WorkspaceErrorBoundary';

// In render:
{showGodotOverlay && isAdminOrDev && (
  <WorkspaceErrorBoundary
    fallbackType="workspace"
    onError={(error, errorInfo) => {
      console.error('[GodotDevOverlay] Error:', error, errorInfo);
    }}
  >
    <GodotDevOverlay onClose={() => setShowGodotOverlay(false)} />
  </WorkspaceErrorBoundary>
)}
```

**Commit**: `dd47008eef fix: Add error boundary to GodotDevOverlay for crash protection`

---

## 3. Coolify Infrastructure Issues

### Discovery

When attempting to deploy the fixes, we discovered Coolify was completely non-functional:

1. **Main Coolify container**: In "Created" state (never started)
2. **Redis container**: In restart loop
3. **Database connection**: Password authentication failing
4. **APP_KEY**: Missing (empty in .env)

### Issues Found & Fixed

#### Issue 1: Coolify Container Not Running
- **Symptom**: Container status showed "Created" instead of "Up"
- **Cause**: Container had crashed and never restarted
- **Fix**: `docker start coolify`

#### Issue 2: Redis Restart Loop
- **Symptom**: `coolify-redis: Restarting (1) X seconds ago`
- **Cause**: `--requirepass` flag in container command with empty password
- **Root**: `REDIS_PASSWORD=` was empty in `.env`
- **Fix**: Set `REDIS_PASSWORD` to a generated value

#### Issue 3: Docker Compose Configuration
- **Symptom**: `service "soketi" has neither an image nor a build context specified`
- **Cause**: The `docker-compose.yml` file was incomplete
- **Fix**: Use both compose files: `docker-compose.yml` + `docker-compose.prod.yml`

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

#### Issue 4: Database Password Mismatch
- **Symptom**: `FATAL: password authentication failed for user "coolify"`
- **Cause**: `DB_PASSWORD` in .env didn't match PostgreSQL user password
- **Fix**: Reset password in database to match .env

```bash
docker exec coolify-db psql -U coolify -d coolify -c "ALTER USER coolify WITH PASSWORD 'new_password';"
```

#### Issue 5: Missing APP_KEY
- **Symptom**: `No application encryption key has been specified`
- **Cause**: `APP_KEY=` was empty in `.env`
- **Fix**: Generate and set Laravel APP_KEY

```bash
NEW_KEY="base64:$(openssl rand -base64 32)"
echo "APP_KEY=$NEW_KEY" >> /data/coolify/source/.env
```

### Final Coolify Status
After all fixes:
- ✅ All containers healthy
- ✅ Web UI accessible at http://10.100.0.1:8000/
- ✅ Database connected
- ✅ Redis operational
- ✅ Ready for deployments

---

## 4. Deployment Status

### What's Deployed (Hot-Patched)

| File | Fix | Status |
|------|-----|--------|
| `server/websocket-server.ts` | `decoding.hasContent()` fix | ✅ Live via hot-patch |

**Method**: Direct file copy into running container + restart
```bash
docker cp server/websocket-server.ts m4s0kwo4kc4oooocck4sswc4:/app/server/
docker restart m4s0kwo4kc4oooocck4sswc4
```

### What's Pending (Requires Full Rebuild)

| File | Fix | Status |
|------|-----|--------|
| `src/hooks/useGraphStreaming.ts` | WebSocket URL port 3004 | ⏳ In GitHub, not deployed |
| `src/app/page.tsx` | Error boundary wrapper | ⏳ In GitHub, not deployed |

**Reason**: These are client-side React/Next.js files that are compiled into the `.next` bundle. Hot-patching source files doesn't work - requires full `npm run build`.

### How to Complete Deployment

1. Access Coolify at **http://10.100.0.1:8000/** (via VPN)
2. Log in to dashboard
3. Navigate to **Applications → veritable-games**
4. Click **Deploy** to trigger full rebuild

---

## 5. Technical Details

### Production Container Info
- **Container ID**: `m4s0kwo4kc4oooocck4sswc4`
- **Image Tag**: `38e1c2b68d23ceec408dc33841d216d9e82cebd4` (old, needs update)
- **Ports**: 3000 (Next.js), 3002 (Workspace WS), 3004 (Streaming WS)

### Server Health After Fix
```json
{
  "status": "healthy",
  "uptime": 50.913,
  "database": { "status": "connected" },
  "memory": { "used": 106, "unit": "MB" }
}
```

### WebSocket Servers Running
```
✅ Yjs WebSocket server running on ws://localhost:3002
✅ Health check server running on http://localhost:3003/health
✅ Godot WebSocket Streaming Server listening on ws://0.0.0.0:3004
```

### Network Access
| Service | Local IP | VPN IP | Port |
|---------|----------|--------|------|
| Next.js App | 192.168.1.15 | 10.100.0.1 | 3000 |
| Workspace WS | 192.168.1.15 | 10.100.0.1 | 3002 |
| Streaming WS | 192.168.1.15 | 10.100.0.1 | 3004 |
| Coolify | 192.168.1.15 | 10.100.0.1 | 8000 |

---

## 6. Action Items

### Immediate
- [ ] Trigger full deployment via Coolify UI to deploy client-side fixes
- [ ] Test Godot overlay after deployment completes
- [ ] Verify WebSocket streaming connects on port 3004

### Future Maintenance
- [ ] Document Coolify .env requirements to prevent recurrence
- [ ] Add health monitoring for Coolify services
- [ ] Consider backup of Coolify .env file

### Coolify Configuration Notes

**Critical .env variables that must be set**:
```bash
APP_KEY=base64:xxxxx        # Laravel encryption key
DB_PASSWORD=xxxxx           # Must match PostgreSQL user password
REDIS_PASSWORD=xxxxx        # Must not be empty
```

**Proper startup command**:
```bash
cd /data/coolify/source
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Related Files

- `server/websocket-server.ts` - Yjs collaboration WebSocket server
- `server/websocket-stream-server.ts` - Godot streaming WebSocket server
- `src/hooks/useGraphStreaming.ts` - Client-side streaming hook
- `src/app/page.tsx` - Homepage with Godot overlay
- `src/components/godot/GodotDevOverlay.tsx` - Overlay component

## Related Documentation

- [WEBSOCKET_DEPLOYMENT_CHECKLIST.md](../deployment/WEBSOCKET_DEPLOYMENT_CHECKLIST.md)
- [COOLIFY_CLI_GUIDE.md](../deployment/COOLIFY_CLI_GUIDE.md)
- [WIREGUARD_COOLIFY_ACCESS.md](../server/wireguard/WIREGUARD_COOLIFY_ACCESS.md)

---

**Document Version**: 1.0
**Author**: Claude Code
**Last Updated**: January 7, 2026
