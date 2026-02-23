/**
 * Forum Section Service
 *
 * Manages forum sections (major category groupings) with ordering and naming.
 */

import { dbAdapter } from '@/lib/database/adapter';
import type { ForumSection } from '../types';
import { logger } from '@/lib/utils/logger';

export class ForumSectionService {
  constructor() {
    // No database connection in constructor - using dbAdapter
  }

  /**
   * Get all sections ordered by sort_order
   */
  async getAllSections(): Promise<ForumSection[]> {
    const query = `
      SELECT id, display_name, sort_order, created_at, updated_at
      FROM forum_sections
      ORDER BY sort_order ASC
    `;

    const result = await dbAdapter.query(query, [], { schema: 'forums' });
    return result.rows as ForumSection[];
  }

  /**
   * Get a single section by ID
   */
  async getSectionById(id: string): Promise<ForumSection | undefined> {
    const query = `
      SELECT id, display_name, sort_order, created_at, updated_at
      FROM forum_sections
      WHERE id = $1
    `;

    const result = await dbAdapter.query(query, [id], { schema: 'forums' });
    return result.rows[0] as ForumSection | undefined;
  }

  /**
   * Update section display name
   */
  async updateSectionName(id: string, display_name: string): Promise<void> {
    if (!display_name || typeof display_name !== 'string' || !display_name.trim()) {
      throw new Error('Display name is required');
    }

    const section = await this.getSectionById(id);
    if (!section) {
      throw new Error(`Section '${id}' not found`);
    }

    const query = `
      UPDATE forum_sections
      SET display_name = $1, updated_at = NOW()
      WHERE id = $2
    `;

    await dbAdapter.query(query, [display_name.trim(), id], { schema: 'forums' });

    logger.info(`[ForumSectionService] Updated section '${id}' name to '${display_name}'`);
  }

  /**
   * Reorder sections (batch update)
   */
  async reorderSections(updates: { id: string; sort_order: number }[]): Promise<void> {
    if (!updates || updates.length === 0) {
      throw new Error('No updates provided');
    }

    // Validate all sections exist
    for (const update of updates) {
      const section = await this.getSectionById(update.id);
      if (!section) {
        throw new Error(`Section '${update.id}' not found`);
      }
    }

    // Use transaction for atomic batch update
    await dbAdapter.transaction(
      async client => {
        for (const update of updates) {
          await client.query(
            'UPDATE forum_sections SET sort_order = $1, updated_at = NOW() WHERE id = $2',
            [update.sort_order, update.id]
          );
        }
      },
      { schema: 'forums' }
    );

    logger.info(`[ForumSectionService] Reordered ${updates.length} sections`);
  }

  /**
   * Create a new section
   */
  async createSection(
    id: string,
    display_name: string,
    sort_order?: number
  ): Promise<ForumSection> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new Error('Section ID is required');
    }

    if (!display_name || typeof display_name !== 'string' || !display_name.trim()) {
      throw new Error('Display name is required');
    }

    // Check if section already exists
    const existing = await this.getSectionById(id);
    if (existing) {
      throw new Error(`Section '${id}' already exists`);
    }

    // If no sort_order provided, use max + 1
    const maxOrder = sort_order ?? (await this.getMaxSortOrder()) + 1;

    const query = `
      INSERT INTO forum_sections (id, display_name, sort_order, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING id, display_name, sort_order, created_at, updated_at
    `;

    const result = await dbAdapter.query(query, [id.trim(), display_name.trim(), maxOrder], {
      schema: 'forums',
    });

    logger.info(`[ForumSectionService] Created section '${id}' (${display_name})`);

    return result.rows[0] as ForumSection;
  }

  /**
   * Delete a section and all its categories (cascade delete)
   */
  async deleteSection(id: string): Promise<void> {
    if (!id) {
      throw new Error('Section ID is required');
    }

    const section = await this.getSectionById(id);
    if (!section) {
      throw new Error(`Section '${id}' not found`);
    }

    // Check if section has categories
    const categoryCountResult = await dbAdapter.query(
      'SELECT COUNT(*) as count FROM forum_categories WHERE section = $1',
      [id],
      { schema: 'forums' }
    );
    const categoryCount = categoryCountResult.rows[0].count as number;

    // Use transaction to delete categories and section
    await dbAdapter.transaction(
      async client => {
        if (categoryCount > 0) {
          // Delete all categories in this section
          await client.query('DELETE FROM forum_categories WHERE section = $1', [id]);
        }

        // Delete the section
        await client.query('DELETE FROM forum_sections WHERE id = $1', [id]);
      },
      { schema: 'forums' }
    );

    if (categoryCount > 0) {
      logger.info(`[ForumSectionService] Deleted section '${id}' and ${categoryCount} categories`);
    } else {
      logger.info(`[ForumSectionService] Deleted empty section '${id}'`);
    }
  }

  /**
   * Get the maximum sort_order value
   */
  private async getMaxSortOrder(): Promise<number> {
    const result = await dbAdapter.query('SELECT MAX(sort_order) as max FROM forum_sections', [], {
      schema: 'forums',
    });

    return result.rows[0].max ?? 0;
  }
}

// Export singleton instance
export const forumSectionService = new ForumSectionService();
