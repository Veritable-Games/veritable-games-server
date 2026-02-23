/**
 * Wiki Services Index - Unified access to all specialized wiki services
 * Phase 3: God object refactoring - service factory and exports
 */

import { wikiPageService, WikiPageService } from './WikiPageService';
import { wikiRevisionService, WikiRevisionService } from './WikiRevisionService';
import { wikiCategoryService, WikiCategoryService } from './WikiCategoryService';
import { wikiSearchService, WikiSearchService } from './WikiSearchService';
import { wikiTagService, WikiTagService } from './WikiTagService';
import { wikiAnalyticsService, WikiAnalyticsService } from './WikiAnalyticsService';
import { logger } from '@/lib/utils/logger';
import type { UserId, WikiPageId, WikiRevisionId } from '@/types/profile-aggregation';
import type {
  CreateWikiPageData,
  UpdateWikiPageData,
  CreateWikiCategoryData,
  WikiSearchParams,
  WikiPage,
} from '../types';

/**
 * Type definitions for wiki service operations
 */
interface WikiRevisionOptions {
  limit?: number;
  offset?: number;
  authorId?: number;
}

interface WikiActivity {
  id: number;
  entity_id: string;
  entity_type: string;
  action: string;
  timestamp: string;
  page_title?: string;
  page_slug?: string;
  parsed_metadata?: {
    summary?: string;
    changeSize?: number;
    [key: string]: unknown;
  };
}

interface ActivityMetadata {
  [key: string]: unknown;
}

/**
 * Wiki Services Factory - provides unified access to all wiki services
 * Replaces the monolithic WikiService with specialized, focused services
 */
export class WikiServiceFactory {
  private static instance: WikiServiceFactory;

  // Service instances
  public readonly pages: WikiPageService;
  public readonly revisions: WikiRevisionService;
  public readonly categories: WikiCategoryService;
  public readonly search: WikiSearchService;
  public readonly tags: WikiTagService;
  public readonly analytics: WikiAnalyticsService;

  private constructor() {
    this.pages = wikiPageService;
    this.revisions = wikiRevisionService;
    this.categories = wikiCategoryService;
    this.search = wikiSearchService;
    this.tags = wikiTagService;
    this.analytics = wikiAnalyticsService;
  }

  /**
   * Get the singleton instance of the wiki service factory
   */
  static getInstance(): WikiServiceFactory {
    if (!WikiServiceFactory.instance) {
      WikiServiceFactory.instance = new WikiServiceFactory();
    }
    return WikiServiceFactory.instance;
  }

  /**
   * Log activity across all services (unified activity logging)
   */
  logActivity(
    userId: number,
    activityType: string,
    entityType: string,
    entityId: string,
    action: string,
    metadata?: ActivityMetadata
  ): void {
    this.analytics.logActivity(userId, activityType, entityType, entityId, action, metadata);
  }

  /**
   * Health check for all wiki services
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    timestamp: string;
  }> {
    const serviceChecks = {
      pages: false,
      revisions: false,
      categories: false,
      search: false,
      tags: false,
      analytics: false,
    };

    try {
      // Test each service with a simple operation
      await Promise.allSettled([
        this.pages.getAllPages(undefined, 1).then(() => (serviceChecks.pages = true)),
        this.revisions
          .getRecentRevisions({ limit: 1 })
          .then(() => (serviceChecks.revisions = true)),
        this.categories.getAllCategories().then(() => (serviceChecks.categories = true)),
        this.search.getPopularPages(1).then(() => (serviceChecks.search = true)),
        this.tags.getAllTags().then(() => (serviceChecks.tags = true)),
        this.analytics.getWikiStats().then(() => (serviceChecks.analytics = true)),
      ]);

      const healthyServices = Object.values(serviceChecks).filter(Boolean).length;
      const totalServices = Object.keys(serviceChecks).length;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyServices === totalServices) {
        status = 'healthy';
      } else if (healthyServices >= totalServices / 2) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        status,
        services: serviceChecks,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Wiki service health check failed', { error });
      return {
        status: 'unhealthy',
        services: serviceChecks,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get service usage statistics
   */
  getServiceStats(): {
    initialized_services: number;
    total_services: number;
    service_names: string[];
  } {
    const serviceNames = ['pages', 'revisions', 'categories', 'search', 'tags', 'analytics'];

    return {
      initialized_services: serviceNames.length,
      total_services: serviceNames.length,
      service_names: serviceNames,
    };
  }
}

