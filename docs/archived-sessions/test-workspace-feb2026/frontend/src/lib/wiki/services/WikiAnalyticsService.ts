/**
 * WikiAnalyticsService - Specialized service for wiki analytics and activity tracking
 * Phase 3: God object refactoring - extracted from WikiService
 */

import { dbAdapter } from '@/lib/database/adapter';
import { cache } from '@/lib/cache';
import { UnifiedActivity } from '../types';
import { logger } from '@/lib/utils/logger';

export class WikiAnalyticsService {
  // No database connection needed - using dbAdapter

  /**
   * Log user activity in the wiki
   */
  async logActivity(
    userId: number,
    activityType: string,
    entityType: string,
    entityId: string,
    action: string,
    metadata?: any
  ): Promise<void> {
    try {
      // Skip logging if userId is invalid
      if (!userId || userId <= 0) {
        logger.warn('Invalid userId, skipping activity logging', { userId: userId.toString() });
        return;
      }

      // Check if user exists before logging activity
      const userExistsResult = await dbAdapter.query(
        'SELECT id FROM users.users WHERE id = $1',
        [userId],
        { schema: 'wiki' }
      );
      if (userExistsResult.rows.length === 0) {
        logger.warn('User does not exist, skipping activity logging', {
          userId: userId.toString(),
        });
        return;
      }

      await dbAdapter.query(
        `
        INSERT INTO unified_activity (user_id, activity_type, entity_type, entity_id, action, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          userId,
          activityType,
          entityType,
          entityId,
          action,
          metadata ? JSON.stringify(metadata) : null,
        ],
        { schema: 'wiki' }
      );

      // Auto-cleanup: Keep only the 6 most recent wiki activities
      await this.cleanupOldActivities(6);
    } catch (error) {
      logger.error('Failed to log activity', { error });
      // Don't throw - we don't want activity logging to break page operations
    }
  }

  /**
   * Clean up old activities, keeping only the N most recent
   * @param keepCount Number of most recent activities to keep (default: 6)
   */
  private async cleanupOldActivities(keepCount: number = 6): Promise<void> {
    try {
      // Delete all wiki activities except the N most recent
      const result = await dbAdapter.query(
        `
        DELETE FROM unified_activity
        WHERE activity_type = 'wiki_edit'
        AND id NOT IN (
          SELECT id FROM unified_activity
          WHERE activity_type = 'wiki_edit'
          ORDER BY timestamp DESC
          LIMIT $1
        )
      `,
        [keepCount],
        { schema: 'wiki' }
      );

      if (result.rowCount && result.rowCount > 0) {
        logger.info('Removed old activity entries', { count: result.rowCount });
      }
    } catch (error) {
      logger.error('Failed to clean up old activities', { error });
      // Don't throw - cleanup failures shouldn't break the main operation
    }
  }

  /**
   * Get recent wiki activity with enhanced metadata
   */
  async getRecentActivity(limit: number = 10): Promise<any[]> {
    const cacheKey = `wiki_activity:recent:${limit}`;
    const cached = await cache.get<any[]>({
      category: 'content',
      identifier: cacheKey,
      version: 'v1',
    });
    if (cached) {
      return cached;
    }

    try {
      // Note: Using explicit schema qualification (wiki.*, users.users)
      // so NO schema option needed - prevents double-prefixing
      const result = await dbAdapter.query(
        `
        SELECT
          ua.*,
          u.username,
          u.display_name,
          wp.title as page_title,
          wp.slug as page_slug,
          wp.namespace as page_namespace,
          c.name as category_name,
          c.id as category_id
        FROM wiki.unified_activity ua
        LEFT JOIN users.users u ON ua.user_id = u.id
        LEFT JOIN wiki.wiki_pages wp ON ua.entity_id = CAST(wp.id AS TEXT)
        LEFT JOIN wiki.wiki_categories c ON wp.category_id = c.id
        WHERE ua.activity_type = 'wiki_edit'
          AND (ua.entity_type IN ('page', 'wiki', 'wiki_page') OR ua.entity_type IS NULL)
          AND (c.id IS NULL OR c.is_public = true)
        ORDER BY ua.timestamp DESC
        LIMIT $1
      `,
        [limit]
      );

      const formattedResults = result.rows.map(row => {
        const metadata = row.metadata ? JSON.parse(row.metadata) : {};

        // Fallback to metadata when LEFT JOINs return NULL (deleted pages/categories)
        const pageTitle = row.page_title || metadata.page_title || metadata.title || null;
        const pageSlug = row.page_slug || metadata.page_slug || metadata.slug || null;
        const categoryName =
          row.category_name ||
          metadata.category_name ||
          metadata.from_category ||
          metadata.to_category ||
          null;

        return {
          ...row,
          page_title: pageTitle,
          page_slug: pageSlug,
          categories: categoryName ? [categoryName] : metadata.categories || [],
          category_ids: row.category_id ? [row.category_id] : [],
          parsed_metadata: metadata,
        };
      });

      // Cache for 2 minutes
      await cache.set({ category: 'content', identifier: cacheKey }, formattedResults);

      return formattedResults;
    } catch (error) {
      logger.error('Error getting recent activity', { error });
      return [];
    }
  }

  /**
   * Get user's wiki activity history
   */
  async getUserActivity(
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      action?: string;
      days?: number;
    } = {}
  ): Promise<any[]> {
    const { limit = 20, offset = 0, action, days } = options;

    let query = `
      SELECT
        ua.*,
        wp.title as page_title,
        wp.slug as page_slug,
        wp.namespace as page_namespace,
        c.name as category_name
      FROM unified_activity ua
      LEFT JOIN wiki_pages wp ON ua.entity_id = CAST(wp.id AS TEXT) AND ua.entity_type = 'page'
      LEFT JOIN wiki_categories c ON wp.category_id = c.id
      WHERE ua.user_id = $1 AND ua.activity_type = 'wiki_edit'
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (action) {
      query += ` AND ua.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (days) {
      query += ` AND ua.timestamp > NOW() - INTERVAL '${days} days'`;
    }

    query += ` ORDER BY ua.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await dbAdapter.query(query, params, { schema: 'wiki' });

    return result.rows.map(row => {
      const metadata = row.metadata ? JSON.parse(row.metadata) : {};

      // Fallback to metadata when LEFT JOINs return NULL (deleted pages/categories)
      const pageTitle = row.page_title || metadata.page_title || metadata.title || null;
      const pageSlug = row.page_slug || metadata.page_slug || metadata.slug || null;
      const categoryName =
        row.category_name ||
        metadata.category_name ||
        metadata.from_category ||
        metadata.to_category ||
        null;

      return {
        ...row,
        page_title: pageTitle,
        page_slug: pageSlug,
        category_name: categoryName,
        parsed_metadata: metadata,
      };
    });
  }

  /**
   * Get comprehensive wiki statistics
   */
  async getWikiStats(): Promise<{
    total_pages: number;
    total_views: number;
    active_editors_month: number;
    recent_edits_week: number;
    total_categories: number;
    total_tags: number;
    average_page_size: number;
    most_active_category: string | null;
  }> {
    const cacheKey = 'wiki_stats:comprehensive';
    const cached = await cache.get<any>({
      category: 'content',
      identifier: cacheKey,
      version: 'v2', // Updated: exclude journals and private category pages
    });
    if (cached) {
      return cached;
    }

    try {
      // Get basic page stats (exclude journals and private category pages)
      const totalPagesResult = await dbAdapter.query(
        `SELECT COUNT(*) as total
         FROM wiki_pages p
         LEFT JOIN wiki_categories c ON p.category_id = c.id
         WHERE p.status = 'published'
           AND p.namespace != 'journals'
           AND (c.is_public = true OR c.is_public IS NULL)`,
        [],
        { schema: 'wiki' }
      );

      const totalViewsResult = await dbAdapter.query(
        `SELECT COALESCE(SUM(view_count), 0) as total FROM wiki_page_views`,
        [],
        { schema: 'wiki' }
      );

      const activeEditorsResult = await dbAdapter.query(
        `
        SELECT COUNT(DISTINCT user_id) as total
        FROM unified_activity
        WHERE activity_type = 'wiki_edit'
        AND timestamp > NOW() - INTERVAL '30 days'
      `,
        [],
        { schema: 'wiki' }
      );

      const recentEditsResult = await dbAdapter.query(
        `
        SELECT COUNT(*) as total
        FROM unified_activity
        WHERE activity_type = 'wiki_edit'
        AND timestamp > NOW() - INTERVAL '7 days'
      `,
        [],
        { schema: 'wiki' }
      );

      const totalCategoriesResult = await dbAdapter.query(
        `SELECT COUNT(*) as total FROM wiki_categories`,
        [],
        { schema: 'wiki' }
      );

      const totalTagsResult = await dbAdapter.query(
        `SELECT COUNT(*) as total FROM wiki_tags WHERE usage_count > 0`,
        [],
        { schema: 'wiki' }
      );

      const avgPageSizeResult = await dbAdapter.query(
        `
        SELECT AVG(r.size_bytes) as avg_size
        FROM wiki_revisions r
        INNER JOIN (
          SELECT page_id, MAX(id) as latest_revision_id
          FROM wiki_revisions
          GROUP BY page_id
        ) latest ON r.id = latest.latest_revision_id
        INNER JOIN wiki_pages p ON r.page_id = p.id
        LEFT JOIN wiki_categories c ON p.category_id = c.id
        WHERE p.status = 'published'
          AND p.namespace != 'journals'
          AND (c.is_public = true OR c.is_public IS NULL)
      `,
        [],
        { schema: 'wiki' }
      );

      const mostActiveCategoryResult = await dbAdapter.query(
        `
        SELECT c.name, COUNT(ua.id) as activity_count
        FROM unified_activity ua
        INNER JOIN wiki_pages wp ON ua.entity_id = CAST(wp.id AS TEXT)
        INNER JOIN wiki_categories c ON wp.category_id = c.id
        WHERE ua.activity_type = 'wiki_edit'
        AND ua.timestamp > NOW() - INTERVAL '30 days'
        GROUP BY c.id, c.name
        ORDER BY activity_count DESC
        LIMIT 1
      `,
        [],
        { schema: 'wiki' }
      );

      const totalPages = totalPagesResult.rows[0]?.total || 0;
      const totalViews = totalViewsResult.rows[0]?.total || 0;
      const activeEditors = activeEditorsResult.rows[0]?.total || 0;
      const recentEdits = recentEditsResult.rows[0]?.total || 0;
      const totalCategories = totalCategoriesResult.rows[0]?.total || 0;
      const totalTags = totalTagsResult.rows[0]?.total || 0;
      const avgSize = avgPageSizeResult.rows[0]?.avg_size || 0;
      const mostActiveCategory = mostActiveCategoryResult.rows[0]?.name || null;

      const stats = {
        total_pages: totalPages,
        total_views: totalViews,
        active_editors_month: activeEditors,
        recent_edits_week: recentEdits,
        total_categories: totalCategories,
        total_tags: totalTags,
        average_page_size: Math.round(avgSize),
        most_active_category: mostActiveCategory,
      };

      // Cache for 10 minutes
      await cache.set({ category: 'content', identifier: cacheKey }, stats);

      return stats;
    } catch (error) {
      logger.error('Error getting wiki stats', { error });
      return {
        total_pages: 0,
        total_views: 0,
        active_editors_month: 0,
        recent_edits_week: 0,
        total_categories: 0,
        total_tags: 0,
        average_page_size: 0,
        most_active_category: null,
      };
    }
  }

  /**
   * Get editing activity trends over time
   */
  async getActivityTrends(days: number = 30): Promise<{
    daily_edits: Array<{ date: string; count: number }>;
    top_editors: Array<{ username: string; edit_count: number }>;
    category_activity: Array<{ category: string; edit_count: number }>;
  }> {
    const cacheKey = `wiki_trends:${days}`;
    const cached = await cache.get<any>({
      category: 'content',
      identifier: cacheKey,
      version: 'v1',
    });
    if (cached) {
      return cached;
    }

    try {
      // Daily edit counts
      const dailyEditsResult = await dbAdapter.query(
        `
        SELECT
          DATE(timestamp) as date,
          COUNT(*) as count
        FROM unified_activity
        WHERE activity_type = 'wiki_edit'
        AND timestamp > NOW() - INTERVAL '${days} days'
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `,
        [],
        { schema: 'wiki' }
      );

      // Top editors
      // Note: Using explicit schema qualification (wiki.unified_activity, users.users)
      // so NO schema option needed - prevents double-prefixing
      const topEditorsResult = await dbAdapter.query(
        `
        SELECT
          u.username,
          COUNT(ua.id) as edit_count
        FROM wiki.unified_activity ua
        INNER JOIN users.users u ON ua.user_id = u.id
        WHERE ua.activity_type = 'wiki_edit'
        AND ua.timestamp > NOW() - INTERVAL '${days} days'
        GROUP BY ua.user_id, u.username
        ORDER BY edit_count DESC
        LIMIT 10
      `,
        []
      );

      // Category activity
      const categoryActivityResult = await dbAdapter.query(
        `
        SELECT
          c.name as category,
          COUNT(ua.id) as edit_count
        FROM unified_activity ua
        INNER JOIN wiki_pages wp ON ua.entity_id = CAST(wp.id AS TEXT)
        INNER JOIN wiki_categories c ON wp.category_id = c.id
        WHERE ua.activity_type = 'wiki_edit'
        AND ua.timestamp > NOW() - INTERVAL '${days} days'
        GROUP BY c.id, c.name
        ORDER BY edit_count DESC
        LIMIT 10
      `,
        [],
        { schema: 'wiki' }
      );

      const trends = {
        daily_edits: dailyEditsResult.rows,
        top_editors: topEditorsResult.rows,
        category_activity: categoryActivityResult.rows,
      };

      // Cache for 30 minutes
      await cache.set({ category: 'content', identifier: cacheKey }, trends);

      return trends;
    } catch (error) {
      logger.error('Error getting activity trends', { error });
      return {
        daily_edits: [],
        top_editors: [],
        category_activity: [],
      };
    }
  }

  /**
   * Get page view analytics
   */
  async getPageViewAnalytics(
    pageId?: number,
    days: number = 30
  ): Promise<{
    total_views: number;
    daily_views: Array<{ date: string; views: number }>;
    average_daily_views: number;
    peak_day: { date: string; views: number } | null;
  }> {
    const cacheKey = `wiki_page_views:${pageId || 'all'}:${days}`;
    const cached = await cache.get<any>({
      category: 'content',
      identifier: cacheKey,
      version: 'v1',
    });
    if (cached) {
      return cached;
    }

    try {
      let whereClause = `WHERE view_date > CURRENT_DATE - INTERVAL '${days} days'`;
      const params: any[] = [];

      if (pageId) {
        whereClause += ` AND page_id = $1`;
        params.push(pageId);
      }

      // Daily view counts
      const result = await dbAdapter.query(
        `
        SELECT
          view_date as date,
          SUM(view_count) as views
        FROM wiki_page_views
        ${whereClause}
        GROUP BY view_date
        ORDER BY view_date DESC
      `,
        params,
        { schema: 'wiki' }
      );

      const dailyViews = result.rows as Array<{ date: string; views: number }>;

      // Calculate totals and averages
      const totalViews = dailyViews.reduce((sum, day) => sum + day.views, 0);
      const averageDailyViews =
        dailyViews.length > 0 ? Math.round(totalViews / dailyViews.length) : 0;
      const peakDay =
        dailyViews.length > 0
          ? dailyViews.reduce((peak, day) => (day.views > peak.views ? day : peak))
          : null;

      const analytics = {
        total_views: totalViews,
        daily_views: dailyViews,
        average_daily_views: averageDailyViews,
        peak_day: peakDay,
      };

      // Cache for 1 hour
      await cache.set({ category: 'content', identifier: cacheKey }, analytics);

      return analytics;
    } catch (error) {
      logger.error('Error getting page view analytics', { error });
      return {
        total_views: 0,
        daily_views: [],
        average_daily_views: 0,
        peak_day: null,
      };
    }
  }

  /**
   * Get user contribution statistics
   */
  async getUserContributionStats(userId: number): Promise<{
    total_edits: number;
    pages_created: number;
    pages_edited: number;
    total_content_added: number;
    first_edit_date: string | null;
    last_edit_date: string | null;
    favorite_categories: Array<{ category: string; edit_count: number }>;
    edit_streak_days: number;
  }> {
    const cacheKey = `wiki_user_stats:${userId}`;
    const cached = await cache.get<any>({
      category: 'content',
      identifier: cacheKey,
      version: 'v1',
    });
    if (cached) {
      return cached;
    }

    try {
      // Total edits
      const totalEditsResult = await dbAdapter.query(
        `
        SELECT COUNT(*) as count
        FROM unified_activity
        WHERE user_id = $1 AND activity_type = 'wiki_edit'
      `,
        [userId],
        { schema: 'wiki' }
      );

      // Pages created
      const pagesCreatedResult = await dbAdapter.query(
        `
        SELECT COUNT(*) as count
        FROM unified_activity
        WHERE user_id = $1 AND activity_type = 'wiki_edit' AND action = 'create'
      `,
        [userId],
        { schema: 'wiki' }
      );

      // Unique pages edited
      const pagesEditedResult = await dbAdapter.query(
        `
        SELECT COUNT(DISTINCT entity_id) as count
        FROM unified_activity
        WHERE user_id = $1 AND activity_type = 'wiki_edit'
      `,
        [userId],
        { schema: 'wiki' }
      );

      // Total content added (sum of revision sizes created by user)
      const contentAddedResult = await dbAdapter.query(
        `
        SELECT COALESCE(SUM(size_bytes), 0) as total
        FROM wiki_revisions
        WHERE author_id = $1
      `,
        [userId],
        { schema: 'wiki' }
      );

      // First and last edit dates
      const editDatesResult = await dbAdapter.query(
        `
        SELECT
          MIN(timestamp) as first_edit,
          MAX(timestamp) as last_edit
        FROM unified_activity
        WHERE user_id = $1 AND activity_type = 'wiki_edit'
      `,
        [userId],
        { schema: 'wiki' }
      );

      // Favorite categories
      const favoriteCategoriesResult = await dbAdapter.query(
        `
        SELECT
          c.name as category,
          COUNT(ua.id) as edit_count
        FROM unified_activity ua
        INNER JOIN wiki_pages wp ON ua.entity_id = CAST(wp.id AS TEXT)
        INNER JOIN wiki_categories c ON wp.category_id = c.id
        WHERE ua.user_id = $1 AND ua.activity_type = 'wiki_edit'
        GROUP BY c.id, c.name
        ORDER BY edit_count DESC
        LIMIT 5
      `,
        [userId],
        { schema: 'wiki' }
      );

      // Edit streak (consecutive days with edits)
      const editStreakResult = await dbAdapter.query(
        `
        WITH daily_edits AS (
          SELECT DISTINCT DATE(timestamp) as edit_date
          FROM unified_activity
          WHERE user_id = $1 AND activity_type = 'wiki_edit'
          ORDER BY edit_date DESC
        ),
        consecutive_days AS (
          SELECT
            edit_date,
            ROW_NUMBER() OVER (ORDER BY edit_date DESC) as row_num,
            edit_date + (ROW_NUMBER() OVER (ORDER BY edit_date DESC) - 1) * INTERVAL '1 day' as expected_date
          FROM daily_edits
        )
        SELECT COUNT(*) as streak
        FROM consecutive_days
        WHERE edit_date = expected_date
        AND edit_date >= CURRENT_DATE - INTERVAL '30 days'
      `,
        [userId],
        { schema: 'wiki' }
      );

      const totalEdits = totalEditsResult.rows[0]?.count || 0;
      const pagesCreated = pagesCreatedResult.rows[0]?.count || 0;
      const pagesEdited = pagesEditedResult.rows[0]?.count || 0;
      const contentAdded = contentAddedResult.rows[0]?.total || 0;
      const editDates = editDatesResult.rows[0];
      const favoriteCategories = favoriteCategoriesResult.rows;
      const editStreak = editStreakResult.rows[0]?.streak || 0;

      const stats = {
        total_edits: totalEdits,
        pages_created: pagesCreated,
        pages_edited: pagesEdited,
        total_content_added: contentAdded,
        first_edit_date: editDates?.first_edit || null,
        last_edit_date: editDates?.last_edit || null,
        favorite_categories: favoriteCategories,
        edit_streak_days: editStreak,
      };

      // Cache for 15 minutes
      await cache.set({ category: 'content', identifier: cacheKey }, stats);

      return stats;
    } catch (error) {
      logger.error('Error getting user contribution stats', { error });
      return {
        total_edits: 0,
        pages_created: 0,
        pages_edited: 0,
        total_content_added: 0,
        first_edit_date: null,
        last_edit_date: null,
        favorite_categories: [],
        edit_streak_days: 0,
      };
    }
  }

  /**
   * Get system performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    average_page_load_time: number;
    cache_hit_rate: number;
    database_query_time: number;
    active_sessions: number;
  }> {
    // This would integrate with actual performance monitoring
    // For now, return placeholder values
    return {
      average_page_load_time: 0,
      cache_hit_rate: 0,
      database_query_time: 0,
      active_sessions: 0,
    };
  }

  /**
   * Generate a comprehensive analytics report
   */
  async generateAnalyticsReport(timeframe: 'week' | 'month' | 'quarter' = 'month'): Promise<{
    period: string;
    summary: any;
    trends: any;
    top_performers: {
      pages: Array<{ title: string; views: number; edits: number }>;
      editors: Array<{ username: string; contributions: number }>;
      categories: Array<{ name: string; activity: number }>;
    };
    insights: string[];
  }> {
    const days = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90;
    const cacheKey = `wiki_analytics_report:${timeframe}`;
    const cached = await cache.get<any>({
      category: 'content',
      identifier: cacheKey,
      version: 'v1',
    });
    if (cached) {
      return cached;
    }

    try {
      const [summary, trends, viewAnalytics] = await Promise.all([
        this.getWikiStats(),
        this.getActivityTrends(days),
        this.getPageViewAnalytics(undefined, days),
      ]);

      // Get top performing pages
      const topPagesResult = await dbAdapter.query(
        `
        SELECT
          p.title,
          COALESCE(SUM(pv.view_count), 0) as views,
          (
            SELECT COUNT(*)
            FROM unified_activity ua
            WHERE ua.entity_id = CAST(p.id AS TEXT)
            AND ua.activity_type = 'wiki_edit'
            AND ua.timestamp > NOW() - INTERVAL '${days} days'
          ) as edits
        FROM wiki_pages p
        LEFT JOIN wiki_page_views pv ON p.id = pv.page_id
          AND pv.view_date > CURRENT_DATE - INTERVAL '${days} days'
        WHERE p.status = 'published'
        GROUP BY p.id, p.title
        ORDER BY views DESC, edits DESC
        LIMIT 10
      `,
        [],
        { schema: 'wiki' }
      );

      const topPages = topPagesResult.rows;

      // Generate insights
      const insights: string[] = [];
      if (trends.daily_edits.length > 0) {
        const recentActivity = trends.daily_edits.slice(0, 7);
        const avgRecentEdits =
          recentActivity.reduce((sum, day) => sum + day.count, 0) / recentActivity.length;
        if (avgRecentEdits > 5) {
          insights.push('High editing activity detected in recent days');
        }
      }

      if (summary.active_editors_month > 10) {
        insights.push('Strong community engagement with 10+ active editors');
      }

      if (
        viewAnalytics.peak_day &&
        viewAnalytics.peak_day.views > viewAnalytics.average_daily_views * 2
      ) {
        insights.push(
          `Peak engagement on ${viewAnalytics.peak_day.date} with ${viewAnalytics.peak_day.views} views`
        );
      }

      const report = {
        period: `${timeframe} (${days} days)`,
        summary,
        trends,
        top_performers: {
          pages: topPages,
          editors: trends.top_editors.slice(0, 5).map((e: any) => ({
            username: e.username,
            contributions: e.edit_count,
          })),
          categories: trends.category_activity.slice(0, 5).map((c: any) => ({
            name: c.category,
            activity: c.edit_count,
          })),
        },
        insights,
      };

      // Cache for 6 hours
      await cache.set({ category: 'content', identifier: cacheKey }, report);

      return report;
    } catch (error) {
      logger.error('Error generating analytics report', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const wikiAnalyticsService = new WikiAnalyticsService();
