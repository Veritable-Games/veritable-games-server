# Phase 5 Implementation Plan
## WebSocket Server Deployment for Real-Time Collaboration

**Phase**: 5 of 5 (Final Phase!)
**Status**: 🚧 In Progress
**Started**: November 29, 2025
**Objective**: Deploy WebSocket server for real-time multi-user collaboration

---

## Overview

Phase 5 is the final phase of the Workspace Yjs Migration. It enables real-time multi-user collaboration by deploying the WebSocket server and connecting it to the frontend.

**What We're Building**:
- **WebSocket Server**: Real-time sync server for Yjs collaboration
- **Client Connection**: Frontend connects to WebSocket server via y-websocket
- **Multi-User Support**: Multiple users can edit the same workspace simultaneously
- **Conflict Resolution**: Yjs CRDT handles concurrent edits automatically
- **Production Deployment**: Server deployed alongside main application

**Prerequisites**: ✅ All complete
- ✅ Phase 1: Type Safety Infrastructure (Complete)
- ✅ Phase 2: Write Function Migration (Complete)
- ✅ Phase 3: Observer Optimization (Complete)
- ✅ Phase 4: Production Readiness (Core tasks complete)
- ✅ `YJS_SINGLE_SOURCE=true` enabled

---

## Current State Analysis

### Existing WebSocket Server

**Location**: `frontend/server/websocket-server.ts`
**Status**: ✅ Code exists, not deployed
**Size**: Estimated 200-300 LOC

**What It Does**:
- Creates WebSocket server using `ws` library
- Integrates with Yjs CRDT for real-time sync
- Uses `y-protocols` for sync protocol
- Handles connection, disconnection, and message routing

### Frontend WebSocket Provider

**Location**: `frontend/src/lib/workspace/yjs-setup.ts`
**Status**: ✅ Code exists, configured but disabled
**Current State**: WebSocket provider created but feature flag is OFF

**Code**:
```typescript
// yjs-setup.ts - setupWebSocketProvider()
export function setupWebSocketProvider(
  doc: Y.Doc,
  workspaceId: string
): WebsocketProvider | null {
  if (!WORKSPACE_FEATURES.WEBSOCKET_ENABLED) {
    return null; // Currently disabled
  }

  const wsUrl = getWebSocketUrl(); // From feature-flags.ts
  if (!wsUrl) {
    return null;
  }

  return new WebsocketProvider(wsUrl, workspaceId, doc);
}
```

### Feature Flags

**Current Configuration**:
```typescript
// feature-flags.ts
export const WORKSPACE_FEATURES = {
  WEBSOCKET_ENABLED:
    process.env.NEXT_PUBLIC_WORKSPACE_WEBSOCKET_ENABLED === 'true', // Currently false
};

export function getWebSocketUrl(): string | null {
  if (!WORKSPACE_FEATURES.WEBSOCKET_ENABLED) {
    return null;
  }
  return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002';
}
```

---

## Implementation Tasks

### Task 5.1: Analyze Existing WebSocket Server ⏳
**Objective**: Review server code and understand deployment requirements
**Timeline**: 30 minutes
**Priority**: High

**Steps**:
1. Read `server/websocket-server.ts`
2. Identify dependencies (ws, yjs, y-protocols)
3. Check if dependencies are installed
4. Understand server configuration (port, auth, etc.)
5. Document any missing features or issues

**Expected Findings**:
- Port configuration (likely 3002)
- Room/document routing logic
- Connection handling
- Error handling
- Persistence configuration

---

### Task 5.2: Configure WebSocket Server ⏳
**Objective**: Prepare server for production deployment
**Timeline**: 1 hour
**Priority**: High

**Configuration Needs**:

**1. Port Configuration**
- Development: `3002` (localhost)
- Production: Same or different? (need to decide)
- Environment variable: `WS_PORT`

**2. CORS Configuration**
- Allow connections from frontend domain
- Development: `http://localhost:3000`
- Production: `https://www.veritablegames.com`