// Export the factory instance
export const wikiServices = WikiServiceFactory.getInstance();

// Export individual services for direct access
export {
  wikiPageService,
  wikiRevisionService,
  wikiCategoryService,
  wikiSearchService,
  wikiTagService,
  wikiAnalyticsService,
};

// Export service classes for type checking
export {
  WikiPageService,
  WikiRevisionService,
  WikiCategoryService,
  WikiSearchService,
  WikiTagService,
  WikiAnalyticsService,
};

// Backward compatibility - create a unified interface similar to the old WikiService
export class WikiService {
  private factory = WikiServiceFactory.getInstance();

  // Page operations
  async createPage(data: CreateWikiPageData, authorId?: number, authorIp?: string) {
    const result = await this.factory.pages.createPage(data, authorId, authorIp);
    if (authorId) {
      // Log activity with detailed metadata
      const contentSize = data.content ? Buffer.from(data.content, 'utf8').length : 0;
      this.factory.logActivity(authorId, 'wiki_edit', 'page', result.id.toString(), 'create', {
        title: data.title,
        namespace: data.namespace,
        summary: data.summary || 'Initial page creation',
        change_type: 'create',
        additions: contentSize,
        size_bytes: contentSize,
        is_minor: data.is_minor || false,
      });
    }
    return result;
  }

  async updatePage(pageId: number, data: UpdateWikiPageData, authorId?: number, authorIp?: string) {
    // Get current page to calculate diff
    const currentPage = await this.factory.pages.getPageById(pageId);
    const result = await this.factory.pages.updatePage(pageId, data, authorId, authorIp);

    if (authorId) {
      // Calculate change size if content was updated
      let additions = 0;
      let deletions = 0;
      let changeType = 'metadata_update';

      // Determine action type based on what changed
      let action = 'update';

      if (data.content && currentPage?.content) {
        const oldSize = Buffer.from(currentPage.content, 'utf8').length;
        const newSize = Buffer.from(data.content, 'utf8').length;
        const diff = newSize - oldSize;

        if (diff > 0) {
          additions = diff;
          changeType = 'content_expansion';
        } else if (diff < 0) {
          deletions = Math.abs(diff);
          changeType = 'content_reduction';
        } else {
          changeType = 'content_refactor';
        }
      } else if (data.title && data.title !== currentPage?.title) {
        changeType = 'title_change';
      } else if (data.categories) {
        changeType = 'recategorization';
        action = 'recategorize'; // Set specific action for category changes
      }

      // Log activity with detailed metadata
      this.factory.logActivity(authorId, 'wiki_edit', 'page', pageId.toString(), action, {
        title: data.title || result.title,
        summary: data.summary || 'Page updated',
        change_type: changeType,
        additions,
        deletions,
        is_minor: data.is_minor || false,
        fields_changed: Object.keys(data),
        // Add old/new category info for recategorization
        ...(action === 'recategorize' && {
          old_category: currentPage?.category_ids?.[0],
          new_category: data.categories?.[0],
        }),
      });
    }
    return result;
  }

  async deletePage(pageId: number, authorId?: number, metadata?: ActivityMetadata) {
    await this.factory.pages.deletePage(pageId, authorId);
    if (authorId) {
      this.factory.logActivity(
        authorId,
        'wiki_edit',
        'page',
        pageId.toString(),
        'delete',
        metadata
      );
    }
  }

  async getPageById(pageId: number) {
    return this.factory.pages.getPageById(pageId);
  }

  async getPageBySlug(slug: string, namespace?: string) {
    return this.factory.pages.getPageBySlug(slug, namespace);
  }

  async getAllPages(category?: string, limit?: number, userRole?: string) {
    return this.factory.pages.getAllPages(category, limit, userRole);
  }

  async recordPageView(pageId: number) {
    return this.factory.pages.recordPageView(pageId);
  }

