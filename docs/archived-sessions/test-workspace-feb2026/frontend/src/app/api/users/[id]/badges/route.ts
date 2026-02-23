/**
 * User Badges API
 *
 * GET  /api/users/[id]/badges - Get all badges for a user
 * POST /api/users/[id]/badges - Grant a badge to a user (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAuth, requireAdmin } from '@/lib/auth/server';
import { badgeService } from '@/lib/badges/service';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withSecurity(async (request: NextRequest, context: RouteContext) => {
  try {
    // Public endpoint - anyone can view user badges
    const params = await context.params;
    const userId = parseInt(params.id, 10);

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const displayedOnly = searchParams.get('displayedOnly') !== 'false';

    const badges = await badgeService.getUserBadges(userId, displayedOnly);

    return NextResponse.json({
      success: true,
      data: badges,
    });
  } catch (error) {
    logger.error('Error fetching user badges:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user badges' },
      { status: 500 }
    );
  }
});

export const POST = withSecurity(async (request: NextRequest, context: RouteContext) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const params = await context.params;
    const userId = parseInt(params.id, 10);

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const body = await request.json();

    // Can grant by badge_id or badge_slug
    if (!body.badge_id && !body.badge_slug) {
      return NextResponse.json(
        { success: false, error: 'Must provide badge_id or badge_slug' },
        { status: 400 }
      );
    }

    let userBadge;

    if (body.badge_slug) {
      userBadge = await badgeService.grantBadgeBySlug(
        userId,
        body.badge_slug,
        authResult.user?.id,
        body.notes
      );
    } else {
      userBadge = await badgeService.grantBadge({
        user_id: userId,
        badge_id: body.badge_id,
        granted_by: authResult.user?.id,
        expires_at: body.expires_at,
        quantity: body.quantity,
        notes: body.notes,
      });
    }

    if (!userBadge) {
      return NextResponse.json(
        { success: false, error: 'Badge not found or grant failed' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: userBadge,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error granting badge:', error);
    return NextResponse.json({ success: false, error: 'Failed to grant badge' }, { status: 500 });
  }
});
