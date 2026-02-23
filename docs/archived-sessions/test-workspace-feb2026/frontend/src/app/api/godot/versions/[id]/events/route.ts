import { getCurrentUser } from '@/lib/auth/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

/**
 * Map of active SSE connections per version
 * Structure: versionId -> Set<controller>
 */
const clientsByVersion = new Map<string, Set<ReadableStreamDefaultController>>();

export const dynamic = 'force-dynamic';

/**
 * GET /api/godot/versions/[id]/events
 * Establish Server-Sent Events connection for runtime events
 * Requires admin or developer role
 *
 * NOTE: This endpoint does NOT use withSecurity() wrapper because EventSource API
 * doesn't support custom authentication headers. Instead, it relies on session cookies
 * being sent automatically with the SSE request. Since the overlay is only accessible
 * to authenticated admin/developers, this is secure.
 */
export const GET = async (request: Request, context: { params: Promise<{ id: string }> }) => {
  // Verify user is authenticated and has admin/developer role
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'developer')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const versionId = params.id;

  if (!versionId) {
    return NextResponse.json({ error: 'Invalid version ID' }, { status: 400 });
  }

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const clientId = `${versionId}-${Math.random().toString(36).substring(7)}`;

      // Register client
      if (!clientsByVersion.has(versionId)) {
        clientsByVersion.set(versionId, new Set());
      }
      const clients = clientsByVersion.get(versionId)!;
      clients.add(controller);

      logger.info(
        `[SSE Events] Client connected: ${clientId} (${clients.size} total for version ${versionId})`
      );

      // Send initial connection message
      try {
        const connectMessage = `data: ${JSON.stringify({ type: 'connected' })}\n\n`;
        controller.enqueue(connectMessage);
      } catch (err) {
        logger.error('[SSE Events] Error sending connect message:', err);
      }

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeatMessage = `data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`;
          controller.enqueue(heartbeatMessage);
        } catch (err) {
          logger.error('[SSE Events] Error sending heartbeat:', err);
          clearInterval(heartbeatInterval);
          clients.delete(controller);
        }
      }, 30000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        logger.info(`[SSE Events] Client disconnected: ${clientId}`);
        clearInterval(heartbeatInterval);
        clients.delete(controller);

        // Clean up empty version sets
        if (clients.size === 0) {
          clientsByVersion.delete(versionId);
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};

/**
 * Broadcast a runtime event to all clients of a specific version
 * Called from the runtime event receiver endpoint
 */
export function broadcastRuntimeEvent(
  versionId: string,
  event: {
    type: 'function_call' | 'signal_emit' | 'script_load';
    scriptPath: string;
    functionName?: string;
    timestamp: number;
  }
): void {
  const clients = clientsByVersion.get(versionId);
  if (!clients || clients.size === 0) {
    return;
  }

  const message = `data: ${JSON.stringify({ type: 'runtime_event', event })}\n\n`;

  const deadClients = new Set<ReadableStreamDefaultController>();

  clients.forEach(controller => {
    try {
      controller.enqueue(message);
    } catch (err) {
      logger.error('[SSE Events] Error sending event to client:', err);
      deadClients.add(controller);
    }
  });

  // Remove dead clients
  deadClients.forEach(controller => {
    clients.delete(controller);
  });

  if (clients.size === 0) {
    clientsByVersion.delete(versionId);
  }
}

/**
 * Broadcast a graph update event to all clients of a specific version
 * Called from the script update endpoint after graph is rebuilt
 */
export function broadcastGraphUpdate(versionId: string): void {
  const clients = clientsByVersion.get(versionId);
  if (!clients || clients.size === 0) {
    logger.info(`[SSE Events] No clients connected for version ${versionId}, skipping broadcast`);
    return;
  }

  const message = `data: ${JSON.stringify({
    type: 'graph_update',
    timestamp: Date.now(),
  })}\n\n`;

  const deadClients = new Set<ReadableStreamDefaultController>();

  clients.forEach(controller => {
    try {
      controller.enqueue(message);
    } catch (err) {
      logger.error('[SSE Events] Error sending graph update to client:', err);
      deadClients.add(controller);
    }
  });

  // Remove dead clients
  deadClients.forEach(controller => {
    clients.delete(controller);
  });

  if (clients.size === 0) {
    clientsByVersion.delete(versionId);
  }

  logger.info(
    `[SSE Events] Graph update broadcast sent to ${clients.size} clients for version ${versionId}`
  );
}
