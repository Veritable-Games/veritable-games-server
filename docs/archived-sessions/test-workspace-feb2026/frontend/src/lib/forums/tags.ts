import { dbAdapter } from '@/lib/database/adapter';
import path from 'path';
import { logger } from '@/lib/utils/logger';

export interface ForumTag {
  id: number;
  name: string;
  slug: string;
  description?: string;
  color: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface TagSuggestion {
  id: number;
  name: string;
  slug: string;
  usage_count: number;
  relevance_score?: number;
}

export interface TagWithTopics extends ForumTag {
  topic_count: number;
  recent_topics?: Array<{
    id: number;
    title: string;
    created_at: string;
  }>;
}

export class ForumTagService {
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(process.cwd(), 'data', 'forums.db');
  }

  /**
   * Get all available tags with usage statistics
   */
  async getAllTags(limit = 50, sortBy: 'name' | 'usage' | 'recent' = 'usage'): Promise<ForumTag[]> {
    let orderClause = 'ORDER BY usage_count DESC';
    if (sortBy === 'name') {
      orderClause = 'ORDER BY name ASC';
    } else if (sortBy === 'recent') {
      orderClause = 'ORDER BY updated_at DESC';
    }

    const result = await dbAdapter.query(
      `
        SELECT * FROM forum_tags
        ${orderClause}
        LIMIT $1
      `,
      [limit],
      { schema: 'forums' }
    );

    return result.rows as ForumTag[];
  }

  /**
   * Search for tags with auto-suggestion
   */
  async searchTags(query: string, limit = 10): Promise<TagSuggestion[]> {
    const searchTerm = `%${query}%`;
    const exactMatch = query;
    const startsWith = `${query}%`;

    const result = await dbAdapter.query(
      `
        SELECT
          id,
          name,
          slug,
          usage_count,
          CASE
            WHEN LOWER(name) = LOWER($1) THEN 100
            WHEN LOWER(name) LIKE LOWER($2) THEN 90
            WHEN LOWER(name) LIKE LOWER($3) THEN 80
            ELSE 70
          END as relevance_score
        FROM forum_tags
        WHERE LOWER(name) LIKE LOWER($4)
        ORDER BY relevance_score DESC, usage_count DESC
        LIMIT $5
      `,
      [exactMatch, startsWith, searchTerm, searchTerm, limit],
      { schema: 'forums' }
    );

    return result.rows as TagSuggestion[];
  }

  /**
   * Get tag by ID
   */
  async getTagById(id: number): Promise<ForumTag | null> {
    const result = await dbAdapter.query('SELECT * FROM forum_tags WHERE id = $1', [id], {
      schema: 'forums',
    });

    return (result.rows[0] as ForumTag) || null;
  }

  /**
   * Get tag by slug
   */
  async getTagBySlug(slug: string): Promise<TagWithTopics | null> {
    // Get tag with topic count
    const tagResult = await dbAdapter.query(
      `
        SELECT
          t.*,
          COUNT(tt.topic_id) as topic_count
        FROM forum_tags t
        LEFT JOIN forum_topic_tags tt ON t.id = tt.tag_id
        WHERE t.slug = $1
        GROUP BY t.id
      `,
      [slug],
      { schema: 'forums' }
    );

    const tag = tagResult.rows[0] as TagWithTopics;
    if (!tag) return null;

    // Get recent topics with this tag
    const topicsResult = await dbAdapter.query(
      `
        SELECT
          ft.id,
          ft.title,
          ft.created_at
        FROM forum_topics ft
        JOIN forum_topic_tags tt ON ft.id = tt.topic_id
        WHERE tt.tag_id = $1
        ORDER BY ft.created_at DESC
        LIMIT 5
      `,
      [tag.id],
      { schema: 'forums' }
    );

    tag.recent_topics = topicsResult.rows as {
      id: number;
      title: string;
      created_at: string;
    }[];

    return tag;
  }

  /**
   * Get tags for a specific topic
   */
  async getTopicTags(topicId: number): Promise<ForumTag[]> {
    try {
      // Check if the forum_topic_tags junction table exists
      const tableCheckResult = await dbAdapter.query(
        `
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'forums' AND table_name = 'forum_topic_tags'
      `,
        [],
        { schema: 'forums' }
      );

      if (tableCheckResult.rows.length === 0) {
        // Table doesn't exist, return empty array
        return [];
      }

      const result = await dbAdapter.query(
        `
        SELECT t.*
        FROM forum_tags t
        JOIN forum_topic_tags tt ON t.id = tt.tag_id
        WHERE tt.topic_id = $1
        ORDER BY t.name ASC
      `,
        [topicId],
        { schema: 'forums' }
      );

      return result.rows as ForumTag[];
    } catch (error) {
      logger.warn('Error getting topic tags:', error);
      return [];
    }
  }

  /**
   * Add tags to a topic
   */
  async addTopicTags(topicId: number, tagIds: number[]): Promise<void> {
    // Check if the forum_topic_tags junction table exists
    const tableCheckResult = await dbAdapter.query(
      `
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'forums' AND table_name = 'forum_topic_tags'
    `,
      [],
      { schema: 'forums' }
    );

    if (tableCheckResult.rows.length === 0) {
      // Table doesn't exist, can't add tags
      logger.warn('forum_topic_tags table does not exist, cannot add tags');
      return;
    }

    await dbAdapter.transaction(
      async adapter => {
        // Remove existing tags
        await adapter.query('DELETE FROM forum_topic_tags WHERE topic_id = $1', [topicId], {
          schema: 'forums',
        });

        // Add new tags
        for (const tagId of tagIds) {
          await adapter.query(
            `
            INSERT INTO forum_topic_tags (topic_id, tag_id)
            VALUES ($1, $2)
          `,
            [topicId, tagId],
            { schema: 'forums' }
          );
        }

        // Update usage counts
        if (tagIds.length > 0) {
          const placeholders = tagIds.map((_, i) => `$${i + 1}`).join(',');
          await adapter.query(
            `
            UPDATE forum_tags
            SET usage_count = (
              SELECT COUNT(*) FROM forum_topic_tags WHERE tag_id = forum_tags.id
            ),
            updated_at = NOW()
            WHERE id IN (${placeholders})
          `,
            tagIds,
            { schema: 'forums' }
          );
        }
      },
      { schema: 'forums' }
    );
  }

