import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { dbAdapter } from '@/lib/database/adapter';
import { validateWithSchema } from '@/lib/schemas/unified';
import { z } from 'zod';
import { parseWikiSlug } from '@/lib/wiki/utils/slug-parser';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/wiki/pages/[slug]/revisions
 * Get revision history for a wiki page
 */
async function getHandler(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const params = await context.params;
    const { slug: rawSlug } = params;
    const user = await getCurrentUser(request);

    // Parse slug to handle namespaces (e.g., "library/doom-bible")
    const { slug, namespace } = parseWikiSlug(rawSlug);

    // Get the wiki page with namespace support
    const pageResult = await dbAdapter.query(
      `
      SELECT id, title, slug, namespace, status, created_by
      FROM wiki_pages
      WHERE slug = $1 AND namespace = $2
    `,
      [slug, namespace],
      { schema: 'wiki' }
    );
    const page = pageResult.rows[0];

    if (!page) {
      return NextResponse.json({ error: 'Wiki page not found' }, { status: 404 });
    }

    // Check if user has permission to view revisions
    // Public pages allow public revision viewing
    // Private pages require authentication
    if (page.status !== 'published' && !user) {
      return NextResponse.json(
        { error: 'Authentication required to view revisions of this page' },
        { status: 401 }
      );
    }

    // Get all revisions for this page
    const revisionsResult = await dbAdapter.query(
      `
      SELECT
        id,
        page_id,
        content,
        summary,
        content_format,
        author_id,
        author_ip,
        revision_timestamp,
        is_minor,
        size_bytes as size,
        CASE
          WHEN author_id IS NOT NULL THEN 'User #' || author_id::text
          ELSE 'Anonymous'
        END as author_name
      FROM wiki_revisions
      WHERE page_id = $1
      ORDER BY id DESC
    `,
      [page.id],
      { schema: 'wiki' }
    );
    const revisions = revisionsResult.rows;

    // Format the response
    return NextResponse.json({
      success: true,
      page: {
        id: page.id,
        title: page.title,
        slug: page.slug,
      },
      revisions: revisions.map(rev => ({
        id: rev.id,
        content: rev.content,
        summary: rev.summary || 'No summary provided',
        revision_timestamp: rev.revision_timestamp,
        author_name: rev.author_name,
        size: rev.size || 0,
        is_minor: rev.is_minor === 1,
      })),
      total: revisions.length,
    });
  } catch (error) {
    const params = await context.params;
    logger.error('Error fetching wiki revisions', { error, rawSlug: params.slug });
    return NextResponse.json({ error: 'Failed to fetch wiki revisions' }, { status: 500 });
  }
}

/**
 * DELETE /api/wiki/pages/[slug]/revisions
 * Delete a specific revision
 */
async function deleteHandler(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const params = await context.params;
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Only admins and moderators can delete revisions
    if (user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json({ error: 'Admin or moderator access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    // Schema for DELETE query parameters
    const deleteRevisionSchema = z.object({
      revisionId: z
        .string()
        .min(1, 'Revision ID is required')
        .transform(val => parseInt(val))
        .refine(val => !isNaN(val) && val > 0, 'Revision ID must be a positive number'),
    });

    // Validate query parameters
    const validation = validateWithSchema(deleteRevisionSchema, {
      revisionId: searchParams.get('revisionId'),
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const { revisionId } = validation.data;

    // Parse slug to handle namespaces
    const { slug, namespace } = parseWikiSlug(params.slug);

    // Get the wiki page with namespace support
    const pageResult = await dbAdapter.query(
      'SELECT id FROM wiki_pages WHERE slug = $1 AND namespace = $2',
      [slug, namespace],
      { schema: 'wiki' }
    );
    const page = pageResult.rows[0];

    if (!page) {
      return NextResponse.json({ error: 'Wiki page not found' }, { status: 404 });
    }

    // Check if this revision exists and belongs to this page
    const revisionResult = await dbAdapter.query(
      `
      SELECT id FROM wiki_revisions
      WHERE id = $1 AND page_id = $2
    `,
      [revisionId, page.id],
      { schema: 'wiki' }
    );
    const revision = revisionResult.rows[0];

    if (!revision) {
      return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
    }

    // Don't allow deleting the only revision
    const revisionCountResult = await dbAdapter.query(
      `
      SELECT COUNT(*) as count
      FROM wiki_revisions
      WHERE page_id = $1
    `,
      [page.id],
      { schema: 'wiki' }
    );
    const revisionCount = revisionCountResult.rows[0];

    if (revisionCount.count <= 1) {
      return NextResponse.json({ error: 'Cannot delete the only revision' }, { status: 400 });
    }

    // Delete the revision
    await dbAdapter.query(
      `
      DELETE FROM wiki_revisions
      WHERE id = $1 AND page_id = $2
    `,
      [revisionId, page.id],
      { schema: 'wiki' }
    );

    return NextResponse.json({
      success: true,
      message: 'Revision deleted successfully',
    });
  } catch (error) {
    const params = await context.params;
    logger.error('Error deleting wiki revision', { error, rawSlug: params.slug });
    return NextResponse.json({ error: 'Failed to delete wiki revision' }, { status: 500 });
  }
}

// Apply security middleware
export const GET = withSecurity(getHandler, {});
export const DELETE = withSecurity(deleteHandler, {
  enableCSRF: true,
});
