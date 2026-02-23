/**
 * WikiSearchService - Specialized service for wiki search and discovery
 * Phase 3: God object refactoring - extracted from WikiService
 * Migrated to PostgreSQL - Phase 11d
 */

import { dbAdapter } from '@/lib/database/adapter';
import { cache } from '@/lib/cache';
import { WikiPage, WikiSearchParams, WikiSearchResult } from '../types';

export class WikiSearchService {
  /**
   * Search wiki pages with comprehensive filtering options
   * Uses full-text search when text query is provided, otherwise uses filtered listing
   */
  async searchPages(params: WikiSearchParams, userRole?: string): Promise<WikiSearchResult> {
    // Use full-text search if query text is provided
    if (params.query) {
      return this.fullTextSearch(params.query, {
        limit: params.limit,
        offset: params.offset,
        categories: params.category ? [params.category] : undefined,
        namespace: params.namespace,
        status: params.status,
        tags: params.tags,
        author: params.author,
        userRole,
      });
    }

    // Fallback to filtered list for browse mode (no text query)
    let query = `
      SELECT
        p.*,
        r.content,
        r.content_format,
        r.size_bytes,
        c.id as category_id,
        c.name as category_name,
        string_agg(DISTINCT t.name, ',') as tags,
        COALESCE(SUM(pv.view_count), 0) as total_views,
        u.username,
        u.display_name,
        u.avatar_url
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
      LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
      LEFT JOIN wiki.wiki_page_tags pt ON p.id = pt.page_id
      LEFT JOIN wiki.wiki_tags t ON pt.tag_id = t.id
      LEFT JOIN wiki.wiki_page_views pv ON p.id = pv.page_id
      LEFT JOIN users.users u ON p.created_by = u.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    // Namespace filtering
    if (params.namespace) {
      query += ` AND p.namespace = $${paramIndex++}`;
      queryParams.push(params.namespace);
    } else {
      // Exclude journals by default (journals are in a separate UI)
      query += ` AND p.namespace != 'journals'`;
    }

    // Status filtering
    if (params.status) {
      query += ` AND p.status = $${paramIndex++}`;
      queryParams.push(params.status);
    }

    // Category filtering
    if (params.category) {
      query += ` AND p.category_id = $${paramIndex++}`;
      queryParams.push(params.category);
    }

    // Author filtering
    if (params.author) {
      query += ` AND u.username = $${paramIndex++}`;
      queryParams.push(params.author);
    }

    // Tag filtering
    if (params.tags && params.tags.length > 0) {
      const tagPlaceholders = params.tags.map(() => `$${paramIndex++}`).join(',');
      query += ` AND EXISTS (
        SELECT 1 FROM wiki.wiki_page_tags wpt
        JOIN wiki.wiki_tags wt ON wpt.tag_id = wt.id
        WHERE wpt.page_id = p.id AND wt.name IN (${tagPlaceholders})
      )`;
      queryParams.push(...params.tags);
    }

    // Date range filtering
    if (params.created_after) {
      query += ` AND DATE(p.created_at) >= $${paramIndex++}`;
      queryParams.push(params.created_after);
    }

    if (params.created_before) {
      query += ` AND DATE(p.created_at) <= $${paramIndex++}`;
      queryParams.push(params.created_before);
    }

    if (params.updated_after) {
      query += ` AND DATE(p.updated_at) >= $${paramIndex++}`;
      queryParams.push(params.updated_after);
    }

    if (params.updated_before) {
      query += ` AND DATE(p.updated_at) <= $${paramIndex++}`;
      queryParams.push(params.updated_before);
    }

    // Access control for Library category
    if (userRole !== 'admin' && userRole !== 'moderator' && params.category !== 'library') {
      query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
    }

    query += ` GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name, u.username, u.display_name, u.avatar_url`;

    // Add sorting with validation to prevent SQL injection
    const sort = params.sort || 'updated';
    const order = params.order || 'desc';

    // Validate sort direction to prevent SQL injection
    const validOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Validate sort column to prevent SQL injection
    const validSortColumns = ['title', 'created', 'views', 'relevance', 'updated'];
    const validSort = validSortColumns.includes(sort) ? sort : 'updated';

    switch (validSort) {
      case 'title':
        query += ` ORDER BY p.title ${validOrder}`;
        break;
      case 'created':
        query += ` ORDER BY p.created_at ${validOrder}`;
        break;
      case 'views':
        query += ` ORDER BY total_views ${validOrder}`;
        break;
      case 'relevance':
        if (params.query) {
          // Simple relevance scoring based on title vs content matches
          query += ` ORDER BY (
            CASE WHEN p.title ILIKE $${paramIndex++} THEN 2 ELSE 0 END +
            CASE WHEN r.content ILIKE $${paramIndex++} THEN 1 ELSE 0 END
          ) DESC, p.updated_at DESC`;
          queryParams.push(`%${params.query}%`, `%${params.query}%`);
        } else {
          query += ` ORDER BY p.updated_at ${validOrder}`;
        }
        break;
      default:
        query += ` ORDER BY p.updated_at ${validOrder}`;
    }

    // Add pagination with validation to prevent SQL injection
    const limit = Math.max(1, Math.min(Number(params.limit) || 20, 100)); // Cap at 100
    const offset = Math.max(0, Number(params.offset) || 0);

    // Validate that limit and offset are valid integers
    if (!Number.isInteger(limit) || !Number.isInteger(offset)) {
      throw new Error('Invalid pagination parameters');
    }

    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit, offset);

    // Execute search query
    const result = await dbAdapter.query(query, queryParams, { schema: 'wiki' });
    const pages = result.rows
      .map(result => this.formatPageResult(result))
      .filter(page => this.canUserAccessPage(page, userRole));

    // Get total count for pagination
    const totalCount = await this.getSearchResultCount(params, userRole);

    return {
      pages,
      total: totalCount,
      has_more: offset + pages.length < totalCount,
    };
  }

  /**
   * Get popular pages based on view counts (excludes journals namespace)
   */
  async getPopularPages(limit: number = 10, userRole?: string): Promise<WikiPage[]> {
    const cacheKey = `popular_pages:${limit}:${userRole || 'anonymous'}`;
    const cached = await cache.get<WikiPage[]>({ category: 'search', identifier: cacheKey });
    if (cached) {
      return cached;
    }

    let query = `
      SELECT
        p.*,
        r.content,
        r.content_format,
        r.size_bytes,
        c.id as category_id,
        c.name as category_name,
        string_agg(DISTINCT t.name, ',') as tags,
        COALESCE(SUM(pv.view_count), 0) as total_views,
        u.username,
        u.display_name,
        u.avatar_url
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
      LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
      LEFT JOIN wiki.wiki_page_tags pt ON p.id = pt.page_id
      LEFT JOIN wiki.wiki_tags t ON pt.tag_id = t.id
      LEFT JOIN wiki.wiki_page_views pv ON p.id = pv.page_id
      LEFT JOIN users.users u ON p.created_by = u.id
      WHERE p.status = 'published'
        AND p.namespace != 'journals'
        AND (c.id IS NULL OR c.is_public = true)
    `;

    // Add access control for Library category
    if (userRole !== 'admin') {
      query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
    }

    query += `
      GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name, u.username, u.display_name, u.avatar_url
      HAVING COALESCE(SUM(pv.view_count), 0) > 0
      ORDER BY total_views DESC
      LIMIT $1
    `;

    // Validate limit parameter to prevent SQL injection
    const validLimit = Math.max(1, Math.min(Number(limit) || 10, 100));
    if (!Number.isInteger(validLimit)) {
      throw new Error('Invalid limit parameter');
    }

    const result = await dbAdapter.query(query, [validLimit], { schema: 'wiki' });
    const pages = result.rows
      .map(result => this.formatPageResult(result))
      .filter(page => this.canUserAccessPage(page, userRole));

    // Cache for 10 minutes
    await cache.set({ category: 'search', identifier: cacheKey }, pages);

    return pages;
  }

  /**
   * Get recently created or updated pages (excludes journals namespace)
   */
  async getRecentPages(limit: number = 10, userRole?: string): Promise<WikiPage[]> {
    const cacheKey = `recent_pages:${limit}:${userRole || 'anonymous'}`;
    const cached = await cache.get<WikiPage[]>({ category: 'search', identifier: cacheKey });
    if (cached) {
      return cached;
    }

    let query = `
      SELECT
        p.*,
        r.content,
        r.content_format,
        r.size_bytes,
        c.id as category_id,
        c.name as category_name,
        string_agg(DISTINCT t.name, ',') as tags,
        COALESCE(SUM(pv.view_count), 0) as total_views,
        u.username,
        u.display_name,
        u.avatar_url
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
      LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
      LEFT JOIN wiki.wiki_page_tags pt ON p.id = pt.page_id
      LEFT JOIN wiki.wiki_tags t ON pt.tag_id = t.id
      LEFT JOIN wiki.wiki_page_views pv ON p.id = pv.page_id
      LEFT JOIN users.users u ON p.created_by = u.id
      WHERE p.status = 'published'
        AND p.namespace != 'journals'
        AND (c.id IS NULL OR c.is_public = true)
    `;

    // Add access control for Library category
    if (userRole !== 'admin') {
      query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
    }

    query += `
      GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name, u.username, u.display_name, u.avatar_url
      ORDER BY p.created_at DESC
      LIMIT $1
    `;

    // Validate limit parameter to prevent SQL injection
    const validLimit = Math.max(1, Math.min(Number(limit) || 10, 100));
    if (!Number.isInteger(validLimit)) {
      throw new Error('Invalid limit parameter');
    }

    const result = await dbAdapter.query(query, [validLimit], { schema: 'wiki' });
    const pages = result.rows
      .map(result => this.formatPageResult(result))
      .filter(page => this.canUserAccessPage(page, userRole));

    // Cache for 5 minutes
    await cache.set({ category: 'search', identifier: cacheKey }, pages);

    return pages;
  }

  /**
   * Get related pages based on shared tags and categories
   */
  async getRelatedPages(pageId: number, limit: number = 5, userRole?: string): Promise<WikiPage[]> {
    const cacheKey = `related_pages:${pageId}:${limit}:${userRole || 'anonymous'}`;
    const cached = await cache.get<WikiPage[]>({ category: 'search', identifier: cacheKey });
    if (cached) {
      return cached;
    }

    // Get the target page's tags and category
    const targetPageResult = await dbAdapter.query(
      `
      SELECT p.category_id, string_agg(DISTINCT wt.name, ',') as tags
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_page_tags wpt ON p.id = wpt.page_id
      LEFT JOIN wiki.wiki_tags wt ON wpt.tag_id = wt.id
      WHERE p.id = $1
      GROUP BY p.id, p.category_id
    `,
      [pageId],
      { schema: 'wiki' }
    );

    const targetPage = targetPageResult.rows[0] as
      | { category_id: string; tags: string }
      | undefined;

    if (!targetPage) {
      return [];
    }

    const tags = targetPage.tags ? targetPage.tags.split(',') : [];

    const queryParams: any[] = [targetPage.category_id];
    let paramIndex = 2;

    const tagPlaceholders = tags.length > 0 ? tags.map(() => `$${paramIndex++}`).join(',') : '';
    queryParams.push(...tags);
    queryParams.push(pageId);

    let query = `
      SELECT
        p.*,
        r.content,
        r.content_format,
        r.size_bytes,
        c.id as category_id,
        c.name as category_name,
        string_agg(DISTINCT t.name, ',') as tags,
        COALESCE(SUM(pv.view_count), 0) as total_views,
        u.username,
        u.display_name,
        u.avatar_url,
        (
          CASE WHEN p.category_id = $1 THEN 2 ELSE 0 END +
          COALESCE((
            SELECT COUNT(*)
            FROM wiki.wiki_page_tags wpt2
            JOIN wiki.wiki_tags wt2 ON wpt2.tag_id = wt2.id
            WHERE wpt2.page_id = p.id ${tags.length > 0 ? `AND wt2.name IN (${tagPlaceholders})` : ''}
          ), 0)
        ) as relevance_score
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
      LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
      LEFT JOIN wiki.wiki_page_tags pt ON p.id = pt.page_id
      LEFT JOIN wiki.wiki_tags t ON pt.tag_id = t.id
      LEFT JOIN wiki.wiki_page_views pv ON p.id = pv.page_id
      LEFT JOIN users.users u ON p.created_by = u.id
      WHERE p.id != $${paramIndex++} AND p.status = 'published'
        AND p.namespace != 'journals'
    `;

    // Add access control
    if (userRole !== 'admin') {
      query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
    }

    query += `
      GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name, u.username, u.display_name, u.avatar_url
      HAVING (
        CASE WHEN p.category_id = $1 THEN 2 ELSE 0 END +
        COALESCE((
          SELECT COUNT(*)
          FROM wiki.wiki_page_tags wpt2
          JOIN wiki.wiki_tags wt2 ON wpt2.tag_id = wt2.id
          WHERE wpt2.page_id = p.id ${tags.length > 0 ? `AND wt2.name IN (${tagPlaceholders})` : ''}
        ), 0)
      ) > 0
      ORDER BY relevance_score DESC, total_views DESC
      LIMIT $${paramIndex++}
    `;

    // Validate limit parameter to prevent SQL injection
    const validLimit = Math.max(1, Math.min(Number(limit) || 5, 50));
    if (!Number.isInteger(validLimit)) {
      throw new Error('Invalid limit parameter');
    }

    queryParams.push(validLimit);

    const result = await dbAdapter.query(query, queryParams, { schema: 'wiki' });
    const pages = result.rows
      .map(result => this.formatPageResult(result))
      .filter(page => this.canUserAccessPage(page, userRole));

    // Cache for 30 minutes
    await cache.set({ category: 'search', identifier: cacheKey }, pages);

    return pages;
  }

  /**
   * Full-text search with PostgreSQL ts_vector ranking (converted from FTS5)
   */
  async fullTextSearch(
    query: string,
    options: {
      limit?: number;
      offset?: number;
      categories?: string[];
      namespace?: string;
      status?: string;
      tags?: string[];
      author?: string;
      userRole?: string;
    } = {}
  ): Promise<WikiSearchResult> {
    // Validate and sanitize input parameters
    const limit = Math.max(1, Math.min(Number(options.limit) || 20, 100));
    const offset = Math.max(0, Number(options.offset) || 0);
    const categories = Array.isArray(options.categories) ? options.categories : [];
    const userRole = options.userRole;

    // Validate pagination parameters
    if (!Number.isInteger(limit) || !Number.isInteger(offset)) {
      throw new Error('Invalid pagination parameters');
    }

    // Sanitize and prepare search query
    const searchQuery = this.sanitizeSearchQuery(query);
    if (!searchQuery) {
      return { pages: [], total: 0, has_more: false };
    }

    // Check cache first
    const cacheKey = `fts_search:${searchQuery}:${JSON.stringify(options)}`;
    const cached = await cache.get<WikiSearchResult>({
      category: 'search',
      identifier: cacheKey,
    });
    if (cached) {
      return cached;
    }

    // Build PostgreSQL full-text search query with ts_rank
    // Convert query to tsquery format
    const tsQuery = searchQuery.split(/\s+/).join(' | ');

    const queryParams: any[] = [tsQuery];
    let paramIndex = 2;

    let searchSQL = `
      SELECT
        p.*,
        r.content,
        r.content_format,
        r.size_bytes,
        c.id as category_id,
        c.name as category_name,
        string_agg(DISTINCT t.name, ',') as tags,
        COALESCE(SUM(pv.view_count), 0) as total_views,
        u.username,
        u.display_name,
        u.avatar_url,
        ts_rank(
          to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(r.content, '')),
          to_tsquery('english', $1)
        ) as rank
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
      LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
      LEFT JOIN wiki.wiki_page_tags pt ON p.id = pt.page_id
      LEFT JOIN wiki.wiki_tags t ON pt.tag_id = t.id
      LEFT JOIN wiki.wiki_page_views pv ON p.id = pv.page_id
      LEFT JOIN users.users u ON p.created_by = u.id
      WHERE to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(r.content, '')) @@ to_tsquery('english', $1)
    `;

    // Add namespace filter
    if (options.namespace) {
      searchSQL += ` AND p.namespace = $${paramIndex++}`;
      queryParams.push(options.namespace);
    } else {
      // Exclude journals by default (journals are in a separate UI)
      searchSQL += ` AND p.namespace != 'journals'`;
    }

    // Add status filter
    if (options.status) {
      searchSQL += ` AND p.status = $${paramIndex++}`;
      queryParams.push(options.status);
    } else {
      // Default to published only
      searchSQL += ` AND p.status = 'published'`;
    }

    // Category filtering
    if (categories.length > 0) {
      const categoryPlaceholders = categories.map(() => `$${paramIndex++}`).join(',');
      searchSQL += ` AND p.category_id IN (${categoryPlaceholders})`;
      queryParams.push(...categories);
    }

    // Author filtering
    if (options.author) {
      searchSQL += ` AND u.username = $${paramIndex++}`;
      queryParams.push(options.author);
    }

    // Tag filtering (AND logic - must have all specified tags)
    if (options.tags && options.tags.length > 0) {
      const tagPlaceholders = options.tags.map(() => `$${paramIndex++}`).join(',');
      searchSQL += ` AND EXISTS (
        SELECT 1 FROM wiki.wiki_page_tags wpt
        JOIN wiki.wiki_tags wt ON wpt.tag_id = wt.id
        WHERE wpt.page_id = p.id AND wt.name IN (${tagPlaceholders})
        GROUP BY wpt.page_id
        HAVING COUNT(DISTINCT wt.name) = $${paramIndex++}
      )`;
      queryParams.push(...options.tags, options.tags.length);
    }

    // Access control for Library category
    if (userRole !== 'admin' && userRole !== 'moderator') {
      searchSQL += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
    }

    // GROUP BY to handle aggregates
    searchSQL += ` GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name, u.username, u.display_name, u.avatar_url`;

    // Order by rank (higher is better in PostgreSQL ts_rank)
    searchSQL += ` ORDER BY rank DESC, total_views DESC`;

    // Add pagination
    searchSQL += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit, offset);

    // Execute search
    const result = await dbAdapter.query(searchSQL, queryParams, { schema: 'wiki' });

    const pages = result.rows
      .map(result => this.formatPageResult(result))
      .filter(page => this.canUserAccessPage(page, userRole));

    // Get total count
    let countSQL = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
      LEFT JOIN users.users u ON p.created_by = u.id
      WHERE to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(r.content, '')) @@ to_tsquery('english', $1)
    `;

    const countParams: any[] = [tsQuery];
    let countParamIndex = 2;

    // Add same filters for count
    if (options.namespace) {
      countSQL += ` AND p.namespace = $${countParamIndex++}`;
      countParams.push(options.namespace);
    }

    if (options.status) {
      countSQL += ` AND p.status = $${countParamIndex++}`;
      countParams.push(options.status);
    } else {
      countSQL += ` AND p.status = 'published'`;
    }

    if (categories.length > 0) {
      const categoryPlaceholders = categories.map(() => `$${countParamIndex++}`).join(',');
      countSQL += ` AND p.category_id IN (${categoryPlaceholders})`;
      countParams.push(...categories);
    }

    if (options.author) {
      countSQL += ` AND u.username = $${countParamIndex++}`;
      countParams.push(options.author);
    }

    if (options.tags && options.tags.length > 0) {
      const tagPlaceholders = options.tags.map(() => `$${countParamIndex++}`).join(',');
      countSQL += ` AND EXISTS (
        SELECT 1 FROM wiki.wiki_page_tags wpt
        JOIN wiki.wiki_tags wt ON wpt.tag_id = wt.id
        WHERE wpt.page_id = p.id AND wt.name IN (${tagPlaceholders})
        GROUP BY wpt.page_id
        HAVING COUNT(DISTINCT wt.name) = $${countParamIndex++}
      )`;
      countParams.push(...options.tags, options.tags.length);
    }

    if (userRole !== 'admin' && userRole !== 'moderator') {
      countSQL += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
    }

    const countResult = await dbAdapter.query(countSQL, countParams, { schema: 'wiki' });
    const total = countResult.rows[0]?.total || 0;

    const searchResult = {
      pages,
      total,
      has_more: offset + limit < total,
    };

    // Cache for 5 minutes
    await cache.set({ category: 'search', identifier: cacheKey }, searchResult);

    return searchResult;
  }

  /**
   * Search within journals namespace for authenticated user
   * Returns only journal pages created by the specified user
   */
  async searchJournals(
    query: string,
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      tags?: string[];
    } = {}
  ): Promise<WikiSearchResult> {
    // Validate and sanitize input parameters
    const limit = Math.max(1, Math.min(Number(options.limit) || 20, 100));
    const offset = Math.max(0, Number(options.offset) || 0);

    // Validate pagination parameters
    if (!Number.isInteger(limit) || !Number.isInteger(offset)) {
      throw new Error('Invalid pagination parameters');
    }

    // Sanitize and prepare search query
    const searchQuery = this.sanitizeSearchQuery(query);
    if (!searchQuery) {
      return { pages: [], total: 0, has_more: false };
    }

    // Check cache first
    const cacheKey = `journals_search:${userId}:${searchQuery}:${JSON.stringify(options)}`;
    const cached = await cache.get<WikiSearchResult>({
      category: 'search',
      identifier: cacheKey,
    });
    if (cached) {
      return cached;
    }

    // Build PostgreSQL full-text search query with ts_rank
    const tsQuery = searchQuery.split(/\s+/).join(' | ');

    const queryParams: any[] = [tsQuery, userId];
    let paramIndex = 3;

    let searchSQL = `
      SELECT
        p.*,
        r.content,
        r.content_format,
        r.size_bytes,
        c.id as category_id,
        c.name as category_name,
        string_agg(DISTINCT t.name, ',') as tags,
        u.username,
        u.display_name,
        u.avatar_url,
        ts_rank(
          to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(r.content, '')),
          to_tsquery('english', $1)
        ) as rank
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
      LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
      LEFT JOIN wiki.wiki_page_tags pt ON p.id = pt.page_id
      LEFT JOIN wiki.wiki_tags t ON pt.tag_id = t.id
      LEFT JOIN users.users u ON p.created_by = u.id
      WHERE to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(r.content, '')) @@ to_tsquery('english', $1)
        AND p.namespace = 'journals'
        AND p.created_by = $2
    `;

    // Tag filtering (AND logic - must have all specified tags)
    if (options.tags && options.tags.length > 0) {
      const tagPlaceholders = options.tags.map(() => `$${paramIndex++}`).join(',');
      searchSQL += ` AND EXISTS (
        SELECT 1 FROM wiki.wiki_page_tags wpt
        JOIN wiki.wiki_tags wt ON wpt.tag_id = wt.id
        WHERE wpt.page_id = p.id AND wt.name IN (${tagPlaceholders})
        GROUP BY wpt.page_id
        HAVING COUNT(DISTINCT wt.name) = $${paramIndex++}
      )`;
      queryParams.push(...options.tags, options.tags.length);
    }

    // GROUP BY to handle aggregates
    searchSQL += ` GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name, u.username, u.display_name, u.avatar_url`;

    // Order by rank
    searchSQL += ` ORDER BY rank DESC`;

    // Add pagination
    searchSQL += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit, offset);

    // Execute search
    const result = await dbAdapter.query(searchSQL, queryParams, { schema: 'wiki' });

    const pages = result.rows.map(result => this.formatPageResult(result));

    // Get total count
    let countSQL = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
      WHERE to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(r.content, '')) @@ to_tsquery('english', $1)
        AND p.namespace = 'journals'
        AND p.created_by = $2
    `;

    const countParams: any[] = [tsQuery, userId];
    let countParamIndex = 3;

    // Add same tag filters for count
    if (options.tags && options.tags.length > 0) {
      const tagPlaceholders = options.tags.map(() => `$${countParamIndex++}`).join(',');
      countSQL += ` AND EXISTS (
        SELECT 1 FROM wiki.wiki_page_tags wpt
        JOIN wiki.wiki_tags wt ON wpt.tag_id = wt.id
        WHERE wpt.page_id = p.id AND wt.name IN (${tagPlaceholders})
        GROUP BY wpt.page_id
        HAVING COUNT(DISTINCT wt.name) = $${countParamIndex++}
      )`;
      countParams.push(...options.tags, options.tags.length);
    }

    const countResult = await dbAdapter.query(countSQL, countParams, { schema: 'wiki' });
    const total = countResult.rows[0]?.total || 0;

    const searchResult = {
      pages,
      total,
      has_more: offset + limit < total,
    };

    // Cache for 2 minutes (shorter than public search due to frequent updates)
    await cache.set({ category: 'search', identifier: cacheKey }, searchResult);

    return searchResult;
  }

  /**
   * Sanitize search query to prevent syntax errors and injection
   * Converts user query into safe search syntax
   */
  private sanitizeSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      return '';
    }

    // Remove special characters that could cause errors
    // Keep: letters, numbers, spaces, hyphens, underscores
    let sanitized = query.replace(/[^\w\s\-]/g, ' ');

    // Trim and collapse multiple spaces
    sanitized = sanitized.trim().replace(/\s+/g, ' ');

    if (sanitized.length < 2) {
      return '';
    }

    // Split into terms
    const terms = sanitized.split(' ').filter(term => term.length >= 2);

    if (terms.length === 0) {
      return '';
    }

    // Return space-separated terms for PostgreSQL tsquery
    return terms.join(' ');
  }

  /**
   * Get search suggestions based on partial input
   */
  async getSearchSuggestions(partialQuery: string, limit: number = 10): Promise<string[]> {
    if (partialQuery.length < 2) {
      return [];
    }

    // Validate limit parameter to prevent SQL injection
    const validLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
    if (!Number.isInteger(validLimit)) {
      throw new Error('Invalid limit parameter');
    }

    const cacheKey = `search_suggestions:${partialQuery}:${validLimit}`;
    const cached = await cache.get<string[]>({ category: 'search', identifier: cacheKey });
    if (cached) {
      return cached;
    }

    const searchPattern = `%${partialQuery}%`;

    const result = await dbAdapter.query(
      `
      SELECT DISTINCT p.title
      FROM wiki.wiki_pages p
      WHERE p.status = 'published'
        AND LOWER(p.title) LIKE LOWER($1)
      ORDER BY p.title
      LIMIT $2
    `,
      [searchPattern, validLimit],
      { schema: 'wiki' }
    );

    const suggestions = result.rows.map(row => row.title);

    // Cache for 5 minutes
    await cache.set({ category: 'search', identifier: cacheKey }, suggestions);

    return suggestions;
  }

  /**
   * Get count of search results (for pagination)
   */
  private async getSearchResultCount(params: WikiSearchParams, userRole?: string): Promise<number> {
    let countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
      LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
      LEFT JOIN users.users u ON p.created_by = u.id
      WHERE 1=1
    `;

    const countParams: any[] = [];
    let paramIndex = 1;

    if (params.query) {
      countQuery += ` AND (p.title ILIKE $${paramIndex++} OR r.content ILIKE $${paramIndex++})`;
      countParams.push(`%${params.query}%`, `%${params.query}%`);
    }

    if (params.namespace) {
      countQuery += ` AND p.namespace = $${paramIndex++}`;
      countParams.push(params.namespace);
    }

    if (params.status) {
      countQuery += ` AND p.status = $${paramIndex++}`;
      countParams.push(params.status);
    }

    if (params.category) {
      countQuery += ` AND p.category_id = $${paramIndex++}`;
      countParams.push(params.category);
    }

    if (params.author) {
      countQuery += ` AND u.username = $${paramIndex++}`;
      countParams.push(params.author);
    }

    // Add access control for Library category
    if (userRole !== 'admin') {
      countQuery += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
    }

    const result = await dbAdapter.query(countQuery, countParams, { schema: 'wiki' });
    return result.rows[0]?.total || 0;
  }

  /**
   * Check if user can access a page based on role, category, and namespace
   */
  private canUserAccessPage(page: any, userRole?: string, userId?: number): boolean {
    // Check namespace-based access control
    // Journals are private - only accessible by the owner
    if (page.namespace === 'journals') {
      // Allow access only if user is the owner (created_by matches userId)
      // This ensures journals are truly private
      if (!userId || page.created_by !== userId) {
        return false;
      }
    }

    // Check category-based access control
    // Note: This method is synchronous but was accessing the database synchronously
    // For now, we'll skip the category check here as it would require making this async
    // Category access control is already handled in the main queries
    // This is a known limitation that should be addressed if needed

    return true;
  }

  /**
   * Format raw database result into WikiPage object
   */
  private formatPageResult(result: any): WikiPage {
    const categories = [];
    const category_ids = [];

    if (result.category_name && result.category_id) {
      categories.push(result.category_name);
      category_ids.push(result.category_id);
    } else if (result.categories) {
      categories.push(...result.categories.split(',').filter(Boolean));
      category_ids.push(
        ...(result.category_ids ? result.category_ids.split(',').filter(Boolean) : [])
      );
    }

    return {
      id: result.id,
      slug: result.slug,
      title: result.title,
      namespace: result.namespace,
      status: result.status,
      protection_level: result.protection_level,
      created_by: result.created_by,
      created_at: result.created_at,
      updated_at: result.updated_at,
      content: result.content,
      content_format: result.content_format,
      size_bytes: result.size_bytes,
      categories,
      category_ids,
      tags: result.tags ? result.tags.split(',').filter(Boolean) : [],
      total_views: result.total_views || 0,
      author: result.username
        ? {
            id: result.created_by,
            username: result.username,
            email: '',
            display_name: result.display_name,
            avatar_url: result.avatar_url,
            bio: '',
            role: 'user' as const,
            reputation: 0,
            post_count: 0,
            created_at: '',
            last_active: '',
            is_active: true,
          }
        : undefined,
    };
  }
}

// Export singleton instance
export const wikiSearchService = new WikiSearchService();
