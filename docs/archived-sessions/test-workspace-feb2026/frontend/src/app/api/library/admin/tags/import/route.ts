/**
 * API Route: Import Anarchist Tags
 *
 * POST /api/library/admin/tags/import
 * Populates the shared.tags table with anarchist tags
 *
 * SECURITY: Admin-only endpoint
 *
 * NOTE: Categories have been eliminated in the unified tag system.
 * Tags are now stored directly in shared.tags without category_id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { dbAdapter } from '@/lib/database/adapter';
import { ANARCHIST_TAGS } from '@/lib/library/anarchist-tag-seed';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function POSTHandler(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // SECURITY: Require admin role
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // AUDIT: Log admin action
    logger.info(`[ADMIN] Tag import triggered by user ${user.id} (${user.username})`);

    logger.info('Starting anarchist tag import via API...');

    const tagResults = [];
    let createdCount = 0;
    let existingCount = 0;

    // Import tags into unified shared.tags table
    for (const tag of ANARCHIST_TAGS) {
      try {
        // Check if tag already exists in shared.tags
        const existingResult = await dbAdapter.query('SELECT id FROM shared.tags WHERE name = $1', [
          tag.name,
        ]);

        if (existingResult.rows.length > 0) {
          existingCount++;
          tagResults.push({
            name: tag.name,
            status: 'exists',
            id: existingResult.rows[0].id,
          });
        } else {
          // Create tag in shared.tags (no category_id - categories eliminated)
          const insertResult = await dbAdapter.query(
            `INSERT INTO shared.tags (name, description, source, created_at)
             VALUES ($1, $2, 'anarchist', NOW())
             RETURNING id`,
            [tag.name, tag.description || null]
          );

          createdCount++;
          tagResults.push({
            name: tag.name,
            status: 'created',
            id: insertResult.rows[0].id,
          });
        }
      } catch (error) {
        logger.error(`Error with tag "${tag.name}":`, error);
        tagResults.push({
          name: tag.name,
          status: 'error',
          error: String(error),
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Anarchist tags imported successfully to shared.tags',
        tags: {
          total: ANARCHIST_TAGS.length,
          created: createdCount,
          existing: existingCount,
          errors: tagResults.filter(t => t.status === 'error').length,
        },
        performed_by: user.username,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Fatal error during tag import:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to import tags',
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(POSTHandler);
