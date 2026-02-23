import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, ValidationError, PermissionError } from '@/lib/utils/api-errors';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST /api/journals/categories/team
 * Create a new team-wide category (visible to all users)
 *
 * Body: { name: string }
 *
 * Permissions: Only admin/developer can create team categories
 */
async function createTeamCategory(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new ValidationError('You must be logged in to create categories');
    }

    // Only admin/developer can create team categories
    if (!['admin', 'developer'].includes(user.role)) {
      throw new PermissionError('Only admins/developers can create team categories');
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      throw new ValidationError('Category name required');
    }

    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      throw new ValidationError('Category name cannot be empty');
    }

    if (trimmedName.length > 100) {
      throw new ValidationError('Category name must be 100 characters or less');
    }

    logger.info('[Team Category] Creating team category:', {
      userId: user.id,
      userRole: user.role,
      name: trimmedName,
    });

    // Check for duplicate team category name
    const existingResult = await dbAdapter.query(
      `SELECT id FROM journal_categories
       WHERE is_team_category = TRUE AND LOWER(name) = LOWER($1)`,
      [trimmedName],
      { schema: 'wiki' }
    );

    if (existingResult.rows.length > 0) {
      throw new ValidationError(`Team category '${trimmedName}' already exists`);
    }

    // Generate team category ID
    const id = `jcat-team-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Create team category
    await dbAdapter.query(
      `INSERT INTO journal_categories
       (id, user_id, name, is_team_category, sort_order)
       VALUES ($1, $2, $3, TRUE, 0)`,
      [id, user.id, trimmedName],
      { schema: 'wiki' }
    );

    logger.info('[Team Category] Team category created successfully:', {
      userId: user.id,
      categoryId: id,
      name: trimmedName,
    });

    return NextResponse.json({
      success: true,
      message: `Team category '${trimmedName}' created successfully`,
      categoryId: id,
      category: {
        id,
        name: trimmedName,
        is_team_category: true,
        user_id: user.id,
      },
    });
  } catch (error) {
    logger.error('[Team Category] Error occurred:', error);
    return errorResponse(error);
  }
}

export const POST = withSecurity(createTeamCategory, { enableCSRF: false });
