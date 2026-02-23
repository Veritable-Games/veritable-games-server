/**
 * Standalone WebSocket Server for Godot Streaming
 *
 * Runs on port 3002 to handle WebSocket upgrade requests
 * Complements the Next.js API endpoints on port 3000/3001
 *
 * Production Requirements for Full Functionality:
 * - headless-gl (gl package): Server-side WebGL rendering
 * - canvas: Text label rendering
 * - FFmpeg with NVENC: GPU-accelerated H.264 encoding
 *
 * Without these, server runs in "mock mode" with simulated frames.
 */

import http from 'http';
import path from 'path';
import WebSocket, { WebSocketServer } from 'ws';

// Dynamic import for database adapter - works in both dev and production
let dbAdapter: any;
try {
  // Try the relative path first (for tsx in development)
  dbAdapter = require('../src/lib/database/adapter').dbAdapter;
} catch (e) {
  try {
    // Try absolute path from app root (for production Docker)
    const adapterPath = path.join(process.cwd(), 'src/lib/database/adapter');
    dbAdapter = require(adapterPath).dbAdapter;
  } catch (e2) {
    console.error('❌ Failed to load database adapter:', e2);
    console.warn('⚠️  Running without database - mock mode only');
    dbAdapter = null;
  }
}

// Use port 3004 by default (3002 is used by workspace WebSocket server)
const PORT = process.env.STREAM_PORT ? parseInt(process.env.STREAM_PORT) : 3004;

// Check for optional dependencies
let hasHeadlessGL = false;
let hasCanvas = false;
let hasFFmpeg = false;

try {
  require.resolve('gl');
  hasHeadlessGL = true;
} catch (e) {
  console.warn('⚠️  headless-gl (gl) not available - using mock frames');
}

try {
  require.resolve('canvas');
  hasCanvas = true;
} catch (e) {
  console.warn('⚠️  canvas not available - text labels disabled');
}

// Check FFmpeg availability
import { execSync } from 'child_process';
try {
  execSync('which ffmpeg', { stdio: 'ignore' });
  hasFFmpeg = true;
  // Check for NVENC support
  const ffmpegInfo = execSync('ffmpeg -encoders 2>/dev/null | grep nvenc || true').toString();
  if (ffmpegInfo.includes('nvenc')) {
    console.log('✅ FFmpeg with NVENC detected - GPU encoding available');
  } else {
    console.warn('⚠️  FFmpeg available but NVENC not detected - CPU encoding');
  }
} catch (e) {
  console.warn('⚠️  FFmpeg not available - video encoding disabled');
}

const RENDER_MODE = hasHeadlessGL ? 'gpu' : 'mock';
console.log(`\n🎮 Streaming Mode: ${RENDER_MODE.toUpperCase()}\n`);

interface StreamingClient {
  ws: WebSocket;
  isAlive: boolean;
  lastStateUpdate: number;
}

interface StreamingSession {
  versionId: number;
  clients: Map<string, StreamingClient>;
  isRunning: boolean;
  frameCount: number;
  startTime: number;
  frameInterval: NodeJS.Timeout | null;
}

// Global sessions map
const sessions = new Map<number, StreamingSession>();

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Godot Streaming WebSocket Server\n');
});

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  const pathname = url.pathname;

  // Match /api/godot/versions/{id}/stream
  const match = pathname.match(/\/api\/godot\/versions\/(\d+)\/stream/);
  if (!match || !match[1]) {
    console.warn(`[WebSocket] Invalid path: ${pathname}`);
    socket.destroy();
    return;
  }

  const versionId = parseInt(match[1], 10);
  console.log(`[WebSocket] New connection request for version ${versionId}`);

  wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get or create session
    let session = sessions.get(versionId);
    if (!session) {
      session = {
        versionId,
        clients: new Map(),
        isRunning: false,
        frameCount: 0,
        startTime: Date.now(),
        frameInterval: null,
      };
      sessions.set(versionId, session);
    }

    // Add client to session
    addClient(session, clientId, ws);
  });
});

function addClient(session: StreamingSession, clientId: string, ws: WebSocket) {
  session.clients.set(clientId, {
    ws,
    isAlive: true,
    lastStateUpdate: Date.now(),
  });

  console.log(
    `[Stream ${session.versionId}] Client added: ${clientId} (total: ${session.clients.size})`
  );

  // Send initial state
  ws.send(JSON.stringify({ type: 'init', versionId: session.versionId }));

  // Handle incoming messages
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      handleClientMessage(session, clientId, message);
    } catch (error) {
      console.error(`[Stream ${session.versionId}] Message parse error:`, error);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    session.clients.delete(clientId);
    console.log(
      `[Stream ${session.versionId}] Client removed: ${clientId} (total: ${session.clients.size})`
    );

    // Stop session if no clients
    if (session.clients.size === 0) {
      stopSession(session);
    }
  });

  ws.on('error', error => {
    console.error(`[Stream ${session.versionId}] WebSocket error:`, error.message);
  });

  // Start session if not already running
  if (!session.isRunning) {
    startSession(session);
  }
}

