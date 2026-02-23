import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { journalCategoryService } from '@/lib/journals/JournalCategoryService';
import { logger } from '@/lib/utils/logger';
import { assertAdminRole } from '@/lib/auth/ownership';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/journals/categories/[id]
 * Rename a journal category (ADMIN/DEVELOPER ONLY)
 */
async function renameCategory(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError('You must be logged in to rename journal categories');
    }

    // Only admin/developer can rename categories
    assertAdminRole(user.role);

    const params = await context.params;
    const categoryId = params.id;

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      throw new ValidationError('Category name is required');
    }

    const category = await journalCategoryService.renameCategory(user.id, categoryId, name);

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    logger.error('Error renaming journal category:', error);
    return errorResponse(error);
  }
}

/**
 * DELETE /api/journals/categories/[id]
 * Delete a journal category (moves journals to Uncategorized) (ADMIN/DEVELOPER ONLY)
 */
async function deleteCategory(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError('You must be logged in to delete journal categories');
    }

    // Only admin/developer can delete categories
    assertAdminRole(user.role);

    const params = await context.params;
    const categoryId = params.id;

    await journalCategoryService.deleteCategory(user.id, categoryId);

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting journal category:', error);
    return errorResponse(error);
  }
}

export const PATCH = withSecurity(renameCategory, { enableCSRF: false });
export const DELETE = withSecurity(deleteCategory, { enableCSRF: false });
