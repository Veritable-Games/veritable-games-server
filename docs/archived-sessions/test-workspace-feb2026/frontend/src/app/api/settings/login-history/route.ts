/**
 * Login History API Endpoint
 *
 * GET - Retrieve paginated login history for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAuth } from '@/lib/auth/server';
import { loginHistoryService } from '@/lib/auth/login-history-service';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// GET - Get paginated login history
async function GETHandler(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { entries, total } = await loginHistoryService.getLoginHistoryForDisplay(
      authResult.user.id,
      limit,
      offset
    );

    return NextResponse.json({
      success: true,
      data: {
        history: entries,
        total,
        limit,
        offset,
        hasMore: offset + entries.length < total,
      },
    });
  } catch (error) {
    logger.error('Error retrieving login history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve login history' },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(GETHandler);
