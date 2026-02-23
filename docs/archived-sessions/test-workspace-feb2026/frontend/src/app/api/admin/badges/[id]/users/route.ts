/**
 * Admin Badge Users API
 *
 * GET /api/admin/badges/[id]/users - Get all users with a specific badge
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAdmin } from '@/lib/auth/server';
import { badgeService } from '@/lib/badges/service';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withSecurity(async (request: NextRequest, context: RouteContext) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const params = await context.params;
    const badgeId = parseInt(params.id, 10);

    if (isNaN(badgeId)) {
      return NextResponse.json({ success: false, error: 'Invalid badge ID' }, { status: 400 });
    }

    // Verify badge exists
    const badge = await badgeService.getBadgeById(badgeId);
    if (!badge) {
      return NextResponse.json({ success: false, error: 'Badge not found' }, { status: 404 });
    }

    const users = await badgeService.getUsersWithBadge(badgeId);

    return NextResponse.json({
      success: true,
      data: {
        badge,
        users,
        total: users.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching badge users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch badge users' },
      { status: 500 }
    );
  }
});
