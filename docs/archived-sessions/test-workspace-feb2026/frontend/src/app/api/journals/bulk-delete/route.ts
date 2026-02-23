import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError, PermissionError } from '@/lib/utils/api-errors';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import { verifyBulkOwnership, verifyAdminRole } from '@/lib/auth/ownership';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Journal ownership query result
 * SELECT id, user_id, is_deleted FROM journals WHERE ...
 */
interface JournalOwnershipResult {
  id: string;
  user_id: string | null;
  is_deleted: boolean | null;
}

/**
 * DELETE /api/journals/bulk-delete
 * Delete multiple journals by their IDs
 */
async function bulkDeleteJournals(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError('You must be logged in to delete journals');
    }

    const body = await request.json();
    const { journalIds, permanent = false } = body;

    logger.info('[Journals Delete] Operation started', {
      userId: user.id,
      count: Array.isArray(journalIds) ? journalIds.length : 0,
      permanent,
    });

    // Validate input
    if (!Array.isArray(journalIds) || journalIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid journal IDs' }, { status: 400 });
    }

    // Verify all journals belong to the user before deleting
    const placeholders = journalIds.map(() => '?').join(',');
    const query = `SELECT id, user_id, is_deleted FROM journals WHERE id IN (${placeholders})`;
    const journalsResult = await dbAdapter.query(query, journalIds, { schema: 'wiki' });
    const journals = journalsResult.rows as JournalOwnershipResult[];

    // Check ownership using centralized utility
    const isPrivileged = verifyAdminRole(user.role);
    const ownershipCheck = verifyBulkOwnership(journals, user, { allowAdmin: true });

    if (!ownershipCheck.authorized) {
      logger.warn('[Journals Delete] Authorization failed', {
        userId: user.id,
        unauthorizedCount: ownershipCheck.unauthorized.length,
      });
      throw new PermissionError('You can only delete your own journals');
    }

    // Check if all requested journals were found
    if (journals.length !== journalIds.length) {
      logger.warn('[Journals Delete] Not all journals found', {
        requested: journalIds.length,
        found: journals.length,
      });
      return NextResponse.json(
        { success: false, error: 'Some journals not found' },
        { status: 404 }
      );
    }

    // Handle permanent deletion (admin only, for already deleted journals)
    if (permanent) {
      // Verify user is admin/developer
      if (!isPrivileged) {
        logger.warn('[Journals Delete] Non-admin attempted permanent delete', {
          userId: user.id,
        });
        throw new PermissionError('Only admins can permanently delete journals');
      }

      // Verify all journals are already soft-deleted
      const notDeletedJournals = journals.filter(j => !j.is_deleted);
      if (notDeletedJournals.length > 0) {
        logger.warn('[Journals Delete] Attempted permanent delete of non-deleted journals', {
          count: notDeletedJournals.length,
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Can only permanently delete journals that are already deleted',
          },
          { status: 400 }
        );
      }

      // Perform hard delete
      const deleteQuery = `DELETE FROM journals WHERE id IN (${placeholders})`;
      await dbAdapter.query(deleteQuery, journalIds, { schema: 'wiki' });

      logger.info('[Journals Delete] Permanent delete successful', {
        count: journalIds.length,
      });

      return NextResponse.json({
        success: true,
        message: `Permanently deleted ${journalIds.length} journal(s)`,
        deletedCount: journalIds.length,
      });
    }

    // Soft delete journals (preserve data for recovery)
    const updateQuery = `
      UPDATE journals
      SET is_deleted = TRUE,
          deleted_by = ?,
          deleted_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `;
    await dbAdapter.query(updateQuery, [user.id, ...journalIds], { schema: 'wiki' });

    logger.info('[Journals Delete] Soft delete successful', {
      count: journalIds.length,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${journalIds.length} journal(s)`,
      deletedCount: journalIds.length,
    });
  } catch (error) {
    logger.error('[Journals Delete] Operation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error);
  }
}

export const DELETE = withSecurity(bulkDeleteJournals, {
  enableCSRF: false,
});
