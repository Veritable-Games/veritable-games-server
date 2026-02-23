import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError, NotFoundError } from '@/lib/utils/api-errors';
import { verifyAdminRole } from '@/lib/auth/ownership';
import { dbAdapter } from '@/lib/database/adapter';
import { sanitizeTitle } from '@/lib/utils/sanitize';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Journal with content from SQL JOIN
 * SELECT j.*, r.content, r.revision_timestamp
 * FROM journals j LEFT JOIN wiki_revisions r ...
 */
interface JournalWithContentResult {
  id: string;
  slug: string;
  title: string;
  created_at: Date | string;
  updated_at: Date | string;
  content: string | null;
  revision_timestamp: Date | string | null;
}

/**
 * GET /api/journals/[slug]
 * Fetch a single journal with content (for client-side selection)
 */
async function getJournal(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError('You must be logged in to access journals');
    }

    const params = await context.params;
    const { slug } = params;

    // Check if user is admin/developer (can access any journal)
    const isPrivileged = verifyAdminRole(user.role);

    // Fetch journal with latest content
    // Admin/developer users can access any journal, regular users can only access their own
    const journalResult = await dbAdapter.query(
      isPrivileged
        ? `SELECT
        j.id,
        j.slug,
        j.title,
        j.created_at,
        j.updated_at,
        j.user_id,
        r.content,
        r.revision_timestamp
      FROM journals j
      LEFT JOIN wiki_revisions r ON j.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = j.id)
      WHERE j.slug = $1`
        : `SELECT
        j.id,
        j.slug,
        j.title,
        j.created_at,
        j.updated_at,
        j.user_id,
        r.content,
        r.revision_timestamp
      FROM journals j
      LEFT JOIN wiki_revisions r ON j.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = j.id)
      WHERE j.slug = $1
        AND j.user_id = $2`,
      isPrivileged ? [slug] : [slug, user.id],
      { schema: 'wiki' }
    );
    const journal = journalResult.rows[0] as JournalWithContentResult;

    if (!journal) {
      throw new NotFoundError('Journal', slug);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: journal.id,
        slug: journal.slug,
        title: journal.title,
        created_at: journal.created_at,
        updated_at: journal.updated_at,
        content: journal.content || '',
        revision_timestamp: journal.revision_timestamp || null,
      },
    });
  } catch (error) {
    logger.error('Error fetching journal:', error);
    return errorResponse(error);
  }
}

/**
 * PATCH /api/journals/[slug]
 * Save journal content (manual save) or update title (rename)
 */
async function saveJournal(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const { slug } = params;
    const body = await request.json();
    const { content, title } = body;

    // Check if user is admin/developer (can edit any journal)
    const isPrivileged = verifyAdminRole(user.role);

    // Must provide either content or title
    if (content === undefined && title === undefined) {
      return NextResponse.json(
        { success: false, error: 'Content or title is required' },
        { status: 400 }
      );
    }

    // Get the journal
    // Admin/developer users can edit any journal, regular users can only edit their own
    const journalResult = await dbAdapter.query(
      isPrivileged
        ? `SELECT id, slug, title, user_id, created_at, updated_at FROM journals WHERE slug = $1`
        : `SELECT id, slug, title, user_id, created_at, updated_at FROM journals WHERE slug = $1 AND user_id = $2`,
      isPrivileged ? [slug] : [slug, user.id],
      { schema: 'wiki' }
    );

    if (journalResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Journal not found' }, { status: 404 });
    }

    const journal = journalResult.rows[0];

    // Audit log if admin is editing another user's journal
    if (isPrivileged && journal.user_id !== user.id) {
      logger.warn('[ADMIN] Editing journal owned by different user', {
        adminId: user.id,
        adminEmail: user.email,
        journalId: journal.id,
        originalOwnerId: journal.user_id,
        slug,
        action: title !== undefined ? 'rename' : 'content_update',
      });
    }

    // Handle title update (rename)
    if (title !== undefined) {
      const sanitized = sanitizeTitle(title.trim());
      if (!sanitized) {
        return NextResponse.json(
          { success: false, error: 'Title cannot be empty' },
          { status: 400 }
        );
      }

      await dbAdapter.query(
        `UPDATE journals SET title = $1, updated_at = NOW() WHERE id = $2`,
        [sanitized, journal.id],
        { schema: 'wiki' }
      );

      return NextResponse.json({
        success: true,
        message: 'Title updated successfully',
      });
    }

    // Handle content update (manual save)
    if (content !== undefined) {
      // Journals are plain text only - no HTML sanitization needed
      // Just ensure it's a string and trim whitespace
      const sanitizedContent = typeof content === 'string' ? content.trim() : '';

      const contentBytes = Buffer.from(sanitizedContent, 'utf8').length;

      // Insert revision into wiki_revisions (shared table for both wiki and journal content)
      await dbAdapter.query(
        `INSERT INTO wiki_revisions (page_id, content, summary, content_format, author_id, is_minor, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          journal.id,
          sanitizedContent,
          'Manual save',
          'markdown',
          user.id,
          0, // Not a minor edit
          contentBytes,
        ],
        { schema: 'wiki' }
      );

      // Update journal's updated_at timestamp
      await dbAdapter.query(`UPDATE journals SET updated_at = NOW() WHERE id = $1`, [journal.id], {
        schema: 'wiki',
      });

      return NextResponse.json({
        success: true,
        message: 'Saved successfully',
      });
    }
  } catch (error: any) {
    logger.error('Save error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getJournal, {
  enableCSRF: false,
});

export const PATCH = withSecurity(saveJournal, {
  enableCSRF: false,
});
