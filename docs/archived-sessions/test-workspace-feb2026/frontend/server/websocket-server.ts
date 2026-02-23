import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as http from 'http';
// PHASE 5: Use relative paths for standalone tsx execution (no @/ alias support)
import { dbAdapter } from '../src/lib/database/adapter.js';
import { logger } from '../src/lib/utils/logger.js';

const PORT = process.env.WS_PORT || 3002;
const HEALTH_PORT = process.env.WS_HEALTH_PORT || 3003;

// PHASE 5: CORS Configuration - Allowed origins for WebSocket connections
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://192.168.1.15:3000',
  'https://www.veritablegames.com',
];

// y-websocket protocol message types (matches y-websocket/src/y-websocket.js)
const messageSync = 0;
const messageAwareness = 1;
const messageAuth = 2;
const messageQueryAwareness = 3;

// Store active Yjs documents and awareness in memory
const docs = new Map<string, Y.Doc>();
const awarenesses = new Map<string, Awareness>();

// Store WebSocket connections per workspace (for broadcasting)
const wsConnections = new Map<string, Set<WebSocket>>();

// Snapshot interval: 60 seconds (reduced database writes for better performance)
const SNAPSHOT_INTERVAL = 60_000;

// Create WebSocket server
const wss = new WebSocketServer({ port: Number(PORT) });

logger.info(`✅ Yjs WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  // PHASE 5: CORS check - verify origin is allowed
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    logger.warn(`❌ Rejected connection from unauthorized origin: ${origin}`);
    ws.close(1008, 'Origin not allowed');
    return;
  }

  const url = new URL(req.url!, `ws://localhost:${PORT}`);
  const workspaceId = url.searchParams.get('workspace');

  if (!workspaceId) {
    ws.close(4000, 'Missing workspace ID');
    return;
  }

  logger.info(`🔌 Client connected to workspace: ${workspaceId}`);

  // Get or create Yjs document for this workspace
  let doc = docs.get(workspaceId);
  let awareness = awarenesses.get(workspaceId);

  if (!doc) {
    doc = new Y.Doc();
    docs.set(workspaceId, doc);

    // Create awareness for this workspace
    awareness = new Awareness(doc);
    awarenesses.set(workspaceId, awareness);

    // Load initial state from PostgreSQL
    loadWorkspaceFromDB(workspaceId, doc);

    // Set up periodic snapshots
    startSnapshotTimer(workspaceId, doc);
  }

  if (!awareness) {
    awareness = awarenesses.get(workspaceId)!;
  }

  // Track this connection for broadcasting
  let connections = wsConnections.get(workspaceId);
  if (!connections) {
    connections = new Set();
    wsConnections.set(workspaceId, connections);
  }
  connections.add(ws);
  logger.info(`📊 Workspace ${workspaceId} now has ${connections.size} connected client(s)`);

  // Set up message handlers for y-websocket protocol
  ws.on('message', (message: Buffer | ArrayBuffer) => {
    try {
      // Convert Buffer to Uint8Array (Node.js ws library sends Buffers)
      const uint8Message =
        message instanceof Buffer ? new Uint8Array(message) : new Uint8Array(message);

      // Skip very short messages (likely pings or control frames)
      if (uint8Message.length < 1) {
        return;
      }

      const decoder = decoding.createDecoder(uint8Message);
      const encoder = encoding.createEncoder();

      // Check if there's enough data to read message type
      if (!decoding.hasContent(decoder)) {
        return;
      }

      // Read the y-websocket protocol message type
      const msgType = decoding.readVarUint(decoder);

      switch (msgType) {
        case messageSync: {
          // Sync message - contains Yjs sync protocol data
          try {
            encoding.writeVarUint(encoder, messageSync);
            const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc!, null);

            // Broadcast updates to other clients
            if (syncMessageType === syncProtocol.messageYjsUpdate) {
              const connections = wsConnections.get(workspaceId);
              if (connections) {
                connections.forEach(client => {
                  if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(uint8Message);
                  }
                });
              }
            }
          } catch (syncError) {
            // Log sync errors but don't spam logs - likely corrupted message
            logger.warn(`Sync error for workspace ${workspaceId}: ${(syncError as Error).message}`);
          }
          break;
        }

        case messageAwareness: {
          // Awareness message - contains presence/cursor data
          try {
            const awarenessUpdate = decoding.readVarUint8Array(decoder);
            applyAwarenessUpdate(awareness!, awarenessUpdate, ws);

            // Broadcast awareness to other clients
            const connections = wsConnections.get(workspaceId);
            if (connections) {
              connections.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(uint8Message);
                }
              });
            }
          } catch {
            // Silently skip malformed awareness messages
          }
          break;
        }

        case messageQueryAwareness: {
          // Client is querying awareness state - send current awareness
          try {
            encoding.writeVarUint(encoder, messageAwareness);
            encoding.writeVarUint8Array(
              encoder,
              encodeAwarenessUpdate(awareness!, Array.from(awareness!.getStates().keys()))
            );
          } catch {
            // Skip if awareness encoding fails
          }
          break;
        }

        case messageAuth:
          // Auth message - not used in our implementation
          break;

        default:
          // Unknown message type - silently ignore
          break;
      }

      // Send response if encoder has data
      if (encoding.length(encoder) > 1) {
        ws.send(encoding.toUint8Array(encoder));
      }
    } catch {
      // Silently handle malformed messages - don't spam logs
      // The server continues operating normally
    }
  });

  // Send initial sync step (wrapped in y-websocket messageSync)
  const initEncoder = encoding.createEncoder();
  encoding.writeVarUint(initEncoder, messageSync);
  syncProtocol.writeSyncStep1(initEncoder, doc);
  ws.send(encoding.toUint8Array(initEncoder));

  // Send current awareness state to the new client
  if (awareness!.getStates().size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      encodeAwarenessUpdate(awareness!, Array.from(awareness!.getStates().keys()))
    );
    ws.send(encoding.toUint8Array(awarenessEncoder));
  }

  // Subscribe to document updates and broadcast to client (wrapped in y-websocket protocol)
  const updateHandler = (update: Uint8Array, origin: unknown) => {
    // Don't broadcast updates that originated from this WebSocket connection
    if (origin === ws) return;

    if (ws.readyState === WebSocket.OPEN) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      ws.send(encoding.toUint8Array(encoder));
    }
  };
  doc.on('update', updateHandler);

  // Cleanup on disconnect
  ws.on('close', () => {
    doc!.off('update', updateHandler);

    // PHASE 5: Remove from connection tracking
    const connections = wsConnections.get(workspaceId);
    if (connections) {
      connections.delete(ws);
      logger.info(
        `📊 Client disconnected from workspace: ${workspaceId} (${connections.size} remaining)`
      );

      // Clean up empty connection sets
      if (connections.size === 0) {
        wsConnections.delete(workspaceId);
        logger.info(`🗑️  No more clients for workspace: ${workspaceId}`);
      }
    }
  });
});

