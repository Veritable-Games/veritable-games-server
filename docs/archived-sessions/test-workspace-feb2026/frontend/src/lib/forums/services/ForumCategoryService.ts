/**
 * Forum Category Service
 *
 * Handles all category-related operations including CRUD, reordering,
 * visibility control, and role-based filtering.
 */

import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import {
  ForumCategory,
  CreateCategoryData,
  UpdateCategoryData,
  NotFoundError,
  ConflictError,
  ValidationError,
  CategoryId,
} from '../types';
import {
  categoryAccessService,
  type UserAccessContext,
  type PermissionLevel,
} from './CategoryAccessService';

export class ForumCategoryService {
  constructor() {}

  /**
   * Get all categories with optional role-based filtering
   */
  async getAllCategories(
    userRole?: 'admin' | 'developer' | 'moderator' | 'user' | 'anonymous'
  ): Promise<ForumCategory[]> {
    try {
      let query = `
        SELECT
          id,
          slug,
          name,
          description,
          color,
          icon,
          section,
          sort_order,
          is_public,
          topic_count,
          reply_count as post_count,
          last_post_at as last_activity_at,
          created_at
        FROM forum_categories
      `;

      // Filter based on user role
      // Only admins can see admin-only categories (is_public = false)
      if (userRole !== 'admin') {
        query += ` WHERE is_public = true`;
      }

      query += ` ORDER BY section, sort_order, name`;

      const result = await dbAdapter.query(query, [], { schema: 'forums' });
      const categories = result.rows as ForumCategory[];

      return categories;
    } catch (error) {
      logger.error('[ForumCategoryService] Error fetching categories:', error);
      throw error;
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: CategoryId): Promise<ForumCategory> {
    try {
      const result = await dbAdapter.query(
        `
        SELECT
          id,
          slug,
          name,
          description,
          color,
          icon,
          section,
          sort_order,
          is_public,
          topic_count,
          reply_count as post_count,
          last_post_at as last_activity_at,
          created_at
        FROM forum_categories
        WHERE id = $1
      `,
        [id],
        { schema: 'forums' }
      );
      const category = result.rows[0] as ForumCategory | undefined;

      if (!category) {
        throw new NotFoundError('Category', id);
      }

      return category;
    } catch (error) {
      logger.error('[ForumCategoryService] Error fetching category by ID:', error);
      throw error;
    }
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(slug: string): Promise<ForumCategory> {
    try {
      const result = await dbAdapter.query(
        `
        SELECT
          id,
          slug,
          name,
          description,
          color,
          icon,
          section,
          sort_order,
          is_public,
          topic_count,
          reply_count as post_count,
          last_post_at as last_activity_at,
          created_at
        FROM forum_categories
        WHERE slug = $1
      `,
        [slug],
        { schema: 'forums' }
      );
      const category = result.rows[0] as ForumCategory | undefined;

      if (!category) {
        throw new NotFoundError('Category', slug);
      }

      return category;
    } catch (error) {
      logger.error('[ForumCategoryService] Error fetching category by slug:', error);
      throw error;
    }
  }

  /**
   * Check if a user can view a category based on visibility and role
   * @param categoryId - Category ID to check
   * @param userRole - User's role ('admin', 'moderator', 'user', 'anonymous')
   * @returns true if user can view the category, false otherwise
   */
  async canUserViewCategory(categoryId: CategoryId, userRole?: string): Promise<boolean> {
    try {
      const category = await this.getCategoryById(categoryId);
      // Admins can see all categories, others only see public ones
      return category.is_public || userRole === 'admin';
    } catch (error) {
      // If category not found, user cannot view it
      return false;
    }
  }

  /**
   * Check if a user can access a category with full context (badges, role)
   * @param categorySlug - Category slug to check
   * @param permissionLevel - Required permission level ('view', 'post', 'moderate')
   * @param userContext - User's access context including badges
   * @returns true if user has access, false otherwise
   */
  async canUserAccessCategory(
    categorySlug: string,
    permissionLevel: PermissionLevel,
    userContext: UserAccessContext
  ): Promise<boolean> {
    try {
      const category = await this.getCategoryBySlug(categorySlug);

      // Public categories with no access rules are always accessible for viewing
      if (category.is_public) {
        const isRestricted = await categoryAccessService.categoryIsRestricted(categorySlug);
        if (!isRestricted) {
          return true;
        }
      }

      // Check access rules
      return await categoryAccessService.userHasAccess(categorySlug, permissionLevel, userContext);
    } catch (error) {
      logger.error('[ForumCategoryService] Error checking category access:', error);
      return false;
    }
  }

  /**
   * Get all categories filtered by user access context
   * This method considers both is_public flag AND category_access rules
   *
   * @param userContext - User's access context including role and badges
   * @param permissionLevel - Filter by permission level (default: 'view')
   */
  async getAllCategoriesWithAccess(
    userContext: UserAccessContext,
    permissionLevel: PermissionLevel = 'view'
  ): Promise<ForumCategory[]> {
    try {
      // Get all categories
      const allCategories = await this.getAllCategories('admin'); // Get all, we'll filter manually

      // Filter categories based on access
      const accessibleCategories: ForumCategory[] = [];

      for (const category of allCategories) {
        // Check if category has access restrictions
        const isRestricted = await categoryAccessService.categoryIsRestricted(category.slug);

        if (!isRestricted) {
          // No restrictions - use is_public check
          if (category.is_public || userContext.role === 'admin') {
            accessibleCategories.push(category);
          }
        } else {
          // Has restrictions - check access rules
          const hasAccess = await categoryAccessService.userHasAccess(
            category.slug,
            permissionLevel,
            userContext
          );
          if (hasAccess) {
            accessibleCategories.push(category);
          }
        }
      }

      return accessibleCategories;
    } catch (error) {
      logger.error('[ForumCategoryService] Error fetching categories with access:', error);
      throw error;
    }
  }

  /**
   * Create new category
   */
  async createCategory(data: CreateCategoryData): Promise<ForumCategory> {
    try {
      // Validate required fields
      if (!data.name?.trim()) {
        throw new ValidationError('Category name is required');
      }
      if (!data.slug?.trim()) {
        throw new ValidationError('Category slug is required');
      }

      // Check for duplicate slug
      const existingResult = await dbAdapter.query(
        'SELECT id FROM forum_categories WHERE slug = $1',
        [data.slug],
        { schema: 'forums' }
      );

      if (existingResult.rows.length > 0) {
        throw new ConflictError(`Category with slug '${data.slug}' already exists`);
      }

      // Get max sort_order if not provided
      let sortOrder = data.sort_order ?? 0;
      if (sortOrder === 0) {
        const maxOrderResult = await dbAdapter.query(
          'SELECT MAX(sort_order) as max FROM forum_categories',
          [],
          { schema: 'forums' }
        );
        const maxOrder = maxOrderResult.rows[0] as { max: number | null };
        sortOrder = (maxOrder?.max ?? 0) + 1;
      }

      // Insert category
      const result = await dbAdapter.query(
        `
        INSERT INTO forum_categories (
          slug, name, description, color, icon, section, sort_order, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
        [
          data.slug,
          data.name,
          data.description ?? null,
          data.color ?? '#3B82F6',
          data.icon ?? null,
          data.section ?? 'general',
          sortOrder,
          data.is_public === false ? false : true,
        ],
        { schema: 'forums' }
      );

      const id = result.rows[0].id as CategoryId;

      // Fetch and return the created category
      return await this.getCategoryById(id);
    } catch (error) {
      logger.error('[ForumCategoryService] Error creating category:', error);
      throw error;
    }
  }

  /**
   * Update category
   */
  async updateCategory(id: CategoryId, data: UpdateCategoryData): Promise<ForumCategory> {
    try {
      // Check if category exists
      const existing = await this.getCategoryById(id);
      if (!existing) {
        throw new NotFoundError('Category', id);
      }

      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        if (!data.name.trim()) {
          throw new ValidationError('Category name cannot be empty');
        }
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }

      if (data.icon !== undefined) {
        updates.push(`icon = $${paramIndex++}`);
        values.push(data.icon);
      }

      if (data.color !== undefined) {
        updates.push(`color = $${paramIndex++}`);
        values.push(data.color);
      }

      if (data.section !== undefined) {
        updates.push(`section = $${paramIndex++}`);
        values.push(data.section);
      }

      if (data.sort_order !== undefined) {
        updates.push(`sort_order = $${paramIndex++}`);
        values.push(data.sort_order);
      }

      if (data.is_public !== undefined) {
        updates.push(`is_public = $${paramIndex++}`);
        values.push(data.is_public);
      }

      if (updates.length === 0) {
        // No updates, return existing category
        return existing;
      }

      // Add updated_at
      updates.push('updated_at = NOW()');

      // Execute update
      const query = `UPDATE forum_categories SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
      values.push(id);

      await dbAdapter.query(query, values, { schema: 'forums' });

      // Return updated category
      return await this.getCategoryById(id);
    } catch (error) {
      logger.error('[ForumCategoryService] Error updating category:', error);
      throw error;
    }
  }

  /**
   * Delete category (moves topics to default category)
   */
  async deleteCategory(id: CategoryId, moveToSlug: string = 'off-topic'): Promise<void> {
    try {
      // Check if category exists
      const category = await this.getCategoryById(id);
      if (!category) {
        throw new NotFoundError('Category', id);
      }

      // Protect system categories
      const systemCategories = ['forum-rules', 'off-topic'];
      if (systemCategories.includes(category.slug)) {
        throw new ValidationError(`Cannot delete system category '${category.slug}'`);
      }

      // Get target category for topic migration
      const targetCategory = await this.getCategoryBySlug(moveToSlug);
      if (!targetCategory) {
        throw new NotFoundError('Target category', moveToSlug);
      }

      // Use transaction to ensure atomicity
      await dbAdapter.transaction(async () => {
        // Move all topics to target category
        const moveResult = await dbAdapter.query(
          'UPDATE forum_topics SET category_id = $1 WHERE category_id = $2',
          [targetCategory.id, id],
          { schema: 'forums' }
        );

        logger.info(
          `[ForumCategoryService] Moved ${moveResult.rowCount} topics from category ${id} to ${targetCategory.id}`
        );

        // Delete the category
        await dbAdapter.query('DELETE FROM forum_categories WHERE id = $1', [id], {
          schema: 'forums',
        });

        // Update topic counts
        await this.recalculateCategoryStats(targetCategory.id);
      });

      logger.info(`[ForumCategoryService] Deleted category ${id}`);
    } catch (error) {
      logger.error('[ForumCategoryService] Error deleting category:', error);
      throw error;
    }
  }

  /**
   * Batch update category sort orders
   */
  async reorderCategories(updates: Array<{ id: CategoryId; sort_order: number }>): Promise<void> {
    try {
      if (!updates || updates.length === 0) {
        throw new ValidationError('No updates provided');
      }

      // Validate all category IDs exist
      for (const update of updates) {
        const existsResult = await dbAdapter.query(
          'SELECT id FROM forum_categories WHERE id = $1',
          [update.id],
          { schema: 'forums' }
        );
        if (existsResult.rows.length === 0) {
          throw new NotFoundError('Category', update.id);
        }
      }

      // Use transaction for atomic batch update
      await dbAdapter.transaction(async () => {
        for (const update of updates) {
          await dbAdapter.query(
            'UPDATE forum_categories SET sort_order = $1, updated_at = NOW() WHERE id = $2',
            [update.sort_order, update.id],
            { schema: 'forums' }
          );
        }
      });

      logger.info(`[ForumCategoryService] Reordered ${updates.length} categories`);
    } catch (error) {
      logger.error('[ForumCategoryService] Error reordering categories:', error);
      throw error;
    }
  }

  /**
   * Toggle category visibility
   */
  async toggleVisibility(id: CategoryId): Promise<ForumCategory> {
    try {
      const category = await this.getCategoryById(id);

      // Toggle is_public
      const newVisibility = !category.is_public;

      await dbAdapter.query(
        'UPDATE forum_categories SET is_public = $1, updated_at = NOW() WHERE id = $2',
        [newVisibility, id],
        { schema: 'forums' }
      );

      return await this.getCategoryById(id);
    } catch (error) {
      logger.error('[ForumCategoryService] Error toggling visibility:', error);
      throw error;
    }
  }

  /**
   * Batch toggle visibility for multiple categories
   */
  async batchToggleVisibility(ids: CategoryId[]): Promise<ForumCategory[]> {
    try {
      if (!ids || ids.length === 0) {
        throw new ValidationError('No category IDs provided');
      }

      // Use transaction for atomic batch update
      await dbAdapter.transaction(async () => {
        for (const id of ids) {
          await dbAdapter.query(
            'UPDATE forum_categories SET is_public = NOT is_public, updated_at = NOW() WHERE id = $1',
            [id],
            { schema: 'forums' }
          );
        }
      });

      // Return updated categories
      const categories = await Promise.all(ids.map(id => this.getCategoryById(id)));
      return categories;
    } catch (error) {
      logger.error('[ForumCategoryService] Error batch toggling visibility:', error);
      throw error;
    }
  }

  /**
   * Recalculate category statistics (topic count, reply count)
   */
  private async recalculateCategoryStats(categoryId: CategoryId): Promise<void> {
    try {
      const statsResult = await dbAdapter.query(
        `
        SELECT
          COUNT(*) as topic_count,
          COALESCE(SUM(reply_count), 0) as reply_count,
          MAX(last_activity_at) as last_post_at
        FROM forum_topics
        WHERE category_id = $1
      `,
        [categoryId],
        { schema: 'forums' }
      );
      const stats = statsResult.rows[0] as {
        topic_count: number;
        reply_count: number;
        last_post_at: string | null;
      };

      await dbAdapter.query(
        `
        UPDATE forum_categories
        SET topic_count = $1, reply_count = $2, last_post_at = $3
        WHERE id = $4
      `,
        [stats.topic_count, stats.reply_count, stats.last_post_at, categoryId],
        { schema: 'forums' }
      );
    } catch (error) {
      logger.error('[ForumCategoryService] Error recalculating stats:', error);
      throw error;
    }
  }

  /**
   * Get categories by section
   */
  async getCategoriesBySection(
    section: string,
    userRole?: 'admin' | 'moderator' | 'user' | 'anonymous'
  ): Promise<ForumCategory[]> {
    try {
      let query = `
        SELECT
          id,
          slug,
          name,
          description,
          color,
          icon,
          section,
          sort_order,
          is_public,
          topic_count,
          reply_count as post_count,
          last_post_at as last_activity_at,
          created_at
        FROM forum_categories
        WHERE section = $1
      `;

      const params: any[] = [section];

      // Filter based on user role
      // Only admins can see admin-only categories (is_public = false)
      if (userRole !== 'admin') {
        query += ` AND is_public = true`;
      }

      query += ` ORDER BY sort_order, name`;

      const result = await dbAdapter.query(query, params, { schema: 'forums' });
      const categories = result.rows as ForumCategory[];

      return categories;
    } catch (error) {
      logger.error('[ForumCategoryService] Error fetching categories by section:', error);
      throw error;
    }
  }
}

// Export singleton instance (per REACT_PATTERNS.md service export pattern)
export const forumCategoryService = new ForumCategoryService();

// Also export the class for testing/mocking
export default ForumCategoryService;
