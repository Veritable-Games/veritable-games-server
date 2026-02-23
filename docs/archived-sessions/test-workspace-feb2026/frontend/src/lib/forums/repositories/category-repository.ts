/**
 * Category Repository
 *
 * Data access layer for forum categories.
 * Handles CRUD operations, statistics, and category metadata.
 *
 * Key Operations:
 * - findAll: Get all categories ordered by sort_order
 * - findBySlug: Get category by URL slug
 * - findById: Get category by ID
 * - getStats: Get category statistics (topic/post counts)
 */

import { BaseRepository, RepositoryError } from './base-repository';
import { Result, Ok } from '@/lib/utils/result';
import { dbAdapter } from '@/lib/database/adapter';
import type { ForumCategory, CategoryId } from '../types';

/**
 * Raw category row from database (before transformation)
 */
interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  section: string;
  sort_order: number;
  is_public: number;
  topic_count: number;
  post_count: number;
  last_post_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Category statistics
 */
export interface CategoryStats {
  readonly category_id: CategoryId;
  readonly topic_count: number;
  readonly reply_count: number;
  readonly total_views: number;
  readonly unique_contributors: number;
  readonly last_activity_at: string | null;
}

/**
 * Category repository for data access
 */
export class CategoryRepository extends BaseRepository {
  /**
   * Find all categories ordered by sort_order
   */
  async findAll(): Promise<Result<ForumCategory[], RepositoryError>> {
    return this.execute('findAllCategories', async () => {
      const result = await dbAdapter.query(
        `SELECT
          id,
          slug,
          name,
          description,
          color,
          icon,
          section,
          sort_order,
          is_public,
          COALESCE((SELECT COUNT(*) FROM forum_topics WHERE category_id = forum_categories.id), 0) as topic_count,
          COALESCE((SELECT COUNT(*) FROM forum_topics WHERE category_id = forum_categories.id), 0) +
          COALESCE((SELECT COUNT(*) FROM forum_replies r JOIN forum_topics t ON r.topic_id = t.id WHERE t.category_id = forum_categories.id), 0) as post_count,
          (SELECT MAX(created_at) FROM forum_topics WHERE category_id = forum_categories.id) as last_post_at,
          created_at,
          updated_at
        FROM forum_categories
        ORDER BY sort_order ASC, name ASC`,
        [],
        { schema: 'forums' }
      );

      return result.rows.map(this.transformCategory);
    });
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string): Promise<Result<ForumCategory | null, RepositoryError>> {
    return this.execute('findCategoryBySlug', async () => {
      const result = await dbAdapter.query(
        `SELECT
          id,
          slug,
          name,
          description,
          color,
          icon,
          section,
          sort_order,
          is_public,
          COALESCE((SELECT COUNT(*) FROM forum_topics WHERE category_id = forum_categories.id), 0) as topic_count,
          COALESCE((SELECT COUNT(*) FROM forum_topics WHERE category_id = forum_categories.id), 0) +
          COALESCE((SELECT COUNT(*) FROM forum_replies r JOIN forum_topics t ON r.topic_id = t.id WHERE t.category_id = forum_categories.id), 0) as post_count,
          (SELECT MAX(created_at) FROM forum_topics WHERE category_id = forum_categories.id) as last_post_at,
          created_at,
          updated_at
        FROM forum_categories
        WHERE slug = $1`,
        [slug],
        { schema: 'forums' }
      );

      return result.rows[0] ? this.transformCategory(result.rows[0]) : null;
    });
  }

  /**
   * Find category by ID
   */
  async findById(id: CategoryId): Promise<Result<ForumCategory | null, RepositoryError>> {
    return this.execute('findCategoryById', async () => {
      const result = await dbAdapter.query(
        `SELECT
          id,
          slug,
          name,
          description,
          color,
          icon,
          section,
          sort_order,
          is_public,
          COALESCE((SELECT COUNT(*) FROM forum_topics WHERE category_id = forum_categories.id), 0) as topic_count,
          COALESCE((SELECT COUNT(*) FROM forum_topics WHERE category_id = forum_categories.id), 0) +
          COALESCE((SELECT COUNT(*) FROM forum_replies r JOIN forum_topics t ON r.topic_id = t.id WHERE t.category_id = forum_categories.id), 0) as post_count,
          (SELECT MAX(created_at) FROM forum_topics WHERE category_id = forum_categories.id) as last_post_at,
          created_at,
          updated_at
        FROM forum_categories
        WHERE id = $1`,
        [id],
        { schema: 'forums' }
      );

      return result.rows[0] ? this.transformCategory(result.rows[0]) : null;
    });
  }

  /**
   * Get category statistics
   */
  async getStats(categoryId: CategoryId): Promise<Result<CategoryStats, RepositoryError>> {
    return this.execute('getCategoryStats', async () => {
      const result = await dbAdapter.query(
        `SELECT
          $1 as category_id,
          COALESCE((SELECT COUNT(*) FROM forum_topics WHERE category_id = $2), 0) as topic_count,
          COALESCE((SELECT COUNT(*) FROM forum_replies r JOIN forum_topics t ON r.topic_id = t.id WHERE t.category_id = $3), 0) as reply_count,
          COALESCE((SELECT SUM(view_count) FROM forum_topics WHERE category_id = $4), 0) as total_views,
          COALESCE((SELECT COUNT(DISTINCT user_id) FROM forum_topics WHERE category_id = $5), 0) +
          COALESCE((SELECT COUNT(DISTINCT r.user_id) FROM forum_replies r JOIN forum_topics t ON r.topic_id = t.id WHERE t.category_id = $6), 0) as unique_contributors,
          (SELECT MAX(last_activity_at) FROM forum_topics WHERE category_id = $7) as last_activity_at`,
        [categoryId, categoryId, categoryId, categoryId, categoryId, categoryId, categoryId],
        { schema: 'forums' }
      );

      return result.rows[0] as CategoryStats;
    });
  }

