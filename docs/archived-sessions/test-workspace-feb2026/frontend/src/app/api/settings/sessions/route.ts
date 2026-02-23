/**
 * Sessions API Endpoint
 *
 * GET - List all active sessions for the current user
 * DELETE - Terminate a specific session or all other sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getCurrentSessionId } from '@/lib/auth/server';
import { sessionService } from '@/lib/auth/session-service';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// GET - List active sessions
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const currentSessionId = getCurrentSessionId(request);
    const sessions = await sessionService.getSessionsForDisplay(
      authResult.user.id,
      currentSessionId || ''
    );

    return NextResponse.json({
      success: true,
      data: {
        sessions,
        currentSessionId,
      },
    });
  } catch (error) {
    logger.error('Error retrieving sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve sessions' },
      { status: 500 }
    );
  }
}

// DELETE - Terminate session(s)
export const DELETE = withSecurity(
  async (request: NextRequest) => {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    try {
      const body = await request.json();
      const { sessionId, terminateAll } = body;

      const currentSessionId = getCurrentSessionId(request);

      if (terminateAll) {
        // Terminate all sessions except the current one
        if (!currentSessionId) {
          return NextResponse.json(
            { success: false, error: 'Could not identify current session' },
            { status: 400 }
          );
        }

        const count = await sessionService.terminateAllOtherSessions(
          authResult.user.id,
          currentSessionId
        );

        return NextResponse.json({
          success: true,
          message: `Terminated ${count} other session(s)`,
          data: { terminatedCount: count },
        });
      }

      if (!sessionId) {
        return NextResponse.json(
          { success: false, error: 'Session ID is required' },
          { status: 400 }
        );
      }

      // Don't allow terminating the current session through this endpoint
      // (use logout for that)
      const sessions = await sessionService.getSessions(authResult.user.id);
      const targetSession = sessions.find(s => s.id === sessionId);

      if (!targetSession) {
        return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
      }

      if (targetSession.token === currentSessionId) {
        return NextResponse.json(
          { success: false, error: 'Cannot terminate current session. Use logout instead.' },
          { status: 400 }
        );
      }

      // Terminate the specific session
      const success = await sessionService.terminateSession(authResult.user.id, sessionId);

      if (!success) {
        return NextResponse.json(
          { success: false, error: 'Failed to terminate session' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Session terminated successfully',
      });
    } catch (error) {
      logger.error('Error terminating session:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to terminate session' },
        { status: 500 }
      );
    }
  },
  {
    enableCSRF: true,
  }
);
