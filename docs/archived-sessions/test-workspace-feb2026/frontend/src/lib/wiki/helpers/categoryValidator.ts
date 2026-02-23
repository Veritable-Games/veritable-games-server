/**
 * Category System Validator
 *
 * Ensures consistency between dual categorization systems and
 * provides validation for category operations.
 *
 * MIGRATION: Converted from SQLite to PostgreSQL
 * - Uses dbAdapter for async database operations
 * - All methods are now async
 * - PostgreSQL parameter placeholders ($1, $2, etc.)
 * - Schema-qualified table names (wiki.table_name)
 */

import { dbAdapter } from '@/lib/database/adapter';
import { CategoryQueryHelper } from './categoryQueryHelper';

export interface CategoryConsistencyReport {
  isConsistent: boolean;
  discrepancies: Array<{
    categoryId: string;
    directCount: number;
    junctionCount: number;
    combinedCount: number;
  }>;
  summary: {
    totalCategories: number;
    categoriesWithDiscrepancies: number;
    maxDiscrepancy: number;
  };
}

export class CategoryValidator {
  /**
   * Validate consistency between direct category_id and junction table
   */
  static async validateCategoryConsistency(): Promise<CategoryConsistencyReport> {
    const categoriesResult = await dbAdapter.query(
      'SELECT id, name FROM wiki.wiki_categories',
      [],
      { schema: 'wiki' }
    );
    const categories = categoriesResult.rows as Array<{
      id: string;
      name: string;
    }>;

    const discrepancies: CategoryConsistencyReport['discrepancies'] = [];
    let maxDiscrepancy = 0;

    for (const category of categories) {
      // Count from direct column only
      const directCountResult = await dbAdapter.query(
        `
        SELECT COUNT(*) as count FROM wiki.wiki_pages
        WHERE category_id = $1 AND status = 'published'
      `,
        [category.id],
        { schema: 'wiki' }
      );
      const directCount = directCountResult.rows[0]?.count || 0;

      // Count from junction table only
      const junctionCountResult = await dbAdapter.query(
        `
        SELECT COUNT(*) as count FROM wiki.wiki_page_categories wpc
        JOIN wiki.wiki_pages wp ON wpc.page_id = wp.id
        WHERE wpc.category_id = $1 AND wp.status = 'published'
      `,
        [category.id],
        { schema: 'wiki' }
      );
      const junctionCount = junctionCountResult.rows[0]?.count || 0;

      // Count using unified approach
      const combinedCount = await CategoryQueryHelper.executePageCount(category.id);

      const directVal = Number(directCount);
      const junctionVal = Number(junctionCount);
      const combinedVal = Number(combinedCount);

      // Check for discrepancies
      if (directVal !== combinedVal && junctionVal !== combinedVal) {
        const discrepancy = Math.abs(directVal - combinedVal);
        maxDiscrepancy = Math.max(maxDiscrepancy, discrepancy);

        discrepancies.push({
          categoryId: category.id,
          directCount: directVal,
          junctionCount: junctionVal,
          combinedCount: combinedVal,
        });
      }
    }

    return {
      isConsistent: discrepancies.length === 0,
      discrepancies,
      summary: {
        totalCategories: categories.length,
        categoriesWithDiscrepancies: discrepancies.length,
        maxDiscrepancy,
      },
    };
  }

  /**
   * Validate that a page's categorization is consistent
   */
  static async validatePageCategorization(pageId: number): Promise<{
    isConsistent: boolean;
    directCategory: string | null;
    junctionCategories: string[];
    recommendations: string[];
  }> {
    // Get direct category
    const directResult = await dbAdapter.query(
      `
      SELECT category_id FROM wiki.wiki_pages WHERE id = $1
    `,
      [pageId],
      { schema: 'wiki' }
    );

    // Get junction categories
    const junctionResults = await dbAdapter.query(
      `
      SELECT category_id FROM wiki.wiki_page_categories WHERE page_id = $1
    `,
      [pageId],
      { schema: 'wiki' }
    );

    const directCategory = directResult.rows[0]?.category_id || null;
    const junctionCategories = junctionResults.rows.map((r: any) => r.category_id);

    const recommendations: string[] = [];
    let isConsistent = true;

    // Check for inconsistencies
    if (directCategory && !junctionCategories.includes(directCategory)) {
      isConsistent = false;
      recommendations.push(`Add direct category '${directCategory}' to junction table`);
    }

    if (junctionCategories.length > 1 && directCategory) {
      recommendations.push(
        `Consider removing direct category_id since page has multiple categories via junction table`
      );
    }

    if (!directCategory && junctionCategories.length === 1) {
      recommendations.push(
        `Consider setting direct category_id to '${junctionCategories[0]}' for performance`
      );
    }

    return {
      isConsistent,
      directCategory,
      junctionCategories,
      recommendations,
    };
  }

  /**
   * Repair category inconsistencies
   */
  static async repairCategoryInconsistencies(dryRun = true): Promise<{
    actionsPerformed: Array<{
      action: string;
      pageId?: number;
      categoryId?: string;
      details: string;
    }>;
    totalActions: number;
  }> {
    const actions: Array<{
      action: string;
      pageId?: number;
      categoryId?: string;
      details: string;
    }> = [];

    // Find pages with direct category but no junction entry
    const orphanedDirectResult = await dbAdapter.query(
      `
      SELECT p.id, p.category_id
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_page_categories wpc ON p.id = wpc.page_id AND p.category_id = wpc.category_id
      WHERE p.category_id IS NOT NULL AND wpc.page_id IS NULL
    `,
      [],
      { schema: 'wiki' }
    );
    const orphanedDirect = orphanedDirectResult.rows as Array<{
      id: number;
      category_id: string;
    }>;

    for (const page of orphanedDirect) {
      if (!dryRun) {
        // PostgreSQL uses ON CONFLICT instead of INSERT OR IGNORE
        await dbAdapter.query(
          `
          INSERT INTO wiki.wiki_page_categories (page_id, category_id)
          VALUES ($1, $2)
          ON CONFLICT (page_id, category_id) DO NOTHING
        `,
          [page.id, page.category_id],
          { schema: 'wiki' }
        );
      }

      actions.push({
        action: 'ADD_JUNCTION_ENTRY',
        pageId: page.id,
        categoryId: page.category_id,
        details: `Added junction table entry for page ${page.id} -> category ${page.category_id}`,
      });
    }

    // Find pages with junction categories but no direct category
    const orphanedJunctionResult = await dbAdapter.query(
      `
      SELECT wpc.page_id, wpc.category_id
      FROM wiki.wiki_page_categories wpc
      JOIN wiki.wiki_pages p ON wpc.page_id = p.id
      WHERE p.category_id IS NULL
      GROUP BY wpc.page_id, wpc.category_id
      HAVING COUNT(*) = 1
    `,
      [],
      { schema: 'wiki' }
    );
    const orphanedJunction = orphanedJunctionResult.rows as Array<{
      page_id: number;
      category_id: string;
    }>;

    for (const entry of orphanedJunction) {
      if (!dryRun) {
        await dbAdapter.query(
          `
          UPDATE wiki.wiki_pages SET category_id = $1 WHERE id = $2
        `,
          [entry.category_id, entry.page_id],
          { schema: 'wiki' }
        );
      }

      actions.push({
        action: 'SET_DIRECT_CATEGORY',
        pageId: entry.page_id,
        categoryId: entry.category_id,
        details: `Set direct category for page ${entry.page_id} to ${entry.category_id}`,
      });
    }

    return {
      actionsPerformed: actions,
      totalActions: actions.length,
    };
  }
}