**3. Authentication (Optional)**
- Do we need auth for WebSocket connections?
- Token-based auth? Session-based?
- For now: Skip (same server, trusted connections)

**4. Persistence**
- Server should NOT persist Yjs state (IndexedDB handles that)
- Server is ephemeral relay only

**5. Monitoring**
- Connection count logging
- Error logging
- Health check endpoint

**Changes to Make**:
```typescript
// server/websocket-server.ts
const PORT = process.env.WS_PORT || 3002;
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://www.veritablegames.com',
  'http://192.168.1.15:3000',
];

// CORS check in connection handler
wss.on('connection', (ws, req) => {
  const origin = req.headers.origin;
  if (!ALLOWED_ORIGINS.includes(origin)) {
    ws.close(1008, 'Origin not allowed');
    return;
  }
  // ... rest of connection handling
});
```

---

### Task 5.3: Deploy WebSocket Server ⏳
**Objective**: Get server running in production
**Timeline**: 2 hours
**Priority**: High

**Deployment Options**:

**Option 1: Same Server as Main App (Recommended)**
- **Location**: 192.168.1.15 (same server)
- **Port**: 3002 (separate from main app on 3000)
- **Method**: Standalone Node process or Docker container
- **Pros**: Simple, no additional infrastructure
- **Cons**: Shares resources with main app

**Option 2: Separate Server**
- **Location**: Different machine
- **Method**: Docker container
- **Pros**: Isolated, scalable
- **Cons**: More complex setup

**Recommended Approach: Option 1 (Same Server)**

**Deployment Steps**:

**1. Create Dockerfile for WebSocket Server**
```dockerfile
# Dockerfile.websocket
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --production

# Copy server code
COPY server/ ./server/
COPY src/lib/workspace/ ./src/lib/workspace/

# Expose WebSocket port
EXPOSE 3002

# Start server
CMD ["node", "server/websocket-server.js"]
```

**2. Build Docker Image**
```bash
cd /home/user/projects/veritable-games/site/frontend
docker build -f Dockerfile.websocket -t veritable-games-websocket:latest .
```

**3. Run Docker Container**
```bash
docker run -d \
  --name veritable-games-websocket \
  --network veritable-games-network \
  -p 3002:3002 \
  -e WS_PORT=3002 \
  --restart unless-stopped \
  veritable-games-websocket:latest
```

**4. Verify Server Running**
```bash
# Check container status
docker ps | grep websocket

# Check logs
docker logs veritable-games-websocket

# Test connection
curl http://localhost:3002/health  # If health endpoint exists
```

---

### Task 5.4: Enable WebSocket Provider in Frontend ⏳
**Objective**: Connect frontend to WebSocket server
**Timeline**: 30 minutes
**Priority**: High

**Environment Variables to Add**:
```bash
# .env.local (development)
NEXT_PUBLIC_WORKSPACE_WEBSOCKET_ENABLED=true
NEXT_PUBLIC_WS_URL=ws://localhost:3002

# Production (Coolify environment)
NEXT_PUBLIC_WORKSPACE_WEBSOCKET_ENABLED=true
NEXT_PUBLIC_WS_URL=ws://192.168.1.15:3002
# OR
NEXT_PUBLIC_WS_URL=wss://ws.veritablegames.com  # If using subdomain
```

**Code Changes** (if needed):
```typescript
// yjs-setup.ts - Already implemented, just needs flag enabled
const wsProvider = setupWebSocketProvider(doc, workspaceId);

// workspace.ts - Already using the provider
state.wsProvider = wsProvider;
```

**Deployment**:
1. Add environment variables to Coolify
2. Redeploy frontend
3. Verify WebSocket connection in browser DevTools (Network tab)

---

### Task 5.5: Test Multi-User Connectivity ⏳
**Objective**: Verify real-time sync works between multiple users
**Timeline**: 1 hour
**Priority**: High

**Test Scenarios**:

**1. Two-User Basic Sync**
- Open workspace in two browser tabs/windows
- Create node in Tab 1
- Verify node appears in Tab 2 within 1 second
- Move node in Tab 2
- Verify position updates in Tab 1

