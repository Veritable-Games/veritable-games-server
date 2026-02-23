/**
 * Reply Repository
 *
 * Data access layer for forum replies.
 * Handles CRUD operations, nested replies, and reply tree construction.
 *
 * Key Operations:
 * - create: Create reply with automatic depth calculation
 * - findByTopic: Get all replies for a topic
 * - findById: Get single reply
 * - update: Update reply content
 * - delete: Delete reply (handle cascading)
 * - markAsSolution: Mark reply as solution
 * - getReplyTree: Build nested reply tree structure
 *
 * Important:
 * - Supports up to 5 levels of nesting
 * - Uses materialized path for efficient tree traversal
 * - Automatically calculates reply depth
 */

import { BaseRepository, RepositoryError } from './base-repository';
import { Result, Ok, Err } from '@/lib/utils/result';
import { dbAdapter } from '@/lib/database/adapter';
import { TopicStatusFlags, addFlag } from '../status-flags';
import type {
  ForumReply,
  ReplyId,
  TopicId,
  UserId,
  ContentFormat,
  ReplyFilterOptions,
} from '../types';

/**
 * Raw reply row from database
 */
interface ReplyRow {
  id: number;
  topic_id: number;
  parent_id: number | null;
  author_id: number;
  content: string;
  depth: number;
  path: string;
  is_solution: number;
  created_at: string;
  updated_at: string;
  last_edited_at: string | null;
  last_edited_by: number | null;
}

/**
 * Create reply data
 */
export interface CreateReplyData {
  topic_id: TopicId;
  parent_id: ReplyId | null;
  author_id: UserId;
  content: string;
}

/**
 * Update reply data
 */
export interface UpdateReplyData {
  content?: string;
  is_solution?: boolean;
}

/**
 * Maximum reply nesting depth
 */
const MAX_REPLY_DEPTH = 5;

/**
 * Reply repository for data access
 */
export class ReplyRepository extends BaseRepository {
  /**
   * Create a new reply with automatic depth calculation
   */
  async create(data: CreateReplyData): Promise<Result<ForumReply, RepositoryError>> {
    return this.transaction('createReply', async () => {
      const { topic_id, parent_id, author_id, content } = data;

      // Validate content
      if (!content || content.length < 1) {
        throw new Error('Reply content cannot be empty');
      }

      let depth = 0;
      let path = '';

      if (parent_id) {
        // Get parent reply to calculate depth and path
        const parentResult = await dbAdapter.query(
          'SELECT id, reply_depth as depth, path FROM forum_replies WHERE id = $1 AND topic_id = $2',
          [parent_id, topic_id],
          { schema: 'forums' }
        );

        const parent = parentResult.rows[0] as
          | { id: number; depth: number; path: string }
          | undefined;

        if (!parent) {
          throw new Error('Parent reply not found or belongs to different topic');
        }

        depth = parent.depth + 1;

        // Enforce max depth
        if (depth > MAX_REPLY_DEPTH) {
          throw new Error(`Maximum reply depth of ${MAX_REPLY_DEPTH} exceeded`);
        }

        // Build materialized path
        path = parent.path ? `${parent.path}/${parent.id}` : String(parent.id);
      }

      // Insert reply
      const insertResult = await dbAdapter.query(
        `INSERT INTO forum_replies (
          topic_id,
          parent_id,
          user_id,
          content,
          reply_depth,
          path,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id`,
        [topic_id, parent_id, author_id, content, depth, path],
        { schema: 'forums' }
      );

      const replyId = insertResult.rows[0].id;

      // Update materialized path to include self
      const selfPath = path ? `${path}/${replyId}` : String(replyId);
      await dbAdapter.query(
        'UPDATE forum_replies SET path = $1 WHERE id = $2',
        [selfPath, replyId],
        { schema: 'forums' }
      );

      // Update topic reply count and last activity
      await dbAdapter.query(
        `UPDATE forum_topics
        SET reply_count = reply_count + 1,
            last_activity_at = NOW()
        WHERE id = $1`,
        [topic_id],
        { schema: 'forums' }
      );

      // Fetch created reply
      const result = await dbAdapter.query(
        `SELECT
          id,
          topic_id,
          parent_id,
          user_id as author_id,
          content,
          reply_depth as depth,
          path,
          is_solution,
          created_at,
          updated_at,
          last_edited_at,
          last_edited_by
        FROM forum_replies
        WHERE id = $1`,
        [replyId],
        { schema: 'forums' }
      );

      return this.transformReply(result.rows[0]);
    });
  }

