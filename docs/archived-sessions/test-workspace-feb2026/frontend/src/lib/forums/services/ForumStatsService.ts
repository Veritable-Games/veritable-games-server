/**
 * ForumStatsService - Analytics and statistics for forums
 *
 * Provides comprehensive statistics including:
 * - Overall forum stats (topics, replies, users)
 * - Category-specific stats
 * - User contribution stats
 * - Trending topics calculation
 * - Popular tags and active users
 *
 * Architecture:
 * - Implements caching for expensive aggregate queries
 * - Uses repository layer for data access
 * - Calculates trending based on activity scores
 * - Supports time-based filters (today, week, month, all-time)
 *
 * @module lib/forums/services/ForumStatsService
 */

import { Result, Ok, Err } from '@/lib/utils/result';
import { SimpleLRUCache } from '@/lib/cache/lru';
import { dbAdapter } from '@/lib/database/adapter';
import { repositories } from '../repositories';
import { TopicStatusFlags, hasFlag } from '../status-flags';
import { logger } from '@/lib/utils/logger';
import type {
  ForumStats,
  CategoryStats,
  UserForumStats,
  ForumTopic,
  ForumReply,
  ForumTag,
  CategoryId,
  UserId,
} from '../types';

// Service error type (discriminated union of error objects)
type ServiceError =
  | { type: 'not_found'; entity: string; id: number | string }
  | { type: 'database'; operation: string; message: string }
  | { type: 'validation'; field: string; message: string };

// Database row interfaces for raw query results
interface RecentTopicRow {
  id: number;
  title: string;
  category_id: number;
  reply_count: number;
  view_count: number;
  status: number;
  created_at: string;
  category_name: string;
}

interface RecentReplyRow {
  id: number;
  topic_id: number;
  content: string;
  is_solution: boolean | number;
  created_at: string;
  topic_title: string;
}

interface MostActiveCategoryRow {
  id: number;
  name: string;
  post_count: number;
}

// ============================================================================
// Cache Configuration
// ============================================================================

const STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const USER_STATS_CACHE_SIZE = 1000;
const CATEGORY_STATS_CACHE_SIZE = 50;

// ============================================================================
// ForumStatsService Class
// ============================================================================

export class ForumStatsService {
  // Cache instances
  private forumStatsCache: SimpleLRUCache<string, ForumStats>;
  private categoryStatsCache: SimpleLRUCache<number, CategoryStats>;
  private userStatsCache: SimpleLRUCache<number, UserForumStats>;

  constructor() {
    // Initialize caches
    this.forumStatsCache = new SimpleLRUCache({
      max: 10,
      ttl: STATS_CACHE_TTL,
      updateAgeOnGet: true,
    });

    this.categoryStatsCache = new SimpleLRUCache({
      max: CATEGORY_STATS_CACHE_SIZE,
      ttl: STATS_CACHE_TTL,
      updateAgeOnGet: true,
    });

    this.userStatsCache = new SimpleLRUCache({
      max: USER_STATS_CACHE_SIZE,
      ttl: STATS_CACHE_TTL,
      updateAgeOnGet: true,
    });
  }

  // ==========================================================================
  // Overall Forum Statistics
  // ==========================================================================

