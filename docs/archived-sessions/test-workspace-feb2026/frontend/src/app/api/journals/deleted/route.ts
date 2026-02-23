import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError } from '@/lib/utils/api-errors';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/journals/deleted
 * List all soft-deleted journals
 *
 * Permissions:
 * - Admin/Developer: See all deleted journals
 * - Regular users: Only see their own deleted journals
 *
 * Returns:
 * {
 *   success: boolean,
 *   journals: Array<{
 *     id, slug, title, created_by,
 *     deleted_at, deleted_by,
 *     created_by_username, deleted_by_username
 *   }>
 * }
 */
async function getDeletedJournals(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError('You must be logged in to view deleted journals');
    }

    const isPrivileged = ['admin', 'developer'].includes(user.role);

    logger.info('[Journals Deleted] Fetching deleted journals:', {
      userId: user.id,
      userRole: user.role,
      isPrivileged,
    });

    // Admin/developer: see all deleted journals
    // Regular user: only their own
    const query = `
      SELECT
        j.id,
        j.slug,
        j.title,
        j.user_id as created_by,
        j.deleted_at,
        j.deleted_by,
        creator.username as created_by_username,
        deleter.username as deleted_by_username
      FROM journals j
      LEFT JOIN users creator ON j.user_id = creator.id
      LEFT JOIN users deleter ON j.deleted_by = deleter.id
      WHERE j.is_deleted = TRUE
        ${!isPrivileged ? 'AND j.user_id = ?' : ''}
      ORDER BY j.deleted_at DESC
    `;

    const params = isPrivileged ? [] : [user.id];
    const result = await dbAdapter.query(query, params, { schema: 'wiki' });

    logger.info('[Journals Deleted] Found deleted journals:', {
      count: result.rows.length,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      journals: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('[Journals Deleted] Error occurred:', error);
    return errorResponse(error);
  }
}

export const GET = withSecurity(getDeletedJournals);
