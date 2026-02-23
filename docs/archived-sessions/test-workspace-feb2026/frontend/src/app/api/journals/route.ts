import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { sanitizeTitle } from '@/lib/utils/sanitize';
import { journalCategoryService } from '@/lib/journals/JournalCategoryService';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/journals?slug=journal-slug
 * Fetch a journal by slug
 */
async function getJournal(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError('You must be logged in to access journals');
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      throw new ValidationError('Slug parameter is required');
    }

    // Fetch journal by slug from journals table
    const result = await dbAdapter.query(`SELECT * FROM journals WHERE slug = $1`, [slug], {
      schema: 'wiki',
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Journal not found' }, { status: 404 });
    }

    const journal = result.rows[0];

    // Check ownership (unless admin/developer)
    const isPrivileged = ['admin', 'developer'].includes(user.role);
    if (!isPrivileged && journal.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only access your own journals' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: journal,
    });
  } catch (error) {
    logger.error('Error fetching journal:', error);
    return errorResponse(error);
  }
}

/**
 * POST /api/journals
 * Create a new journal entry inline (no navigation)
 */
async function createJournal(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError('You must be logged in to create journals');
    }

    const body = await request.json();
    const { title } = body;

    // Validate title if provided
    if (title && typeof title !== 'string') {
      throw new ValidationError('Title must be a string');
    }

    // Sanitize title (strip any HTML tags)
    const sanitizedTitle = title
      ? sanitizeTitle(title)
      : `Journal - ${new Date().toLocaleString()}`;

    // Auto-generate unique slug from timestamp + random component
    // Random suffix prevents collisions when multiple journals created rapidly
    const timestamp = new Date().getTime();
    const random = Math.random().toString(36).substring(2, 9); // 7 random chars
    const slug = `journal-${timestamp}-${random}`;

    // Ensure user has the Uncategorized category
    const uncategorized = await journalCategoryService.ensureUncategorized(user.id);

    // Create journal in journals table
    const result = await dbAdapter.query(
      `INSERT INTO journals (user_id, title, slug, content, category_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user.id, sanitizedTitle, slug, '', uncategorized.id],
      { schema: 'wiki' }
    );

    const journal = result.rows[0];

    // Return created journal with user-friendly data
    return NextResponse.json({
      success: true,
      data: {
        id: journal.id,
        slug: journal.slug,
        title: journal.title,
        content: journal.content,
        created_at: journal.created_at,
        updated_at: journal.updated_at,
        category_id: journal.category_id,
      },
    });
  } catch (error) {
    logger.error('Error creating journal:', error);
    return errorResponse(error);
  }
}

export const GET = withSecurity(getJournal, {
  enableCSRF: false,
});

export const POST = withSecurity(createJournal, {
  enableCSRF: false, // CSRF not needed - user auth validated via getCurrentUser()
});
