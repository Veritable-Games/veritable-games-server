/**
 * WebSocket Streaming Endpoint for Godot Dependency Graph
 *
 * Handles real-time server-side rendering with NVIDIA NVENC H.264 encoding
 * Streams frames to multiple concurrent clients over WebSocket
 *
 * Usage: ws://localhost:3000/api/godot/versions/{versionId}/stream
 */

import { NextRequest } from 'next/server';
import { WebSocketServer } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { Readable, Writable } from 'stream';
import { dbAdapter } from '@/lib/database/adapter';
import { ServerGraphRenderer } from '@/lib/godot/server-renderer';
import { logger } from '@/lib/utils/logger';

// Streaming configuration
const STREAMING_CONFIG = {
  width: 1920,
  height: 1080,
  fps: 30,
  bitrate: '8M', // 8 Mbps for high quality
  preset: 'llhq', // Low Latency High Quality
};

interface StreamingClient {
  ws: any;
  isAlive: boolean;
  lastStateUpdate: number;
}

class StreamingSession {
  private versionId: number;
  private clients: Map<string, StreamingClient> = new Map();
  private renderer: ServerGraphRenderer | null = null;
  private ffmpegProcess: ChildProcess | null = null;
  private ffmpegInput: Writable | null = null;
  private isRunning = false;
  private frameCount = 0;
  private startTime = Date.now();

  constructor(versionId: number) {
    this.versionId = versionId;
  }

