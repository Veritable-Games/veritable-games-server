/**
 * JournalCategoryService - Manages journal-specific categories
 * Completely separate from wiki categories
 */

import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import { verifyJournalOwnership } from '@/lib/auth/ownership';

export interface JournalCategory {
  id: string;
  user_id: number;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface CreateJournalCategoryData {
  name: string;
}

export interface UpdateJournalCategoryData {
  name?: string;
  sort_order?: number;
}

/**
 * Generates a unique category ID
 */
function generateCategoryId(userId: number): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `jcat-${userId}-${timestamp}-${random}`;
}

export class JournalCategoryService {
  /**
   * Ensure user has an 'Uncategorized' category
   * Creates one if it doesn't exist
   */
  async ensureUncategorized(userId: number): Promise<JournalCategory> {
    // Check if uncategorized already exists for this user
    const existingResult = await dbAdapter.query(
      `SELECT id, user_id, name, sort_order, created_at
       FROM journal_categories
       WHERE user_id = $1 AND name = 'Uncategorized'`,
      [userId],
      { schema: 'wiki' }
    );

    if (existingResult.rows.length > 0) {
      return existingResult.rows[0] as JournalCategory;
    }

    // Create the uncategorized category with sort_order 0 (always first)
    const id = `jcat-${userId}-uncategorized`;
    await dbAdapter.query(
      `INSERT INTO journal_categories (id, user_id, name, sort_order)
       VALUES ($1, $2, 'Uncategorized', 0)
       ON CONFLICT (user_id, name) DO NOTHING`,
      [id, userId],
      { schema: 'wiki' }
    );

    // Fetch and return the created category
    const result = await dbAdapter.query(
      `SELECT id, user_id, name, sort_order, created_at
       FROM journal_categories
       WHERE id = $1`,
      [id],
      { schema: 'wiki' }
    );

    return result.rows[0] as JournalCategory;
  }

  /**
   * Get all categories for a user (includes personal + team categories)
   * Returns the user's own categories plus any shared team categories
   */
  async getCategories(userId: number, userRole?: string): Promise<JournalCategory[]> {
    // TODO: Add is_team_category column support when it's added to schema
    const result = await dbAdapter.query(
      `SELECT id, user_id, name, sort_order, created_at
       FROM journal_categories
       WHERE user_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [userId],
      { schema: 'wiki' }
    );

    return result.rows as JournalCategory[];
  }

  /**
   * Get a category by ID (with user ownership check)
   * Admin/developer users can access any category if allowAdmin option is enabled
   */
  async getCategoryById(
    userId: number,
    categoryId: string,
    options?: { allowAdmin?: boolean }
  ): Promise<JournalCategory | null> {
    const result = await dbAdapter.query(
      options?.allowAdmin
        ? `SELECT id, user_id, name, sort_order, created_at
       FROM journal_categories
       WHERE id = $1`
        : `SELECT id, user_id, name, sort_order, created_at
       FROM journal_categories
       WHERE id = $1 AND user_id = $2`,
      options?.allowAdmin ? [categoryId] : [categoryId, userId],
      { schema: 'wiki' }
    );

    return result.rows.length > 0 ? (result.rows[0] as JournalCategory) : null;
  }

  /**
   * Check if category exists and return it, with optional admin bypass
   */
  async getCategoryByIdWithPermission(
    userId: number,
    categoryId: string,
    isAdmin: boolean = false
  ): Promise<JournalCategory | null> {
    return this.getCategoryById(userId, categoryId, { allowAdmin: isAdmin });
  }

  /**
   * Create a new category for a user
   */
  async createCategory(userId: number, data: CreateJournalCategoryData): Promise<JournalCategory> {
    const name = data.name.trim();

    if (!name) {
      throw new Error('Category name is required');
    }

    if (name.length > 100) {
      throw new Error('Category name must be 100 characters or less');
    }

    // Check for duplicate name
    const existingResult = await dbAdapter.query(
      `SELECT id FROM journal_categories
       WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
      [userId, name],
      { schema: 'wiki' }
    );

    if (existingResult.rows.length > 0) {
      throw new Error(`Category '${name}' already exists`);
    }

    // Get max sort_order for this user
    const maxOrderResult = await dbAdapter.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
       FROM journal_categories
       WHERE user_id = $1`,
      [userId],
      { schema: 'wiki' }
    );
    const sortOrder = maxOrderResult.rows[0].next_order;

    const id = generateCategoryId(userId);

    await dbAdapter.query(
      `INSERT INTO journal_categories (id, user_id, name, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [id, userId, name, sortOrder],
      { schema: 'wiki' }
    );

    logger.info('Journal category created', { userId: userId.toString(), categoryId: id, name });

    return this.getCategoryById(userId, id) as Promise<JournalCategory>;
  }

