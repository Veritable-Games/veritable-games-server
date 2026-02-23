import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { cache } from '@/lib/cache';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// POST handler for batch updating wiki category sort orders
async function batchUpdateHandler(request: NextRequest) {
  try {
    // Check authentication and authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only admins and moderators can update categories
    if (user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Admin or moderator role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { updates } = body;

    // Validate updates array
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid updates array. Expected non-empty array.' },
        { status: 400 }
      );
    }

    // Validate each update object
    for (const update of updates) {
      if (!update.id || typeof update.id !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Each update must have a valid id' },
          { status: 400 }
        );
      }
      if (typeof update.sort_order !== 'number') {
        return NextResponse.json(
          { success: false, error: 'Each update must have a numeric sort_order' },
          { status: 400 }
        );
      }
    }

    // Perform all updates
    let updatedCount = 0;
    for (const update of updates) {
      const result = await dbAdapter.query(
        `
        UPDATE wiki_categories
        SET sort_order = $1
        WHERE id = $2
      `,
        [update.sort_order, update.id],
        { schema: 'wiki' }
      );
      if (result.rowCount && result.rowCount > 0) {
        updatedCount++;
      }
    }

    logger.info(`[Batch Update] Updated ${updatedCount} of ${updates.length} categories`);

    // Verify writes persisted by reading back one category
    const firstUpdate = updates[0];
    const verifyResult = await dbAdapter.query(
      'SELECT id, sort_order FROM wiki_categories WHERE id = $1',
      [firstUpdate.id],
      { schema: 'wiki' }
    );
    const verifyRow = verifyResult.rows[0];

    if (!verifyRow || verifyRow.sort_order !== firstUpdate.sort_order) {
      logger.error('[Batch Update] Write verification FAILED:', {
        expected: firstUpdate.sort_order,
        actual: verifyRow?.sort_order,
        category: firstUpdate.id,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Database write verification failed. Expected sort_order ${firstUpdate.sort_order}, got ${verifyRow?.sort_order}`,
        },
        { status: 500 }
      );
    }

    logger.info('[Batch Update] Write verification passed');

    // Invalidate category cache after update
    const cacheKeys = [
      'categories:all:admin',
      'categories:all:moderator',
      'categories:all:user',
      'categories:all:anonymous',
      'categories:root:admin',
      'categories:root:moderator',
      'categories:root:user',
      'categories:root:anonymous',
      'categories:hierarchy:admin',
      'categories:hierarchy:moderator',
      'categories:hierarchy:user',
      'categories:hierarchy:anonymous',
    ];

    await Promise.all(cacheKeys.map(key => cache.delete({ category: 'content', identifier: key })));

    logger.info('[Batch Update] Cache invalidated for', cacheKeys.length, 'keys');

    return NextResponse.json({
      success: true,
      message: 'Categories updated successfully',
      updated: updatedCount,
      total: updates.length,
    });
  } catch (error: any) {
    logger.error('Batch update wiki categories error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to batch update wiki categories',
      },
      { status: 500 }
    );
  }
}

// Apply security middleware
export const POST = withSecurity(batchUpdateHandler);
