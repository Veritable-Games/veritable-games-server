import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { journalCategoryService } from '@/lib/journals/JournalCategoryService';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import { assertJournalOwnership, verifyAdminRole } from '@/lib/auth/ownership';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/journals/[slug]/move
 * Move a journal to a different category
 */
async function moveJournal(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError('You must be logged in to move journals');
    }

    const params = await context.params;
    const slug = params.slug;

    const body = await request.json();
    const { categoryId } = body;

    if (!categoryId || typeof categoryId !== 'string') {
      throw new ValidationError('categoryId is required');
    }

    // Get the journal ID from the slug
    const journalResult = await dbAdapter.query(
      `SELECT id, user_id FROM journals
       WHERE slug = $1`,
      [slug],
      { schema: 'wiki' }
    );

    if (journalResult.rows.length === 0) {
      throw new ValidationError('Journal not found');
    }

    const journal = journalResult.rows[0];

    // Verify ownership (allow admin bypass)
    const isPrivileged = verifyAdminRole(user.role);
    assertJournalOwnership(journal, user, { allowAdmin: true });

    await journalCategoryService.moveJournalToCategory(user.id, journal.id, categoryId, {
      isAdmin: isPrivileged,
    });

    return NextResponse.json({
      success: true,
      message: 'Journal moved successfully',
    });
  } catch (error) {
    logger.error('Error moving journal:', error);
    return errorResponse(error);
  }
}

export const POST = withSecurity(moveJournal, { enableCSRF: false });
