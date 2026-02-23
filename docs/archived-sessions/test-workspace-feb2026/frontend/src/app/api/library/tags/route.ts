import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get current user to determine visibility filtering
    // First check query param (for server-side calls that can't pass cookies)
    const { searchParams } = request.nextUrl;
    const roleParam = searchParams.get('userRole');

    // If role param provided, use it; otherwise try to get from session
    let isPrivileged = false;
    if (roleParam === 'admin' || roleParam === 'moderator') {
      isPrivileged = true;
    } else if (!roleParam) {
      // No role param - try to get from session (client-side calls)
      const user = await getCurrentUser(request);
      isPrivileged = user?.role === 'admin' || user?.role === 'moderator';
    }

    // Get tags used by library documents from the unified tags system (shared.tags)
    // Join with library_document_tags to get only tags actually used by library documents
    // For non-privileged users, only count tags from PUBLIC documents
    const tagsResult = await dbAdapter.query(
      `
      SELECT
        t.id,
        t.name,
        COUNT(DISTINCT ldt.document_id) as usage_count
      FROM shared.tags t
      INNER JOIN library.library_document_tags ldt ON t.id = ldt.tag_id
      INNER JOIN library.library_documents ld ON ldt.document_id = ld.id
      ${!isPrivileged ? 'WHERE ld.is_public = true' : ''}
      GROUP BY t.id, t.name
      HAVING COUNT(DISTINCT ldt.document_id) > 0
      ORDER BY usage_count DESC, t.name
    `,
      []
    );
    const tags = tagsResult.rows;

    return NextResponse.json({
      success: true,
      tags: tags.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        usage_count: parseInt(tag.usage_count) || 0,
      })),
    });
  } catch (error) {
    logger.error('Error fetching library tags:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tags' }, { status: 500 });
  }
}

// POST endpoint to create new tags (for admin use)
// Creates tags in the unified tags system (shared.tags)
async function createTag(request: NextRequest) {
  try {
    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    // Insert the new tag into unified tags system
    const result = await dbAdapter.query(
      `
      INSERT INTO shared.tags (name, description, source)
      VALUES ($1, $2, 'library')
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      RETURNING id
    `,
      [name, description || null]
    );

    return NextResponse.json({
      success: true,
      tag: {
        id: result.rows[0].id,
        name: name,
        usage_count: 0,
      },
    });
  } catch (error) {
    logger.error('Error creating library tag:', error);
    return NextResponse.json({ success: false, error: 'Failed to create tag' }, { status: 500 });
  }
}

export const POST = withSecurity(createTag, {
  enableCSRF: true, // POST request needs CSRF
});
