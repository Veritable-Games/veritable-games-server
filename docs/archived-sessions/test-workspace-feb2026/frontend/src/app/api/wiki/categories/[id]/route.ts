import { NextRequest, NextResponse } from 'next/server';
import { getWikiService } from '@/lib/services/registry';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { cache } from '@/lib/cache';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const wikiService = getWikiService();

// DELETE handler for deleting wiki categories
async function deleteCategoryHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only admins can delete categories
    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Admin role required.' },
        { status: 403 }
      );
    }

    const params = await context.params;
    const categoryId = params.id;

    // Prevent deletion of 'uncategorized' category
    if (categoryId.toLowerCase() === 'uncategorized') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete the Uncategorized category' },
        { status: 400 }
      );
    }

    // Move all pages from this category to 'uncategorized'
    await dbAdapter.query(
      `
      UPDATE wiki_pages
      SET category_id = 'uncategorized'
      WHERE category_id = $1
    `,
      [categoryId],
      { schema: 'wiki' }
    );

    // Delete the category
    const result = await dbAdapter.query(
      'DELETE FROM wiki_categories WHERE id = $1',
      [categoryId],
      { schema: 'wiki' }
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    // Invalidate category cache after deletion
    const cacheKeys = [
      'categories:all:admin',
      'categories:all:moderator',
      'categories:all:user',
      'categories:all:anonymous',
      'categories:root:admin',
      'categories:root:moderator',
      'categories:root:user',
      'categories:root:anonymous',
      'categories:hierarchy:admin',
      'categories:hierarchy:moderator',
      'categories:hierarchy:user',
      'categories:hierarchy:anonymous',
      // Popular pages cache (limit: 5, 10; roles: admin, moderator, user, anonymous)
      'popular_pages:5:admin',
      'popular_pages:5:moderator',
      'popular_pages:5:user',
      'popular_pages:5:anonymous',
      'popular_pages:10:admin',
      'popular_pages:10:moderator',
      'popular_pages:10:user',
      'popular_pages:10:anonymous',
      // Recent pages cache (limit: 5, 10; roles: admin, moderator, user, anonymous)
      'recent_pages:5:admin',
      'recent_pages:5:moderator',
      'recent_pages:5:user',
      'recent_pages:5:anonymous',
      'recent_pages:10:admin',
      'recent_pages:10:moderator',
      'recent_pages:10:user',
      'recent_pages:10:anonymous',
      // Activity cache (limit: 6, 10)
      'wiki_activity:recent:6',
      'wiki_activity:recent:10',
    ];

    await Promise.all(cacheKeys.map(key => cache.delete({ category: 'content', identifier: key })));

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete wiki category error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete wiki category',
      },
      { status: 500 }
    );
  }
}

// PATCH handler for updating wiki categories
async function updateCategoryHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only admins and moderators can update categories
    if (user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Admin or moderator role required.' },
        { status: 403 }
      );
    }

    const params = await context.params;
    const categoryId = params.id;
    const body = await request.json();

    const { name, icon, sort_order, is_public } = body;

    // Build dynamic update query based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { success: false, error: 'Category name cannot be empty' },
          { status: 400 }
        );
      }
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(icon || null);
    }

    if (sort_order !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`);
      values.push(sort_order);
    }

    if (is_public !== undefined) {
      updates.push(`is_public = $${paramIndex++}`);
      values.push(is_public ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    // Update the category
    values.push(categoryId);
    const result = await dbAdapter.query(
      `
      UPDATE wiki_categories
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `,
      values,
      { schema: 'wiki' }
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    // Invalidate category cache after update
    const cacheKeys = [
      'categories:all:admin',
      'categories:all:moderator',
      'categories:all:user',
      'categories:all:anonymous',
      'categories:root:admin',
      'categories:root:moderator',
      'categories:root:user',
      'categories:root:anonymous',
      'categories:hierarchy:admin',
      'categories:hierarchy:moderator',
      'categories:hierarchy:user',
      'categories:hierarchy:anonymous',
      // Popular pages cache (limit: 5, 10; roles: admin, moderator, user, anonymous)
      'popular_pages:5:admin',
      'popular_pages:5:moderator',
      'popular_pages:5:user',
      'popular_pages:5:anonymous',
      'popular_pages:10:admin',
      'popular_pages:10:moderator',
      'popular_pages:10:user',
      'popular_pages:10:anonymous',
      // Recent pages cache (limit: 5, 10; roles: admin, moderator, user, anonymous)
      'recent_pages:5:admin',
      'recent_pages:5:moderator',
      'recent_pages:5:user',
      'recent_pages:5:anonymous',
      'recent_pages:10:admin',
      'recent_pages:10:moderator',
      'recent_pages:10:user',
      'recent_pages:10:anonymous',
      // Activity cache (limit: 6, 10)
      'wiki_activity:recent:6',
      'wiki_activity:recent:10',
    ];

    await Promise.all(cacheKeys.map(key => cache.delete({ category: 'content', identifier: key })));

    return NextResponse.json({
      success: true,
      message: 'Category updated successfully',
    });
  } catch (error: any) {
    logger.error('Update wiki category error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update wiki category',
      },
      { status: 500 }
    );
  }
}

// GET handler for fetching wiki category by ID
async function getCategoryHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Resolve params (Next.js 15 requirement)
    const params = await context.params;
    const categoryId = params.id;

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'Category ID is required' },
        { status: 400 }
      );
    }

    // Get user for role-based access
    const user = await getCurrentUser(request);
    const userRole = user?.role || 'anonymous';

    // Fetch category using service
    const category = await wikiService.getCategoryById(categoryId);

    // Check visibility: return 404 if category is hidden and user is not admin
    if (category.is_public === false) {
      if (userRole !== 'admin' && userRole !== 'moderator') {
        // Return 404 instead of 403 to hide existence of admin-only categories
        return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
      }
    }

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    logger.error('Get wiki category error:', error);

    // Check if this is a "not found" error from the service
    if (error.message && error.message.includes('Category not found')) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch wiki category',
      },
      { status: 500 }
    );
  }
}

// Apply security middleware
export const GET = withSecurity(getCategoryHandler);
export const DELETE = withSecurity(deleteCategoryHandler);
export const PATCH = withSecurity(updateCategoryHandler);
