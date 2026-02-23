import { WikiService } from '@/lib/wiki/service';
import {
  WikiServiceDependency,
  WikiUserStats,
  WikiEditSummary,
  WikiPageSummary,
  UserId,
  WikiPageId,
  WikiRevisionId,
  ServiceError,
  ServiceType,
} from '@/types/profile-aggregation';
import { Result } from '@/types/error-handling';
import { logger } from '@/lib/utils/logger';

/**
 * WikiServiceAdapter - Adapter that wraps existing WikiService
 *
 * This adapter implements the WikiServiceDependency interface by wrapping
 * the existing WikiService and converting its data formats to match the
 * ProfileAggregatorService contracts.
 */
export class WikiServiceAdapter implements WikiServiceDependency {
  readonly serviceName: ServiceType = 'wiki';
  private wikiService: WikiService;

  constructor() {
    this.wikiService = new WikiService();
  }

  /**
   * Health check implementation
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Test basic wiki service functionality
      const categories = await this.wikiService.getAllCategories();
      return Array.isArray(categories);
    } catch (error) {
      logger.error('WikiServiceAdapter health check failed:', error);
      return false;
    }
  }

  /**
   * Get last update time for user's wiki data
   */
  async getLastUpdateTime(userId: UserId): Promise<string | null> {
    try {
      const userIdNum = Number(userId);

      // Get user's most recent wiki activity from stats
      const stats = await this.wikiService.getWikiStats();

      // For now, return current timestamp as wiki service doesn't track per-user updates
      // In a real implementation, this would query wiki_revisions for the user's latest edit
      return new Date().toISOString();
    } catch (error) {
      logger.error('Error getting wiki last update time:', error);
      return null;
    }
  }

  /**
   * Get user stats (delegates to getUserWikiStats)
   */
  async getUserStats(userId: UserId): Promise<Result<WikiUserStats, ServiceError>> {
    return this.getUserWikiStats(userId);
  }

  /**
   * Get comprehensive wiki statistics for a user
   */
  async getUserWikiStats(userId: UserId): Promise<Result<WikiUserStats, ServiceError>> {
    try {
      const userIdNum = Number(userId);

      // Call the actual WikiService.getUserWikiStats() method
      // which uses WikiAnalyticsService under the hood
      const stats = await this.wikiService.getUserWikiStats(userIdNum);

      // WikiService already returns the data in WikiUserStats format
      // Just need to wrap it in a Result
      return Result.ok(stats);
    } catch (error) {
      logger.error('Error getting wiki user stats:', error);
      return Result.error({
        type: 'database_connection',
        service: 'wiki',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
      });
    }
  }

  /**
   * Get recent edits/revisions by user
   */
  async getRecentEdits(
    userId: UserId,
    limit = 10
  ): Promise<Result<readonly WikiEditSummary[], ServiceError>> {
    try {
      const userIdNum = Number(userId);

      // Get recent activity from wiki service
      const recentActivity = await this.wikiService.getRecentActivity(50); // Get more to filter

      // Filter for user's edits and convert to WikiEditSummary format
      const userEdits = recentActivity
        .filter(
          (activity: any) =>
            activity.author_id === userIdNum &&
            (activity.action === 'edit' || activity.action === 'create')
        )
        .slice(0, limit)
        .map((activity: any) => ({
          id: (activity.revision_id || activity.id) as WikiRevisionId,
          pageId: activity.page_id as WikiPageId,
          pageTitle: activity.page_title || 'Unknown Page',
          pageSlug: activity.page_slug || '',
          summary: activity.summary || activity.action,
          revisionTimestamp: activity.timestamp || activity.created_at,
          changeSize: this.calculateChangeSize(activity),
        })) as WikiEditSummary[];

      return Result.ok(userEdits);
    } catch (error) {
      logger.error('Error getting recent wiki edits:', error);
      return Result.error({
        type: 'database_connection',
        service: 'wiki',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
      });
    }
  }

  /**
   * Get pages created by user
   */
  async getCreatedPages(
    userId: UserId,
    limit = 10
  ): Promise<Result<readonly WikiPageSummary[], ServiceError>> {
    try {
      const userIdNum = Number(userId);

      // Get all pages and filter by author
      const allPages = await this.wikiService.getAllPages(undefined, limit * 3); // Get more to filter

      // Filter for pages created by this user
      const userPages = allPages
        .filter((page: any) => page.author_id === userIdNum)
        .slice(0, limit)
        .map((page: any) => ({
          id: page.id as WikiPageId,
          title: page.title,
          slug: page.slug,
          viewCount: page.view_count || 0,
          revisionCount: page.revision_count || 1,
          createdAt: page.created_at,
          lastEditAt: page.updated_at || page.created_at,
        })) as WikiPageSummary[];

      return Result.ok(userPages);
    } catch (error) {
      logger.error('Error getting created wiki pages:', error);
      return Result.error({
        type: 'database_connection',
        service: 'wiki',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
      });
    }
  }

  /**
   * Calculate change size from activity data
   */
  private calculateChangeSize(activity: any): number {
    // Simplified calculation - in real implementation this would be tracked in revisions
    if (activity.action === 'create') {
      return activity.content_length || 500; // Estimate for new pages
    } else if (activity.action === 'edit') {
      return activity.content_change || 100; // Estimate for edits
    }
    return 0;
  }
}
