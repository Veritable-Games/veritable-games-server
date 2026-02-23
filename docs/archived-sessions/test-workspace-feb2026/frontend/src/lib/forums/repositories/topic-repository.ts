/**
 * Topic Repository
 *
 * Data access layer for forum topics.
 * Handles CRUD operations, moderation actions, and topic queries.
 *
 * Key Operations:
 * - create: Create new topic
 * - findById: Get topic with author info
 * - findByCategory: List topics with pagination
 * - update: Update topic (content, status, etc.)
 * - delete: Delete topic (cascade to replies)
 * - incrementViewCount: Track topic views
 * - pin/lock/markSolved: Moderation actions
 */

import { BaseRepository, RepositoryError } from './base-repository';
import { Result, Ok, Err } from '@/lib/utils/result';
import { dbAdapter } from '@/lib/database/adapter';
import { TopicStatusFlags, hasFlag, addFlag, removeFlag, toBooleans } from '../status-flags';
import type {
  ForumTopic,
  TopicId,
  CategoryId,
  UserId,
  TopicStatus,
  ContentFormat,
  TopicFilterOptions,
  PaginatedResponse,
  PaginationMetadata,
} from '../types';

/**
 * Raw topic row from database
 * Note: After bit flags migration, only 'status' field exists.
 * Boolean fields are computed in transformTopic()
 */
interface TopicRow {
  id: number;
  title: string;
  content: string;
  category_id: number;
  author_id: number;
  view_count: number;
  reply_count: number;
  status: TopicStatus; // INTEGER bit flags
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

/**
 * Create topic data
 */
export interface CreateTopicData {
  title: string;
  content: string;
  category_id: CategoryId;
  author_id: UserId;
}

/**
 * Update topic data
 *
 * Note: Use bit flags for status changes.
 * For moderation actions, prefer ForumModerationService methods.
 */
export interface UpdateTopicData {
  title?: string;
  content?: string;
  category_id?: CategoryId;
  status?: TopicStatus; // Bit flags (use addFlag/removeFlag helpers)
}

/**
 * Options for finding topic by ID
 */
export interface FindByIdOptions {
  include_author?: boolean;
  include_category?: boolean;
  include_tags?: boolean;
}

/**
 * Topic repository for data access
 */
export class TopicRepository extends BaseRepository {
  /**
   * Create a new topic
   */
  async create(data: CreateTopicData): Promise<Result<ForumTopic, RepositoryError>> {
    return this.transaction('createTopic', async () => {
      const { title, content, category_id, author_id } = data;

      // Validate required fields
      if (!title || title.length < 3) {
        throw new Error('Title must be at least 3 characters');
      }
      if (!content || content.length < 1) {
        throw new Error('Content is required');
      }

      const insertResult = await dbAdapter.query(
        `INSERT INTO forum_topics (
          title,
          content,
          category_id,
          user_id,
          created_at,
          updated_at,
          last_activity_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
        RETURNING id`,
        [title, content, category_id, author_id],
        { schema: 'forums' }
      );

      const topicId = insertResult.rows[0].id;

      // Fetch created topic
      const result = await dbAdapter.query(
        `SELECT
          id,
          title,
          content,
          category_id,
          user_id as author_id,
          view_count,
          reply_count,
          status,
          created_at,
          updated_at,
          last_activity_at
        FROM forum_topics
        WHERE id = $1`,
        [topicId],
        { schema: 'forums' }
      );

      return this.transformTopic(result.rows[0]);
    });
  }

  /**
   * Find topic by ID with optional author, category, and tags
   */
  async findById(
    id: TopicId,
    options: FindByIdOptions = {}
  ): Promise<Result<ForumTopic | null, RepositoryError>> {
    return this.execute('findTopicById', async () => {
      const { include_author = true, include_category = false, include_tags = false } = options;

      const result = await dbAdapter.query(
        `SELECT
          id,
          title,
          content,
          category_id,
          user_id as author_id,
          view_count,
          reply_count,
          status,
          created_at,
          updated_at,
          last_activity_at
        FROM forum_topics
        WHERE id = $1`,
        [id],
        { schema: 'forums' }
      );

      if (!result.rows[0]) {
        return null;
      }

      const topic = this.transformTopic(result.rows[0]);

      // Fetch author if requested
      if (include_author) {
        const authorResult = await this.fetchUser(topic.user_id);
        if (authorResult.isOk() && authorResult.value) {
          return {
            ...topic,
            username: authorResult.value.username,
            user_id: authorResult.value.id,
            author: authorResult.value,
          };
        }
      }

      // Note: include_category and include_tags are placeholders for future enhancement
      // Currently, category info is already in the topic, and tags need separate implementation

      return topic;
    });
  }

