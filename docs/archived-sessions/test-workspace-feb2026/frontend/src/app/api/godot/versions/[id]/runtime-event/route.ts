import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { broadcastRuntimeEvent } from '../events/route';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering to prevent static prerendering of API routes
export const dynamic = 'force-dynamic';

/**
 * POST /api/godot/versions/[id]/runtime-event
 * Receive a runtime event from Godot and broadcast to all connected SSE clients
 * Can be called from Godot HTML5 export via postMessage
 * Requires admin or developer role
 */
export const POST = withSecurity(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'developer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const versionId = params.id;

    if (!versionId) {
      return NextResponse.json({ error: 'Invalid version ID' }, { status: 400 });
    }

    try {
      const body = await request.json();
      const { type, scriptPath, functionName, timestamp } = body;

      // Validate event
      if (!type || !scriptPath) {
        return NextResponse.json(
          { error: 'Missing required fields: type, scriptPath' },
          { status: 400 }
        );
      }

      if (!['function_call', 'signal_emit', 'script_load'].includes(type)) {
        return NextResponse.json({ error: `Invalid event type: ${type}` }, { status: 400 });
      }

      const event = {
        type,
        scriptPath,
        functionName: functionName || undefined,
        timestamp: timestamp || Date.now(),
      };

      logger.info(`[/api/godot/versions/[id]/runtime-event] Broadcasting: ${scriptPath} (${type})`);

      // Broadcast to all connected SSE clients
      broadcastRuntimeEvent(versionId, event);

      return NextResponse.json({
        success: true,
        message: 'Event broadcasted',
      });
    } catch (error) {
      logger.error('[/api/godot/versions/[id]/runtime-event] Error processing event:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  }
);
