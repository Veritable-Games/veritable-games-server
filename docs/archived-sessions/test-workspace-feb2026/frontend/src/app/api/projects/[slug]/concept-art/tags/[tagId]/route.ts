import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import type { ReferenceTagId } from '@/lib/database/schema-types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/projects/[slug]/concept-art/tags/[tagId]
 * Delete a concept art tag (admin only)
 */
async function deleteTagHandler(
  request: NextRequest,
  context: { params: Promise<{ slug: string; tagId: string }> }
) {
  try {
    const { tagId } = await context.params;

    if (!tagId || tagId.trim() === '') {
      return NextResponse.json({ error: 'Invalid tag ID' }, { status: 400 });
    }

    // Check authentication and admin authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Delete the tag
    const { dbAdapter } = await import('@/lib/database/adapter');

    // Check if tag exists
    const tagResult = await dbAdapter.query(
      'SELECT id FROM concept art_tags WHERE id = $1',
      [tagId],
      { schema: 'content' }
    );
    const tag = tagResult.rows[0] as { id: ReferenceTagId } | undefined;

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Delete tag assignments first
    await dbAdapter.query('DELETE FROM project_concept art_image_tags WHERE tag_id = $1', [tagId], {
      schema: 'content',
    });

    // Delete the tag itself
    await dbAdapter.query('DELETE FROM concept art_tags WHERE id = $1', [tagId], {
      schema: 'content',
    });

    return NextResponse.json({
      success: true,
      message: 'Tag deleted successfully',
    });
  } catch (error) {
    logger.error('Delete tag error:', error);
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
  }
}

export const DELETE = withSecurity(deleteTagHandler, {
  enableCSRF: true,
});
