/**
 * Admin Timed Releases API
 *
 * GET  /api/admin/timed-releases - List all timed releases
 * POST /api/admin/timed-releases - Create a new timed release
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAdmin } from '@/lib/auth/server';
import { timedReleaseService } from '@/lib/timed-releases/service';
import type { TimedReleaseEntityType } from '@/lib/timed-releases/types';
import type { SupporterTier } from '@/lib/badges/types';
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
    const entityType = searchParams.get('entity_type') as TimedReleaseEntityType | null;
    const status = searchParams.get('status'); // 'upcoming', 'early_access', 'all'

    let releases;

    if (status === 'upcoming') {
      releases = await timedReleaseService.getUpcomingReleases();
    } else if (status === 'early_access') {
      releases = await timedReleaseService.getEarlyAccessReleases();
    } else if (entityType) {
      releases = await timedReleaseService.getReleasesByEntityType(entityType);
    } else {
      releases = await timedReleaseService.getAllTimedReleases();
    }

    return NextResponse.json({
      success: true,
      data: releases,
      count: releases.length,
    });
  } catch (error) {
    logger.error('Error fetching timed releases:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch timed releases' },
      { status: 500 }
    );
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
    if (!body.entity_type || !body.entity_id || !body.public_release_at) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: entity_type, entity_id, public_release_at',
        },
        { status: 400 }
      );
    }

    // Validate entity_type
    const validEntityTypes: TimedReleaseEntityType[] = ['topic', 'news', 'project_update'];
    if (!validEntityTypes.includes(body.entity_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid entity_type. Must be: ${validEntityTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate min_supporter_tier if provided
    const validTiers: SupporterTier[] = ['pioneer', 'navigator', 'voyager', 'commander', 'admiral'];
    if (body.min_supporter_tier && !validTiers.includes(body.min_supporter_tier)) {
      return NextResponse.json(
        { success: false, error: `Invalid min_supporter_tier. Must be: ${validTiers.join(', ')}` },
        { status: 400 }
      );
    }

    // Parse dates
    const publicReleaseAt = new Date(body.public_release_at);
    if (isNaN(publicReleaseAt.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid public_release_at date format' },
        { status: 400 }
      );
    }

    // Check for existing timed release
    const existing = await timedReleaseService.getTimedReleaseForEntity(
      body.entity_type,
      body.entity_id
    );
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Timed release already exists for this entity' },
        { status: 409 }
      );
    }

    // Create the timed release
    const earlyAccessDays = body.early_access_days ?? 3;
    const minSupporterTier = body.min_supporter_tier ?? 'pioneer';

    const release = await timedReleaseService.createWithEarlyAccessDays(
      body.entity_type,
      body.entity_id,
      publicReleaseAt,
      earlyAccessDays,
      minSupporterTier,
      authResult.user?.id
    );

    return NextResponse.json(
      {
        success: true,
        data: release,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating timed release:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create timed release' },
      { status: 500 }
    );
  }
});
