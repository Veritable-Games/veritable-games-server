# WebSocket Server Deployment Guide

**Date**: November 27, 2025
**Status**: ✅ Ready for deployment
**Purpose**: Enable real-time multi-user collaboration in workspace

---

## Overview

The WebSocket server enables real-time synchronization of workspace state between multiple users using Yjs CRDT (Conflict-free Replicated Data Type). This allows seamless collaborative editing similar to Google Docs.

---

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌────────────┐
│   Client 1  │◄───────►│   WebSocket  │◄───────►│ PostgreSQL │
│  (Browser)  │  WS     │    Server    │  Store  │  Database  │
└─────────────┘         │  (Port 3001) │         └────────────┘
                        └──────────────┘
┌─────────────┐                ▲
│   Client 2  │                │
│  (Browser)  │────────────────┘
└─────────────┘
```

### Components

1. **WebSocket Server** (`server/websocket-server.ts`):
   - Handles Yjs sync protocol
   - Manages real-time document updates
   - Persists snapshots to PostgreSQL every 60 seconds
   - Runs on port 3001 (configurable via `WS_PORT`)

2. **Client (Browser)**:
   - Connects via `y-websocket` provider
   - Syncs local Yjs document with server
   - Falls back to IndexedDB for offline support

3. **Database** (`content.workspace_yjs_snapshots`):
   - Stores compressed Yjs state as base64
   - Enables crash recovery
   - Periodic snapshots (60s interval)

---

## Prerequisites

✅ **Already Complete**:
- [x] WebSocket server implemented (`server/websocket-server.ts`)
- [x] Database migration applied (`workspace_yjs_snapshots` table created)
- [x] Package.json scripts configured
- [x] `concurrently` package installed
- [x] Local testing successful

---

## Local Development

### Start Both Servers (Next.js + WebSocket)

```bash
npm run ws:dev
```

This runs:
- Next.js dev server on port 3000
- WebSocket server on port 3001 (or `WS_PORT` env variable)

### Start WebSocket Server Only

```bash
npm run ws:server
```

### Environment Variables

```bash
# .env.local (development)
WS_PORT=3001                  # WebSocket server port
NEXT_PUBLIC_WS_URL=ws://localhost:3001  # Client connection URL
DATABASE_MODE=postgres         # Use PostgreSQL (NOT sqlite)
DATABASE_URL=postgresql://...  # PostgreSQL connection string
```

---

## Production Deployment (Coolify)

### Option 1: Single Container (Recommended for Start)

Run both Next.js and WebSocket in the same container:

**1. Update Dockerfile or Start Command**:

```dockerfile
# Add to Dockerfile (or use Coolify start command)
CMD ["sh", "-c", "npm run ws:prod & npm start"]
```

**Or in Coolify:**
- Start Command: `sh -c "npm run ws:prod & npm start"`

**2. Environment Variables** (Coolify UI):
```
WS_PORT=3001
NEXT_PUBLIC_WS_URL=ws://your-domain.com:3001
DATABASE_MODE=postgres
POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
```

**3. Port Mapping**:
- Map container port 3000 → Host port 3000 (Next.js)
- Map container port 3001 → Host port 3001 (WebSocket)

**Pros**:
- ✅ Simple deployment
- ✅ Single container to manage
- ✅ No extra resources needed

**Cons**:
- ❌ Both services restart together
- ❌ Harder to scale WebSocket independently

---

### Option 2: Separate Containers (Recommended for Scale)

Deploy WebSocket as a separate Coolify application:

**Next.js App** (existing):
- Keep as-is, just add `NEXT_PUBLIC_WS_URL` env var
- Port: 3000

**WebSocket App** (new):
1. Create new application in Coolify
2. Same repository, same branch
3. Start Command: `npm run ws:prod`
4. Port: 3001
5. Environment variables:
   ```
   WS_PORT=3001
   DATABASE_MODE=postgres
   POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
   ```

**Pros**:
- ✅ Independent scaling
- ✅ Can restart WebSocket without affecting Next.js
- ✅ Easier to monitor/debug

**Cons**:
- ❌ Two applications to manage
- ❌ Slightly more complex setup

---

## Deployment Steps (Option 1 - Single Container)

### 1. Update Environment Variables in Coolify

Navigate to your Coolify application → Environment tab:

```
WS_PORT=3001
NEXT_PUBLIC_WS_URL=ws://veritablegames.com:3001
DATABASE_MODE=postgres
POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
```

**Important**: Update `NEXT_PUBLIC_WS_URL` to your actual domain!

### 2. Update Start Command

In Coolify application settings:
- **Start Command**: `sh -c "npm run ws:prod & npm start"`

This will:
1. Start WebSocket server in background (`&`)
2. Start Next.js server in foreground

### 3. Update Port Mappings

Add WebSocket port to Coolify:
- Container Port: `3001` → Host Port: `3001` (TCP)
- Keep existing: `3000` → `3000`

### 4. Deploy

```bash
# Commit changes to trigger deploy
git add .
git commit -m "feat: Add WebSocket server for real-time collaboration"
git push origin main

