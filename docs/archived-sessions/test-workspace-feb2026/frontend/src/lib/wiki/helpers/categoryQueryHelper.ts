/**
 * Centralized Category Query Helper
 *
 * This helper ensures all category-related queries use the same logic
 * to prevent count discrepancies between different parts of the system.
 *
 * NOTE: Uses only the direct category_id column for consistency.
 * The junction table wiki_page_categories is deprecated.
 *
 * MIGRATION: Converted from SQLite to PostgreSQL
 * - Uses dbAdapter for async database operations
 * - All methods are now async
 * - PostgreSQL parameter placeholders ($1, $2, etc.)
 * - Cross-schema joins use qualified table names (auth.users)
 */

import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

export class CategoryQueryHelper {
  /**
   * Get unified category condition for WHERE clauses
   * Uses only the direct category_id column
   */
  static getCategoryCondition(
    category: string,
    tableAlias = 'p',
    startIndex = 1
  ): {
    condition: string;
    params: any[];
  } {
    return {
      condition: `(${tableAlias}.category_id = $${startIndex} OR ${tableAlias}.category_id LIKE $${startIndex + 1})`,
      params: [category, `${category}-%`],
    };
  }

  /**
   * Get unified page count query for a category
   * Counts from direct category_id column only
   */
  static getPageCountQuery(categoryId: string): {
    query: string;
    params: any[];
  } {
    return {
      query: `
        SELECT COUNT(DISTINCT p.id) as count
        FROM wiki.wiki_pages p
        WHERE p.category_id = $1 AND p.status = 'published'
      `,
      params: [categoryId],
    };
  }

  /**
   * Get unified category JOIN clause for SELECT queries
   * Uses only direct categorization
   */
  static getCategoryJoins(): string {
    return `
      LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
    `;
  }

  /**
   * Get unified category SELECT fields
   * Uses only direct category
   */
  static getCategorySelectFields(): string {
    return `
      c.id as category_id,
      c.name as category_name
    `;
  }

  /**
   * Execute a page count query for a specific category
   */
  static async executePageCount(categoryId: string): Promise<number> {
    const { query, params } = this.getPageCountQuery(categoryId);

    try {
      const result = await dbAdapter.query(query, params, { schema: 'wiki' });
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('[CategoryQueryHelper] Error executing page count:', error);
      throw error;
    }
  }

  /**
   * Get all pages in a category using unified approach
   */
  static async getPagesInCategory(
    categoryId: string,
    limit?: number,
    userRole?: string
  ): Promise<any[]> {
    // PostgreSQL uses STRING_AGG instead of GROUP_CONCAT
    let query = `
      SELECT
        p.id,
        p.slug,
        p.title,
        p.namespace,
        p.project_slug,
        p.template_type,
        p.category_id,
        p.status,
        p.protection_level,
        p.created_by,
        p.created_at,
        p.updated_at,
        r.content,
        r.content_format,
        r.size_bytes,
        ${this.getCategorySelectFields()},
        STRING_AGG(DISTINCT t.name, ',') as tags,
        COALESCE(SUM(pv.view_count), 0) as total_views,
        u.username,
        u.display_name,
        u.avatar_url
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
      ${this.getCategoryJoins()}
      LEFT JOIN wiki.wiki_page_tags pt ON p.id = pt.page_id
      LEFT JOIN wiki.wiki_tags t ON pt.tag_id = t.id
      LEFT JOIN wiki.wiki_page_views pv ON p.id = pv.page_id
      LEFT JOIN users.users u ON p.created_by = u.id
      WHERE p.status = 'published'
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    // Add category filter
    const categoryCondition = this.getCategoryCondition(categoryId, 'p', paramIndex);
    query += ` AND ${categoryCondition.condition}`;
    queryParams.push(...categoryCondition.params);
    paramIndex += categoryCondition.params.length;

    // Add access control
    if (userRole !== 'admin' && userRole !== 'moderator' && categoryId !== 'library') {
      query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
    }

    // PostgreSQL requires all non-aggregated columns in GROUP BY
    query += `
      GROUP BY p.id, p.slug, p.title, p.namespace, p.project_slug, p.template_type, p.category_id, p.status, p.protection_level, p.created_by, p.created_at, p.updated_at, r.content, r.content_format, r.size_bytes,
               c.id, c.name, u.username, u.display_name, u.avatar_url
      ORDER BY p.updated_at DESC
    `;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      queryParams.push(limit);
    }

    try {
      const result = await dbAdapter.query(query, queryParams, { schema: 'wiki' });
      return result.rows;
    } catch (error) {
      logger.error('[CategoryQueryHelper] Error getting pages in category:', error);
      throw error;
    }
  }
}