  /**
   * Create a new category
   *
   * @param data - Category data
   * @returns Created category with ID
   */
  async create(data: {
    slug: string;
    name: string;
    description?: string | null;
    color?: string;
    sort_order?: number;
  }): Promise<Result<ForumCategory, RepositoryError>> {
    return this.transaction('createCategory', async () => {
      const { slug, name, description = null, color = '#6366f1', sort_order = 0 } = data;

      const insertResult = await dbAdapter.query(
        `INSERT INTO forum_categories (slug, name, description, color, sort_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
        [slug, name, description, color, sort_order],
        { schema: 'forums' }
      );

      const categoryId = insertResult.rows[0].id;

      // Fetch the created category
      const result = await dbAdapter.query(
        `SELECT
          id,
          slug,
          name,
          description,
          color,
          icon,
          section,
          sort_order,
          is_public,
          0 as topic_count,
          0 as post_count,
          NULL as last_post_at,
          created_at,
          updated_at
        FROM forum_categories
        WHERE id = $1`,
        [categoryId],
        { schema: 'forums' }
      );

      return this.transformCategory(result.rows[0]);
    });
  }

  /**
   * Update category
   */
  async update(
    id: CategoryId,
    data: {
      slug?: string;
      name?: string;
      description?: string | null;
      color?: string;
      sort_order?: number;
    }
  ): Promise<Result<ForumCategory, RepositoryError>> {
    return this.transaction('updateCategory', async () => {
      // Build dynamic UPDATE query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.slug !== undefined) {
        updates.push(`slug = $${paramIndex++}`);
        values.push(data.slug);
      }
      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.color !== undefined) {
        updates.push(`color = $${paramIndex++}`);
        values.push(data.color);
      }
      if (data.sort_order !== undefined) {
        updates.push(`sort_order = $${paramIndex++}`);
        values.push(data.sort_order);
      }

      updates.push('updated_at = NOW()');
      values.push(id);

      await dbAdapter.query(
        `UPDATE forum_categories SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values,
        { schema: 'forums' }
      );

      // Fetch updated category
      const result = await dbAdapter.query(
        `SELECT
          id,
          slug,
          name,
          description,
          color,
          icon,
          section,
          sort_order,
          is_public,
          COALESCE((SELECT COUNT(*) FROM forum_topics WHERE category_id = forum_categories.id), 0) as topic_count,
          COALESCE((SELECT COUNT(*) FROM forum_topics WHERE category_id = forum_categories.id), 0) +
          COALESCE((SELECT COUNT(*) FROM forum_replies r JOIN forum_topics t ON r.topic_id = t.id WHERE t.category_id = forum_categories.id), 0) as post_count,
          (SELECT MAX(created_at) FROM forum_topics WHERE category_id = forum_categories.id) as last_post_at,
          created_at,
          updated_at
        FROM forum_categories
        WHERE id = $1`,
        [id],
        { schema: 'forums' }
      );

      return this.transformCategory(result.rows[0]);
    });
  }

  /**
   * Delete category (only if empty)
   */
  async delete(id: CategoryId): Promise<Result<boolean, RepositoryError>> {
    return this.transaction('deleteCategory', async () => {
      // Check if category has topics
      const countResult = await dbAdapter.query(
        'SELECT COUNT(*) as count FROM forum_topics WHERE category_id = $1',
        [id],
        { schema: 'forums' }
      );

      if (countResult.rows[0].count > 0) {
        throw new Error('Cannot delete category with existing topics');
      }

      const result = await dbAdapter.query('DELETE FROM forum_categories WHERE id = $1', [id], {
        schema: 'forums',
      });
      return result.rowCount > 0;
    });
  }

  /**
   * Increment topic count for category
   * Note: topic_count is calculated dynamically via subquery, so this is a no-op
   * Kept for compatibility with service layer
   */
  async incrementTopicCount(categoryId: CategoryId): Promise<Result<void, RepositoryError>> {
    // Topic counts are calculated dynamically from forum_topics table
    // No need to update a counter since we use COUNT(*) in queries
    return Ok(undefined);
  }

  /**
   * Decrement topic count for category
   * Note: topic_count is calculated dynamically via subquery, so this is a no-op
   * Kept for compatibility with service layer
   */
  async decrementTopicCount(categoryId: CategoryId): Promise<Result<void, RepositoryError>> {
    // Topic counts are calculated dynamically from forum_topics table
    // No need to update a counter since we use COUNT(*) in queries
    return Ok(undefined);
  }

  /**
   * Transform database row to ForumCategory
   */
  private transformCategory(row: CategoryRow): ForumCategory {
    return {
      id: row.id as CategoryId,
      slug: row.slug,
      name: row.name,
      description: row.description ?? undefined,
      color: row.color,
      icon: row.icon ?? undefined,
      section: row.section,
      sort_order: row.sort_order,
      is_public: Boolean(row.is_public),
      topic_count: row.topic_count,
      post_count: row.post_count,
      last_activity_at: row.last_post_at ?? undefined, // Convert null to undefined
      created_at: row.created_at,
    };
  }
}

/**
 * Export singleton instance
 */
export const categoryRepository = new CategoryRepository();