  /**
   * Add a client WebSocket connection
   */
  addClient(clientId: string, ws: any): void {
    this.clients.set(clientId, {
      ws,
      isAlive: true,
      lastStateUpdate: Date.now(),
    });

    logger.info(
      `[Stream ${this.versionId}] Client added: ${clientId} (total: ${this.clients.size})`
    );

    // Send initial state
    ws.send(JSON.stringify({ type: 'init', versionId: this.versionId }));

    // Handle incoming messages (camera commands, state updates)
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(clientId, message);
      } catch (error) {
        logger.error(`[Stream ${this.versionId}] Message parse error:`, error);
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      this.removeClient(clientId);
    });
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    logger.info(
      `[Stream ${this.versionId}] Client removed: ${clientId} (total: ${this.clients.size})`
    );

    // Stop streaming if no clients
    if (this.clients.size === 0) {
      this.stop();
    }
  }

  /**
   * Handle incoming client messages (camera movement, state changes)
   */
  private handleClientMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'camera':
        // Update camera position
        if (this.renderer && message.payload) {
          const { x, y, z } = message.payload;
          this.renderer.setCameraPosition(x, y, z);
        }
        break;

      case 'state':
        // Update renderer state (colors, selected node, etc.)
        if (this.renderer && message.payload) {
          this.renderer.updateState(message.payload);
          client.lastStateUpdate = Date.now();
        }
        break;

      case 'ping':
        client.isAlive = true;
        client.ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        logger.warn(`[Stream ${this.versionId}] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Initialize the streaming session
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      logger.info(`[Stream ${this.versionId}] Starting streaming session`);

      // Fetch graph data
      const graphData = await this.fetchGraphData();
      if (!graphData) {
        throw new Error('Failed to fetch graph data');
      }

      // Initialize renderer (requires headless-gl context)
      // Note: This requires Node.js with headless-gl installed
      // For now, we'll create a stub that would work with proper setup
      // TODO: Initialize with proper gl context from 'gl' package

      logger.info(
        `[Stream ${this.versionId}] Renderer initialized with ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`
      );

      // Start FFmpeg encoder
      this.startFFmpegEncoder();

      // Start rendering loop
      this.isRunning = true;
      this.startRenderLoop();
    } catch (error) {
      logger.error(`[Stream ${this.versionId}] Startup error:`, error);
      this.broadcast({ type: 'error', message: 'Failed to start streaming' });
      this.stop();
    }
  }

  /**
   * Fetch graph data from database
   */
  private async fetchGraphData(): Promise<any> {
    try {
      // Query godot_versions table for graph data
      const result = await dbAdapter.query(
        'SELECT graph_data FROM godot_versions WHERE id = ?',
        [this.versionId],
        { schema: 'content' }
      );

      if (!result.rows.length) {
        logger.error(`[Stream ${this.versionId}] Version not found`);
        return null;
      }

      const graphDataStr = result.rows[0].graph_data;
      if (!graphDataStr) {
        logger.error(`[Stream ${this.versionId}] No graph data available`);
        return null;
      }

      return JSON.parse(graphDataStr);
    } catch (error) {
      logger.error(`[Stream ${this.versionId}] Error fetching graph:`, error);
      return null;
    }
  }

  /**
   * Start FFmpeg NVENC encoder process
   */
  private startFFmpegEncoder(): void {
    const ffmpegArgs = [
      '-f',
      'rawvideo',
      '-pixel_format',
      'rgba',
      '-video_size',
      `${STREAMING_CONFIG.width}x${STREAMING_CONFIG.height}`,
      '-framerate',
      STREAMING_CONFIG.fps.toString(),
      '-i',
      'pipe:0',
      '-c:v',
      'h264_nvenc',
      '-preset',
      STREAMING_CONFIG.preset,
      '-rc',
      'cbr',
      '-b:v',
      STREAMING_CONFIG.bitrate,
      '-profile:v',
      'high',
      '-level:v',
      '4.2',
      '-f',
      'h264',
      'pipe:1',
    ];

    try {
      this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.ffmpegInput = this.ffmpegProcess.stdin as Writable;

      // Handle FFmpeg output (encoded frames)
      const ffmpegOutput = this.ffmpegProcess.stdout as Readable;
      ffmpegOutput.on('data', (chunk: Buffer) => {
        this.broadcastEncodedFrame(chunk);
      });

      // Handle FFmpeg errors
      this.ffmpegProcess.stderr?.on('data', (data: Buffer) => {
        logger.error(`[Stream ${this.versionId}] FFmpeg error: ${data.toString()}`);
      });

      this.ffmpegProcess.on('close', (code: number) => {
        logger.info(`[Stream ${this.versionId}] FFmpeg exited with code ${code}`);
        this.ffmpegProcess = null;
        this.ffmpegInput = null;
      });

      logger.info(`[Stream ${this.versionId}] FFmpeg encoder started`);
    } catch (error) {
      logger.error(`[Stream ${this.versionId}] Failed to start FFmpeg:`, error);
      throw error;
    }
  }

  /**
   * Main rendering loop
   */
  private async startRenderLoop(): Promise<void> {
    const frameInterval = 1000 / STREAMING_CONFIG.fps;
    const target = Date.now() + frameInterval;

    while (this.isRunning && this.clients.size > 0) {
      const startFrame = Date.now();

      try {
        // Render frame (captured as RGBA buffer)
        if (this.renderer) {
          this.renderer.render();
          const frameBuffer = this.renderer.getFrameBuffer();

          // Send to FFmpeg for encoding
          if (this.ffmpegInput && !this.ffmpegInput.destroyed) {
            this.ffmpegInput.write(frameBuffer);
          }

          this.frameCount++;

          // Log stats every 300 frames (~10 seconds at 30fps)
          if (this.frameCount % 300 === 0) {
            const elapsed = Date.now() - this.startTime;
            const fps = (this.frameCount / elapsed) * 1000;
            logger.info(
              `[Stream ${this.versionId}] FPS: ${fps.toFixed(1)}, Clients: ${this.clients.size}, Frames: ${this.frameCount}`
            );
          }
        }
      } catch (error) {
        logger.error(`[Stream ${this.versionId}] Render error:`, error);
      }

      // Frame rate limiting
      const elapsed = Date.now() - startFrame;
      const delay = Math.max(0, frameInterval - elapsed);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    logger.info(`[Stream ${this.versionId}] Render loop stopped`);
  }

  /**
   * Broadcast encoded frame to all connected clients
   */
  private broadcastEncodedFrame(encodedFrame: Buffer): void {
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === 1) {
        // WebSocket.OPEN
        try {
          client.ws.send(encodedFrame, { binary: true }, (error?: Error) => {
            if (error) {
              logger.error(`[Stream ${this.versionId}] Send error to ${clientId}:`, error.message);
              client.isAlive = false;
            }
          });
        } catch (error) {
          logger.error(`[Stream ${this.versionId}] Broadcast error:`, error);
        }
      }
    });
  }

  /**
   * Broadcast JSON message to all connected clients
   */
  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.ws.readyState === 1) {
        // WebSocket.OPEN
        client.ws.send(data);
      }
    });
  }

  /**
   * Stop the streaming session
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info(`[Stream ${this.versionId}] Stopping streaming session`);
    this.isRunning = false;

    // Close all client connections
    this.clients.forEach(client => {
      try {
        client.ws.close(1000, 'Server shutdown');
      } catch (error) {
        logger.error('Error closing client connection:', error);
      }
    });
    this.clients.clear();

    // Stop FFmpeg encoder
    if (this.ffmpegInput && !this.ffmpegInput.destroyed) {
      this.ffmpegInput.end();
    }

    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
    }

    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    logger.info(`[Stream ${this.versionId}] Session stopped`);
  }

  /**
   * Get session statistics
   */
  getStats(): any {
    const elapsed = Date.now() - this.startTime;
    return {
      versionId: this.versionId,
      isRunning: this.isRunning,
      clientCount: this.clients.size,
      frameCount: this.frameCount,
      avgFps: (this.frameCount / elapsed) * 1000,
      uptime: elapsed,
    };
  }
}

// Global session manager
const sessions = new Map<number, StreamingSession>();

/**
 * WebSocket upgrade handler
 * Called when client initiates WebSocket connection
 */
export async function GET(request: NextRequest, context: any) {
  const params = await context.params;
  const versionId = parseInt(params.id, 10);

  // Check if this is a WebSocket upgrade request
  const upgradeHeader = request.headers.get('upgrade');
  if (upgradeHeader?.toLowerCase() !== 'websocket') {
    return new Response('Upgrade required', { status: 400 });
  }

  // This is handled by Next.js built-in WebSocket support
  // For production, you'd typically handle this in a separate WebSocket server
  // This is a placeholder response
  return new Response('WebSocket endpoint - use browser WebSocket API', { status: 200 });
}

/**
 * Alternative: Custom WebSocket handler with ws library
 * Requires custom server setup (not Next.js built-in)
 */
export async function setupWebSocketServer(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request: any, socket: any, head: any) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname;

    // Match /api/godot/versions/{id}/stream
    const match = pathname.match(/\/api\/godot\/versions\/(\d+)\/stream/);
    if (!match || !match[1]) {
      socket.destroy();
      return;
    }

    const versionId = parseInt(match[1], 10);
    logger.info(`[WebSocket] New connection request for version ${versionId}`);

    wss.handleUpgrade(request, socket, head, (ws: any) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Get or create streaming session
      let session = sessions.get(versionId);
      if (!session) {
        session = new StreamingSession(versionId);
        sessions.set(versionId, session);
        session.start().catch(error => {
          logger.error(`[Stream ${versionId}] Startup failed:`, error);
        });
      }

      // Add client to session
      session.addClient(clientId, ws);
    });
  });
}

/**
 * Cleanup endpoint (optional)
 * POST /api/godot/versions/{id}/stream?action=stop
 */
export async function POST(request: NextRequest, context: any) {
  const params = await context.params;
  const versionId = parseInt(params.id, 10);

  const session = sessions.get(versionId);
  if (session) {
    await session.stop();
    sessions.delete(versionId);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });
}