  /**
   * Find topics by category with pagination and filters
   *
   * Note: Uses boolean columns (is_pinned, is_locked, is_solved) from database,
   * not bit flags. The status column is TEXT ('open', 'closed', etc).
   */
  async findByCategory(
    categoryId: CategoryId,
    options: TopicFilterOptions & { page?: number; limit?: number } = {}
  ): Promise<Result<PaginatedResponse<ForumTopic>, RepositoryError>> {
    return this.execute('findTopicsByCategory', async () => {
      const {
        page = 1,
        limit = 20,
        status,
        pinned_only,
        solved_only,
        locked_only,
        sort_by = 'last_activity_at',
        sort_order = 'desc',
      } = options;

      // Build WHERE clause using boolean columns (production schema)
      const conditions: string[] = ['category_id = $1', 'deleted_at IS NULL'];
      const params: any[] = [categoryId];
      let paramIndex = 2;

      if (status !== undefined) {
        conditions.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }
      if (pinned_only) {
        conditions.push('is_pinned = true');
      }
      if (solved_only) {
        conditions.push('is_solved = true');
      }
      if (locked_only) {
        conditions.push('is_locked = true');
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await dbAdapter.query(
        `SELECT COUNT(*) as count FROM forum_topics WHERE ${whereClause}`,
        params,
        { schema: 'forums' }
      );

      const total = parseInt(countResult.rows[0].count);

      // Get paginated results (pinned first, then by sort_by)
      const offset = (page - 1) * limit;
      const result = await dbAdapter.query(
        `SELECT
            id,
            title,
            content,
            category_id,
            user_id as author_id,
            view_count,
            reply_count,
            is_pinned,
            is_locked,
            is_solved,
            status,
            created_at,
            updated_at,
            last_activity_at
          FROM forum_topics
          WHERE ${whereClause}
          ORDER BY is_pinned DESC, ${sort_by} ${sort_order}
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset],
        { schema: 'forums' }
      );

      const topics = result.rows.map(row => this.transformTopicFromBooleans(row));

      // Fetch authors for all topics
      const authorIds = topics.map(t => t.user_id);
      const authorsResult = await this.fetchUsers(authorIds);
      if (authorsResult.isOk()) {
        const authorsMap = authorsResult.value;
        topics.forEach(topic => {
          const author = authorsMap.get(topic.user_id);
          if (author) {
            topic.author = author;
          }
        });
      }

      // Build pagination metadata
      const pagination: PaginationMetadata = {
        total,
        limit,
        offset,
        hasMore: page * limit < total,
      };

      return {
        success: true,
        data: topics,
        pagination,
      } as PaginatedResponse<ForumTopic>;
    });
  }

  /**
   * Update topic
   */
  async update(id: TopicId, data: UpdateTopicData): Promise<Result<ForumTopic, RepositoryError>> {
    return this.transaction('updateTopic', async () => {
      // Build dynamic UPDATE query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.title !== undefined) {
        updates.push(`title = $${paramIndex}`);
        values.push(data.title);
        paramIndex++;
      }
      if (data.content !== undefined) {
        updates.push(`content = $${paramIndex}`);
        values.push(data.content);
        paramIndex++;
      }
      if (data.category_id !== undefined) {
        updates.push(`category_id = $${paramIndex}`);
        values.push(data.category_id);
        paramIndex++;
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        values.push(data.status);
        paramIndex++;
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push('updated_at = NOW()');
      values.push(id);

      await dbAdapter.query(
        `UPDATE forum_topics SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values,
        { schema: 'forums' }
      );

      // Fetch updated topic
      const result = await dbAdapter.query(
        `SELECT
            id,
            title,
            content,
            category_id,
            user_id as author_id,
            view_count,
            reply_count,
            status,
            created_at,
            updated_at,
            last_activity_at
          FROM forum_topics
          WHERE id = $1`,
        [id],
        { schema: 'forums' }
      );

      return this.transformTopic(result.rows[0]);
    });
  }

  /**
   * Delete topic (cascades to replies via foreign key)
   */
  async delete(id: TopicId): Promise<Result<boolean, RepositoryError>> {
    return this.transaction('deleteTopic', async () => {
      // Delete all replies first (if FK not set up)
      await dbAdapter.query('DELETE FROM forum_replies WHERE topic_id = $1', [id], {
        schema: 'forums',
      });

      // Delete topic
      const result = await dbAdapter.query('DELETE FROM forum_topics WHERE id = $1', [id], {
        schema: 'forums',
      });
      return result.rowCount > 0;
    });
  }

  /**
   * Increment topic view count
   */
  async incrementViewCount(id: TopicId): Promise<Result<void, RepositoryError>> {
    return this.execute('incrementViewCount', async () => {
      await dbAdapter.query(
        'UPDATE forum_topics SET view_count = view_count + 1 WHERE id = $1',
        [id],
        { schema: 'forums' }
      );
    });
  }

  /**
   * Pin or unpin topic
   */
  async pin(id: TopicId, isPinned: boolean): Promise<Result<ForumTopic, RepositoryError>> {
    return this.transaction('pinTopic', async () => {
      // Get current status
      const result = await dbAdapter.query('SELECT status FROM forum_topics WHERE id = $1', [id], {
        schema: 'forums',
      });

      if (!result.rows[0]) {
        throw new Error('Topic not found');
      }

      const currentRow = result.rows[0] as { status: TopicStatus };

      // Add or remove PINNED flag
      const newStatus = isPinned
        ? addFlag(currentRow.status, TopicStatusFlags.PINNED)
        : removeFlag(currentRow.status, TopicStatusFlags.PINNED);

      // Update with new status
      const updateResult = await this.update(id, { status: newStatus });
      if (updateResult.isErr()) {
        const errorMsg =
          'message' in updateResult.error
            ? updateResult.error.message
            : `Failed to update topic (${updateResult.error.type})`;
        throw new Error(errorMsg);
      }
      return updateResult.value;
    });
  }

  /**
   * Lock or unlock topic
   */
  async lock(id: TopicId, isLocked: boolean): Promise<Result<ForumTopic, RepositoryError>> {
    return this.transaction('lockTopic', async () => {
      // Get current status
      const result = await dbAdapter.query('SELECT status FROM forum_topics WHERE id = $1', [id], {
        schema: 'forums',
      });

      if (!result.rows[0]) {
        throw new Error('Topic not found');
      }

      const currentRow = result.rows[0] as { status: TopicStatus };

      // Add or remove LOCKED flag
      const newStatus = isLocked
        ? addFlag(currentRow.status, TopicStatusFlags.LOCKED)
        : removeFlag(currentRow.status, TopicStatusFlags.LOCKED);

      // Update with new status
      const updateResult = await this.update(id, { status: newStatus });
      if (updateResult.isErr()) {
        const errorMsg =
          'message' in updateResult.error
            ? updateResult.error.message
            : `Failed to update topic (${updateResult.error.type})`;
        throw new Error(errorMsg);
      }
      return updateResult.value;
    });
  }

  /**
   * Mark topic as solved
   */
  async markSolved(id: TopicId): Promise<Result<ForumTopic, RepositoryError>> {
    return this.transaction('markTopicSolved', async () => {
      // Get current status
      const result = await dbAdapter.query('SELECT status FROM forum_topics WHERE id = $1', [id], {
        schema: 'forums',
      });

      if (!result.rows[0]) {
        throw new Error('Topic not found');
      }

      const currentRow = result.rows[0] as { status: TopicStatus };

      // Add SOLVED flag
      const newStatus = addFlag(currentRow.status, TopicStatusFlags.SOLVED);

      // Update with new status
      const updateResult = await this.update(id, { status: newStatus });
      if (updateResult.isErr()) {
        const errorMsg =
          'message' in updateResult.error
            ? updateResult.error.message
            : `Failed to update topic (${updateResult.error.type})`;
        throw new Error(errorMsg);
      }
      return updateResult.value;
    });
  }

  /**
   * Update last activity timestamp (called when reply is added)
   */
  async updateLastActivity(id: TopicId): Promise<Result<void, RepositoryError>> {
    return this.execute('updateLastActivity', async () => {
      await dbAdapter.query(
        'UPDATE forum_topics SET last_activity_at = NOW() WHERE id = $1',
        [id],
        { schema: 'forums' }
      );
    });
  }

  /**
   * Update reply count (called when reply is added/removed)
   */
  async updateReplyCount(id: TopicId): Promise<Result<void, RepositoryError>> {
    return this.execute('updateReplyCount', async () => {
      await dbAdapter.query(
        `UPDATE forum_topics
        SET reply_count = (SELECT COUNT(*) FROM forum_replies WHERE topic_id = $1)
        WHERE id = $1`,
        [id],
        { schema: 'forums' }
      );
    });
  }

  /**
   * Get recent topics (for homepage/stats)
   */
  async getRecent(limit: number = 10): Promise<Result<ForumTopic[], RepositoryError>> {
    return this.execute('getRecentTopics', async () => {
      const result = await dbAdapter.query(
        `SELECT
            id,
            title,
            content,
            category_id,
            user_id as author_id,
            view_count,
            reply_count,
            status,
            created_at,
            updated_at,
            last_activity_at
          FROM forum_topics
          ORDER BY created_at DESC
          LIMIT $1`,
        [limit],
        { schema: 'forums' }
      );

      const topics = result.rows.map(row => this.transformTopic(row));

      // Fetch authors
      const authorIds = topics.map(t => t.user_id);
      const authorsResult = await this.fetchUsers(authorIds);
      if (authorsResult.isOk()) {
        const authorsMap = authorsResult.value;
        topics.forEach(topic => {
          const author = authorsMap.get(topic.user_id);
          if (author) {
            topic.author = author;
          }
        });
      }

      return topics;
    });
  }

  /**
   * Transform database row to ForumTopic (bit flags schema)
   */
  private transformTopic(row: TopicRow): ForumTopic {
    return {
      id: row.id as TopicId,
      title: row.title,
      content: row.content,
      // content_format removed - not part of ForumTopic interface (assumed markdown)
      category_id: row.category_id as CategoryId,
      user_id: row.author_id as UserId, // Map author_id (row) to user_id (interface)
      view_count: row.view_count,
      reply_count: row.reply_count,
      // Compute boolean properties from status bit flags
      is_pinned: hasFlag(row.status, TopicStatusFlags.PINNED),
      is_locked: hasFlag(row.status, TopicStatusFlags.LOCKED),
      is_solved: hasFlag(row.status, TopicStatusFlags.SOLVED),
      is_archived: hasFlag(row.status, TopicStatusFlags.ARCHIVED),
      is_featured: hasFlag(row.status, TopicStatusFlags.FEATURED),
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      // last_activity_at removed - ForumTopic uses last_reply_at instead
    };
  }

  /**
   * Transform database row with boolean columns to ForumTopic
   * (Production schema uses separate boolean columns, not bit flags)
   */
  private transformTopicFromBooleans(row: any): ForumTopic {
    return {
      id: row.id as TopicId,
      title: row.title,
      content: row.content,
      category_id: row.category_id as CategoryId,
      user_id: row.author_id as UserId,
      view_count: row.view_count || 0,
      reply_count: row.reply_count || 0,
      // Read directly from boolean columns
      is_pinned: row.is_pinned === true,
      is_locked: row.is_locked === true,
      is_solved: row.is_solved === true,
      is_archived: false, // Not in production schema yet
      is_featured: false, // Not in production schema yet
      status: row.status || 'open',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

/**
 * Export singleton instance
 */
export const topicRepository = new TopicRepository();
