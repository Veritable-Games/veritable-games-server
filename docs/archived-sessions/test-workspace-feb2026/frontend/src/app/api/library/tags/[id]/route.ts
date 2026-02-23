import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/library/tags/:id
 *
 * Delete a tag from the unified tags system (shared.tags).
 * This will cascade delete all document associations.
 */
async function deleteTag(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication and admin role
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const params = await context.params;
    const tagId = parseInt(params.id);

    if (isNaN(tagId)) {
      return NextResponse.json({ success: false, error: 'Invalid tag ID' }, { status: 400 });
    }

    // Delete the tag (CASCADE will handle document associations)
    const result = await dbAdapter.query(`DELETE FROM shared.tags WHERE id = $1 RETURNING id`, [
      tagId,
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Tag deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting tag:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete tag' }, { status: 500 });
  }
}

export const DELETE = withSecurity(deleteTag, {
  enableCSRF: true, // DELETE request needs CSRF protection
});
