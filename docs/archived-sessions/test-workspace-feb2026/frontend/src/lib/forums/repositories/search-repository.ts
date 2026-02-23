/**
 * Search Repository
 *
 * Data access layer for forum search using SQLite FTS5 (Full-Text Search).
 * Handles search queries, autocomplete, and result ranking.
 *
 * Key Operations:
 * - searchTopics: Search topics with FTS5
 * - searchReplies: Search replies with FTS5
 * - searchAll: Search both topics and replies
 * - getSearchSuggestions: Autocomplete suggestions
 *
 * FTS5 Features:
 * - Porter stemming (e.g., "running" matches "run")
 * - Unicode normalization with diacritic removal
 * - BM25 relevance ranking
 * - Phrase queries ("exact match")
 * - Boolean operators (AND, OR, NOT)
 *
 * Query Syntax:
 * - Simple: "rust programming"
 * - Phrase: '"exact match"'
 * - Boolean: "rust AND programming"
 * - Exclude: "rust NOT javascript"
 * - Prefix: "prog*" (matches "programming", "program", etc.)
 */

import { BaseRepository, RepositoryError } from './base-repository';
import { Result, Ok } from '@/lib/utils/result';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import type {
  ForumTopic,
  ForumReply,
  TopicId,
  CategoryId,
  UserId,
  SearchResultDTO,
  SearchScope,
  PaginatedResponse,
  PaginationMetadata,
} from '../types';

/**
 * Raw FTS5 search result
 */
interface FTS5SearchResult {
  content_id: number;
  content_type: 'topic' | 'reply';
  title: string | null;
  content: string;
  author_username: string;
  category_name: string;
  category_id: number;
  created_at: string;
  vote_score: number;
  topic_id: number;
  is_locked: number;
  is_pinned: number;
  is_solved: number;
  is_archived: number;
  rank: number; // BM25 relevance score
  view_count?: number; // From JOIN with forum_topics
  reply_count?: number; // From JOIN with forum_topics
}

/**
 * Database query result for suggestion
 */
interface SuggestionRow {
  suggestion: string;
}

/**
 * Database query result for popular terms
 */
interface PopularTermRow {
  title: string;
}

/**
 * Search options
 */
export interface SearchOptions {
  scope?: SearchScope;
  category_id?: CategoryId;
  tags?: string[]; // Filter by tag names
  page?: number;
  limit?: number;
  sort_by?: 'relevance' | 'recent' | 'popular' | 'replies' | 'views';
  userRole?: 'admin' | 'moderator' | 'user' | 'anonymous';
}

/**
 * Search repository for FTS5 operations
 */