// Load workspace state from PostgreSQL
async function loadWorkspaceFromDB(workspaceId: string, doc: Y.Doc) {
  try {
    const result = await dbAdapter.query(
      `SELECT yjs_state FROM workspace_yjs_snapshots
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [workspaceId],
      { schema: 'content' }
    );

    if (result.rows.length > 0) {
      const stateVector = Buffer.from(result.rows[0].yjs_state, 'base64');
      Y.applyUpdate(doc, stateVector);
      logger.info(`✅ Loaded snapshot for workspace: ${workspaceId}`);
    } else {
      logger.info(`ℹ️  No snapshot found for workspace: ${workspaceId} (new workspace)`);
    }
  } catch (error) {
    logger.error(`❌ Failed to load workspace ${workspaceId}:`, error);
  }
}

// Save workspace state to PostgreSQL
async function saveWorkspaceToDB(workspaceId: string, doc: Y.Doc) {
  try {
    const stateVector = Y.encodeStateAsUpdate(doc);
    const base64State = Buffer.from(stateVector).toString('base64');

    await dbAdapter.query(
      `INSERT INTO workspace_yjs_snapshots (workspace_id, yjs_state)
       VALUES ($1, $2)
       ON CONFLICT (workspace_id)
       DO UPDATE SET
         yjs_state = EXCLUDED.yjs_state,
         updated_at = CURRENT_TIMESTAMP`,
      [workspaceId, base64State],
      { schema: 'content' }
    );

    logger.info(`💾 Saved snapshot for workspace: ${workspaceId}`);
  } catch (error) {
    logger.error(`❌ Failed to save workspace ${workspaceId}:`, error);
  }
}

// Start periodic snapshot timer
function startSnapshotTimer(workspaceId: string, doc: Y.Doc) {
  const timer = setInterval(() => {
    saveWorkspaceToDB(workspaceId, doc);
  }, SNAPSHOT_INTERVAL);

  // Clean up on document destroy
  doc.on('destroy', () => {
    clearInterval(timer);
    docs.delete(workspaceId);
    logger.info(`🗑️  Cleaned up workspace: ${workspaceId}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('📡 SIGTERM received, saving all workspaces...');

  for (const [workspaceId, doc] of docs.entries()) {
    await saveWorkspaceToDB(workspaceId, doc);
  }

  wss.close(() => {
    healthServer.close(() => {
      logger.info('✅ WebSocket server closed');
      logger.info('✅ Health check server closed');
      process.exit(0);
    });
  });
});

// PHASE 5: Health Check HTTP Server
// Separate HTTP server for health checks (port 3003)
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        uptime: process.uptime(),
        connections: wss.clients.size,
        workspaces: docs.size,
        timestamp: new Date().toISOString(),
      })
    );
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

healthServer.listen(HEALTH_PORT, () => {
  logger.info(`✅ Health check server running on http://localhost:${HEALTH_PORT}/health`);
});
