/**
 * Singleton Search Manager
 *
 * CRITICAL FIX: FlexSearch was being rebuilt on every request
 * causing 500-2000ms delays. This maintains persistent indexes.
 */

import FlexSearch from 'flexsearch';
import { dbAdapter } from '../database/adapter';
import { logger } from '@/lib/utils/logger';

interface SearchDocument {
  id: string | number;
  title?: string;
  content: string;
  type: string;
  metadata?: any;
}

class SearchManager {
  private static instance: SearchManager;
  private indexes: Map<string, FlexSearch.Index>;
  private initialized: Set<string>;
  private lastUpdate: Map<string, number>;
  private updateInterval = 60000; // Refresh every 60 seconds

  private constructor() {
    this.indexes = new Map();
    this.initialized = new Set();
    this.lastUpdate = new Map();
  }

  static getInstance(): SearchManager {
    if (!SearchManager.instance) {
      SearchManager.instance = new SearchManager();
    }
    return SearchManager.instance;
  }

  /**
   * Get or create a search index
   */
  getIndex(name: string, options?: any): FlexSearch.Index {
    if (!this.indexes.has(name)) {
      const defaultOptions = {
        preset: 'match',
        tokenize: 'forward',
        resolution: 9,
        cache: true,
        stemmer: 'en',
        filter: [
          'a',
          'an',
          'and',
          'are',
          'as',
          'at',
          'be',
          'been',
          'by',
          'for',
          'from',
          'has',
          'he',
          'in',
          'is',
          'it',
          'its',
          'of',
          'on',
          'that',
          'the',
          'to',
          'was',
          'were',
          'will',
          'with',
        ],
      };

      const index = new FlexSearch.Index({
        ...defaultOptions,
        ...options,
      });

      this.indexes.set(name, index);
    }

    return this.indexes.get(name)!;
  }

  /**
   * Initialize forum search indexes
   */
  async initializeForumSearch(): Promise<void> {
    const indexName = 'forums';

    // Check if already initialized recently
    const lastUpdate = this.lastUpdate.get(indexName) || 0;
    const now = Date.now();

    if (this.initialized.has(indexName) && now - lastUpdate < this.updateInterval) {
      return; // Skip if recently updated
    }

    // Clear existing indexes if refreshing
    if (this.initialized.has(indexName)) {
      this.indexes.delete('forum-topics');
      this.indexes.delete('forum-replies');
    }

    const topicIndex = this.getIndex('forum-topics');
    const replyIndex = this.getIndex('forum-replies');

    // Index all topics
    // Note: Using explicit schema qualification (forums.forum_topics, users.users)
    // so NO schema option needed - prevents double-prefixing
    const topicsResult = await dbAdapter.query(
      `
      SELECT
        t.id,
        t.title,
        t.content,
        u.username as author
      FROM forums.forum_topics t
      LEFT JOIN users.users u ON t.author_id = u.id
      WHERE t.deleted_at IS NULL
    `,
      []
    );

    const topics = topicsResult.rows as Array<{
      id: number;
      title: string;
      content: string;
      author: string;
    }>;

    for (const topic of topics) {
      const searchText = `${topic.title || ''} ${topic.content || ''} ${topic.author || ''}`;
      topicIndex.add(topic.id, searchText);
    }

    // Index all replies
    // Note: Using explicit schema qualification (forums.forum_replies, users.users)
    // so NO schema option needed - prevents double-prefixing
    const repliesResult = await dbAdapter.query(
      `
      SELECT
        r.id,
        r.content,
        u.username as author
      FROM forums.forum_replies r
      LEFT JOIN users.users u ON r.author_id = u.id
      WHERE r.deleted_at IS NULL
    `,
      []
    );

    const replies = repliesResult.rows as Array<{ id: number; content: string; author: string }>;

    for (const reply of replies) {
      const searchText = `${reply.content || ''} ${reply.author || ''}`;
      replyIndex.add(reply.id, searchText);
    }

    this.initialized.add(indexName);
    this.lastUpdate.set(indexName, now);

    logger.info(`Forum search initialized: ${topics.length} topics, ${replies.length} replies`);
  }