  /**
   * Find reply by ID with optional author info
   */
  async findById(
    id: ReplyId,
    includeAuthor: boolean = true
  ): Promise<Result<ForumReply | null, RepositoryError>> {
    return this.execute('findReplyById', async () => {
      const result = await dbAdapter.query(
        `SELECT
          id,
          topic_id,
          parent_id,
          user_id as author_id,
          content,
          reply_depth as depth,
          path,
          is_solution,
          created_at,
          updated_at,
          last_edited_at,
          last_edited_by
        FROM forum_replies
        WHERE id = $1`,
        [id],
        { schema: 'forums' }
      );

      if (!result.rows[0]) {
        return null;
      }

      const reply = this.transformReply(result.rows[0]);

      // Fetch author if requested
      if (includeAuthor) {
        const authorResult = await this.fetchUser(reply.user_id);
        if (authorResult.isOk() && authorResult.value) {
          return {
            ...reply,
            username: authorResult.value.username,
            user_id: authorResult.value.id,
            author: authorResult.value,
          };
        }
      }

      return reply;
    });
  }

  /**
   * Find all replies for a topic (flat list, ordered by path)
   */
  async findByTopic(
    topicId: TopicId,
    options: ReplyFilterOptions = {}
  ): Promise<Result<ForumReply[], RepositoryError>> {
    return this.execute('findRepliesByTopic', async () => {
      const {
        max_depth,
        solutions_only,
        sort_by = 'path',
        sort_order = 'asc',
        current_user_id,
      } = options;

      // Build WHERE clause
      const conditions: string[] = ['r.topic_id = $1'];
      const params: any[] = [topicId];
      let paramIndex = 2;

      if (max_depth !== undefined) {
        conditions.push(`r.reply_depth <= $${paramIndex++}`);
        params.push(max_depth);
      }
      if (solutions_only) {
        conditions.push('r.is_solution = 1');
      }

      const whereClause = conditions.join(' AND ');

      // Build vote columns
      const voteColumns = current_user_id
        ? `,
          COALESCE(r.vote_count, 0) as vote_count,
          v.vote_type as user_vote`
        : `,
          COALESCE(r.vote_count, 0) as vote_count,
          NULL as user_vote`;

      // Build FROM clause with optional vote join
      const fromClause = current_user_id
        ? `FROM forum_replies r
          LEFT JOIN forum_votes v ON v.reply_id = r.id AND v.user_id = $${paramIndex++}`
        : `FROM forum_replies r`;

      if (current_user_id) {
        params.push(current_user_id);
      }

      // Fetch replies
      const result = await dbAdapter.query(
        `SELECT
          r.id,
          r.topic_id,
          r.parent_id,
          r.user_id as author_id,
          r.content,
          r.reply_depth as depth,
          r.path,
          r.is_solution,
          r.created_at,
          r.updated_at,
          r.last_edited_at,
          r.last_edited_by${voteColumns}
        ${fromClause}
        WHERE ${whereClause}
        ORDER BY r.${sort_by} ${sort_order}`,
        params,
        { schema: 'forums' }
      );

      const replies = result.rows.map(row => this.transformReply(row));

      // Fetch authors for all replies
      const authorIds = replies.map(r => r.user_id);
      const authorsResult = await this.fetchUsers(authorIds);
      if (authorsResult.isOk()) {
        const authorsMap = authorsResult.value;
        replies.forEach(reply => {
          const author = authorsMap.get(reply.user_id);
          if (author) {
            reply.author = author;
            reply.username = author.username;
            reply.user_id = author.id;
          }
        });
      }

      return replies;
    });
  }