export class SearchRepository extends BaseRepository {
  /**
   * Search topics using FTS5
   */
  async searchTopics(
    query: string,
    options: SearchOptions = {}
  ): Promise<Result<PaginatedResponse<SearchResultDTO>, RepositoryError>> {
    return this.execute('searchTopics', async () => {
      const {
        page = 1,
        limit = 20,
        category_id,
        tags,
        sort_by = 'relevance',
        userRole = 'anonymous',
      } = options;

      // Sanitize and prepare FTS5 query
      const ftsQuery = this.prepareFTS5Query(query);

      // Build WHERE clause
      const conditions: string[] = ["fts.content_type = 'topic'"];
      const params: (string | number)[] = [ftsQuery];
      let paramIndex = 2;

      if (category_id) {
        conditions.push(`fts.category_id = $${paramIndex++}`);
        params.push(category_id);
      }

      // Add tag filtering
      if (tags && tags.length > 0) {
        const tagPlaceholders = tags.map(() => `$${paramIndex++}`).join(',');
        conditions.push(`fts.content_id IN (
          SELECT topic_id FROM forum_topic_tags
          WHERE tag_id IN (SELECT id FROM forum_tags WHERE name IN (${tagPlaceholders}))
        )`);
        params.push(...tags);
      }

      // Add visibility filter: only admins see hidden categories
      if (userRole !== 'admin') {
        conditions.push('c.is_public = 1');
      }

      const whereClause = conditions.join(' AND ');

      // Determine sort order (always JOIN with topics to get view_count/reply_count)
      let orderBy = 'fts.rank ASC'; // BM25 rank (lower = more relevant)

      if (sort_by === 'recent') {
        orderBy = 'fts.created_at DESC';
      } else if (sort_by === 'popular' || sort_by === 'views') {
        orderBy = 't.view_count DESC';
      } else if (sort_by === 'replies') {
        orderBy = 't.reply_count DESC';
      }

      // Count total results
      const countResult = await dbAdapter.query(
        `SELECT COUNT(*) as count
        FROM forum_search_fts fts
        INNER JOIN forum_categories c ON fts.category_id = c.id
        WHERE forum_search_fts MATCH $1
        AND ${whereClause}`,
        params,
        { schema: 'forums' }
      );

      const total = countResult.rows[0].count;

      // Get paginated results (always JOIN with forum_topics for view/reply counts)
      const offset = (page - 1) * limit;
      const rows = await dbAdapter.query(
        `SELECT
          fts.content_id,
          fts.content_type,
          fts.title,
          fts.content,
          fts.author_username,
          fts.category_name,
          fts.category_id,
          fts.created_at,
          fts.vote_score,
          fts.topic_id,
          fts.is_locked,
          fts.is_pinned,
          fts.is_solved,
          fts.is_archived,
          fts.rank,
          t.view_count,
          t.reply_count
        FROM forum_search_fts fts
        INNER JOIN forum_categories c ON fts.category_id = c.id
        INNER JOIN forum_topics t ON fts.content_id = t.id
        WHERE forum_search_fts MATCH $1
        AND ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset],
        { schema: 'forums' }
      );

      // Get user IDs from forum_topics table
      const userIds = new Set<number>();
      for (const row of rows.rows) {
        // Get user_id from the topic
        const topicResult = await dbAdapter.query(
          'SELECT user_id FROM forum_topics WHERE id = $1',
          [row.content_id],
          { schema: 'forums' }
        );
        const topic = topicResult.rows[0] as { user_id: number } | undefined;
        if (topic) {
          userIds.add(topic.user_id);
        }
      }

      // Batch fetch usernames from users database
      const userMap = await this.fetchUsers(Array.from(userIds) as UserId[]);
      if (userMap.isErr()) {
        // If user fetch fails, proceed with 'unknown' usernames
        logger.error('Failed to fetch users for search results:', userMap.error);
      }

      const users = userMap.isOk() ? userMap.value : new Map();

      // Transform to SearchResultDTO with actual usernames
      const results = await Promise.all(
        (rows.rows as FTS5SearchResult[]).map(async (row: FTS5SearchResult) => {
          const topicResult = await dbAdapter.query(
            'SELECT user_id FROM forum_topics WHERE id = $1',
            [row.content_id],
            { schema: 'forums' }
          );
          const topic = topicResult.rows[0] as { user_id: number } | undefined;
          const user = topic ? users.get(topic.user_id as UserId) : null;
          const authorUsername = user?.username || user?.display_name || 'unknown';

          return this.transformSearchResult(row, query, authorUsername);
        })
      );

      // Build pagination metadata
      const pagination: PaginationMetadata = {
        limit,
        total,
        offset,
        hasMore: page * limit < total,
      };

      return {
        success: true,
        data: results,
        pagination,
      };
    });
  }

  /**
   * Search replies using FTS5
   */
  async searchReplies(
    query: string,
    options: SearchOptions = {}
  ): Promise<Result<PaginatedResponse<SearchResultDTO>, RepositoryError>> {
    return this.execute('searchReplies', async () => {
      const {
        page = 1,
        limit = 20,
        category_id,
        tags,
        sort_by = 'relevance',
        userRole = 'anonymous',
      } = options;

      const ftsQuery = this.prepareFTS5Query(query);

      // Build WHERE clause
      const conditions: string[] = ["fts.content_type = 'reply'"];
      const params: (string | number)[] = [ftsQuery];
      let paramIndex = 2;

      if (category_id) {
        conditions.push(`fts.category_id = $${paramIndex++}`);
        params.push(category_id);
      }

      // Add tag filtering (filter replies by parent topic's tags)
      if (tags && tags.length > 0) {
        const tagPlaceholders = tags.map(() => `$${paramIndex++}`).join(',');
        conditions.push(`fts.topic_id IN (
          SELECT topic_id FROM forum_topic_tags
          WHERE tag_id IN (SELECT id FROM forum_tags WHERE name IN (${tagPlaceholders}))
        )`);
        params.push(...tags);
      }

      // Add visibility filter: only admins see hidden categories
      if (userRole !== 'admin') {
        conditions.push('c.is_public = 1');
      }

      const whereClause = conditions.join(' AND ');

      // Determine sort order (replies are simpler - no view_count/reply_count)
      let orderBy = 'fts.rank ASC';
      if (sort_by === 'recent') {
        orderBy = 'fts.created_at DESC';
      }
      // For replies, 'popular', 'views', 'replies' all fall back to recent
      else if (sort_by === 'popular' || sort_by === 'views' || sort_by === 'replies') {
        orderBy = 'fts.created_at DESC';
      }

      // Count total results
      const countResult = await dbAdapter.query(
        `SELECT COUNT(*) as count
        FROM forum_search_fts fts
        INNER JOIN forum_categories c ON fts.category_id = c.id
        WHERE forum_search_fts MATCH $1
        AND ${whereClause}`,
        params,
        { schema: 'forums' }
      );

      const total = countResult.rows[0].count;

      // Get paginated results
      const offset = (page - 1) * limit;
      const rows = await dbAdapter.query(
        `SELECT
          fts.content_id,
          fts.content_type,
          fts.title,
          fts.content,
          fts.author_username,
          fts.category_name,
          fts.category_id,
          fts.created_at,
          fts.vote_score,
          fts.topic_id,
          fts.is_locked,
          fts.is_pinned,
          fts.is_solved,
          fts.is_archived,
          fts.rank
        FROM forum_search_fts fts
        INNER JOIN forum_categories c ON fts.category_id = c.id
        WHERE forum_search_fts MATCH $1
        AND ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset],
        { schema: 'forums' }
      );

      // Get user IDs from forum_replies table
      const userIds = new Set<number>();
      for (const row of rows.rows) {
        const replyResult = await dbAdapter.query(
          'SELECT user_id FROM forum_replies WHERE id = $1',
          [row.content_id],
          { schema: 'forums' }
        );
        const reply = replyResult.rows[0] as { user_id: number } | undefined;
        if (reply) {
          userIds.add(reply.user_id);
        }
      }

      // Batch fetch usernames from users database
      const userMap = await this.fetchUsers(Array.from(userIds) as UserId[]);
      if (userMap.isErr()) {
        logger.error('Failed to fetch users for search results:', userMap.error);
      }

      const users = userMap.isOk() ? userMap.value : new Map();

      // Transform to SearchResultDTO with actual usernames
      const results = await Promise.all(
        (rows.rows as FTS5SearchResult[]).map(async (row: FTS5SearchResult) => {
          const replyResult = await dbAdapter.query(
            'SELECT user_id FROM forum_replies WHERE id = $1',
            [row.content_id],
            { schema: 'forums' }
          );
          const reply = replyResult.rows[0] as { user_id: number } | undefined;
          const user = reply ? users.get(reply.user_id as UserId) : null;
          const authorUsername = user?.username || user?.display_name || 'unknown';

          return this.transformSearchResult(row, query, authorUsername);
        })
      );

      const pagination: PaginationMetadata = {
        limit,
        total,
        offset,
        hasMore: page * limit < total,
      };

      return {
        success: true,
        data: results,
        pagination,
      };
    });
  }

  /**
   * Search both topics and replies
   */
  async searchAll(
    query: string,
    options: SearchOptions = {}
  ): Promise<Result<PaginatedResponse<SearchResultDTO>, RepositoryError>> {
    return this.execute('searchAll', async () => {
      const {
        page = 1,
        limit = 20,
        category_id,
        tags,
        sort_by = 'relevance',
        userRole = 'anonymous',
      } = options;

      const ftsQuery = this.prepareFTS5Query(query);

      // Build WHERE clause
      const conditions: string[] = [];
      const params: (string | number)[] = [ftsQuery];
      let paramIndex = 2;

      if (category_id) {
        conditions.push(`fts.category_id = $${paramIndex++}`);
        params.push(category_id);
      }

      // Add tag filtering (applies to both topics and replies via topic_id)
      if (tags && tags.length > 0) {
        const tagPlaceholders = tags.map(() => `$${paramIndex++}`).join(',');
        conditions.push(`(
          (fts.content_type = 'topic' AND fts.content_id IN (
            SELECT topic_id FROM forum_topic_tags
            WHERE tag_id IN (SELECT id FROM forum_tags WHERE name IN (${tagPlaceholders}))
          ))
          OR
          (fts.content_type = 'reply' AND fts.topic_id IN (
            SELECT topic_id FROM forum_topic_tags
            WHERE tag_id IN (SELECT id FROM forum_tags WHERE name IN (${tagPlaceholders}))
          ))
        )`);
        params.push(...tags);
        // Add tags again for the second occurrence in the OR clause
        params.push(...tags);
        paramIndex += tags.length; // Account for the duplicate tags
      }

      // Add visibility filter: only admins see hidden categories
      if (userRole !== 'admin') {
        conditions.push('c.is_public = 1');
      }

      const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

      // Determine sort order
      let orderBy = 'fts.rank ASC';
      let needsTopicJoin = false;

      if (sort_by === 'recent') {
        orderBy = 'fts.created_at DESC';
      } else if (sort_by === 'popular' || sort_by === 'views') {
        // For mixed results, use LEFT JOIN and COALESCE for topics' view_count
        orderBy = 'COALESCE(t.view_count, 0) DESC, fts.created_at DESC';
        needsTopicJoin = true;
      } else if (sort_by === 'replies') {
        orderBy = 'COALESCE(t.reply_count, 0) DESC, fts.created_at DESC';
        needsTopicJoin = true;
      }

      // Build JOIN clause (LEFT JOIN for mixed results - replies won't have topic data)
      const topicJoin = needsTopicJoin
        ? "LEFT JOIN forum_topics t ON fts.content_type = 'topic' AND fts.content_id = t.id"
        : '';

      // Count total results
      const countResult = await dbAdapter.query(
        `SELECT COUNT(*) as count
        FROM forum_search_fts fts
        INNER JOIN forum_categories c ON fts.category_id = c.id
        WHERE forum_search_fts MATCH $1
        ${whereClause}`,
        params,
        { schema: 'forums' }
      );

      const total = countResult.rows[0].count;

      // Get paginated results
      const offset = (page - 1) * limit;
      const rows = await dbAdapter.query(
        `SELECT
          fts.content_id,
          fts.content_type,
          fts.title,
          fts.content,
          fts.author_username,
          fts.category_name,
          fts.category_id,
          fts.created_at,
          fts.vote_score,
          fts.topic_id,
          fts.is_locked,
          fts.is_pinned,
          fts.is_solved,
          fts.is_archived,
          fts.rank
        FROM forum_search_fts fts
        INNER JOIN forum_categories c ON fts.category_id = c.id
        ${topicJoin}
        WHERE forum_search_fts MATCH $1
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset],
        { schema: 'forums' }
      );

      // Get user IDs from both topics and replies
      const userIds = new Set<number>();
      for (const row of rows.rows) {
        if (row.content_type === 'topic') {
          const topicResult = await dbAdapter.query(
            'SELECT user_id FROM forum_topics WHERE id = $1',
            [row.content_id],
            { schema: 'forums' }
          );
          const topic = topicResult.rows[0] as { user_id: number } | undefined;
          if (topic) userIds.add(topic.user_id);
        } else {
          const replyResult = await dbAdapter.query(
            'SELECT user_id FROM forum_replies WHERE id = $1',
            [row.content_id],
            { schema: 'forums' }
          );
          const reply = replyResult.rows[0] as { user_id: number } | undefined;
          if (reply) userIds.add(reply.user_id);
        }
      }

      // Batch fetch usernames from users database
      const userMap = await this.fetchUsers(Array.from(userIds) as UserId[]);
      if (userMap.isErr()) {
        logger.error('Failed to fetch users for search results:', userMap.error);
      }

      const users = userMap.isOk() ? userMap.value : new Map();

      // Transform to SearchResultDTO with actual usernames
      const results = await Promise.all(
        (rows.rows as FTS5SearchResult[]).map(async (row: FTS5SearchResult) => {
          let user = null;
          if (row.content_type === 'topic') {
            const topicResult = await dbAdapter.query(
              'SELECT user_id FROM forum_topics WHERE id = $1',
              [row.content_id],
              { schema: 'forums' }
            );
            const topic = topicResult.rows[0] as { user_id: number } | undefined;
            user = topic ? users.get(topic.user_id as UserId) : null;
          } else {
            const replyResult = await dbAdapter.query(
              'SELECT user_id FROM forum_replies WHERE id = $1',
              [row.content_id],
              { schema: 'forums' }
            );
            const reply = replyResult.rows[0] as { user_id: number } | undefined;
            user = reply ? users.get(reply.user_id as UserId) : null;
          }
          const authorUsername = user?.username || user?.display_name || 'unknown';

          return this.transformSearchResult(row, query, authorUsername);
        })
      );

      const pagination: PaginationMetadata = {
        limit,
        total,
        offset,
        hasMore: page * limit < total,
      };

      return {
        success: true,
        data: results,
        pagination,
      };
    });
  }

  /**
   * Get search suggestions (autocomplete)
   *
   * Returns topic titles and reply content snippets that match the prefix.
   * Useful for search-as-you-type functionality.
   */
  async getSearchSuggestions(
    prefix: string,
    limit: number = 10
  ): Promise<Result<string[], RepositoryError>> {
    return this.execute('getSearchSuggestions', async () => {
      if (!prefix || prefix.length < 2) {
        return [];
      }

      // Use FTS5 prefix matching (term*)
      const ftsQuery = `${this.escapeFTS5(prefix)}*`;

      const rows = await dbAdapter.query(
        `SELECT DISTINCT
          CASE
            WHEN content_type = 'topic' THEN title
            ELSE substr(content, 1, 100)
          END as suggestion
        FROM forum_search_fts
        WHERE forum_search_fts MATCH $1
        ORDER BY rank ASC
        LIMIT $2`,
        [ftsQuery, limit],
        { schema: 'forums' }
      );

      return (rows.rows as SuggestionRow[])
        .map((row: SuggestionRow) => row.suggestion)
        .filter((s: string) => s && s.length > 0);
    });
  }

  /**
   * Get popular search terms (based on existing content)
   *
   * Returns most common words/phrases from topic titles.
   * Useful for trending topics or search suggestions.
   */
  async getPopularTerms(limit: number = 10): Promise<Result<string[], RepositoryError>> {
    return this.execute('getPopularTerms', async () => {
      // This is a simplified version - in production you'd track actual search queries
      const rows = await dbAdapter.query(
        `SELECT title
        FROM forum_search_fts
        WHERE content_type = 'topic'
        ORDER BY vote_score DESC, rank ASC
        LIMIT $1`,
        [limit],
        { schema: 'forums' }
      );

      return (rows.rows as PopularTermRow[]).map((row: PopularTermRow) => row.title);
    });
  }

  /**
   * Prepare FTS5 query (escape special characters, add wildcards)
   */
  private prepareFTS5Query(query: string): string {
    // Remove leading/trailing whitespace
    query = query.trim();

    // If query is empty, return match-all
    if (!query) {
      return '*';
    }

    // If query contains quotes, assume user wants phrase search
    if (query.includes('"')) {
      return query;
    }

    // If query contains FTS5 operators (AND, OR, NOT), use as-is
    if (/\b(AND|OR|NOT)\b/i.test(query)) {
      return query;
    }

    // Escape special FTS5 characters
    return this.escapeFTS5(query);
  }

  /**
   * Escape FTS5 special characters
   */
  private escapeFTS5(query: string): string {
    // FTS5 special characters: " * ( ) AND OR NOT
    return query.replace(/["*()]/g, '');
  }

  /**
   * Strip markdown formatting from text
   */
  private stripMarkdown(text: string): string {
    return (
      text
        // Remove headers
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold/italic
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        // Remove links [text](url)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove images ![alt](url)
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        // Remove inline code
        .replace(/`([^`]+)`/g, '$1')
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '')
        // Remove blockquotes
        .replace(/^>\s+/gm, '')
        // Remove horizontal rules
        .replace(/^[-*_]{3,}$/gm, '')
        // Remove list markers
        .replace(/^[\s]*[-*+]\s+/gm, '')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        // Clean up extra whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    );
  }

  /**
   * Generate excerpt with highlighted search terms
   *
   * Creates a text snippet showing matched terms in context.
   */
  private generateExcerpt(content: string, query: string, maxLength: number = 200): string {
    if (!content) {
      return '';
    }

    // Strip markdown first
    const plainText = this.stripMarkdown(content);

    // Simple excerpt generation - find first occurrence of query term
    const lowerContent = plainText.toLowerCase();
    const lowerQuery = query.toLowerCase().replace(/["*()]/g, '');
    const terms = lowerQuery.split(/\s+/).filter(t => t.length > 2);

    let startIndex = 0;
    for (const term of terms) {
      const index = lowerContent.indexOf(term);
      if (index !== -1) {
        startIndex = Math.max(0, index - 50);
        break;
      }
    }

    let excerpt = plainText.slice(startIndex, startIndex + maxLength);

    // Add ellipsis if needed
    if (startIndex > 0) {
      excerpt = '...' + excerpt;
    }
    if (startIndex + maxLength < plainText.length) {
      excerpt = excerpt + '...';
    }

    return excerpt.trim();
  }

  /**
   * Transform FTS5 result to SearchResultDTO
   */
  private transformSearchResult(
    row: FTS5SearchResult,
    query: string,
    authorUsername?: string
  ): SearchResultDTO {
    // Generate excerpt from content (not title)
    const excerpt = this.generateExcerpt(row.content, query);

    return {
      id: row.content_id,
      content_type: row.content_type,
      title: row.title || '',
      content: row.content,
      author_username: authorUsername || row.author_username,
      category_name: row.category_name,
      created_at: row.created_at,
      topic_id: row.topic_id,
      view_count: row.view_count || 0,
      reply_count: row.reply_count || 0,
      is_locked: Boolean(row.is_locked),
      is_pinned: Boolean(row.is_pinned),
      is_solved: Boolean(row.is_solved),
      is_archived: Boolean(row.is_archived),
      highlight: excerpt,
      rank: row.rank,
    };
  }
}

/**
 * Export singleton instance
 */
export const searchRepository = new SearchRepository();
