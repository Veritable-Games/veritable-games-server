/**
 * Admin Single Timed Release API
 *
 * GET    /api/admin/timed-releases/[id] - Get a specific timed release
 * PUT    /api/admin/timed-releases/[id] - Update a timed release
 * DELETE /api/admin/timed-releases/[id] - Delete a timed release
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAdmin } from '@/lib/auth/server';
import { timedReleaseService } from '@/lib/timed-releases/service';
import type { SupporterTier } from '@/lib/badges/types';
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
    const releaseId = parseInt(params.id, 10);

    if (isNaN(releaseId)) {
      return NextResponse.json({ success: false, error: 'Invalid release ID' }, { status: 400 });
    }

    const release = await timedReleaseService.getTimedReleaseById(releaseId);

    if (!release) {
      return NextResponse.json(
        { success: false, error: 'Timed release not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: release,
    });
  } catch (error) {
    logger.error('Error fetching timed release:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch timed release' },
      { status: 500 }
    );
  }
});

export const PUT = withSecurity(async (request: NextRequest, context: RouteContext) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const params = await context.params;
    const releaseId = parseInt(params.id, 10);

    if (isNaN(releaseId)) {
      return NextResponse.json({ success: false, error: 'Invalid release ID' }, { status: 400 });
    }

    // Check if release exists
    const existing = await timedReleaseService.getTimedReleaseById(releaseId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Timed release not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate min_supporter_tier if provided
    const validTiers: SupporterTier[] = ['pioneer', 'navigator', 'voyager', 'commander', 'admiral'];
    if (body.min_supporter_tier && !validTiers.includes(body.min_supporter_tier)) {
      return NextResponse.json(
        { success: false, error: `Invalid min_supporter_tier. Must be: ${validTiers.join(', ')}` },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: {
      early_access_days?: number;
      supporter_release_at?: Date;
      public_release_at?: Date;
      min_supporter_tier?: SupporterTier;
    } = {};

    if (body.early_access_days !== undefined) {
      updateData.early_access_days = body.early_access_days;
    }
    if (body.supporter_release_at) {
      const date = new Date(body.supporter_release_at);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid supporter_release_at date format' },
          { status: 400 }
        );
      }
      updateData.supporter_release_at = date;
    }
    if (body.public_release_at) {
      const date = new Date(body.public_release_at);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid public_release_at date format' },
          { status: 400 }
        );
      }
      updateData.public_release_at = date;
    }
    if (body.min_supporter_tier) {
      updateData.min_supporter_tier = body.min_supporter_tier;
    }

    const release = await timedReleaseService.updateTimedRelease(releaseId, updateData);

    return NextResponse.json({
      success: true,
      data: release,
    });
  } catch (error) {
    logger.error('Error updating timed release:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update timed release' },
      { status: 500 }
    );
  }
});

export const DELETE = withSecurity(async (request: NextRequest, context: RouteContext) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const params = await context.params;
    const releaseId = parseInt(params.id, 10);

    if (isNaN(releaseId)) {
      return NextResponse.json({ success: false, error: 'Invalid release ID' }, { status: 400 });
    }

    const success = await timedReleaseService.deleteTimedRelease(releaseId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Timed release not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Timed release deleted',
    });
  } catch (error) {
    logger.error('Error deleting timed release:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete timed release' },
      { status: 500 }
    );
  }
});
