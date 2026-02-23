/**
 * Forum Services Index
 *
 * Central export point for all forum service classes and instances.
 * Provides a clean API for importing services throughout the application.
 *
 * Usage:
 * ```typescript
 * import { forumService, forumModerationService } from '@/lib/forums/services';
 *
 * // Use singleton instances
 * const topicResult = await forumService.createTopic(data, userId);
 * const pinResult = await forumModerationService.pinTopic(topicId, moderatorId);
 *
 * // Or create custom instances if needed
 * import { ForumService } from '@/lib/forums/services';
 * const customService = new ForumService();
 * ```
 *
 * Architecture:
 * - All services use Result pattern for error handling
 * - Singleton instances exported for convenience
 * - Services use repository layer for data access
 * - Activity logging for audit trail
 * - Comprehensive caching for performance
 *
 * @module lib/forums/services
 */

// Export service classes
export { ForumService, forumService } from './ForumService';
export { ForumModerationService, forumModerationService } from './ForumModerationService';
export { ForumSearchService, forumSearchService } from './ForumSearchService';
export { ForumStatsService, forumStatsService } from './ForumStatsService';
export { ForumCategoryService, forumCategoryService } from './ForumCategoryService';
export { ForumSectionService, forumSectionService } from './ForumSectionService';

// Import all services for convenience object
import { ForumService, forumService } from './ForumService';
import { ForumModerationService, forumModerationService } from './ForumModerationService';
import { ForumSearchService, forumSearchService } from './ForumSearchService';
import { ForumStatsService, forumStatsService } from './ForumStatsService';
import { ForumCategoryService, forumCategoryService } from './ForumCategoryService';
import { ForumSectionService, forumSectionService } from './ForumSectionService';

/**
 * Internal interface to access private cache properties for statistics
 * Note: This accesses private implementation details for monitoring purposes
 */
interface ForumServiceWithCaches {
  topicCache: { size: number };
  categoryCache: { size: number };
}

/**
 * Convenience object containing all service instances
 *
 * Usage:
 * ```typescript
 * import { forumServices } from '@/lib/forums/services';
 *
 * const topic = await forumServices.forum.createTopic(data, userId);
 * await forumServices.moderation.pinTopic(topicId, moderatorId);
 * const results = await forumServices.search.search(query);
 * const stats = await forumServices.stats.getForumStats();
 * const categories = forumServices.category.getAllCategories('user');
 * ```
 */
export const forumServices = {
  forum: forumService,
  moderation: forumModerationService,
  search: forumSearchService,
  stats: forumStatsService,
  category: forumCategoryService,
  section: forumSectionService,
} as const;

/**
 * Type for the services object
 */
export type ForumServices = typeof forumServices;

/**
 * Service utility functions
 */
export const ForumServiceUtils = {
  /**
   * Clear all service caches
   *
   * Call this after bulk data changes or database migrations
   */
  clearAllCaches(): void {
    forumService.clearCaches();
    forumSearchService.clearCaches();
    forumStatsService.clearCaches();
  },

  /**
   * Invalidate caches after content changes
   *
   * Call this after creating/updating/deleting topics or replies
   */
  invalidateCaches(): void {
    forumService.clearCaches();
    forumSearchService.invalidateSearchCache();
    forumStatsService.invalidateStatsCache();
  },

  /**
   * Get cache statistics across all services
   *
   * Useful for monitoring and debugging
   */
  getCacheStats(): {
    forum: {
      topicCacheSize: number;
      categoryCacheSize: number;
    };
    search: {
      searchCacheSize: number;
      suggestionsCacheSize: number;
      recentSearchesCount: number;
    };
    stats: {
      forumStatsCacheSize: number;
      categoryStatsCacheSize: number;
      userStatsCacheSize: number;
    };
  } {
    const serviceWithCaches = forumService as unknown as ForumServiceWithCaches;
    return {
      forum: {
        topicCacheSize: serviceWithCaches.topicCache.size,
        categoryCacheSize: serviceWithCaches.categoryCache.size,
      },
      search: forumSearchService.getCacheStats(),
      stats: forumStatsService.getCacheStats(),
    };
  },
};