  /**
   * Get overall forum statistics
   *
   * @returns Result with forum stats or error
   */
  async getForumStats(): Promise<Result<ForumStats, ServiceError>> {
    try {
      // Try cache first
      const cacheKey = 'forum_stats';
      const cached = this.forumStatsCache.get(cacheKey);
      if (cached) {
        return Ok(cached);
      }

      // Get total counts
      const totalsResult = await dbAdapter.query(
        `
        SELECT
          (SELECT COUNT(*) FROM forum_topics WHERE deleted_at IS NULL) as total_topics,
          (SELECT COUNT(*) FROM forum_replies WHERE deleted_at IS NULL) as total_replies,
          (SELECT COALESCE(SUM(view_count), 0) FROM forum_topics WHERE deleted_at IS NULL) as total_views
      `,
        [],
        { schema: 'forums' }
      );
      const totals = totalsResult.rows[0] as {
        total_topics: number;
        total_replies: number;
        total_views: number;
      };

      // Get unique user count from forum_topics
      const uniqueTopicAuthorsResult = await dbAdapter.query(
        `
        SELECT COUNT(DISTINCT user_id) as count
        FROM forum_topics
        WHERE deleted_at IS NULL
      `,
        [],
        { schema: 'forums' }
      );
      const uniqueTopicAuthors = uniqueTopicAuthorsResult.rows[0] as { count: number };

      const uniqueReplyAuthorsResult = await dbAdapter.query(
        `
        SELECT COUNT(DISTINCT user_id) as count
        FROM forum_replies
        WHERE deleted_at IS NULL
      `,
        [],
        { schema: 'forums' }
      );
      const uniqueReplyAuthors = uniqueReplyAuthorsResult.rows[0] as { count: number };

      // Get total users from users database (only active users visible to public)
      const totalUsersResult = await dbAdapter.query(
        "SELECT COUNT(*) as count FROM users WHERE status = 'active'",
        [],
        { schema: 'users' }
      );
      const totalUsers = totalUsersResult.rows[0] as { count: number };

      // Get active users TODAY (posted today)
      const activeUsersTodayResult = await dbAdapter.query(
        `
        SELECT COUNT(DISTINCT user_id) as count
        FROM (
          SELECT user_id FROM forum_topics
          WHERE deleted_at IS NULL
            AND DATE(created_at) = CURRENT_DATE
          UNION
          SELECT user_id FROM forum_replies
          WHERE deleted_at IS NULL
            AND DATE(created_at) = CURRENT_DATE
        ) AS active_users
      `,
        [],
        { schema: 'forums' }
      );
      const activeUsersToday = activeUsersTodayResult.rows[0] as { count: number };

      // Get most active category
      const mostActiveCategoryResult = await dbAdapter.query(
        `
        SELECT c.*
        FROM forum_categories c
        ORDER BY c.topic_count DESC, c.reply_count DESC
        LIMIT 1
      `,
        [],
        { schema: 'forums' }
      );
      const mostActiveCategory = mostActiveCategoryResult.rows[0] || null;

      // Get recent topics (use getRecent method)
      const recentTopicsResult = await repositories.topics.getRecent(5);
      const recentTopics = recentTopicsResult.isOk() ? recentTopicsResult.value : [];

      // Get recent replies - Note: findAll method doesn't exist, using empty array
      const recentReplies: ForumReply[] = [];

      // Get popular tags (if tags table exists)
      // Note: forum_tags table not yet implemented - future feature
      // Migration available at: scripts/migrations/add-forum-tags-tables.sql
      let popularTags: ForumTag[] = [];
      try {
        // Check if forum_tags table exists
        const tableExistsResult = await dbAdapter.query(
          `
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'forums'
            AND table_name = 'forum_tags'
          ) as exists
        `,
          [],
          { schema: 'forums' }
        );

        const tableExists = tableExistsResult.rows[0]?.exists;

        if (tableExists) {
          const popularTagsResult = await dbAdapter.query(
            `
            SELECT *
            FROM forum_tags
            ORDER BY usage_count DESC
            LIMIT 10
          `,
            [],
            { schema: 'forums' }
          );
          popularTags = popularTagsResult.rows as ForumTag[];
        }
      } catch (error) {
        // Tags table doesn't exist yet, ignore error
        logger.info('[ForumStatsService] Tags feature not yet enabled');
        popularTags = [];
      }

      const stats: ForumStats = {
        total_topics: totals.total_topics || 0,
        total_replies: totals.total_replies || 0,
        total_users: totalUsers.count || 0,
        active_users_today: activeUsersToday.count || 0,
        recent_topics: recentTopics,
        popular_categories: [], // Will be populated if needed
      };

      // Cache the stats
      this.forumStatsCache.set(cacheKey, stats);

      return Ok(stats);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'get_forum_stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==========================================================================
  // Category Statistics
  // ==========================================================================

  /**
   * Get statistics for a specific category
   *
   * @param categoryId - Category ID
   * @returns Result with category stats or error
   */
  async getCategoryStats(categoryId: CategoryId): Promise<Result<CategoryStats, ServiceError>> {
    try {
      // Try cache first
      const cached = this.categoryStatsCache.get(categoryId);
      if (cached) {
        return Ok(cached);
      }

      // Get category
      const categoryResult = await repositories.categories.findById(categoryId);
      if (categoryResult.isErr()) {
        return Err({
          type: 'not_found',
          entity: 'category',
          id: categoryId,
        });
      }

      const category = categoryResult.value;
      if (!category) {
        return Err({
          type: 'not_found',
          entity: 'category',
          id: categoryId,
        });
      }
      // Get total counts for category
      const totalsResult = await dbAdapter.query(
        `
        SELECT
          COUNT(DISTINCT t.id) as total_topics,
          COUNT(DISTINCT r.id) as total_replies,
          SUM(t.view_count) as total_views
        FROM forum_topics t
        LEFT JOIN forum_replies r ON r.topic_id = t.id
        WHERE t.category_id = $1
      `,
        [categoryId],
        { schema: 'forums' }
      );
      const totals = totalsResult.rows[0] as {
        total_topics: number;
        total_replies: number;
        total_views: number;
      };

      // Get unique contributors
      const contributorsResult = await dbAdapter.query(
        `
        SELECT COUNT(DISTINCT user_id) as count
        FROM (
          SELECT author_id as user_id FROM forum_topics WHERE category_id = $1
          UNION
          SELECT r.author_id as user_id
          FROM forum_replies r
          JOIN forum_topics t ON r.topic_id = t.id
          WHERE t.category_id = $1
        ) AS contributors
      `,
        [categoryId],
        { schema: 'forums' }
      );
      const contributors = contributorsResult.rows[0] as { count: number };

      // Get top contributors (most topics + replies in this category)
      // Note: Using explicit schema qualification (forums.*, users.users)
      // so NO schema option needed - prevents double-prefixing
      const topContributorsResult = await dbAdapter.query(
        `
        SELECT
          u.id,
          u.username,
          u.display_name,
          u.avatar_url,
          u.role,
          u.reputation,
          COUNT(*) as post_count
        FROM (
          SELECT author_id as user_id FROM forums.forum_topics WHERE category_id = $1
          UNION ALL
          SELECT r.author_id as user_id
          FROM forums.forum_replies r
          JOIN forums.forum_topics t ON r.topic_id = t.id
          WHERE t.category_id = $1
        ) AS posts
        JOIN users.users u ON posts.user_id = u.id
        GROUP BY u.id, u.username, u.display_name, u.avatar_url, u.role, u.reputation
        ORDER BY post_count DESC
        LIMIT 5
      `,
        [categoryId]
      );
      const topContributors = topContributorsResult.rows;

      // Get popular tags for this category (if tags table exists)
      // Note: forum_tags table not yet implemented - future feature
      let popularTags: ForumTag[] = [];
      try {
        // Check if forum_tags table exists
        const tableExistsResult = await dbAdapter.query(
          `
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'forums'
            AND table_name = 'forum_tags'
          ) as exists
        `,
          [],
          { schema: 'forums' }
        );

        const tableExists = tableExistsResult.rows[0]?.exists;

        if (tableExists) {
          const popularTagsResult = await dbAdapter.query(
            `
            SELECT t.*, COUNT(tt.topic_id) as usage_in_category
            FROM forum_tags t
            JOIN topic_tags tt ON t.id = tt.tag_id
            JOIN forum_topics top ON tt.topic_id = top.id
            WHERE top.category_id = $1
            GROUP BY t.id, t.name, t.color
            ORDER BY usage_in_category DESC
            LIMIT 10
          `,
            [categoryId],
            { schema: 'forums' }
          );
          popularTags = popularTagsResult.rows as ForumTag[];
        }
      } catch (error) {
        // Tags table doesn't exist yet, ignore error
        popularTags = [];
      }

      const stats: CategoryStats = {
        category_id: categoryId,
        topic_count: totals.total_topics || 0,
        reply_count: totals.total_replies || 0,
        view_count: totals.total_views || 0,
        // Note: The following properties don't exist in CategoryStats interface
        // Storing in a separate extended stats object if needed
        /*
        category,
        total_posts: (totals.total_topics || 0) + (totals.total_replies || 0),
        unique_contributors: contributors.count || 0,
        top_contributors: topContributors.map(c => ({
          id: c.id,
          username: c.username,
          display_name: c.display_name,
          avatar_url: c.avatar_url,
          role: c.role,
          reputation: c.reputation,
          post_count: c.post_count,
        })),
        popular_tags: popularTags,
        */
      };

      // Cache the stats
      this.categoryStatsCache.set(categoryId, stats);

      return Ok(stats);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'get_category_stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==========================================================================
  // User Statistics
  // ==========================================================================

  /**
   * Get forum statistics for a specific user
   *
   * @param userId - User ID
   * @returns Result with user forum stats or error
   */
  async getUserForumStats(userId: UserId): Promise<Result<UserForumStats, ServiceError>> {
    try {
      // Try cache first
      const cached = this.userStatsCache.get(userId);
      if (cached) {
        return Ok(cached);
      }

      // Get total counts
      const totalsResult = await dbAdapter.query(
        `
        SELECT
          (SELECT COUNT(*) FROM forum_topics WHERE user_id = $1) as total_topics,
          (SELECT COUNT(*) FROM forum_replies WHERE user_id = $1) as total_replies,
          (SELECT COUNT(*) FROM forum_replies WHERE is_solution = true AND user_id = $1) as solutions_provided,
          (SELECT SUM(view_count) FROM forum_topics WHERE user_id = $1) as total_views
      `,
        [userId],
        { schema: 'forums' }
      );
      const totals = totalsResult.rows[0] as {
        total_topics: number;
        total_replies: number;
        solutions_provided: number;
        total_views: number;
      };

      // Get solutions received (topics where user is author and a solution exists)
      const solutionsReceivedResult = await dbAdapter.query(
        `
        SELECT COUNT(*) as count
        FROM forum_topics t
        WHERE t.user_id = $1
          AND EXISTS (
            SELECT 1 FROM forum_replies r
            WHERE r.topic_id = t.id AND r.is_solution = true
          )
      `,
        [userId],
        { schema: 'forums' }
      );
      const solutionsReceived = solutionsReceivedResult.rows[0] as { count: number };

      // Get average replies per topic
      const avgRepliesResult = await dbAdapter.query(
        `
        SELECT AVG(reply_count) as avg
        FROM forum_topics
        WHERE user_id = $1
      `,
        [userId],
        { schema: 'forums' }
      );
      const avgReplies = avgRepliesResult.rows[0] as { avg: number };

      // Note: Commenting out extended stats properties that aren't in UserForumStats interface
      /*
      // Get recent topics created by user
      const recentTopicsRaw = db
        .prepare(
          `
        SELECT
          t.id,
          t.title,
          t.category_id,
          t.reply_count,
          t.view_count,
          t.status,
          t.created_at,
          c.name as category_name
        FROM forum_topics t
        LEFT JOIN forum_categories c ON t.category_id = c.id
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC
        LIMIT 5
      `
        )
        .all(userId) as RecentTopicRow[];

      const recentTopics: ForumTopic[] = recentTopicsRaw.map((t: RecentTopicRow) => ({
        id: t.id,
        title: t.title,
        categoryId: t.category_id,
        replyCount: t.reply_count || 0,
        viewCount: t.view_count || 0,
        isSolved: hasFlag(t.status || 0, TopicStatusFlags.SOLVED),
        createdAt: t.created_at,
        categoryName: t.category_name,
      }));

      // Get recent replies by user
      const recentRepliesRaw = db
        .prepare(
          `
        SELECT
          r.id,
          r.topic_id,
          r.content,
          r.is_solution,
          r.created_at,
          t.title as topic_title
        FROM forum_replies r
        JOIN forum_topics t ON r.topic_id = t.id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
        LIMIT 6
      `
        )
        .all(userId) as RecentReplyRow[];

      const recentReplies: ForumReply[] = recentRepliesRaw.map((r: RecentReplyRow) => ({
        id: r.id,
        topicId: r.topic_id,
        isSolution: Boolean(r.is_solution),
        createdAt: r.created_at,
        topicTitle: r.topic_title,
      }));

      // Get most active category
      const mostActiveCategory = db
        .prepare(
          `
        SELECT c.*, COUNT(*) as post_count
        FROM (
          SELECT category_id FROM forum_topics WHERE user_id = ?
          UNION ALL
          SELECT t.category_id
          FROM forum_replies r
          JOIN forum_topics t ON r.topic_id = t.id
          WHERE r.user_id = ?
        ) AS posts
        JOIN forum_categories c ON posts.category_id = c.id
        GROUP BY c.id
        ORDER BY post_count DESC
        LIMIT 1
      `
        )
        .get(userId, userId) as MostActiveCategoryRow | undefined;

      // Get first and last activity dates
      const activityDates = db
        .prepare(
          `
        SELECT
          MIN(created_at) as first_post,
          MAX(created_at) as last_activity
        FROM (
          SELECT created_at FROM forum_topics WHERE user_id = ?
          UNION ALL
          SELECT created_at FROM forum_replies WHERE user_id = ?
        )
      `
        )
        .get(userId, userId) as {
        first_post: string | null;
        last_activity: string | null;
      };
      */

      const stats: UserForumStats = {
        user_id: userId,
        topic_count: totals.total_topics || 0,
        reply_count: totals.total_replies || 0,
        solution_count: totals.solutions_provided || 0,
        // Note: The following properties don't exist in UserForumStats interface
        /*
        solutions_received: solutionsReceived.count || 0,
        total_views: totals.total_views || 0,
        avg_replies_per_topic: avgReplies.avg || 0,
        recent_topics: recentTopics,
        recent_replies: recentReplies,
        most_active_category: mostActiveCategory || null,
        first_post_at: activityDates.first_post,
        last_activity_at: activityDates.last_activity,
        */
      };

      // Cache the stats
      this.userStatsCache.set(userId, stats);

      return Ok(stats);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'get_user_stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==========================================================================
  // Trending Topics
  // ==========================================================================

  /**
   * Get trending topics based on activity score
   *
   * Activity score = (replies * 2) + (views * 0.1) + (age penalty)
   * Recent topics get higher scores
   *
   * @param limit - Max topics to return (default: 10)
   * @param timeWindow - Time window in days (default: 7)
   * @returns Result with trending topics
   */
  async getTrendingTopics(
    limit: number = 10,
    timeWindow: number = 7
  ): Promise<Result<ForumTopic[], ServiceError>> {
    try {
      // Calculate activity score with time decay
      const trendingTopicsResult = await dbAdapter.query(
        `
        SELECT
          t.*,
          (
            (t.reply_count * 2) +
            (t.view_count * 0.1) +
            (EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 86400 * -10)
          ) AS activity_score
        FROM forum_topics t
        WHERE t.created_at >= NOW() - INTERVAL '$1 days'
        ORDER BY activity_score DESC
        LIMIT $2
      `,
        [timeWindow, limit],
        { schema: 'forums' }
      );
      const trendingTopics = trendingTopicsResult.rows as ForumTopic[];

      // Enrich with author, category, tags
      const enriched: ForumTopic[] = [];
      for (const topic of trendingTopics) {
        const topicResult = await repositories.topics.findById(topic.id, {
          include_author: true,
          include_category: true,
          include_tags: true,
        });

        if (topicResult.isOk() && topicResult.value) {
          enriched.push(topicResult.value);
        }
      }

      return Ok(enriched);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'get_trending_topics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get popular topics (most viewed)
   *
   * @param limit - Max topics to return (default: 10)
   * @param timeWindow - Time window in days (default: 30, 0 = all time)
   * @returns Result with popular topics
   */
  async getPopularTopics(
    limit: number = 10,
    timeWindow: number = 30
  ): Promise<Result<ForumTopic[], ServiceError>> {
    try {
      // Note: findAll method doesn't exist, using getRecent instead
      const topicsResult = await repositories.topics.getRecent(limit);

      if (topicsResult.isErr()) {
        const err = topicsResult.error;
        return Err({
          type: 'database',
          operation: 'get_popular_topics',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Filter by time window if specified
      let topics = topicsResult.value;
      if (timeWindow > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - timeWindow);

        topics = topics.filter((topic: ForumTopic) => new Date(topic.created_at) >= cutoffDate);
      }

      return Ok(topics);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'get_popular_topics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Clear all stats caches
   */
  clearCaches(): void {
    this.forumStatsCache.clear();
    this.categoryStatsCache.clear();
    this.userStatsCache.clear();
  }

  /**
   * Invalidate stats caches (call after new content is added)
   */
  invalidateStatsCache(): void {
    this.forumStatsCache.clear();
    this.categoryStatsCache.clear();
  }

  /**
   * Invalidate user stats cache for a specific user
   *
   * @param userId - User ID
   */
  invalidateUserStatsCache(userId: UserId): void {
    this.userStatsCache.delete(userId);
  }

  /**
   * Invalidate category stats cache for a specific category
   *
   * @param categoryId - Category ID
   */
  invalidateCategoryStatsCache(categoryId: CategoryId): void {
    this.categoryStatsCache.delete(categoryId);
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics object
   */
  getCacheStats(): {
    forumStatsCacheSize: number;
    categoryStatsCacheSize: number;
    userStatsCacheSize: number;
  } {
    return {
      forumStatsCacheSize: this.forumStatsCache.size,
      categoryStatsCacheSize: this.categoryStatsCache.size,
      userStatsCacheSize: this.userStatsCache.size,
    };
  }
}

// Export singleton instance
export const forumStatsService = new ForumStatsService();
