/**
 * Forum Events SSE Endpoint
 *
 * GET /api/forums/events - Establish Server-Sent Events connection
 *
 * Query Parameters:
 * - category: Filter events by category ID (optional)
 * - topic: Filter events by topic ID (optional)
 * - lastEventId: Resume from specific event (for reconnection)
 *
 * SSE Event Format:
 * event: message
 * data: {"id":"evt_123","type":"topic:locked","timestamp":1234567890,"data":{...}}
 *
 * Architecture:
 * - Long-lived HTTP connection using Server-Sent Events
 * - Automatic reconnection support
 * - Optional filtering by category or topic
 * - Broadcasts real-time moderation actions and updates
 */

import { NextRequest } from 'next/server';
import { forumEventBroadcaster } from '@/lib/forums/events';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Controller with custom cleanup function property
 */
interface ControllerWithCleanup extends ReadableStreamDefaultController {
  _cleanup?: () => void;
}

/**
 * GET handler for SSE connections
 */
export async function GET(request: NextRequest) {
  // Set up SSE headers
  const responseHeaders = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Generate unique client ID
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Parse filters from query params
      const searchParams = request.nextUrl.searchParams;
      const categoryFilter = searchParams.get('category');
      const topicFilter = searchParams.get('topic');
      const lastEventId = searchParams.get('lastEventId');

      // Create client connection object
      const client = {
        id: clientId,
        response: {
          write: (data: string) => {
            try {
              controller.enqueue(encoder.encode(data));
            } catch (error) {
              logger.error('[SSE] Error writing to stream:', error);
            }
          },
        },
        categoryFilter: categoryFilter ? Number(categoryFilter) : undefined,
        topicFilter: topicFilter ? Number(topicFilter) : undefined,
      };

      // Add client to broadcaster
      forumEventBroadcaster.addClient(client);

      // If client is reconnecting, send missed events
      if (lastEventId && typeof lastEventId === 'string') {
        const timestamp = parseInt(lastEventId.split('_')[1] || '0') || 0;
        const missedEvents = forumEventBroadcaster.getEventsSince(timestamp);

        for (const event of missedEvents) {
          const sseData = `event: message\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        }
      }

      // Send initial connection message
      const connectionMsg = `event: connected\ndata: ${JSON.stringify({
        clientId,
        timestamp: Date.now(),
        filters: {
          category: categoryFilter,
          topic: topicFilter,
        },
      })}\n\n`;
      controller.enqueue(encoder.encode(connectionMsg));

      // Send periodic heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `: heartbeat ${Date.now()}\n\n`;
          controller.enqueue(encoder.encode(heartbeat));
        } catch (error) {
          logger.error('[SSE] Heartbeat error:', error);
          clearInterval(heartbeatInterval);
          forumEventBroadcaster.removeClient(clientId);
          controller.close();
        }
      }, 30000); // Every 30 seconds

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        logger.info(`[SSE] Client ${clientId} aborted connection`);
        clearInterval(heartbeatInterval);
        forumEventBroadcaster.removeClient(clientId);
        controller.close();
      });

      // Cleanup on stream close
      const cleanup = () => {
        clearInterval(heartbeatInterval);
        forumEventBroadcaster.removeClient(clientId);
      };

      // Store cleanup function for later use
      (controller as ControllerWithCleanup)._cleanup = cleanup;
    },

    cancel(controller) {
      // Called when client closes connection
      const controllerWithCleanup = controller as ControllerWithCleanup;
      if (controllerWithCleanup._cleanup) {
        controllerWithCleanup._cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: responseHeaders,
  });
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