  /**
   * Rename a category
   */
  async renameCategory(
    userId: number,
    categoryId: string,
    newName: string
  ): Promise<JournalCategory> {
    const name = newName.trim();

    if (!name) {
      throw new Error('Category name is required');
    }

    if (name.length > 100) {
      throw new Error('Category name must be 100 characters or less');
    }

    // Verify ownership
    const category = await this.getCategoryById(userId, categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // Prevent renaming 'Uncategorized'
    if (category.name === 'Uncategorized') {
      throw new Error('Cannot rename the Uncategorized category');
    }

    // Check for duplicate name (excluding current category)
    const existingResult = await dbAdapter.query(
      `SELECT id FROM journal_categories
       WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id != $3`,
      [userId, name, categoryId],
      { schema: 'wiki' }
    );

    if (existingResult.rows.length > 0) {
      throw new Error(`Category '${name}' already exists`);
    }

    await dbAdapter.query(
      `UPDATE journal_categories
       SET name = $1
       WHERE id = $2 AND user_id = $3`,
      [name, categoryId, userId],
      { schema: 'wiki' }
    );

    logger.info('Journal category renamed', {
      userId: userId.toString(),
      categoryId,
      newName: name,
    });

    return this.getCategoryById(userId, categoryId) as Promise<JournalCategory>;
  }

  /**
   * Delete a category (moves journals to Uncategorized)
   */
  async deleteCategory(userId: number, categoryId: string): Promise<void> {
    // Verify ownership
    const category = await this.getCategoryById(userId, categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // Prevent deleting 'Uncategorized'
    if (category.name === 'Uncategorized') {
      throw new Error('Cannot delete the Uncategorized category');
    }

    // Ensure uncategorized exists
    const uncategorized = await this.ensureUncategorized(userId);

    // Move all journals in this category to Uncategorized
    await dbAdapter.query(
      `UPDATE journals
       SET category_id = $1
       WHERE category_id = $2`,
      [uncategorized.id, categoryId],
      { schema: 'wiki' }
    );

    // Delete the category
    await dbAdapter.query(
      `DELETE FROM journal_categories
       WHERE id = $1 AND user_id = $2`,
      [categoryId, userId],
      { schema: 'wiki' }
    );

    logger.info('Journal category deleted', {
      userId: userId.toString(),
      categoryId,
      movedTo: uncategorized.id,
    });
  }

  /**
   * Reorder categories
   */
  async reorderCategories(userId: number, orderedIds: string[]): Promise<void> {
    // Verify all categories belong to the user
    const existingResult = await dbAdapter.query(
      `SELECT id FROM journal_categories WHERE user_id = $1`,
      [userId],
      { schema: 'wiki' }
    );

    const existingIds = new Set(existingResult.rows.map((r: { id: string }) => r.id));
    const invalidIds = orderedIds.filter(id => !existingIds.has(id));

    if (invalidIds.length > 0) {
      throw new Error(`Invalid category IDs: ${invalidIds.join(', ')}`);
    }

    // Update sort_order for each category
    for (let i = 0; i < orderedIds.length; i++) {
      await dbAdapter.query(
        `UPDATE journal_categories
         SET sort_order = $1
         WHERE id = $2 AND user_id = $3`,
        [i, orderedIds[i], userId],
        { schema: 'wiki' }
      );
    }

    logger.info('Journal categories reordered', {
      userId: userId.toString(),
      count: orderedIds.length,
    });
  }

  /**
   * Move a journal to a different category
   */
  async moveJournalToCategory(
    userId: number,
    journalId: number,
    categoryId: string,
    options?: { isAdmin?: boolean }
  ): Promise<void> {
    // Verify the category belongs to the user
    const category = await this.getCategoryById(userId, categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // Verify the journal belongs to the user
    const journalResult = await dbAdapter.query(
      `SELECT id, user_id FROM journals
       WHERE id = $1`,
      [journalId],
      { schema: 'wiki' }
    );

    if (journalResult.rows.length === 0) {
      throw new Error('Journal not found');
    }

    // Verify ownership using centralized utility
    const journal = journalResult.rows[0];
    const isAuthorized = verifyJournalOwnership(
      journal,
      { id: userId },
      { allowAdmin: options?.isAdmin }
    );

    if (!isAuthorized) {
      throw new Error('You do not own this journal');
    }

    // Log admin operation for audit if admin bypassed ownership
    if (options?.isAdmin && journal.user_id !== userId) {
      logger.warn('ADMIN: Moving journal owned by different user', {
        journalId,
        ownerId: journal.user_id,
        adminId: userId,
      });
    }

    // Move the journal
    await dbAdapter.query(
      `UPDATE journals
       SET category_id = $1
       WHERE id = $2`,
      [categoryId, journalId],
      { schema: 'wiki' }
    );

    logger.info('Journal moved to category', { userId: userId.toString(), journalId, categoryId });
  }

  /**
   * Get journals grouped by category for a user
   */
  async getJournalsGroupedByCategory(userId: number): Promise<{
    categories: JournalCategory[];
    journalsByCategory: Record<string, number[]>;
  }> {
    // Ensure uncategorized exists
    await this.ensureUncategorized(userId);

    // Get all categories
    const categories = await this.getCategories(userId);

    // Get all journals with their category assignments
    const journalsResult = await dbAdapter.query(
      `SELECT id, category_id
       FROM journals
       WHERE user_id = $1`,
      [userId],
      { schema: 'wiki' }
    );

    // Group journals by category
    const journalsByCategory: Record<string, number[]> = {};

    // Initialize all categories with empty arrays
    for (const category of categories) {
      journalsByCategory[category.id] = [];
    }

    // Find the uncategorized category ID
    const uncategorizedCategory = categories.find(c => c.name === 'Uncategorized');
    const uncategorizedId = uncategorizedCategory?.id || '';

    // Assign journals to categories
    for (const journal of journalsResult.rows) {
      const categoryId = journal.category_id || uncategorizedId;
      if (journalsByCategory[categoryId]) {
        journalsByCategory[categoryId].push(journal.id);
      } else {
        // Journal has invalid category, put in uncategorized
        journalsByCategory[uncategorizedId]?.push(journal.id);
      }
    }

    return { categories, journalsByCategory };
  }
}

// Export singleton instance
export const journalCategoryService = new JournalCategoryService();
