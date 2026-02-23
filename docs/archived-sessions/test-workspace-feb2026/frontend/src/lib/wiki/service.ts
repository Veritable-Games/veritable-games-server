/**
 * WikiService - Legacy wrapper for backward compatibility
 *
 * DEPRECATED: This service has been refactored into specialized services.
 * New code should use the individual services directly:
 *
 * - wikiPageService: Page CRUD operations
 * - wikiRevisionService: Revision management
 * - wikiCategoryService: Category management
 * - wikiSearchService: Search and discovery
 * - wikiTagService: Tag management
 * - wikiAnalyticsService: Analytics and activity tracking
 *
 * Import from: @/lib/wiki/services
 */

import { wikiService as newWikiService } from './services';
import type {
  CreateWikiPageData,
  UpdateWikiPageData,
  CreateWikiCategoryData,
  WikiSearchParams,
  CreateWikiTemplateData,
  UpdateWikiTemplateData,
  CreateWikiInfoboxData,
  UpdateWikiInfoboxData,
} from './types';

// Re-export the new service for backward compatibility
export class WikiService {
  // Delegate all operations to the new refactored service

  // Page operations
  async createPage(data: CreateWikiPageData, authorId?: number, authorIp?: string) {
    return newWikiService.createPage(data, authorId, authorIp);
  }

  async updatePage(pageId: number, data: UpdateWikiPageData, authorId?: number, authorIp?: string) {
    return newWikiService.updatePage(pageId, data, authorId, authorIp);
  }

  async deletePage(pageId: number, authorId?: number, metadata?: Record<string, unknown>) {
    return newWikiService.deletePage(pageId, authorId, metadata);
  }

  async getPageById(pageId: number) {
    return newWikiService.getPageById(pageId);
  }

  async getPageBySlug(slug: string, namespace?: string) {
    return newWikiService.getPageBySlug(slug, namespace);
  }

  async getAllPages(category?: string, limit?: number, userRole?: string) {
    return newWikiService.getAllPages(category, limit, userRole);
  }

  async recordPageView(pageId: number) {
    return newWikiService.recordPageView(pageId);
  }

  // Search operations
  async searchPages(params: WikiSearchParams, userRole?: string) {
    return newWikiService.searchPages(params, userRole);
  }

  async getPopularPages(limit?: number, userRole?: string) {
    return newWikiService.getPopularPages(limit, userRole);
  }

  async getRecentPages(limit?: number, userRole?: string) {
    return newWikiService.getRecentPages(limit, userRole);
  }

  // Category operations
  async createCategory(data: CreateWikiCategoryData) {
    return newWikiService.createCategory(data);
  }

  async getCategoryById(categoryId: string, userRole?: string) {
    return newWikiService.getCategoryById(categoryId, userRole);
  }

  async getAllCategories(userRole?: string) {
    return newWikiService.getAllCategories(userRole);
  }

  async getCategories(userRole?: string) {
    return newWikiService.getCategories(userRole);
  }

  async getSubcategories(parentId: string) {
    return newWikiService.getSubcategories(parentId);
  }

  // Revision operations
  async getRevisionById(revisionId: number) {
    return newWikiService.getRevisionById(revisionId);
  }

  async getPageRevisions(pageId: number, options?: { limit?: number; offset?: number }) {
    return newWikiService.getPageRevisions(pageId, options);
  }

  async deleteRevision(revisionId: number) {
    return newWikiService.deleteRevision(revisionId);
  }

  // Tag operations
  async getAllTags() {
    return newWikiService.getAllTags();
  }

  async getPageTags(pageId: number) {
    return newWikiService.getPageTags(pageId);
  }

  async addTagToPage(pageId: number, tagId: number) {
    return newWikiService.addTagToPage(pageId, tagId);
  }

  async removeTagFromPage(pageId: number, tagId: number) {
    return newWikiService.removeTagFromPage(pageId, tagId);
  }

  async createAndAddTags(pageId: number, tagNames: string[], userId: number) {
    return newWikiService.createAndAddTags(pageId, tagNames, userId);
  }

  // Analytics operations
  async getRecentActivity(limit?: number) {
    return newWikiService.getRecentActivity(limit);
  }

  async getWikiStats() {
    return newWikiService.getWikiStats();
  }

  async getUserWikiStats(userId: number) {
    return newWikiService.getUserWikiStats(userId);
  }

  // Template and infobox operations (placeholder for backward compatibility)
  async getPageInfoboxes(pageId: number) {
    return newWikiService.getPageInfoboxes(pageId);
  }

  async getTemplates(filters?: Record<string, unknown>) {
    return newWikiService.getTemplates();
  }

  async getTemplateById(templateId: number) {
    return newWikiService.getTemplateById();
  }

  async createTemplate(data: CreateWikiTemplateData, userId: number) {
    return newWikiService.createTemplate();
  }

  async updateTemplate(templateId: number, data: UpdateWikiTemplateData, userId: number) {
    return newWikiService.updateTemplate();
  }

  async deleteTemplate(templateId: number, userId: number) {
    return newWikiService.deleteTemplate();
  }

  async getInfoboxes(filters?: Record<string, unknown>) {
    return newWikiService.getInfoboxes();
  }

  async getInfoboxById(infoboxId: number) {
    return newWikiService.getInfoboxById();
  }

  async createInfobox(data: CreateWikiInfoboxData, userId: number) {
    return newWikiService.createInfobox();
  }

  async updateInfobox(infoboxId: number, data: UpdateWikiInfoboxData, userId: number) {
    return newWikiService.updateInfobox();
  }

  async deleteInfobox(infoboxId: number, userId: number) {
    return newWikiService.deleteInfobox();
  }
}

// Export the backward-compatible service instance
export const wikiService = new WikiService();

// Export individual functions for backward compatibility with tests
export const createWikiPage = wikiService.createPage.bind(wikiService);
