import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { dbAdapter } from '@/lib/database/adapter';
import { validateWithSchema } from '@/lib/schemas/unified';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST /api/wiki/pages/[slug]/revisions/restore
 * Restore a wiki page to a specific revision
 */
async function postHandler(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const params = await context.params;
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();

    // Schema for restore revision request
    const restoreRevisionSchema = z.object({
      revisionId: z.number().int().positive('Revision ID must be a positive integer'),
      summary: z.string().max(200, 'Summary must be less than 200 characters').optional(),
    });

    // Validate request data
    const validation = validateWithSchema(restoreRevisionSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const { revisionId, summary } = validation.data;

    // Get the wiki page
    const pageResult = await dbAdapter.query(
      `
      SELECT id, title, slug, created_by
      FROM wiki_pages
      WHERE slug = $1
    `,
      [params.slug],
      { schema: 'wiki' }
    );
    const page = pageResult.rows[0];

    if (!page) {
      return NextResponse.json({ error: 'Wiki page not found' }, { status: 404 });
    }

    // Check if user has permission to edit this page
    // For now, any authenticated user can edit public pages
    // TODO: Add more granular permissions

    // Get the revision to restore
    const revisionResult = await dbAdapter.query(
      `
      SELECT content, content_format
      FROM wiki_revisions
      WHERE id = $1 AND page_id = $2
    `,
      [revisionId, page.id],
      { schema: 'wiki' }
    );
    const revision = revisionResult.rows[0];

    if (!revision) {
      return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
    }

    // Create a new revision with the content from the selected revision
    const contentBytes = Buffer.from(revision.content, 'utf8').length;

    const result = await dbAdapter.query(
      `
      INSERT INTO wiki_revisions (
        page_id,
        content,
        summary,
        content_format,
        author_id,
        revision_timestamp,
        is_minor,
        size_bytes
      ) VALUES ($1, $2, $3, $4, $5, NOW(), 0, $6)
      RETURNING id
    `,
      [
        page.id,
        revision.content,
        summary || `Restored to revision #${revisionId}`,
        revision.content_format || 'markdown',
        user.id,
        contentBytes,
      ],
      { schema: 'wiki' }
    );

    // Update the wiki page's updated_at timestamp
    await dbAdapter.query(
      `
      UPDATE wiki_pages
      SET updated_at = NOW()
      WHERE id = $1
    `,
      [page.id],
      { schema: 'wiki' }
    );

    // Clear cache for this page
    const { cacheManager } = await import('@/lib/cache/manager');
    if (cacheManager) {
      await cacheManager.delete({
        category: 'content',
        identifier: `wiki:page:${params.slug}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully restored to revision #${revisionId}`,
      newRevisionId: result.rows[0].id,
    });
  } catch (error) {
    logger.error('Error restoring wiki revision:', error);
    return NextResponse.json({ error: 'Failed to restore wiki revision' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, {
  enableCSRF: true,
});