**2. Concurrent Edits**
- Both users create nodes simultaneously
- Verify no conflicts (both nodes appear)
- Both users edit same node text simultaneously
- Verify Yjs CRDT merges edits correctly

**3. Connection Recovery**
- Disconnect WebSocket in Tab 1 (DevTools → Network → Offline)
- Make edits in Tab 1 (offline)
- Reconnect Tab 1
- Verify edits sync to Tab 2

**4. New User Joins**
- Tab 1 creates 10 nodes
- Tab 2 opens workspace (joins room)
- Verify Tab 2 sees all 10 nodes immediately

**5. Stress Test**
- Open workspace in 5+ tabs
- All tabs create nodes simultaneously
- Verify no errors, all nodes sync

**Testing Checklist**:
- [ ] Two-user basic sync works
- [ ] Concurrent node creation works
- [ ] Concurrent node editing works
- [ ] Connection recovery works
- [ ] New user sees existing data
- [ ] 5+ concurrent users work
- [ ] No errors in browser console
- [ ] No errors in WebSocket server logs

---

### Task 5.6: Production Monitoring ⏳
**Objective**: Add monitoring and health checks
**Timeline**: 1 hour
**Priority**: Medium

**Monitoring to Add**:

**1. WebSocket Server Metrics**
- Active connection count
- Messages sent/received per second
- Error rate
- Uptime

**2. Health Check Endpoint**
```typescript
// server/websocket-server.ts
import http from 'http';

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      connections: wss.clients.size,
      timestamp: new Date().toISOString(),
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(3003); // Separate port for health checks
```

