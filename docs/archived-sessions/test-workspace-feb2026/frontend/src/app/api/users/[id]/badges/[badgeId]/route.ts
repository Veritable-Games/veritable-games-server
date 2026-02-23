/**
 * User Badge Operations API
 *
 * DELETE /api/users/[id]/badges/[badgeId] - Revoke a badge from a user (admin only)
 * PATCH  /api/users/[id]/badges/[badgeId] - Update badge display preference (user or admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAuth, requireAdmin } from '@/lib/auth/server';
import { badgeService } from '@/lib/badges/service';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; badgeId: string }>;
}

export const DELETE = withSecurity(async (request: NextRequest, context: RouteContext) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const params = await context.params;
    const userId = parseInt(params.id, 10);
    const badgeId = parseInt(params.badgeId, 10);

    if (isNaN(userId) || isNaN(badgeId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID or badge ID' },
        { status: 400 }
      );
    }

    const success = await badgeService.revokeBadge(userId, badgeId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Badge assignment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Badge revoked successfully',
    });
  } catch (error) {
    logger.error('Error revoking badge:', error);
    return NextResponse.json({ success: false, error: 'Failed to revoke badge' }, { status: 500 });
  }
});

export const PATCH = withSecurity(async (request: NextRequest, context: RouteContext) => {
  try {
    // User can update their own badge display, admin can update any
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const params = await context.params;
    const userId = parseInt(params.id, 10);
    const badgeId = parseInt(params.badgeId, 10);

    if (isNaN(userId) || isNaN(badgeId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID or badge ID' },
        { status: 400 }
      );
    }

    // Check if user is updating their own badges or is admin
    const isOwnBadge = authResult.user?.id === userId;
    const isAdmin = authResult.user?.role === 'admin';

    if (!isOwnBadge && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You can only update your own badge display preferences' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (body.is_displayed === undefined) {
      return NextResponse.json(
        { success: false, error: 'Must provide is_displayed value' },
        { status: 400 }
      );
    }

    const success = await badgeService.setBadgeDisplayed(userId, badgeId, body.is_displayed);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Badge assignment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Badge ${body.is_displayed ? 'shown' : 'hidden'} successfully`,
    });
  } catch (error) {
    logger.error('Error updating badge display:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update badge display' },
      { status: 500 }
    );
  }
});
