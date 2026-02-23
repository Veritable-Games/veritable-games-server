/**
 * Individual Expense Category API
 * Update and delete operations for specific categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { errorResponse, PermissionError } from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/admin/expenses/categories/[id]
 * Update an expense category
 */
export const PUT = withSecurity(async (request: NextRequest, context: RouteContext) => {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const params = await context.params;
    const categoryId = parseInt(params.id);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid category ID',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, slug, description, color, icon, is_active } = body;

    // Check if category exists
    const existing = await dbAdapter.query<{ id: number }>(
      'SELECT id FROM expense_categories WHERE id = $1',
      [categoryId],
      { schema: 'donations' }
    );

    if (existing.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Category not found',
        },
        { status: 404 }
      );
    }

    // Update the category
    await dbAdapter.query(
      `UPDATE expense_categories
      SET
        name = COALESCE($1, name),
        slug = COALESCE($2, slug),
        description = COALESCE($3, description),
        color = COALESCE($4, color),
        icon = COALESCE($5, icon),
        is_active = COALESCE($6, is_active)
      WHERE id = $7`,
      [
        name || null,
        slug || null,
        description !== undefined ? description : null,
        color || null,
        icon !== undefined ? icon : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        categoryId,
      ],
      { schema: 'donations' }
    );

    // Get the updated category
    const category = await dbAdapter.query<any>(
      'SELECT * FROM expense_categories WHERE id = $1',
      [categoryId],
      { schema: 'donations' }
    );

    return NextResponse.json({
      success: true,
      data: category.rows[0],
    });
  } catch (error: any) {
    logger.error('[Category API] Error:', error);
    return errorResponse(error);
  }
});

/**
 * DELETE /api/admin/expenses/categories/[id]
 * Delete an expense category
 */
export const DELETE = withSecurity(async (request: NextRequest, context: RouteContext) => {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const params = await context.params;
    const categoryId = parseInt(params.id);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid category ID',
        },
        { status: 400 }
      );
    }

    // Check if category exists
    const existing = await dbAdapter.query<{ id: number }>(
      'SELECT id FROM expense_categories WHERE id = $1',
      [categoryId],
      { schema: 'donations' }
    );

    if (existing.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Category not found',
        },
        { status: 404 }
      );
    }

    // Check if category is in use
    const inUse = await dbAdapter.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM expenses WHERE category_id = $1',
      [categoryId],
      { schema: 'donations' }
    );

    const count = inUse.rows[0]?.count || 0;
    if (count > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete category: ${count} expense(s) are using this category`,
        },
        { status: 400 }
      );
    }

    // Delete the category
    await dbAdapter.query('DELETE FROM expense_categories WHERE id = $1', [categoryId], {
      schema: 'donations',
    });

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error: any) {
    logger.error('[Category API] Error:', error);
    return errorResponse(error);
  }
});
