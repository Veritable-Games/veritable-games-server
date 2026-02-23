/**
 * WikiTagService - Specialized service for wiki tag management
 * Phase 3: God object refactoring - extracted from WikiService
 * Phase 11d: Converted to PostgreSQL
 */

import { dbAdapter } from '@/lib/database/adapter';
import { cache } from '@/lib/cache';
import { WikiTag, CreateWikiTagData } from '../types';
import { logger } from '@/lib/utils/logger';

export class WikiTagService {
  /**
   * Get all tags with usage counts
   */
  async getAllTags(): Promise<WikiTag[]> {
    const cacheKey = 'wiki_tags:all';
    const cached = await cache.get<WikiTag[]>({ category: 'content', identifier: cacheKey });
    if (cached) {
      return cached;
    }

    try {
      const result = await dbAdapter.query(
        `
        SELECT id, name, color, usage_count, created_at
        FROM wiki_tags
        ORDER BY usage_count DESC, name
      `,
        [],
        { schema: 'wiki' }
      );

      const tags = result.rows as WikiTag[];

      // Cache for 10 minutes
      await cache.set({ category: 'content', identifier: cacheKey }, tags);

      return tags;
    } catch (error) {
      logger.error('Error getting all tags', { error });
      return [];
    }
  }

  /**
   * Get tags for a specific page
   */
  async getPageTags(pageId: number): Promise<WikiTag[]> {
    const cacheKey = `wiki_tags:page:${pageId}`;
    const cached = await cache.get<WikiTag[]>({ category: 'content', identifier: cacheKey });
    if (cached) {
      return cached;
    }

    try {
      const result = await dbAdapter.query(
        `
        SELECT t.id, t.name, t.color, t.usage_count, t.created_at
        FROM wiki_tags t
        JOIN wiki_page_tags pt ON t.id = pt.tag_id
        WHERE pt.page_id = $1
        ORDER BY t.name
      `,
        [pageId],
        { schema: 'wiki' }
      );

      const tags = result.rows as WikiTag[];

      // Cache for 5 minutes
      await cache.set({ category: 'content', identifier: cacheKey }, tags);

      return tags;
    } catch (error) {
      logger.error('Error getting page tags', { pageId, error });
      return [];
    }
  }

