/**
 * Forum Categories Batch Update API
 *
 * POST /api/forums/categories/batch-update - Batch update category sort orders
 *
 * This endpoint allows reordering multiple categories atomically.
 * Used by the category management UI for drag-and-drop reordering.
 *
 * Request Body:
 * {
 *   updates: Array<{ id: number, sort_order: number }>
 * }
 *
 * Returns:
 * - success: boolean
 * - data: { updatedCount: number, message: string }
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { forumCategoryService } from '@/lib/forums/services';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import type { CategoryId } from '@/lib/forums/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface BatchUpdateRequest {
  updates: Array<{ id: CategoryId; sort_order: number }>;
}

/**
 * POST /api/forums/categories/batch-update
 *
 * Batch update category sort orders
 * Requires: Admin or Moderator role
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // Authenticate
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError();
    }

    // Check permissions (Admin or Moderator only)
    if (user.role !== 'admin' && user.role !== 'moderator') {
      throw new ValidationError('Only administrators and moderators can reorder categories');
    }

    // Parse request body
    const body = (await request.json()) as BatchUpdateRequest;
    const { updates } = body;

    // Validate updates array
    if (!Array.isArray(updates)) {
      throw new ValidationError('Updates must be an array');
    }

    if (updates.length === 0) {
      throw new ValidationError('No updates provided');
    }

    // Validate each update
    for (const update of updates) {
      if (typeof update.id !== 'number' || update.id <= 0) {
        throw new ValidationError(`Invalid category ID: ${update.id}`);
      }

      if (typeof update.sort_order !== 'number' || update.sort_order < 0) {
        throw new ValidationError(
          `Invalid sort_order for category ${update.id}: ${update.sort_order}`
        );
      }
    }

    // Perform batch update
    await forumCategoryService.reorderCategories(updates);

    logger.info(`[API] Batch updated ${updates.length} categories by user ${user.id}`);

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: updates.length,
        message: `Successfully reordered ${updates.length} categories`,
      },
    });
  } catch (error) {
    logger.error('[API] Error batch updating categories:', error);
    return errorResponse(error);
  }
});
