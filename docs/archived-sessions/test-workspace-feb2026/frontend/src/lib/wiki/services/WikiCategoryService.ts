/**
 * WikiCategoryService - Specialized service for wiki category management
 * Phase 3: God object refactoring - extracted from WikiService
 */

import { dbAdapter } from '@/lib/database/adapter';
import { cache } from '@/lib/cache';
import { WikiCategory, CreateWikiCategoryData, UpdateWikiCategoryData } from '../types';
import { CategoryQueryHelper } from '../helpers/categoryQueryHelper';
import { logger } from '@/lib/utils/logger';

export class WikiCategoryService {
  /**
   * Create a new wiki category
   */
  async createCategory(data: CreateWikiCategoryData): Promise<WikiCategory> {
    // Validate parent category exists if provided
    if (data.parent_id) {
      const parentResult = await dbAdapter.query(
        'SELECT id FROM wiki_categories WHERE id = $1',
        [data.parent_id],
        { schema: 'wiki' }
      );
      if (parentResult.rows.length === 0) {
        throw new Error(`Parent category '${data.parent_id}' does not exist`);
      }
    }

    // Check for duplicate category ID
    const existingResult = await dbAdapter.query(
      'SELECT id FROM wiki_categories WHERE id = $1',
      [data.id],
      { schema: 'wiki' }
    );
    if (existingResult.rows.length > 0) {
      throw new Error(`Category with ID '${data.id}' already exists`);
    }

    try {
      await dbAdapter.query(
        `INSERT INTO wiki_categories (id, name, description, parent_id, color, icon, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          data.id,
          data.name,
          data.description || null,
          data.parent_id || null,
          data.color || '#6B7280',
          data.icon || null,
          data.sort_order || 0,
        ],
        { schema: 'wiki' }
      );

      // Invalidate category cache
      await this.invalidateCategoryCache();

      return this.getCategoryById(data.id);
    } catch (error: any) {
      if (error.code === '23505') {
        // PostgreSQL unique violation
        throw new Error(`Category with ID '${data.id}' already exists`);
      }
      throw new Error(`Failed to create category: ${error.message}`);
    }
  }

  /**
   * Update an existing category
   */
  async updateCategory(categoryId: string, data: UpdateWikiCategoryData): Promise<WikiCategory> {
    // Validate category exists
    const existingCategory = await this.getCategoryById(categoryId);
    if (!existingCategory) {
      throw new Error(`Category '${categoryId}' not found`);
    }

    // Validate parent category if being updated
    if (data.parent_id !== undefined && data.parent_id !== null) {
      const parentResult = await dbAdapter.query(
        'SELECT id FROM wiki_categories WHERE id = $1',
        [data.parent_id],
        { schema: 'wiki' }
      );
      if (parentResult.rows.length === 0) {
        throw new Error(`Parent category '${data.parent_id}' does not exist`);
      }

      // Prevent circular references
      if (data.parent_id === categoryId) {
        throw new Error('Category cannot be its own parent');
      }
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.parent_id !== undefined) {
      updates.push(`parent_id = $${paramIndex++}`);
      values.push(data.parent_id);
    }
    if (data.color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(data.color);
    }
    if (data.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(data.icon);
    }
    if (data.sort_order !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`);
      values.push(data.sort_order);
    }

    if (updates.length === 0) {
      return existingCategory; // No changes to make
    }

    values.push(categoryId);

    await dbAdapter.query(
      `UPDATE wiki_categories SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values,
      { schema: 'wiki' }
    );

    // Invalidate category cache
    await this.invalidateCategoryCache();

    return this.getCategoryById(categoryId);
  }

  /**
   * Delete a category (with validation for pages using it)
   */
  async deleteCategory(categoryId: string, moveToCategory?: string): Promise<void> {
    // Check if category exists
    const category = await this.getCategoryById(categoryId);
    if (!category) {
      throw new Error(`Category '${categoryId}' not found`);
    }

    // Prevent deletion of system categories
    if (categoryId === 'uncategorized') {
      throw new Error('Cannot delete the uncategorized category');
    }

    // Check for pages using this category
    const pagesResult = await dbAdapter.query(
      'SELECT COUNT(*) as count FROM wiki_pages WHERE category_id = $1',
      [categoryId],
      { schema: 'wiki' }
    );
    const pagesCount = parseInt(pagesResult.rows[0].count);

    if (pagesCount > 0) {
      if (moveToCategory) {
        // Validate target category exists
        const targetCategory = await this.getCategoryById(moveToCategory);
        if (!targetCategory) {
          throw new Error(`Target category '${moveToCategory}' does not exist`);
        }

        // Move pages to new category
        await dbAdapter.query(
          'UPDATE wiki_pages SET category_id = $1 WHERE category_id = $2',
          [moveToCategory, categoryId],
          { schema: 'wiki' }
        );
      } else {
        throw new Error(
          `Cannot delete category '${categoryId}' because it contains ${pagesCount} pages. ` +
            'Specify a target category to move pages to, or move pages manually first.'
        );
      }
    }

    // Check for subcategories
    const subcategories = await this.getSubcategories(categoryId);
    if (subcategories.length > 0) {
      if (moveToCategory) {
        // Move subcategories to new parent
        await dbAdapter.query(
          'UPDATE wiki_categories SET parent_id = $1 WHERE parent_id = $2',
          [moveToCategory, categoryId],
          { schema: 'wiki' }
        );
      } else {
        // Move subcategories to root level
        await dbAdapter.query(
          'UPDATE wiki_categories SET parent_id = NULL WHERE parent_id = $1',
          [categoryId],
          { schema: 'wiki' }
        );
      }
    }

    // Delete the category
    const deleteResult = await dbAdapter.query(
      'DELETE FROM wiki_categories WHERE id = $1',
      [categoryId],
      { schema: 'wiki' }
    );

    if (deleteResult.rowCount === 0) {
      throw new Error(`Category '${categoryId}' could not be deleted`);
    }

    // Invalidate category cache
    await this.invalidateCategoryCache();
  }

  /**
   * Get a category by ID with page count
   * Respects is_public flag - admins can see all categories, regular users only see public ones
   */
  async getCategoryById(categoryId: string, userRole?: string): Promise<WikiCategory> {
    const result = await dbAdapter.query(
      `SELECT
        c.*,
        COUNT(p.id) as page_count
      FROM wiki_categories c
      LEFT JOIN wiki_pages p ON c.id = p.category_id AND p.namespace != 'journals'
      WHERE c.id = $1
      GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at`,
      [categoryId],
      { schema: 'wiki' }
    );

    if (result.rows.length === 0) {
      throw new Error(`Category not found: "${categoryId}"`);
    }

    const row = result.rows[0];

    // Access control: Check if user can access this category
    const isPublic = row.is_public === true || row.is_public === 1;
    const isAdmin = userRole === 'admin' || userRole === 'moderator';

    if (!isPublic && !isAdmin) {
      throw new Error(`Category not found: "${categoryId}"`); // Hide existence of private categories from non-admins
    }

    return {
      id: row.id,
      parent_id: row.parent_id,
      name: row.name,
      description: row.description,
      color: row.color,
      icon: row.icon,
      sort_order: row.sort_order,
      is_public: isPublic,
      created_at: row.created_at,
      page_count: parseInt(row.page_count) || 0,
    };
  }

  /**
   * Get all categories with role-based filtering
   */
  async getAllCategories(userRole?: string): Promise<WikiCategory[]> {
    // TEMPORARILY DISABLED: Check cache first
    // TODO: Re-enable after verifying database persistence works
    // const cacheKey = `categories:all:${userRole || 'anonymous'}`;
    // const cached = await cache.get<WikiCategory[]>({ category: 'content', identifier: cacheKey });
    // if (cached) {
    //   return cached;
    // }

    try {
      // Check if wiki_categories table exists
      const tableCheckResult = await dbAdapter.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'wiki' AND table_name = 'wiki_categories'`,
        [],
        { schema: 'wiki' }
      );

      if (tableCheckResult.rows.length === 0) {
        return [];
      }

      // Count pages using only direct category_id column for consistency
      // Pages are hard-deleted, no soft-delete column exists
      // IMPORTANT: Exclude namespace='journals' - journals are private and should not appear in wiki category counts
      const result = await dbAdapter.query(
        `SELECT
          c.*,
          (
            SELECT COUNT(DISTINCT p.id)
            FROM wiki_pages p
            WHERE p.category_id = c.id
              AND p.status = 'published'
              AND p.namespace != 'journals'
          ) as page_count
        FROM wiki_categories c
        GROUP BY c.id
        ORDER BY c.sort_order, c.name`,
        [],
        { schema: 'wiki' }
      );

      const allCategories = result.rows.map(row => ({
        ...row,
        page_count: parseInt(row.page_count) || 0,
      })) as WikiCategory[];

      // Apply role-based filtering based on is_public field
      const filteredCategories = allCategories.filter(category => {
        // If category has is_public field set to false, it's admin-only
        if (category.is_public === false) {
          return userRole === 'admin';
        }
        // Default to public if is_public is undefined/null (for backwards compatibility)
        return true;
      });

      // TEMPORARILY DISABLED: Cache the result
      // TODO: Re-enable after verifying database persistence works
      // await cache.set({ category: 'content', identifier: cacheKey }, filteredCategories); // 5 minute cache

      return filteredCategories;
    } catch (error) {
      logger.error('Error getting wiki categories', { error });
      return [];
    }
  }

  /**
   * Get subcategories of a parent category
   */
  async getSubcategories(parentId: string): Promise<WikiCategory[]> {
    const cacheKey = `subcategories:${parentId}`;
    const cached = await cache.get<WikiCategory[]>({ category: 'content', identifier: cacheKey });
    if (cached) {
      return cached;
    }

    const result = await dbAdapter.query(
      `SELECT
        c.*,
        COUNT(DISTINCT p.id) as page_count
      FROM wiki_categories c
      LEFT JOIN wiki_pages p ON c.id = p.category_id AND p.status = 'published' AND p.namespace != 'journals'
      WHERE c.parent_id = $1
      GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at
      ORDER BY c.sort_order, c.name`,
      [parentId],
      { schema: 'wiki' }
    );

    const categories = result.rows.map(row => ({
      ...row,
      page_count: parseInt(row.page_count) || 0,
    })) as WikiCategory[];

    // Cache the result
    await cache.set({ category: 'content', identifier: cacheKey }, categories); // 5 minute cache

    return categories;
  }

  /**
   * Get root categories (categories with no parent)
   */
  async getRootCategories(userRole?: string): Promise<WikiCategory[]> {
    const cacheKey = `categories:root:${userRole || 'anonymous'}`;
    const cached = await cache.get<WikiCategory[]>({ category: 'content', identifier: cacheKey });
    if (cached) {
      return cached;
    }

    const result = await dbAdapter.query(
      `SELECT
        c.*,
        COUNT(DISTINCT p.id) as page_count
      FROM wiki_categories c
      LEFT JOIN wiki_pages p ON c.id = p.category_id AND p.status = 'published' AND p.namespace != 'journals'
      WHERE c.parent_id IS NULL
      GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at
      ORDER BY c.sort_order, c.name`,
      [],
      { schema: 'wiki' }
    );

    const allCategories = result.rows.map(row => ({
      ...row,
      page_count: parseInt(row.page_count) || 0,
    })) as WikiCategory[];

    // Apply role-based filtering
    const filteredCategories = allCategories.filter(category => {
      if (category.id === 'library') {
        return userRole === 'admin' || userRole === 'moderator';
      }
      return true;
    });

    // Cache the result
    await cache.set({ category: 'content', identifier: cacheKey }, filteredCategories);

    return filteredCategories;
  }

  /**
   * Get category hierarchy (tree structure)
   */
  async getCategoryHierarchy(userRole?: string): Promise<WikiCategory[]> {
    const cacheKey = `categories:hierarchy:${userRole || 'anonymous'}`;
    const cached = await cache.get<WikiCategory[]>({ category: 'content', identifier: cacheKey });
    if (cached) {
      return cached;
    }

    // Get all categories
    const allCategories = await this.getAllCategories(userRole);

    // Build hierarchy
    const categoryMap = new Map<string, WikiCategory & { children: WikiCategory[] }>();
    const rootCategories: (WikiCategory & { children: WikiCategory[] })[] = [];

    // Initialize map
    allCategories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    // Build tree structure
    allCategories.forEach(category => {
      const categoryWithChildren = categoryMap.get(category.id)!;

      if (category.parent_id && categoryMap.has(category.parent_id)) {
        categoryMap.get(category.parent_id)!.children.push(categoryWithChildren);
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    // Cache the result
    await cache.set({ category: 'content', identifier: cacheKey }, rootCategories);

    return rootCategories;
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<{
    total_categories: number;
    categories_with_pages: number;
    average_pages_per_category: number;
    most_used_category: WikiCategory | null;
  }> {
    const totalResult = await dbAdapter.query('SELECT COUNT(*) as count FROM wiki_categories', [], {
      schema: 'wiki',
    });

    const withPagesResult = await dbAdapter.query(
      `SELECT COUNT(DISTINCT c.id) as count
       FROM wiki_categories c
       INNER JOIN wiki_pages p ON c.id = p.category_id`,
      [],
      { schema: 'wiki' }
    );

    const avgResult = await dbAdapter.query(
      `SELECT AVG(page_count) as avg
       FROM (
         SELECT COUNT(p.id) as page_count
         FROM wiki_categories c
         LEFT JOIN wiki_pages p ON c.id = p.category_id
         GROUP BY c.id
       ) subquery`,
      [],
      { schema: 'wiki' }
    );

    const mostUsedResult = await dbAdapter.query(
      `SELECT c.*, COUNT(p.id) as page_count
       FROM wiki_categories c
       LEFT JOIN wiki_pages p ON c.id = p.category_id
       GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at
       HAVING COUNT(p.id) > 0
       ORDER BY COUNT(p.id) DESC
       LIMIT 1`,
      [],
      { schema: 'wiki' }
    );

    return {
      total_categories: parseInt(totalResult.rows[0].count),
      categories_with_pages: parseInt(withPagesResult.rows[0].count),
      average_pages_per_category: Math.round(parseFloat(avgResult.rows[0].avg) || 0),
      most_used_category:
        mostUsedResult.rows.length > 0
          ? {
              id: mostUsedResult.rows[0].id,
              parent_id: mostUsedResult.rows[0].parent_id,
              name: mostUsedResult.rows[0].name,
              description: mostUsedResult.rows[0].description,
              color: mostUsedResult.rows[0].color,
              icon: mostUsedResult.rows[0].icon,
              sort_order: mostUsedResult.rows[0].sort_order,
              created_at: mostUsedResult.rows[0].created_at,
              page_count: parseInt(mostUsedResult.rows[0].page_count),
            }
          : null,
    };
  }

  /**
   * Search categories by name or description
   */
  async searchCategories(query: string, userRole?: string): Promise<WikiCategory[]> {
    const searchPattern = `%${query}%`;

    const result = await dbAdapter.query(
      `SELECT
        c.*,
        COUNT(DISTINCT p.id) as page_count
      FROM wiki_categories c
      LEFT JOIN wiki_pages p ON c.id = p.category_id
      WHERE c.name ILIKE $1 OR c.description ILIKE $2
      GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at
      ORDER BY c.name`,
      [searchPattern, searchPattern],
      { schema: 'wiki' }
    );

    const allResults = result.rows.map(row => ({
      ...row,
      page_count: parseInt(row.page_count) || 0,
    })) as WikiCategory[];

    // Apply role-based filtering
    return allResults.filter(category => {
      if (category.id === 'library') {
        return userRole === 'admin' || userRole === 'moderator';
      }
      return true;
    });
  }

  /**
   * Invalidate all category-related cache entries
   */
  private async invalidateCategoryCache(): Promise<void> {
    const cacheKeys = [
      'categories:all:admin',
      'categories:all:moderator',
      'categories:all:user',
      'categories:all:anonymous',
      'categories:root:admin',
      'categories:root:moderator',
      'categories:root:user',
      'categories:root:anonymous',
      'categories:hierarchy:admin',
      'categories:hierarchy:moderator',
      'categories:hierarchy:user',
      'categories:hierarchy:anonymous',
    ];

    await Promise.all(cacheKeys.map(key => cache.delete({ category: 'content', identifier: key })));

    // Also invalidate any subcategory caches (harder to enumerate, so we'll let them expire)
  }
}

// Export singleton instance
export const wikiCategoryService = new WikiCategoryService();
