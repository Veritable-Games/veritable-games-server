/**
 * Timed Release Access Check API
 *
 * POST /api/timed-releases/check - Check if user can access a timed release entity
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { timedReleaseService } from '@/lib/timed-releases/service';
import type { TimedReleaseEntityType } from '@/lib/timed-releases/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.entity_type || !body.entity_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: entity_type, entity_id' },
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

    // Get current user (if authenticated)
    const currentUser = await getCurrentUser(request);
    const isAdmin = currentUser?.role === 'admin';

    // Build user context
    const userContext = await timedReleaseService.buildUserContext(currentUser?.id, isAdmin);

    // Check access
    const accessResult = await timedReleaseService.checkAccess(
      body.entity_type,
      body.entity_id,
      userContext
    );

    return NextResponse.json({
      success: true,
      data: accessResult,
    });
  } catch (error) {
    logger.error('Error checking timed release access:', error);
    return NextResponse.json({ success: false, error: 'Failed to check access' }, { status: 500 });
  }
});