  // Search operations
  async searchPages(params: WikiSearchParams, userRole?: string) {
    return this.factory.search.searchPages(params, userRole);
  }

  async getPopularPages(limit?: number, userRole?: string) {
    return this.factory.search.getPopularPages(limit, userRole);
  }

  async getRecentPages(limit?: number, userRole?: string) {
    return this.factory.search.getRecentPages(limit, userRole);
  }

  // Category operations
  async createCategory(data: CreateWikiCategoryData) {
    return this.factory.categories.createCategory(data);
  }

  async getCategoryById(categoryId: string, userRole?: string) {
    return this.factory.categories.getCategoryById(categoryId, userRole);
  }

  async getAllCategories(userRole?: string) {
    return this.factory.categories.getAllCategories(userRole);
  }

  async getSubcategories(parentId: string) {
    return this.factory.categories.getSubcategories(parentId);
  }

  // Revision operations
  async getRevisionById(revisionId: number) {
    return this.factory.revisions.getRevisionById(revisionId);
  }

  async getPageRevisions(pageId: number, options?: WikiRevisionOptions) {
    return this.factory.revisions.getPageRevisions(pageId, options);
  }

  async deleteRevision(revisionId: number) {
    return this.factory.revisions.deleteRevision(revisionId);
  }

  // Tag operations
  async getAllTags() {
    return this.factory.tags.getAllTags();
  }

  async getPageTags(pageId: number) {
    return this.factory.tags.getPageTags(pageId);
  }

  async addTagToPage(pageId: number, tagId: number) {
    return this.factory.tags.addTagToPage(pageId, tagId);
  }

  async removeTagFromPage(pageId: number, tagId: number) {
    return this.factory.tags.removeTagFromPage(pageId, tagId);
  }

  async createAndAddTags(pageId: number, tagNames: string[], userId: number) {
    return this.factory.tags.addTagsToPage(pageId, tagNames, userId);
  }

  // Analytics operations
  async getRecentActivity(limit?: number) {
    return this.factory.analytics.getRecentActivity(limit);
  }

  async getWikiStats() {
    return this.factory.analytics.getWikiStats();
  }

  async getUserWikiStats(userId: number) {
    try {
      // Get raw stats from analytics service
      const rawStats = await this.factory.analytics.getUserContributionStats(userId);

      // Get additional data needed for WikiUserStats interface
      const [recentEdits, createdPages, mostEditedPages] = await Promise.all([
        this.getRecentEditsForUser(userId, 10),
        this.getCreatedPagesForUser(userId, 10),
        this.getMostEditedPagesForUser(userId, 5),
      ]);

      // Map to WikiUserStats interface format
      const wikiUserStats = {
        userId: userId as UserId, // Branded type conversion
        totalPagesCreated: rawStats.pages_created,
        totalEdits: rawStats.total_edits,
        totalRevisions: rawStats.total_edits, // Each edit creates a revision
        pagesViewed: 0, // Not currently tracked - would need page view data
        recentEdits,
        createdPages,
        mostEditedPages,
        averageEditSize:
          rawStats.total_content_added > 0 && rawStats.total_edits > 0
            ? Math.round(rawStats.total_content_added / rawStats.total_edits)
            : undefined,
        lastWikiActivity: rawStats.last_edit_date || undefined,
      };

      return wikiUserStats;
    } catch (error) {
      logger.error('Error getting user wiki stats', { error });
      // Return empty stats on error
      return {
        userId: userId as UserId,
        totalPagesCreated: 0,
        totalEdits: 0,
        totalRevisions: 0,
        pagesViewed: 0,
        recentEdits: [],
        createdPages: [],
        mostEditedPages: [],
        averageEditSize: undefined,
        lastWikiActivity: undefined,
      };
    }
  }

  // Helper methods for getUserWikiStats
  private async getRecentEditsForUser(userId: number, limit: number = 10) {
    try {
      const userActivity = await this.factory.analytics.getUserActivity(userId, { limit });

      return (userActivity as WikiActivity[])
        .filter(activity => activity.action === 'edit' || activity.action === 'update')
        .map(activity => ({
          id: Number(activity.id || activity.entity_id) as WikiRevisionId,
          pageId: Number(activity.entity_id) as WikiPageId,
          pageTitle: activity.page_title || 'Unknown Page',
          pageSlug: activity.page_slug || '',
          summary: activity.parsed_metadata?.summary || activity.action,
          revisionTimestamp: activity.timestamp,
          changeSize: this.estimateChangeSize(activity),
        }));
    } catch (error) {
      logger.error('Error getting recent edits for user', { error });
      return [];
    }
  }

