import { forumStatsService } from '@/lib/forums/services/ForumStatsService';
import {
  ForumServiceDependency,
  ForumUserStats,
  ForumTopicSummary,
  ForumReplySummary,
  UserId as ProfileUserId,
  ServiceError,
  ServiceType,
  DatabaseConnectionError,
} from '@/types/profile-aggregation';
import { Result } from '@/types/error-handling';
import type { UserId } from '@/lib/forums/types';
import { logger } from '@/lib/utils/logger';

/**
 * ForumServiceAdapter - Adapter that wraps ForumStatsService
 *
 * This adapter implements the ForumServiceDependency interface by wrapping
 * the existing ForumStatsService and converting its data formats to match the
 * ProfileAggregatorService contracts.
 */
export class ForumServiceAdapter implements ForumServiceDependency {
  readonly serviceName: ServiceType = 'forum';

  /**
   * Health check implementation
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Test basic forum service functionality by getting stats for user 1
      const result = await forumStatsService.getUserForumStats(1 as UserId);
      return result.isOk();
    } catch (error) {
      logger.error('ForumServiceAdapter health check failed:', error);
      return false;
    }
  }

  /**
   * Get last update time for user's forum data
   */
  async getLastUpdateTime(userId: ProfileUserId): Promise<string | null> {
    try {
      // Get user's most recent forum activity
      const stats = await this.getUserForumStats(userId);

      if (stats.isOk() && stats.value.lastForumActivity) {
        return stats.value.lastForumActivity;
      }

      return null;
    } catch (error) {
      logger.error('Error getting forum last update time:', error);
      return null;
    }
  }

  /**
   * Get user stats (delegates to getUserForumStats)
   */
  async getUserStats(userId: ProfileUserId): Promise<Result<ForumUserStats, ServiceError>> {
    return this.getUserForumStats(userId);
  }

  /**
   * Get comprehensive forum statistics for a user
   */
  async getUserForumStats(userId: ProfileUserId): Promise<Result<ForumUserStats, ServiceError>> {
    try {
      // Call the actual ForumStatsService.getUserForumStats() method
      // ForumStatsService uses forums.db UserId type, which is compatible with ProfileUserId
      const result = await forumStatsService.getUserForumStats(userId as unknown as UserId);

      // Convert from lib/utils/result.Result to error-handling Result
      if (result.isOk()) {
        // Transform forums UserForumStats to profile-aggregation ForumUserStats
        const stats = result.value;
        const profileStats: ForumUserStats = {
          userId: userId,
          totalTopics: stats.topic_count,
          totalReplies: stats.reply_count,
          totalVotesReceived: 0, // Not available from forum service
          solutionsProvided: stats.solution_count,
          recentTopics: [], // Placeholder - would need separate method
          recentReplies: [], // Placeholder - would need separate method
          averageReplyTime: undefined,
          mostActiveCategory: undefined,
          lastForumActivity: undefined,
        };
        return Result.ok(profileStats);
      } else {
        // Extract message from forum service error
        const errorMessage =
          result.error instanceof Error
            ? result.error.message
            : typeof result.error === 'string'
              ? result.error
              : 'Unknown forum service error';
        const dbError: DatabaseConnectionError = {
          type: 'database_connection',
          service: 'forum',
          message: errorMessage,
          retryable: true,
        };
        return Result.error(dbError);
      }
    } catch (error) {
      logger.error('Error getting forum user stats:', error);
      const dbError: DatabaseConnectionError = {
        type: 'database_connection',
        service: 'forum',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
      };
      return Result.error(dbError);
    }
  }

  /**
   * Get recent topics by user
   */
  async getRecentTopics(
    userId: ProfileUserId,
    limit = 10
  ): Promise<Result<readonly ForumTopicSummary[], ServiceError>> {
    try {
      // Get full stats which includes recent topics
      const statsResult = await this.getUserForumStats(userId);

      if (!statsResult.isOk()) {
        return Result.error(statsResult.error);
      }

      const topics = statsResult.value.recentTopics.slice(0, limit);
      return Result.ok(topics);
    } catch (error) {
      logger.error('Error getting recent forum topics:', error);
      const dbError: DatabaseConnectionError = {
        type: 'database_connection',
        service: 'forum',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
      };
      return Result.error(dbError);
    }
  }

  /**
   * Get recent replies by user
   */
  async getRecentReplies(
    userId: ProfileUserId,
    limit = 10
  ): Promise<Result<readonly ForumReplySummary[], ServiceError>> {
    try {
      // Get full stats which includes recent replies
      const statsResult = await this.getUserForumStats(userId);

      if (!statsResult.isOk()) {
        return Result.error(statsResult.error);
      }

      const replies = statsResult.value.recentReplies.slice(0, limit);
      return Result.ok(replies);
    } catch (error) {
      logger.error('Error getting recent forum replies:', error);
      const dbError: DatabaseConnectionError = {
        type: 'database_connection',
        service: 'forum',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
      };
      return Result.error(dbError);
    }
  }
}
