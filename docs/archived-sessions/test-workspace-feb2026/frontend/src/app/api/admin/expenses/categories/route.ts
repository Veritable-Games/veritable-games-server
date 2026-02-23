/**
 * Expense Categories API
 * Manages expense categories for financial tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { errorResponse, AuthenticationError, PermissionError } from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/expenses/categories
 * List all expense categories
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const result = await dbAdapter.query<any>(
      `SELECT
        id,
        name,
        slug,
        description,
        color,
        icon,
        is_active,
        display_order,
        created_at
      FROM expense_categories
      ORDER BY display_order ASC, name ASC`,
      [],
      { schema: 'donations' }
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('[Categories API] Error:', error);
    return errorResponse(error);
  }
});

/**
 * POST /api/admin/expenses/categories
 * Create a new expense category
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const body = await request.json();
    const { name, slug, description, color, icon, is_active = true } = body;

    if (!name || !slug) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name and slug are required',
        },
        { status: 400 }
      );
    }

    // Get the next display_order
    const maxOrderResult = await dbAdapter.query<{ max_order: number | null }>(
      'SELECT MAX(display_order) as max_order FROM expense_categories',
      [],
      { schema: 'donations' }
    );

    const displayOrder = (maxOrderResult.rows[0]?.max_order || 0) + 1;

    // Insert the new category
    const insertResult = await dbAdapter.query<any>(
      `INSERT INTO expense_categories (name, slug, description, color, icon, is_active, display_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        name,
        slug,
        description || null,
        color || '#3b82f6',
        icon || null,
        is_active ? 1 : 0,
        displayOrder,
      ],
      { schema: 'donations' }
    );

    return NextResponse.json({
      success: true,
      data: insertResult.rows[0],
    });
  } catch (error: any) {
    logger.error('[Categories API] Error:', error);
    return errorResponse(error);
  }
});