  /**
   * Initialize wiki search indexes
   */
  async initializeWikiSearch(): Promise<void> {
    const indexName = 'wiki';

    // Check if already initialized recently
    const lastUpdate = this.lastUpdate.get(indexName) || 0;
    const now = Date.now();

    if (this.initialized.has(indexName) && now - lastUpdate < this.updateInterval) {
      return; // Skip if recently updated
    }

    // Clear existing indexes if refreshing
    if (this.initialized.has(indexName)) {
      this.indexes.delete('wiki-pages');
    }

    const wikiIndex = this.getIndex('wiki-pages');

    // Index all wiki pages
    const pagesResult = await dbAdapter.query(
      `
      SELECT
        id,
        title,
        slug,
        content,
        tags
      FROM wiki_pages
      WHERE status = 'published'
    `,
      [],
      { schema: 'wiki' }
    );

    const pages = pagesResult.rows as Array<{
      id: number;
      title: string;
      slug: string;
      content: string;
      tags: string | null;
    }>;

    for (const page of pages) {
      const searchText = `${page.title || ''} ${page.content || ''} ${page.tags || ''}`;
      wikiIndex.add(page.id, searchText);
    }

    this.initialized.add(indexName);
    this.lastUpdate.set(indexName, now);

    logger.info(`Wiki search initialized: ${pages.length} pages`);
  }

  /**
   * Search forums with pre-initialized index
   */
  async searchForums(query: string, options: any = {}) {
    // Ensure indexes are initialized
    await this.initializeForumSearch();

    const topicIndex = this.getIndex('forum-topics');
    const replyIndex = this.getIndex('forum-replies');

    const results = [];

    // Search topics
    if (options.type !== 'reply') {
      const topicIds = topicIndex.search(query, options.limit || 10) as number[];
      if (topicIds.length > 0) {
        const placeholders = topicIds.map((_, i) => `$${i + 1}`).join(',');
        const topicsResult = await dbAdapter.query(
          `
          SELECT
            t.*,
            u.username as author_username,
            u.display_name as author_display_name,
            c.name as category_name
          FROM forum_topics t
          LEFT JOIN users.users u ON t.author_id = u.id
          LEFT JOIN forum_categories c ON t.category_id = c.id
          WHERE t.id IN (${placeholders})
        `,
          topicIds,
          { schema: 'forums' }
        );

        results.push(...topicsResult.rows.map((t: any) => ({ ...t, type: 'topic' })));
      }
    }

    // Search replies
    if (options.type !== 'topic') {
      const replyIds = replyIndex.search(query, options.limit || 10) as number[];
      if (replyIds.length > 0) {
        const placeholders = replyIds.map((_, i) => `$${i + 1}`).join(',');
        const repliesResult = await dbAdapter.query(
          `
          SELECT
            r.*,
            u.username as author_username,
            u.display_name as author_display_name
          FROM forum_replies r
          LEFT JOIN users.users u ON r.author_id = u.id
          WHERE r.id IN (${placeholders})
        `,
          replyIds,
          { schema: 'forums' }
        );

        results.push(...repliesResult.rows.map((r: any) => ({ ...r, type: 'reply' })));
      }
    }

    return results;
  }

  /**
   * Search wiki with pre-initialized index
   */
  async searchWiki(query: string, limit: number = 10) {
    // Ensure index is initialized
    await this.initializeWikiSearch();

    const wikiIndex = this.getIndex('wiki-pages');
    const pageIds = wikiIndex.search(query, limit) as number[];

    if (pageIds.length === 0) {
      return [];
    }

    const placeholders = pageIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await dbAdapter.query(
      `
      SELECT * FROM wiki_pages
      WHERE id IN (${placeholders})
      ORDER BY view_count DESC
    `,
      pageIds,
      { schema: 'wiki' }
    );

    return result.rows;
  }

  /**
   * Add a document to search index (for real-time updates)
   */
  addToIndex(indexName: string, id: string | number, content: string) {
    const index = this.getIndex(indexName);
    index.add(id, content);
  }

  /**
   * Remove a document from search index
   */
  removeFromIndex(indexName: string, id: string | number) {
    const index = this.getIndex(indexName);
    index.remove(id);
  }

  /**
   * Force refresh all indexes
   */
  async refreshAll() {
    this.initialized.clear();
    this.lastUpdate.clear();
    await Promise.all([this.initializeForumSearch(), this.initializeWikiSearch()]);
  }

  /**
   * Get statistics about search indexes
   */
  getStats() {
    const stats: any = {};
    for (const [name, index] of this.indexes) {
      stats[name] = {
        initialized: this.initialized.has(name),
        lastUpdate: this.lastUpdate.get(name),
        // Index doesn't expose size directly
        size: 'unknown',
      };
    }
    return stats;
  }
}

// Export singleton instance
export const searchManager = SearchManager.getInstance();

// Initialize on first import (non-blocking)
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  // Initialize in background
  Promise.all([searchManager.initializeForumSearch(), searchManager.initializeWikiSearch()]).catch(
    error => {
      logger.error('Failed to initialize search indexes:', error);
    }
  );
}