  private async getCreatedPagesForUser(userId: number, limit: number = 10) {
    try {
      const userActivity = await this.factory.analytics.getUserActivity(userId, {
        limit: limit * 2, // Get more to filter for creates
        action: 'create',
      });

      return (userActivity as WikiActivity[])
        .filter(activity => activity.action === 'create')
        .slice(0, limit)
        .map(activity => ({
          id: Number(activity.entity_id) as WikiPageId,
          title: activity.page_title || 'Unknown Page',
          slug: activity.page_slug || '',
          viewCount: 0, // Not tracked in activity - would need separate query
          revisionCount: 1, // New pages start with 1 revision
          createdAt: activity.timestamp,
          lastEditAt: activity.timestamp,
        }));
    } catch (error) {
      logger.error('Error getting created pages for user', { error });
      return [];
    }
  }

  private async getMostEditedPagesForUser(userId: number, limit: number = 5) {
    try {
      const userActivity = await this.factory.analytics.getUserActivity(userId, { limit: 100 });

      // Group activities by page and count edits
      interface PageEdit {
        count: number;
        page: {
          id: WikiPageId;
          title: string;
          slug: string;
          viewCount: number;
          revisionCount: number;
          createdAt: string;
          lastEditAt: string;
        };
      }

      const pageEditCounts = new Map<string, PageEdit>();

      (userActivity as WikiActivity[]).forEach(activity => {
        if (activity.entity_type === 'page') {
          const pageId = activity.entity_id;
          const existing = pageEditCounts.get(pageId);

          if (existing) {
            existing.count++;
          } else {
            pageEditCounts.set(pageId, {
              count: 1,
              page: {
                id: Number(pageId) as WikiPageId,
                title: activity.page_title || 'Unknown Page',
                slug: activity.page_slug || '',
                viewCount: 0, // Not tracked in activity
                revisionCount: 1, // Simplified
                createdAt: activity.timestamp,
                lastEditAt: activity.timestamp,
              },
            });
          }
        }
      });

      // Sort by edit count and return top pages
      return Array.from(pageEditCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map(entry => entry.page);
    } catch (error) {
      logger.error('Error getting most edited pages for user', { error });
      return [];
    }
  }

  private estimateChangeSize(activity: WikiActivity): number {
    // Estimate change size from activity metadata
    if (activity.parsed_metadata?.changeSize) {
      return activity.parsed_metadata.changeSize;
    }

    // Simple estimation based on action type
    switch (activity.action) {
      case 'create':
        return 500; // Estimate for new page
      case 'edit':
      case 'update':
        return 100; // Estimate for edit
      default:
        return 0;
    }
  }

  // Utility methods preserved for backward compatibility
  private async canUserAccessPage(page: WikiPage, userRole?: string): Promise<boolean> {
    return await this.factory.pages.canUserAccessPage(page, userRole);
  }

  // Legacy methods that don't map directly - these would need to be implemented
  // or the calling code updated to use the new service structure
  async getCategories(userRole?: string) {
    return this.factory.categories.getAllCategories(userRole);
  }

  async getPageInfoboxes(pageId: number) {
    return this.factory.pages.getPageInfoboxes(pageId);
  }

  // Template and infobox methods would be moved to separate services
  async getTemplates() {
    return [];
  }
  async getTemplateById() {
    return null;
  }
  async createTemplate() {
    return null;
  }
  async updateTemplate() {
    return null;
  }
  async deleteTemplate() {
    return null;
  }
  async getInfoboxes() {
    return [];
  }
  async getInfoboxById() {
    return null;
  }
  async createInfobox() {
    return null;
  }
  async updateInfobox() {
    return null;
  }
  async deleteInfobox() {
    return null;
  }
}

// Export the backward-compatible service instance
export const wikiService = new WikiService();
