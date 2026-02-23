/**
 * Admin Badge Management API - Single Badge Operations
 *
 * GET    /api/admin/badges/[id] - Get a specific badge
 * PUT    /api/admin/badges/[id] - Update a badge
 * DELETE /api/admin/badges/[id] - Delete (deactivate) a badge
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAdmin } from '@/lib/auth/server';
import { badgeService } from '@/lib/badges/service';
import type { UpdateBadgeData } from '@/lib/badges/types';
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

    const badge = await badgeService.getBadgeById(badgeId);

    if (!badge) {
      return NextResponse.json({ success: false, error: 'Badge not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: badge,
    });
  } catch (error) {
    logger.error('Error fetching badge:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch badge' }, { status: 500 });
  }
});

export const PUT = withSecurity(async (request: NextRequest, context: RouteContext) => {
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

    const body = await request.json();

    // Validate color if provided
    if (body.color && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      return NextResponse.json(
        { success: false, error: 'Invalid color format. Use hex format like #3b82f6' },
        { status: 400 }
      );
    }

    const data: UpdateBadgeData = {};

    // Only include fields that are explicitly provided
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.icon !== undefined) data.icon = body.icon;
    if (body.color !== undefined) data.color = body.color;
    if (body.tier_level !== undefined) data.tier_level = body.tier_level;
    if (body.min_donation_amount !== undefined) data.min_donation_amount = body.min_donation_amount;
    if (body.is_stackable !== undefined) data.is_stackable = body.is_stackable;
    if (body.display_priority !== undefined) data.display_priority = body.display_priority;
    if (body.is_active !== undefined) data.is_active = body.is_active;

    const badge = await badgeService.updateBadge(badgeId, data);

    if (!badge) {
      return NextResponse.json({ success: false, error: 'Badge not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: badge,
    });
  } catch (error) {
    logger.error('Error updating badge:', error);
    return NextResponse.json({ success: false, error: 'Failed to update badge' }, { status: 500 });
  }
});

export const DELETE = withSecurity(async (request: NextRequest, context: RouteContext) => {
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

    // Soft delete by deactivating
    const success = await badgeService.deleteBadge(badgeId);

    if (!success) {
      return NextResponse.json({ success: false, error: 'Badge not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Badge deactivated successfully',
    });
  } catch (error) {
    logger.error('Error deleting badge:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete badge' }, { status: 500 });
  }
});