**3. Logging**
```typescript
// Log connections
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket] Client connected: ${clientIp} (${wss.clients.size} total)`);

  ws.on('close', () => {
    console.log(`[WebSocket] Client disconnected: ${clientIp} (${wss.clients.size} remaining)`);
  });

  ws.on('error', (error) => {
    console.error(`[WebSocket] Error from ${clientIp}:`, error);
  });
});
```

**4. Error Tracking**
- Log all errors to console
- (Future) Send to Sentry or similar service

---

## Architecture Decisions

### Decision 1: Server Location
**Choice**: Same server as main app (192.168.1.15)
**Reasoning**:
- ✅ Simple deployment (no additional infrastructure)
- ✅ Same network (fast communication)
- ✅ Easy to debug (all services on one machine)
- ⚠️ Shares resources (acceptable for current scale)

**Future**: If WebSocket server becomes a bottleneck, can move to separate server

### Decision 2: Port Configuration
**Choice**: Port 3002 (separate from main app on 3000)
**Reasoning**:
- ✅ Separate port prevents conflicts
- ✅ Easy to firewall/rate-limit independently
- ✅ Standard pattern (WebSocket on different port)

### Decision 3: Authentication
**Choice**: Skip authentication for now
**Reasoning**:
- ✅ Main app already handles auth (session-based)
- ✅ WebSocket on same server (trusted)
- ✅ Room names are workspace IDs (already protected by app auth)
- ⚠️ Future: Could add token-based auth if needed

**Security Note**: The main app's authentication ensures only authorized users can access workspace pages. The WebSocket server doesn't need separate auth because:
1. Users must be logged in to reach workspace page
2. Workspace IDs are UUIDs (not guessable)
3. Server is on same machine (not exposed to internet directly)

### Decision 4: Persistence
**Choice**: No server-side persistence
**Reasoning**:
- ✅ IndexedDB handles client-side persistence
- ✅ PostgreSQL handles database persistence (on save)
- ✅ WebSocket server is ephemeral relay only
- ✅ Simpler deployment (no state to manage)

**How It Works**:
1. Client A makes edit → Yjs doc updates → IndexedDB saves
2. Yjs doc sends update to WebSocket server
3. WebSocket server broadcasts to Client B
4. Client B's Yjs doc updates → IndexedDB saves
5. User clicks "Save" → App saves to PostgreSQL

---

## Rollback Strategy

**If WebSocket server has issues in production**:

**Step 1: Disable WebSocket Feature**
```bash
# In Coolify environment variables
NEXT_PUBLIC_WORKSPACE_WEBSOCKET_ENABLED=false
```

**Step 2: Redeploy Frontend**
```bash
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
```

**Result**: Frontend reverts to offline-only mode (IndexedDB persistence only)

**Step 3: Fix WebSocket Server**
- Check logs: `docker logs veritable-games-websocket`
- Fix issues
- Restart: `docker restart veritable-games-websocket`

**Step 4: Re-enable WebSocket**
- Set `NEXT_PUBLIC_WORKSPACE_WEBSOCKET_ENABLED=true`
- Redeploy frontend

---

## Success Criteria

### Core Functionality ✅
- [ ] WebSocket server deployed and running
- [ ] Frontend connects to WebSocket server
- [ ] Two users can see each other's edits in real-time
- [ ] Concurrent edits merge correctly (no conflicts)
- [ ] Connection recovery works (offline → online)
- [ ] New users see existing workspace data

### Performance ✅
- [ ] Real-time sync latency < 100ms (local network)
- [ ] No memory leaks (server uptime > 24 hours)
- [ ] Handles 10+ concurrent users per workspace

### Production Readiness ✅
- [ ] Health check endpoint works
- [ ] Error logging active
- [ ] Server restarts automatically on crash
- [ ] CORS configured correctly

---

## Testing Checklist

### Local Development Testing
- [ ] Start WebSocket server: `npm run ws:dev` (if script exists)
- [ ] Start frontend: `npm run dev`
- [ ] Open two browser tabs
- [ ] Test real-time sync

### Production Testing
- [ ] WebSocket server deployed to 192.168.1.15:3002
- [ ] Frontend deployed with `WEBSOCKET_ENABLED=true`
- [ ] Test from two different devices (laptop + phone)
- [ ] Test over WireGuard VPN
- [ ] Test with 5+ concurrent users

### Edge Cases
- [ ] User goes offline mid-edit
- [ ] User closes tab without saving
- [ ] Server restarts mid-session
- [ ] Network lag > 5 seconds
- [ ] WebSocket connection fails (fallback to offline mode)

---

## Documentation

### User Documentation
**Title**: "Real-Time Collaboration Guide"
**Content**:
- How real-time sync works
- What to do if sync fails
- How to tell if you're connected (online indicator)
- How to resolve conflicts (Yjs handles automatically)

### Developer Documentation
**Title**: "WebSocket Server Deployment Guide"
**Content**:
- Server architecture
- Deployment instructions
- Monitoring and health checks
- Troubleshooting common issues

---

## Timeline Estimate

| Task | Time | Priority |
|------|------|----------|
| 5.1: Analyze server code | 30 min | High |
| 5.2: Configure server | 1 hour | High |
| 5.3: Deploy server | 2 hours | High |
| 5.4: Enable frontend | 30 min | High |
| 5.5: Test multi-user | 1 hour | High |
| 5.6: Monitoring | 1 hour | Medium |
| **Total** | **6 hours** | |

**Realistic Timeline**: 1-2 days (including testing and debugging)

---

## Next Steps After Phase 5

**Phase 5 is the final phase!** 🎉

Once complete:
- ✅ Full migration complete (100%)
- ✅ Production-ready workspace with real-time collaboration
- ✅ Single source of truth (Yjs-first architecture)
- ✅ Optimized performance (90% reduction in observer overhead)
- ✅ Clean codebase (debug logging removed, error boundaries)
- ✅ Multi-user support (WebSocket server)

**Optional Future Enhancements** (post-migration):
- Component splitting (WorkspaceCanvas.tsx refactoring)
- Loading states and optimistic UI
- Undo/Redo system
- Advanced collaboration features (presence indicators, cursors, chat)
- WebRTC for direct peer-to-peer sync (bypass server)

---

**Plan Created**: November 29, 2025
**Phase**: 5 - WebSocket Server Deployment (FINAL PHASE)
**Estimated Completion**: November 30, 2025 (1-2 days)
