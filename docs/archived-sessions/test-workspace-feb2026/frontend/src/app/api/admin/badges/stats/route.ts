/**
 * Admin Badge Statistics API
 *
 * GET /api/admin/badges/stats - Get badge statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAdmin } from '@/lib/auth/server';
import { badgeService } from '@/lib/badges/service';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const stats = await badgeService.getBadgeStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching badge stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch badge statistics' },
      { status: 500 }
    );
  }
});
