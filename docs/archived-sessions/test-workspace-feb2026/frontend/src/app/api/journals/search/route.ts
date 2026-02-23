import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { verifyAdminRole } from '@/lib/auth/ownership';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// GET /api/journals/search - Search within user's journals
async function searchJournals(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];

    // Validate query
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Search query must be at least 2 characters long',
        },
        { status: 400 }
      );
    }

    // Use PostgreSQL Full-Text Search (FTS) for better performance
    // FTS is 50-80% faster than LIKE queries, especially for multi-word searches
    const searchQuery = query.trim();

    // Check if user is admin/developer (can search all journals)
    const isPrivileged = verifyAdminRole(user.role);

    // Get total count using FTS
    // Admin/developer users can search all journals, regular users can only search their own
    const countResult = await dbAdapter.query(
      isPrivileged
        ? `SELECT COUNT(*) as total
       FROM journals
       WHERE search_vector @@ plainto_tsquery('english', $1)
       AND is_deleted = FALSE`
        : `SELECT COUNT(*) as total
       FROM journals
       WHERE user_id = $1
       AND search_vector @@ plainto_tsquery('english', $2)
       AND is_deleted = FALSE`,
      isPrivileged ? [searchQuery] : [user.id, searchQuery],
      { schema: 'wiki' }
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results with relevance ranking
    // ts_rank() scores results by relevance (title matches rank higher due to weight 'A')
    // Admin/developer users can search all journals, regular users can only search their own
    const journalsResult = await dbAdapter.query(
      isPrivileged
        ? `SELECT
         id,
         title,
         slug,
         content,
         created_at,
         updated_at,
         category_id,
         ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
       FROM journals
       WHERE search_vector @@ plainto_tsquery('english', $1)
       AND is_deleted = FALSE
       ORDER BY rank DESC, updated_at DESC
       LIMIT $2 OFFSET $3`
        : `SELECT
         id,
         title,
         slug,
         content,
         created_at,
         updated_at,
         category_id,
         ts_rank(search_vector, plainto_tsquery('english', $2)) as rank
       FROM journals
       WHERE user_id = $1
       AND search_vector @@ plainto_tsquery('english', $2)
       AND is_deleted = FALSE
       ORDER BY rank DESC, updated_at DESC
       LIMIT $3 OFFSET $4`,
      isPrivileged ? [searchQuery, limit, offset] : [user.id, searchQuery, limit, offset],
      { schema: 'wiki' }
    );

    return NextResponse.json({
      success: true,
      data: {
        pages: journalsResult.rows,
        total,
        has_more: offset + journalsResult.rows.length < total,
        query,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    logger.error('Journal search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search journals',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// Apply security middleware (no CSRF needed for GET requests)
export const GET = withSecurity(searchJournals, {});
