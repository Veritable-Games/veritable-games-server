/**
 * Forum Sections Batch Reorder API
 *
 * POST /api/forums/sections/batch-reorder - Reorder multiple sections
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { forumSectionService } from '@/lib/forums/services';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST /api/forums/sections/batch-reorder
 *
 * Reorders multiple sections atomically
 * Requires: Admin or Moderator role
 *
 * Body: { updates: Array<{ id: string, sort_order: number }> }
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // Authenticate
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError();
    }

    // Check permissions
    if (user.role !== 'admin' && user.role !== 'moderator') {
      throw new ValidationError('Only administrators and moderators can reorder sections');
    }

    // Parse request body
    const body = await request.json();
    const { updates } = body;

    // Validate updates array
    if (!updates || !Array.isArray(updates)) {
      throw new ValidationError('Updates array is required');
    }

    if (updates.length === 0) {
      throw new ValidationError('At least one update is required');
    }

    // Validate each update
    for (const update of updates) {
      if (!update.id || typeof update.id !== 'string') {
        throw new ValidationError('Each update must have a valid id');
      }

      if (typeof update.sort_order !== 'number') {
        throw new ValidationError('Each update must have a valid sort_order number');
      }
    }

    // Perform batch reorder
    await forumSectionService.reorderSections(updates);

    // Return updated sections
    const sections = await forumSectionService.getAllSections();

    return NextResponse.json({
      success: true,
      data: { sections },
    });
  } catch (error) {
    logger.error('[API] Error reordering sections:', error);
    return errorResponse(error);
  }
});
