/**
 * Admin Badge Management API
 *
 * GET  /api/admin/badges - List all badges
 * POST /api/admin/badges - Create a new badge
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAdmin } from '@/lib/auth/server';
import { badgeService } from '@/lib/badges/service';
import type { BadgeType, CreateBadgeData } from '@/lib/badges/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as BadgeType | null;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const badges = await badgeService.getAllBadges(type || undefined, !includeInactive);

    return NextResponse.json({
      success: true,
      data: badges,
    });
  } catch (error) {
    logger.error('Error fetching badges:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch badges' }, { status: 500 });
  }
});

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const body = await request.json();

    // Validate required fields
    if (!body.slug || !body.name || !body.badge_type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: slug, name, badge_type' },
        { status: 400 }
      );
    }

    // Validate badge_type
    if (!['supporter', 'achievement', 'special'].includes(body.badge_type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid badge_type. Must be: supporter, achievement, or special',
        },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(body.slug)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only',
        },
        { status: 400 }
      );
    }

    const data: CreateBadgeData = {
      slug: body.slug,
      name: body.name,
      description: body.description,
      icon: body.icon,
      color: body.color,
      badge_type: body.badge_type,
      tier_level: body.tier_level,
      min_donation_amount: body.min_donation_amount,
      is_stackable: body.is_stackable,
      display_priority: body.display_priority,
      is_active: body.is_active,
    };

    const badge = await badgeService.createBadge(data);

    return NextResponse.json(
      {
        success: true,
        data: badge,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating badge:', error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { success: false, error: 'A badge with this slug already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: false, error: 'Failed to create badge' }, { status: 500 });
  }
});