# Or trigger manual deploy via Coolify CLI
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
```

### 5. Verify Deployment

```bash
# Check both ports are listening
curl http://veritablegames.com:3000  # Next.js (should return HTML)

# Test WebSocket (requires wscat or browser)
# Install wscat: npm install -g wscat
wscat -c ws://veritablegames.com:3001?workspace=test-workspace
```

---

## Testing Multi-User Collaboration

### 1. Open Two Browser Windows

- Window 1: `http://veritablegames.com/projects/test-project/workspace`
- Window 2: `http://veritablegames.com/projects/test-project/workspace` (same URL)

### 2. Test Real-Time Sync

- **Window 1**: Create a new node
- **Window 2**: Node should appear immediately
- **Window 1**: Drag the node
- **Window 2**: Node should move in real-time
- **Window 2**: Edit node text
- **Window 1**: Text should update live

### 3. Test Cursors

- Both users should see each other's cursors in different colors
- Cursor positions update as users move their mouse

### 4. Test Offline/Recovery

- Disconnect network on Window 1
- Make changes in Window 1 (stored in IndexedDB)
- Reconnect network
- Changes should sync to Window 2

---

## Monitoring

### Check WebSocket Server Health

```bash
# View logs
docker logs -f <container-name> | grep "WebSocket"

# Should see:
# ✅ Yjs WebSocket server running on ws://localhost:3001
# 🔌 Client connected to workspace: <workspace-id>
# 💾 Saved snapshot for workspace: <workspace-id>
```

### Database Snapshots

```sql
-- Check recent snapshots
SELECT workspace_id, updated_at
FROM content.workspace_yjs_snapshots
ORDER BY updated_at DESC
LIMIT 10;
```

### WebSocket Connections

```bash
# Check active connections
ss -tn | grep :3001 | wc -l
```

---

## Troubleshooting

### Issue: "WebSocket connection failed"

**Symptoms**:
- Browser console shows WebSocket connection error
- No real-time sync

**Diagnosis**:
```bash
# 1. Check if WebSocket server is running
ss -tlnp | grep 3001

# 2. Check logs
docker logs <container-name> 2>&1 | grep -i websocket

# 3. Test WebSocket endpoint
wscat -c ws://your-domain.com:3001?workspace=test
```

**Solutions**:
- Verify `WS_PORT=3001` environment variable
- Check port 3001 is exposed in Coolify
- Verify firewall allows port 3001
- Check `NEXT_PUBLIC_WS_URL` matches your domain

---

### Issue: "Snapshots not being saved"

**Symptoms**:
- `workspace_yjs_snapshots` table is empty
- No periodic saves in logs

**Diagnosis**:
```sql
-- Check if table exists
SELECT COUNT(*) FROM content.workspace_yjs_snapshots;

-- Check database connection
SELECT current_database();
```

