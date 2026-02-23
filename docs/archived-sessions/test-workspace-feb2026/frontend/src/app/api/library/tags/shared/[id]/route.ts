/**
 * API Route: Delete shared tags (used by anarchist library)
 *
 * DELETE /api/library/tags/shared/{id}
 *
 * Deletes tags from the shared.tags table and removes all associations.
 * This is used for anarchist library document tags which are stored in shared.tags
 * rather than library_tags.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * DELETE handler for shared tags
 */
async function deleteSharedTag(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only admins and moderators can delete tags
    if (user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Admin or moderator role required.' },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const tagId = parseInt(resolvedParams.id);

    if (isNaN(tagId)) {
      return NextResponse.json({ success: false, error: 'Invalid tag ID' }, { status: 400 });
    }

    // Check if tag exists in shared.tags
    const tagResult = await dbAdapter.query(
      'SELECT id, name, usage_count FROM shared.tags WHERE id = $1',
      [tagId],
      { schema: 'shared' }
    );
    const tag = tagResult.rows[0];

    if (!tag) {
      return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
    }

    // Remove tag from all anarchist documents
    await dbAdapter.query('DELETE FROM anarchist.document_tags WHERE tag_id = $1', [tagId], {
      schema: 'anarchist',
    });

    // Remove tag from all library documents
    await dbAdapter.query('DELETE FROM library.library_document_tags WHERE tag_id = $1', [tagId], {
      schema: 'library',
    });

    // Delete the tag itself
    await dbAdapter.query('DELETE FROM shared.tags WHERE id = $1', [tagId], {
      schema: 'shared',
    });

    return NextResponse.json({
      success: true,
      message: `Tag "${tag.name}" deleted successfully`,
    });
  } catch (error) {
    logger.error('Error deleting shared tag:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete tag' }, { status: 500 });
  }
}

export const DELETE = withSecurity(deleteSharedTag, {
  enableCSRF: true,
});
