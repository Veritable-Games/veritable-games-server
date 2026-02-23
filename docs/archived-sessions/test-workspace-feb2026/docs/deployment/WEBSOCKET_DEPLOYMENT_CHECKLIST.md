# WebSocket Deployment Checklist for Multi-User Collaboration

**Status**: ✅ FULLY DEPLOYED AND OPERATIONAL (2026-01-06)
**Feature**: Phase 6 - Real-time multi-user workspace collaboration

## Current Deployment Status

| Component | Status | Notes |
|-----------|--------|-------|
| WebSocket Server | ✅ Running | Port 3002, container `m4s0kwo4kc4oooocck4sswc4` |
| Database Migration | ✅ Complete | `workspace_yjs_snapshots` table exists |
| Environment Variables | ✅ Configured | `NEXT_PUBLIC_WS_URL=wss://ws.veritablegames.com` |
| Cloudflare Tunnel | ✅ Configured | Route `ws.veritablegames.com` → `localhost:3002` |
| Multi-user Sync | ✅ Verified | Clients connect, snapshots save every 60s |

## Pre-Deployment Requirements

### 1. Database Migration (✅ COMPLETE)
The `workspace_yjs_snapshots` table already exists in production.

To verify:
```bash
ssh user@10.100.0.1 "docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'content' AND table_name = 'workspace_yjs_snapshots');\""
```

### 2. Cloudflare Tunnel Route (❌ REQUIRED)

**CRITICAL**: Cloudflare Tunnel doesn't support non-standard ports (like :3002).
You MUST add a subdomain route for WebSocket connections.

#### Step-by-Step Instructions:

1. **Open Cloudflare Zero Trust Dashboard**
   - URL: https://one.dash.cloudflare.com
   - Navigate: Networks → Tunnels → `veritable-games`

2. **Add Public Hostname**
   - Click "Public Hostname" tab
   - Click "Add a public hostname"

3. **Configure Route**:
   | Field | Value |
   |-------|-------|
   | Subdomain | `ws` |
   | Domain | `veritablegames.com` |
   | Path | (leave blank) |
   | Service Type | `HTTP` |
   | URL | `http://localhost:3002` |

4. **Enable WebSocket Support** (in Additional settings):
   - ✅ WebSocket support (enabled by default for Cloudflare Tunnel)

5. **Save** and wait 1-2 minutes for DNS propagation

#### Verify DNS Record:
```bash
dig ws.veritablegames.com
# Should show CNAME pointing to tunnel
```

### 3. Environment Variables (Coolify Dashboard)

After adding the Cloudflare route, update environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_WORKSPACE_WEBSOCKET_ENABLED` | `true` | Enable WebSocket sync |
| `NEXT_PUBLIC_WS_URL` | `wss://ws.veritablegames.com` | WebSocket via Cloudflare |
| `WS_PORT` | `3002` | WebSocket server port |

**Note**: The URL must use `wss://` (not `ws://`) since Cloudflare provides SSL.

### 4. Docker Compose Setup (if using docker-compose)
The WebSocket service is already configured in `docker-compose.yml`:

```bash
docker-compose up -d websocket
```

## Deployment Steps

### Option A: Coolify Integrated Deployment
1. The `start-production.sh` script now starts both Next.js and WebSocket servers
2. Ensure Coolify exposes ports 3000, 3002, and 3003
3. Redeploy the application via Coolify dashboard

### Option B: Separate WebSocket Container
1. Build WebSocket container:
   ```bash
   docker build -f Dockerfile.websocket -t veritable-websocket .
   ```

2. Run WebSocket container:
   ```bash
   docker run -d \
     --name veritable-websocket \
     -e WS_PORT=3002 \
     -e WS_HEALTH_PORT=3003 \
     -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/veritable_games \
     -p 3002:3002 \
     -p 3003:3003 \
     veritable-websocket
   ```

## Verification

### 1. Check WebSocket Server Health (Local Network)
```bash
# Via VPN (10.100.0.1)
ssh user@10.100.0.1 "curl -s http://localhost:3002/ && echo"
# Expected: 426 Upgrade Required (correct - WebSocket endpoint)
```

### 2. Verify Cloudflare Route (After Adding)
```bash
# Test DNS resolution
dig ws.veritablegames.com

# Test WebSocket upgrade request
curl -I -H "Connection: Upgrade" -H "Upgrade: websocket" https://ws.veritablegames.com/
```

### 3. Test WebSocket Connection (Browser Console)
Open browser console at https://www.veritablegames.com/workspace and run:
```javascript
const ws = new WebSocket('wss://ws.veritablegames.com?workspace=test');
ws.onopen = () => console.log('✅ Connected!');
ws.onerror = (e) => console.error('❌ Error:', e);
ws.onmessage = (e) => console.log('Message:', e.data);
```

### 4. Multi-User Test
1. Open workspace in two browser tabs (or two devices)
2. Create/edit a node in one tab
3. Verify changes appear in the other tab within 1-2 seconds
4. Test undo/redo (Ctrl+Z, Ctrl+Y) - should only affect local changes

## Troubleshooting

### WebSocket Connection Refused
- Check firewall allows port 3002
- Verify WebSocket server is running: `docker ps | grep websocket`
- Check logs: `docker logs veritable-websocket`

### Changes Not Syncing
- Verify `NEXT_PUBLIC_WORKSPACE_WEBSOCKET_ENABLED=true`
- Check browser console for WebSocket errors
- Ensure both users are on the same workspace ID

### Database Connection Errors
- Verify DATABASE_URL is correct in WebSocket container
- Check PostgreSQL accepts connections from container network
- Run: `docker exec veritable-websocket ping postgres`

## Files Modified for This Deployment

1. `frontend/src/lib/workspace/yjs-setup.ts` - Added UndoManager
2. `frontend/src/stores/workspace.ts` - Added undo/redo actions
3. `frontend/src/components/workspace/WorkspaceCanvas.tsx` - Keyboard shortcuts
4. `frontend/src/lib/workspace/warning-thresholds.ts` - Removed character limits
5. `frontend/server/websocket-stream-server.ts` - Fixed build error
6. `docker-compose.yml` - Added WebSocket service
7. `frontend/start-production.sh` - Enabled WebSocket server startup
8. `frontend/.env.example` - Added WebSocket documentation

## Rollback Procedure

If issues occur, disable WebSocket sync:
1. Set `NEXT_PUBLIC_WORKSPACE_WEBSOCKET_ENABLED=false` in Coolify
2. Redeploy
3. Workspace will work in single-user/local-only mode