  /**
   * Create a new tag
   */
  async createTag(data: CreateWikiTagData): Promise<WikiTag> {
    // Check if tag already exists
    const existingResult = await dbAdapter.query(
      'SELECT id FROM wiki_tags WHERE name = $1',
      [data.name],
      { schema: 'wiki' }
    );

    if (existingResult.rows.length > 0) {
      throw new Error(`Tag '${data.name}' already exists`);
    }

    try {
      const result = await dbAdapter.query(
        `
        INSERT INTO wiki_tags (name, color, description)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
        [data.name.trim(), data.color || '#3b82f6', data.description || null],
        { schema: 'wiki' }
      );

      const tagId = result.rows[0].id;

      // Invalidate cache
      await this.invalidateTagCache();

      // Return the created tag
      return this.getTagById(tagId);
    } catch (error: any) {
      if (error.code === '23505') {
        // PostgreSQL unique violation
        throw new Error(`Tag '${data.name}' already exists`);
      }
      throw new Error(`Failed to create tag: ${error.message}`);
    }
  }

  /**
   * Update an existing tag
   */
  async updateTag(tagId: number, data: Partial<CreateWikiTagData>): Promise<WikiTag> {
    // Validate tag exists
    const existingTag = await this.getTagById(tagId);
    if (!existingTag) {
      throw new Error(`Tag with ID ${tagId} not found`);
    }

    // Check for name conflicts if name is being updated
    if (data.name) {
      const nameConflictResult = await dbAdapter.query(
        'SELECT id FROM wiki_tags WHERE name = $1 AND id != $2',
        [data.name.trim(), tagId],
        { schema: 'wiki' }
      );

      if (nameConflictResult.rows.length > 0) {
        throw new Error(`Tag name '${data.name}' is already in use`);
      }
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name.trim());
    }
    if (data.color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(data.color);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (updates.length === 0) {
      return existingTag;
    }

    updates.push(`updated_at = NOW()`);
    values.push(tagId);

    await dbAdapter.query(
      `UPDATE wiki_tags SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values,
      { schema: 'wiki' }
    );

    // Invalidate cache
    await this.invalidateTagCache();

    return this.getTagById(tagId);
  }

  /**
   * Delete a tag (removes all associations)
   */
  async deleteTag(tagId: number): Promise<void> {
    // Check if tag exists
    const tag = await this.getTagById(tagId);
    if (!tag) {
      throw new Error(`Tag with ID ${tagId} not found`);
    }

    // Use transaction to ensure atomicity
    await dbAdapter.transaction(async () => {
      // Remove all page associations
      await dbAdapter.query('DELETE FROM wiki_page_tags WHERE tag_id = $1', [tagId], {
        schema: 'wiki',
      });

      // Delete the tag
      await dbAdapter.query('DELETE FROM wiki_tags WHERE id = $1', [tagId], { schema: 'wiki' });
    });

    // Invalidate cache
    await this.invalidateTagCache();
  }

  /**
   * Get a tag by ID
   */
  async getTagById(tagId: number): Promise<WikiTag> {
    const result = await dbAdapter.query(
      `
      SELECT id, name, color, description, usage_count, created_at, updated_at
      FROM wiki_tags
      WHERE id = $1
    `,
      [tagId],
      { schema: 'wiki' }
    );

    const tag = result.rows[0] as WikiTag | undefined;
    if (!tag) {
      throw new Error(`Tag with ID ${tagId} not found`);
    }

    return tag;
  }

  /**
   * Get or create a tag by name
   */
  async getOrCreateTag(name: string): Promise<WikiTag> {
    const trimmedName = name.trim();

    // Try to get existing tag
    const existingResult = await dbAdapter.query(
      'SELECT * FROM wiki_tags WHERE name = $1',
      [trimmedName],
      { schema: 'wiki' }
    );

    if (existingResult.rows.length > 0) {
      return existingResult.rows[0] as WikiTag;
    }

    // Create new tag
    const insertResult = await dbAdapter.query(
      `
      INSERT INTO wiki_tags (name, color, usage_count)
      VALUES ($1, $2, 0)
      RETURNING id
    `,
      [trimmedName, '#3b82f6'],
      { schema: 'wiki' }
    );

    const tagId = insertResult.rows[0].id;
    return this.getTagById(tagId);
  }

  /**
   * Add a tag to a page
   */
  async addTagToPage(pageId: number, tagId: number): Promise<void> {
    // Validate page exists
    const pageResult = await dbAdapter.query('SELECT id FROM wiki_pages WHERE id = $1', [pageId], {
      schema: 'wiki',
    });
    if (pageResult.rows.length === 0) {
      throw new Error('Page not found');
    }

    // Validate tag exists
    const tagExists = await this.getTagById(tagId);
    if (!tagExists) {
      throw new Error('Tag not found');
    }

    await dbAdapter.transaction(async () => {
      // Check if tag is already linked to page
      const existingLinkResult = await dbAdapter.query(
        `
        SELECT 1 FROM wiki_page_tags WHERE page_id = $1 AND tag_id = $2
      `,
        [pageId, tagId],
        { schema: 'wiki' }
      );

      if (existingLinkResult.rows.length > 0) {
        throw new Error('Tag is already linked to this page');
      }

      // Add the link
      await dbAdapter.query(
        `
        INSERT INTO wiki_page_tags (page_id, tag_id) VALUES ($1, $2)
      `,
        [pageId, tagId],
        { schema: 'wiki' }
      );

      // Update usage count
      await dbAdapter.query(
        `
        UPDATE wiki_tags SET usage_count = usage_count + 1 WHERE id = $1
      `,
        [tagId],
        { schema: 'wiki' }
      );
    });

    // Invalidate cache
    await this.invalidatePageTagCache(pageId);
    await this.invalidateTagCache();
  }

  /**
   * Remove a tag from a page
   */
  async removeTagFromPage(pageId: number, tagId: number): Promise<void> {
    await dbAdapter.transaction(async () => {
      // Remove the link
      const result = await dbAdapter.query(
        `
        DELETE FROM wiki_page_tags WHERE page_id = $1 AND tag_id = $2
      `,
        [pageId, tagId],
        { schema: 'wiki' }
      );

      if (result.rowCount === 0) {
        throw new Error('Tag not found on this page');
      }

      // Update usage count
      await dbAdapter.query(
        `
        UPDATE wiki_tags SET usage_count = CASE
          WHEN usage_count > 0 THEN usage_count - 1
          ELSE 0
        END WHERE id = $1
      `,
        [tagId],
        { schema: 'wiki' }
      );
    });

    // Invalidate cache
    await this.invalidatePageTagCache(pageId);
    await this.invalidateTagCache();
  }

  /**
   * Add multiple tags to a page by name (creates tags if they don't exist)
   */
  async addTagsToPage(
    pageId: number,
    tagNames: string[],
    userId?: number
  ): Promise<{ addedTags: WikiTag[]; existingTags: WikiTag[] }> {
    // Validate page exists
    const pageResult = await dbAdapter.query('SELECT id FROM wiki_pages WHERE id = $1', [pageId], {
      schema: 'wiki',
    });
    if (pageResult.rows.length === 0) {
      throw new Error('Page not found');
    }

    const addedTags: WikiTag[] = [];
    const existingTags: WikiTag[] = [];

    await dbAdapter.transaction(async () => {
      for (const tagName of tagNames) {
        if (!tagName.trim()) continue;

        // Get or create tag
        const tag = await this.getOrCreateTag(tagName.trim());

        // Check if tag is already linked to page
        const existingLinkResult = await dbAdapter.query(
          `
          SELECT 1 FROM wiki_page_tags WHERE page_id = $1 AND tag_id = $2
        `,
          [pageId, tag.id],
          { schema: 'wiki' }
        );

        if (existingLinkResult.rows.length === 0) {
          // Add the link
          await dbAdapter.query(
            `
            INSERT INTO wiki_page_tags (page_id, tag_id) VALUES ($1, $2)
          `,
            [pageId, tag.id],
            { schema: 'wiki' }
          );

          // Update usage count
          await dbAdapter.query(
            `
            UPDATE wiki_tags SET usage_count = usage_count + 1 WHERE id = $1
          `,
            [tag.id],
            { schema: 'wiki' }
          );

          addedTags.push(tag);
        } else {
          existingTags.push(tag);
        }
      }
    });

    // Invalidate cache
    await this.invalidatePageTagCache(pageId);
    await this.invalidateTagCache();

    return { addedTags, existingTags };
  }

  /**
   * Replace all tags for a page
   */
  async setPageTags(pageId: number, tagNames: string[]): Promise<WikiTag[]> {
    // Validate page exists
    const pageResult = await dbAdapter.query('SELECT id FROM wiki_pages WHERE id = $1', [pageId], {
      schema: 'wiki',
    });
    if (pageResult.rows.length === 0) {
      throw new Error('Page not found');
    }

    const newTags: WikiTag[] = [];

    await dbAdapter.transaction(async () => {
      // Get current tags to update usage counts
      const currentTagsResult = await dbAdapter.query(
        `
        SELECT t.id FROM wiki_tags t
        JOIN wiki_page_tags pt ON t.id = pt.tag_id
        WHERE pt.page_id = $1
      `,
        [pageId],
        { schema: 'wiki' }
      );

      const currentTags = currentTagsResult.rows as { id: number }[];

      // Remove existing tags
      await dbAdapter.query('DELETE FROM wiki_page_tags WHERE page_id = $1', [pageId], {
        schema: 'wiki',
      });

      // Decrease usage count for old tags
      for (const tag of currentTags) {
        await dbAdapter.query(
          `
          UPDATE wiki_tags SET usage_count = CASE
            WHEN usage_count > 0 THEN usage_count - 1
            ELSE 0
          END WHERE id = $1
        `,
          [tag.id],
          { schema: 'wiki' }
        );
      }

      // Add new tags
      for (const tagName of tagNames) {
        if (!tagName.trim()) continue;

        const tag = await this.getOrCreateTag(tagName.trim());

        await dbAdapter.query(
          `
          INSERT INTO wiki_page_tags (page_id, tag_id) VALUES ($1, $2)
        `,
          [pageId, tag.id],
          { schema: 'wiki' }
        );

        await dbAdapter.query(
          `
          UPDATE wiki_tags SET usage_count = usage_count + 1 WHERE id = $1
        `,
          [tag.id],
          { schema: 'wiki' }
        );

        newTags.push(tag);
      }
    });

    // Invalidate cache
    await this.invalidatePageTagCache(pageId);
    await this.invalidateTagCache();

    return newTags;
  }

  /**
   * Get popular tags (most used)
   */
  async getPopularTags(limit: number = 20): Promise<WikiTag[]> {
    const cacheKey = `wiki_tags:popular:${limit}`;
    const cached = await cache.get<WikiTag[]>({ category: 'content', identifier: cacheKey });
    if (cached) {
      return cached;
    }

    const result = await dbAdapter.query(
      `
      SELECT id, name, color, usage_count, created_at
      FROM wiki_tags
      WHERE usage_count > 0
      ORDER BY usage_count DESC, name
      LIMIT $1
    `,
      [limit],
      { schema: 'wiki' }
    );

    const tags = result.rows as WikiTag[];

    // Cache for 15 minutes
    await cache.set({ category: 'content', identifier: cacheKey }, tags);

    return tags;
  }

  /**
   * Search tags by name
   */
  async searchTags(query: string, limit: number = 20): Promise<WikiTag[]> {
    if (query.trim().length === 0) {
      return this.getPopularTags(limit);
    }

    const searchPattern = `%${query.trim()}%`;

    const result = await dbAdapter.query(
      `
      SELECT id, name, color, usage_count, created_at
      FROM wiki_tags
      WHERE name ILIKE $1
      ORDER BY usage_count DESC, name
      LIMIT $2
    `,
      [searchPattern, limit],
      { schema: 'wiki' }
    );

    return result.rows as WikiTag[];
  }

  /**
   * Get tag statistics
   */
  async getTagStats(): Promise<{
    total_tags: number;
    tags_in_use: number;
    average_usage: number;
    most_used_tag: WikiTag | null;
  }> {
    const totalResult = await dbAdapter.query('SELECT COUNT(*) as count FROM wiki_tags', [], {
      schema: 'wiki',
    });

    const inUseResult = await dbAdapter.query(
      'SELECT COUNT(*) as count FROM wiki_tags WHERE usage_count > 0',
      [],
      { schema: 'wiki' }
    );

    const avgResult = await dbAdapter.query(
      'SELECT AVG(usage_count) as avg FROM wiki_tags WHERE usage_count > 0',
      [],
      { schema: 'wiki' }
    );

    const mostUsedResult = await dbAdapter.query(
      `
      SELECT id, name, color, usage_count, created_at
      FROM wiki_tags
      ORDER BY usage_count DESC
      LIMIT 1
    `,
      [],
      { schema: 'wiki' }
    );

    return {
      total_tags: Number(totalResult.rows[0].count),
      tags_in_use: Number(inUseResult.rows[0].count),
      average_usage: Math.round(Number(avgResult.rows[0].avg) || 0),
      most_used_tag: (mostUsedResult.rows[0] as WikiTag) || null,
    };
  }

  /**
   * Clean up unused tags (tags with 0 usage count)
   */
  async cleanupUnusedTags(): Promise<number> {
    const result = await dbAdapter.query('DELETE FROM wiki_tags WHERE usage_count = 0', [], {
      schema: 'wiki',
    });

    if (result.rowCount > 0) {
      await this.invalidateTagCache();
    }

    return result.rowCount;
  }

  /**
   * Invalidate tag-related cache entries
   */
  private async invalidateTagCache(): Promise<void> {
    const cacheKeys = ['wiki_tags:all'];

    await Promise.all(cacheKeys.map(key => cache.delete({ category: 'content', identifier: key })));

    // Also clear popular tags cache (with different limits)
    for (let i = 5; i <= 50; i += 5) {
      await cache.delete({ category: 'content', identifier: `wiki_tags:popular:${i}` });
    }
  }

  /**
   * Invalidate page-specific tag cache
   */
  private async invalidatePageTagCache(pageId: number): Promise<void> {
    await cache.delete({ category: 'content', identifier: `wiki_tags:page:${pageId}` });
  }
}

// Export singleton instance
export const wikiTagService = new WikiTagService();