  /**
   * Create a new tag
   */
  async createTag(name: string, description?: string, color = '#6B7280'): Promise<ForumTag> {
    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    const result = await dbAdapter.query(
      `
        INSERT INTO forum_tags (name, slug, description, color)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [name, slug, description, color],
      { schema: 'forums' }
    );

    const tagId = result.rows[0].id as number;
    return this.getTagById(tagId) as Promise<ForumTag>;
  }

  /**
   * Get popular tags (most used)
   */
  async getPopularTags(limit = 20): Promise<ForumTag[]> {
    const result = await dbAdapter.query(
      `
        SELECT * FROM forum_tags
        WHERE usage_count > 0
        ORDER BY usage_count DESC, name ASC
        LIMIT $1
      `,
      [limit],
      { schema: 'forums' }
    );

    return result.rows as ForumTag[];
  }

  /**
   * Get trending tags (recently active)
   */
  async getTrendingTags(limit = 10): Promise<TagWithTopics[]> {
    const result = await dbAdapter.query(
      `
        SELECT
          t.*,
          COUNT(tt.topic_id) as topic_count,
          COUNT(CASE WHEN ft.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_usage
        FROM forum_tags t
        LEFT JOIN forum_topic_tags tt ON t.id = tt.tag_id
        LEFT JOIN forum_topics ft ON tt.topic_id = ft.id
        GROUP BY t.id
        HAVING COUNT(CASE WHEN ft.created_at > NOW() - INTERVAL '7 days' THEN 1 END) > 0
        ORDER BY recent_usage DESC, usage_count DESC
        LIMIT $1
      `,
      [limit],
      { schema: 'forums' }
    );

    return result.rows as TagWithTopics[];
  }

  /**
   * Update a tag (name only - matching simplified Wiki Tags)
   */
  async updateTag(id: number, name: string): Promise<ForumTag> {
    // Generate new slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    const result = await dbAdapter.query(
      `
        UPDATE forum_tags
        SET name = $1, slug = $2, updated_at = NOW()
        WHERE id = $3
      `,
      [name, slug, id],
      { schema: 'forums' }
    );

    if (result.rowCount === 0) {
      throw new Error('Tag not found');
    }

    return this.getTagById(id) as Promise<ForumTag>;
  }

  /**
   * Delete a tag
   */
  async deleteTag(id: number): Promise<void> {
    await dbAdapter.transaction(
      async adapter => {
        // Remove tag associations first
        await adapter.query('DELETE FROM forum_topic_tags WHERE tag_id = $1', [id], {
          schema: 'forums',
        });

        // Delete the tag
        const result = await adapter.query('DELETE FROM forum_tags WHERE id = $1', [id], {
          schema: 'forums',
        });

        if (result.rowCount === 0) {
          throw new Error('Tag not found');
        }
      },
      { schema: 'forums' }
    );
  }

  /**
   * Delete multiple tags at once
   */
  async deleteBulkTags(tagIds: number[]): Promise<number> {
    if (tagIds.length === 0) return 0;

    return await dbAdapter.transaction(
      async adapter => {
        // Remove all tag associations
        const placeholders = tagIds.map((_, i) => `$${i + 1}`).join(',');
        await adapter.query(
          `DELETE FROM forum_topic_tags WHERE tag_id IN (${placeholders})`,
          tagIds,
          { schema: 'forums' }
        );

        // Delete the tags
        const result = await adapter.query(
          `DELETE FROM forum_tags WHERE id IN (${placeholders})`,
          tagIds,
          { schema: 'forums' }
        );

        return result.rowCount || 0;
      },
      { schema: 'forums' }
    );
  }

  /**
   * Get related tags (tags that appear together frequently)
   */
  async getRelatedTags(tagId: number, limit = 10): Promise<ForumTag[]> {
    const result = await dbAdapter.query(
      `
        SELECT
          t.*,
          COUNT(*) as co_occurrence
        FROM forum_tags t
        JOIN forum_topic_tags tt1 ON t.id = tt1.tag_id
        JOIN forum_topic_tags tt2 ON tt1.topic_id = tt2.topic_id
        WHERE tt2.tag_id = $1 AND t.id != $2
        GROUP BY t.id
        ORDER BY co_occurrence DESC, t.usage_count DESC
        LIMIT $3
      `,
      [tagId, tagId, limit],
      { schema: 'forums' }
    );

    return result.rows as ForumTag[];
  }

  /**
   * Update tag usage statistics
   */
  async updateTagUsageStats(): Promise<void> {
    await dbAdapter.query(
      `
        UPDATE forum_tags
        SET
          usage_count = (
            SELECT COUNT(*) FROM forum_topic_tags WHERE tag_id = forum_tags.id
          ),
          updated_at = NOW()
      `,
      [],
      { schema: 'forums' }
    );
  }
}

// Singleton instance
export const forumTagService = new ForumTagService();