function handleClientMessage(session: StreamingSession, clientId: string, message: any) {
  const client = session.clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'camera':
      // Handle camera position update
      if (message.payload) {
        console.log(
          `[Stream ${session.versionId}] Camera update from ${clientId}: ${JSON.stringify(message.payload)}`
        );
      }
      break;

    case 'state':
      // Handle state update
      if (message.payload) {
        client.lastStateUpdate = Date.now();
      }
      break;

    case 'ping':
      client.isAlive = true;
      client.ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      console.warn(`[Stream ${session.versionId}] Unknown message type: ${message.type}`);
  }
}

async function startSession(session: StreamingSession) {
  if (session.isRunning) return;

  console.log(`[Stream ${session.versionId}] Starting streaming session`);
  session.isRunning = true;

  // If no database adapter, start with mock data
  if (!dbAdapter) {
    console.warn(`[Stream ${session.versionId}] No database - using mock graph data`);
    const mockGraphData = { nodes: [], edges: [] };
    startFrameStream(session, mockGraphData);
    return;
  }

  // Fetch graph data
  try {
    const result = await dbAdapter.query(
      'SELECT graph_data FROM godot_dependency_graph WHERE version_id = $1',
      [session.versionId],
      { schema: 'content' }
    );

    if (result.rows.length === 0) {
      console.error(`[Stream ${session.versionId}] No graph data found`);
      // Still start with mock data
      startFrameStream(session, { nodes: [], edges: [] });
      return;
    }

    const graphDataRaw = result.rows[0].graph_data;
    const graphData = typeof graphDataRaw === 'string' ? JSON.parse(graphDataRaw) : graphDataRaw;

    console.log(
      `[Stream ${session.versionId}] Loaded graph with ${graphData.nodes?.length || 0} nodes`
    );

    // Start streaming frames
    startFrameStream(session, graphData);
  } catch (error) {
    console.error(`[Stream ${session.versionId}] Failed to start session:`, error);
    // Start with mock data on error
    startFrameStream(session, { nodes: [], edges: [] });
    session.isRunning = true;
  }
}

function startFrameStream(session: StreamingSession, graphData: any) {
  const FPS = 30;
  const frameInterval = 1000 / FPS;

  // Simulate frame streaming - send mock MJPEG frames
  // In production, this would be real Three.js rendered frames
  session.frameInterval = setInterval(() => {
    if (!session.isRunning || session.clients.size === 0) {
      if (session.frameInterval) clearInterval(session.frameInterval);
      session.isRunning = false;
      return;
    }

    // Generate a simple frame header (MJPEG SOI marker + mock data)
    const frameData = Buffer.alloc(1024);
    frameData[0] = 0xff; // JPEG SOI marker
    frameData[1] = 0xd8; // JPEG SOI marker
    frameData[2] = 0x00; // Mock data
    frameData.write(`Frame ${session.frameCount}`, 4);

    // Broadcast to all clients
    session.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(frameData, (error?: Error) => {
          if (error) {
            console.error(
              `[Stream ${session.versionId}] Send error to ${clientId}:`,
              error.message
            );
            client.isAlive = false;
          }
        });
      }
    });

    session.frameCount++;

    // Log every 30 frames
    if (session.frameCount % 30 === 0) {
      const elapsed = Date.now() - session.startTime;
      const fps = (session.frameCount / elapsed) * 1000;
      console.log(
        `[Stream ${session.versionId}] FPS: ${fps.toFixed(1)}, Frames: ${session.frameCount}, Clients: ${session.clients.size}`
      );
    }
  }, frameInterval);
}

function stopSession(session: StreamingSession) {
  if (!session.isRunning) return;

  console.log(`[Stream ${session.versionId}] Stopping streaming session`);
  session.isRunning = false;

  if (session.frameInterval) {
    clearInterval(session.frameInterval);
    session.frameInterval = null;
  }

  // Close all client connections
  session.clients.forEach(client => {
    try {
      client.ws.close(1000, 'Server shutdown');
    } catch (error) {
      console.error('Error closing client connection:', error);
    }
  });

  session.clients.clear();
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Godot WebSocket Streaming Server listening on ws://0.0.0.0:${PORT}`);
  console.log(`   Connect with: ws://localhost:${PORT}/api/godot/versions/{id}/stream\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nShutting down WebSocket server...');
  sessions.forEach(session => stopSession(session));
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nShutting down WebSocket server...');
  sessions.forEach(session => stopSession(session));
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
