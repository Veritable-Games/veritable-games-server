import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { dbAdapter } from '@/lib/database/adapter';
import { withSecurity } from '@/lib/security/middleware';
import { wikiAnalyticsService } from '@/lib/wiki/services/WikiAnalyticsService';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/wiki/activity
 * Fetch paginated wiki activity
 * Query params: limit (default 5), offset (default 0)
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    // Require authentication - all wiki content requires login
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate parameters
    if (limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'Invalid limit. Must be between 1 and 50.' },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return NextResponse.json({ error: 'Invalid offset. Must be 0 or greater.' }, { status: 400 });
    }

    // Fetch activities using the service (with metadata fallback)
    const activities = await wikiAnalyticsService.getRecentActivity(limit + offset + 1);

    // Slice to get the requested page
    const paginatedActivities = activities.slice(offset, offset + limit);
    const hasMore = activities.length > offset + limit;

    return NextResponse.json({
      success: true,
      activities: paginatedActivities,
      hasMore,
      offset,
      limit,
    });
  } catch (error) {
    logger.error('Error fetching wiki activity:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch wiki activity',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