**Solutions**:
- Verify `DATABASE_MODE=postgres` (NOT sqlite)
- Check `POSTGRES_URL` is correct
- Re-run migration: `docker exec veritable-games-postgres psql -U postgres -d veritable_games -f /path/to/migration.sql`

---

### Issue: "Changes not syncing between users"

**Symptoms**:
- Multiple users can connect
- But changes don't sync in real-time

**Diagnosis**:
1. Open browser DevTools → Network
2. Check WebSocket connection status
3. Verify messages are being sent/received

**Solutions**:
- Ensure both users connect to same workspace ID
- Check Yjs document initialization in `yjs-setup.ts`
- Verify `y-websocket` provider is configured correctly

---

## Performance Tuning

### Snapshot Interval

Default: 60 seconds

To adjust, edit `server/websocket-server.ts`:
```typescript
const SNAPSHOT_INTERVAL = 60_000; // milliseconds
```

**Recommendations**:
- **Low traffic**: 60-120 seconds (less database I/O)
- **High traffic**: 30-60 seconds (better crash recovery)
- **High collaboration**: 15-30 seconds (minimal data loss)

### Connection Limits

WebSocket server uses default Node.js limits. For production:

```typescript
// server/websocket-server.ts
const wss = new WebSocketServer({
  port: Number(PORT),
  maxPayload: 100 * 1024 * 1024, // 100MB (large documents)
  perMessageDeflate: true,        // Compress messages
});
```

---

## Security Considerations

### 1. Authentication

Currently, WebSocket server accepts all connections. **TODO** for production:

```typescript
// Verify user token before allowing connection
wss.on('connection', async (ws, req) => {
  const token = url.searchParams.get('token');
  const user = await verifyToken(token);

  if (!user) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  // ... rest of connection logic
});
```

### 2. Rate Limiting

Add rate limiting to prevent abuse:

```typescript
import rateLimit from 'ws-rate-limit';

const limiter = rateLimit({
  max: 100,        // 100 messages
  window: 60000,   // per 60 seconds
});

wss.on('connection', (ws) => {
  limiter(ws);
  // ...
});
```

### 3. HTTPS/WSS

For production, use WSS (WebSocket Secure):

```
NEXT_PUBLIC_WS_URL=wss://your-domain.com:3001
```

Configure reverse proxy (Nginx/Traefik) to handle SSL termination.

---

## Rollback Plan

If WebSocket deployment causes issues:

### Quick Rollback

1. **Remove WebSocket from start command**:
   - Change: `sh -c "npm run ws:prod & npm start"`
   - To: `npm start`

2. **Redeploy**:
   ```bash
   coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
   ```

3. **Workspace still works in single-user mode**:
   - Users can create/edit nodes
   - No real-time sync
   - Uses IndexedDB for local persistence

### Verify Rollback

- Workspace loads without WebSocket errors
- Single-user operations work normally
- No console errors related to WebSocket

---

## Next Steps

After successful WebSocket deployment:

1. ✅ **Monitor for 24 hours**:
   - Check logs for errors
   - Verify snapshots are being saved
   - Test with real users

2. ✅ **Performance testing**:
   - Load test with multiple concurrent users
   - Monitor database snapshot size growth
   - Check memory usage

3. ✅ **Consider scaling**:
   - If successful, move to separate container (Option 2)
   - Add load balancing for high traffic
   - Implement Redis for distributed state

---

## Files Reference

- **WebSocket Server**: `frontend/server/websocket-server.ts`
- **Database Migration**: `frontend/scripts/migrations/postgres-workspace-yjs-snapshots.sql`
- **Yjs Setup**: `frontend/src/lib/workspace/yjs-setup.ts`
- **Package Scripts**: `frontend/package.json` (ws:dev, ws:server, ws:prod)

---

**Deployment Ready**: Yes ✅
**Estimated Deployment Time**: 15-30 minutes
**Risk Level**: Low (graceful fallback to single-user mode if WebSocket fails)
