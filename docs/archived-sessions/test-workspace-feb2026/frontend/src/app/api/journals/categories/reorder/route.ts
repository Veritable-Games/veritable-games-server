import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { journalCategoryService } from '@/lib/journals/JournalCategoryService';
import { logger } from '@/lib/utils/logger';
import { assertAdminRole } from '@/lib/auth/ownership';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST /api/journals/categories/reorder
 * Reorder journal categories (ADMIN/DEVELOPER ONLY)
 */
async function reorderCategories(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError('You must be logged in to reorder journal categories');
    }

    // Only admin/developer can reorder categories
    assertAdminRole(user.role);

    const body = await request.json();
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds)) {
      throw new ValidationError('orderedIds must be an array of category IDs');
    }

    if (orderedIds.some((id: unknown) => typeof id !== 'string')) {
      throw new ValidationError('All category IDs must be strings');
    }

    await journalCategoryService.reorderCategories(user.id, orderedIds);

    return NextResponse.json({
      success: true,
      message: 'Categories reordered successfully',
    });
  } catch (error) {
    logger.error('Error reordering journal categories:', error);
    return errorResponse(error);
  }
}

export const POST = withSecurity(reorderCategories, { enableCSRF: false });
