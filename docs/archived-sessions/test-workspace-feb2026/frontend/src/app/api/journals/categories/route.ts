import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { journalCategoryService } from '@/lib/journals/JournalCategoryService';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import { assertAdminRole } from '@/lib/auth/ownership';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/journals/categories
 * Get all journal categories for the current user
 * Admin/developer users see all categories, regular users see only their own
 */
async function getCategories(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError('You must be logged in to view journal categories');
    }

    // Check if user is admin/developer
    const isPrivileged = user.role === 'admin' || user.role === 'developer';

    // Ensure user has at least the Uncategorized category
    await journalCategoryService.ensureUncategorized(user.id);

    let categories;

    if (isPrivileged) {
      // Admin/developer users see ALL categories (from all users)
      const result = await dbAdapter.query(
        `SELECT id, user_id, name, sort_order, created_at
         FROM wiki.journal_categories
         ORDER BY user_id ASC, sort_order ASC, created_at ASC`,
        [],
        { schema: 'wiki' }
      );
      categories = result.rows;
    } else {
      // Regular users see only their own categories
      categories = await journalCategoryService.getCategories(user.id);
    }

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    logger.error('Error fetching journal categories:', error);
    return errorResponse(error);
  }
}

/**
 * POST /api/journals/categories
 * Create a new journal category (ADMIN/DEVELOPER ONLY)
 */
async function createCategory(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError('You must be logged in to create journal categories');
    }

    // Only admin/developer can create categories
    assertAdminRole(user.role);

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      throw new ValidationError('Category name is required');
    }

    const category = await journalCategoryService.createCategory(user.id, { name });

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    logger.error('Error creating journal category:', error);
    return errorResponse(error);
  }
}

export const GET = withSecurity(getCategories, { enableCSRF: false });
export const POST = withSecurity(createCategory, { enableCSRF: false });