  /**
   * Build nested reply tree structure
   *
   * Returns replies organized hierarchically with children arrays.
   * Efficient for rendering nested comment threads.
   */
  async getReplyTree(
    topicId: TopicId,
    options: { maxDepth?: number; currentUserId?: UserId } = {}
  ): Promise<Result<ForumReply[], RepositoryError>> {
    const { maxDepth, currentUserId } = options;
    const repliesResult = await this.findByTopic(topicId, {
      max_depth: maxDepth,
      current_user_id: currentUserId,
    });

    if (repliesResult.isErr()) {
      return repliesResult;
    }

    const replies = repliesResult.value;

    // Build tree structure
    const replyMap = new Map<ReplyId, ForumReply & { children: ForumReply[] }>();
    const rootReplies: (ForumReply & { children: ForumReply[] })[] = [];

    // First pass: Create map of all replies with children array
    for (const reply of replies) {
      replyMap.set(reply.id, { ...reply, children: [] });
    }

    // Second pass: Build tree structure
    for (const reply of replies) {
      const replyWithChildren = replyMap.get(reply.id)!;

      if (reply.parent_id === null) {
        // Root-level reply
        rootReplies.push(replyWithChildren);
      } else if (reply.parent_id) {
        // Nested reply - add to parent's children
        const parent = replyMap.get(reply.parent_id);
        if (parent) {
          parent.children.push(replyWithChildren);
        } else {
          // Parent not found (shouldn't happen with valid data)
          // Treat as root-level
          rootReplies.push(replyWithChildren);
        }
      }
    }

    return Ok(rootReplies as ForumReply[]);
  }

