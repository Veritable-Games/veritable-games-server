import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, ValidationError } from '@/lib/utils/api-errors';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import { assertBulkOwnership } from '@/lib/auth/ownership';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST /api/journals/restore
 * Restore soft-deleted journals (restore from trash)
 *
 * Body: { journalIds: number[] }
 *
 * Permissions:
 * - Admin/Developer: Can restore any journal
 * - Regular users: Can only restore their own journals
 */
async function restoreJournals(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new ValidationError('You must be logged in to restore journals');
    }

    const body = await request.json();
    const { journalIds } = body;

    // Validate input
    if (!Array.isArray(journalIds) || journalIds.length === 0) {
      throw new ValidationError('Invalid journal IDs');
    }

    logger.info('[Journals Restore] Restore request:', {
      userId: user.id,
      userRole: user.role,
      journalIds,
      count: journalIds.length,
    });

    // Fetch deleted journals
    const placeholders = journalIds.map(() => '?').join(',');
    const journals = await dbAdapter.query(
      `SELECT id, user_id, slug, title FROM journals
       WHERE id IN (${placeholders})
       AND is_deleted = TRUE`,
      journalIds,
      { schema: 'wiki' }
    );

    if (journals.rows.length === 0) {
      throw new ValidationError('No deleted journals found with the provided IDs');
    }

    logger.info('[Journals Restore] Found deleted journals:', {
      count: journals.rows.length,
      journals: journals.rows.map(j => ({ id: j.id, title: j.title })),
    });

    // Verify ownership using centralized utility (allow admin bypass)
    assertBulkOwnership(journals.rows, user, { allowAdmin: true });

    // Restore journals
    const updateQuery = `
      UPDATE journals
      SET is_deleted = FALSE,
          deleted_by = NULL,
          deleted_at = NULL,
          restored_by = ?,
          restored_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `;

    await dbAdapter.query(updateQuery, [user.id, ...journalIds], { schema: 'wiki' });

    logger.info('[Journals Restore] Successfully restored journals:', {
      userId: user.id,
      count: journals.rows.length,
      journalIds,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully restored ${journals.rows.length} journal(s)`,
      restoredCount: journals.rows.length,
      journals: journals.rows.map(j => ({ id: j.id, slug: j.slug, title: j.title })),
    });
  } catch (error) {
    logger.error('[Journals Restore] Error occurred:', error);
    return errorResponse(error);
  }
}

export const POST = withSecurity(restoreJournals, { enableCSRF: false });
