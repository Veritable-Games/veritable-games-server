/**
 * Forum Statistics API
 *
 * GET /api/forums/stats - Get forum statistics
 *
 * Returns overall forum statistics including:
 * - Total topics count
 * - Total replies count
 * - Total categories count
 * - Recent activity (latest topics and replies)
 *
 * Returns:
 * - success: boolean
 * - data: ForumStats
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { CategoryRepository } from '@/lib/forums/repositories/category-repository';
import { TopicRepository } from '@/lib/forums/repositories/topic-repository';
import { ReplyRepository } from '@/lib/forums/repositories/reply-repository';
import { errorResponse } from '@/lib/utils/api-errors';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import type { TopicId } from '@/lib/forums/branded-types';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

export const GET = withSecurity(async (request: NextRequest) => {
  try {
    // 1. Get category count
    const categoryRepo = new CategoryRepository();
    const categoriesResult = await categoryRepo.findAll();

    if (categoriesResult.isErr()) {
      const err = categoriesResult.error;
      throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
    }

    const categoriesCount = categoriesResult.value.length;

    // 2. Get total topics count
    const topicsCountResult = await dbAdapter.query(
      'SELECT COUNT(*) as count FROM forum_topics WHERE deleted_at IS NULL',
      [],
      { schema: 'forums' }
    );
    const topicsCount = topicsCountResult.rows[0]?.count || 0;

    // 3. Get total replies count
    const repliesCountResult = await dbAdapter.query(
      'SELECT COUNT(*) as count FROM forum_replies',
      [],
      { schema: 'forums' }
    );
    const repliesCount = repliesCountResult.rows[0]?.count || 0;

    // 4. Get recent topics (last 5)
    const topicRepo = new TopicRepository();
    const recentTopics: any[] = [];

    try {
      const recentTopicsResult = await dbAdapter.query(
        `SELECT id FROM forum_topics
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 5`,
        [],
        { schema: 'forums' }
      );

      for (const row of recentTopicsResult.rows) {
        const topicResult = await topicRepo.findById(row.id as TopicId, { include_author: true });
        if (topicResult.isOk() && topicResult.value) {
          recentTopics.push(topicResult.value);
        }
      }
    } catch (error) {
      logger.warn('Error fetching recent topics:', error);
      // Continue even if this fails
    }

    // 5. Get recent replies (last 5)
    const replyRepo = new ReplyRepository();
    const recentRepliesResult = await replyRepo.getRecent(5);
    const recentReplies = recentRepliesResult.isOk() ? recentRepliesResult.value : [];

    // 6. Get posts per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    const dailyActivityResult = await dbAdapter.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as count
       FROM (
         SELECT created_at FROM forum_topics WHERE created_at >= $1 AND deleted_at IS NULL
         UNION ALL
         SELECT created_at FROM forum_replies WHERE created_at >= $2
       ) combined
       GROUP BY date
       ORDER BY date DESC
       LIMIT 30`,
      [thirtyDaysAgoStr, thirtyDaysAgoStr],
      { schema: 'forums' }
    );
    const dailyActivityRows = dailyActivityResult.rows;

    // 7. Get most active categories (by topic count)
    const activeCategoriesResult = await dbAdapter.query(
      `SELECT
        c.id,
        c.name,
        c.slug,
        COUNT(t.id) as topic_count
       FROM forum_categories c
       LEFT JOIN forum_topics t ON c.id = t.category_id AND t.deleted_at IS NULL
       GROUP BY c.id, c.name, c.slug
       ORDER BY topic_count DESC
       LIMIT 5`,
      [],
      { schema: 'forums' }
    );
    const activeCategories = activeCategoriesResult.rows;

    return NextResponse.json({
      success: true,
      data: {
        total_categories: categoriesCount,
        total_topics: topicsCount,
        total_replies: repliesCount,
        total_posts: topicsCount + repliesCount,
        recent_topics: recentTopics,
        recent_replies: recentReplies,
        daily_activity: dailyActivityRows,
        active_categories: activeCategories,
      },
    });
  } catch (error) {
    logger.error('Error fetching forum stats:', error);
    return errorResponse(error);
  }
});