  /**
   * Update reply content
   */
  async update(id: ReplyId, data: UpdateReplyData): Promise<Result<ForumReply, RepositoryError>> {
    return this.transaction('updateReply', async () => {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.content !== undefined) {
        updates.push(`content = $${paramIndex++}`);
        values.push(data.content);
        updates.push('last_edited_at = NOW()');
      }

      if (data.is_solution !== undefined) {
        updates.push(`is_solution = $${paramIndex++}`);
        values.push(data.is_solution ? 1 : 0);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push('updated_at = NOW()');
      values.push(id);

      await dbAdapter.query(
        `UPDATE forum_replies SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values,
        { schema: 'forums' }
      );

      // Fetch updated reply
      const result = await dbAdapter.query(
        `SELECT
          id,
          topic_id,
          parent_id,
          user_id as author_id,
          content,
          reply_depth as depth,
          path,
          is_solution,
          created_at,
          updated_at,
          last_edited_at,
          last_edited_by
        FROM forum_replies
        WHERE id = $1`,
        [id],
        { schema: 'forums' }
      );

      return this.transformReply(result.rows[0]);
    });
  }

  /**
   * Delete reply and all its children (recursive)
   */
  async delete(id: ReplyId): Promise<Result<boolean, RepositoryError>> {
    return this.transaction('deleteReply', async () => {
      // Get reply info before deletion
      const replyResult = await dbAdapter.query(
        'SELECT id, topic_id, path FROM forum_replies WHERE id = $1',
        [id],
        { schema: 'forums' }
      );

      const reply = replyResult.rows[0] as
        | { id: number; topic_id: number; path: string }
        | undefined;

      if (!reply) {
        return false;
      }

      // Delete all child replies (those whose path starts with this reply's path)
      await dbAdapter.query(
        "DELETE FROM forum_replies WHERE path LIKE $1 || '/%' OR path = $2",
        [reply.path, reply.path],
        { schema: 'forums' }
      );

      // Delete the reply itself
      const result = await dbAdapter.query('DELETE FROM forum_replies WHERE id = $1', [id], {
        schema: 'forums',
      });

      // Update topic reply count
      await dbAdapter.query(
        `UPDATE forum_topics
        SET reply_count = (SELECT COUNT(*) FROM forum_replies WHERE topic_id = $1)
        WHERE id = $2`,
        [reply.topic_id, reply.topic_id],
        { schema: 'forums' }
      );

      return result.rowCount > 0;
    });
  }

  /**
   * Mark reply as solution
   */
  async markAsSolution(id: ReplyId): Promise<Result<ForumReply, RepositoryError>> {
    return this.transaction('markReplyAsSolution', async () => {
      // Get topic_id first
      const replyResult = await dbAdapter.query(
        'SELECT topic_id FROM forum_replies WHERE id = $1',
        [id],
        { schema: 'forums' }
      );

      const reply = replyResult.rows[0] as { topic_id: number } | undefined;

      if (!reply) {
        throw new Error('Reply not found');
      }

      // Unmark any existing solutions in this topic
      await dbAdapter.query(
        'UPDATE forum_replies SET is_solution = 0 WHERE topic_id = $1',
        [reply.topic_id],
        { schema: 'forums' }
      );

      // Mark this reply as solution
      await dbAdapter.query(
        'UPDATE forum_replies SET is_solution = 1, updated_at = NOW() WHERE id = $1',
        [id],
        { schema: 'forums' }
      );

      // Mark topic as solved by adding SOLVED bit flag (4)
      const topicResult = await dbAdapter.query(
        'SELECT status FROM forum_topics WHERE id = $1',
        [reply.topic_id],
        { schema: 'forums' }
      );

      const topicRow = topicResult.rows[0] as { status: number } | undefined;
      if (topicRow) {
        const newStatus = addFlag(topicRow.status, TopicStatusFlags.SOLVED);
        await dbAdapter.query(
          'UPDATE forum_topics SET status = $1, updated_at = NOW() WHERE id = $2',
          [newStatus, reply.topic_id],
          { schema: 'forums' }
        );
      }

      // Fetch updated reply
      const result = await dbAdapter.query(
        `SELECT
          id,
          topic_id,
          parent_id,
          user_id as author_id,
          content,
          reply_depth as depth,
          path,
          is_solution,
          created_at,
          updated_at,
          last_edited_at,
          last_edited_by
        FROM forum_replies
        WHERE id = $1`,
        [id],
        { schema: 'forums' }
      );

      return this.transformReply(result.rows[0]);
    });
  }

  /**
   * Clear all solution marks for a topic
   * Used when admin marks topic as unsolved
   */
  async clearTopicSolutions(topicId: TopicId): Promise<Result<boolean, RepositoryError>> {
    return this.execute('clearTopicSolutions', async () => {
      await dbAdapter.query(
        'UPDATE forum_replies SET is_solution = 0, updated_at = NOW() WHERE topic_id = $1',
        [topicId],
        { schema: 'forums' }
      );
      return true;
    });
  }

  /**
   * Get recent replies (for homepage/stats)
   */
  async getRecent(limit: number = 10): Promise<Result<ForumReply[], RepositoryError>> {
    return this.execute('getRecentReplies', async () => {
      const result = await dbAdapter.query(
        `SELECT
          id,
          topic_id,
          parent_id,
          user_id as author_id,
          content,
          reply_depth as depth,
          path,
          is_solution,
          created_at,
          updated_at,
          last_edited_at,
          last_edited_by
        FROM forum_replies
        ORDER BY created_at DESC
        LIMIT $1`,
        [limit],
        { schema: 'forums' }
      );

      const replies = result.rows.map(row => this.transformReply(row));

      // Fetch authors
      const authorIds = replies.map(r => r.user_id);
      const authorsResult = await this.fetchUsers(authorIds);
      if (authorsResult.isOk()) {
        const authorsMap = authorsResult.value;
        replies.forEach(reply => {
          const author = authorsMap.get(reply.user_id);
          if (author) {
            reply.author = author;
          }
        });
      }

      return replies;
    });
  }

  /**
   * Get reply count for a topic
   */
  async countByTopic(topicId: TopicId): Promise<Result<number, RepositoryError>> {
    return this.execute('countRepliesByTopic', async () => {
      const result = await dbAdapter.query(
        'SELECT COUNT(*) as count FROM forum_replies WHERE topic_id = $1',
        [topicId],
        { schema: 'forums' }
      );

      return result.rows[0].count;
    });
  }

  /**
   * Transform database row to ForumReply
   */
  private transformReply(row: ReplyRow): ForumReply {
    return {
      id: row.id as ReplyId,
      topic_id: row.topic_id as TopicId,
      parent_id: row.parent_id ? (row.parent_id as ReplyId) : undefined,
      user_id: row.author_id as UserId, // Map author_id (row) to user_id (interface)
      content: row.content,
      // content_format removed - not part of ForumReply interface (assumed markdown)
      reply_depth: row.depth, // Map database 'depth' to interface 'reply_depth'
      // path removed - not part of ForumReply interface (internal DB field)
      is_solution: Boolean(row.is_solution),
      created_at: row.created_at,
      updated_at: row.updated_at,
      children: [], // Empty array, tree structure built elsewhere
    };
  }
}

/**
 * Export singleton instance
 */
export const replyRepository = new ReplyRepository();
